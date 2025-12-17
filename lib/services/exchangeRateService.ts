/**
 * External exchange rate service for fetching fiat currency rates
 * Used for tokens like BKES that require external rate data
 */

interface ExchangeRateResponse {
  result: string;
  provider: string;
  documentation: string;
  terms_of_use: string;
  time_last_update_unix: number;
  time_last_update_utc: string;
  time_next_update_unix: number;
  time_next_update_utc: string;
  time_eol_unix: number;
  base_code: string;
  rates: Record<string, number>;
}

// Cache for exchange rates
const exchangeRateCache = new Map<string, { rates: Record<string, number>, timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes in milliseconds

/**
 * Fetches the latest USD exchange rates from external API
 * @returns Exchange rates object with currency codes as keys
 */
export async function fetchUSDExchangeRates(): Promise<Record<string, number> | null> {
  try {
    const cacheKey = 'USD_RATES';
    const now = Date.now();
    
    // Check cache first
    const cached = exchangeRateCache.get(cacheKey);
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      console.log('Using cached USD exchange rates');
      return cached.rates;
    }
    
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: ExchangeRateResponse = await response.json();
    
    if (data.result !== 'success') {
      throw new Error('Exchange rate API returned error result');
    }
    
    // Cache the rates
    exchangeRateCache.set(cacheKey, { 
      rates: data.rates, 
      timestamp: now 
    });
    
    // console.log('Fetched fresh USD exchange rates, KES rate:', data.rates.KES);
    return data.rates;
  } catch (error) {
    console.error('Failed to fetch USD exchange rates:', error);
    return null;
  }
}

/**
 * Gets the exchange rate between USD and KES (Kenyan Shilling)
 * @returns USD to KES exchange rate or null if unavailable
 */
export async function getUSDToKESRate(): Promise<number | null> {
  try {
    const rates = await fetchUSDExchangeRates();
    if (!rates || !rates.KES) {
      console.error('KES rate not available in exchange rates');
      return null;
    }
    
    return rates.KES; // This gives us how many KES per 1 USD
  } catch (error) {
    console.error('Failed to get USD to KES rate:', error);
    return null;
  }
}

/**
 * Converts USD amount to KES
 * @param usdAmount Amount in USD
 * @returns Equivalent amount in KES or null if conversion fails
 */
export async function convertUSDToKES(usdAmount: number): Promise<number | null> {
  try {
    const kesRate = await getUSDToKESRate();
    if (!kesRate) return null;
    
    return usdAmount * kesRate;
  } catch (error) {
    console.error('Failed to convert USD to KES:', error);
    return null;
  }
}

/**
 * Converts KES amount to USD
 * @param kesAmount Amount in KES
 * @returns Equivalent amount in USD or null if conversion fails
 */
export async function convertKESToUSD(kesAmount: number): Promise<number | null> {
  try {
    const kesRate = await getUSDToKESRate();
    if (!kesRate) return null;
    
    return kesAmount / kesRate;
  } catch (error) {
    console.error('Failed to convert KES to USD:', error);
    return null;
  }
}

/**
 * Gets the current KES exchange rate for logging/display purposes
 */
export async function getCurrentKESRate(): Promise<{ rate: number; lastUpdate: string } | null> {
  try {
    const rates = await fetchUSDExchangeRates();
    if (!rates || !rates.KES) return null;
    
    // Get the cache entry to access timestamp
    const cached = exchangeRateCache.get('USD_RATES');
    const updateTime = cached ? new Date(cached.timestamp).toISOString() : new Date().toISOString();
    
    return {
      rate: rates.KES,
      lastUpdate: updateTime
    };
  } catch (error) {
    console.error('Failed to get current KES rate:', error);
    return null;
  }
}