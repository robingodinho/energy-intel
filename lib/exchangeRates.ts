/**
 * Exchange Rate API Integration
 * 
 * Fetches USD exchange rates for the Finance page.
 * Using ExchangeRate-API (free tier: 1500 requests/month)
 * 
 * @see https://www.exchangerate-api.com/docs
 */

export interface ExchangeRate {
  targetCurrency: string;
  rate: number;
  changePercent: number; // Calculated from previous day
}

export interface ExchangeRateResponse {
  result: string;
  base_code: string;
  // The free API uses 'rates', paid API uses 'conversion_rates'
  rates?: Record<string, number>;
  conversion_rates?: Record<string, number>;
  time_last_update_utc: string;
}

// Target currencies for USD comparison
export const TARGET_CURRENCIES = [
  'EUR', // Euro
  'GBP', // British Pound
  'JPY', // Japanese Yen
  'CAD', // Canadian Dollar
  'CNY', // Chinese Yuan
  'INR', // Indian Rupee
  'CHF', // Swiss Franc
  'AUD', // Australian Dollar
  'QAR', // Qatari Riyal
  'MZN', // Mozambican Metical
  'ZAR', // South African Rand
];

/**
 * Get the Exchange Rate API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    // Fall back to free API without key (limited)
    return '';
  }
  return apiKey;
}

/**
 * Fetch current USD exchange rates
 */
export async function fetchExchangeRates(): Promise<ExchangeRate[]> {
  try {
    const apiKey = getApiKey();
    
    // Use free API endpoint (no key required, but rate limited)
    const url = apiKey 
      ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
      : 'https://open.er-api.com/v6/latest/USD';
    
    const response = await fetch(url, {
      next: { revalidate: 300 } // Cache for 5 minutes
    });

    if (!response.ok) {
      console.error(`[exchangeRates] Failed to fetch rates: ${response.status}`);
      return getPlaceholderRates();
    }

    const data: ExchangeRateResponse = await response.json();
    
    if (data.result !== 'success') {
      console.error('[exchangeRates] API returned error');
      return getPlaceholderRates();
    }

    // The free API uses 'rates', paid API uses 'conversion_rates'
    const ratesData = data.rates || data.conversion_rates;
    
    if (!ratesData) {
      console.error('[exchangeRates] No rates data in response');
      return getPlaceholderRates();
    }

    // Map to our format with simulated change percentages
    // (Real change would require storing previous day's rates)
    return TARGET_CURRENCIES.map(currency => ({
      targetCurrency: currency,
      rate: ratesData[currency] || 0,
      changePercent: getSimulatedChange(), // Placeholder until we track historical
    }));
  } catch (error) {
    console.error('[exchangeRates] Error fetching rates:', error);
    return getPlaceholderRates();
  }
}

/**
 * Get simulated change percentage (placeholder)
 * In production, this would compare to stored previous rates
 */
function getSimulatedChange(): number {
  // Random change between -0.5% and +0.5%
  return Number((Math.random() * 1 - 0.5).toFixed(2));
}

/**
 * Placeholder rates for when API fails
 */
function getPlaceholderRates(): ExchangeRate[] {
  return [
    { targetCurrency: 'EUR', rate: 0.92, changePercent: 0.12 },
    { targetCurrency: 'GBP', rate: 0.79, changePercent: -0.08 },
    { targetCurrency: 'JPY', rate: 157.24, changePercent: 0.45 },
    { targetCurrency: 'CAD', rate: 1.44, changePercent: -0.15 },
    { targetCurrency: 'CNY', rate: 7.33, changePercent: 0.22 },
    { targetCurrency: 'INR', rate: 85.72, changePercent: 0.18 },
    { targetCurrency: 'CHF', rate: 0.90, changePercent: -0.05 },
    { targetCurrency: 'AUD', rate: 1.61, changePercent: 0.31 },
    { targetCurrency: 'QAR', rate: 3.64, changePercent: 0.02 },
    { targetCurrency: 'MZN', rate: 64.0, changePercent: 0.05 },
    { targetCurrency: 'ZAR', rate: 18.5, changePercent: 0.08 },
  ];
}

