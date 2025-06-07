/**
 * Enhanced WebSocket Handler for Binance Stream
 * Handles WebSocket connections with auto-reconnect and error handling
 */

class BinanceWebSocketHandler {
    constructor(baseUrl = 'wss://stream.binance.com:9443/ws') {
        this.baseUrl = baseUrl;
        this.socket = null;
        this.subscriptions = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnected = false;
        this.heartbeatInterval = null;
        this.listeners = {
            connected: [],
            disconnected: [],
            error: [],
            message: [],
            kline: [],
            trade: [],
            ticker: [],
            depth: []
        };
    }

    /**
     * Connect to WebSocket server
     * @returns {Promise} - Resolves when connection is established
     */
    connect() {
        return new Promise((resolve, reject) => {
            if (this.socket && this.isConnected) {
                resolve();
                return;
            }

            this.socket = new WebSocket(this.baseUrl);

            this.socket.onopen = () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this._startHeartbeat();
                this._resubscribeAll();
                this._triggerEvent('connected');
                resolve();
            };

            this.socket.onclose = (event) => {
                console.log(`WebSocket disconnected: ${event.code} ${event.reason}`);
                this.isConnected = false;
                this._stopHeartbeat();
                this._triggerEvent('disconnected', event);
                
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
                    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
                    setTimeout(() => this.connect(), delay);
                }
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this._triggerEvent('error', error);
                reject(error);
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this._triggerEvent('message', data);
                    
                    // Handle different message types
                    if (data.e === 'kline') {
                        this._triggerEvent('kline', data);
                    } else if (data.e === 'trade') {
                        this._triggerEvent('trade', data);
                    } else if (data.e === 'ticker') {
                        this._triggerEvent('ticker', data);
                    } else if (data.e === 'depthUpdate') {
                        this._triggerEvent('depth', data);
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
        });
    }

    /**
     * Send data to WebSocket server
     * @param {Object} data - Data to send
     */
    send(data) {
        if (!this.isConnected) {
            throw new Error('WebSocket is not connected');
        }
        this.socket.send(JSON.stringify(data));
    }

    /**
     * Subscribe to a stream
     * @param {string} streamName - Stream name
     * @param {Object} params - Subscription parameters
     */
    subscribe(streamName, params = {}) {
        const id = Date.now();
        const subscription = {
            id,
            params
        };
        
        this.subscriptions.set(streamName, subscription);
        
        if (this.isConnected) {
            this.send({
                method: 'SUBSCRIBE',
                params: [streamName],
                id
            });
        }
    }

    /**
     * Unsubscribe from a stream
     * @param {string} streamName - Stream name
     */
    unsubscribe(streamName) {
        const subscription = this.subscriptions.get(streamName);
        if (subscription) {
            if (this.isConnected) {
                this.send({
                    method: 'UNSUBSCRIBE',
                    params: [streamName],
                    id: subscription.id
                });
            }
            this.subscriptions.delete(streamName);
        }
    }

    /**
     * Subscribe to kline/candlestick updates
     * @param {string} symbol - Trading pair symbol
     * @param {string} interval - Candlestick interval
     */
    subscribeToKlines(symbol, interval) {
        const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
        this.subscribe(streamName, { symbol, interval });
    }

    /**
     * Subscribe to trade updates
     * @param {string} symbol - Trading pair symbol
     */
    subscribeToTrades(symbol) {
        const streamName = `${symbol.toLowerCase()}@trade`;
        this.subscribe(streamName, { symbol });
    }

    /**
     * Subscribe to ticker updates
     * @param {string} symbol - Trading pair symbol
     */
    subscribeToTicker(symbol) {
        const streamName = `${symbol.toLowerCase()}@ticker`;
        this.subscribe(streamName, { symbol });
    }

    /**
     * Subscribe to order book updates
     * @param {string} symbol - Trading pair symbol
     * @param {string} level - Update speed (100ms or 1000ms)
     */
    subscribeToDepth(symbol, level = '100ms') {
        const streamName = `${symbol.toLowerCase()}@depth@${level}`;
        this.subscribe(streamName, { symbol, level });
    }

    /**
     * Close WebSocket connection
     */
    close() {
        if (this.socket) {
            this._stopHeartbeat();
            this.socket.close();
            this.socket = null;
            this.isConnected = false;
        }
    }

    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Start heartbeat to keep connection alive
     * @private
     */
    _startHeartbeat() {
        this._stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.send({ type: 'ping' });
            }
        }, 30000); // Send ping every 30 seconds
    }

    /**
     * Stop heartbeat
     * @private
     */
    _stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Resubscribe to all streams after reconnect
     * @private
     */
    _resubscribeAll() {
        for (const [streamName, subscription] of this.subscriptions.entries()) {
            this.send({
                method: 'SUBSCRIBE',
                params: [streamName],
                id: subscription.id
            });
        }
    }

    /**
     * Trigger event listeners
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @private
     */
    _triggerEvent(event, data) {
        if (this.listeners[event]) {
            for (const callback of this.listeners[event]) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} listener:`, error);
                }
            }
        }
    }
}

// Export the class
window.BinanceWebSocketHandler = BinanceWebSocketHandler;