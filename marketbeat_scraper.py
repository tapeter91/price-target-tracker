#!/usr/bin/env python3
import sys
import re
import json
import argparse
from urllib.request import Request, urlopen
from urllib.error import URLError

USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

def fetch_html_static(url):
    """Fetches HTML using Python's built-in urllib with browser headers."""
    req = Request(url, headers={'User-Agent': USER_AGENT})
    try:
        with urlopen(req, timeout=15) as response:
            return response.read().decode('utf-8')
    except URLError as e:
        raise RuntimeError(f"Static HTTP request failed: {e.reason}")
    except Exception as e:
        raise RuntimeError(f"Static HTTP fetch error: {str(e)}")

def fetch_html_dynamic(url):
    """Falls back to Playwright to load page and wait for JS-generated content."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise ImportError(
            "Playwright is not installed. To scrape JavaScript-rendered content, "
            "please install it using:\n  pip install playwright\n  playwright install"
        )
    
    print(f"[*] Launching headless browser for: {url}...", file=sys.stderr)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent=USER_AGENT)
        page.goto(url, wait_until="networkidle")
        # Wait a short moment to ensure scripts executed
        page.wait_for_timeout(2000)
        html = page.content()
        browser.close()
        return html

def resolve_ticker_path(ticker):
    """Searches MarketBeat search endpoint to find the exchange path for the ticker."""
    url = f"https://www.marketbeat.com/pages/search.aspx?query={ticker}"
    try:
        html = fetch_html_static(url)
    except Exception as e:
        # If static resolve fails, try dynamic
        try:
            html = fetch_html_dynamic(url)
        except Exception as dy_err:
            raise RuntimeError(f"Failed to resolve ticker search via static/dynamic means: {e} / {dy_err}")

    # Search for '/stocks/[EXCHANGE]/[TICKER]' in links
    regex = re.compile(rf'\/stocks\/[A-Za-z0-9_-]+\/{ticker}\b', re.IGNORECASE)
    matches = regex.findall(html)
    unique_matches = []
    for m in matches:
        if m not in unique_matches:
            unique_matches.append(m)

    preferred_exchanges = ['NASDAQ', 'NYSE', 'NYSEAMEX', 'OTCMKTS', 'OTC']

    if unique_matches:
        for m in unique_matches:
            parts = m.split('/')
            if len(parts) >= 3 and parts[2].upper() in preferred_exchanges:
                return m
        return unique_matches[0]
    
    # Fallback to general lookup
    fallback_regex = re.compile(r'\/stocks\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+', re.IGNORECASE)
    all_matches = fallback_regex.findall(html)
    unique_all = []
    for m in all_matches:
        if m not in unique_all:
            unique_all.append(m)

    matching_fallback = [m for m in unique_all if m.upper().endswith(f"/{ticker.upper()}")]
    
    if matching_fallback:
        for m in matching_fallback:
            parts = m.split('/')
            if len(parts) >= 3 and parts[2].upper() in preferred_exchanges:
                return m
        return matching_fallback[0]
            
    return None

def parse_forecast_data(html, ticker, resolved_path):
    """Parses targets and analyst details from forecast HTML using robust regexes."""
    data = {
        "ticker": ticker.upper(),
        "url": f"https://www.marketbeat.com{resolved_path}/forecast/",
        "company_name": ticker.upper(),
        "consensus_rating": "N/A",
        "consensus_price_target": None,
        "high_price_target": None,
        "low_price_target": None,
        "current_price": None,
        "upside_downside_pct": None,
        "upside_downside_text": "",
        "ratings_count": 0,
        "buys": 0,
        "holds": 0,
        "sells": 0,
        "analyst_ratings": []
    }

    # 1. Company Name
    title_match = re.search(r'<title>\s*([\s\S]*?)\s*<\/title>', html, re.IGNORECASE)
    if title_match:
        title_text = title_match.group(1).strip()
        data["company_name"] = title_text.split('(')[0].strip()

    # 2. Script Variables
    consensus_m = re.search(r"var consensus12Month\s*=\s*'([^']*)'", html)
    high_m = re.search(r"var high12Month\s*=\s*'([^']*)'", html)
    low_m = re.search(r"var low12Month\s*=\s*'([^']*)'", html)

    if consensus_m and consensus_m.group(1):
        data["consensus_price_target"] = round(float(consensus_m.group(1)), 2)
    if high_m and high_m.group(1):
        data["high_price_target"] = round(float(high_m.group(1)), 2)
    if low_m and low_m.group(1):
        data["low_price_target"] = round(float(low_m.group(1)), 2)

    # 3. Consensus Rating Text
    rating_m = re.search(r'<div class="rating-title">([^<]+)<\/div>', html, re.IGNORECASE)
    if rating_m:
        data["consensus_rating"] = rating_m.group(1).strip()

    # 4. Total ratings count
    count_m = re.search(r'Based on <strong>(\d+)<\/strong> Wall Street analysts', html, re.IGNORECASE) or \
              re.search(r'Based on (\d+) analyst ratings', html, re.IGNORECASE)
    if count_m:
        data["ratings_count"] = int(count_m.group(1))

    # 5. Buys, Holds, Sells
    buys_m = re.search(r'Buy<br\/>[^>]*>(\d+)<', html, re.IGNORECASE)
    holds_m = re.search(r'Hold<br\/>[^>]*>(\d+)<', html, re.IGNORECASE)
    sells_m = re.search(r'Sell<br\/>[^>]*>(\d+)<', html, re.IGNORECASE)

    if buys_m: data["buys"] = int(buys_m.group(1))
    if holds_m: data["holds"] = int(holds_m.group(1))
    if sells_m: data["sells"] = int(sells_m.group(1))

    if data["ratings_count"] == 0 and (data["buys"] > 0 or data["holds"] > 0 or data["sells"] > 0):
        data["ratings_count"] = data["buys"] + data["holds"] + data["sells"]

    # 6. Current Price
    curr_m = re.search(r'<strong style="font-size:1.7em;color:[^>]+>\$([^<]+)<\/strong>', html, re.IGNORECASE) or \
             re.search(r'current price of <strong>\$([^<]+)<\/strong>', html, re.IGNORECASE) or \
             re.search(r'current price target is \$[\d.]+\..*?current price of \$([\d.,]+)', html, re.IGNORECASE)
    if curr_m:
        data["current_price"] = float(curr_m.group(1).replace(',', '').strip())

    # 7. Upside / Downside
    match1 = re.search(r'forecasted (upside|downside) of (-?[\d.]+)%', html, re.IGNORECASE)
    match2 = re.search(r'(-?[\d.]+)% (Upside|Downside)', html, re.IGNORECASE)
    if match1:
        direction = match1.group(1).lower()
        val = float(match1.group(2))
        data["upside_downside_pct"] = val
        data["upside_downside_text"] = f"{direction} of {abs(val):.2f}%"
    elif match2:
        val = float(match2.group(1))
        direction = match2.group(2).lower()
        data["upside_downside_pct"] = val
        data["upside_downside_text"] = f"{direction} of {abs(val):.2f}%"
    else:
        if data["consensus_price_target"] and data["current_price"]:
            diff_pct = ((data["consensus_price_target"] - data["current_price"]) / data["current_price"]) * 100
            data["upside_downside_pct"] = round(diff_pct, 2)
            direction = "upside" if diff_pct >= 0 else "downside"
            data["upside_downside_text"] = f"{direction} of {abs(diff_pct):.2f}%"

    # 8. Extract Analyst Ratings History Table
    table_match = re.search(r'<table[^>]*id="history-table"[^>]*>([\s\S]*?)<\/table>', html, re.IGNORECASE)
    if table_match:
        table_content = table_match.group(1)
        trs = re.findall(r'<tr[^>]*>([\s\S]*?)<\/tr>', table_content, re.IGNORECASE)
        parsed_history = []
        
        # Skip headers
        for tr_html in trs[1:]:
            tds = re.findall(r'<td[^>]*>([\s\S]*?)<\/td>', tr_html, re.IGNORECASE)
            if not tds or len(tds) < 7:
                continue
                
            date = re.sub(r'<[^>]*>', '', tds[0]).strip()
            
            # Brokerage
            broker_clean_match = re.search(r'data-clean="([^"]*)"', tds[1])
            brokerage = ''
            if broker_clean_match:
                brokerage = broker_clean_match.group(1).split('|')[0].strip()
            else:
                brokerage = re.sub(r'<[^>]*>', '', tds[1]).strip()
                
            # Analyst
            analyst_clean_match = re.search(r'data-clean="([^"]*)"', tds[2])
            analyst = ''
            if analyst_clean_match:
                analyst = analyst_clean_match.group(1).split('|')[0].strip()
            else:
                analyst = re.sub(r'<[^>]*>', '', tds[2]).strip()
                
            action = re.sub(r'<[^>]*>', '', tds[3]).strip()
            
            # Rating
            rating_clean_match = re.search(r'data-clean="([^"]*)"', tds[4])
            rating = ''
            if rating_clean_match:
                rating = rating_clean_match.group(1).split('|')[0].strip()
            else:
                rating = re.sub(r'<[^>]*>', '', tds[4]).strip()
                
            # Target
            target_clean_match = re.search(r'data-clean="([^"]*)"', tds[5])
            price_target = ''
            if target_clean_match:
                parts = [p.strip() for p in target_clean_match.group(1).split('|')]
                if len(parts) == 2 and parts[0] and parts[1]:
                    price_target = f"{parts[0]} ➔ {parts[1]}"
                else:
                    price_target = parts[0]
            else:
                price_target = re.sub(r'<[^>]*>', '', tds[5]).replace('&#x279D;', '➔').strip()
                price_target = re.sub(r'\s+', ' ', price_target)
                
            upside_downside = re.sub(r'<[^>]*>', '', tds[6]).strip()
            
            parsed_history.append({
                "date": date,
                "brokerage": brokerage,
                "analyst": analyst,
                "action": action,
                "rating": rating,
                "priceTarget": price_target,
                "upsideDownside": upside_downside
            })
            
        data["analyst_ratings"] = parsed_history

    return data

def scrape_ticker(ticker, force_javascript=False):
    """Main function to scrape a ticker: resolves the URL and extracts targets."""
    # 1. Resolve path
    resolved_path = resolve_ticker_path(ticker)
    if not resolved_path:
        raise ValueError(f"Ticker '{ticker}' could not be resolved on MarketBeat.")
    
    forecast_url = f"https://www.marketbeat.com{resolved_path}/forecast/"
    
    # 2. Fetch HTML
    html = None
    if force_javascript:
        html = fetch_html_dynamic(forecast_url)
    else:
        try:
            html = fetch_html_static(forecast_url)
            # Double check if we got actual content or blocked page
            if "var consensus12Month" not in html and ("cloudflare" in html.lower() or "turnstile" in html.lower()):
                print(f"[*] Cloudflare protection detected statically. Falling back to headless browser...", file=sys.stderr)
                html = fetch_html_dynamic(forecast_url)
        except Exception as e:
            print(f"[*] Static request failed ({e}). Falling back to browser automation...", file=sys.stderr)
            html = fetch_html_dynamic(forecast_url)

    # 3. Parse data
    return parse_forecast_data(html, ticker, resolved_path)

def print_table(results):
    """Helper to render a beautiful ASCII table for terminal output."""
    header = f"| {'Ticker':<6} | {'Company Name':<20} | {'Current':<8} | {'Rating':<12} | {'Target':<8} | {'Upside/Down':<12} | {'B/H/S':<9} |"
    divider = "-" * len(header)
    print(divider)
    print(header)
    print(divider)
    
    for r in results:
        if "error" in r:
            print(f"| {r['ticker']:<6} | Error: {r['error']:<70} |")
            continue
            
        ticker = r["ticker"]
        name = r["company_name"][:20]
        current = f"${r['current_price']:.2f}" if r["current_price"] else "N/A"
        rating = r["consensus_rating"][:12]
        target = f"${r['consensus_price_target']:.2f}" if r["consensus_price_target"] else "N/A"
        upside = r["upside_downside_text"][:12]
        bhs = f"{r['buys']}/{r['holds']}/{r['sells']}"
        
        print(f"| {ticker:<6} | {name:<20} | {current:>8} | {rating:<12} | {target:>8} | {upside:>12} | {bhs:<9} |")
    print(divider)

def main():
    parser = argparse.ArgumentParser(description="Extract analyst price targets and ratings from MarketBeat by ticker.")
    parser.add_argument("tickers", nargs="+", help="One or more stock tickers (e.g. AAPL MSFT NBIS)")
    parser.add_argument("--json", action="store_true", help="Output results in JSON format")
    parser.add_argument("--js", action="store_true", help="Force browser automation (Playwright) to fetch dynamic HTML")
    
    args = parser.parse_args()
    
    results = []
    for ticker in args.tickers:
        t_upper = ticker.upper().strip()
        try:
            data = scrape_ticker(t_upper, force_javascript=args.js)
            results.append(data)
        except Exception as e:
            results.append({
                "ticker": t_upper,
                "error": str(e)
            })
            
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print_table(results)

if __name__ == "__main__":
    main()
