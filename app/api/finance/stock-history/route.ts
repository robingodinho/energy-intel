import { NextResponse } from 'next/server';
import { ENERGY_STOCK_SYMBOLS } from '@/lib/finnhub';
import { getSupabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Cache duration: 6 hours
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000;

interface PricePoint {
  timestamp: number;
  price: number;
}

interface StockHistoryRecord {
  symbol: string;
  prices: PricePoint[];
  updated_at: string;
}

/**
 * Fetch historical data from Yahoo Finance (free, no API key needed)
 */
async function fetchYahooHistory(symbol: string): Promise<PricePoint[]> {
  try {
    // Yahoo Finance chart API - get 1 month of daily data
    const now = Math.floor(Date.now() / 1000);
    const oneMonthAgo = now - (30 * 24 * 60 * 60);
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${oneMonthAgo}&period2=${now}&interval=1d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`[yahoo] Failed to fetch ${symbol}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
      console.warn(`[yahoo] No data for ${symbol}`);
      return [];
    }

    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;

    // Convert to price points, filter out nulls
    const prices: PricePoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] !== null && closes[i] !== undefined) {
        prices.push({
          timestamp: timestamps[i],
          price: closes[i],
        });
      }
    }

    // Return last 12 points for mini chart
    return prices.slice(-12);
  } catch (error) {
    console.error(`[yahoo] Error fetching ${symbol}:`, error);
    return [];
  }
}

/**
 * Fetch historical data for all energy stocks
 */
async function fetchAllStockHistory(): Promise<Map<string, PricePoint[]>> {
  const historyMap = new Map<string, PricePoint[]>();
  
  for (const stock of ENERGY_STOCK_SYMBOLS) {
    const history = await fetchYahooHistory(stock.symbol);
    if (history.length > 0) {
      historyMap.set(stock.symbol, history);
    }
    // Small delay to be nice to the API
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  return historyMap;
}

/**
 * GET /api/finance/stock-history
 * 
 * Returns historical price data for energy stocks.
 * Data is cached in Supabase for 6 hours to minimize API calls.
 */
export async function GET() {
  try {
    const supabase = getSupabase();
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - CACHE_DURATION_MS).toISOString();
    
    // Check for cached data
    const { data: cachedData, error: cacheError } = await supabase
      .from('stock_price_history')
      .select('*')
      .gte('updated_at', sixHoursAgo);

    // If we have fresh cached data for all stocks, return it
    if (!cacheError && cachedData && cachedData.length >= ENERGY_STOCK_SYMBOLS.length) {
      console.log('[stock-history] Returning cached historical data');
      
      const historyMap: Record<string, PricePoint[]> = {};
      for (const record of cachedData as StockHistoryRecord[]) {
        historyMap[record.symbol] = record.prices;
      }
      
      return NextResponse.json({
        history: historyMap,
        cached: true,
        updatedAt: cachedData[0]?.updated_at,
      });
    }

    // Fetch fresh data from Yahoo Finance
    console.log('[stock-history] Fetching fresh historical data from Yahoo Finance');
    const historyData = await fetchAllStockHistory();
    
    if (historyData.size === 0) {
      // Return placeholder data if API fails
      console.warn('[stock-history] No data from Yahoo, returning placeholder');
      return NextResponse.json({
        history: generatePlaceholderHistory(),
        cached: false,
        placeholder: true,
      });
    }

    // Convert Map to object and cache in Supabase
    const historyMap: Record<string, PricePoint[]> = {};
    const upsertPromises: Promise<any>[] = [];
    
    for (const [symbol, prices] of historyData) {
      historyMap[symbol] = prices;
      
      // Upsert to cache
      upsertPromises.push(
        supabase
          .from('stock_price_history')
          .upsert({
            symbol,
            prices: prices,
            updated_at: now.toISOString(),
          }, {
            onConflict: 'symbol',
          })
      );
    }
    
    // Wait for all upserts
    await Promise.all(upsertPromises);
    console.log(`[stock-history] Cached ${historyData.size} stock histories`);

    return NextResponse.json({
      history: historyMap,
      cached: false,
      updatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('[stock-history] Error:', error);
    
    // Return placeholder data on error
    return NextResponse.json({
      history: generatePlaceholderHistory(),
      error: 'Failed to fetch stock history',
      placeholder: true,
    }, { status: 200 });
  }
}

/**
 * Generate placeholder history for when API fails
 */
function generatePlaceholderHistory(): Record<string, PricePoint[]> {
  const symbols = ['XOM', 'CVX', 'COP', 'EOG', 'SLB', 'OXY'];
  const basePrices: Record<string, number> = {
    XOM: 115, CVX: 155, COP: 95, EOG: 105, SLB: 43, OXY: 42
  };
  
  const history: Record<string, PricePoint[]> = {};
  const now = Math.floor(Date.now() / 1000);
  const dayInSeconds = 24 * 60 * 60;
  
  for (const symbol of symbols) {
    const basePrice = basePrices[symbol];
    const prices: PricePoint[] = [];
    
    for (let i = 11; i >= 0; i--) {
      const variance = (Math.random() - 0.5) * basePrice * 0.05; // ±2.5% variance
      prices.push({
        timestamp: now - (i * dayInSeconds),
        price: basePrice + variance,
      });
    }
    
    history[symbol] = prices;
  }
  
  return history;
}

