/**
 * Enhanced Crypto Data Service v2.0.0
 * Multi-source crypto data fetching with Python backend integration
 * 
 * Features:
 * - Python backend integration via AI API
 * - CoinGecko API integration (fallback)
 * - Enhanced verbose logging for debugging
 * - Automatic retry logic and error handling
 * - Multiple data sources support
 * - Real-time price updates with performance tracking
 * 
 * Copyright (c) 2025 AI Trading
 * All rights reserved.
 */

export class CryptoDataError extends Error {
  constructor(message, code, isRetryable = false, source = 'unknown') {
    super(message);
    this.name = 'CryptoDataError';
    this.code = code;
    this.isRetryable = isRetryable;
    this.source = source;
    this.timestamp = new Date().toISOString();
  }
}

export class EnhancedCryptoDataService {
  constructor(options = {}) {
    // Configuration
    this.useBackend = options.useBackend !== false; // Default to true
    this.backendUrl = options.backendUrl || 'http://localhost:5000/api';
    this.fallbackToCoinGecko = options.fallbackToCoinGecko !== false;
    this.verbose = options.verbose !== false; // Default to verbose
    
    // CoinGecko configuration (fallback)
    this.coinGeckoBaseUrl = 'https://api.coingecko.com/api/v3';
    this.defaultRetryCount = 3;
    this.defaultRetryDelay = 1000;
    this.rateLimitDelay = 1200; // CoinGecko free tier: 50 calls/minute
    this.lastCallTime = 0;
    
    // Performance tracking
    this.requestCount = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.backendRequestCount = 0;
    this.fallbackRequestCount = 0;
    this.averageResponseTime = 0;
    this.totalResponseTime = 0;
    
    // Symbol mapping for CoinGecko fallback
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
    
    this.log('🚀 Enhanced Crypto Data Service v2.0.0 initialized');
    this.log(`🔧 Backend URL: ${this.backendUrl}`);
    this.log(`📊 Use Backend: ${this.useBackend}`);
    this.log(`🔄 CoinGecko Fallback: ${this.fallbackToCoinGecko}`);
    this.log(`⚙️ Verbose Logging: ${this.verbose}`);
    
    // Test backend connectivity on initialization
    if (this.useBackend) {
      this.testBackendConnectivity();
    }
  }

  /**
   * Enhanced logging with performance metrics and context
   */
  log(message, level = 'info', data = null, performanceData = null) {
    if (!this.verbose) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [EnhancedCryptoService]`;
    
    // Performance metrics
    let perfMsg = '';
    if (performanceData) {
      const { duration, source, responseSize } = performanceData;
      perfMsg = ` | ⏱️ ${duration}ms | 📡 ${source} | 📊 ${responseSize || 0}B`;
    }
    
    // Statistics
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount * 100).toFixed(1) : 0;
    const stats = ` | 📈 Requests: ${this.requestCount} | ❌ Errors: ${this.errorCount} (${errorRate}%)`;
    
    switch (level) {
      case 'error':
        console.error(`${prefix} ❌ ${message}${perfMsg}${stats}`, data || '');
        break;
      case 'warn':
        console.warn(`${prefix} ⚠️ ${message}${perfMsg}${stats}`, data || '');
        break;
      case 'success':
        console.log(`${prefix} ✅ ${message}${perfMsg}${stats}`, data || '');
        break;
      case 'debug':
        console.debug(`${prefix} 🔍 ${message}${perfMsg}`, data || '');
        break;
      default:
        console.log(`${prefix} ℹ️ ${message}${perfMsg}`, data || '');
    }
  }

  /**
   * Test backend connectivity
   */
  async testBackendConnectivity() {
    try {
      const startTime = performance.now();
      const response = await fetch(`${this.backendUrl}/crypto/status`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        timeout: 5000
      });
      
      const duration = performance.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        this.log('Backend connectivity test passed', 'success', data, {
          duration: Math.round(duration),
          source: 'backend',
          responseSize: JSON.stringify(data).length
        });
      } else {
        this.log(`Backend returned status ${response.status}`, 'warn');
      }
    } catch (error) {
      this.log(`Backend connectivity test failed: ${error.message}`, 'warn');
      this.log('Will use CoinGecko fallback for data fetching', 'info');
    }
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(duration, success = true) {
    this.requestCount++;
    if (success) {
      this.successCount++;
    } else {
      this.errorCount++;
    }
    
    this.totalResponseTime += duration;
    this.averageResponseTime = this.totalResponseTime / this.requestCount;
  }

  /**
   * Rate limiting for CoinGecko API
   */
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    
    if (timeSinceLastCall < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastCall;
      this.log(`Rate limiting: waiting ${waitTime}ms before next API call`, 'debug');
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastCallTime = Date.now();
  }

  /**
   * Enhanced backend request with comprehensive error handling
   */
  async makeBackendRequest(endpoint, options = {}) {
    const startTime = performance.now();
    
    try {
      this.log(`Making backend request to ${endpoint}`, 'debug');
      
      const response = await fetch(`${this.backendUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options.headers
        },
        timeout: options.timeout || 10000,
        ...options
      });
      
      const duration = performance.now() - startTime;
      const responseText = await response.text();
      
      if (!response.ok) {
        this.updatePerformanceMetrics(duration, false);
        this.log(`Backend request failed: ${response.status} ${response.statusText}`, 'error', responseText);
        throw new CryptoDataError(
          `Backend API error: ${response.status} ${response.statusText}`,
          `BACKEND_${response.status}`,
          response.status >= 500,
          'backend'
        );
      }
      
      const data = JSON.parse(responseText);
      this.updatePerformanceMetrics(duration, true);
      this.backendRequestCount++;
      
      this.log(`Backend request successful`, 'success', null, {
        duration: Math.round(duration),
        source: 'backend',
        responseSize: responseText.length
      });
      
      return data;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      this.updatePerformanceMetrics(duration, false);
      
      if (error instanceof CryptoDataError) {
        throw error;
      }
      
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new CryptoDataError('Backend connection error', 'BACKEND_CONNECTION', true, 'backend');
      }
      
      throw new CryptoDataError(error.message, 'BACKEND_ERROR', false, 'backend');
    }
  }

  /**
   * CoinGecko fallback request
   */
  async makeCoinGeckoRequest(endpoint, params = {}, retryCount = 0) {
    try {
      await this.enforceRateLimit();
      
      const url = new URL(endpoint, this.coinGeckoBaseUrl);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });

      this.log(`CoinGecko API request to: ${url.pathname}`, 'debug', params);
      
      const startTime = performance.now();
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'EnhancedCryptoTradingBot/2.0'
        }
      });
      
      const duration = performance.now() - startTime;
      
      if (!response.ok) {
        const errorText = await response.text();
        this.log(`CoinGecko request failed: ${response.status} ${response.statusText}`, 'error', errorText);
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After') || '60';
          throw new CryptoDataError(
            `Rate limit exceeded. Retry after ${retryAfter}s`,
            'RATE_LIMIT',
            true,
            'coingecko'
          );
        }
        
        const isRetryable = [500, 502, 503, 504].includes(response.status);
        throw new CryptoDataError(
          `CoinGecko API error: ${response.status} ${response.statusText}`,
          `COINGECKO_${response.status}`,
          isRetryable,
          'coingecko'
        );
      }
      
      const data = await response.json();
      this.updatePerformanceMetrics(duration, true);
      this.fallbackRequestCount++;
      
      this.log(`CoinGecko request successful`, 'success', null, {
        duration: Math.round(duration),
        source: 'coingecko',
        responseSize: JSON.stringify(data).length
      });
      
      return data;
      
    } catch (error) {
      if (error instanceof CryptoDataError) {
        if (error.isRetryable && retryCount < this.defaultRetryCount) {
          const delay = this.defaultRetryDelay * Math.pow(2, retryCount);
          this.log(`Retrying CoinGecko request in ${delay}ms (attempt ${retryCount + 1}/${this.defaultRetryCount})`, 'warn');
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeCoinGeckoRequest(endpoint, params, retryCount + 1);
        }
        throw error;
      }
      
      throw new CryptoDataError(error.message, 'COINGECKO_ERROR', false, 'coingecko');
    }
  }

  /**
   * Get current price with enhanced fallback strategy
   */
  async getCurrentPrice(symbol) {
    this.log(`Fetching current price for ${symbol} using enhanced service`);
    
    // Try backend first
    if (this.useBackend) {
      try {
        const response = await this.makeBackendRequest(`/crypto/price/${symbol}`);
        
        if (response.success && response.data) {
          this.log(`Price fetched from backend: $${response.data.price}`, 'success');
          return {
            symbol: response.data.symbol,
            price: response.data.price,
            change24h: response.data.change_24h,
            volume24h: response.data.volume_24h,
            timestamp: response.data.timestamp,
            source: response.data.source || 'backend',
            high24h: response.data.high_24h,
            low24h: response.data.low_24h
          };
        } else {
          throw new CryptoDataError('Invalid backend response format', 'BACKEND_FORMAT', false, 'backend');
        }
        
      } catch (error) {
        this.log(`Backend price fetch failed: ${error.message}`, 'warn');
        
        if (!this.fallbackToCoinGecko) {
          throw error;
        }
        
        this.log('Falling back to CoinGecko API', 'info');
      }
    }
    
    // Fallback to CoinGecko
    if (this.fallbackToCoinGecko) {
      try {
        const mapping = this.symbolMapping[symbol.toUpperCase()];
        if (!mapping) {
          throw new CryptoDataError(`Unsupported symbol: ${symbol}`, 'UNSUPPORTED_SYMBOL', false, 'coingecko');
        }
        
        const data = await this.makeCoinGeckoRequest('/simple/price', {
          ids: mapping.id,
          vs_currencies: mapping.vs_currency,
          include_last_updated_at: true,
          include_24hr_change: true,
          include_24hr_vol: true
        });
        
        if (!data[mapping.id]) {
          throw new CryptoDataError(`No price data found for ${symbol}`, 'NO_DATA', false, 'coingecko');
        }
        
        const coinData = data[mapping.id];
        const vs_currency = mapping.vs_currency;
        
        const priceData = {
          symbol: symbol,
          price: coinData[vs_currency],
          change24h: coinData[`${vs_currency}_24h_change`] || 0,
          volume24h: coinData[`${vs_currency}_24h_vol`] || 0,
          lastUpdated: new Date(coinData.last_updated_at * 1000),
          timestamp: new Date().toISOString(),
          source: 'coingecko'
        };
        
        this.log(`Price fetched from CoinGecko: $${priceData.price}`, 'success');
        return priceData;
        
      } catch (error) {
        this.log(`CoinGecko price fetch failed: ${error.message}`, 'error');
        throw error;
      }
    }
    
    throw new CryptoDataError(`Failed to fetch price for ${symbol} from all sources`, 'ALL_SOURCES_FAILED', false, 'all');
  }

  /**
   * Get OHLC data with multi-source support
   */
  async getOHLCData(symbol, timeframe = '1d', limit = 100) {
    this.log(`Fetching OHLC data for ${symbol} (${timeframe}, ${limit} candles)`);
    
    // Try backend first
    if (this.useBackend) {
      try {
        const response = await this.makeBackendRequest(`/crypto/ohlc/${symbol}?timeframe=${timeframe}&limit=${limit}`);
        
        if (response.success && response.data) {
          this.log(`OHLC data fetched from backend: ${response.data.length} candles`, 'success');
          return response.data.map(candle => ({
            openTime: new Date(candle.timestamp).getTime(),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
            closeTime: new Date(candle.timestamp).getTime() + (24 * 60 * 60 * 1000),
            timestamp: new Date(candle.timestamp),
            source: candle.source || 'backend'
          }));
        }
        
      } catch (error) {
        this.log(`Backend OHLC fetch failed: ${error.message}`, 'warn');
        
        if (!this.fallbackToCoinGecko) {
          throw error;
        }
        
        this.log('Falling back to CoinGecko for OHLC data', 'info');
      }
    }
    
    // Fallback to CoinGecko (daily data only)
    if (this.fallbackToCoinGecko && timeframe === '1d') {
      try {
        const mapping = this.symbolMapping[symbol.toUpperCase()];
        if (!mapping) {
          throw new CryptoDataError(`Unsupported symbol: ${symbol}`, 'UNSUPPORTED_SYMBOL', false, 'coingecko');
        }
        
        const data = await this.makeCoinGeckoRequest(`/coins/${mapping.id}/ohlc`, {
          vs_currency: mapping.vs_currency,
          days: Math.min(limit, 90) // CoinGecko limit
        });
        
        const formattedData = data.slice(-limit).map(candle => ({
          openTime: candle[0],
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
          volume: 0, // CoinGecko OHLC doesn't include volume
          closeTime: candle[0] + (24 * 60 * 60 * 1000),
          timestamp: new Date(candle[0]),
          source: 'coingecko'
        }));
        
        this.log(`OHLC data fetched from CoinGecko: ${formattedData.length} candles`, 'success');
        return formattedData;
        
      } catch (error) {
        this.log(`CoinGecko OHLC fetch failed: ${error.message}`, 'error');
        throw error;
      }
    }
    
    throw new CryptoDataError(`Failed to fetch OHLC data for ${symbol}`, 'OHLC_FETCH_FAILED', false, 'all');
  }

  /**
   * Get multiple prices efficiently
   */
  async getMultiplePrices(symbols) {
    this.log(`Fetching prices for ${symbols.length} symbols: ${symbols.join(', ')}`);
    
    // Try backend batch request first
    if (this.useBackend) {
      try {
        const response = await this.makeBackendRequest('/crypto/multiple-prices', {
          method: 'POST',
          body: JSON.stringify({ symbols }),
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.success && response.data) {
          this.log(`Batch prices fetched from backend: ${Object.keys(response.data).length} symbols`, 'success');
          return response.data;
        }
        
      } catch (error) {
        this.log(`Backend batch price fetch failed: ${error.message}`, 'warn');
      }
    }
    
    // Fallback to individual requests
    this.log('Falling back to individual price requests', 'info');
    const results = {};
    
    for (const symbol of symbols) {
      try {
        results[symbol] = await this.getCurrentPrice(symbol);
        // Small delay to avoid overwhelming APIs
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        this.log(`Failed to fetch price for ${symbol}: ${error.message}`, 'warn');
      }
    }
    
    return results;
  }

  /**
   * Get service performance statistics
   */
  getPerformanceStats() {
    return {
      totalRequests: this.requestCount,
      successfulRequests: this.successCount,
      failedRequests: this.errorCount,
      successRate: this.requestCount > 0 ? (this.successCount / this.requestCount * 100).toFixed(1) : 0,
      averageResponseTime: Math.round(this.averageResponseTime),
      backendRequests: this.backendRequestCount,
      fallbackRequests: this.fallbackRequestCount,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Display performance dashboard
   */
  displayPerformanceStats() {
    if (!this.verbose) return;
    
    const stats = this.getPerformanceStats();
    
    console.group('📊 Enhanced Crypto Service Performance Stats');
    console.log(`🔢 Total Requests: ${stats.totalRequests}`);
    console.log(`✅ Success Rate: ${stats.successRate}%`);
    console.log(`⏱️ Avg Response Time: ${stats.averageResponseTime}ms`);
    console.log(`🖥️ Backend Requests: ${stats.backendRequests}`);
    console.log(`🔄 Fallback Requests: ${stats.fallbackRequests}`);
    console.groupEnd();
  }

  // Legacy compatibility methods
  async getKlines(symbol, interval = '1d', limit = 100) {
    this.log(`Legacy klines request: ${symbol} ${interval} (${limit} candles)`);
    
    try {
      const ohlcData = await this.getOHLCData(symbol, interval, limit);
      
      // Convert to klines format for compatibility
      const klines = ohlcData.map(candle => [
        candle.openTime,
        candle.open.toString(),
        candle.high.toString(),
        candle.low.toString(),
        candle.close.toString(),
        candle.volume.toString(),
        candle.closeTime,
        '0', // Quote asset volume
        0,   // Number of trades
        '0', // Taker buy base asset volume
        '0', // Taker buy quote asset volume
        '0'  // Unused field
      ]);
      
      this.log(`Converted ${klines.length} OHLC candles to klines format`, 'success');
      return klines;
      
    } catch (error) {
      this.log(`Failed to get klines for ${symbol}: ${error.message}`, 'error');
      throw error;
    }
  }
}

// Create and export enhanced service instance
export const enhancedCryptoDataService = new EnhancedCryptoDataService();

// Backward compatibility - export as original name
export const cryptoDataService = enhancedCryptoDataService;