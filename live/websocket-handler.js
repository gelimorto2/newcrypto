/**
 * WebSocket Handler Module for Binance Trading Bot
 * Handles real-time data communication with Binance WebSocket API
 */

class WebSocketHandler {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000; // 3 seconds
        this.subscriptions = [];
        this.lastMessageTime = null;
        this.pingInterval = null;
        this.listeners = {};
        this.defaultUrl = 'wss://stream.binance.com:9443/ws';
    }

    /**
     * Initialize WebSocket connection
     * @param {string} url - WebSocket URL
     */
    init(url = this.defaultUrl) {
        this.updateConnectionStatus('connecting');
        
        try {
            this.socket = new WebSocket(url);
            
            // Setup event handlers
            this.socket.onopen = this.onOpen.bind(this);
            this.socket.onmessage = this.onMessage.bind(this);
            this.socket.onclose = this.onClose.bind(this);
            this.socket.onerror = this.onError.bind(this);
            
            logMessage('debug', `Initializing WebSocket connection to ${url}`);
        } catch (error) {
            this.updateConnectionStatus('disconnected');
            logMessage('error', `WebSocket initialization error: ${error.message}`);
        }
    }

    /**
     * Handle WebSocket open event
     */
    onOpen(event) {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.updateConnectionStatus('connected');
        
        // Subscribe to all active subscriptions
        this.resubscribe();
        
        // Setup ping interval to keep connection alive
        this.pingInterval = setInterval(() => {
            this.ping();
        }, 30000); // Every 30 seconds
        
        logMessage('info', 'WebSocket connected');
        this.emit('connected');
    }

    /**
     * Handle WebSocket message event
     */
    onMessage(event) {
        this.lastMessageTime = new Date();
        document.getElementById('last-message-time').textContent = this.lastMessageTime.toLocaleTimeString();
        
        try {
            const data = JSON.parse(event.data);
            
            // Handle ping/pong messages
            if (data.ping) {
                this.pong(data.ping);
                return;
            }
            
            // Handle different message types
            if (data.e === 'kline') {
                this.emit('kline', data);
            } else if (data.e === 'trade') {
                this.emit('trade', data);
            } else if (data.e === '24hrTicker') {
                this.emit('ticker', data);
            } else {
                this.emit('message', data);
            }
            
            logMessage('debug', `WebSocket message received: ${data.e || 'unknown type'}`);
        } catch (error) {
            logMessage('error', `Error parsing WebSocket message: ${error.message}`);
        }
    }

    /**
     * Handle WebSocket close event
     */
    onClose(event) {
        this.isConnected = false;
        this.updateConnectionStatus('disconnected');
        
        clearInterval(this.pingInterval);
        
        logMessage('warning', `WebSocket connection closed: ${event.reason || 'No reason provided'}`);
        this.emit('disconnected');
        
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            logMessage('info', `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
                this.init();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            logMessage('error', 'Maximum reconnection attempts reached. Please reconnect manually.');
        }
    }

    /**
     * Handle WebSocket error event
     */
    onError(error) {
        this.updateConnectionStatus('disconnected');
        logMessage('error', `WebSocket error: ${error.message || 'Unknown error'}`);
        this.emit('error', error);
    }

    /**
     * Send ping to keep connection alive
     */
    ping() {
        if (this.isConnected) {
            this.send({ method: 'ping' });
        }
    }

    /**
     * Respond to ping with pong
     */
    pong(pingId) {
        if (this.isConnected) {
            this.send({ method: 'pong', id: pingId });
        }
    }

    /**
     * Send data to WebSocket server
     */
    send(data) {
        if (!this.isConnected) {
            logMessage('warning', 'Cannot send message: WebSocket not connected');
            return false;
        }
        
        try {
            this.socket.send(JSON.stringify(data));
            return true;
        } catch (error) {
            logMessage('error', `Error sending WebSocket message: ${error.message}`);
            return false;
        }
    }

    /**
     * Subscribe to a specific stream
     */
    subscribe(params) {
        const request = {
            method: 'SUBSCRIBE',
            params: Array.isArray(params) ? params : [params],
            id: Date.now()
        };
        
        // Save subscription for reconnect
        this.subscriptions = [...new Set([...this.subscriptions, ...(Array.isArray(params) ? params : [params])])];
        
        return this.send(request);
    }

    /**
     * Unsubscribe from a specific stream
     */
    unsubscribe(params) {
        const request = {
            method: 'UNSUBSCRIBE',
            params: Array.isArray(params) ? params : [params],
            id: Date.now()
        };
        
        // Remove from subscriptions list
        this.subscriptions = this.subscriptions.filter(sub => 
            !Array.isArray(params) ? sub !== params : !params.includes(sub)
        );
        
        return this.send(request);
    }

    /**
     * Resubscribe to all saved subscriptions
     */
    resubscribe() {
        if (this.subscriptions.length > 0) {
            this.subscribe(this.subscriptions);
            logMessage('info', `Resubscribed to ${this.subscriptions.length} streams`);
        }
    }

    /**
     * Close WebSocket connection
     */
    close() {
        if (this.socket) {
            this.socket.close();
            this.isConnected = false;
            clearInterval(this.pingInterval);
            this.updateConnectionStatus('disconnected');
            logMessage('info', 'WebSocket connection closed');
        }
    }

    /**
     * Update connection status UI
     */
    updateConnectionStatus(status) {
        const connectionStatus = document.getElementById('connection-status');
        const wsIndicator = document.getElementById('ws-indicator');
        const wsStatus = document.getElementById('ws-status');
        
        if (connectionStatus && wsIndicator && wsStatus) {
            // Update connection status display
            connectionStatus.className = `status ${status === 'connected' ? 'running' : status === 'connecting' ? 'paper' : 'stopped'}`;
            connectionStatus.textContent = status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected';
            
            // Update WebSocket indicator
            wsIndicator.className = `websocket-status ${status}`;
            
            // Update status in modal
            wsStatus.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }
    }

    /**
     * Register event listener
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Emit event to all listeners
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    logMessage('error', `Error in ${event} event handler: ${error.message}`);
                }
            });
        }
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            lastMessage: this.lastMessageTime,
            reconnectAttempts: this.reconnectAttempts,
            subscriptions: this.subscriptions
        };
    }
}

// Create global instance
const webSocketHandler = new WebSocketHandler();

// DOM event listeners for WebSocket controls
document.addEventListener('DOMContentLoaded', () => {
    // Connection status tooltip click
    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus) {
        connectionStatus.addEventListener('click', () => {
            const modal = document.getElementById('connection-status-modal');
            if (modal) {
                modal.style.display = 'block';
            }
        });
    }

    // Reconnect button
    const reconnectWsButton = document.getElementById('reconnect-ws-button');
    if (reconnectWsButton) {
        reconnectWsButton.addEventListener('click', () => {
            webSocketHandler.close();
            webSocketHandler.init(document.getElementById('websocket-url').value);
        });
    }

    // Reconnect WebSocket button in advanced tab
    const reconnectWebsocket = document.getElementById('reconnect-websocket');
    if (reconnectWebsocket) {
        reconnectWebsocket.addEventListener('click', () => {
            const url = document.getElementById('websocket-url').value;
            webSocketHandler.close();
            webSocketHandler.init(url);
        });
    }

    // Close modal buttons
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
});
