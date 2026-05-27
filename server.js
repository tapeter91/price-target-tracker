import express from 'express';
import cors from 'cors';
import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-memory cache to prevent spamming MarketBeat
// Key: ticker (uppercase), Value: { timestamp, data }
const cache = new Map();
const benzingaCache = new Map();
const tipranksCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Helper function to resolve ticker path
async function resolveTickerPath(ticker) {
    const searchUrl = `https://www.marketbeat.com/pages/search.aspx?query=${encodeURIComponent(ticker)}`;
    try {
        const response = await fetch(searchUrl, {
            headers: { 'User-Agent': USER_AGENT }
        });
        if (!response.ok) {
            throw new Error(`MarketBeat search returned status ${response.status}`);
        }
        const html = await response.text();
        
        // Match standard stocks URL: /stocks/EXCHANGE/TICKER
        // e.g. /stocks/NASDAQ/CIFR or /stocks/CVE/CIFR
        const regex = new RegExp(`\\/stocks\\/[A-Za-z0-9_-]+\\/${ticker}\\b`, 'gi');
        const matches = html.match(regex) || [];
        const uniqueMatches = [...new Set(matches)];
        
        const preferredExchanges = ['NASDAQ', 'NYSE', 'NYSEAMEX', 'OTCMKTS', 'OTC'];
        
        if (uniqueMatches.length > 0) {
            const bestMatch = uniqueMatches.find(m => {
                const exchange = m.split('/')[2]?.toUpperCase();
                return preferredExchanges.includes(exchange);
            });
            if (bestMatch) return bestMatch;
            return uniqueMatches[0];
        }
        
        // Fallback: search for any stocks URL in the text that matches the ticker
        const fallbackRegex = new RegExp(`\\/stocks\\/[A-Za-z0-9_-]+\\/[A-Za-z0-9_-]+`, 'gi');
        const allMatches = html.match(fallbackRegex) || [];
        const uniqueAllMatches = [...new Set(allMatches)];
        
        const matchingFallbackPaths = uniqueAllMatches.filter(m => 
            m.toUpperCase().endsWith(`/${ticker.toUpperCase()}`)
        );
        
        if (matchingFallbackPaths.length > 0) {
            const bestFallback = matchingFallbackPaths.find(m => {
                const exchange = m.split('/')[2]?.toUpperCase();
                return preferredExchanges.includes(exchange);
            });
            if (bestFallback) return bestFallback;
            return matchingFallbackPaths[0];
        }
        
        return null;
    } catch (error) {
        console.error(`Error resolving ticker path for ${ticker}:`, error);
        throw error;
    }
}

// Helper function to parse HTML and extract analyst forecast data
function parseForecastHtml(html, ticker, resolvedPath) {
    const data = {
        ticker: ticker.toUpperCase(),
        url: `https://www.marketbeat.com${resolvedPath}/forecast/`,
        companyName: '',
        consensusRating: 'N/A',
        consensusPriceTarget: null,
        highPriceTarget: null,
        lowPriceTarget: null,
        currentPrice: null,
        upsideDownsideText: '',
        upsideDownsideValue: null, // Float representing percentage (e.g. -4.73 or 2.15)
        ratingsCount: 0,
        buys: 0,
        holds: 0,
        sells: 0,
        historicalPrices: [], // [{ date: 'MM/DD/YYYY', price: 12.34 }]
        analystRatings: [] // [{ date, brokerage, analyst, action, rating, priceTarget, upsideDownside }]
    };

    // 1. Extract Company Name & Title
    // e.g. <title>Nebius Group (NBIS) Stock Forecast and Price Target 2026</title>
    const titleMatch = html.match(/<title>\s*([\s\S]*?)\s*<\/title>/i);
    if (titleMatch) {
        const titleText = titleMatch[1].trim();
        // Extract everything before the first parenthesis
        data.companyName = titleText.split('(')[0].trim();
    } else {
        data.companyName = ticker.toUpperCase();
    }

    // 2. Extract script variables (consensus12Month, high12Month, low12Month)
    const consensusMatch = html.match(/var consensus12Month\s*=\s*'([^']*)'/);
    const highMatch = html.match(/var high12Month\s*=\s*'([^']*)'/);
    const lowMatch = html.match(/var low12Month\s*=\s*'([^']*)'/);

    if (consensusMatch && consensusMatch[1]) {
        data.consensusPriceTarget = parseFloat(parseFloat(consensusMatch[1]).toFixed(2));
    }
    if (highMatch && highMatch[1]) {
        data.highPriceTarget = parseFloat(parseFloat(highMatch[1]).toFixed(2));
    }
    if (lowMatch && lowMatch[1]) {
        data.lowPriceTarget = parseFloat(parseFloat(lowMatch[1]).toFixed(2));
    }

    // 3. Extract Consensus Rating Text
    // e.g., <div class="rating-title">Moderate Buy</div>
    const ratingMatch = html.match(/<div class="rating-title">([^<]+)<\/div>/i);
    if (ratingMatch && ratingMatch[1]) {
        data.consensusRating = ratingMatch[1].trim();
    }

    // 4. Extract total ratings count
    const countMatch = html.match(/Based on <strong>(\d+)<\/strong> Wall Street analysts/i) || 
                       html.match(/Based on (\d+) analyst ratings/i);
    if (countMatch && countMatch[1]) {
        data.ratingsCount = parseInt(countMatch[1], 10);
    }

    // 5. Extract Buy, Hold, Sell counts
    // e.g., Sell<br/><span class="c-dark-red">0</span>
    const buysMatch = html.match(/Buy<br\/>[^>]*>(\d+)</i);
    const holdsMatch = html.match(/Hold<br\/>[^>]*>(\d+)</i);
    const sellsMatch = html.match(/Sell<br\/>[^>]*>(\d+)</i);

    if (buysMatch && buysMatch[1]) data.buys = parseInt(buysMatch[1], 10);
    if (holdsMatch && holdsMatch[1]) data.holds = parseInt(holdsMatch[1], 10);
    if (sellsMatch && sellsMatch[1]) data.sells = parseInt(sellsMatch[1], 10);

    // Sum checks (sometimes strong buy is separate, we just sum buys/holds/sells if they mismatch)
    if (data.ratingsCount === 0 && (data.buys > 0 || data.holds > 0 || data.sells > 0)) {
        data.ratingsCount = data.buys + data.holds + data.sells;
    }

    // 6. Extract Current Stock Price
    // e.g. <strong style="font-size:1.7em;color: var(--blue-11);">$191.82</strong>
    const currentPriceMatch = html.match(/<strong style="font-size:1.7em;color:[^>]+>\$([^<]+)<\/strong>/i) ||
                              html.match(/current price of <strong>\$([^<]+)<\/strong>/i) ||
                              html.match(/current price target is \$[\d.]+\..*?current price of \$([\d.,]+)/i);
    if (currentPriceMatch && currentPriceMatch[1]) {
        data.currentPrice = parseFloat(currentPriceMatch[1].replace(/,/g, '').trim());
    }

    const match1 = html.match(/forecasted (upside|downside) of (-?[\d.]+)%/i);
    const match2 = html.match(/(-?[\d.]+)% (Upside|Downside)/i);
    if (match1) {
        const dir = match1[1].toLowerCase();
        const val = parseFloat(match1[2]);
        data.upsideDownsideValue = val;
        data.upsideDownsideText = `${dir} of ${Math.abs(val)}%`;
    } else if (match2) {
        const val = parseFloat(match2[1]);
        const dir = match2[2].toLowerCase();
        data.upsideDownsideValue = val;
        data.upsideDownsideText = `${dir} of ${Math.abs(val)}%`;
    } else {
        // Fallback calculations if we have target & price
        if (data.consensusPriceTarget && data.currentPrice) {
            const diffPct = ((data.consensusPriceTarget - data.currentPrice) / data.currentPrice) * 100;
            data.upsideDownsideValue = parseFloat(diffPct.toFixed(2));
            data.upsideDownsideText = `${diffPct >= 0 ? 'upside' : 'downside'} of ${Math.abs(diffPct).toFixed(2)}%`;
        }
    }

    // 8. Extract Historical Prices (`priceSeries`)
    // Format: var priceSeries ='Date,SharePrice\n01/01/2026,83.71\n01/02/2026,89.95...';
    const priceSeriesMatch = html.match(/var priceSeries\s*=\s*'([^']*)'/);
    if (priceSeriesMatch && priceSeriesMatch[1]) {
        const seriesString = priceSeriesMatch[1];
        const lines = seriesString.split('\\n').join('\n').split('\n');
        const parsedSeries = [];
        
        // Skip header line
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length === 2) {
                const date = parts[0];
                const price = parseFloat(parts[1]);
                if (date && !isNaN(price)) {
                    parsedSeries.push({ date, price });
                }
            }
        }
        
        // Sort chronologically and take a reasonable subset (e.g. last 100 points, or filter for readability)
        // Let's keep all sorted points, and frontend can filter if needed.
        data.historicalPrices = parsedSeries.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // 9. Extract Analyst Ratings History Table
    const tableMatch = html.match(/<table[^>]*id="history-table"[^>]*>([\s\S]*?)<\/table>/i);
    if (tableMatch) {
        const trs = tableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
        const parsedHistory = [];
        
        for (let i = 1; i < trs.length; i++) {
            const trHtml = trs[i];
            const tds = trHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
            if (!tds || tds.length < 7) continue;
            
            const date = tds[0].replace(/<[^>]*>/g, '').trim();
            
            const brokerageCleanMatch = tds[1].match(/data-clean="([^"]*)"/);
            let brokerage = '';
            if (brokerageCleanMatch) {
                brokerage = brokerageCleanMatch[1].split('|')[0].trim();
            } else {
                brokerage = tds[1].replace(/<[^>]*>/g, '').trim();
            }
            
            const analystCleanMatch = tds[2].match(/data-clean="([^"]*)"/);
            let analyst = '';
            if (analystCleanMatch) {
                analyst = analystCleanMatch[1].split('|')[0].trim();
            } else {
                analyst = tds[2].replace(/<[^>]*>/g, '').trim();
            }
            
            const action = tds[3].replace(/<[^>]*>/g, '').trim();
            
            const ratingCleanMatch = tds[4].match(/data-clean="([^"]*)"/);
            let rating = '';
            if (ratingCleanMatch) {
                rating = ratingCleanMatch[1].split('|')[0].trim();
            } else {
                rating = tds[4].replace(/<[^>]*>/g, '').trim();
            }
            
            const targetCleanMatch = tds[5].match(/data-clean="([^"]*)"/);
            let priceTarget = '';
            if (targetCleanMatch) {
                const parts = targetCleanMatch[1].split('|').map(p => p.trim());
                if (parts.length === 2 && parts[0] && parts[1]) {
                    priceTarget = `${parts[0]} ➔ ${parts[1]}`;
                } else {
                    priceTarget = parts[0] || '';
                }
            } else {
                priceTarget = tds[5].replace(/<[^>]*>/g, '').replace(/&#x279D;/g, '➔').replace(/\s+/g, ' ').trim();
            }
            
            const upsideDownside = tds[6].replace(/<[^>]*>/g, '').trim();
            
            parsedHistory.push({
                date,
                brokerage,
                analyst,
                action,
                rating,
                priceTarget,
                upsideDownside
            });
        }
        
        data.analystRatings = parsedHistory;
    }

    return data;
}

// Scrape endpoint
app.get('/api/scrape/:ticker', async (req, res) => {
    const ticker = req.params.ticker.trim().toUpperCase();
    if (!ticker) {
        return res.status(400).json({ error: 'Ticker parameter is required' });
    }

    const force = req.query.force === 'true';

    // Check cache first (only if force is not requested)
    if (!force && cache.has(ticker)) {
        const cachedItem = cache.get(ticker);
        if (Date.now() - cachedItem.timestamp < CACHE_TTL) {
            console.log(`[Cache Hit] Ticker: ${ticker}`);
            return res.json(cachedItem.data);
        }
    }

    console.log(`[Cache Miss] Scraping Ticker: ${ticker} (force=${force})`);
    try {
        // Step 1: Resolve the path on MarketBeat (e.g., to find the correct Exchange/Ticker url)
        const resolvedPath = await resolveTickerPath(ticker);
        if (!resolvedPath) {
            return res.status(404).json({ error: `Could not resolve ticker '${ticker}' on MarketBeat.` });
        }

        // Step 2: Fetch the forecast page
        const forecastUrl = `https://www.marketbeat.com${resolvedPath}/forecast/`;
        console.log(`[Fetching Page] URL: ${forecastUrl}`);
        
        const forecastResponse = await fetch(forecastUrl, {
            headers: { 'User-Agent': USER_AGENT }
        });
        
        if (!forecastResponse.ok) {
            throw new Error(`Failed to load forecast page, status: ${forecastResponse.status}`);
        }

        const html = await forecastResponse.text();

        // Step 3: Parse extracted HTML
        const parsedData = parseForecastHtml(html, ticker, resolvedPath);
        
        // Save to cache
        cache.set(ticker, {
            timestamp: Date.now(),
            data: parsedData
        });

        res.json(parsedData);

    } catch (error) {
        console.error(`Error occurred while scraping ticker ${ticker}:`, error);
        res.status(500).json({ 
            error: 'Failed to extract analyst forecasts from MarketBeat',
            details: error.message 
        });
    }
});

// Helper function to parse HTML and extract Benzinga analyst ratings
function parseBenzingaHtml(html, ticker) {
    const data = {
        ticker: ticker.toUpperCase(),
        url: `https://www.benzinga.com/quote/${ticker.toUpperCase()}/analyst-ratings`,
        ratings: []
    };

    // Find all table rows matching benzinga-core-table-row
    const rowRegex = /<tr[^>]*benzinga-core-table-row[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
        const rowHtml = match[1];
        
        // Find individual columns by matching td tags
        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const tds = [];
        let tdMatch;
        while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
            tds.push(tdMatch[1]);
        }
        
        if (tds.length >= 7) {
            // Helper to strip HTML tags
            const stripTags = (str) => str.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
            
            const date = stripTags(tds[0]);
            const upsideDownside = stripTags(tds[2]);
            const analystFirm = stripTags(tds[3]);
            const priceTarget = stripTags(tds[4]).replace(/&#x279D;/g, '➔').replace(/&rarr;/g, '➔').replace(/→/g, '➔');
            const action = stripTags(tds[5]);
            const rating = stripTags(tds[6]);
            
            data.ratings.push({
                date,
                upsideDownside,
                analystFirm,
                priceTarget,
                action,
                rating
            });
        }
    }
    return data;
}

// Benzinga scrape endpoint
app.get('/api/scrape/benzinga/:ticker', async (req, res) => {
    const ticker = req.params.ticker.trim().toUpperCase();
    if (!ticker) {
        return res.status(400).json({ error: 'Ticker parameter is required' });
    }

    const force = req.query.force === 'true';

    // Check cache first (only if force is not requested)
    if (!force && benzingaCache.has(ticker)) {
        const cachedItem = benzingaCache.get(ticker);
        if (Date.now() - cachedItem.timestamp < CACHE_TTL) {
            console.log(`[Benzinga Cache Hit] Ticker: ${ticker}`);
            return res.json(cachedItem.data);
        }
    }

    console.log(`[Benzinga Cache Miss] Scraping Ticker: ${ticker} (force=${force})`);
    try {
        const url = `https://www.benzinga.com/quote/${ticker}/analyst-ratings`;
        console.log(`[Fetching Benzinga Page] URL: ${url}`);
        
        const response = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT }
        });
        
        if (!response.ok) {
            throw new Error(`Benzinga returned status ${response.status}`);
        }

        const html = await response.text();
        const parsedData = parseBenzingaHtml(html, ticker);
        
        benzingaCache.set(ticker, {
            timestamp: Date.now(),
            data: parsedData
        });

        res.json(parsedData);

    } catch (error) {
        console.error(`Error occurred while scraping Benzinga for ticker ${ticker}:`, error);
        res.status(500).json({ 
            error: 'Failed to extract analyst forecasts from Benzinga',
            details: error.message 
        });
    }
});

// Helper function to run the TipRanks Python scraper
function runTipranksScraper(ticker, callback) {
    const scriptPath = path.join(__dirname, 'tipranks_scraper.py');
    execFile('python3.13', [scriptPath, ticker], (error, stdout, stderr) => {
        if (error && (error.code === 'ENOENT' || error.message.includes('not found') || error.message.includes('spawn python3.13 ENOENT'))) {
            console.log(`[TipRanks] python3.13 not found, falling back to python`);
            execFile('python', [scriptPath, ticker], callback);
        } else {
            callback(error, stdout, stderr);
        }
    });
}

// TipRanks scrape endpoint
app.get('/api/scrape/tipranks/:ticker', async (req, res) => {
    const ticker = req.params.ticker.trim().toUpperCase();
    if (!ticker) {
        return res.status(400).json({ error: 'Ticker parameter is required' });
    }

    const force = req.query.force === 'true';

    // Check cache first (only if force is not requested)
    if (!force && tipranksCache.has(ticker)) {
        const cachedItem = tipranksCache.get(ticker);
        if (Date.now() - cachedItem.timestamp < CACHE_TTL) {
            console.log(`[TipRanks Cache Hit] Ticker: ${ticker}`);
            return res.json(cachedItem.data);
        }
    }

    console.log(`[TipRanks Cache Miss] Scraping Ticker: ${ticker} (force=${force})`);

    runTipranksScraper(ticker, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error running tipranks_scraper.py for ${ticker}:`, error, stderr);
            return res.status(500).json({
                error: 'Failed to run TipRanks scraper',
                details: error.message || stderr
            });
        }

        try {
            const data = JSON.parse(stdout);
            if (data.error) {
                return res.status(500).json({
                    error: 'TipRanks scraper reported an error',
                    details: data.error
                });
            }

            // Cache successful result
            tipranksCache.set(ticker, {
                timestamp: Date.now(),
                data: data
            });

            res.json(data);
        } catch (parseError) {
            console.error(`Failed to parse Python scraper output for ${ticker}:`, stdout, parseError);
            res.status(500).json({
                error: 'Failed to parse TipRanks scraper response',
                details: parseError.message
            });
        }
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`);
});

