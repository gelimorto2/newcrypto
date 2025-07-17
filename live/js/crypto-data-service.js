/**
 * Crypto Data Service v1.0.0
 * Enhanced crypto data fetching using CoinGecko API
 * 
 * Features:
 * - CoinGecko API integration (no API key required)
 * - Verbose logging for debugging
 * - Retry logic for reliability
 * - Multiple data sources support
 * - Real-time price updates
 * 
 * Copyright (c) 2025 AI Trading
 * All rights reserved.
 */

export class CryptoDataError extends Error {
  constructor(message, code, isRetryable = false) {
    super(message);
    this.name = 'CryptoDataError';
    this.code = code;
    this.isRetryable = isRetryable;
    this.timestamp = new Date().toISOString();
  }
}

export class CryptoDataService {
  constructor(options = {}) {
    this.baseUrl = 'https://api.coingecko.com/api/v3';
    this.proBaseUrl = 'https://pro-api.coingecko.com/api/v3'; // For pro users
    this.defaultRetryCount = 3;
    this.defaultRetryDelay = 1000;
    this.rateLimitDelay = 1200; // CoinGecko free tier: 50 calls/minute
    this.lastCallTime = 0;
    this.verbose = options.verbose !== false; // Default to verbose
    this.useProApi = false; // Set to true if you have a pro API key
    this.apiKey = options.apiKey || null;
    
    // Symbol mapping for common crypto pairs
    this.symbolMapping = {
      'BTCUSDT': { id: 'bitcoin', vs_currency: 'usd' },
      'ETHUSDT': { id: 'ethereum', vs_currency: 'usd' },
      'BNBUSDT': { id: 'binancecoin', vs_currency: 'usd' },
      'ADAUSDT': { id: 'cardano', vs_currency: 'usd' },
      'DOTUSDT': { id: 'polkadot', vs_currency: 'usd' },
      'XRPUSDT': { id: 'ripple', vs_currency: 'usd' },
      'LTCUSDT': { id: 'litecoin', vs_currency: 'usd' },
      'LINKUSDT': { id: 'chainlink', vs_currency: 'usd' },
      'BCHUSDT': { id: 'bitcoin-cash', vs_currency: 'usd' },
      'XLMUSDT': { id: 'stellar', vs_currency: 'usd' },
      'UNIUSDT': { id: 'uniswap', vs_currency: 'usd' },
      'DOGEUSDT': { id: 'dogecoin', vs_currency: 'usd' },
      'VETUSDT': { id: 'vechain', vs_currency: 'usd' },
      'FILUSDT': { id: 'filecoin', vs_currency: 'usd' },
      'TRXUSDT': { id: 'tron', vs_currency: 'usd' },
      'EOSUSDT': { id: 'eos', vs_currency: 'usd' },
      'XMRUSDT': { id: 'monero', vs_currency: 'usd' },
      'AAVEUSDT': { id: 'aave', vs_currency: 'usd' },
      'ATOMUSDT': { id: 'cosmos', vs_currency: 'usd' },
      'XTZUSDT': { id: 'tezos', vs_currency: 'usd' }
    };
    
    this.log('🚀 CryptoDataService initialized with CoinGecko API');
    this.log(`📊 Base URL: ${this.baseUrl}`);
    this.log(`⚙️ Rate limit: ${60000 / this.rateLimitDelay} calls/minute`);
    this.log(`🔄 Retry settings: ${this.defaultRetryCount} attempts, ${this.defaultRetryDelay}ms delay`);
  }

  /**
   * Enhanced logging with timestamps and context
   */
  log(message, level = 'info', data = null) {
    if (!this.verbose) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [CryptoDataService]`;
    
    switch (level) {
      case 'error':
        console.error(`${prefix} ❌ ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`${prefix} ⚠️ ${message}`, data || '');
        break;
      case 'success':
        console.log(`${prefix} ✅ ${message}`, data || '');
        break;
      case 'debug':
        console.debug(`${prefix} 🔍 ${message}`, data || '');
        break;
      default:
        console.log(`${prefix} ℹ️ ${message}`, data || '');
    }
  }

  /**
   * Rate limiting to respect API limits
   */
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    
    if (timeSinceLastCall < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastCall;
      this.log(`⏱️ Rate limiting: waiting ${waitTime}ms before next API call`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastCallTime = Date.now();
  }

  /**
   * Get coin ID from trading symbol
   */
  getCoinId(symbol) {
    const mapping = this.symbolMapping[symbol.toUpperCase()];
    if (!mapping) {
      throw new CryptoDataError(`Unsupported symbol: ${symbol}`, 'UNSUPPORTED_SYMBOL');
    }
    return mapping;
  }

  /**
   * Make API request with retry logic and rate limiting
   */
  async makeRequest(endpoint, params = {}, retryCount = 0) {
    try {
      await this.enforceRateLimit();
      
      const url = new URL(endpoint, this.useProApi ? this.proBaseUrl : this.baseUrl);
      
      // Add API key if available (for pro users)
      if (this.apiKey && this.useProApi) {
        params.x_cg_pro_api_key = this.apiKey;
      }
      
      // Add parameters to URL
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });

      this.log(`📡 Making API request to: ${url.pathname}`, 'debug');
      this.log(`📋 Request parameters:`, 'debug', params);
      
      const startTime = performance.now();
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CryptoTradingBot/1.0'
        }
      });
      
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);
      
      if (!response.ok) {
        const errorText = await response.text();
        this.log(`❌ API request failed: ${response.status} ${response.statusText}`, 'error', errorText);
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After') || '60';
          throw new CryptoDataError(
            `Rate limit exceeded. Retry after ${retryAfter}s`,
            'RATE_LIMIT',
            true
          );
        }
        
        // Determine if error is retryable
        const isRetryable = [500, 502, 503, 504].includes(response.status);
        throw new CryptoDataError(
          `API request failed: ${response.status} ${response.statusText}`,
          `HTTP_${response.status}`,
          isRetryable
        );
      }
      
      const data = await response.json();
      this.log(`✅ API request successful (${responseTime}ms)`, 'success');
      this.log(`📊 Response data size: ${JSON.stringify(data).length} bytes`, 'debug');
      
      return data;
      
    } catch (error) {
      if (error instanceof CryptoDataError) {
        if (error.isRetryable && retryCount < this.defaultRetryCount) {
          const delay = this.defaultRetryDelay * Math.pow(2, retryCount);
          this.log(`🔄 Retrying request in ${delay}ms (attempt ${retryCount + 1}/${this.defaultRetryCount})`, 'warn');
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeRequest(endpoint, params, retryCount + 1);
        }
        throw error;
      }
      
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new CryptoDataError('Network connection error', 'NETWORK_ERROR', true);
      }
      
      throw new CryptoDataError(error.message, 'UNKNOWN_ERROR', false);
    }
  }

  /**
   * Get current price for a symbol
   */
  async getCurrentPrice(symbol) {
    try {
      this.log(`💰 Fetching current price for ${symbol}`);
      
      const { id, vs_currency } = this.getCoinId(symbol);
      const data = await this.makeRequest('/simple/price', {
        ids: id,
        vs_currencies: vs_currency,
        include_last_updated_at: true,
        include_24hr_change: true
      });
      
      if (!data[id]) {
        throw new CryptoDataError(`No price data found for ${symbol}`, 'NO_DATA');
      }
      
      const priceData = {
        symbol: symbol,
        price: data[id][vs_currency],
        change24h: data[id][`${vs_currency}_24h_change`] || 0,
        lastUpdated: new Date(data[id].last_updated_at * 1000),
        timestamp: Date.now()
      };
      
      this.log(`💰 Current price for ${symbol}: $${priceData.price} (24h: ${priceData.change24h?.toFixed(2)}%)`, 'success');
      
      return priceData;
      
    } catch (error) {
      this.log(`❌ Failed to fetch current price for ${symbol}: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Get historical OHLC data (similar to klines)
   */
  async getOHLCData(symbol, days = 30) {
    try {
      this.log(`📊 Fetching OHLC data for ${symbol} (${days} days)`);
      
      const { id } = this.getCoinId(symbol);
      const data = await this.makeRequest(`/coins/${id}/ohlc`, {
        vs_currency: 'usd',
        days: days
      });
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new CryptoDataError(`No OHLC data found for ${symbol}`, 'NO_DATA');
      }
      
      // Convert CoinGecko OHLC format to our format
      // CoinGecko format: [timestamp, open, high, low, close]
      const formattedData = data.map(candle => ({
        openTime: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: 0, // CoinGecko OHLC doesn't include volume
        closeTime: candle[0] + (24 * 60 * 60 * 1000), // Assuming daily candles
        timestamp: new Date(candle[0])
      }));
      
      this.log(`📊 Retrieved ${formattedData.length} OHLC candles for ${symbol}`, 'success');
      
      return formattedData;
      
    } catch (error) {
      this.log(`❌ Failed to fetch OHLC data for ${symbol}: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Get market data with additional metrics
   */
  async getMarketData(symbol) {
    try {
      this.log(`📈 Fetching comprehensive market data for ${symbol}`);
      
      const { id } = this.getCoinId(symbol);
      const data = await this.makeRequest(`/coins/${id}`, {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: false,
        developer_data: false,
        sparkline: false
      });
      
      if (!data.market_data) {
        throw new CryptoDataError(`No market data found for ${symbol}`, 'NO_DATA');
      }
      
      const marketData = {
        symbol: symbol,
        name: data.name,
        currentPrice: data.market_data.current_price.usd,
        marketCap: data.market_data.market_cap.usd,
        volume24h: data.market_data.total_volume.usd,
        change24h: data.market_data.price_change_percentage_24h,
        change7d: data.market_data.price_change_percentage_7d,
        change30d: data.market_data.price_change_percentage_30d,
        high24h: data.market_data.high_24h.usd,
        low24h: data.market_data.low_24h.usd,
        ath: data.market_data.ath.usd,
        atl: data.market_data.atl.usd,
        circulatingSupply: data.market_data.circulating_supply,
        totalSupply: data.market_data.total_supply,
        lastUpdated: new Date(data.market_data.last_updated)
      };
      
      this.log(`📈 Market data retrieved for ${symbol}`, 'success', {
        price: marketData.currentPrice,
        volume: marketData.volume24h,
        change24h: marketData.change24h
      });
      
      return marketData;
      
    } catch (error) {
      this.log(`❌ Failed to fetch market data for ${symbol}: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Get supported coins list (for validation)
   */
  async getSupportedCoins() {
    try {
      this.log('📋 Fetching supported coins list');
      
      const data = await this.makeRequest('/coins/list');
      
      this.log(`📋 Retrieved ${data.length} supported coins`, 'success');
      
      return data;
      
    } catch (error) {
      this.log(`❌ Failed to fetch supported coins: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Get ping status (health check)
   */
  async ping() {
    try {
      this.log('🏓 Pinging CoinGecko API');
      
      const data = await this.makeRequest('/ping');
      
      this.log('🏓 CoinGecko API is responding', 'success', data);
      
      return data;
      
    } catch (error) {
      this.log(`❌ CoinGecko API ping failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Legacy compatibility method for existing klines usage
   */
  async getKlines(symbol, interval = '1d', limit = 30) {
    this.log(`📊 Legacy klines request: ${symbol} ${interval} (${limit} candles)`);
    
    // Map interval to days (approximate)
    const intervalToDays = {
      '1m': 1,
      '5m': 1,
      '15m': 1,
      '30m': 1,
      '1h': 1,
      '4h': 2,
      '1d': limit,
      '1w': limit * 7,
      '1M': limit * 30
    };
    
    const days = intervalToDays[interval] || limit;
    
    try {
      const ohlcData = await this.getOHLCData(symbol, days);
      
      // Convert to klines format for compatibility
      // Klines format: [openTime, open, high, low, close, volume, closeTime, ...]
      const klines = ohlcData.slice(-limit).map(candle => [
        candle.openTime,
        candle.open.toString(),
        candle.high.toString(),
        candle.low.toString(),
        candle.close.toString(),
        '0', // Volume not available in CoinGecko OHLC
        candle.closeTime,
        '0', // Quote asset volume
        0,   // Number of trades
        '0', // Taker buy base asset volume
        '0', // Taker buy quote asset volume
        '0'  // Unused field
      ]);
      
      this.log(`📊 Converted ${klines.length} OHLC candles to klines format`, 'success');
      
      return klines;
      
    } catch (error) {
      this.log(`❌ Failed to get klines for ${symbol}: ${error.message}`, 'error');
      throw error;
    }
  }
}

// Export singleton instance for easy usage
export const cryptoDataService = new CryptoDataService();