import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, Search, Loader2, AlertCircle, X, 
  ArrowRight, BarChart3, PieChart, Info, RefreshCw, Layers,
  Filter, Calendar, ArrowUpDown, ChevronUp, ChevronDown, Bell, BellRing
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid 
} from 'recharts';

// Helper to get gauge rotation based on rating string
const getGaugeRotation = (rating) => {
  const r = (rating || '').toLowerCase().trim();
  if (r.includes('strong sell')) return -75;
  if (r.includes('sell')) return -45;
  if (r.includes('reduce')) return -15;
  if (r.includes('hold')) return 15;
  if (r.includes('moderate buy')) return 45;
  if (r.includes('strong buy')) return 105;
  if (r.includes('buy')) return 75;
  return 0; // default Hold
};

// Helper to get rating color code (updated for white/light theme)
const getRatingColorClass = (rating) => {
  const r = (rating || '').toLowerCase().trim();
  if (r.includes('sell')) return 'text-red-700 bg-red-100 border-red-200';
  if (r.includes('hold') || r.includes('reduce')) return 'text-amber-700 bg-amber-100 border-amber-200';
  return 'text-emerald-700 bg-emerald-100 border-emerald-200';
};

const getRatingColor = (rating) => {
  const r = (rating || '').toLowerCase().trim();
  if (r.includes('sell')) return '#EF4444'; // Red
  if (r.includes('hold') || r.includes('reduce')) return '#F59E0B'; // Gold
  return '#10B981'; // Emerald
};

// Helper to parse target price as a number
const parsePriceTargetValue = (targetStr) => {
  if (!targetStr) return null;
  let cleanStr = targetStr;
  if (targetStr.includes('➔')) {
    const parts = targetStr.split('➔');
    cleanStr = parts[1] || parts[0];
  } else if (targetStr.includes('to')) {
    const parts = targetStr.split('to');
    cleanStr = parts[1] || parts[0];
  } else if (targetStr.includes('->')) {
    const parts = targetStr.split('->');
    cleanStr = parts[1] || parts[0];
  }
  const numStr = cleanStr.replace(/[$,\s]/g, '');
  const val = parseFloat(numStr);
  return isNaN(val) ? null : val;
};

// Helper to normalize dates from different formats to MS timestamp
const parseDateToMs = (dateStr) => {
  if (!dateStr) return 0;
  let cleanStr = dateStr.trim();
  
  // Format MM/DD/YY (e.g. 05/21/26)
  const twoDigitYearMatch = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (twoDigitYearMatch) {
    const month = parseInt(twoDigitYearMatch[1]);
    const day = parseInt(twoDigitYearMatch[2]);
    const year = parseInt(twoDigitYearMatch[3]) + 2000;
    return new Date(year, month - 1, day).getTime();
  }
  
  // Format MM/DD/YYYY (e.g. 5/19/2026)
  const fourDigitYearMatch = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fourDigitYearMatch) {
    const month = parseInt(fourDigitYearMatch[1]);
    const day = parseInt(fourDigitYearMatch[2]);
    const year = parseInt(fourDigitYearMatch[3]);
    return new Date(year, month - 1, day).getTime();
  }
  
  const parsed = Date.parse(cleanStr);
  return isNaN(parsed) ? 0 : parsed;
};

// Helper to normalize investment firm names for similarity matching
const normalizeFirm = (firmName) => {
  if (!firmName) return '';
  let clean = firmName.toLowerCase();

  // Custom aliases/mappings for very common mismatched firms
  const aliases = [
    { pattern: /\b(jpmorgan\s*chase|jp\s*morgan|j\.p\.\s*morgan)\b/g, replace: 'jpmorgan' },
    { pattern: /\b(bank\s+of\s+america\s+merrill\s+lynch|bank\s+of\s+america|merrill\s+lynch|bofasecurities|bofa)\b/g, replace: 'bofa' },
    { pattern: /\b(royal\s+bank\s+of\s+canada|rbc\s+capital\s+markets|rbc)\b/g, replace: 'rbc' },
    { pattern: /\b(jefferies\s+&\s+company|jefferies)\b/g, replace: 'jefferies' },
    { pattern: /\b(cowen\s+and\s+company|td\s+cowen|cowen)\b/g, replace: 'cowen' },
    { pattern: /\b(citigroup|citi)\b/g, replace: 'citi' },
    { pattern: /\b(keybanc|keybank)\b/g, replace: 'keybanc' },
    { pattern: /\b(h\.c\.\s*wainwright|hc\s*wainwright|wainwright)\b/g, replace: 'hcwainwright' },
    { pattern: /\b(canaccord\s*genuity)\b/g, replace: 'canaccord' },
    { pattern: /\b(piper\s*sandler|piper\s*jaffray)\b/g, replace: 'pipersandler' },
    { pattern: /\b(wedbush\s*securities|wedbush)\b/g, replace: 'wedbush' },
    { pattern: /\b(oppenheimer\s*&\s*co|oppenheimer)\b/g, replace: 'oppenheimer' },
    { pattern: /\b(robert\s+w\.\s+baird|baird)\b/g, replace: 'baird' },
    { pattern: /\b(truist\s+securities|truist)\b/g, replace: 'truist' },
    { pattern: /\b(stifel\s+nicolaus|stifel)\b/g, replace: 'stifel' },
    { pattern: /\b(sanford\s+c\.\s+bernstein|bernstein)\b/g, replace: 'bernstein' },
    { pattern: /\b(mizuho\s+securities|mizuho)\b/g, replace: 'mizuho' },
    { pattern: /\b(hsbc\s+holdings|hsbc)\b/g, replace: 'hsbc' },
    { pattern: /\b(ubs\s+securities|ubs)\b/g, replace: 'ubs' },
    { pattern: /\b(evercore\s+isi|evercore)\b/g, replace: 'evercore' },
    { pattern: /\b(guggenheim\s+securities|guggenheim)\b/g, replace: 'guggenheim' },
    { pattern: /\b(raymond\s+james)\b/g, replace: 'raymondjames' },
    { pattern: /\b(roth\s+capital|roth\s+mkm|roth)\b/g, replace: 'roth' }
  ];

  aliases.forEach(alias => {
    clean = clean.replace(alias.pattern, alias.replace);
  });

  const wordsToRemove = [
    'group', 'corp', 'corporation', 'capital', 'financial', 'partners', 
    'securities', 'research', 'co', 'inc', 'ltd', 'llc', 'bank', 
    'management', 'advisors', 'wealth', 'holdings', 'plc', 'intl', 
    'international', 'usa', 'us', 'uk', 'advisory', 'investments', 
    'services', 'markets'
  ];
  wordsToRemove.forEach(word => {
    const regex = new RegExp('\\b' + word + '\\b', 'g');
    clean = clean.replace(regex, '');
  });
  return clean.replace(/[^a-z0-9]/g, '').trim();
};

// Helper to normalize analyst names
const normalizeAnalyst = (name) => {
  if (!name) return '';
  // Convert to lowercase, remove punctuation except spaces, and trim
  let clean = name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  // Remove common suffixes/credentials
  const suffixes = ['cfa', 'phd', 'md', 'mba', 'cpa', 'ms'];
  suffixes.forEach(suffix => {
    const regex = new RegExp('\\b' + suffix + '\\b', 'g');
    clean = clean.replace(regex, '');
  });
  return clean.replace(/\s+/g, ' ').trim();
};

// Helper to check if two analyst names match, considering abbreviation variations (e.g. T Arcuri vs Timothy Arcuri)
const analystsMatch = (name1, name2) => {
  if (!name1 || !name2) return true; // If either name is missing, we allow matching
  
  const norm1 = normalizeAnalyst(name1);
  const norm2 = normalizeAnalyst(name2);
  
  if (!norm1 || !norm2) return true;
  if (norm1 === norm2) return true;
  
  const words1 = norm1.split(' ');
  const words2 = norm2.split(' ');
  
  if (words1.length === 0 || words2.length === 0) return true;
  
  const lastName1 = words1[words1.length - 1];
  const lastName2 = words2[words2.length - 1];
  
  if (lastName1 !== lastName2) return false;
  
  // Compare first name / first initial
  const firstName1 = words1[0];
  const firstName2 = words2[0];
  
  if (firstName1 === firstName2) return true;
  if (firstName1.length === 1 && firstName2.startsWith(firstName1)) return true;
  if (firstName2.length === 1 && firstName1.startsWith(firstName2)) return true;
  
  return false;
};

// Helper to determine change direction of price target
const checkTargetDirection = (targetStr) => {
  if (!targetStr) return 'neutral';
  let parts = [];
  if (targetStr.includes('➔')) {
    parts = targetStr.split('➔');
  } else if (targetStr.includes('->')) {
    parts = targetStr.split('->');
  } else if (targetStr.includes('to')) {
    parts = targetStr.split('to');
  } else {
    return 'neutral';
  }
  
  const oldVal = parseFloat(parts[0].replace(/[$,\s]/g, ''));
  const newVal = parseFloat(parts[1].replace(/[$,\s]/g, ''));
  if (isNaN(oldVal) || isNaN(newVal)) return 'neutral';
  if (newVal > oldVal) return 'up';
  if (newVal < oldVal) return 'down';
  return 'neutral';
};

function App() {
  const [inputTickers, setInputTickers] = useState('');
  
  // Alert and Background Polling states
  const [alertsQueue, setAlertsQueue] = useState([]);
  const [alertHistory, setAlertHistory] = useState(() => {
    const saved = localStorage.getItem('tracked_alerts_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [dashboardSort, setDashboardSort] = useState('upside'); // 'upside', 'alphabetical', 'target'
  const [pollingIntervalMs, setPollingIntervalMs] = useState(15 * 60 * 1000); // 15 mins default
  const [lastCheckTime, setLastCheckTime] = useState(null);
  const [nextCheckTime, setNextCheckTime] = useState(null);
  const [isDevOpen, setIsDevOpen] = useState(false);

  const [tickersList, setTickersList] = useState(() => {
    const saved = localStorage.getItem('tracked_tickers');
    return saved ? JSON.parse(saved) : ['NBIS', 'AAPL', 'MSFT'];
  });

  const [tickersData, setTickersData] = useState(() => {
    const saved = localStorage.getItem('tracked_tickers_data');
    return saved ? JSON.parse(saved) : {};
  });
  const [loadingMap, setLoadingMap] = useState({});
  const [errorsMap, setErrorsMap] = useState({});
  const [activeTicker, setActiveTicker] = useState('NBIS');
  
  // MarketBeat Table states
  const [analystSearch, setAnalystSearch] = useState('');
  const [analystActionFilter, setAnalystActionFilter] = useState('All');
  const [analystRatingFilter, setAnalystRatingFilter] = useState('All');
  const [analystSortField, setAnalystSortField] = useState('date'); // 'date', 'priceTarget'
  const [analystSortDirection, setAnalystSortDirection] = useState('desc'); // 'asc', 'desc'

  // Benzinga Table and Tabs states
  const [benzingaData, setBenzingaData] = useState(() => {
    const saved = localStorage.getItem('tracked_benzinga_data');
    return saved ? JSON.parse(saved) : {};
  });
  const [benzingaLoadingMap, setBenzingaLoadingMap] = useState({});
  const [benzingaErrorsMap, setBenzingaErrorsMap] = useState({});
  const [activeSourceTab, setActiveSourceTab] = useState('marketbeat');
  const [benzingaSearch, setBenzingaSearch] = useState('');
  const [benzingaActionFilter, setBenzingaActionFilter] = useState('All');
  const [benzingaRatingFilter, setBenzingaRatingFilter] = useState('All');
  const [benzingaSortField, setBenzingaSortField] = useState('date'); // 'date', 'priceTarget'
  const [benzingaSortDirection, setBenzingaSortDirection] = useState('desc'); // 'asc', 'desc'

  // TipRanks Table states
  const [tipranksData, setTipranksData] = useState(() => {
    const saved = localStorage.getItem('tracked_tipranks_data');
    return saved ? JSON.parse(saved) : {};
  });
  const [tipranksLoadingMap, setTipranksLoadingMap] = useState({});
  const [tipranksErrorsMap, setTipranksErrorsMap] = useState({});
  const [tipranksSearch, setTipranksSearch] = useState('');
  const [tipranksActionFilter, setTipranksActionFilter] = useState('All');
  const [tipranksRatingFilter, setTipranksRatingFilter] = useState('All');
  const [tipranksSortField, setTipranksSortField] = useState('date'); // 'date', 'priceTarget'
  const [tipranksSortDirection, setTipranksSortDirection] = useState('desc'); // 'asc', 'desc'

  // Modifications View states
  const [activeMainTab, setActiveMainTab] = useState('dashboard'); // 'dashboard', 'modifications'
  const [modificationsSearch, setModificationsSearch] = useState('');
  const [modificationsSourceFilter, setModificationsSourceFilter] = useState('All');
  const [modificationsTickerFilter, setModificationsTickerFilter] = useState('All');
  const [modificationsSortField, setModificationsSortField] = useState('date'); // 'date', 'priceTarget', 'ticker'
  const [modificationsSortDirection, setModificationsSortDirection] = useState('desc'); // 'asc', 'desc'

  // Refs to avoid stale closure issues in async fetches
  const tickersDataRef = useRef(tickersData);
  const benzingaDataRef = useRef(benzingaData);
  const tipranksDataRef = useRef(tipranksData);
  const tickersListRef = useRef(tickersList);

  // Ref for tickersList to ensure background interval always has the latest tracked list
  useEffect(() => {
    tickersListRef.current = tickersList;
  }, [tickersList]);

  useEffect(() => {
    tickersDataRef.current = tickersData;
  }, [tickersData]);

  useEffect(() => {
    benzingaDataRef.current = benzingaData;
  }, [benzingaData]);

  useEffect(() => {
    tipranksDataRef.current = tipranksData;
  }, [tipranksData]);

  // Save tickers list to localStorage
  useEffect(() => {
    localStorage.setItem('tracked_tickers', JSON.stringify(tickersList));
  }, [tickersList]);

  // Save alerts history to localStorage
  useEffect(() => {
    localStorage.setItem('tracked_alerts_history', JSON.stringify(alertHistory));
  }, [alertHistory]);

  // Save tickers data to localStorage
  useEffect(() => {
    localStorage.setItem('tracked_tickers_data', JSON.stringify(tickersData));
  }, [tickersData]);

  // Save benzinga data to localStorage
  useEffect(() => {
    localStorage.setItem('tracked_benzinga_data', JSON.stringify(benzingaData));
  }, [benzingaData]);

  // Save tipranks data to localStorage
  useEffect(() => {
    localStorage.setItem('tracked_tipranks_data', JSON.stringify(tipranksData));
  }, [tipranksData]);

  // Reset analyst filters and sorting when ticker changes
  useEffect(() => {
    setAnalystSearch('');
    setAnalystActionFilter('All');
    setAnalystRatingFilter('All');
    setAnalystSortField('date');
    setAnalystSortDirection('desc');

    setBenzingaSearch('');
    setBenzingaActionFilter('All');
    setBenzingaRatingFilter('All');
    setBenzingaSortField('date');
    setBenzingaSortDirection('desc');

    setTipranksSearch('');
    setTipranksActionFilter('All');
    setTipranksRatingFilter('All');
    setTipranksSortField('date');
    setTipranksSortDirection('desc');
  }, [activeTicker]);

  const handleSort = (field) => {
    if (analystSortField === field) {
      setAnalystSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setAnalystSortField(field);
      setAnalystSortDirection('desc');
    }
  };

  const handleBenzingaSort = (field) => {
    if (benzingaSortField === field) {
      setBenzingaSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setBenzingaSortField(field);
      setBenzingaSortDirection('desc');
    }
  };

  const handleTipranksSort = (field) => {
    if (tipranksSortField === field) {
      setTipranksSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setTipranksSortField(field);
      setTipranksSortDirection('desc');
    }
  };

  const handleModificationsSort = (field) => {
    if (modificationsSortField === field) {
      setModificationsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setModificationsSortField(field);
      setModificationsSortDirection('desc');
    }
  };

  // Compile all modifications from active tickers and deduplicate
  const rawModifications = [];
  
  Object.entries(tickersData).forEach(([ticker, data]) => {
    const ratings = data?.analystRatings || [];
    ratings.forEach(r => {
      rawModifications.push({
        ticker,
        sources: ['MarketBeat'],
        date: r.date,
        firm: r.brokerage || '',
        analyst: r.analyst || '',
        action: r.action || '',
        rating: r.rating || '',
        priceTarget: r.priceTarget || '',
        upsideDownside: r.upsideDownside || ''
      });
    });
  });

  Object.entries(benzingaData).forEach(([ticker, data]) => {
    const ratings = data?.ratings || [];
    ratings.forEach(r => {
      rawModifications.push({
        ticker,
        sources: ['Benzinga'],
        date: r.date,
        firm: r.analystFirm || '',
        analyst: '',
        action: r.action || '',
        rating: r.rating || '',
        priceTarget: r.priceTarget || '',
        upsideDownside: r.upsideDownside || ''
      });
    });
  });

  Object.entries(tipranksData).forEach(([ticker, data]) => {
    const ratings = data?.ratings || [];
    ratings.forEach(r => {
      rawModifications.push({
        ticker,
        sources: ['TipRanks'],
        date: r.date,
        firm: r.analystFirm || '',
        analyst: r.analyst || '',
        action: r.action || '',
        rating: r.rating || '',
        priceTarget: r.priceTarget || '',
        upsideDownside: r.upsideDownside || ''
      });
    });
  });

  // Deduplicate and merge modifications
  const allModifications = [];
  rawModifications.forEach(item => {
    const normFirm = normalizeFirm(item.firm);
    const itemTargetVal = parsePriceTargetValue(item.priceTarget);
    const itemTime = parseDateToMs(item.date);

    const duplicateIndex = allModifications.findIndex(existing => {
      if (existing.ticker !== item.ticker) return false;
      
      // Compare normalized firms
      const existingNormFirm = normalizeFirm(existing.firm);
      if (normFirm !== existingNormFirm) return false;

      // Compare analyst names if both are present and not empty
      if (item.analyst && existing.analyst) {
        if (!analystsMatch(item.analyst, existing.analyst)) return false;
      }

      // Compare target values (if both are present)
      const existingTargetVal = parsePriceTargetValue(existing.priceTarget);
      if (itemTargetVal !== null && existingTargetVal !== null) {
        if (itemTargetVal !== existingTargetVal) return false;
      }

      // Compare dates (within 2 days tolerance)
      const existingTime = parseDateToMs(existing.date);
      if (Math.abs(itemTime - existingTime) > 2 * 24 * 60 * 60 * 1000) return false;

      return true;
    });

    if (duplicateIndex !== -1) {
      const existing = allModifications[duplicateIndex];
      
      // Merge sources
      if (!existing.sources.includes(item.sources[0])) {
        existing.sources.push(item.sources[0]);
      }

      // Keep more detailed fields
      if (item.firm.length > existing.firm.length) {
        existing.firm = item.firm;
      }
      
      // Choose more detailed analyst name
      if (item.analyst && (!existing.analyst || item.analyst.length > existing.analyst.length)) {
        existing.analyst = item.analyst;
      }

      if (item.action && (!existing.action || item.action.length > existing.action.length)) {
        existing.action = item.action;
      }

      if (item.rating && (!existing.rating || item.rating.length > existing.rating.length)) {
        existing.rating = item.rating;
      }

      // Choose more detailed price target string
      const hasArrow = (str) => str.includes('➔') || str.includes('to') || str.includes('->') || str.includes('→');
      const itemHasArrow = hasArrow(item.priceTarget || '');
      const existingHasArrow = hasArrow(existing.priceTarget || '');

      if (item.priceTarget && !existing.priceTarget) {
        existing.priceTarget = item.priceTarget;
      } else if (item.priceTarget && existing.priceTarget) {
        if (itemHasArrow && !existingHasArrow) {
          existing.priceTarget = item.priceTarget;
        } else if (itemHasArrow && existingHasArrow) {
          if (item.priceTarget.length > existing.priceTarget.length) {
            existing.priceTarget = item.priceTarget;
          }
        } else if (!itemHasArrow && !existingHasArrow) {
          if (item.priceTarget.length > existing.priceTarget.length) {
            existing.priceTarget = item.priceTarget;
          }
        }
      }

      // Normalize arrow style in price target to standard '➔'
      if (existing.priceTarget) {
        existing.priceTarget = existing.priceTarget
          .replace(/\s*(➔|->|to|→)\s*/g, ' ➔ ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      if (!existing.upsideDownside && item.upsideDownside) {
        existing.upsideDownside = item.upsideDownside;
      }
      
      // Keep earlier date as it might represent the initial announcement time
      if (itemTime < parseDateToMs(existing.date)) {
        existing.date = item.date;
      }
    } else {
      // Normalize raw item price target arrows before adding
      if (item.priceTarget) {
        item.priceTarget = item.priceTarget
          .replace(/\s*(➔|->|to|→)\s*/g, ' ➔ ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      allModifications.push(item);
    }
  });

  // Filter modifications
  const filteredModifications = allModifications.filter(mod => {
    const matchesSearch = 
      mod.ticker.toLowerCase().includes(modificationsSearch.toLowerCase()) ||
      (mod.firm || '').toLowerCase().includes(modificationsSearch.toLowerCase()) ||
      (mod.analyst || '').toLowerCase().includes(modificationsSearch.toLowerCase());
      
    const matchesSource = 
      modificationsSourceFilter === 'All' || 
      mod.sources.some(src => src.toLowerCase() === modificationsSourceFilter.toLowerCase());
      
    const matchesTicker = 
      modificationsTickerFilter === 'All' || 
      mod.ticker.toUpperCase() === modificationsTickerFilter.toUpperCase();
      
    return matchesSearch && matchesSource && matchesTicker;
  });

  // Sort modifications
  const sortedModifications = [...filteredModifications].sort((a, b) => {
    let valA, valB;
    if (modificationsSortField === 'date') {
      valA = parseDateToMs(a.date);
      valB = parseDateToMs(b.date);
    } else if (modificationsSortField === 'priceTarget') {
      valA = parsePriceTargetValue(a.priceTarget) || 0;
      valB = parsePriceTargetValue(b.priceTarget) || 0;
    } else if (modificationsSortField === 'ticker') {
      valA = a.ticker;
      valB = b.ticker;
    } else {
      return 0;
    }

    if (valA < valB) return modificationsSortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return modificationsSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Alert management helpers
  const dismissAlert = (id) => {
    if (id && typeof id === 'string') {
      setAlertsQueue(prev => prev.filter(a => a.id !== id));
    } else {
      setAlertsQueue(prev => prev.slice(1));
    }
  };

  const dismissAllAlerts = () => {
    setAlertsQueue([]);
  };

  const toggleNotifications = () => {
    setIsNotificationOpen(prev => {
      const next = !prev;
      if (next) {
        // Mark all history alerts as read when dropdown is opened
        setAlertHistory(curr => curr.map(a => ({ ...a, read: true })));
      }
      return next;
    });
  };

  const unreadCount = alertHistory.filter(a => !a.read).length;

  const simulateMockAlert = () => {
    const mockAlerts = [
      {
        id: `mock-${Date.now()}-1`,
        ticker: 'NBIS',
        source: 'MarketBeat',
        date: new Date().toLocaleDateString(),
        firm: 'Goldman Sachs',
        analyst: 'Toni Sacconaghi',
        action: 'Upgrade',
        rating: 'Buy',
        priceTarget: '$180.00 ➔ $240.00',
        upsideDownside: '+25.10%',
        detectedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        read: false
      },
      {
        id: `mock-${Date.now()}-2`,
        ticker: 'AAPL',
        source: 'Benzinga',
        date: new Date().toLocaleDateString(),
        firm: 'Morgan Stanley',
        analyst: 'Erik Woodring',
        action: 'Upgrade',
        rating: 'Overweight',
        priceTarget: '$175.00 ➔ $210.00',
        upsideDownside: '+15.24%',
        detectedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        read: false
      },
      {
        id: `mock-${Date.now()}-3`,
        ticker: 'MSFT',
        source: 'MarketBeat',
        date: new Date().toLocaleDateString(),
        firm: 'KeyBanc',
        analyst: 'Jackson Ader',
        action: 'Upgrade',
        rating: 'Overweight',
        priceTarget: '$420.00 ➔ $480.00',
        upsideDownside: '+12.45%',
        detectedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        read: false
      }
    ];
    
    // Select one at random
    const alert = mockAlerts[Math.floor(Math.random() * mockAlerts.length)];
    setAlertsQueue(prev => [...prev, alert]);
    setAlertHistory(prev => [alert, ...prev]);
  };

  // Background polling effect
  useEffect(() => {
    const calculateNext = () => {
      const next = new Date(Date.now() + pollingIntervalMs);
      setNextCheckTime(next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };

    calculateNext();

    const interval = setInterval(async () => {
      const currentTickers = tickersListRef.current;
      if (currentTickers.length === 0) return;

      const now = new Date();
      setLastCheckTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setNextCheckTime(new Date(now.getTime() + pollingIntervalMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      console.log(`[Background Polling] Rescraping tickers: ${currentTickers.join(', ')}`);
      await scrapeTickers(currentTickers, true, true);
    }, pollingIntervalMs);

    return () => clearInterval(interval);
  }, [pollingIntervalMs]);

  // Trigger scrape for a list of tickers (force bypasses cache)
  const scrapeTickers = async (tickersToScrape, force = false, isBackground = false) => {
    // Deduplicate and filter empty
    const uniqueTickers = [...new Set(tickersToScrape.map(t => t.trim().toUpperCase()))].filter(Boolean);
    if (uniqueTickers.length === 0) return;

    if (!isBackground) {
      // Set loading for MarketBeat
      const newLoading = { ...loadingMap };
      uniqueTickers.forEach(t => {
        newLoading[t] = true;
      });
      setLoadingMap(newLoading);

      // Set loading for Benzinga
      const newBenzingaLoading = { ...benzingaLoadingMap };
      uniqueTickers.forEach(t => {
        newBenzingaLoading[t] = true;
      });
      setBenzingaLoadingMap(newBenzingaLoading);

      // Set loading for TipRanks
      const newTipranksLoading = { ...tipranksLoadingMap };
      uniqueTickers.forEach(t => {
        newTipranksLoading[t] = true;
      });
      setTipranksLoadingMap(newTipranksLoading);
    }

    // Fetch each ticker in parallel
    const promises = uniqueTickers.map(async (ticker) => {
      // 1. Fetch MarketBeat
      const marketBeatPromise = (async () => {
        try {
          const response = await fetch(`http://localhost:3001/api/scrape/${ticker}${force ? '?force=true' : ''}`);
          const data = await response.json();
          
          if (!response.ok || data.error) {
            throw new Error(data.error || 'Failed to scrape ticker');
          }

          // Target checking logic if we have previous data
          const oldMBRatings = tickersDataRef.current[ticker]?.analystRatings || [];
          const newMBRatings = data.analystRatings || [];
          if (oldMBRatings.length > 0 && newMBRatings.length > 0) {
            const oldKeys = new Set(oldMBRatings.map(r => `${r.date || ''}|${r.brokerage || ''}|${r.analyst || ''}|${r.priceTarget || ''}|${r.action || ''}|${r.rating || ''}`.toLowerCase().trim()));
            const newAlerts = [];
            newMBRatings.forEach(r => {
              const key = `${r.date || ''}|${r.brokerage || ''}|${r.analyst || ''}|${r.priceTarget || ''}|${r.action || ''}|${r.rating || ''}`.toLowerCase().trim();
              if (!oldKeys.has(key)) {
                // Calculate current price comparison
                const targetVal = parsePriceTargetValue(r.priceTarget);
                const currentPrice = data.currentPrice;
                let currentUpsideText = 'N/A';
                if (targetVal !== null && currentPrice !== null && currentPrice > 0) {
                  const pct = ((targetVal - currentPrice) / currentPrice) * 100;
                  currentUpsideText = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
                } else if (r.upsideDownside) {
                  currentUpsideText = r.upsideDownside;
                }

                newAlerts.push({
                  id: `${ticker}-mb-${Date.now()}-${Math.random()}`,
                  ticker,
                  source: 'MarketBeat',
                  date: r.date,
                  firm: r.brokerage,
                  analyst: r.analyst,
                  action: r.action,
                  rating: r.rating,
                  priceTarget: r.priceTarget,
                  upsideDownside: currentUpsideText,
                  detectedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  read: false
                });
              }
            });
            if (newAlerts.length > 0) {
              setAlertsQueue(prev => [...prev, ...newAlerts]);
              setAlertHistory(prev => [...newAlerts, ...prev]);
            }
          }

          setTickersData(prev => ({ ...prev, [ticker]: data }));
          setErrorsMap(prev => {
            const next = { ...prev };
            delete next[ticker];
            return next;
          });

          // Set active ticker if none is active or active ticker is not resolved
          setActiveTicker(prev => prev ? prev : ticker);
        } catch (err) {
          console.error(`Error scraping ${ticker} on MarketBeat:`, err);
          if (!isBackground) {
            setErrorsMap(prev => ({ ...prev, [ticker]: err.message }));
          }
        } finally {
          if (!isBackground) {
            setLoadingMap(prev => {
              const next = { ...prev };
              delete next[ticker];
              return next;
            });
          }
        }
      })();

      // 2. Fetch Benzinga
      const benzingaPromise = (async () => {
        try {
          const response = await fetch(`http://localhost:3001/api/scrape/benzinga/${ticker}${force ? '?force=true' : ''}`);
          const data = await response.json();
          
          if (!response.ok || data.error) {
            throw new Error(data.error || 'Failed to scrape Benzinga ratings');
          }

          // Target checking logic if we have previous data
          const oldBZRatings = benzingaDataRef.current[ticker]?.ratings || [];
          const newBZRatings = data.ratings || [];
          if (oldBZRatings.length > 0 && newBZRatings.length > 0) {
            const oldKeys = new Set(oldBZRatings.map(r => `${r.date || ''}|${r.analystFirm || ''}|${r.priceTarget || ''}|${r.action || ''}|${r.rating || ''}`.toLowerCase().trim()));
            const newAlerts = [];
            newBZRatings.forEach(r => {
              const key = `${r.date || ''}|${r.analystFirm || ''}|${r.priceTarget || ''}|${r.action || ''}|${r.rating || ''}`.toLowerCase().trim();
              if (!oldKeys.has(key)) {
                // Calculate current price comparison
                const targetVal = parsePriceTargetValue(r.priceTarget);
                const currentPrice = tickersDataRef.current[ticker]?.currentPrice;
                let currentUpsideText = 'N/A';
                if (targetVal !== null && currentPrice !== null && currentPrice > 0) {
                  const pct = ((targetVal - currentPrice) / currentPrice) * 100;
                  currentUpsideText = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
                } else if (r.upsideDownside) {
                  currentUpsideText = r.upsideDownside;
                }

                newAlerts.push({
                  id: `${ticker}-bz-${Date.now()}-${Math.random()}`,
                  ticker,
                  source: 'Benzinga',
                  date: r.date,
                  firm: r.analystFirm,
                  analyst: '',
                  action: r.action,
                  rating: r.rating,
                  priceTarget: r.priceTarget,
                  upsideDownside: currentUpsideText,
                  detectedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  read: false
                });
              }
            });
            if (newAlerts.length > 0) {
              setAlertsQueue(prev => [...prev, ...newAlerts]);
              setAlertHistory(prev => [...newAlerts, ...prev]);
            }
          }

          setBenzingaData(prev => ({ ...prev, [ticker]: data }));
          setBenzingaErrorsMap(prev => {
            const next = { ...prev };
            delete next[ticker];
            return next;
          });
        } catch (err) {
          console.error(`Error scraping ${ticker} on Benzinga:`, err);
          if (!isBackground) {
            setBenzingaErrorsMap(prev => ({ ...prev, [ticker]: err.message }));
          }
        } finally {
          if (!isBackground) {
            setBenzingaLoadingMap(prev => {
              const next = { ...prev };
              delete next[ticker];
              return next;
            });
          }
        }
      })();

      // 3. Fetch TipRanks
      const tipranksPromise = (async () => {
        try {
          const response = await fetch(`http://localhost:3001/api/scrape/tipranks/${ticker}${force ? '?force=true' : ''}`);
          const data = await response.json();
          
          if (!response.ok || data.error) {
            throw new Error(data.error || 'Failed to scrape TipRanks ratings');
          }

          // Target checking logic if we have previous data
          const oldTRRatings = tipranksDataRef.current[ticker]?.ratings || [];
          const newTRRatings = data.ratings || [];
          if (oldTRRatings.length > 0 && newTRRatings.length > 0) {
            const oldKeys = new Set(oldTRRatings.map(r => `${r.date || ''}|${r.analystFirm || ''}|${r.analyst || ''}|${r.priceTarget || ''}|${r.action || ''}|${r.rating || ''}`.toLowerCase().trim()));
            const newAlerts = [];
            newTRRatings.forEach(r => {
              const key = `${r.date || ''}|${r.analystFirm || ''}|${r.analyst || ''}|${r.priceTarget || ''}|${r.action || ''}|${r.rating || ''}`.toLowerCase().trim();
              if (!oldKeys.has(key)) {
                // Calculate current price comparison
                const targetVal = parsePriceTargetValue(r.priceTarget);
                const currentPrice = tickersDataRef.current[ticker]?.currentPrice;
                let currentUpsideText = 'N/A';
                if (targetVal !== null && currentPrice !== null && currentPrice > 0) {
                  const pct = ((targetVal - currentPrice) / currentPrice) * 100;
                  currentUpsideText = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
                } else if (r.upsideDownside) {
                  currentUpsideText = r.upsideDownside;
                }

                newAlerts.push({
                  id: `${ticker}-tr-${Date.now()}-${Math.random()}`,
                  ticker,
                  source: 'TipRanks',
                  date: r.date,
                  firm: r.analystFirm,
                  analyst: r.analyst,
                  action: r.action,
                  rating: r.rating,
                  priceTarget: r.priceTarget,
                  upsideDownside: currentUpsideText,
                  detectedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  read: false
                });
              }
            });
            if (newAlerts.length > 0) {
              setAlertsQueue(prev => [...prev, ...newAlerts]);
              setAlertHistory(prev => [...newAlerts, ...prev]);
            }
          }

          setTipranksData(prev => ({ ...prev, [ticker]: data }));
          setTipranksErrorsMap(prev => {
            const next = { ...prev };
            delete next[ticker];
            return next;
          });
        } catch (err) {
          console.error(`Error scraping ${ticker} on TipRanks:`, err);
          if (!isBackground) {
            setTipranksErrorsMap(prev => ({ ...prev, [ticker]: err.message }));
          }
        } finally {
          if (!isBackground) {
            setTipranksLoadingMap(prev => {
              const next = { ...prev };
              delete next[ticker];
              return next;
            });
          }
        }
      })();

      await Promise.all([marketBeatPromise, benzingaPromise, tipranksPromise]);
    });

    await Promise.all(promises);
  };

  // Initial load
  useEffect(() => {
    scrapeTickers(tickersList);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!inputTickers.trim()) return;
    
    // Parse commas, spaces, semicolons
    const rawList = inputTickers.split(/[\s,;]+/).map(t => t.trim().toUpperCase()).filter(Boolean);
    if (rawList.length === 0) return;

    // Add to current ticker list and scrape
    const mergedList = [...new Set([...tickersList, ...rawList])];
    setTickersList(mergedList);
    scrapeTickers(rawList);
    setInputTickers('');

    // Set active to the first new ticker searched
    if (rawList.length > 0) {
      setActiveTicker(rawList[0]);
      setActiveMainTab('dashboard');
    }
  };

  const removeTicker = (ticker) => {
    const list = tickersList.filter(t => t !== ticker);
    setTickersList(list);
    
    setTickersData(prev => {
      const next = { ...prev };
      delete next[ticker];
      return next;
    });

    setErrorsMap(prev => {
      const next = { ...prev };
      delete next[ticker];
      return next;
    });

    setBenzingaData(prev => {
      const next = { ...prev };
      delete next[ticker];
      return next;
    });

    setBenzingaErrorsMap(prev => {
      const next = { ...prev };
      delete next[ticker];
      return next;
    });

    setBenzingaLoadingMap(prev => {
      const next = { ...prev };
      delete next[ticker];
      return next;
    });

    setTipranksData(prev => {
      const next = { ...prev };
      delete next[ticker];
      return next;
    });

    setTipranksErrorsMap(prev => {
      const next = { ...prev };
      delete next[ticker];
      return next;
    });

    setTipranksLoadingMap(prev => {
      const next = { ...prev };
      delete next[ticker];
      return next;
    });

    if (activeTicker === ticker) {
      setActiveTicker(list[0] || '');
    }
  };

  const activeData = tickersData[activeTicker];
  const activeError = errorsMap[activeTicker];
  const activeLoading = loadingMap[activeTicker];

  // Derived MarketBeat Analyst Ratings variables
  const analystRatings = activeData?.analystRatings || [];
  const uniqueActions = ['All', ...new Set(analystRatings.map(r => r.action).filter(Boolean))];
  const uniqueRatings = ['All', ...new Set(analystRatings.map(r => r.rating).filter(Boolean))];
  const filteredRatings = analystRatings.filter(r => {
    const matchesSearch = 
      (r.brokerage || '').toLowerCase().includes(analystSearch.toLowerCase()) ||
      (r.analyst || '').toLowerCase().includes(analystSearch.toLowerCase());
    const matchesAction = analystActionFilter === 'All' || r.action === analystActionFilter;
    const matchesRating = analystRatingFilter === 'All' || r.rating === analystRatingFilter;
    return matchesSearch && matchesAction && matchesRating;
  });

  // Sort the filtered ratings
  const sortedRatings = [...filteredRatings].sort((a, b) => {
    let valA, valB;
    if (analystSortField === 'date') {
      valA = a.date ? new Date(a.date).getTime() : 0;
      valB = b.date ? new Date(b.date).getTime() : 0;
    } else if (analystSortField === 'priceTarget') {
      valA = parsePriceTargetValue(a.priceTarget) || 0;
      valB = parsePriceTargetValue(b.priceTarget) || 0;
    } else {
      return 0;
    }
    
    if (valA < valB) return analystSortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return analystSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const activeBenzingaData = benzingaData[activeTicker];
  const activeBenzingaError = benzingaErrorsMap[activeTicker];
  const activeBenzingaLoading = benzingaLoadingMap[activeTicker];

  // Derived Benzinga Analyst Ratings variables
  const benzingaRatings = activeBenzingaData?.ratings || [];
  const uniqueBenzingaActions = ['All', ...new Set(benzingaRatings.map(r => r.action).filter(Boolean))];
  const uniqueBenzingaRatings = ['All', ...new Set(benzingaRatings.map(r => r.rating).filter(Boolean))];
  const filteredBenzingaRatings = benzingaRatings.filter(r => {
    const matchesSearch = 
      (r.analystFirm || '').toLowerCase().includes(benzingaSearch.toLowerCase());
    const matchesAction = benzingaActionFilter === 'All' || r.action === benzingaActionFilter;
    const matchesRating = benzingaRatingFilter === 'All' || r.rating === benzingaRatingFilter;
    return matchesSearch && matchesAction && matchesRating;
  });

  // Sort the filtered Benzinga ratings
  const sortedBenzingaRatings = [...filteredBenzingaRatings].sort((a, b) => {
    let valA, valB;
    if (benzingaSortField === 'date') {
      valA = a.date ? new Date(a.date).getTime() : 0;
      valB = b.date ? new Date(b.date).getTime() : 0;
    } else if (benzingaSortField === 'priceTarget') {
      valA = parsePriceTargetValue(a.priceTarget) || 0;
      valB = parsePriceTargetValue(b.priceTarget) || 0;
    } else {
      return 0;
    }
    
    if (valA < valB) return benzingaSortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return benzingaSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const activeTipranksData = tipranksData[activeTicker];
  const activeTipranksError = tipranksErrorsMap[activeTicker];
  const activeTipranksLoading = tipranksLoadingMap[activeTicker];

  // Derived TipRanks Analyst Ratings variables
  const tipranksRatings = activeTipranksData?.ratings || [];
  const uniqueTipranksActions = ['All', ...new Set(tipranksRatings.map(r => r.action).filter(Boolean))];
  const uniqueTipranksRatings = ['All', ...new Set(tipranksRatings.map(r => r.rating).filter(Boolean))];
  const filteredTipranksRatings = tipranksRatings.filter(r => {
    const matchesSearch = 
      (r.analystFirm || '').toLowerCase().includes(tipranksSearch.toLowerCase()) ||
      (r.analyst || '').toLowerCase().includes(tipranksSearch.toLowerCase());
    const matchesAction = tipranksActionFilter === 'All' || r.action === tipranksActionFilter;
    const matchesRating = tipranksRatingFilter === 'All' || r.rating === tipranksRatingFilter;
    return matchesSearch && matchesAction && matchesRating;
  });

  // Sort the filtered TipRanks ratings
  const sortedTipranksRatings = [...filteredTipranksRatings].sort((a, b) => {
    let valA, valB;
    if (tipranksSortField === 'date') {
      valA = a.date ? new Date(a.date).getTime() : 0;
      valB = b.date ? new Date(b.date).getTime() : 0;
    } else if (tipranksSortField === 'priceTarget') {
      valA = parsePriceTargetValue(a.priceTarget) || 0;
      valB = parsePriceTargetValue(b.priceTarget) || 0;
    } else {
      return 0;
    }
    
    if (valA < valB) return tipranksSortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return tipranksSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-medium">
            <Layers className="h-5 w-5" />
            <span>MarketBeat Extractor Hub</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold mt-1 tracking-tight text-slate-900">
            Analyst Price Targets
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Compare analyst ratings, current stock prices, and targets in real-time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Dev Panel Toggle */}
          <button
            onClick={() => setIsDevOpen(!isDevOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider border transition cursor-pointer ${
              isDevOpen 
                ? 'bg-indigo-100 border-indigo-300 text-indigo-755' 
                : 'glass-panel border-slate-200 text-slate-500 hover:text-slate-700'
            }`}
          >
            Dev Panel
          </button>

          {/* Notification Bell & Dropdown */}
          <div className="relative">
            <button
              onClick={toggleNotifications}
              className={`relative p-2.5 rounded-xl border transition flex items-center justify-center cursor-pointer ${
                isNotificationOpen 
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700' 
                  : 'glass-panel border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="Notifications"
            >
              {unreadCount > 0 ? (
                <>
                  <BellRing className="h-4.5 w-4.5 text-indigo-600 animate-bounce" />
                  <span className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-md">
                    {unreadCount}
                  </span>
                </>
              ) : (
                <Bell className="h-4.5 w-4.5" />
              )}
            </button>

            {isNotificationOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[480px]">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-800 text-sm">Notifications History</span>
                  {alertHistory.length > 0 && (
                    <button
                      onClick={() => {
                        setAlertHistory([]);
                        setAlertsQueue([]);
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1 divide-y divide-slate-150">
                  {alertHistory.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-500 text-xs">
                      No alerts detected in this session.
                    </div>
                  ) : (
                    alertHistory.map((alert) => (
                      <div key={alert.id} className="p-4 hover:bg-slate-55/50 transition text-xs flex flex-col gap-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-900">{alert.ticker} ({alert.source})</span>
                          <span className="text-[10px] text-slate-500">{alert.detectedAt}</span>
                        </div>
                        <div className="text-slate-650 text-[11px]">
                          <span className="font-medium text-slate-800">{alert.firm}</span>: {alert.action} to <span className="font-semibold text-slate-800">{alert.rating}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="font-bold text-slate-800">{alert.priceTarget}</span>
                          <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[9px] font-semibold">{alert.upsideDownside}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={() => scrapeTickers(tickersList, true)} 
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider glass-panel border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh All
          </button>
        </div>
      </header>

      {/* Developer Helper Panel */}
      {isDevOpen && (
        <div className="glass-panel p-4 border-indigo-100 bg-indigo-50/20 flex flex-wrap items-center justify-between gap-4 animate-fade-in text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 uppercase tracking-wider">Polling Interval:</span>
              <select
                value={pollingIntervalMs}
                onChange={(e) => setPollingIntervalMs(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-medium outline-none cursor-pointer"
              >
                <option value={10 * 1000}>10 Seconds (Testing)</option>
                <option value={30 * 1000}>30 Seconds</option>
                <option value={5 * 60 * 1000}>5 Minutes</option>
                <option value={15 * 60 * 1000}>15 Minutes (Default)</option>
                <option value={60 * 60 * 1000}>1 Hour</option>
              </select>
            </div>
            <div className="text-slate-500 flex items-center gap-4">
              <span>Last Check: <strong className="text-slate-700 font-semibold">{lastCheckTime || 'Never'}</strong></span>
              <span>Next Check: <strong className="text-slate-700 font-semibold">{nextCheckTime || 'N/A'}</strong></span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={simulateMockAlert}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              Simulate Mock Alert
            </button>
          </div>
        </div>
      )}

      {/* Multi-ticker Search Bar */}
      <section className="glass-panel p-6 border-slate-200 flex flex-col gap-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Search className="h-5 w-5 text-indigo-600" />
          Track Multiple Tickers
        </h2>
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputTickers}
              onChange={(e) => setInputTickers(e.target.value)}
              placeholder="Enter tickers separated by commas or spaces (e.g., TSLA, BABA, NVDA)..."
              className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-slate-900 text-sm outline-none transition"
            />
          </div>
          <button 
            type="submit" 
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition"
          >
            Add Tickers
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
        
        {/* Active Tickers Chips */}
        <div className="flex flex-wrap gap-2 items-center mt-2">
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider mr-2">Tracked:</span>
          {tickersList.map(ticker => {
            const isSelected = activeTicker === ticker;
            const isLoading = loadingMap[ticker];
            const isError = errorsMap[ticker];
            return (
              <span 
                key={ticker} 
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition ${
                  isSelected 
                    ? 'bg-indigo-100 border-indigo-300 text-indigo-700' 
                    : isError
                    ? 'bg-red-50 border-red-200 text-red-600'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
                onClick={() => {
                  setActiveTicker(ticker);
                  setActiveMainTab('dashboard');
                }}
              >
                {isLoading && <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />}
                <span>{ticker}</span>
                {isError && <AlertCircle className="h-3.5 w-3.5 text-red-500" title={errorsMap[ticker]} />}
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); removeTicker(ticker); }} 
                  className="hover:bg-slate-200 rounded-full p-0.5 text-slate-450 hover:text-slate-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      </section>

      {/* View Switcher Tabs */}
      <div className="flex border-b border-slate-200 mt-2">
        <button
          type="button"
          onClick={() => setActiveMainTab('dashboard')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition cursor-pointer ${
            activeMainTab === 'dashboard'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="h-4 w-4" />
          Ticker Dashboard
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab('modifications')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition cursor-pointer ${
            activeMainTab === 'modifications'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Recent Price Target Modifications
        </button>
      </div>

      {activeMainTab === 'dashboard' ? (
        <>
          {/* Sorting and Grid Header */}
          <div className="flex justify-between items-center mb-3 mt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Tracked Stocks</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Sort by:</span>
              <select
                value={dashboardSort}
                onChange={(e) => setDashboardSort(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 hover:border-slate-300 focus:outline-none cursor-pointer shadow-sm"
              >
                <option value="upside">Upside (Highest First)</option>
                <option value="alphabetical">Ticker (A-Z)</option>
                <option value="target">Price Target (Highest First)</option>
              </select>
            </div>
          </div>

          {/* Grid of Summarized Ticker Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...tickersList]
              .sort((a, b) => {
                if (dashboardSort === 'upside') {
                  const dataA = tickersData[a];
                  const dataB = tickersData[b];
                  const valA = dataA && dataA.upsideDownsideValue !== null ? dataA.upsideDownsideValue : -Infinity;
                  const valB = dataB && dataB.upsideDownsideValue !== null ? dataB.upsideDownsideValue : -Infinity;
                  return valB - valA;
                } else if (dashboardSort === 'target') {
                  const dataA = tickersData[a];
                  const dataB = tickersData[b];
                  const valA = dataA && dataA.consensusPriceTarget !== null ? dataA.consensusPriceTarget : -Infinity;
                  const valB = dataB && dataB.consensusPriceTarget !== null ? dataB.consensusPriceTarget : -Infinity;
                  return valB - valA;
                } else {
                  return a.localeCompare(b);
                }
              })
              .map(ticker => {
          const data = tickersData[ticker];
          const isLoading = loadingMap[ticker];
          const isError = errorsMap[ticker];
          const isActive = activeTicker === ticker;

          if (isLoading && !data) {
            return (
              <div key={ticker} className="glass-panel p-3 border-slate-200 flex items-center justify-center h-[92px]">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            );
          }

          if (isError && !data) {
            return (
              <div 
                key={ticker} 
                className={`glass-panel p-3 border-red-200 bg-red-50/50 flex flex-col justify-between h-[92px] cursor-pointer relative group ${
                  isActive ? 'border-red-500 ring-1 ring-red-500' : ''
                }`}
                onClick={() => setActiveTicker(ticker)}
              >
                <div className="flex justify-between items-start pr-6">
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">{ticker}</h3>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeTicker(ticker); }} 
                    className="absolute top-2 right-2 bg-red-100 hover:bg-red-200 rounded-full p-1 text-red-600 hover:text-red-800 transition"
                    title="Remove stock"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="text-red-600 text-[10px] flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="line-clamp-2 leading-tight">{isError}</span>
                </div>
              </div>
            );
          }

          if (!data) return null;

          const upsidePct = data.upsideDownsideValue;
          const isUpside = upsidePct >= 0;
          return (
            <div 
              key={ticker}
              onClick={() => setActiveTicker(ticker)}
              className={`glass-panel p-3 border-slate-200 cursor-pointer flex flex-col justify-between gap-2.5 relative overflow-hidden transition-all group ${
                isActive ? 'border-indigo-500 bg-indigo-50/50 shadow-[0_0_20px_rgba(79,70,229,0.05)]' : 'hover:border-slate-300 hover:bg-slate-50/30'
              }`}
            >
              {/* Delete Button on Hover */}
              <button 
                type="button" 
                onClick={(e) => { e.stopPropagation(); removeTicker(ticker); }} 
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100/80 hover:bg-slate-200 rounded-full p-1 text-slate-500 hover:text-slate-700 z-10"
                title="Remove stock"
              >
                <X className="h-3 w-3" />
              </button>

              <div className="flex justify-between items-start pr-6">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">{data.ticker}</h3>
                  <p className="text-slate-500 text-[10px] mt-0.5 line-clamp-1">{data.companyName}</p>
                </div>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${getRatingColorClass(data.consensusRating)}`}>
                  {data.consensusRating}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 items-center text-[11px] mt-1.5 border-t border-slate-200/60 pt-2">
                <div>
                  <span className="text-slate-500 text-[9px] uppercase font-bold tracking-wider block leading-none mb-0.5">Price</span>
                  <span className="font-bold text-slate-900">${data.currentPrice?.toFixed(2) || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[9px] uppercase font-bold tracking-wider block leading-none mb-0.5">Target</span>
                  <span className="font-bold text-indigo-650">${data.consensusPriceTarget?.toFixed(2) || 'N/A'}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[9px] uppercase font-bold tracking-wider block leading-none mb-0.5">Upside</span>
                  {upsidePct !== null ? (
                    <span className={`font-bold inline-flex items-center justify-end gap-0.5 ${isUpside ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isUpside ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {isUpside ? '+' : ''}{upsidePct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-slate-400">N/A</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Detail Area for Active Ticker */}
      {activeTicker && (
        <section className="glass-panel p-6 border-slate-200 flex flex-col gap-6 animate-fade-in">
          {activeLoading && !activeData ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
              <p className="text-slate-500 text-sm font-medium">Fetching details for {activeTicker}...</p>
            </div>
          ) : activeError && !activeData ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <h3 className="text-lg font-bold text-slate-800">Error Loading {activeTicker}</h3>
              <p className="text-slate-500 text-sm max-w-md">{activeError}</p>
            </div>
          ) : activeData ? (
            <>
              {/* Detail Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200/60 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">{activeData.companyName}</h2>
                    <span className="text-sm font-semibold text-slate-700 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">{activeData.ticker}</span>
                  </div>
                  <p className="text-slate-500 text-xs mt-1">
                    Source:{' '}
                    {activeSourceTab === 'marketbeat' ? (
                      <a href={activeData.url} target="_blank" rel="noopener noreferrer" className="text-indigo-650 hover:underline">
                        {activeData.url}
                      </a>
                    ) : activeSourceTab === 'benzinga' ? (
                      <a href={`https://www.benzinga.com/quote/${activeTicker}/analyst-ratings`} target="_blank" rel="noopener noreferrer" className="text-indigo-650 hover:underline">
                        {`https://www.benzinga.com/quote/${activeTicker}/analyst-ratings`}
                      </a>
                    ) : (
                      <a href={`https://www.tipranks.com/stocks/${activeTicker.toLowerCase()}/forecast`} target="_blank" rel="noopener noreferrer" className="text-indigo-650 hover:underline">
                        {`https://www.tipranks.com/stocks/${activeTicker.toLowerCase()}/forecast`}
                      </a>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-slate-500 text-xs font-medium block">Current Price</span>
                    <span className="text-2xl font-black text-slate-900">${activeData.currentPrice?.toFixed(2) || 'N/A'}</span>
                  </div>
                  <div className="h-8 w-px bg-slate-200" />
                  <div className="text-right">
                    <span className="text-slate-500 text-xs font-medium block">Average Target</span>
                    <span className="text-2xl font-black text-indigo-600">${activeData.consensusPriceTarget?.toFixed(2) || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Tabs Navigation for Analyst Ratings Source */}
              <div className="flex border-b border-slate-200 mt-6">
                <button
                  type="button"
                  onClick={() => setActiveSourceTab('marketbeat')}
                  className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
                    activeSourceTab === 'marketbeat'
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  MarketBeat Ratings
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSourceTab('benzinga')}
                  className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
                    activeSourceTab === 'benzinga'
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Benzinga Ratings
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSourceTab('tipranks')}
                  className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
                    activeSourceTab === 'tipranks'
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  TipRanks Ratings
                </button>
              </div>

              {activeSourceTab === 'marketbeat' ? (
                /* Analyst Ratings History (MarketBeat) */
                <div className="flex flex-col gap-3 mt-4 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                      MarketBeat Ratings History
                    </span>
                    <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      Showing {filteredRatings.length} of {analystRatings.length} ratings
                    </span>
                  </div>

                  {/* Filter Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-100/50 p-3 rounded-xl border border-slate-200">
                    {/* Search Input */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Filter by Brokerage or Analyst..."
                        value={analystSearch}
                        onChange={(e) => setAnalystSearch(e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-800 text-xs outline-none transition placeholder-slate-400"
                      />
                    </div>

                    {/* Action Filter */}
                    <div>
                      <select
                        value={analystActionFilter}
                        onChange={(e) => setAnalystActionFilter(e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-700 text-xs outline-none transition cursor-pointer"
                      >
                        <option value="All">All Actions</option>
                        {uniqueActions.filter(a => a !== 'All').map(action => (
                          <option key={action} value={action}>{action}</option>
                        ))}
                      </select>
                    </div>

                    {/* Rating Filter */}
                    <div>
                      <select
                        value={analystRatingFilter}
                        onChange={(e) => setAnalystRatingFilter(e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-700 text-xs outline-none transition cursor-pointer"
                      >
                        <option value="All">All Ratings</option>
                        {uniqueRatings.filter(r => r !== 'All').map(rating => (
                          <option key={rating} value={rating}>{rating}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Table View */}
                  {filteredRatings.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-xs text-left text-slate-650">
                        <thead className="text-[10px] uppercase bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                          <tr>
                            <th 
                              scope="col" 
                              className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100/80 transition"
                              onClick={() => handleSort('date')}
                            >
                              <div className="flex items-center gap-1">
                                <span>Date</span>
                                {analystSortField === 'date' ? (
                                  analystSortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5 text-indigo-650" /> : <ChevronDown className="h-3.5 w-3.5 text-indigo-650" />
                                ) : (
                                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                )}
                              </div>
                            </th>
                            <th scope="col" className="px-4 py-3">Brokerage</th>
                            <th scope="col" className="px-4 py-3">Analyst</th>
                            <th scope="col" className="px-4 py-3">Action</th>
                            <th scope="col" className="px-4 py-3">Rating</th>
                            <th 
                              scope="col" 
                              className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100/80 transition text-right"
                              onClick={() => handleSort('priceTarget')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                <span>Price Target</span>
                                {analystSortField === 'priceTarget' ? (
                                  analystSortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5 text-indigo-650" /> : <ChevronDown className="h-3.5 w-3.5 text-indigo-650" />
                                ) : (
                                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                )}
                              </div>
                            </th>
                            <th scope="col" className="px-4 py-3 text-right">Current Upside</th>
                            <th scope="col" className="px-4 py-3 text-right">Upside / Downside (Scraped)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {sortedRatings.map((row, idx) => {
                            // Determine action color / styling
                            const act = (row.action || '').toLowerCase();
                            let actionBadgeClass = 'border-slate-200 text-slate-650 bg-slate-50';
                            if (act.includes('upgrade')) {
                              actionBadgeClass = 'border-emerald-250/60 text-emerald-700 bg-emerald-50';
                            } else if (act.includes('downgrade')) {
                              actionBadgeClass = 'border-red-250/60 text-red-700 bg-red-50';
                            } else if (act.includes('initiated')) {
                              actionBadgeClass = 'border-blue-250/60 text-blue-700 bg-blue-50';
                            } else if (act.includes('boost') || act.includes('raise')) {
                              actionBadgeClass = 'border-sky-250/60 text-sky-700 bg-sky-50';
                            } else if (act.includes('lower') || act.includes('reduce')) {
                              actionBadgeClass = 'border-amber-250/60 text-amber-700 bg-amber-50';
                            }

                            // Determine rating color / styling
                            const rat = (row.rating || '').toLowerCase();
                            let ratingBadgeClass = 'border-slate-200 text-slate-650 bg-slate-50';
                            if (rat.includes('buy') || rat.includes('outperform') || rat.includes('overweight')) {
                              ratingBadgeClass = 'border-emerald-250/60 text-emerald-700 bg-emerald-50';
                            } else if (rat.includes('sell') || rat.includes('underperform') || rat.includes('underweight')) {
                              ratingBadgeClass = 'border-red-250/60 text-red-700 bg-red-50';
                            } else if (rat.includes('hold') || rat.includes('neutral') || rat.includes('equal weight') || rat.includes('market perform')) {
                              ratingBadgeClass = 'border-amber-250/60 text-amber-700 bg-amber-50';
                            }

                            // Determine upside / downside color
                            const upDn = (row.upsideDownside || '').toLowerCase();
                            const isUp = upDn.includes('upside') && !upDn.includes('-');
                            const isDn = upDn.includes('downside') || upDn.includes('-');
                            const upDnClass = isUp ? 'text-emerald-600 font-bold' : isDn ? 'text-red-600 font-bold' : 'text-slate-500';

                            // Price target movement direction coloring
                            const targetDir = checkTargetDirection(row.priceTarget);
                            let targetColorClass = 'text-slate-700 font-semibold';
                            if (targetDir === 'up') {
                              targetColorClass = 'text-emerald-600 font-bold';
                            } else if (targetDir === 'down') {
                              targetColorClass = 'text-red-600 font-bold';
                            }

                            // Calculate upside/downside compared to current price
                            const targetVal = parsePriceTargetValue(row.priceTarget);
                            const currentPrice = activeData?.currentPrice;
                            let currentUpsidePct = null;
                            if (targetVal !== null && currentPrice !== null && currentPrice > 0) {
                              currentUpsidePct = ((targetVal - currentPrice) / currentPrice) * 100;
                            }

                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 transition">
                                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.date}</td>
                                <td className="px-4 py-3 font-semibold text-slate-800">{row.brokerage}</td>
                                <td className="px-4 py-3 text-slate-600">{row.analyst || <span className="text-slate-400 italic">Unknown</span>}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${actionBadgeClass}`}>
                                    {row.action}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${ratingBadgeClass}`}>
                                    {row.rating}
                                  </span>
                                </td>
                                <td className={`px-4 py-3 text-right whitespace-nowrap ${targetColorClass}`}>
                                  {row.priceTarget || 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap font-medium">
                                  {currentUpsidePct !== null ? (
                                    <span className={currentUpsidePct >= 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                                      {currentUpsidePct >= 0 ? '+' : ''}{currentUpsidePct.toFixed(2)}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">N/A</span>
                                  )}
                                </td>
                                <td className={`px-4 py-3 text-right whitespace-nowrap ${upDnClass}`}>
                                  {row.upsideDownside}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl bg-white">
                      No analyst ratings match your filter criteria.
                    </div>
                  )}
                </div>
              ) : activeSourceTab === 'benzinga' ? (
                /* Benzinga Analyst Ratings */
                <div className="flex flex-col gap-3 mt-4 animate-fade-in">
                  {activeBenzingaLoading && !activeBenzingaData ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <Loader2 className="h-10 w-10 animate-spin text-indigo-650" />
                      <p className="text-slate-500 text-sm font-medium">Fetching Benzinga ratings for {activeTicker}...</p>
                    </div>
                  ) : activeBenzingaError && !activeBenzingaData ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                      <AlertCircle className="h-12 w-12 text-red-500" />
                      <h3 className="text-lg font-bold text-slate-800">Error Loading Benzinga Ratings</h3>
                      <p className="text-slate-500 text-sm max-w-md">{activeBenzingaError}</p>
                    </div>
                  ) : activeBenzingaData ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                          Benzinga Ratings History
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Showing {filteredBenzingaRatings.length} of {benzingaRatings.length} ratings
                        </span>
                      </div>

                      {/* Filter Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-100/50 p-3 rounded-xl border border-slate-200">
                        {/* Search Input */}
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Filter by Analyst Firm..."
                            value={benzingaSearch}
                            onChange={(e) => setBenzingaSearch(e.target.value)}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-800 text-xs outline-none transition placeholder-slate-400"
                          />
                        </div>

                        {/* Action Filter */}
                        <div>
                          <select
                            value={benzingaActionFilter}
                            onChange={(e) => setBenzingaActionFilter(e.target.value)}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-700 text-xs outline-none transition cursor-pointer"
                          >
                            <option value="All">All Actions</option>
                            {uniqueBenzingaActions.filter(a => a !== 'All').map(action => (
                              <option key={action} value={action}>{action}</option>
                            ))}
                          </select>
                        </div>

                        {/* Rating Filter */}
                        <div>
                          <select
                            value={benzingaRatingFilter}
                            onChange={(e) => setBenzingaRatingFilter(e.target.value)}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-700 text-xs outline-none transition cursor-pointer"
                          >
                            <option value="All">All Ratings</option>
                            {uniqueBenzingaRatings.filter(r => r !== 'All').map(rating => (
                              <option key={rating} value={rating}>{rating}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Table View */}
                      {filteredBenzingaRatings.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-xs text-left text-slate-650">
                            <thead className="text-[10px] uppercase bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                              <tr>
                                <th 
                                  scope="col" 
                                  className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100/80 transition"
                                  onClick={() => handleBenzingaSort('date')}
                                >
                                  <div className="flex items-center gap-1">
                                    <span>Date</span>
                                    {benzingaSortField === 'date' ? (
                                      benzingaSortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5 text-indigo-650" /> : <ChevronDown className="h-3.5 w-3.5 text-indigo-650" />
                                    ) : (
                                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                    )}
                                  </div>
                                </th>
                                <th scope="col" className="px-4 py-3">Analyst Firm</th>
                                <th scope="col" className="px-4 py-3">Action</th>
                                <th scope="col" className="px-4 py-3">Rating</th>
                                <th 
                                  scope="col" 
                                  className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100/80 transition text-right"
                                  onClick={() => handleBenzingaSort('priceTarget')}
                                >
                                  <div className="flex items-center justify-end gap-1">
                                    <span>Price Target</span>
                                    {benzingaSortField === 'priceTarget' ? (
                                      benzingaSortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5 text-indigo-650" /> : <ChevronDown className="h-3.5 w-3.5 text-indigo-650" />
                                    ) : (
                                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                    )}
                                  </div>
                                </th>
                                <th scope="col" className="px-4 py-3 text-right">Current Upside</th>
                                <th scope="col" className="px-4 py-3 text-right">Upside / Downside (Scraped)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {sortedBenzingaRatings.map((row, idx) => {
                                // Determine action color / styling
                                const act = (row.action || '').toLowerCase();
                                let actionBadgeClass = 'border-slate-200 text-slate-655 bg-slate-50';
                                if (act.includes('upgrade')) {
                                  actionBadgeClass = 'border-emerald-250/60 text-emerald-700 bg-emerald-50';
                                } else if (act.includes('downgrade')) {
                                  actionBadgeClass = 'border-red-250/60 text-red-700 bg-red-50';
                                } else if (act.includes('initiated') || act.includes('initiate')) {
                                  actionBadgeClass = 'border-blue-250/60 text-blue-700 bg-blue-50';
                                } else if (act.includes('boost') || act.includes('raise')) {
                                  actionBadgeClass = 'border-sky-250/60 text-sky-700 bg-sky-50';
                                } else if (act.includes('lower') || act.includes('reduce')) {
                                  actionBadgeClass = 'border-amber-250/60 text-amber-700 bg-amber-50';
                                }

                                // Determine rating color / styling
                                const rat = (row.rating || '').toLowerCase();
                                let ratingBadgeClass = 'border-slate-200 text-slate-650 bg-slate-50';
                                if (rat.includes('buy') || rat.includes('outperform') || rat.includes('overweight')) {
                                  ratingBadgeClass = 'border-emerald-250/60 text-emerald-700 bg-emerald-50';
                                } else if (rat.includes('sell') || rat.includes('underperform') || rat.includes('underweight')) {
                                  ratingBadgeClass = 'border-red-250/60 text-red-700 bg-red-50';
                                } else if (rat.includes('hold') || rat.includes('neutral') || rat.includes('equal') || rat.includes('perform')) {
                                  ratingBadgeClass = 'border-amber-250/60 text-amber-700 bg-amber-50';
                                }

                                // Determine upside / downside color
                                const upDn = (row.upsideDownside || '').toLowerCase();
                                const isUp = !upDn.includes('-') && upDn !== '—' && upDn !== '';
                                const isDn = upDn.includes('-');
                                const upDnClass = isUp ? 'text-emerald-600 font-bold' : isDn ? 'text-red-600 font-bold' : 'text-slate-500';

                                // Price target movement direction coloring
                                const targetDir = checkTargetDirection(row.priceTarget);
                                let targetColorClass = 'text-slate-700 font-semibold';
                                if (targetDir === 'up') {
                                  targetColorClass = 'text-emerald-600 font-bold';
                                } else if (targetDir === 'down') {
                                  targetColorClass = 'text-red-600 font-bold';
                                }

                                // Calculate upside/downside compared to current price
                                const targetVal = parsePriceTargetValue(row.priceTarget);
                                const currentPrice = activeData?.currentPrice;
                                let currentUpsidePct = null;
                                if (targetVal !== null && currentPrice !== null && currentPrice > 0) {
                                  currentUpsidePct = ((targetVal - currentPrice) / currentPrice) * 100;
                                }

                                return (
                                  <tr key={idx} className="hover:bg-slate-50/50 transition">
                                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.date}</td>
                                    <td className="px-4 py-3 font-semibold text-slate-800">{row.analystFirm}</td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${actionBadgeClass}`}>
                                        {row.action}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${ratingBadgeClass}`}>
                                        {row.rating}
                                      </span>
                                    </td>
                                    <td className={`px-4 py-3 text-right whitespace-nowrap ${targetColorClass}`}>
                                      {row.priceTarget || 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap font-medium">
                                      {currentUpsidePct !== null ? (
                                        <span className={currentUpsidePct >= 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                                          {currentUpsidePct >= 0 ? '+' : ''}{currentUpsidePct.toFixed(2)}%
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">N/A</span>
                                      )}
                                    </td>
                                    <td className={`px-4 py-3 text-right whitespace-nowrap ${upDnClass}`}>
                                      {row.upsideDownside}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl bg-white">
                          No analyst ratings match your filter criteria.
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl bg-white">
                      No Benzinga ratings loaded for this ticker.
                    </div>
                  )}
                </div>
              ) : (
                /* TipRanks Analyst Ratings */
                <div className="flex flex-col gap-3 mt-4 animate-fade-in">
                  {activeTipranksLoading && !activeTipranksData ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <Loader2 className="h-10 w-10 animate-spin text-indigo-650" />
                      <p className="text-slate-500 text-sm font-medium">Fetching TipRanks ratings for {activeTicker}...</p>
                    </div>
                  ) : activeTipranksError && !activeTipranksData ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                      <AlertCircle className="h-12 w-12 text-red-500" />
                      <h3 className="text-lg font-bold text-slate-800">Error Loading TipRanks Ratings</h3>
                      <p className="text-slate-500 text-sm max-w-md">{activeTipranksError}</p>
                    </div>
                  ) : activeTipranksData ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                          TipRanks Ratings History
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Showing {filteredTipranksRatings.length} of {tipranksRatings.length} ratings
                        </span>
                      </div>

                      {/* Filter Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-100/50 p-3 rounded-xl border border-slate-200">
                        {/* Search Input */}
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Filter by Analyst / Firm..."
                            value={tipranksSearch}
                            onChange={(e) => setTipranksSearch(e.target.value)}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-800 text-xs outline-none transition placeholder-slate-400"
                          />
                        </div>

                        {/* Action Filter */}
                        <div>
                          <select
                            value={tipranksActionFilter}
                            onChange={(e) => setTipranksActionFilter(e.target.value)}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-700 text-xs outline-none transition cursor-pointer"
                          >
                            <option value="All">All Actions</option>
                            {uniqueTipranksActions.filter(a => a !== 'All').map(action => (
                              <option key={action} value={action}>{action}</option>
                            ))}
                          </select>
                        </div>

                        {/* Rating Filter */}
                        <div>
                          <select
                            value={tipranksRatingFilter}
                            onChange={(e) => setTipranksRatingFilter(e.target.value)}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-700 text-xs outline-none transition cursor-pointer"
                          >
                            <option value="All">All Ratings</option>
                            {uniqueTipranksRatings.filter(r => r !== 'All').map(rating => (
                              <option key={rating} value={rating}>{rating}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Table View */}
                      {filteredTipranksRatings.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-xs text-left text-slate-650">
                            <thead className="text-[10px] uppercase bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                              <tr>
                                <th 
                                  scope="col" 
                                  className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100/80 transition"
                                  onClick={() => handleTipranksSort('date')}
                                >
                                  <div className="flex items-center gap-1">
                                    <span>Date</span>
                                    {tipranksSortField === 'date' ? (
                                      tipranksSortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5 text-indigo-650" /> : <ChevronDown className="h-3.5 w-3.5 text-indigo-650" />
                                    ) : (
                                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                    )}
                                  </div>
                                </th>
                                <th scope="col" className="px-4 py-3">Brokerage / Firm</th>
                                <th scope="col" className="px-4 py-3">Analyst</th>
                                <th scope="col" className="px-4 py-3">Action</th>
                                <th scope="col" className="px-4 py-3">Rating</th>
                                <th 
                                  scope="col" 
                                  className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100/80 transition text-right"
                                  onClick={() => handleTipranksSort('priceTarget')}
                                >
                                  <div className="flex items-center justify-end gap-1">
                                    <span>Price Target</span>
                                    {tipranksSortField === 'priceTarget' ? (
                                      tipranksSortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5 text-indigo-650" /> : <ChevronDown className="h-3.5 w-3.5 text-indigo-650" />
                                    ) : (
                                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                    )}
                                  </div>
                                </th>
                                <th scope="col" className="px-4 py-3 text-right">Current Upside</th>
                                <th scope="col" className="px-4 py-3 text-right">Upside / Downside (Scraped)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {sortedTipranksRatings.map((row, idx) => {
                                // Determine action color / styling
                                const act = (row.action || '').toLowerCase();
                                let actionBadgeClass = 'border-slate-200 text-slate-655 bg-slate-50';
                                if (act.includes('upgrade')) {
                                  actionBadgeClass = 'border-emerald-250/60 text-emerald-705 bg-emerald-50';
                                } else if (act.includes('downgrade')) {
                                  actionBadgeClass = 'border-red-250/60 text-red-700 bg-red-50';
                                } else if (act.includes('initiated') || act.includes('initiate') || act.includes('assigned')) {
                                  actionBadgeClass = 'border-blue-250/60 text-blue-700 bg-blue-50';
                                } else if (act.includes('boost') || act.includes('raise') || act.includes('upgraded')) {
                                  actionBadgeClass = 'border-sky-250/60 text-sky-700 bg-sky-50';
                                } else if (act.includes('lower') || act.includes('reduce') || act.includes('downgraded')) {
                                  actionBadgeClass = 'border-amber-250/60 text-amber-700 bg-amber-50';
                                }

                                // Determine rating color / styling
                                const rat = (row.rating || '').toLowerCase();
                                let ratingBadgeClass = 'border-slate-200 text-slate-650 bg-slate-50';
                                if (rat.includes('buy') || rat.includes('outperform') || rat.includes('overweight')) {
                                  ratingBadgeClass = 'border-emerald-250/60 text-emerald-700 bg-emerald-50';
                                } else if (rat.includes('sell') || rat.includes('underperform') || rat.includes('underweight')) {
                                  ratingBadgeClass = 'border-red-250/60 text-red-700 bg-red-50';
                                } else if (rat.includes('hold') || rat.includes('neutral') || rat.includes('equal') || rat.includes('perform')) {
                                  ratingBadgeClass = 'border-amber-250/60 text-amber-700 bg-amber-50';
                                }

                                // Determine upside / downside color
                                const upDn = (row.upsideDownside || '').toLowerCase();
                                const isUp = upDn.includes('upside') && !upDn.includes('-');
                                const isDn = upDn.includes('downside') || upDn.includes('-');
                                const upDnClass = isUp ? 'text-emerald-600 font-bold' : isDn ? 'text-red-600 font-bold' : 'text-slate-500';

                                // Price target movement direction coloring
                                const targetDir = checkTargetDirection(row.priceTarget);
                                let targetColorClass = 'text-slate-700 font-semibold';
                                if (targetDir === 'up') {
                                  targetColorClass = 'text-emerald-600 font-bold';
                                } else if (targetDir === 'down') {
                                  targetColorClass = 'text-red-600 font-bold';
                                }

                                // Calculate upside/downside compared to current price
                                const targetVal = parsePriceTargetValue(row.priceTarget);
                                const currentPrice = activeData?.currentPrice;
                                let currentUpsidePct = null;
                                if (targetVal !== null && currentPrice !== null && currentPrice > 0) {
                                  currentUpsidePct = ((targetVal - currentPrice) / currentPrice) * 100;
                                }

                                return (
                                  <tr key={idx} className="hover:bg-slate-50/50 transition">
                                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.date}</td>
                                    <td className="px-4 py-3 font-semibold text-slate-800">{row.analystFirm}</td>
                                    <td className="px-4 py-3 text-slate-600">{row.analyst || <span className="text-slate-400 italic">Unknown</span>}</td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${actionBadgeClass}`}>
                                        {row.action}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${ratingBadgeClass}`}>
                                        {row.rating}
                                      </span>
                                    </td>
                                    <td className={`px-4 py-3 text-right whitespace-nowrap ${targetColorClass}`}>
                                      {row.priceTarget || 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap font-medium">
                                      {currentUpsidePct !== null ? (
                                        <span className={currentUpsidePct >= 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                                          {currentUpsidePct >= 0 ? '+' : ''}{currentUpsidePct.toFixed(2)}%
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">N/A</span>
                                      )}
                                    </td>
                                    <td className={`px-4 py-3 text-right whitespace-nowrap ${upDnClass}`}>
                                      {row.upsideDownside}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl bg-white">
                          No analyst ratings match your filter criteria.
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl bg-white">
                      No TipRanks ratings loaded for this ticker.
                    </div>
                  )}
                </div>
              )}
              {/* Grid: Speedometer Gauge, Price Slider, Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
                
                {/* Visual Gauges Section (4 Columns) */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  
                  {/* Consensus Speedometer Gauge */}
                  <div className="glass-panel p-6 border-slate-200 bg-slate-50/50 flex flex-col items-center text-center gap-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 self-start">Consensus Rating</h3>
                    
                    {/* SVG Speedometer */}
                    <div className="relative w-48 h-28 flex items-center justify-center">
                      <svg width="190" height="110" className="overflow-visible">
                        <defs>
                          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#EF4444" /> {/* Red */}
                            <stop offset="35%" stopColor="#F59E0B" /> {/* Amber */}
                            <stop offset="70%" stopColor="#10B981" /> {/* Emerald */}
                            <stop offset="100%" stopColor="#059669" /> {/* Strong Green */}
                          </linearGradient>
                        </defs>
                        {/* Background Arch */}
                        <path 
                          d="M 15 95 A 80 80 0 0 1 175 95" 
                          fill="none" 
                          stroke="#e2e8f0" 
                          strokeWidth="12" 
                          strokeLinecap="round"
                        />
                        {/* Colored Gauge Arch */}
                        <path 
                          d="M 15 95 A 80 80 0 0 1 175 95" 
                          fill="none" 
                          stroke="url(#gaugeGradient)" 
                          strokeWidth="12" 
                          strokeLinecap="round"
                          opacity="0.85"
                        />
                        {/* Pointer Needle */}
                        <g 
                          className="gauge-pointer" 
                          style={{ 
                            transformOrigin: '95px 95px',
                            transform: `rotate(${getGaugeRotation(activeData.consensusRating)}deg)`,
                            '--target-rotation': `${getGaugeRotation(activeData.consensusRating)}deg`
                          }}
                        >
                          <line 
                            x1="95" y1="95" 
                            x2="95" y2="20" 
                            stroke="#0f172a" 
                            strokeWidth="3.5" 
                            strokeLinecap="round" 
                          />
                          <circle cx="95" cy="95" r="7" fill="#0f172a" />
                        </g>
                      </svg>
                      
                      {/* Rating text overlay in bottom center */}
                      <div className="absolute bottom-0 text-center">
                        <div className="text-xl font-black text-slate-900">{activeData.consensusRating}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">Based on {activeData.ratingsCount} ratings</div>
                      </div>
                    </div>

                    {/* Buy / Hold / Sell distribution bars */}
                    <div className="w-full flex flex-col gap-2.5 mt-2 text-xs">
                      {/* Buy */}
                      <div className="flex items-center gap-3">
                        <span className="w-10 text-left font-medium text-slate-500">Buy</span>
                        <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                            style={{ width: `${activeData.ratingsCount > 0 ? (activeData.buys / activeData.ratingsCount) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="w-6 text-right font-bold text-emerald-600">{activeData.buys}</span>
                      </div>
                      {/* Hold */}
                      <div className="flex items-center gap-3">
                        <span className="w-10 text-left font-medium text-slate-500">Hold</span>
                        <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-amber-500 rounded-full transition-all duration-1000" 
                            style={{ width: `${activeData.ratingsCount > 0 ? (activeData.holds / activeData.ratingsCount) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="w-6 text-right font-bold text-amber-600">{activeData.holds}</span>
                      </div>
                      {/* Sell */}
                      <div className="flex items-center gap-3">
                        <span className="w-10 text-left font-medium text-slate-500">Sell</span>
                        <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-red-500 rounded-full transition-all duration-1000" 
                            style={{ width: `${activeData.ratingsCount > 0 ? (activeData.sells / activeData.ratingsCount) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="w-6 text-right font-bold text-red-600">{activeData.sells}</span>
                      </div>
                    </div>
                  </div>

                  {/* Price Target Range Visual Slider */}
                  <div className="glass-panel p-6 border-slate-200 bg-slate-50/50 flex flex-col gap-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Price Target Range</h3>
                    
                    {activeData.lowPriceTarget && activeData.highPriceTarget ? (
                      <div className="flex flex-col gap-4 py-2">
                        {/* Visual target bar */}
                        <div className="relative pt-6 pb-2">
                          {/* Low, Mid, High bar line */}
                          <div className="h-2 w-full bg-slate-200 rounded-full relative">
                            {/* Gradient color within range */}
                            <div className="absolute h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full left-0 right-0" />
                            
                            {/* Current Price Marker */}
                            {(() => {
                              const low = activeData.lowPriceTarget;
                              const high = activeData.highPriceTarget;
                              const current = activeData.currentPrice;
                              if (!current) return null;
                              
                              // Calculate position as percentage (clamp between 0 and 100)
                              let pct = ((current - low) / (high - low)) * 100;
                              pct = Math.max(0, Math.min(100, pct));
                              
                              return (
                                <div 
                                  className="absolute -top-1.5 h-5 w-5 bg-white border-2 border-indigo-600 rounded-full -translate-x-1/2 flex items-center justify-center shadow-lg group cursor-pointer"
                                  style={{ left: `${pct}%` }}
                                >
                                  <div className="absolute -top-8 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-black text-white shadow-xl whitespace-nowrap">
                                    Current: ${current.toFixed(2)}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Average Target Marker */}
                            {(() => {
                              const low = activeData.lowPriceTarget;
                              const high = activeData.highPriceTarget;
                              const target = activeData.consensusPriceTarget;
                              if (!target) return null;
                              
                              let pct = ((target - low) / (high - low)) * 100;
                              pct = Math.max(0, Math.min(100, pct));
                              
                              return (
                                <div 
                                  className="absolute top-1/2 h-4 w-1 bg-yellow-500 -translate-y-1/2 -translate-x-1/2"
                                  style={{ left: `${pct}%` }}
                                >
                                  <div className="absolute -bottom-8 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-bold text-yellow-400 shadow-xl -translate-x-1/2 whitespace-nowrap">
                                    Consensus: ${target.toFixed(2)}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Extremes labeling */}
                        <div className="flex justify-between items-center text-xs text-slate-500 mt-2 font-medium">
                          <div>
                            <span className="block text-[10px] text-slate-500 uppercase tracking-widest">Low Target</span>
                            <span className="text-slate-800 font-bold">${activeData.lowPriceTarget.toFixed(2)}</span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[10px] text-slate-500 uppercase tracking-widest">High Target</span>
                            <span className="text-slate-800 font-bold">${activeData.highPriceTarget.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Upside percentage alert */}
                        <div className="mt-2 text-xs flex items-center justify-between border-t border-slate-200 pt-3">
                          <span className="text-slate-500">Target Upside/Downside:</span>
                          <span className={`font-black flex items-center gap-1 ${activeData.upsideDownsideValue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {activeData.upsideDownsideValue >= 0 ? '+' : ''}{activeData.upsideDownsideValue?.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-slate-500 text-sm">
                        Price target range information is unavailable.
                      </div>
                    )}
                  </div>

                </div>

                {/* Historical Price Chart (7 Columns) */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                  <div className="glass-panel p-6 border-slate-200 bg-slate-50/50 h-full flex flex-col justify-between gap-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-indigo-650" />
                        Historical Share Price (1-Year)
                      </h3>
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Parsed from MarketBeat</span>
                    </div>

                    {activeData.historicalPrices && activeData.historicalPrices.length > 0 ? (
                      <div className="h-72 w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart 
                            data={activeData.historicalPrices}
                            margin={{ top: 10, right: 5, left: -20, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis 
                              dataKey="date" 
                              stroke="#94a3b8" 
                              fontSize={10}
                              tickLine={false}
                              tickFormatter={(dateStr) => {
                                // Shorten dates for ticks, e.g. "05/18/25" -> "May 25"
                                try {
                                  const date = new Date(dateStr);
                                  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                                } catch (e) {
                                  return dateStr;
                                }
                              }}
                            />
                            <YAxis 
                              stroke="#94a3b8" 
                              fontSize={10} 
                              tickLine={false}
                              axisLine={false}
                              domain={['auto', 'auto']}
                              tickFormatter={(val) => `$${val}`}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#ffffff', 
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: '#0f172a'
                              }}
                              labelClassName="text-slate-500 font-medium"
                              formatter={(value) => [`$${parseFloat(value).toFixed(2)}`, 'Price']}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="price" 
                              stroke="#6366f1" 
                              strokeWidth={2}
                              fillOpacity={1} 
                              fill="url(#colorPrice)" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center py-20 text-center text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl">
                        No historical chart data available for this ticker.
                      </div>
                    )}
                  </div>
                </div>

              </div>


            </>
          ) : (
            <div className="py-20 text-center text-slate-500 text-sm">
              Select a ticker above to see detailed analyst breakdown.
            </div>
          )}
        </section>
      )}
      {/* Side-by-Side Comparison Table */}
      {tickersList.length > 0 && Object.keys(tickersData).length > 0 && (
        <section className="glass-panel p-6 border-slate-200 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-indigo-650" />
            Comparison Dashboard
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/20">
            <table className="w-full text-sm text-left text-slate-655">
              <thead className="text-xs uppercase bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-6 py-4">Ticker</th>
                  <th scope="col" className="px-6 py-4">Company Name</th>
                  <th scope="col" className="px-6 py-4 text-right">Current Price</th>
                  <th scope="col" className="px-6 py-4">Consensus Rating</th>
                  <th scope="col" className="px-6 py-4 text-right">Consensus Target</th>
                  <th scope="col" className="px-6 py-4 text-right">Upside/Downside</th>
                  <th scope="col" className="px-6 py-4 text-center">Buys / Holds / Sells</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {[...tickersList]
                  .sort((a, b) => {
                    if (dashboardSort === 'upside') {
                      const dataA = tickersData[a];
                      const dataB = tickersData[b];
                      const valA = dataA && dataA.upsideDownsideValue !== null ? dataA.upsideDownsideValue : -Infinity;
                      const valB = dataB && dataB.upsideDownsideValue !== null ? dataB.upsideDownsideValue : -Infinity;
                      return valB - valA;
                    } else if (dashboardSort === 'target') {
                      const dataA = tickersData[a];
                      const dataB = tickersData[b];
                      const valA = dataA && dataA.consensusPriceTarget !== null ? dataA.consensusPriceTarget : -Infinity;
                      const valB = dataB && dataB.consensusPriceTarget !== null ? dataB.consensusPriceTarget : -Infinity;
                      return valB - valA;
                    } else {
                      return a.localeCompare(b);
                    }
                  })
                  .map(ticker => {
                    const data = tickersData[ticker];
                    if (!data) return null;
                  
                  const isSelected = activeTicker === ticker;
                  const upsidePct = data.upsideDownsideValue;
                  const isUpside = upsidePct >= 0;

                  return (
                    <tr 
                      key={ticker} 
                      onClick={() => setActiveTicker(ticker)}
                      className={`hover:bg-slate-50 cursor-pointer transition ${
                        isSelected ? 'bg-indigo-50/50' : ''
                      }`}
                    >
                      <th className="px-6 py-4 font-bold text-slate-800 flex items-center gap-1.5">
                        {data.ticker}
                        {isSelected && <div className="h-1.5 w-1.5 bg-indigo-500 rounded-full" />}
                      </th>
                      <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{data.companyName}</td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900">
                        ${data.currentPrice?.toFixed(2) || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getRatingColorClass(data.consensusRating)}`}>
                          {data.consensusRating}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900">
                        ${data.consensusPriceTarget?.toFixed(2) || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {upsidePct !== null ? (
                          <span className={`font-bold flex items-center justify-end gap-1 ${isUpside ? 'text-emerald-600' : 'text-red-600'}`}>
                            {isUpside ? '+' : ''}{upsidePct.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center items-center gap-1">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">{data.buys}</span>
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs">{data.holds}</span>
                          <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-bold text-xs">{data.sells}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
        </>
      ) : (
        /* Consolidated Recent Target Modifications Section */
        <section className="glass-panel p-6 border-slate-200 flex flex-col gap-4 animate-fade-in">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Recent Price Target Modifications</h2>
              <p className="text-slate-500 text-xs mt-0.5">Consolidated feed of all target updates from MarketBeat and Benzinga.</p>
            </div>
            <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Showing {filteredModifications.length} of {allModifications.length} modifications
            </span>
          </div>

          {/* Filters Container */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-100/50 p-3 rounded-xl border border-slate-200">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by Brokerage or Analyst..."
                value={modificationsSearch}
                onChange={(e) => setModificationsSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-800 text-xs outline-none transition placeholder-slate-400"
              />
            </div>

            {/* Ticker Filter */}
            <div>
              <select
                value={modificationsTickerFilter}
                onChange={(e) => setModificationsTickerFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-700 text-xs outline-none transition cursor-pointer"
              >
                <option value="All">All Tickers</option>
                {tickersList.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Source Filter */}
            <div>
              <select
                value={modificationsSourceFilter}
                onChange={(e) => setModificationsSourceFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-700 text-xs outline-none transition cursor-pointer"
              >
                <option value="All">All Sources</option>
                <option value="MarketBeat">MarketBeat</option>
                <option value="Benzinga">Benzinga</option>
                <option value="TipRanks">TipRanks</option>
              </select>
            </div>
          </div>

          {/* Modifications Table */}
          {sortedModifications.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left text-slate-650">
                <thead className="text-[10px] uppercase bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th 
                      scope="col" 
                      className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100/80 transition"
                      onClick={() => handleModificationsSort('date')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Date</span>
                        {modificationsSortField === 'date' ? (
                          modificationsSortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5 text-indigo-650" /> : <ChevronDown className="h-3.5 w-3.5 text-indigo-650" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100/80 transition"
                      onClick={() => handleModificationsSort('ticker')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Ticker</span>
                        {modificationsSortField === 'ticker' ? (
                          modificationsSortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5 text-indigo-650" /> : <ChevronDown className="h-3.5 w-3.5 text-indigo-650" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th scope="col" className="px-4 py-3">Source</th>
                    <th scope="col" className="px-4 py-3">Firm / Analyst</th>
                    <th scope="col" className="px-4 py-3">Action</th>
                    <th scope="col" className="px-4 py-3">Rating</th>
                    <th 
                      scope="col" 
                      className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100/80 transition text-right"
                      onClick={() => handleModificationsSort('priceTarget')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Price Target</span>
                        {modificationsSortField === 'priceTarget' ? (
                          modificationsSortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5 text-indigo-650" /> : <ChevronDown className="h-3.5 w-3.5 text-indigo-650" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">Current Price</th>
                    <th scope="col" className="px-4 py-3 text-right">Current Upside</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {sortedModifications.map((row, idx) => {
                    const act = (row.action || '').toLowerCase();
                    let actionBadgeClass = 'border-slate-200 text-slate-655 bg-slate-50';
                    if (act.includes('upgrade')) actionBadgeClass = 'border-emerald-250/60 text-emerald-700 bg-emerald-50';
                    else if (act.includes('downgrade')) actionBadgeClass = 'border-red-250/60 text-red-700 bg-red-50';
                    else if (act.includes('initiated') || act.includes('initiate')) actionBadgeClass = 'border-blue-250/60 text-blue-700 bg-blue-50';
                    else if (act.includes('boost') || act.includes('raise')) actionBadgeClass = 'border-sky-250/60 text-sky-700 bg-sky-50';
                    else if (act.includes('lower') || act.includes('reduce')) actionBadgeClass = 'border-amber-250/60 text-amber-700 bg-amber-50';

                    const rat = (row.rating || '').toLowerCase();
                    let ratingBadgeClass = 'border-slate-200 text-slate-650 bg-slate-50';
                    if (rat.includes('buy') || rat.includes('outperform') || rat.includes('overweight')) ratingBadgeClass = 'border-emerald-250/60 text-emerald-700 bg-emerald-50';
                    else if (rat.includes('sell') || rat.includes('underperform') || rat.includes('underweight')) ratingBadgeClass = 'border-red-250/60 text-red-700 bg-red-50';
                    else if (rat.includes('hold') || rat.includes('neutral') || rat.includes('equal') || rat.includes('perform')) ratingBadgeClass = 'border-amber-250/60 text-amber-700 bg-amber-50';

                    const targetDir = checkTargetDirection(row.priceTarget);
                    let targetColorClass = 'text-slate-700 font-semibold';
                    if (targetDir === 'up') targetColorClass = 'text-emerald-600 font-bold';
                    else if (targetDir === 'down') targetColorClass = 'text-red-600 font-bold';

                    const currentPrice = tickersData[row.ticker]?.currentPrice;
                    const targetVal = parsePriceTargetValue(row.priceTarget);
                    let currentUpsidePct = null;
                    if (targetVal !== null && currentPrice !== null && currentPrice > 0) {
                      currentUpsidePct = ((targetVal - currentPrice) / currentPrice) * 100;
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.date}</td>
                        <td className="px-4 py-3 font-extrabold text-indigo-700">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTicker(row.ticker);
                              setActiveMainTab('dashboard');
                            }}
                            className="hover:underline cursor-pointer text-left font-extrabold"
                          >
                            {row.ticker}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {row.sources.map(src => {
                              let badgeColor = 'text-purple-700 bg-purple-50 border-purple-200';
                              if (src === 'MarketBeat') badgeColor = 'text-blue-700 bg-blue-50 border-blue-200';
                              else if (src === 'Benzinga') badgeColor = 'text-orange-700 bg-orange-50 border-orange-200';
                              return (
                                <span key={src} className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeColor}`}>
                                  {src}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-800">{row.firm}</span>
                          {row.analyst && <span className="text-slate-550 block text-[11px] font-normal">{row.analyst}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${actionBadgeClass}`}>
                            {row.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${ratingBadgeClass}`}>
                            {row.rating}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right whitespace-nowrap ${targetColorClass}`}>
                          {row.priceTarget || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {currentPrice ? `$${currentPrice.toFixed(2)}` : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap font-medium">
                          {currentUpsidePct !== null ? (
                            <span className={currentUpsidePct >= 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                              {currentUpsidePct >= 0 ? '+' : ''}{currentUpsidePct.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">N/A</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl bg-white">
              No modifications match your filter criteria or no data loaded yet.
            </div>
          )}
        </section>
      )}

      {/* Info Footer */}
      <footer className="mt-auto py-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2 border-t border-slate-200">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          <span>This tool extracts live data directly from MarketBeat pages. Caching is enabled for 5 minutes.</span>
        </div>
        <p>© 2026 Price Target Extractor Hub. Designed with premium glassmorphism aesthetics.</p>
      </footer>

      {/* Alert Modal Popup */}
      {alertsQueue.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl flex flex-col gap-5 animate-fade-in relative overflow-hidden">
            {/* Top corner gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 to-emerald-500" />
            
            {/* Close Button */}
            <button
              onClick={dismissAllAlerts}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-1 transition cursor-pointer"
              title="Dismiss All Alerts"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mt-2">
              <div className="bg-indigo-100 text-indigo-700 p-2.5 rounded-full">
                <BellRing className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black block">Alert ({alertsQueue.length} pending)</span>
                <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {alertsQueue.length > 1 ? "New Analyst Ratings Published" : "New Analyst Rating Published"}
                </h3>
              </div>
            </div>

            {/* Scrollable list of alerts */}
            <div className="max-h-[380px] overflow-y-auto pr-1.5 flex flex-col gap-3.5 scrollbar-thin">
              {alertsQueue.map((currentAlert) => {
                const targetDir = checkTargetDirection(currentAlert.priceTarget);
                let targetColorClass = 'text-slate-700 font-bold';
                if (targetDir === 'up') targetColorClass = 'text-emerald-600 font-extrabold';
                else if (targetDir === 'down') targetColorClass = 'text-red-600 font-extrabold';

                // Get badge color classes
                const act = (currentAlert.action || '').toLowerCase();
                let actionBadgeClass = 'border-slate-200 text-slate-600 bg-slate-50';
                if (act.includes('upgrade')) actionBadgeClass = 'border-emerald-200 text-emerald-700 bg-emerald-50';
                else if (act.includes('downgrade')) actionBadgeClass = 'border-red-200 text-red-700 bg-red-50';
                else if (act.includes('initiated') || act.includes('initiate')) actionBadgeClass = 'border-blue-200 text-blue-700 bg-blue-50';
                else if (act.includes('boost') || act.includes('raise')) actionBadgeClass = 'border-sky-200 text-sky-700 bg-sky-50';
                else if (act.includes('lower') || act.includes('reduce')) actionBadgeClass = 'border-amber-200 text-amber-700 bg-amber-50';

                const rat = (currentAlert.rating || '').toLowerCase();
                let ratingBadgeClass = 'border-slate-200 text-slate-600 bg-slate-50';
                if (rat.includes('buy') || rat.includes('outperform') || rat.includes('overweight')) ratingBadgeClass = 'border-emerald-200 text-emerald-700 bg-emerald-50';
                else if (rat.includes('sell') || rat.includes('underperform') || rat.includes('underweight')) ratingBadgeClass = 'border-red-200 text-red-700 bg-red-50';
                else if (rat.includes('hold') || rat.includes('neutral') || rat.includes('equal') || rat.includes('perform')) ratingBadgeClass = 'border-amber-200 text-amber-700 bg-amber-50';

                return (
                  <div 
                    key={currentAlert.id || `${currentAlert.ticker}-${currentAlert.firm}-${currentAlert.detectedAt}`} 
                    className="flex flex-col gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-150 text-left relative group/item"
                  >
                    {/* Individual alert close button */}
                    <button
                      onClick={() => dismissAlert(currentAlert.id)}
                      className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full p-1 transition cursor-pointer md:opacity-0 md:group-hover/item:opacity-100"
                      title="Dismiss this alert"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>

                    <div className="flex justify-between items-center pr-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-slate-900 tracking-tight">{currentAlert.ticker}</span>
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">{currentAlert.source}</span>
                      </div>
                      <span className="text-xs text-slate-500">{currentAlert.date}</span>
                    </div>

                    <div className="h-px bg-slate-200/60" />

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 font-medium block text-[10px]">Analyst Firm</span>
                        <span className="font-bold text-slate-800 text-[12px]">{currentAlert.firm}</span>
                        {currentAlert.analyst && <span className="text-slate-500 text-[10px] block">{currentAlert.analyst}</span>}
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 font-medium block text-[10px]">Action / Rating</span>
                        <div className="flex justify-end gap-1.5 mt-0.5">
                          {currentAlert.action && <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${actionBadgeClass}`}>{currentAlert.action}</span>}
                          {currentAlert.rating && <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${ratingBadgeClass}`}>{currentAlert.rating}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-slate-200/60" />

                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-slate-500 text-[10px] font-medium block">Price Target</span>
                        <span className={`text-base font-black tracking-tight ${targetColorClass}`}>{currentAlert.priceTarget}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 text-[10px] font-medium block">Upside vs. Current Price</span>
                        <span className="text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full text-xs font-bold inline-block mt-0.5">{currentAlert.upsideDownside}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Buttons */}
            <div className="flex justify-end items-center mt-2">
              <button
                type="button"
                onClick={dismissAllAlerts}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition cursor-pointer text-center"
              >
                Acknowledge {alertsQueue.length > 1 ? `All (${alertsQueue.length})` : 'Alert'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
