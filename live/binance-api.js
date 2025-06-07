/**
 * Enhanced Binance API Client for Live Trading Bot
 * Handles all interactions with the Binance public API with improved error handling
 */

class BinanceApiClient {
    constructor(apiKey = null, apiSecret = null) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.baseUrl = 'https://api.binance.com';
        this.wsBaseUrl = 'wss://stream.binance.com:9443/ws';
        this.rateLimit = {
            requests: 0,
            lastReset: Date.now(),
            maxPerMinute: 1200
        };
    }

    /**
     * Rate limit handler to prevent API bans
     * @private
     */
    _checkRateLimit() {
        const now = Date.now();
        if (now - this.rateLimit.lastReset > 60000) {
            this.rateLimit.requests = 0;
            this.rateLimit.lastReset = now;
        }
        
        if (this.rateLimit.requests >= this.rateLimit.maxPerMinute) {
            throw new Error('API rate limit exceeded. Please wait before making more requests.');
        }
        
        this.rateLimit.requests++;
    }

    /**
     * Make a request to the Binance API with improved error handling
     * @param {string} endpoint - API endpoint
     * @param {string} method - HTTP method
     * @param {Object} params - Request parameters
     * @returns {Promise<Object>} - API response
     */
    async request(endpoint, method = 'GET', params = {}) {
        try {
            this._checkRateLimit();
            
            // Construct the URL
            let url = `${this.baseUrl}${endpoint}`;
            
            // Add parameters to URL for GET requests
            if (method === 'GET' && Object.keys(params).length > 0) {
                const queryString = Object.keys(params)
                    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
                    .join('&');
                url += `?${queryString}`;
            }

            // Set up fetch options
            const options = {
                method,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            };

            // Add API key if provided
            if (this.apiKey) {
                options.headers['X-MBX-APIKEY'] = this.apiKey;
            }

            // Add body for non-GET requests
            if (method !== 'GET' && Object.keys(params).length > 0) {
                options.body = JSON.stringify(params);
            }

            // Make the request with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            options.signal = controller.signal;
            
            const response = await fetch(url, options);
            clearTimeout(timeoutId);
            
            // Handle response
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API error (${response.status}): ${errorData.msg || response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('API request timed out after 30 seconds');
            }
            console.error('API request error:', error);
            throw error;
        }
    }

    /**
     * Get market status for all symbols or a specific symbol
     * @returns {Promise<Object>} - Market status
     */
    async getMarketStatus(symbol = null) {
        return this.request('/api/v3/ticker/24hr', 'GET', symbol ? { symbol } : {});
    }

    /**
     * Get exchange information
     * @returns {Promise<Object>} - Exchange info
     */
    async getExchangeInfo() {
        return this.request('/api/v3/exchangeInfo');
    }

    /**
     * Get candlestick data with enhanced formatting
     * @param {Object} params - Request parameters (symbol, interval, limit)
     * @returns {Promise<Array>} - Klines data
     */
    async getKlines(params) {
        const response = await this.request('/api/v3/klines', 'GET', params);
        // Transform the response to a more usable format
        return response.map(kline => ({
            time: kline[0],
            open: parseFloat(kline[1]),
            high: parseFloat(kline[2]),
            low: parseFloat(kline[3]),
            close: parseFloat(kline[4]),
            volume: parseFloat(kline[5]),
            closeTime: kline[6],
            quoteAssetVolume: parseFloat(kline[7]),
            trades: kline[8],
            takerBuyBaseAssetVolume: parseFloat(kline[9]),
            takerBuyQuoteAssetVolume: parseFloat(kline[10])
        }));
    }

    /**
     * Get ticker price with optional multi-symbol support
     * @param {string|null} symbol - Trading pair symbol (null for all)
     * @returns {Promise<Object|Array>} - Current price(s)
     */
    async getPrice(symbol = null) {
        return this.request('/api/v3/ticker/price', 'GET', symbol ? { symbol } : {});
    }

    /**
     * Get account information (requires API key)
     * @returns {Promise<Object>} - Account info
     */
    async getAccountInfo() {
        if (!this.apiKey) {
            throw new Error('API key required for this endpoint');
        }
        return this.request('/api/v3/account', 'GET');
    }

    /**
     * Get market depth for a symbol
     * @param {string} symbol - Trading pair symbol
     * @param {number} limit - Depth limit (default 100)
     * @returns {Promise<Object>} - Order book
     */
    async getOrderBook(symbol, limit = 100) {
        return this.request('/api/v3/depth', 'GET', { symbol, limit });
    }

    /**
     * Get recent trades for a symbol
     * @param {string} symbol - Trading pair symbol
     * @param {number} limit - Number of trades to fetch
     * @returns {Promise<Array>} - Recent trades
     */
    async getRecentTrades(symbol, limit = 500) {
        return this.request('/api/v3/trades', 'GET', { symbol, limit });
    }

    /**
     * Get aggregated trading metrics
     * @param {string} symbol - Trading pair symbol 
     * @returns {Promise<Object>} - Trading metrics
     */
    async getMarketMetrics(symbol) {
        const [price, stats, depth] = await Promise.all([
            this.getPrice(symbol),
            this.getMarketStatus(symbol),
            this.getOrderBook(symbol, 10)
        ]);
        
        return {
            currentPrice: parseFloat(price.price),
            priceChange: parseFloat(stats.priceChange),
            priceChangePercent: parseFloat(stats.priceChangePercent),
            highPrice: parseFloat(stats.highPrice),
            lowPrice: parseFloat(stats.lowPrice),
            volume: parseFloat(stats.volume),
            quoteVolume: parseFloat(stats.quoteVolume),
            bestBid: parseFloat(depth.bids[0][0]),
            bestAsk: parseFloat(depth.asks[0][0]),
            spreadPercent: ((parseFloat(depth.asks[0][0]) - parseFloat(depth.bids[0][0])) / parseFloat(depth.asks[0][0])) * 100
        };
    }

    /**
     * Convert interval string to milliseconds
     * @param {string} interval - Interval string (e.g., '1h', '4h', '1d')
     * @returns {number} - Milliseconds
     */
    getIntervalMs(interval) {
        const units = {
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
            w: 7 * 24 * 60 * 60 * 1000,
            M: 30 * 24 * 60 * 60 * 1000
        };
        
        const match = interval.match(/(\d+)([mhdwM])/);
        if (!match) {
            throw new Error(`Invalid interval format: ${interval}`);
        }
        
        const [_, amount, unit] = match;
        return parseInt(amount) * units[unit];
    }
}

// Export the class
window.BinanceApiClient = BinanceApiClient;