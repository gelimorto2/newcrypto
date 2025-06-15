/**
 * Enhanced API Client for Volty Trading Bot
 * 
 * Features:
 * - Retry logic for transient failures
 * - Input validation
 * - Error categorization
 * - Rate limiting support
 */

import { secureStorage } from './secure-storage.js';

export class APIError extends Error {
  constructor(message, code, isRetryable = false) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.isRetryable = isRetryable;
  }
}

export class ExchangeAPIClient {
  constructor(useTestnet = true) {
    this.setEnvironment(useTestnet);
    this.defaultRetryCount = 3;
    this.defaultRetryDelay = 1000; // ms
    this.jitterFactor = 0.3; // 30% random jitter for retry delays
  }

  /**
   * Set API environment (testnet or production)
   * @param {boolean} useTestnet - Whether to use testnet
   */
  setEnvironment(useTestnet) {
    // Use a proxy server to handle API request signing
    this.baseUrl = useTestnet
      ? 'https://your-secure-proxy.com/testnet/api'
      : 'https://your-secure-proxy.com/production/api';
    this.useTestnet = useTestnet;
  }

  /**
   * Calculate backoff time with jitter for retry
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {number} - Delay in milliseconds
   */
  calculateBackoff(attempt) {
    const delay = this.defaultRetryDelay * Math.pow(2, attempt);
    const jitter = delay * this.jitterFactor * Math.random();
    return delay + jitter;
  }

  /**
   * Make an API request with retry logic
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} params - Request parameters
   * @param {boolean} requiresAuth - Whether authentication is required
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<Object>} - API response
   */
  async makeRequest(endpoint, method = 'GET', params = {}, requiresAuth = false, maxRetries = this.defaultRetryCount) {
    let attempt = 0;
    
    while (true) {
      try {
        return await this._executeRequest(endpoint, method, params, requiresAuth);
      } catch (error) {
        if (!(error instanceof APIError) || !error.isRetryable || attempt >= maxRetries) {
          throw error;
        }
        
        // Calculate backoff time with jitter
        const backoffTime = this.calculateBackoff(attempt);
        console.warn(`API request failed, retrying in ${backoffTime}ms`, error);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        attempt++;
      }
    }
  }

  /**
   * Execute a single API request
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} params - Request parameters
   * @param {boolean} requiresAuth - Whether authentication is required
   * @returns {Promise<Object>} - API response
   * @private
   */
  async _executeRequest(endpoint, method, params, requiresAuth) {
    try {
      // Prepare request URL and options
      let url = this.baseUrl + endpoint;
      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Version': '2.0.0'
        }
      };

      // Add authentication if required
      if (requiresAuth) {
        const credentials = await secureStorage.getCredentials();
        if (!credentials.apiKey) {
          throw new APIError('API key not configured', 'AUTH_MISSING', false);
        }
        
        options.headers['X-API-Key'] = credentials.apiKey;
        // API secret is not sent - the proxy will handle signing
      }

      // Handle different HTTP methods
      if (method === 'GET') {
        // Append query params to URL for GET requests
        const queryString = this._buildQueryString(params);
        if (queryString) {
          url += '?' + queryString;
        }
      } else {
        // Add body for non-GET requests
        options.body = JSON.stringify(params);
      }

      // Execute request
      const response = await fetch(url, options);
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '5';
        throw new APIError(
          `Rate limit exceeded. Try again after ${retryAfter}s`,
          'RATE_LIMIT',
          true
        );
      }
      
      // Parse response
      const data = await response.json();
      
      // Handle API errors
      if (!response.ok) {
        const isRetryable = [500, 502, 503, 504].includes(response.status);
        throw new APIError(
          data.message || response.statusText,
          data.code || `HTTP_${response.status}`,
          isRetryable
        );
      }
      
      return data;
    } catch (error) {
      // Convert network errors to APIError
      if (!(error instanceof APIError)) {
        if (error.name === 'TypeError' && error.message.includes('Network')) {
          throw new APIError('Network connection error', 'NETWORK_ERROR', true);
        }
        throw new APIError(error.message, 'UNKNOWN_ERROR', false);
      }
      throw error;
    }
  }

  /**
   * Build query string from parameters
   * @param {Object} params - Parameters
   * @returns {string} - Query string
   * @private
   */
  _buildQueryString(params) {
    return Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /**
   * Validate parameter types
   * @param {Object} params - Parameters to validate
   * @param {Object} schema - Validation schema
   * @throws {APIError} - If validation fails
   * @private
   */
  _validateParams(params, schema) {
    for (const [key, spec] of Object.entries(schema)) {
      const value = params[key];
      
      // Check required fields
      if (spec.required && (value === undefined || value === null)) {
        throw new APIError(`Parameter '${key}' is required`, 'VALIDATION_ERROR');
      }
      
      if (value !== undefined && value !== null) {
        // Type validation
        if (spec.type && typeof value !== spec.type) {
          throw new APIError(
            `Parameter '${key}' should be of type ${spec.type}`,
            'VALIDATION_ERROR'
          );
        }
        
        // Minimum/maximum validation for numbers
        if (spec.type === 'number') {
          if (spec.min !== undefined && value < spec.min) {
            throw new APIError(
              `Parameter '${key}' should be >= ${spec.min}`,
              'VALIDATION_ERROR'
            );
          }
          if (spec.max !== undefined && value > spec.max) {
            throw new APIError(
              `Parameter '${key}' should be <= ${spec.max}`,
              'VALIDATION_ERROR'
            );
          }
        }
        
        // Length validation for strings
        if (spec.type === 'string') {
          if (spec.minLength !== undefined && value.length < spec.minLength) {
            throw new APIError(
              `Parameter '${key}' should have length >= ${spec.minLength}`,
              'VALIDATION_ERROR'
            );
          }
          if (spec.maxLength !== undefined && value.length > spec.maxLength) {
            throw new APIError(
              `Parameter '${key}' should have length <= ${spec.maxLength}`,
              'VALIDATION_ERROR'
            );
          }
        }
        
        // Pattern validation for strings
        if (spec.type === 'string' && spec.pattern && !new RegExp(spec.pattern).test(value)) {
          throw new APIError(
            `Parameter '${key}' does not match required pattern`,
            'VALIDATION_ERROR'
          );
        }
      }
    }
  }

  // API Methods

  /**
   * Test API connectivity
   * @returns {Promise<Object>}
   */
  async ping() {
    return this.makeRequest('/ping', 'GET');
  }

  /**
   * Get exchange server time
   * @returns {Promise<Object>}
   */
  async getServerTime() {
    return this.makeRequest('/time', 'GET');
  }

  /**
   * Get exchange info
   * @returns {Promise<Object>}
   */
  async getExchangeInfo() {
    return this.makeRequest('/exchangeInfo', 'GET');
  }

  /**
   * Get account information
   * @returns {Promise<Object>}
   */
  async getAccountInfo() {
    return this.makeRequest('/account', 'GET', {}, true);
  }

  /**
   * Get candlestick data
   * @param {string} symbol - Trading pair symbol
   * @param {string} interval - Candlestick interval
   * @param {number} limit - Number of candles to return
   * @returns {Promise<Object>}
   */
  async getKlines(symbol, interval, limit = 500) {
    this._validateParams(
      { symbol, interval, limit },
      {
        symbol: { type: 'string', required: true, minLength: 2 },
        interval: { type: 'string', required: true },
        limit: { type: 'number', min: 1, max: 1000 }
      }
    );
    
    return this.makeRequest('/klines', 'GET', { symbol, interval, limit });
  }

  /**
   * Place a new order
   * @param {string} symbol - Trading pair symbol
   * @param {string} side - Order side (BUY or SELL)
   * @param {string} type - Order type (LIMIT, MARKET, etc.)
   * @param {number} quantity - Order quantity
   * @param {number|null} price - Order price (required for LIMIT orders)
   * @param {string} timeInForce - Time in force (GTC, IOC, FOK)
   * @returns {Promise<Object>}
   */
  async placeOrder(symbol, side, type, quantity, price = null, timeInForce = 'GTC') {
    const params = { symbol, side, type, quantity };
    
    if (type === 'LIMIT') {
      params.price = price;
      params.timeInForce = timeInForce;
    }
    
    this._validateParams(
      params,
      {
        symbol: { type: 'string', required: true, minLength: 2 },
        side: { type: 'string', required: true, pattern: '^(BUY|SELL)$' },
        type: { type: 'string', required: true },
        quantity: { type: 'number', required: true, min: 0 },
        price: type === 'LIMIT' ? { type: 'number', required: true, min: 0 } : {},
        timeInForce: type === 'LIMIT' ? { type: 'string', required: true } : {}
      }
    );
    
    return this.makeRequest('/order', 'POST', params, true);
  }

  /**
   * Cancel an order
   * @param {string} symbol - Trading pair symbol
   * @param {number|string} orderId - Order ID
   * @returns {Promise<Object>}
   */
  async cancelOrder(symbol, orderId) {
    this._validateParams(
      { symbol, orderId },
      {
        symbol: { type: 'string', required: true, minLength: 2 },
        orderId: { required: true }
      }
    );
    
    return this.makeRequest('/order', 'DELETE', { symbol, orderId }, true);
  }

  /**
   * Get open orders
   * @param {string} symbol - Trading pair symbol
   * @returns {Promise<Object>}
   */
  async getOpenOrders(symbol) {
    this._validateParams(
      { symbol },
      {
        symbol: { type: 'string', required: true, minLength: 2 }
      }
    );
    
    return this.makeRequest('/openOrders', 'GET', { symbol }, true);
  }

  /**
   * Get order status
   * @param {string} symbol - Trading pair symbol
   * @param {number|string} orderId - Order ID
   * @returns {Promise<Object>}
   */
  async getOrder(symbol, orderId) {
    this._validateParams(
      { symbol, orderId },
      {
        symbol: { type: 'string', required: true, minLength: 2 },
        orderId: { required: true }
      }
    );
    
    return this.makeRequest('/order', 'GET', { symbol, orderId }, true);
  }
}
