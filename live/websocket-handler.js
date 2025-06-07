/**
 * WebSocket Handler for Binance Trading Bot
 * Handles real-time data streams from Binance WebSocket API
 */

class WebSocketHandler {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000; // 5 seconds
        this.baseUrl = 'wss://stream.binance.com:9443/ws';
        this.subscriptions = [];
        this.callbacks = {};
        this.lastMessageTime = 0;
        this.pingInterval = null;
    }

    /**
     * Initialize WebSocket connection
     */
    init() {
        if (this.socket) {
            this.close();
        }

        this.socket = new WebSocket(this.baseUrl);
        this.setupEventListeners();
        this.startPingInterval();

        this.emit('connecting');
        logMessage('info', 'Connecting to Binance WebSocket...');
    }

    /**
     * Set up WebSocket event listeners
     */
    setupEventListeners() {
        this.socket.addEventListener('open', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connected');
            logMessage('info', 'WebSocket connected');

            // Resubscribe to previous streams if any
            if (this.subscriptions.length > 0) {
                this.subscribeToStreams(this.subscriptions);
            }
        });

        this.socket.addEventListener('message', (event) => {
            this.lastMessageTime = Date.now();
            try {
                const data = JSON.parse(event.data);
                
                // Handle different message types
                if (data.e === 'kline') {
                    this.emit('kline', data);
                } else if (data.e === 'trade') {
                    this.emit('trade', data);
                } else if (data.e === '24hrTicker') {
                    this.emit('ticker', data);
                } else if (data.e === 'bookTicker') {
                    this.emit('bookTicker', data);
                } else if (data.result === null) {
                    // Subscription response
                    logMessage('debug', 'Successfully subscribed to streams');
                } else {
                    // Other message types
                    this.emit('message', data);
                }
            } catch (error) {
                logMessage('error', `Failed to parse WebSocket message: ${error.message}`);
            }
        });

        this.socket.addEventListener('close', () => {
            this.isConnected = false;
            this.emit('disconnected');
            logMessage('warning', 'WebSocket disconnected');
            
            // Clear ping interval
            if (this.pingInterval) {
                clearInterval(this.pingInterval);
                this.pingInterval = null;
            }
            
            // Attempt to reconnect
            this.attemptReconnect();
        });

        this.socket.addEventListener('error', (error) => {
            this.emit('error', error);
            logMessage('error', `WebSocket error: ${error.message || 'Unknown error'}`);
        });
    }

    /**
     * Start ping interval to keep connection alive
     */
    startPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        
        // Ping every 30 seconds to keep connection alive
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.socket.send(JSON.stringify({ method: 'PING' }));
                logMessage('debug', 'Ping sent to WebSocket server');
            }
        }, 30000);
    }

    /**
     * Attempt to reconnect after disconnection
     */
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * this.reconnectAttempts;
            
            logMessage('info', `Attempting to reconnect in ${delay / 1000} seconds (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.init();
            }, delay);
        } else {
            logMessage('error', 'Maximum reconnection attempts reached. Please reconnect manually.');
        }
    }

    /**
     * Subscribe to WebSocket streams
     * @param {Array} streams - Array of stream names
     */
    subscribeToStreams(streams) {
        if (!this.isConnected) {
            logMessage('warning', 'Cannot subscribe: WebSocket not connected');
            return;
        }

        const subscribeMsg = {
            method: 'SUBSCRIBE',
            params: streams,
            id: Date.now()
        };

        this.socket.send(JSON.stringify(subscribeMsg));
        logMessage('info', `Subscribed to streams: ${streams.join(', ')}`);
    }

    /**
     * Unsubscribe from WebSocket streams
     * @param {Array} streams - Array of stream names
     */
    unsubscribeFromStreams(streams) {
        if (!this.isConnected) {
            logMessage('warning', 'Cannot unsubscribe: WebSocket not connected');
            return;
        }

        const unsubscribeMsg = {
            method: 'UNSUBSCRIBE',
            params: streams,
            id: Date.now()
        };

        this.socket.send(JSON.stringify(unsubscribeMsg));
        logMessage('info', `Unsubscribed from streams: ${streams.join(', ')}`);
    }

    /**
     * Subscribe to a single stream
     * @param {string} stream - Stream name
     */
    subscribe(stream) {
        if (!this.subscriptions.includes(stream)) {
            this.subscriptions.push(stream);
        }
        
        if (this.isConnected) {
            this.subscribeToStreams([stream]);
        }
    }

    /**
     * Unsubscribe from a single stream
     * @param {string} stream - Stream name
     */
    unsubscribe(stream) {
        const index = this.subscriptions.indexOf(stream);
        if (index !== -1) {
            this.subscriptions.splice(index, 1);
        }
        
        if (this.isConnected) {
            this.unsubscribeFromStreams([stream]);
        }
    }

    /**
     * Close WebSocket connection
     */
    close() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.isConnected = false;
            
            if (this.pingInterval) {
                clearInterval(this.pingInterval);
                this.pingInterval = null;
            }
            
            logMessage('info', 'WebSocket connection closed');
        }
    }

    /**
     * Register event listener
     * @param {string} event - Event name
     * @param {Function} callback - Event callback function
     */
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }

    /**
     * Emit event to registered listeners
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        const callbacks = this.callbacks[event] || [];
        callbacks.forEach(callback => callback(data));
    }

    /**
     * Get connection status details
     * @returns {Object} - Connection status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            lastMessageTime: this.lastMessageTime > 0 ? new Date(this.lastMessageTime).toISOString() : 'Never',
            subscriptions: this.subscriptions
        };
    }
}

// Create global instance
const webSocketHandler = new WebSocketHandler();
