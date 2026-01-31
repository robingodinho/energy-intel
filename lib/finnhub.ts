/**
 * Finnhub API Integration
 * 
 * Provides stock quotes and financial news for the Finance page.
 * Free tier: 60 API calls/minute
 * 
 * @see https://finnhub.io/docs/api
 */

export interface StockQuote {
  symbol: string;
  companyName: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}

export interface FinnhubQuoteResponse {
  c: number;  // Current price
  d: number;  // Change
  dp: number; // Percent change
  h: number;  // High price of the day
  l: number;  // Low price of the day
  o: number;  // Open price of the day
  pc: number; // Previous close price
  t: number;  // Timestamp
}

export interface FinnhubNewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

// Top US Energy Companies
export const ENERGY_STOCK_SYMBOLS = [
  { symbol: 'XOM', name: 'ExxonMobil' },
  { symbol: 'CVX', name: 'Chevron' },
  { symbol: 'COP', name: 'ConocoPhillips' },
  { symbol: 'EOG', name: 'EOG Resources' },
  { symbol: 'SLB', name: 'Schlumberger' },
  { symbol: 'OXY', name: 'Occidental Petroleum' },
  { symbol: 'TTE', name: 'TotalEnergies' },
  { symbol: 'E', name: 'Eni' },
  { symbol: 'SSL', name: 'Sasol' },
  { symbol: 'SHEL', name: 'Shell' },
];

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

/**
 * Get the Finnhub API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    throw new Error('FINNHUB_API_KEY environment variable is not set');
  }
  return apiKey;
}

/**
 * Fetch a stock quote from Finnhub
 */
export async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const apiKey = getApiKey();
    const response = await fetch(
      `${FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${apiKey}`,
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );

    if (!response.ok) {
      console.error(`[finnhub] Failed to fetch quote for ${symbol}: ${response.status}`);
      return null;
    }

    const data: FinnhubQuoteResponse = await response.json();
    
    // Check if we got valid data (c=0 means no data/invalid symbol)
    if (data.c === 0 && data.d === 0) {
      console.warn(`[finnhub] No data returned for symbol ${symbol}`);
      return null;
    }

    const stockInfo = ENERGY_STOCK_SYMBOLS.find(s => s.symbol === symbol);
    
    return {
      symbol,
      companyName: stockInfo?.name || symbol,
      currentPrice: data.c,
      change: data.d,
      changePercent: data.dp,
      high: data.h,
      low: data.l,
      open: data.o,
      previousClose: data.pc,
    };
  } catch (error) {
    console.error(`[finnhub] Error fetching quote for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch quotes for all energy stocks
 */
export async function fetchAllEnergyStocks(): Promise<StockQuote[]> {
  const quotes: StockQuote[] = [];
  
  for (const stock of ENERGY_STOCK_SYMBOLS) {
    const quote = await fetchStockQuote(stock.symbol);
    if (quote) {
      quotes.push(quote);
    }
    // Small delay to respect rate limits (60/min = 1/sec)
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return quotes;
}

/**
 * Fetch market news from Finnhub
 * 
 * @param category - 'general', 'forex', 'crypto', 'merger'
 */
export async function fetchMarketNews(category: string = 'general'): Promise<FinnhubNewsItem[]> {
  try {
    const apiKey = getApiKey();
    const response = await fetch(
      `${FINNHUB_BASE_URL}/news?category=${category}&token=${apiKey}`,
      { next: { revalidate: 600 } } // Cache for 10 minutes
    );

    if (!response.ok) {
      console.error(`[finnhub] Failed to fetch news: ${response.status}`);
      return [];
    }

    const data: FinnhubNewsItem[] = await response.json();
    return data.slice(0, 20); // Return top 20 news items
  } catch (error) {
    console.error('[finnhub] Error fetching market news:', error);
    return [];
  }
}

/**
 * Fetch company-specific news from Finnhub
 */
export async function fetchCompanyNews(
  symbol: string,
  fromDate: string,
  toDate: string
): Promise<FinnhubNewsItem[]> {
  try {
    const apiKey = getApiKey();
    const response = await fetch(
      `${FINNHUB_BASE_URL}/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${apiKey}`,
      { next: { revalidate: 600 } }
    );

    if (!response.ok) {
      console.error(`[finnhub] Failed to fetch company news for ${symbol}: ${response.status}`);
      return [];
    }

    const data: FinnhubNewsItem[] = await response.json();
    return data.slice(0, 10);
  } catch (error) {
    console.error(`[finnhub] Error fetching company news for ${symbol}:`, error);
    return [];
  }
}

// Note: Historical price data (candles) requires Finnhub premium subscription.
// We use Yahoo Finance for chart data instead - see /api/finance/stock-history

