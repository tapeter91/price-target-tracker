# Price Target Tracker 📈

An analyst price target extractor and dashboard. This application aggregates, scrapes, and visualizes consensus stock price targets and recent rating histories from **MarketBeat** and **TipRanks**.

The project uses a Python backend for data extraction, a Node.js Express server to handle caching and API endpoints, and a React Vite frontend styled with Tailwind CSS for visual tracking.

---

## 🛠️ Prerequisites

Before you start, make sure you have the following installed:

1. **Node.js** (v18.0.0 or higher)
2. **Python** (v3.10 or higher)

---

## 🚀 Installation & Preparation

### 1. Install Node.js Dependencies
Navigate to the project root and install the web dependencies:
```bash
npm install
```

### 2. Install Python Dependencies
The TipRanks and MarketBeat python scripts require a few packages for web scraping and request-forgery bypass. Install them via `pip`:
```bash
pip install curl_cffi beautifulsoup4 playwright
```

### 3. Install Playwright Browsers
The MarketBeat scraper uses headless Playwright to load javascript-rendered content when static fetch fallbacks are triggered. Install its chromium browser:
```bash
playwright install chromium
```

---

## 💻 Running the Application

### Option A: Windows (One-Click Launch)
If you are on Windows, simply double-click the **`start.bat`** file in the root folder. It will:
- Open a console window for the Backend API (`http://localhost:3001`)
- Open another console window for the Frontend Dashboard (`http://localhost:5173`)

### Option B: Manual (Cross-Platform)
Open two separate terminal windows in the project root:

1. **Terminal 1: Start the API Backend**
   ```bash
   npm run server
   ```
   *Runs on `http://localhost:3001`*

2. **Terminal 2: Start the Frontend Dashboard**
   ```bash
   npm run dev
   ```
   *Runs on `http://localhost:5173`*

Open [http://localhost:5173](http://localhost:5173) in your browser to view the dashboard!

---

## 📂 Project Architecture

* **`src/`** — React frontend source code (components, styles, and dashboard).
* **`server.js`** — Express backend server hosting the `/api/scrape/` endpoints and caching layer.
* **`tipranks_scraper.py`** — Python scraper using `curl_cffi` to extract analyst targets from TipRanks.
* **`marketbeat_scraper.py`** — Python scraper using `urllib` and `playwright` to extract analyst targets from MarketBeat.
* **`start.bat`** — Windows launcher utility.
