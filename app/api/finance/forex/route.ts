import { NextResponse } from 'next/server';
import { fetchExchangeRates, TARGET_CURRENCIES } from '@/lib/exchangeRates';
import { getSupabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5 minutes

/**
 * GET /api/finance/forex
 * 
 * Returns current USD exchange rates.
 * Uses ExchangeRate-API with caching in Supabase.
 */
export async function GET() {
  try {
    const supabase = getSupabase();
    
    // Check if we have recent cached data (less than 5 minutes old)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: cachedRates, error: cacheError } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('base_currency', 'USD')
      .gte('updated_at', fiveMinutesAgo);

    // If we have all rates cached and fresh, return them
    if (!cacheError && cachedRates && cachedRates.length >= TARGET_CURRENCIES.length) {
      console.log('[forex] Returning cached exchange rates');
      return NextResponse.json({
        rates: cachedRates.map(r => ({
          pair: r.target_currency,
          rate: r.rate,
          change: r.change_percent,
        })),
        cached: true,
        updatedAt: cachedRates[0]?.updated_at,
      });
    }

    // Fetch fresh data from Exchange Rate API
    console.log('[forex] Fetching fresh exchange rates');
    const rates = await fetchExchangeRates();

    if (rates.length === 0) {
      return NextResponse.json({
        rates: [],
        error: 'Failed to fetch exchange rates',
      }, { status: 500 });
    }

    // Cache the results in Supabase
    const now = new Date().toISOString();
    for (const rate of rates) {
      await supabase
        .from('exchange_rates')
        .upsert({
          base_currency: 'USD',
          target_currency: rate.targetCurrency,
          rate: rate.rate,
          change_percent: rate.changePercent,
          updated_at: now,
        }, {
          onConflict: 'base_currency,target_currency',
        });
    }

    return NextResponse.json({
      rates: rates.map(r => ({
        pair: r.targetCurrency,
        rate: r.rate,
        change: r.changePercent,
      })),
      cached: false,
      updatedAt: now,
    });
  } catch (error) {
    console.error('[forex] Error:', error);
    return NextResponse.json({
      error: 'Failed to fetch exchange rates',
    }, { status: 500 });
  }
}

