#!/usr/bin/env python3
import sys
import json
import re
from curl_cffi import requests
from bs4 import BeautifulSoup

def clean_text(text):
    if not text:
        return ""
    return text.replace("\n", " ").replace("\r", "").strip()

def parse_target_value(target_str):
    if not target_str:
        return None
    # Extract last numeric value from string (e.g. "$275 | → | $280" -> 280.0)
    # or "$300" -> 300.0
    matches = re.findall(r'[\d.,]+', target_str)
    if matches:
        try:
            return float(matches[-1].replace(",", ""))
        except ValueError:
            return None
    return None

def scrape_tipranks(ticker):
    ticker = ticker.upper().strip()
    url = f"https://www.tipranks.com/stocks/{ticker.lower()}/forecast"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    
    result = {
        "ticker": ticker,
        "url": url,
        "companyName": ticker,
        "consensusRating": "N/A",
        "consensusPriceTarget": None,
        "highPriceTarget": None,
        "lowPriceTarget": None,
        "currentPrice": None,
        "upsideDownsideValue": None,
        "ratingsCount": 0,
        "buys": 0,
        "holds": 0,
        "sells": 0,
        "ratings": [],
        "error": None
    }
    
    try:
        response = requests.get(url, headers=headers, impersonate="chrome", timeout=20)
        
        if response.status_code == 404:
            result["error"] = f"Ticker {ticker} not found on TipRanks (404)"
            return result
        elif response.status_code != 200:
            result["error"] = f"TipRanks returned status code {response.status_code}"
            return result
            
        html = response.text
        if "Just a moment..." in html or "challenges.cloudflare.com" in html:
            result["error"] = "Blocked by Cloudflare bot protection"
            return result
            
        soup = BeautifulSoup(html, 'html.parser')
        
        # 1. Try to extract overall consensus statistics from JSON-LD FAQ
        scripts = soup.find_all('script', type='application/ld+json')
        faq_data = None
        for s in scripts:
            try:
                js = json.loads(s.string)
                if isinstance(js, dict) and js.get('@type') == 'FAQPage':
                    faq_data = js
                    break
            except:
                pass
                
        # Parse FAQ data if available
        if faq_data:
            for item in faq_data.get('mainEntity', []):
                q = item.get('name', '').lower()
                ans = item.get('acceptedAnswer', {}).get('text', '')
                
                if "average 12-month price target" in q or "average price target" in q:
                    # e.g., "Nvidia Corporation’s 12-month average price target is 299.97."
                    num_match = re.search(r'is\s+([\d.,]+)', ans)
                    if num_match:
                        clean_num = num_match.group(1).replace(",", "").strip().rstrip(".")
                        result["consensusPriceTarget"] = float(clean_num)
                
                elif "upside potential" in q:
                    # e.g., "Nvidia Corporation has 48.74% upside potential..."
                    num_match = re.search(r'([\d.,-]+)%', ans)
                    if num_match:
                        clean_num = num_match.group(1).replace(",", "").strip().rstrip(".")
                        result["upsideDownsideValue"] = float(clean_num)
                        
                elif "consensus rating" in q:
                    # e.g., "...consensus rating of Strong Buy which is based on 40 buy ratings..."
                    rating_match = re.search(r'consensus rating of\s+([^which\n]+)', ans, re.I)
                    if rating_match:
                        result["consensusRating"] = rating_match.group(1).strip()
                        
                    counts_match = re.search(r'based on\s+(\d+)\s+buy ratings,\s*(\d+)\s+hold ratings,\s*and\s*(\d+)\s+sell', ans, re.I)
                    if counts_match:
                        result["buys"] = int(counts_match.group(1))
                        result["holds"] = int(counts_match.group(2))
                        result["sells"] = int(counts_match.group(3))
                        result["ratingsCount"] = result["buys"] + result["holds"] + result["sells"]

        # 2. Extract company name from title
        title_tag = soup.find('title')
        if title_tag:
            title_text = clean_text(title_tag.text)
            # Nvidia (NVDA) Stock Forecast & Price Targets...
            name_parts = re.split(r'\b' + re.escape(ticker) + r'\b', title_text, flags=re.I)
            if name_parts:
                candidate = name_parts[0].replace('(', '').strip()
                if candidate:
                    result["companyName"] = candidate

        # 3. Fallbacks and extractions from regex for high, low, current price if not in FAQ
        high_low_match = re.search(r'highest analyst price target is (\$[\d.,]+)\s*,the lowest forecast is (\$[\d.,]+)', html, re.I)
        if high_low_match:
            result["highPriceTarget"] = parse_target_value(high_low_match.group(1))
            result["lowPriceTarget"] = parse_target_value(high_low_match.group(2))
            
        current_price_match = re.search(r'current price of (\$[\d.,]+)', html, re.I)
        if current_price_match:
            result["currentPrice"] = parse_target_value(current_price_match.group(1))

        # 4. Extract recent analyst ratings from the react-table
        tbody = soup.find('div', class_='rt-tbody')
        if tbody:
            rows = tbody.find_all('div', class_='rt-tr-group')
            for r in rows:
                tr = r.find('div', class_='rt-tr')
                if not tr:
                    continue
                tds = tr.find_all('div', class_='rt-td')
                if len(tds) >= 7:
                    analyst_cell = clean_text(tds[0].get_text(" | "))
                    analyst_name = analyst_cell.split(" | ")[0]
                    firm = clean_text(tds[1].text)
                    
                    price_target_raw = clean_text(tds[2].get_text(" "))
                    # Format e.g., "$275 | → | $280" to "$275 ➔ $280"
                    price_target = price_target_raw.replace("|", "").replace("→", "➔").replace("→", "➔").strip()
                    price_target = re.sub(r'\s+', ' ', price_target)
                    
                    rating = clean_text(tds[3].text)
                    
                    upside_raw = clean_text(tds[4].get_text(" "))
                    upside_downside = upside_raw.replace("|", "").strip()
                    upside_downside = re.sub(r'\s+', ' ', upside_downside)
                    
                    action = clean_text(tds[5].text)
                    date = clean_text(tds[6].text)
                    
                    result["ratings"].append({
                        "date": date,
                        "analyst": analyst_name,
                        "analystFirm": firm,
                        "priceTarget": price_target,
                        "action": action,
                        "rating": rating,
                        "upsideDownside": upside_downside
                    })
                    
        # Update ratingsCount if it was zero
        if result["ratingsCount"] == 0 and result["ratings"]:
            result["ratingsCount"] = len(result["ratings"])
            
    except Exception as e:
        result["error"] = f"An exception occurred: {str(e)}"
        
    return result

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No ticker argument provided"}))
        sys.exit(1)
        
    ticker_arg = sys.argv[1]
    # Set stdout to output UTF-8 to prevent console writing crashes
    sys.stdout.reconfigure(encoding='utf-8')
    res_dict = scrape_tipranks(ticker_arg)
    print(json.dumps(res_dict, indent=2, ensure_ascii=False))
