import { NextResponse } from 'next/server';
import { fetchAllEnergyStocks, ENERGY_STOCK_SYMBOLS } from '@/lib/finnhub';
import { getSupabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5 minutes

/**
 * GET /api/finance/stocks
 * 
 * Returns current stock prices for top energy companies.
 * Uses Finnhub API with caching in Supabase.
 */
export async function GET() {
  try {
    const supabase = getSupabase();
    
    // Check if we have recent cached data (less than 5 minutes old)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: cachedStocks, error: cacheError } = await supabase
      .from('stock_prices')
      .select('*')
      .gte('updated_at', fiveMinutesAgo);

    // If we have all stocks cached and fresh, return them
    if (!cacheError && cachedStocks && cachedStocks.length >= ENERGY_STOCK_SYMBOLS.length) {
      console.log('[stocks] Returning cached stock prices');
      return NextResponse.json({
        stocks: cachedStocks.map(s => ({
          symbol: s.symbol,
          companyName: s.company_name,
          currentPrice: s.current_price,
          change: s.change_amount,
          changePercent: s.change_percent,
        })),
        cached: true,
        updatedAt: cachedStocks[0]?.updated_at,
      });
    }

    // Fetch fresh data from Finnhub
    console.log('[stocks] Fetching fresh stock prices from Finnhub');
    const stocks = await fetchAllEnergyStocks();

    if (stocks.length === 0) {
      // Return placeholder data if API fails
      return NextResponse.json({
        stocks: ENERGY_STOCK_SYMBOLS.map((s, i) => ({
          symbol: s.symbol,
          companyName: s.name,
          currentPrice: 100 + Math.random() * 50,
          change: (Math.random() - 0.5) * 5,
          changePercent: (Math.random() - 0.5) * 3,
        })),
        cached: false,
        placeholder: true,
      });
    }

    // Cache the results in Supabase
    const now = new Date().toISOString();
    for (const stock of stocks) {
      await supabase
        .from('stock_prices')
        .upsert({
          symbol: stock.symbol,
          company_name: stock.companyName,
          current_price: stock.currentPrice,
          change_amount: stock.change,
          change_percent: stock.changePercent,
          market: 'US',
          updated_at: now,
        }, {
          onConflict: 'symbol',
        });
    }

    return NextResponse.json({
      stocks: stocks.map(s => ({
        symbol: s.symbol,
        companyName: s.companyName,
        currentPrice: s.currentPrice,
        change: s.change,
        changePercent: s.changePercent,
      })),
      cached: false,
      updatedAt: now,
    });
  } catch (error) {
    console.error('[stocks] Error:', error);
    
    // Return placeholder data on error
    return NextResponse.json({
      stocks: ENERGY_STOCK_SYMBOLS.map(s => ({
        symbol: s.symbol,
        companyName: s.name,
        currentPrice: 100 + Math.random() * 50,
        change: (Math.random() - 0.5) * 5,
        changePercent: (Math.random() - 0.5) * 3,
      })),
      error: 'Failed to fetch stock prices',
      placeholder: true,
    }, { status: 200 }); // Return 200 with placeholder data
  }
}

