/**
 * Binance API Client for Live Trading Bot
 * This module handles all interactions with the Binance public API
 */

class BinanceApiClient {
    constructor(apiKey = null, apiSecret = null) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.baseUrl = 'https://api.binance.com';
        this.testMode = false; // Set to true to use testnet
    }

    /**
     * Make a request to the Binance API
     * @param {string} endpoint - API endpoint
     * @param {string} method - HTTP method
     * @param {Object} params - Request parameters
     * @returns {Promise<Object>} - API response
     */
    async request(endpoint, method = 'GET', params = {}) {
        try {
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
                headers: {}
            };

            // Add API key if provided (for future authenticated endpoints)
            if (this.apiKey) {
                options.headers['X-MBX-APIKEY'] = this.apiKey;
            }

            // Make the request
            const response = await fetch(url, options);
            
            // Handle response
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API error: ${errorData.msg || response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }

    /**
     * Get exchange information
     * @returns {Promise<Object>} - Exchange info
     */
    async getExchangeInfo() {
        return this.request('/api/v3/exchangeInfo');
    }

    /**
     * Get candlestick data
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
            volume: parseFloat(kline[5])
        }));
    }

    /**
     * Get ticker price
     * @param {string} symbol - Trading pair symbol
     * @returns {Promise<Object>} - Current price
     */
    async getPrice(symbol) {
        return this.request('/api/v3/ticker/price', 'GET', { symbol });
    }

    /**
     * Get 24hr ticker statistics
     * @param {string} symbol - Trading pair symbol
     * @returns {Promise<Object>} - 24hr statistics
     */
    async get24hrStats(symbol) {
        return this.request('/api/v3/ticker/24hr', 'GET', { symbol });
    }

    /**
     * Get available trading pairs
     * @returns {Promise<Array>} - Trading pairs
     */
    async getTradingPairs() {
        const exchangeInfo = await this.getExchangeInfo();
        return exchangeInfo.symbols
            .filter(symbol => symbol.status === 'TRADING')
            .map(symbol => ({
                symbol: symbol.symbol,
                baseAsset: symbol.baseAsset,
                quoteAsset: symbol.quoteAsset
            }));
    }

    /**
     * Get order book
     * @param {string} symbol - Trading pair symbol
     * @param {number} limit - Number of entries (default 100, max 1000)
     * @returns {Promise<Object>} - Order book
     */
    async getOrderBook(symbol, limit = 100) {
        return this.request('/api/v3/depth', 'GET', { symbol, limit });
    }

    /**
     * Get recent trades
     * @param {string} symbol - Trading pair symbol
     * @param {number} limit - Number of trades (default 500, max 1000)
     * @returns {Promise<Array>} - Recent trades
     */
    async getRecentTrades(symbol, limit = 500) {
        return this.request('/api/v3/trades', 'GET', { symbol, limit });
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
            w: 7 * 24 * 60 * 60 * 1000
        };
        
        const match = interval.match(/(\d+)([mhdw])/);
        if (!match) return 60 * 60 * 1000; // Default to 1h
        
        const value = parseInt(match[1]);
        const unit = match[2];
        
        return value * units[unit];
    }
}
