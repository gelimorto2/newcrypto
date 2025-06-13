/**
 * Volty Trading Bot v2.0.0
 * Advanced Algorithmic Trading Platform
 * 
 * Copyright (c) 2025 Volty Trading
 * All rights reserved.
 */

// Application state
const state = {
    // Market data
    symbol: 'BTCUSDT',
    timeframe: '1h',
    currentPrice: 0,
    priceData: [],
    volumeData: [],
    
    // Strategy parameters
    bbLength: 20,
    bbDeviation: 2,
    volumeCandles: 3,
    volumeIncrease: 20,
    
    // Account and positions
    initialCapital: 10000,
    balance: 10000,
    currentPosition: null,
    
    // Trading history
    trades: [],
    
    // Settings
    settings: {
        autoTrade: true,
        showPositionLines: true,
        useTakeProfit: true,
        useStopLoss: true,
        useTrailingStop: false,
        takeProfitPct: 3,
        stopLossPct: 2,
        trailingStopPct: 1.5,
        positionSize: 10,
        useTestnet: true,
        apiKey: '',
        apiSecret: '',
        
        // Notifications
        browserNotifications: true,
        soundNotifications: true,
        discordNotifications: false,
        discordWebhook: '',
    },
    
    // Application state
    isRunning: false,
    isLiveTrading: false,
    lastUpdate: null,
    status: 'idle',
    tvWidget: null,
};

// Position class for managing trades
class Position {
    constructor(type, entryPrice, size, timestamp) {
        this.type = type; // 'LONG' or 'SHORT'
        this.entryPrice = entryPrice;
        this.size = size;
        this.entryTime = timestamp || new Date();
        this.exitPrice = null;
        this.exitTime = null;
        this.takeProfitPrice = this.calculateTakeProfit();
        this.stopLossPrice = this.calculateStopLoss();
        this.trailingStopPrice = null;
        this.highestPrice = type === 'LONG' ? entryPrice : null;
        this.lowestPrice = type === 'SHORT' ? entryPrice : null;
        this.pnl = 0;
        this.pnlPct = 0;
        this.status = 'OPEN';
        this.exitReason = null;
    }
    
    calculateTakeProfit() {
        if (!state.settings.useTakeProfit) return null;
        
        const tp = this.type === 'LONG' 
            ? this.entryPrice * (1 + state.settings.takeProfitPct / 100)
            : this.entryPrice * (1 - state.settings.takeProfitPct / 100);
        
        return parseFloat(tp.toFixed(2));
    }
    
    calculateStopLoss() {
        if (!state.settings.useStopLoss) return null;
        
        const sl = this.type === 'LONG'
            ? this.entryPrice * (1 - state.settings.stopLossPct / 100)
            : this.entryPrice * (1 + state.settings.stopLossPct / 100);
        
        return parseFloat(sl.toFixed(2));
    }
    
    updateTrailingStop(currentPrice) {
        if (!state.settings.useTrailingStop) return;
        
        if (this.type === 'LONG' && currentPrice > this.highestPrice) {
            this.highestPrice = currentPrice;
            this.trailingStopPrice = currentPrice * (1 - state.settings.trailingStopPct / 100);
        } else if (this.type === 'SHORT' && (this.lowestPrice === null || currentPrice < this.lowestPrice)) {
            this.lowestPrice = currentPrice;
            this.trailingStopPrice = currentPrice * (1 + state.settings.trailingStopPct / 100);
        }
    }
    
    getUnrealizedPnl(currentPrice) {
        if (this.type === 'LONG') {
            return (currentPrice - this.entryPrice) * this.size;
        } else {
            return (this.entryPrice - currentPrice) * this.size;
        }
    }
    
    getUnrealizedPnlPct(currentPrice) {
        if (this.type === 'LONG') {
            return (currentPrice - this.entryPrice) / this.entryPrice;
        } else {
            return (this.entryPrice - currentPrice) / this.entryPrice;
        }
    }
    
    close(exitPrice, timestamp, reason) {
        this.exitPrice = exitPrice;
        this.exitTime = timestamp || new Date();
        this.status = 'CLOSED';
        this.exitReason = reason;
        
        if (this.type === 'LONG') {
            this.pnl = (this.exitPrice - this.entryPrice) * this.size;
            this.pnlPct = (this.exitPrice - this.entryPrice) / this.entryPrice;
        } else {
            this.pnl = (this.entryPrice - this.exitPrice) * this.size;
            this.pnlPct = (this.entryPrice - this.exitPrice) / this.entryPrice;
        }
        
        return this.pnl;
    }
}

// API Client for exchange interactions
class ExchangeAPIClient {
    constructor() {
        this.baseUrl = state.settings.useTestnet ? 
            'https://testnet.binance.vision/api' : 
            'https://api.binance.com/api';
        this.apiKey = state.settings.apiKey;
        this.apiSecret = state.settings.apiSecret;
    }
    
    // Generate signature for authenticated requests
    generateSignature(queryString) {
        const crypto = window.crypto.subtle;
        const encoder = new TextEncoder();
        
        return new Promise((resolve, reject) => {
            const key = encoder.encode(this.apiSecret);
            const message = encoder.encode(queryString);
            
            crypto.importKey(
                'raw',
                key,
                { name: 'HMAC', hash: { name: 'SHA-256' } },
                false,
                ['sign']
            ).then(key => {
                return crypto.sign('HMAC', key, message);
            }).then(signature => {
                const hashArray = Array.from(new Uint8Array(signature));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                resolve(hashHex);
            }).catch(error => {
                reject(error);
            });
        });
    }
    
    // Make authenticated request to the exchange
    async makeAuthenticatedRequest(endpoint, method = 'GET', params = {}) {
        try {
            // Add timestamp for signature
            const timestamp = Date.now();
            params.timestamp = timestamp;
            
            // Convert params to query string
            const queryString = Object.entries(params)
                .map(([key, value]) => `${key}=${value}`)
                .join('&');
            
            // Generate signature
            const signature = await this.generateSignature(queryString);
            
            // Prepare request options
            const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;
            const options = {
                method: method,
                headers: {
                    'X-MBX-APIKEY': this.apiKey
                }
            };
            
            // Make request
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData.msg || response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            addLogMessage(`API Request Error: ${error.message}`, false, true);
            throw error;
        }
    }
    
    // Make public request to the exchange
    async makePublicRequest(endpoint, params = {}) {
        try {
            // Convert params to query string
            const queryString = Object.entries(params)
                .map(([key, value]) => `${key}=${value}`)
                .join('&');
            
            // Prepare request URL
            const url = `${this.baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;
            
            // Make request
            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData.msg || response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            addLogMessage(`API Request Error: ${error.message}`, false, true);
            throw error;
        }
    }
    
    // Get account information
    async getAccountInfo() {
        return this.makeAuthenticatedRequest('/v3/account', 'GET');
    }
    
    // Get candlestick data
    async getKlines(symbol, interval, limit = 500) {
        return this.makePublicRequest('/v3/klines', {
            symbol: symbol,
            interval: interval,
            limit: limit
        });
    }
    
    // Place a new order
    async placeOrder(symbol, side, type, quantity, price = null, timeInForce = 'GTC') {
        const params = {
            symbol: symbol,
            side: side, // 'BUY' or 'SELL'
            type: type, // 'LIMIT', 'MARKET', etc.
            quantity: quantity
        };
        
        // Add price and timeInForce for limit orders
        if (type === 'LIMIT') {
            params.price = price;
            params.timeInForce = timeInForce;
        }
        
        return this.makeAuthenticatedRequest('/v3/order', 'POST', params);
    }
    
    // Cancel an order
    async cancelOrder(symbol, orderId) {
        return this.makeAuthenticatedRequest('/v3/order', 'DELETE', {
            symbol: symbol,
            orderId: orderId
        });
    }
    
    // Get open orders
    async getOpenOrders(symbol) {
        return this.makeAuthenticatedRequest('/v3/openOrders', 'GET', {
            symbol: symbol
        });
    }
    
    // Test connectivity to the API
    async ping() {
        return this.makePublicRequest('/v3/ping');
    }
}

// Create API client instance
const apiClient = new ExchangeAPIClient();

// Initialize application
async function initialize() {
    addLogMessage('Volty Trading Bot v2.0.0 initializing...', false);
    
    // Load saved settings
    loadSettings();
    
    // Setup UI event listeners
    setupEventListeners();
    
    // Update UI with loaded settings
    updateUIFromSettings();
    
    // Initialize clock
    updateClock();
    setInterval(updateClock, 1000);
    
    // Check if API keys are set for live trading
    checkApiConfiguration();
    
    // Initialize TradingView chart
    try {
        await initializeTradingViewChart();
        
        // Hide loading indicator after chart is loaded
        document.getElementById('loadingIndicator').style.display = 'none';
        addLogMessage('System initialized and ready', false);
        document.getElementById('activity-status').textContent = 'Ready to start trading';
        
        // Fetch initial market data
        await fetchMarketData();
    } catch (error) {
        document.getElementById('loadingIndicator').style.display = 'none';
        addLogMessage(`Initialization error: ${error.message}`, false, true);
        showStatusBar(`Initialization error: ${error.message}`, 'error');
    }
}

// Load settings from localStorage
function loadSettings() {
    const savedSettings = localStorage.getItem('voltySettings');
    if (savedSettings) {
        try {
            const parsedSettings = JSON.parse(savedSettings);
            state.settings = { ...state.settings, ...parsedSettings };
            
            // Load strategy parameters
            if (parsedSettings.bbLength) state.bbLength = parsedSettings.bbLength;
            if (parsedSettings.bbDeviation) state.bbDeviation = parsedSettings.bbDeviation;
            if (parsedSettings.volumeCandles) state.volumeCandles = parsedSettings.volumeCandles;
            if (parsedSettings.volumeIncrease) state.volumeIncrease = parsedSettings.volumeIncrease;
            if (parsedSettings.initialCapital) {
                state.initialCapital = parsedSettings.initialCapital;
                state.balance = parsedSettings.initialCapital;
            }
            if (parsedSettings.symbol) state.symbol = parsedSettings.symbol;
            if (parsedSettings.timeframe) state.timeframe = parsedSettings.timeframe;
            
            addLogMessage('Settings loaded from local storage');
        } catch (error) {
            addLogMessage('Error loading settings: ' + error.message, false, true);
        }
    }
}

// Save settings to localStorage
function saveSettings() {
    try {
        // Combine all settings into one object
        const settingsToSave = {
            ...state.settings,
            bbLength: state.bbLength,
            bbDeviation: state.bbDeviation,
            volumeCandles: state.volumeCandles,
            volumeIncrease: state.volumeIncrease,
            initialCapital: state.initialCapital,
            symbol: state.symbol,
            timeframe: state.timeframe
        };
        
        localStorage.setItem('voltySettings', JSON.stringify(settingsToSave));
        addLogMessage('Settings saved to local storage');
        showStatusBar('Settings saved successfully', 'success');
    } catch (error) {
        addLogMessage('Error saving settings: ' + error.message, false, true);
        showStatusBar('Error saving settings', 'error');
    }
}

// Update UI elements from current settings
function updateUIFromSettings() {
    // Update strategy parameters
    document.getElementById('bb-length').value = state.bbLength;
    document.getElementById('bb-length-value').textContent = state.bbLength;
    
    document.getElementById('bb-dev').value = state.bbDeviation;
    document.getElementById('bb-dev-value').textContent = state.bbDeviation;
    
    document.getElementById('volume-candles').value = state.volumeCandles;
    document.getElementById('volume-candles-value').textContent = state.volumeCandles;
    
    document.getElementById('volume-increase').value = state.volumeIncrease;
    document.getElementById('volume-increase-value').textContent = state.volumeIncrease;
    
    // Update account settings
    document.getElementById('initial-capital').value = state.initialCapital;
    
    document.getElementById('position-size').value = state.settings.positionSize;
    document.getElementById('position-size-value').textContent = state.settings.positionSize + '%';
    
    // Update risk management settings
    document.getElementById('take-profit-toggle').checked = state.settings.useTakeProfit;
    document.getElementById('take-profit-value').value = state.settings.takeProfitPct;
    document.getElementById('take-profit-value').disabled = !state.settings.useTakeProfit;
    
    document.getElementById('stop-loss-toggle').checked = state.settings.useStopLoss;
    document.getElementById('stop-loss-value').value = state.settings.stopLossPct;
    document.getElementById('stop-loss-value').disabled = !state.settings.useStopLoss;
    
    document.getElementById('trailing-stop-toggle').checked = state.settings.useTrailingStop;
    document.getElementById('trailing-stop-value').value = state.settings.trailingStopPct;
    document.getElementById('trailing-stop-value').disabled = !state.settings.useTrailingStop;
    
    document.getElementById('auto-trade-toggle').checked = state.settings.autoTrade;
    document.getElementById('show-position-lines-toggle').checked = state.settings.showPositionLines;
    
    // Update API settings
    document.getElementById('api-key').value = state.settings.apiKey ? '********' : '';
    document.getElementById('api-secret').value = state.settings.apiSecret ? '********' : '';
    document.getElementById('use-testnet-toggle').checked = state.settings.useTestnet;
    
    // Update notification settings
    document.getElementById('browser-notifications-toggle').checked = state.settings.browserNotifications;
    document.getElementById('sound-notifications-toggle').checked = state.settings.soundNotifications;
    document.getElementById('discord-notifications-toggle').checked = state.settings.discordNotifications;
    document.getElementById('discord-webhook').value = state.settings.discordWebhook;
    document.getElementById('discord-webhook').disabled = !state.settings.discordNotifications;
    
    // Update market info
    document.getElementById('market-symbol-badge').textContent = state.symbol.replace('USDT', '/USDT');
    document.getElementById('market-symbol').textContent = state.symbol.replace('USDT', '/USDT');
    
    // Update symbol selection
    const symbolSelect = document.getElementById('symbol');
    if (symbolSelect) {
        for (let i = 0; i < symbolSelect.options.length; i++) {
            if (symbolSelect.options[i].value === state.symbol) {
                symbolSelect.selectedIndex = i;
                break;
            }
        }
    }
    
    // Update timeframe selection
    const timeframeSelect = document.getElementById('timeframe');
    if (timeframeSelect) {
        for (let i = 0; i < timeframeSelect.options.length; i++) {
            if (timeframeSelect.options[i].value === state.timeframe) {
                timeframeSelect.selectedIndex = i;
                break;
            }
        }
    }
}

// Setup all event listeners
function setupEventListeners() {
    // Symbol change
    document.getElementById('symbol').addEventListener('change', function() {
        state.symbol = this.value;
        document.getElementById('market-symbol-badge').textContent = state.symbol.replace('USDT', '/USDT');
        document.getElementById('market-symbol').textContent = state.symbol.replace('USDT', '/USDT');
        
        if (state.isRunning) {
            resetTrading();
            startTrading();
        } else {
            initializeTradingViewChart();
        }
    });
    
    // Timeframe change
    document.getElementById('timeframe').addEventListener('change', function() {
        state.timeframe = this.value;
        
        if (state.isRunning) {
            resetTrading();
            startTrading();
        } else {
            initializeTradingViewChart();
        }
    });
    
    // Strategy parameter changes
    document.getElementById('bb-length').addEventListener('input', function() {
        state.bbLength = parseInt(this.value);
        document.getElementById('bb-length-value').textContent = state.bbLength;
    });
    
    document.getElementById('bb-dev').addEventListener('input', function() {
        state.bbDeviation = parseFloat(this.value);
        document.getElementById('bb-dev-value').textContent = state.bbDeviation;
    });
    
    document.getElementById('volume-candles').addEventListener('input', function() {
        state.volumeCandles = parseInt(this.value);
        document.getElementById('volume-candles-value').textContent = state.volumeCandles;
    });
    
    document.getElementById('volume-increase').addEventListener('input', function() {
        state.volumeIncrease = parseInt(this.value);
        document.getElementById('volume-increase-value').textContent = state.volumeIncrease;
    });
    
    // Account settings changes
    document.getElementById('initial-capital').addEventListener('change', function() {
        state.initialCapital = parseFloat(this.value);
        if (!state.isRunning) {
            state.balance = state.initialCapital;
        }
    });
    
    document.getElementById('position-size').addEventListener('input', function() {
        state.settings.positionSize = parseInt(this.value);
        document.getElementById('position-size-value').textContent = state.settings.positionSize + '%';
    });
    
    // Risk management toggles
    document.getElementById('take-profit-toggle').addEventListener('change', function() {
        state.settings.useTakeProfit = this.checked;
        document.getElementById('take-profit-value').disabled = !this.checked;
        
        if (state.currentPosition) {
            state.currentPosition.takeProfitPrice = state.currentPosition.calculateTakeProfit();
            updatePositionInfo();
        }
    });
    
    document.getElementById('take-profit-value').addEventListener('change', function() {
        state.settings.takeProfitPct = parseFloat(this.value);
        
        if (state.currentPosition) {
            state.currentPosition.takeProfitPrice = state.currentPosition.calculateTakeProfit();
            updatePositionInfo();
        }
    });
    
    document.getElementById('stop-loss-toggle').addEventListener('change', function() {
        state.settings.useStopLoss = this.checked;
        document.getElementById('stop-loss-value').disabled = !this.checked;
        
        if (state.currentPosition) {
            state.currentPosition.stopLossPrice = state.currentPosition.calculateStopLoss();
            updatePositionInfo();
        }
    });
    
    document.getElementById('stop-loss-value').addEventListener('change', function() {
        state.settings.stopLossPct = parseFloat(this.value);
        
        if (state.currentPosition) {
            state.currentPosition.stopLossPrice = state.currentPosition.calculateStopLoss();
            updatePositionInfo();
        }
    });
    
    document.getElementById('trailing-stop-toggle').addEventListener('change', function() {
        state.settings.useTrailingStop = this.checked;
        document.getElementById('trailing-stop-value').disabled = !this.checked;
    });
    
    document.getElementById('trailing-stop-value').addEventListener('change', function() {
        state.settings.trailingStopPct = parseFloat(this.value);
    });
    
    document.getElementById('auto-trade-toggle').addEventListener('change', function() {
        state.settings.autoTrade = this.checked;
    });
    
    document.getElementById('show-position-lines-toggle').addEventListener('change', function() {
        state.settings.showPositionLines = this.checked;
        
        if (state.currentPosition) {
            updatePositionInfo();
        }
    });
    
    // API settings
    document.getElementById('save-api-btn').addEventListener('click', function() {
        const apiKey = document.getElementById('api-key').value;
        const apiSecret = document.getElementById('api-secret').value;
        
        if (apiKey && apiKey !== '********') {
            state.settings.apiKey = apiKey;
        }
        
        if (apiSecret && apiSecret !== '********') {
            state.settings.apiSecret = apiSecret;
        }
        
        state.settings.useTestnet = document.getElementById('use-testnet-toggle').checked;
        
        saveSettings();
        checkApiConfiguration();
    });
    
    document.getElementById('test-api-btn').addEventListener('click', function() {
        testApiConnection();
    });
    
    // Notification settings
    document.getElementById('browser-notifications-toggle').addEventListener('change', function() {
        state.settings.browserNotifications = this.checked;
        
        if (this.checked) {
            requestNotificationPermission();
        }
    });
    
    document.getElementById('sound-notifications-toggle').addEventListener('change', function() {
        state.settings.soundNotifications = this.checked;
    });
    
    document.getElementById('discord-notifications-toggle').addEventListener('change', function() {
        state.settings.discordNotifications = this.checked;
        document.getElementById('discord-webhook').disabled = !this.checked;
    });
    
    document.getElementById('discord-webhook').addEventListener('change', function() {
        state.settings.discordWebhook = this.value;
    });
    
    document.getElementById('test-discord-btn').addEventListener('click', function() {
        testDiscordWebhook();
    });
    
    // Save all settings
    document.getElementById('save-settings-btn').addEventListener('click', function() {
        saveSettings();
    });
    
    // Trading mode buttons
    document.getElementById('paper-trading-btn').addEventListener('click', function() {
        if (state.isLiveTrading) {
            showStatusBar('Please stop live trading first', 'warning');
            return;
        }
        
        this.classList.add('active');
        document.getElementById('live-trading-btn').classList.remove('active');
        state.isLiveTrading = false;
        
        document.getElementById('practice-mode-indicator').style.display = 'flex';
        document.getElementById('live-mode-indicator').style.display = 'none';
        
        document.getElementById('paper-trading-buttons').style.display = 'flex';
        document.getElementById('live-trading-buttons').style.display = 'none';
        
        addLogMessage('Switched to paper trading mode');
    });
    
    document.getElementById('live-trading-btn').addEventListener('click', function() {
        if (!checkApiConfiguration(true)) {
            return;
        }
        
        this.classList.add('active');
        document.getElementById('paper-trading-btn').classList.remove('active');
        state.isLiveTrading = true;
        
        document.getElementById('practice-mode-indicator').style.display = 'none';
        document.getElementById('live-mode-indicator').style.display = 'flex';
        
        document.getElementById('paper-trading-buttons').style.display = 'none';
        document.getElementById('live-trading-buttons').style.display = 'flex';
        
        addLogMessage('Switched to live trading mode', false, true);
    });
    
    // Trading buttons
    document.getElementById('start-trading-btn').addEventListener('click', function() {
        startTrading();
    });
    
    document.getElementById('stop-trading-btn').addEventListener('click', function() {
        stopTrading();
    });
    
    document.getElementById('reset-trading-btn').addEventListener('click', function() {
        resetTrading();
    });
    
    document.getElementById('start-live-trading-btn').addEventListener('click', function() {
        if (!checkApiConfiguration(true)) {
            return;
        }
        
        startTrading(true);
    });
    
    document.getElementById('stop-live-trading-btn').addEventListener('click', function() {
        stopTrading();
    });
    
    // Position close button
    document.getElementById('position-close-btn').addEventListener('click', function() {
        if (state.currentPosition) {
            closePosition('Manual close');
            addLogMessage(`Position manually closed at $${state.currentPrice.toFixed(2)}`);
        }
    });
    
    // Widget panel toggle
    document.getElementById('widget-panel-toggle').addEventListener('click', function() {
        document.getElementById('widget-panel').classList.toggle('open');
    });
    
    // Sidebar toggle
    document.getElementById('sidebar-toggle').addEventListener('click', function() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('sidebar-collapsed');
        this.classList.toggle('collapsed');
        
        if (sidebar.classList.contains('sidebar-collapsed')) {
            this.innerHTML = '<i class="fas fa-chevron-right"></i>';
        } else {
            this.innerHTML = '<i class="fas fa-chevron-left"></i>';
        }
    });
    
    // Refresh widgets button
    document.getElementById('refresh-widgets-btn').addEventListener('click', function() {
        updateMarketInfo();
        updatePerformanceMetrics();
    });
    
    // API Configuration Modal handlers
    document.getElementById('closeApiConfigModal').addEventListener('click', function() {
        document.getElementById('apiConfigModal').style.display = 'none';
    });

    document.getElementById('cancelApiConfig').addEventListener('click', function() {
        document.getElementById('apiConfigModal').style.display = 'none';
    });

    document.getElementById('saveApiConfig').addEventListener('click', function() {
        const apiKey = document.getElementById('modal-api-key').value;
        const apiSecret = document.getElementById('modal-api-secret').value;
        const useTestnet = document.getElementById('modal-use-testnet-toggle').checked;
        
        if (apiKey && apiSecret) {
            state.settings.apiKey = apiKey;
            state.settings.apiSecret = apiSecret;
            state.settings.useTestnet = useTestnet;
            
            // Update sidebar inputs
            document.getElementById('api-key').value = '********';
            document.getElementById('api-secret').value = '********';
            document.getElementById('use-testnet-toggle').checked = useTestnet;
            
            saveSettings();
            document.getElementById('apiConfigModal').style.display = 'none';
            showStatusBar('API configuration saved', 'success');
        } else {
            showStatusBar('Please enter API Key and Secret', 'error');
        }
    });

    // Log toggle
    document.getElementById('log-toggle-btn').addEventListener('click', function() {
        document.getElementById('log-container').classList.toggle('open');
    });
}

// Check API configuration
function checkApiConfiguration(showAlert = false) {
    const hasApiKey = state.settings.apiKey && state.settings.apiKey.length > 0;
    const hasApiSecret = state.settings.apiSecret && state.settings.apiSecret.length > 0;
    
    if (hasApiKey && hasApiSecret) {
        return true;
    } else if (showAlert) {
        showStatusBar('Please configure API keys first', 'warning');
        document.getElementById('apiConfigModal').style.display = 'flex';
    }
    
    return false;
}

// Test API connection
async function testApiConnection() {
    if (!checkApiConfiguration(true)) {
        return;
    }
    
    addLogMessage('Testing API connection...');
    showStatusBar('Testing API connection...', 'info');
    
    try {
        await apiClient.ping();
        addLogMessage('API connection successful', true);
        showStatusBar('API connection successful', 'success');
    } catch (error) {
        addLogMessage(`API connection failed: ${error.message}`, false, true);
        showStatusBar('API connection failed', 'error');
    }
}

// Test Discord webhook
async function testDiscordWebhook() {
    if (!state.settings.discordNotifications) {
        showStatusBar('Discord notifications are disabled', 'warning');
        return;
    }
    
    if (!state.settings.discordWebhook) {
        showStatusBar('Please enter Discord webhook URL', 'warning');
        return;
    }
    
    addLogMessage('Testing Discord webhook...');
    showStatusBar('Sending test message to Discord...', 'info');
    
    try {
        const response = await fetch(state.settings.discordWebhook, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: 'Volty Trading Bot - Test Message',
                embeds: [{
                    title: 'Connection Test',
                    description: 'This is a test message from Volty Trading Bot.',
                    color: 0x4f46e5
                }]
            })
        });
        
        if (response.ok) {
            addLogMessage('Discord webhook test message sent', true);
            showStatusBar('Discord test message sent', 'success');
        } else {
            throw new Error('Failed to send message to Discord');
        }
    } catch (error) {
        addLogMessage(`Discord webhook test failed: ${error.message}`, false, true);
        showStatusBar('Discord webhook test failed', 'error');
    }
}

// Request notification permission
function requestNotificationPermission() {
    if (!('Notification' in window)) {
        addLogMessage('Browser does not support notifications', false, true);
        return;
    }
    
    if (Notification.permission === 'granted') {
        return;
    }
    
    if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                addLogMessage('Notification permission granted');
            } else {
                addLogMessage('Notification permission denied');
                state.settings.browserNotifications = false;
                document.getElementById('browser-notifications-toggle').checked = false;
            }
        });
    }
}

// Send browser notification
function sendNotification(title, message) {
    if (!state.settings.browserNotifications) return;
    
    if (Notification.permission === 'granted') {
        const notification = new Notification(title, {
            body: message,
            icon: 'https://cdn-icons-png.flaticon.com/512/6295/6295417.png'
        });
        
        notification.onclick = function() {
            window.focus();
            this.close();
        };
    }
}

// Play notification sound
function playNotificationSound(type = 'alert') {
    if (!state.settings.soundNotifications) return;
    
    const sounds = {
        alert: new Audio('assets/sounds/alert.mp3'),
        open: new Audio('assets/sounds/open.mp3'),
        profit: new Audio('assets/sounds/profit.mp3'),
        loss: new Audio('assets/sounds/loss.mp3'),
        start: new Audio('assets/sounds/start.mp3')
    };
    
    if (sounds[type]) {
        sounds[type].play().catch(error => {
            // Silently handle autoplay restrictions
        });
    }
}

// Send Discord notification
async function sendDiscordNotification(message) {
    if (!state.settings.discordNotifications || !state.settings.discordWebhook) return;
    
    try {
        await fetch(state.settings.discordWebhook, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: message
            })
        });
    } catch (error) {
        addLogMessage(`Failed to send Discord notification: ${error.message}`, false, true);
    }
}

// Start the trading bot
async function startTrading(isLive = false) {
    if (state.isRunning) {
        showStatusBar('Trading is already running', 'info');
        return;
    }
    
    if (isLive && !checkApiConfiguration(true)) {
        return;
    }
    
    state.isRunning = true;
    state.isLiveTrading = isLive;
    state.status = 'running';
    
    // Update UI
    document.getElementById('bot-status').classList.remove('idle');
    document.getElementById('bot-status').classList.add('active');
    document.getElementById('bot-activity').classList.remove('waiting');
    document.getElementById('bot-activity').classList.add('scanning');
    document.getElementById('bot-status').innerHTML = `
        <div class="bot-activity scanning" id="bot-activity"></div>
        <span>BOT ACTIVE</span>
    `;
    
    document.getElementById('start-trading-btn').disabled = true;
    document.getElementById('stop-trading-btn').disabled = false;
    document.getElementById('start-live-trading-btn').disabled = true;
    document.getElementById('stop-live-trading-btn').disabled = false;
    
    // Log the start
    if (isLive) {
        addLogMessage(`Live trading started on ${state.symbol} (${state.timeframe})`, false, true);
        sendNotification('Volty Trading Bot', 'Live trading started');
        playNotificationSound('start');
    } else {
        addLogMessage(`Paper trading started on ${state.symbol} (${state.timeframe})`);
    }
    
    // Fetch initial data
    try {
        await fetchMarketData();
        
        // Start the trading loop
        runTradingLoop();
    } catch (error) {
        addLogMessage(`Error starting trading: ${error.message}`, false, true);
        stopTrading();
        showStatusBar(`Error starting trading: ${error.message}`, 'error');
    }
}

// Stop the trading bot
function stopTrading() {
    if (!state.isRunning) {
        return;
    }
    
    state.isRunning = false;
    state.status = 'idle';
    
    // Update UI
    document.getElementById('bot-status').classList.remove('active');
    document.getElementById('bot-status').classList.add('idle');
    document.getElementById('bot-activity').classList.remove('scanning');
    document.getElementById('bot-activity').classList.add('waiting');
    document.getElementById('bot-status').innerHTML = `
        <div class="bot-activity waiting" id="bot-activity"></div>
        <span>BOT IDLE</span>
    `;
    
    document.getElementById('start-trading-btn').disabled = false;
    document.getElementById('stop-trading-btn').disabled = true;
    document.getElementById('start-live-trading-btn').disabled = false;
    document.getElementById('stop-live-trading-btn').disabled = true;
    
    // Log the stop
    if (state.isLiveTrading) {
        addLogMessage('Live trading stopped', false, true);
        sendNotification('Volty Trading Bot', 'Live trading stopped');
    } else {
        addLogMessage('Paper trading stopped');
    }
    
    document.getElementById('activity-status').textContent = 'Trading stopped';
}

// Reset trading state
function resetTrading() {
    if (state.isRunning) {
        stopTrading();
    }
    
    // Reset state
    state.balance = state.initialCapital;
    state.currentPosition = null;
    state.trades = [];
    state.priceData = [];
    state.volumeData = [];
    
    // Update UI
    updatePositionInfo();
    updatePerformanceMetrics();
    
    // Log the reset
    addLogMessage('Trading state reset');
    document.getElementById('activity-status').textContent = 'Trading state reset. Ready to start.';
    showStatusBar('Trading state reset', 'info');
}

// Close current position
async function closePosition(reason) {
    if (!state.currentPosition) return;
    
    try {
        // If in live trading mode, place an actual order
        if (state.isLiveTrading) {
            const side = state.currentPosition.type === 'LONG' ? 'SELL' : 'BUY';
            const order = await apiClient.placeOrder(
                state.symbol,
                side,
                'MARKET',
                state.currentPosition.size
            );
            
            // Use the actual execution price from the order
            state.currentPrice = parseFloat(order.price) || state.currentPrice;
        }
        
        const pnl = state.currentPosition.close(state.currentPrice, new Date(), reason);
        state.balance += pnl;
        
        // Add to trade history
        state.trades.push(state.currentPosition);
        
        // Log the close
        const pnlPct = state.currentPosition.pnlPct * 100;
        const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(2)} (+${pnlPct.toFixed(2)}%)` : `-$${Math.abs(pnl).toFixed(2)} (${pnlPct.toFixed(2)}%)`;
        
        if (pnl >= 0) {
            addLogMessage(`${state.currentPosition.type} position closed with profit: ${pnlStr}. Reason: ${reason}`, true);
            if (state.isLiveTrading) {
                sendNotification('Position Closed', `${state.currentPosition.type} closed with profit: ${pnlStr}`);
                playNotificationSound('profit');
                sendDiscordNotification(`🟢 CLOSED ${state.currentPosition.type} with PROFIT: ${pnlStr} | ${state.symbol}`);
            }
        } else {
            addLogMessage(`${state.currentPosition.type} position closed with loss: ${pnlStr}. Reason: ${reason}`, false, true);
            if (state.isLiveTrading) {
                sendNotification('Position Closed', `${state.currentPosition.type} closed with loss: ${pnlStr}`);
                playNotificationSound('loss');
                sendDiscordNotification(`🔴 CLOSED ${state.currentPosition.type} with LOSS: ${pnlStr} | ${state.symbol}`);
            }
        }
        
        // Clear position and update UI
        state.currentPosition = null;
        updatePositionInfo();
        updatePerformanceMetrics();
    } catch (error) {
        addLogMessage(`Error closing position: ${error.message}`, false, true);
        showStatusBar(`Error closing position: ${error.message}`, 'error');
    }
}

// Open a new position
async function openPosition(type) {
    try {
        if (state.currentPosition) {
            await closePosition('New signal');
        }
        
        // Calculate position size
        const positionSize = (state.balance * state.settings.positionSize / 100) / state.currentPrice;
        
        // If in live trading mode, place an actual order
        if (state.isLiveTrading) {
            const side = type === 'LONG' ? 'BUY' : 'SELL';
            const order = await apiClient.placeOrder(
                state.symbol,
                side,
                'MARKET',
                positionSize
            );
            
            // Use the actual execution price from the order
            state.currentPrice = parseFloat(order.price) || state.currentPrice;
        }
        
        // Create position object
        state.currentPosition = new Position(type, state.currentPrice, positionSize, new Date());
        
        // Log the open
        addLogMessage(`${type} position opened at $${state.currentPrice.toFixed(2)} with size: ${positionSize.toFixed(6)}`, true);
        
        if (state.isLiveTrading) {
            sendNotification('Position Opened', `${type} opened at $${state.currentPrice.toFixed(2)}`);
            playNotificationSound('open');
            sendDiscordNotification(`📊 OPENED ${type} position at $${state.currentPrice.toFixed(2)} | ${state.symbol}`);
        }
        
        // Update UI
        updatePositionInfo();
    } catch (error) {
        addLogMessage(`Error opening position: ${error.message}`, false, true);
        showStatusBar(`Error opening position: ${error.message}`, 'error');
    }
}

// Fetch market data from the exchange
async function fetchMarketData() {
    try {
        document.getElementById('activity-status').textContent = 'Fetching market data...';
        
        // Get klines data from the exchange
        const klines = await apiClient.getKlines(state.symbol, state.timeframe);
        
        // Process klines data
        state.priceData = [];
        state.volumeData = [];
        
        klines.forEach(candle => {
            // Klines data format: [open time, open, high, low, close, volume, ...]
            const closePrice = parseFloat(candle[4]);
            const volume = parseFloat(candle[5]);
            
            state.priceData.push(closePrice);
            state.volumeData.push(volume);
        });
        
        // Update current price (last candle)
        if (state.priceData.length > 0) {
            state.currentPrice = state.priceData[state.priceData.length - 1];
        }
        
        // Update market info
        updateMarketInfo();
        
        document.getElementById('activity-status').textContent = 'Market data updated';
        
        return true;
    } catch (error) {
        addLogMessage(`Error fetching market data: ${error.message}`, false, true);
        document.getElementById('activity-status').textContent = 'Error fetching market data';
        throw error;
    }
}

// Update market info display
function updateMarketInfo() {
    if (state.priceData.length > 0) {
        const currentPrice = state.currentPrice;
        const previousPrice = state.priceData[state.priceData.length - 2] || currentPrice;
        const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;
        const volume = state.volumeData[state.volumeData.length - 1];
        
        document.getElementById('market-price').textContent = `$${currentPrice.toFixed(2)}`;
        
        const changeElement = document.getElementById('market-change');
        if (priceChange >= 0) {
            changeElement.textContent = `+${priceChange.toFixed(2)}%`;
            changeElement.style.color = 'var(--success-color)';
        } else {
            changeElement.textContent = `${priceChange.toFixed(2)}%`;
            changeElement.style.color = 'var(--danger-color)';
        }
        
        document.getElementById('market-volume').textContent = `$${(volume / 1000).toFixed(2)}M`;
    }
}

// Main trading loop
async function runTradingLoop() {
    if (!state.isRunning) return;
    
    try {
        // Update the last check time
        state.lastUpdate = new Date();
        document.getElementById('last-tick-info').textContent = state.lastUpdate.toLocaleTimeString();
        
        // Fetch fresh market data
        await fetchMarketData();
        
        // Update current position if exists
        if (state.currentPosition) {
            checkPositionStatus();
        }
        
        // Generate trading signals
        if (state.settings.autoTrade) {
            generateTradingSignals();
        }
        
        // Update UI
        updatePositionInfo();
        updatePerformanceMetrics();
        
        // Continue the loop
        const timeframe = state.timeframe;
        let interval = 5000; // Default 5 seconds
        
        if (timeframe === '1m') interval = 5000;
        else if (timeframe === '5m') interval = 10000;
        else if (timeframe === '15m') interval = 15000;
        else if (timeframe === '30m') interval = 20000;
        else if (timeframe === '1h') interval = 25000;
        else if (timeframe === '4h') interval = 30000;
        else if (timeframe === '1d') interval = 35000;
        
        // Schedule next update
        document.getElementById('activity-status').textContent = `Analyzing market data... Next update in ${interval/1000}s`;
        setTimeout(runTradingLoop, interval);
    } catch (error) {
        addLogMessage(`Error in trading loop: ${error.message}`, false, true);
        document.getElementById('activity-status').textContent = 'Trading error occurred';
        
        // Try to continue after a delay
        setTimeout(() => {
            if (state.isRunning) {
                addLogMessage('Attempting to resume trading loop...', false, true);
                runTradingLoop();
            }
        }, 30000); // Wait 30 seconds before retry
    }
}

// Check if current position needs to be closed
function checkPositionStatus() {
    if (!state.currentPosition) return;
    
    const position = state.currentPosition;
    const currentPrice = state.currentPrice;
    
    // Update trailing stop if enabled
    if (state.settings.useTrailingStop) {
        position.updateTrailingStop(currentPrice);
    }
    
    // Check take profit
    if (position.takeProfitPrice !== null) {
        if ((position.type === 'LONG' && currentPrice >= position.takeProfitPrice) ||
            (position.type === 'SHORT' && currentPrice <= position.takeProfitPrice)) {
            closePosition('Take Profit');
            return;
        }
    }
    
    // Check stop loss
    if (position.stopLossPrice !== null) {
        if ((position.type === 'LONG' && currentPrice <= position.stopLossPrice) ||
            (position.type === 'SHORT' && currentPrice >= position.stopLossPrice)) {
            closePosition('Stop Loss');
            return;
        }
    }
    
    // Check trailing stop
    if (position.trailingStopPrice !== null) {
        if ((position.type === 'LONG' && currentPrice <= position.trailingStopPrice) ||
            (position.type === 'SHORT' && currentPrice >= position.trailingStopPrice)) {
            closePosition('Trailing Stop');
            return;
        }
    }
}

// Generate trading signals based on strategy
function generateTradingSignals() {
    // Strategy using Bollinger Bands and volume
    const prices = state.priceData;
    const volumes = state.volumeData;
    
    if (prices.length < Math.max(20, state.bbLength)) {
        return; // Not enough data
    }
    
    // Calculate SMA
    const sma = calculateSMA(prices, state.bbLength);
    
    // Calculate standard deviation
    const stdDev = calculateStdDev(prices, sma, state.bbLength);
    
    // Calculate Bollinger Bands
    const upperBand = sma + (stdDev * state.bbDeviation);
    const lowerBand = sma - (stdDev * state.bbDeviation);
    
    // Check if price is outside Bollinger Bands
    const currentPrice = state.currentPrice;
    
    // Check volume increase
    const recentVolumes = volumes.slice(-state.volumeCandles);
    const avgVolume = calculateAverage(volumes.slice(-30)); // Last 30 candles
    const currentVolume = recentVolumes[recentVolumes.length - 1];
    const volumeIncrease = currentVolume / avgVolume * 100;
    
    // Generate signals
    if (currentPrice <= lowerBand && volumeIncrease >= state.volumeIncrease) {
        // Buy signal
        if (!state.currentPosition) {
            openPosition('LONG');
        } else if (state.currentPosition.type === 'SHORT') {
            closePosition('Reversal Signal');
            openPosition('LONG');
        }
    } else if (currentPrice >= upperBand && volumeIncrease >= state.volumeIncrease) {
        // Sell signal
        if (!state.currentPosition) {
            openPosition('SHORT');
        } else if (state.currentPosition.type === 'LONG') {
            closePosition('Reversal Signal');
            openPosition('SHORT');
        }
    }
}

// Calculate Simple Moving Average
function calculateSMA(data, period) {
    if (data.length < period) return 0;
    
    const slice = data.slice(-period);
    return calculateAverage(slice);
}

// Calculate Standard Deviation
function calculateStdDev(data, average, period) {
    if (data.length < period) return 0;
    
    const slice = data.slice(-period);
    const squareDiffs = slice.map(value => {
        const diff = value - average;
        return diff * diff;
    });
    
    const avgSquareDiff = calculateAverage(squareDiffs);
    return Math.sqrt(avgSquareDiff);
}

// Calculate average of array
function calculateAverage(data) {
    const sum = data.reduce((acc, val) => acc + val, 0);
    return sum / data.length;
}

// Update position information in UI
function updatePositionInfo() {
    const positionInfo = document.getElementById('position-info');
    const noPositionInfo = document.getElementById('no-position-info');
    const floatingIndicator = document.getElementById('floating-position-indicator');
    
    if (!state.currentPosition) {
        positionInfo.style.display = 'none';
        noPositionInfo.style.display = 'block';
        floatingIndicator.style.display = 'none';
        return;
    }
    
    const position = state.currentPosition;
    const currentPrice = state.currentPrice;
    const pnl = position.getUnrealizedPnl(currentPrice);
    const pnlPct = position.getUnrealizedPnlPct(currentPrice) * 100;
    
    // Update position info in widget panel
    positionInfo.style.display = 'block';
    noPositionInfo.style.display = 'none';
    
    document.getElementById('position-type').textContent = position.type;
    document.getElementById('position-type').style.color = position.type === 'LONG' ? 'var(--success-color)' : 'var(--danger-color)';
    
    document.getElementById('position-entry-price').textContent = `$${position.entryPrice.toFixed(2)}`;
    document.getElementById('position-current-price').textContent = `$${currentPrice.toFixed(2)}`;
    
    const pnlElement = document.getElementById('position-pnl');
    if (pnl >= 0) {
        pnlElement.textContent = `+$${pnl.toFixed(2)} (+${pnlPct.toFixed(2)}%)`;
        pnlElement.style.color = 'var(--success-color)';
    } else {
        pnlElement.textContent = `-$${Math.abs(pnl).toFixed(2)} (${pnlPct.toFixed(2)}%)`;
        pnlElement.style.color = 'var(--danger-color)';
    }
    
    document.getElementById('position-tp').textContent = position.takeProfitPrice ? `$${position.takeProfitPrice.toFixed(2)}` : 'N/A';
    document.getElementById('position-sl').textContent = position.stopLossPrice ? `$${position.stopLossPrice.toFixed(2)}` : 'N/A';
    
    // Update floating position indicator
    if (state.settings.showPositionLines) {
        floatingIndicator.style.display = 'block';
        floatingIndicator.className = `floating-position-indicator ${position.type.toLowerCase()}`;
        
        let content = `
            <div style="margin-bottom: 0.5rem; font-weight: 600;">
                ${position.type} Position
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span>Entry Price:</span>
                <span>$${position.entryPrice.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span>Current Price:</span>
                <span>$${currentPrice.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span>Size:</span>
                <span>${position.size.toFixed(6)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span>P&L:</span>
                <span style="color: ${pnl >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
                    ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)
                </span>
            </div>
        `;
        
        if (position.takeProfitPrice) {
            content += `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                    <span>Take Profit:</span>
                    <span style="color: var(--success-color)">$${position.takeProfitPrice.toFixed(2)}</span>
                </div>
            `;
        }
        
        if (position.stopLossPrice) {
            content += `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                    <span>Stop Loss:</span>
                    <span style="color: var(--danger-color)">$${position.stopLossPrice.toFixed(2)}</span>
                </div>
            `;
        }
        
        if (position.trailingStopPrice) {
            content += `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                    <span>Trailing Stop:</span>
                    <span style="color: var(--warning-color)">$${position.trailingStopPrice.toFixed(2)}</span>
                </div>
            `;
        }
        
        floatingIndicator.innerHTML = content;
    } else {
        floatingIndicator.style.display = 'none';
    }
}

// Update performance metrics in UI
function updatePerformanceMetrics() {
    // Calculate performance metrics
    const totalTrades = state.trades.length;
    const winningTrades = state.trades.filter(t => t.pnl > 0).length;
    const losingTrades = state.trades.filter(t => t.pnl <= 0).length;
    
    const totalProfit = state.trades.reduce((acc, t) => t.pnl > 0 ? acc + t.pnl : acc, 0);
    const totalLoss = Math.abs(state.trades.reduce((acc, t) => t.pnl <= 0 ? acc + t.pnl : acc, 0));
    
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;
    
    const returns = state.initialCapital > 0 ? ((state.balance - state.initialCapital) / state.initialCapital) * 100 : 0;
    
    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = state.initialCapital;
    let balance = state.initialCapital;
    
    for (const trade of state.trades) {
        balance += trade.pnl;
        if (balance > peak) {
            peak = balance;
        } else {
            const drawdown = (peak - balance) / peak * 100;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }
    }
    
    // Update UI elements
    const totalReturnElement = document.getElementById('total-return');
    if (returns >= 0) {
        totalReturnElement.textContent = `+${returns.toFixed(2)}%`;
        totalReturnElement.style.color = 'var(--success-color)';
    } else {
        totalReturnElement.textContent = `${returns.toFixed(2)}%`;
        totalReturnElement.style.color = 'var(--danger-color)';
    }
    
    document.getElementById('win-rate').textContent = `${winRate.toFixed(1)}%`;
    document.getElementById('profit-factor').textContent = profitFactor.toFixed(2);
    document.getElementById('max-drawdown').textContent = `${maxDrawdown.toFixed(2)}%`;
    
    // Calculate daily stats
    const today = new Date().toDateString();
    const todayTrades = state.trades.filter(t => new Date(t.exitTime).toDateString() === today);
    const todayPnl = todayTrades.reduce((acc, t) => acc + t.pnl, 0);
    
    document.getElementById('stat-daily-trades').textContent = todayTrades.length;
    
    const dailyPnlElement = document.getElementById('stat-daily-pnl');
    if (todayPnl >= 0) {
        dailyPnlElement.textContent = `+$${todayPnl.toFixed(2)}`;
        dailyPnlElement.style.color = 'var(--success-color)';
    } else {
        dailyPnlElement.textContent = `-$${Math.abs(todayPnl).toFixed(2)}`;
        dailyPnlElement.style.color = 'var(--danger-color)';
    }
}

// Update clock display
function updateClock() {
    const now = new Date();
    const utcString = now.toISOString().replace('T', ' ').substring(0, 19);
    document.getElementById('clock-display').textContent = utcString + ' UTC';
}

// Add message to log
function addLogMessage(message, isPositive = false, isImportant = false) {
    const logMessages = document.getElementById('logMessages');
    if (!logMessages) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logItem = document.createElement('div');
    logItem.className = 'log-message';
    
    if (isPositive) {
        logItem.classList.add('positive');
    } else if (isImportant) {
        logItem.classList.add('negative');
    }
    
    logItem.innerHTML = `<strong>${timestamp}</strong>: ${message}`;
    logMessages.appendChild(logItem);
    logMessages.scrollTop = logMessages.scrollHeight;
    
    // Also update the activity status
    document.getElementById('activity-status').textContent = message;
}

// Show status bar with message
function showStatusBar(message, type = 'info') {
    const statusBar = document.getElementById('status-bar');
    const statusMessage = document.getElementById('status-message');
    const statusProgress = document.getElementById('status-progress');
    
    statusBar.className = 'status-bar';
    statusBar.classList.add(`status-${type}`);
    statusMessage.textContent = message;
    statusBar.style.display = 'block';
    
    // Animate progress
    statusProgress.style.width = '0%';
    setTimeout(() => {
        statusProgress.style.width = '100%';
        statusProgress.style.transition = 'width 3s linear';
    }, 50);
    
    // Hide after 3 seconds
    setTimeout(() => {
        statusBar.style.display = 'none';
        statusProgress.style.transition = 'none';
        statusProgress.style.width = '0%';
    }, 3000);
}

// Fix UI overlays after chart loads
function fixUIOverlays() {
    const chart = document.querySelector('.tradingview-widget-container');
    if (!chart) return;
    
    // Ensure overlays are visible above the chart
    const overlays = [
        '.overlay-controls',
        '.mode-indicator',
        '.bot-controls',
        '.clock-container',
        '.floating-position-indicator',
        '.widget-panel-toggle'
    ];
    
    overlays.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.style.zIndex = '5';
        }
    });
}

// Initialize TradingView widget
async function initializeTradingViewChart() {
    try {
        // Find container
        const container = document.querySelector('.tradingview-widget-container__widget');
        if (!container) {
            throw new Error('Chart container not found');
        }
        
        // Reset the container to ensure no residual elements
        container.innerHTML = '';
        
                // Set up TradingView chart with iframe approach
        const symbol = state.symbol || 'BTCUSDT';
        const interval = state.timeframe || '1';
        
        // Create iframe element
        const iframe = document.createElement('iframe');
        iframe.id = 'tradingview_chart_frame';
        iframe.src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart_frame&symbol=BINANCE:${symbol}&interval=${interval}&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=1&timezone=exchange&withdateranges=1&showpopupbutton=1&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en&utm_source=voltybot&utm_medium=widget`;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.margin = '0';
        iframe.style.padding = '0';
        iframe.frameBorder = '0';
        iframe.allowTransparency = 'true';
        iframe.scrolling = 'no';
        iframe.allowFullscreen = true;
        
        // Append iframe to container
        container.appendChild(iframe);
        
        // Set up event listener to detect when chart is loaded
        return new Promise((resolve, reject) => {
            iframe.onload = () => {
                addLogMessage(`Chart initialized for ${symbol} (${interval})`);
                
                // Fix UI overlays after chart loads
                setTimeout(fixUIOverlays, 500);
                resolve();
            };
            
            iframe.onerror = () => {
                reject(new Error('Failed to load TradingView chart'));
            };
            
            // Set a timeout in case the iframe never loads
            setTimeout(() => {
                if (!iframe.contentWindow || !iframe.contentWindow.document.body) {
                    reject(new Error('TradingView chart loading timeout'));
                }
            }, 10000);
        });
    } catch (error) {
        addLogMessage('Error initializing chart: ' + error.message, false, true);
        throw error;
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);
