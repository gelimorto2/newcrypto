/**
 * Binance API Client for Live Trading Bot
 * This module handles all interactions with the Binance API
 */

class BinanceApiClient {
    constructor(apiKey, apiSecret) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.baseUrl = 'https://api.binance.com';
        this.testMode = false; // Set to true to use testnet
    }

    /**
     * Generate signature for authenticated requests
     * @param {Object} params - Request parameters
     * @returns {string} - HMAC SHA256 signature
     */
    generateSignature(params) {
        // In a browser environment, we need a server to handle signatures for security
        // This is a simplified implementation for demo purposes
        const queryString = Object.keys(params)
            .map(key => `${key}=${params[key]}`)
            .join('&');
        
        // In production, this should be done server-side
        // This is just a placeholder - in reality you'd need to use a backend service
        // to generate the signature using the API secret
        return this.mockSignature(queryString);
    }

    /**
     * Mock signature generation (for demo purposes only)
     * In production, signature should be generated server-side
     */
    mockSignature(queryString) {
        // This is NOT secure and only for demonstration
        // In a real app, use a backend service for this
        let signature = '';
        const characters = 'abcdef0123456789';
        for (let i = 0; i < 64; i++) {
            signature += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return signature;
    }

    /**
     * Make a request to the Binance API
     * @param {string} endpoint - API endpoint
     * @param {string} method - HTTP method
     * @param {Object} params - Request parameters
     * @param {boolean} signed - Whether the request needs authentication
     * @returns {Promise<Object>} - API response
     */
    async request(endpoint, method = 'GET', params = {}, signed = false) {
        try {
            // Construct the URL and options
            let url = `${this.baseUrl}${endpoint}`;
            const options = {
                method,
                headers: {
                    'X-MBX-APIKEY': this.apiKey
                }
            };

            // For signed requests, add timestamp and signature
            if (signed) {
                params.timestamp = Date.now();
                params.signature = this.generateSignature(params);
            }

            // Add parameters to URL for GET requests
            if (method === 'GET' && Object.keys(params).length > 0) {
                const queryString = Object.keys(params)
                    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
                    .join('&');
                url += `?${queryString}`;
            }

            // Add parameters to body for POST requests
            if (method === 'POST' && Object.keys(params).length > 0) {
                options.body = JSON.stringify(params);
                options.headers['Content-Type'] = 'application/json';
            }

            // In a real app, this would make a fetch request to the Binance API
            // For demo purposes, we'll use mock responses
            return this.mockResponse(endpoint, method, params);
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }

    /**
     * Mock API responses for demo purposes
     */
    async mockResponse(endpoint, method, params) {
        // This function simulates Binance API responses for demonstration
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));

        // Mock responses based on endpoint
        if (endpoint === '/api/v3/account') {
            return this.mockAccountInfo();
        } else if (endpoint === '/api/v3/klines') {
            return this.mockKlines(params.symbol, params.interval, params.limit);
        } else if (endpoint === '/api/v3/order') {
            return this.mockOrder(params);
        } else if (endpoint === '/api/v3/openOrders') {
            return this.mockOpenOrders();
        } else if (endpoint === '/api/v3/myTrades') {
            return this.mockMyTrades(params.symbol);
        } else {
            // Default mock response
            return { success: true, message: 'Mock response for ' + endpoint };
        }
    }

    /**
     * Mock account information
     */
    mockAccountInfo() {
        return {
            makerCommission: 10,
            takerCommission: 10,
            buyerCommission: 0,
            sellerCommission: 0,
            canTrade: true,
            canWithdraw: true,
            canDeposit: true,
            updateTime: Date.now(),
            accountType: 'SPOT',
            balances: [
                {
                    asset: 'BTC',
                    free: '0.00152456',
                    locked: '0.00000000'
                },
                {
                    asset: 'ETH',
                    free: '0.05234500',
                    locked: '0.00000000'
                },
                {
                    asset: 'USDT',
                    free: '1245.78',
                    locked: '100.00'
                },
                {
                    asset: 'BNB',
                    free: '3.45678',
                    locked: '0.00000000'
                }
            ]
        };
    }

    /**
     * Mock klines (candlestick) data
     */
    mockKlines(symbol, interval, limit = 100) {
        const klines = [];
        let basePrice = symbol.includes('BTC') ? 40000 : symbol.includes('ETH') ? 2800 : 300;
        let time = Date.now() - (limit * this.getIntervalMs(interval));
        
        for (let i = 0; i < limit; i++) {
            // Add some random price movement
            const change = (Math.random() - 0.5) * basePrice * 0.02;
            basePrice += change;
            
            // Create candlestick with OHLCV data
            const open = basePrice;
            const high = open + (Math.random() * open * 0.01);
            const low = open - (Math.random() * open * 0.01);
            const close = low + (Math.random() * (high - low));
            const volume = Math.random() * 100 + 50;
            
            // Format as Binance kline array
            klines.push({
                time: time,
                open: open.toFixed(2),
                high: high.toFixed(2),
                low: low.toFixed(2),
                close: close.toFixed(2),
                volume: volume.toFixed(2)
            });
            
            time += this.getIntervalMs(interval);
        }
        
        return klines;
    }

    /**
     * Mock order creation
     */
    mockOrder(params) {
        return {
            symbol: params.symbol,
            orderId: Math.floor(Math.random() * 1000000000),
            orderListId: -1,
            clientOrderId: 'mock_' + Date.now(),
            transactTime: Date.now(),
            price: params.price || '0.00000000',
            origQty: params.quantity,
            executedQty: params.quantity,
            cummulativeQuoteQty: (params.quantity * (params.price || this.getMockPrice(params.symbol))).toFixed(8),
            status: 'FILLED',
            timeInForce: params.timeInForce || 'GTC',
            type: params.type || 'MARKET',
            side: params.side
        };
    }

    /**
     * Mock open orders
     */
    mockOpenOrders() {
        return []; // No open orders for demo
    }

    /**
     * Mock trade history
     */
    mockMyTrades(symbol) {
        return []; // No trade history for demo
    }

    /**
     * Get mock current price for a symbol
     */
    getMockPrice(symbol) {
        if (symbol.includes('BTC')) return 40000 + (Math.random() * 2000 - 1000);
        if (symbol.includes('ETH')) return 2800 + (Math.random() * 200 - 100);
        return 300 + (Math.random() * 20 - 10);
    }

    /**
     * Convert interval string to milliseconds
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

    // API METHODS

    /**
     * Get account information
     * @returns {Promise<Object>} - Account information
     */
    async getAccountInfo() {
        return this.request('/api/v3/account', 'GET', {}, true);
    }

    /**
     * Get candlestick data
     * @param {Object} params - Request parameters
     * @returns {Promise<Array>} - Klines data
     */
    async getKlines(params) {
        return this.request('/api/v3/klines', 'GET', params);
    }

    /**
     * Get historical klines data
     * @param {Object} params - Request parameters including startTime and endTime
     * @returns {Promise<Array>} - Historical klines data
     */
    async getHistoricalKlines(params) {
        return this.request('/api/v3/klines', 'GET', params);
    }

    /**
     * Create a new order
     * @param {Object} params - Order parameters
     * @returns {Promise<Object>} - Order result
     */
    async createOrder(params) {
        return this.request('/api/v3/order', 'POST', params, true);
    }

    /**
     * Get open orders
     * @param {Object} params - Request parameters
     * @returns {Promise<Array>} - Open orders
     */
    async getOpenOrders(params = {}) {
        return this.request('/api/v3/openOrders', 'GET', params, true);
    }

    /**
     * Get order status
     * @param {Object} params - Request parameters
     * @returns {Promise<Object>} - Order status
     */
    async getOrder(params) {
        return this.request('/api/v3/order', 'GET', params, true);
    }

    /**
     * Cancel an order
     * @param {Object} params - Request parameters
     * @returns {Promise<Object>} - Cancellation result
     */
    async cancelOrder(params) {
        return this.request('/api/v3/order', 'DELETE', params, true);
    }

    /**
     * Get trade history
     * @param {Object} params - Request parameters
     * @returns {Promise<Array>} - Trade history
     */
    async getMyTrades(params) {
        return this.request('/api/v3/myTrades', 'GET', params, true);
    }
}
