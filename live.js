/**
 * Volty Trading Bot v2.1.0
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
        
        // Chart settings
        darkMode: true,
        showVolume: true,
        showGrid: true,
        autoRefresh: true,
    },
    
    // Application state
    isRunning: false,
    isLiveTrading: false,
    lastUpdate: null,
    status: 'idle',
    tvWidget: null,
    activeView: 'live',
    currentModal: null,
    userDropdownOpen: false,
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
    
    // Get all available symbols with price info
    async getExchangeInfo() {
        return this.makePublicRequest('/v3/exchangeInfo');
    }
    
    // Get server time for syncing
    async getServerTime() {
        return this.makePublicRequest('/v3/time');
    }
}

// Create API client instance
const apiClient = new ExchangeAPIClient();

// Strategy class for different trading strategies
class TradingStrategy {
    constructor(name, description) {
        this.name = name;
        this.description = description;
        this.parameters = {};
        this.isActive = false;
    }
    
    setParameter(name, value) {
        this.parameters[name] = value;
    }
    
    getParameter(name) {
        return this.parameters[name];
    }
    
    // This method should be overridden by specific strategies
    generateSignal(prices, volumes) {
        return null; // 'BUY', 'SELL', or null
    }
}

// Bollinger Bands strategy
class BollingerBandsStrategy extends TradingStrategy {
    constructor() {
        super('Bollinger Bands', 'Trading based on Bollinger Bands with volume confirmation');
        this.setParameter('bbLength', state.bbLength);
        this.setParameter('bbDeviation', state.bbDeviation);
        this.setParameter('volumeCandles', state.volumeCandles);
        this.setParameter('volumeIncrease', state.volumeIncrease);
    }
    
    generateSignal(prices, volumes) {
        if (prices.length < Math.max(20, this.getParameter('bbLength'))) {
            return null; // Not enough data
        }
        
        // Calculate SMA
        const bbLength = this.getParameter('bbLength');
        const sma = calculateSMA(prices, bbLength);
        
        // Calculate standard deviation
        const stdDev = calculateStdDev(prices, sma, bbLength);
        
        // Calculate Bollinger Bands
        const bbDeviation = this.getParameter('bbDeviation');
        const upperBand = sma + (stdDev * bbDeviation);
        const lowerBand = sma - (stdDev * bbDeviation);
        
        // Current price and volume info
        const currentPrice = prices[prices.length - 1];
        const volumeCandles = this.getParameter('volumeCandles');
        const recentVolumes = volumes.slice(-volumeCandles);
        const avgVolume = calculateAverage(volumes.slice(-30)); // Last 30 candles
        const currentVolume = recentVolumes[recentVolumes.length - 1];
        const volumeIncrease = currentVolume / avgVolume * 100;
        const volumeThreshold = this.getParameter('volumeIncrease');
        
        // Generate signals
        if (currentPrice <= lowerBand && volumeIncrease >= volumeThreshold) {
            return 'BUY';
        } else if (currentPrice >= upperBand && volumeIncrease >= volumeThreshold) {
            return 'SELL';
        }
        
        return null;
    }
}

// MACD Strategy
class MACDStrategy extends TradingStrategy {
    constructor() {
        super('MACD', 'Moving Average Convergence Divergence strategy');
        this.setParameter('fastPeriod', 12);
        this.setParameter('slowPeriod', 26);
        this.setParameter('signalPeriod', 9);
    }
    
    generateSignal(prices, volumes) {
        const fastPeriod = this.getParameter('fastPeriod');
        const slowPeriod = this.getParameter('slowPeriod');
        const signalPeriod = this.getParameter('signalPeriod');
        
        if (prices.length < slowPeriod + signalPeriod) {
            return null; // Not enough data
        }
        
        // Calculate MACD line
        const fastEMA = calculateEMA(prices, fastPeriod);
        const slowEMA = calculateEMA(prices, slowPeriod);
        const macdLine = fastEMA - slowEMA;
        
        // Calculate signal line (EMA of MACD line)
        const macdHistory = [];
        for (let i = prices.length - slowPeriod; i < prices.length; i++) {
            const slice = prices.slice(0, i + 1);
            const fast = calculateEMA(slice, fastPeriod);
            const slow = calculateEMA(slice, slowPeriod);
            macdHistory.push(fast - slow);
        }
        
        const signalLine = calculateEMA(macdHistory, signalPeriod);
        
        // Calculate histogram
        const histogram = macdLine - signalLine;
        
        // Previous values
        const previousMacdLine = calculateEMA(prices.slice(0, -1), fastPeriod) - calculateEMA(prices.slice(0, -1), slowPeriod);
        const previousSignalLine = calculateEMA(macdHistory.slice(0, -1), signalPeriod);
        const previousHistogram = previousMacdLine - previousSignalLine;
        
        // Generate signals based on MACD crossovers
        if (histogram > 0 && previousHistogram <= 0) {
            // Bullish crossover (MACD crosses above signal line)
            return 'BUY';
        } else if (histogram < 0 && previousHistogram >= 0) {
            // Bearish crossover (MACD crosses below signal line)
            return 'SELL';
        }
        
        return null;
    }
}

// RSI Strategy
class RSIStrategy extends TradingStrategy {
    constructor() {
        super('RSI', 'Relative Strength Index strategy with custom overbought/oversold levels');
        this.setParameter('period', 14);
        this.setParameter('overbought', 70);
        this.setParameter('oversold', 30);
    }
    
    generateSignal(prices, volumes) {
        const period = this.getParameter('period');
        
        if (prices.length < period + 1) {
            return null; // Not enough data
        }
        
        // Calculate RSI
        const rsiValue = calculateRSI(prices, period);
        const previousRSI = calculateRSI(prices.slice(0, -1), period);
        
        const overbought = this.getParameter('overbought');
        const oversold = this.getParameter('oversold');
        
        // Generate signals
        if (rsiValue < oversold && previousRSI >= oversold) {
            return 'BUY'; // Oversold condition
        } else if (rsiValue > overbought && previousRSI <= overbought) {
            return 'SELL'; // Overbought condition
        }
        
        return null;
    }
}

// Available strategies
const availableStrategies = {
    bollingerBands: new BollingerBandsStrategy(),
    macd: new MACDStrategy(),
    rsi: new RSIStrategy()
};

// Set default active strategy
availableStrategies.bollingerBands.isActive = true;

// Initialize application
async function initialize() {
    addLogMessage('Volty Trading Bot v2.1.0 initializing...', false);
    
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
        
        // Initialize UI components that need data
        initializeStrategyUI();
        
        // Setup dropdown close on outside click
        setupOutsideClickHandlers();
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
            
            // Update strategy parameters
            Object.values(availableStrategies).forEach(strategy => {
                if (strategy.name === 'Bollinger Bands') {
                    strategy.setParameter('bbLength', state.bbLength);
                    strategy.setParameter('bbDeviation', state.bbDeviation);
                    strategy.setParameter('volumeCandles', state.volumeCandles);
                    strategy.setParameter('volumeIncrease', state.volumeIncrease);
                }
            });
            
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
    
    // Update chart settings
    if (document.getElementById('dark-mode-toggle')) {
        document.getElementById('dark-mode-toggle').checked = state.settings.darkMode;
    }
    
    if (document.getElementById('show-volume-toggle')) {
        document.getElementById('show-volume-toggle').checked = state.settings.showVolume;
    }
    
    if (document.getElementById('show-grid-toggle')) {
        document.getElementById('show-grid-toggle').checked = state.settings.showGrid;
    }
    
    if (document.getElementById('auto-refresh-toggle')) {
        document.getElementById('auto-refresh-toggle').checked = state.settings.autoRefresh;
    }
}

// Initialize Strategy UI
function initializeStrategyUI() {
    const strategySelect = document.getElementById('strategy-select');
    if (!strategySelect) return;
    
    // Clear existing options
    strategySelect.innerHTML = '';
    
    // Add strategies to dropdown
    Object.values(availableStrategies).forEach(strategy => {
        const option = document.createElement('option');
        option.value = strategy.name.toLowerCase().replace(/\s+/g, '-');
        option.textContent = strategy.name;
        option.selected = strategy.isActive;
        strategySelect.appendChild(option);
    });
    
    // Show parameters for the active strategy
    showStrategyParameters();
}

// Show parameters for the selected strategy
function showStrategyParameters() {
    const strategySelect = document.getElementById('strategy-select');
    if (!strategySelect) return;
    
    const selectedStrategyKey = strategySelect.value;
    let selectedStrategy = null;
    
    // Find the selected strategy
    Object.entries(availableStrategies).forEach(([key, strategy]) => {
        if (strategy.name.toLowerCase().replace(/\s+/g, '-') === selectedStrategyKey) {
            selectedStrategy = strategy;
        }
    });
    
    if (!selectedStrategy) return;
    
    // Update the UI
    const parametersContainer = document.getElementById('strategy-parameters');
    if (!parametersContainer) return;
    
    // Clear existing parameters
    parametersContainer.innerHTML = '';
    
    // Add header
    const header = document.createElement('div');
    header.className = 'widget-item-title';
    header.textContent = `${selectedStrategy.name} Parameters`;
    parametersContainer.appendChild(header);
    
    // Add description
    const description = document.createElement('div');
    description.className = 'p-3 text-muted';
    description.textContent = selectedStrategy.description;
    parametersContainer.appendChild(description);
    
    // Add parameters based on strategy type
    if (selectedStrategy.name === 'Bollinger Bands') {
        addBollingerBandsParameters(parametersContainer, selectedStrategy);
    } else if (selectedStrategy.name === 'MACD') {
        addMACDParameters(parametersContainer, selectedStrategy);
    } else if (selectedStrategy.name === 'RSI') {
        addRSIParameters(parametersContainer, selectedStrategy);
    }
    
    // Add apply button
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'p-3 text-center';
    
    const applyButton = document.createElement('button');
    applyButton.className = 'btn btn-primary';
    applyButton.textContent = 'Apply Strategy';
    applyButton.addEventListener('click', () => {
        // Set all strategies to inactive
        Object.values(availableStrategies).forEach(s => {
            s.isActive = false;
        });
        
        // Set selected strategy to active
        selectedStrategy.isActive = true;
        
        // Update main state for Bollinger Bands
        if (selectedStrategy.name === 'Bollinger Bands') {
            state.bbLength = selectedStrategy.getParameter('bbLength');
            state.bbDeviation = selectedStrategy.getParameter('bbDeviation');
            state.volumeCandles = selectedStrategy.getParameter('volumeCandles');
            state.volumeIncrease = selectedStrategy.getParameter('volumeIncrease');
            
            // Also update UI
            document.getElementById('bb-length').value = state.bbLength;
            document.getElementById('bb-length-value').textContent = state.bbLength;
            
            document.getElementById('bb-dev').value = state.bbDeviation;
            document.getElementById('bb-dev-value').textContent = state.bbDeviation;
            
            document.getElementById('volume-candles').value = state.volumeCandles;
            document.getElementById('volume-candles-value').textContent = state.volumeCandles;
            
            document.getElementById('volume-increase').value = state.volumeIncrease;
            document.getElementById('volume-increase-value').textContent = state.volumeIncrease;
        }
        
        showStatusBar(`${selectedStrategy.name} strategy activated`, 'success');
        saveSettings();
    });
    
    buttonContainer.appendChild(applyButton);
    parametersContainer.appendChild(buttonContainer);
}

// Add Bollinger Bands parameters to container
function addBollingerBandsParameters(container, strategy) {
    const params = [
        {
            id: 'bb-length-param',
            label: 'Period Length',
            value: strategy.getParameter('bbLength'),
            min: 5,
            max: 50,
            step: 1
        },
        {
            id: 'bb-dev-param',
            label: 'Standard Deviation',
            value: strategy.getParameter('bbDeviation'),
            min: 1,
            max: 4,
            step: 0.1
        },
        {
            id: 'volume-candles-param',
            label: 'Volume Candles',
            value: strategy.getParameter('volumeCandles'),
            min: 1,
            max: 10,
            step: 1
        },
        {
            id: 'volume-increase-param',
            label: 'Volume Increase (%)',
            value: strategy.getParameter('volumeIncrease'),
            min: 10,
            max: 100,
            step: 5
        }
    ];
    
    params.forEach(param => {
        const row = document.createElement('div');
        row.className = 'p-3';
        
        const labelValueRow = document.createElement('div');
        labelValueRow.className = 'd-flex justify-content-between align-items-center mb-2';
        
        const label = document.createElement('div');
        label.textContent = param.label;
        
        const value = document.createElement('div');
        value.id = `${param.id}-value`;
        value.textContent = param.value;
        value.className = 'font-weight-bold';
        
        labelValueRow.appendChild(label);
        labelValueRow.appendChild(value);
        
        const input = document.createElement('input');
        input.type = 'range';
        input.className = 'form-control-range';
        input.id = param.id;
        input.min = param.min;
        input.max = param.max;
        input.step = param.step;
        input.value = param.value;
        
        input.addEventListener('input', () => {
            document.getElementById(`${param.id}-value`).textContent = input.value;
            
            // Update strategy parameter
            if (param.id === 'bb-length-param') {
                strategy.setParameter('bbLength', parseInt(input.value));
            } else if (param.id === 'bb-dev-param') {
                strategy.setParameter('bbDeviation', parseFloat(input.value));
            } else if (param.id === 'volume-candles-param') {
                strategy.setParameter('volumeCandles', parseInt(input.value));
            } else if (param.id === 'volume-increase-param') {
                strategy.setParameter('volumeIncrease', parseInt(input.value));
            }
        });
        
        row.appendChild(labelValueRow);
        row.appendChild(input);
        container.appendChild(row);
    });
}

// Add MACD parameters to container
function addMACDParameters(container, strategy) {
    const params = [
        {
            id: 'macd-fast-period',
            label: 'Fast Period',
            value: strategy.getParameter('fastPeriod'),
            min: 5,
            max: 20,
            step: 1
        },
        {
            id: 'macd-slow-period',
            label: 'Slow Period',
            value: strategy.getParameter('slowPeriod'),
            min: 10,
            max: 40,
            step: 1
        },
        {
            id: 'macd-signal-period',
            label: 'Signal Period',
            value: strategy.getParameter('signalPeriod'),
            min: 5,
            max: 20,
            step: 1
        }
    ];
    
    params.forEach(param => {
        const row = document.createElement('div');
        row.className = 'p-3';
        
        const labelValueRow = document.createElement('div');
        labelValueRow.className = 'd-flex justify-content-between align-items-center mb-2';
        
        const label = document.createElement('div');
        label.textContent = param.label;
        
        const value = document.createElement('div');
        value.id = `${param.id}-value`;
        value.textContent = param.value;
        value.className = 'font-weight-bold';
        
        labelValueRow.appendChild(label);
        labelValueRow.appendChild(value);
        
        const input = document.createElement('input');
        input.type = 'range';
        input.className = 'form-control-range';
        input.id = param.id;
        input.min = param.min;
        input.max = param.max;
        input.step = param.step;
        input.value = param.value;
        
        input.addEventListener('input', () => {
            document.getElementById(`${param.id}-value`).textContent = input.value;
            
            // Update strategy parameter
            if (param.id === 'macd-fast-period') {
                strategy.setParameter('fastPeriod', parseInt(input.value));
            } else if (param.id === 'macd-slow-period') {
                strategy.setParameter('slowPeriod', parseInt(input.value));
            } else if (param.id === 'macd-signal-period') {
                strategy.setParameter('signalPeriod', parseInt(input.value));
            }
        });
        
        row.appendChild(labelValueRow);
        row.appendChild(input);
        container.appendChild(row);
    });
}

// Add RSI parameters to container
function addRSIParameters(container, strategy) {
    const params = [
        {
            id: 'rsi-period',
            label: 'RSI Period',
            value: strategy.getParameter('period'),
            min: 7,
            max: 30,
            step: 1
        },
        {
            id: 'rsi-overbought',
            label: 'Overbought Level',
            value: strategy.getParameter('overbought'),
            min: 60,
            max: 90,
            step: 1
        },
        {
            id: 'rsi-oversold',
            label: 'Oversold Level',
            value: strategy.getParameter('oversold'),
            min: 10,
            max: 40,
            step: 1
        }
    ];
    
    params.forEach(param => {
        const row = document.createElement('div');
        row.className = 'p-3';
        
        const labelValueRow = document.createElement('div');
        labelValueRow.className = 'd-flex justify-content-between align-items-center mb-2';
        
        const label = document.createElement('div');
        label.textContent = param.label;
        
        const value = document.createElement('div');
        value.id = `${param.id}-value`;
        value.textContent = param.value;
        value.className = 'font-weight-bold';
        
        labelValueRow.appendChild(label);
        labelValueRow.appendChild(value);
        
        const input = document.createElement('input');
        input.type = 'range';
        input.className = 'form-control-range';
        input.id = param.id;
        input.min = param.min;
        input.max = param.max;
        input.step = param.step;
        input.value = param.value;
        
        input.addEventListener('input', () => {
            document.getElementById(`${param.id}-value`).textContent = input.value;
            
            // Update strategy parameter
            if (param.id === 'rsi-period') {
                strategy.setParameter('period', parseInt(input.value));
            } else if (param.id === 'rsi-overbought') {
                strategy.setParameter('overbought', parseInt(input.value));
            } else if (param.id === 'rsi-oversold') {
                strategy.setParameter('oversold', parseInt(input.value));
            }
        });
        
        row.appendChild(labelValueRow);
        row.appendChild(input);
        container.appendChild(row);
    });
}

// Setup outside click handlers
function setupOutsideClickHandlers() {
    document.addEventListener('click', (event) => {
        // Handle user dropdown
        const userDropdown = document.getElementById('userDropdown');
        const userDropdownMenu = document.getElementById('userDropdownMenu');
        
        if (userDropdown && userDropdownMenu && state.userDropdownOpen) {
            if (!userDropdown.contains(event.target) && !userDropdownMenu.contains(event.target)) {
                userDropdownMenu.classList.remove('show');
                state.userDropdownOpen = false;
            }
        }
        
        // Add other dropdown handlers as needed
    });
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
        
        // Update strategy parameter
        const bollingerStrategy = availableStrategies.bollingerBands;
        if (bollingerStrategy) {
            bollingerStrategy.setParameter('bbLength', state.bbLength);
        }
    });
    
    document.getElementById('bb-dev').addEventListener('input', function() {
        state.bbDeviation = parseFloat(this.value);
        document.getElementById('bb-dev-value').textContent = state.bbDeviation;
        
        // Update strategy parameter
        const bollingerStrategy = availableStrategies.bollingerBands;
        if (bollingerStrategy) {
            bollingerStrategy.setParameter('bbDeviation', state.bbDeviation);
        }
    });
    
    document.getElementById('volume-candles').addEventListener('input', function() {
        state.volumeCandles = parseInt(this.value);
        document.getElementById('volume-candles-value').textContent = state.volumeCandles;
        
        // Update strategy parameter
        const bollingerStrategy = availableStrategies.bollingerBands;
        if (bollingerStrategy) {
            bollingerStrategy.setParameter('volumeCandles', state.volumeCandles);
        }
    });
    
    document.getElementById('volume-increase').addEventListener('input', function() {
        state.volumeIncrease = parseInt(this.value);
        document.getElementById('volume-increase-value').textContent = state.volumeIncrease;
        
        // Update strategy parameter
        const bollingerStrategy = availableStrategies.bollingerBands;
        if (bollingerStrategy) {
            bollingerStrategy.setParameter('volumeIncrease', state.volumeIncrease);
        }
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
    
    // Strategy selector
    if (document.getElementById('strategy-select')) {
        document.getElementById('strategy-select').addEventListener('change', function() {
            showStrategyParameters();
        });
    }
    
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
    
    // Manual trading buttons
    document.getElementById('manual-buy-btn').addEventListener('click', function() {
        if (state.isRunning) {
            openPosition('LONG');
        } else {
            showStatusBar('Please start trading first', 'warning');
        }
    });
    
    document.getElementById('manual-sell-btn').addEventListener('click', function() {
        if (state.isRunning) {
            openPosition('SHORT');
        } else {
            showStatusBar('Please start trading first', 'warning');
        }
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
    
    // User dropdown toggle
    document.getElementById('userDropdown').addEventListener('click', function(e) {
        e.stopPropagation();
        const dropdown = document.getElementById('userDropdownMenu');
        dropdown.classList.toggle('show');
        state.userDropdownOpen = !state.userDropdownOpen;
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
    
    // Navigation items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get the view name from the span content
            const viewName = this.querySelector('span').textContent.toLowerCase().replace(' ', '-');
            
            // Update active item
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            // Handle view change
            changeView(viewName);
        });
    });
    
    // Navigation for modals
    document.querySelectorAll('[data-toggle="modal"]').forEach(button => {
        button.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            const modal = document.querySelector(target);
            if (modal) {
                modal.style.display = 'flex';
                state.currentModal = modal;
            }
        });
    });
    
    // Close buttons for modals
    document.querySelectorAll('.modal-close, [data-dismiss="modal"]').forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal-backdrop');
            if (modal) {
                modal.style.display = 'none';
                state.currentModal = null;
            }
        });
    });
    
    // Close modal when clicking outside
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                state.currentModal = null;
            }
        });
    });
    
    // Escape key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && state.currentModal) {
            state.currentModal.style.display = 'none';
            state.currentModal = null;
        }
    });
}

// Apply chart settings
function applyChartSettings() {
    // Only apply if TradingView widget exists
    if (state.tvWidget && state.tvWidget.iframe && state.tvWidget.iframe.contentWindow) {
        const tv = state.tvWidget.iframe.contentWindow;
        
        // Apply dark/light mode
        if (state.settings.darkMode) {
            tv.postMessage({ name: 'switchTheme', value: 'Dark' }, '*');
        } else {
            tv.postMessage({ name: 'switchTheme', value: 'Light' }, '*');
        }
        
        // Apply other settings via custom code
        // Note: This would require more specific TradingView API access
    }
    
    // Save settings
    saveSettings();
}

// Change view based on navigation
function changeView(viewName) {
    state.activeView = viewName;
    
    // Hide all views
    document.querySelectorAll('.view-content').forEach(view => {
        view.style.display = 'none';
    });
    
    // Show selected view
    const selectedView = document.getElementById(`${viewName}-view`);
    if (selectedView) {
        selectedView.style.display = 'block';
        
        // Perform view-specific actions
        if (viewName === 'live-trading') {
            // Refresh chart if needed
            if (state.settings.autoRefresh) {
                initializeTradingViewChart();
            }
        } else if (viewName === 'trade-history') {
            updateTradeHistory();
        } else if (viewName === 'strategy-builder') {
            initializeStrategyBuilder();
        } else if (viewName === 'backtester') {
            initializeBacktester();
        }
    }
}

// Initialize Strategy Builder view
function initializeStrategyBuilder() {
    // Load strategy builder UI
    const container = document.getElementById('strategy-builder-container');
    if (!container) return;
    
    // Clear container
    container.innerHTML = '';
    
    // Add instructions
    const instructions = document.createElement('div');
    instructions.className = 'alert alert-info';
    instructions.innerHTML = `
        <h4>Strategy Builder</h4>
        <p>Create and customize trading strategies with advanced indicators and parameters.</p>
        <p>Select indicators and adjust parameters to build your perfect trading strategy.</p>
    `;
    container.appendChild(instructions);
    
    // Add strategy selector
    const strategySelector = document.createElement('div');
    strategySelector.className = 'widget-item mb-3';
    strategySelector.innerHTML = `
        <div class="widget-item-title">Strategy Templates</div>
        <div class="p-3">
            <select id="strategy-template" class="form-control mb-3">
                <option value="bollinger-bands">Bollinger Bands with Volume</option>
                <option value="macd">MACD Crossover</option>
                <option value="rsi">RSI Oversold/Overbought</option>
                <option value="custom">Custom Strategy</option>
            </select>
            <button id="load-template" class="btn btn-primary">Load Template</button>
        </div>
    `;
    container.appendChild(strategySelector);
    
    // Add indicator selector
    const indicatorSelector = document.createElement('div');
    indicatorSelector.className = 'widget-item mb-3';
    indicatorSelector.innerHTML = `
        <div class="widget-item-title">Indicators</div>
        <div class="p-3" id="indicator-list">
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="indicator-ma">
                <label class="form-check-label" for="indicator-ma">Moving Average</label>
            </div>
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="indicator-bb">
                <label class="form-check-label" for="indicator-bb">Bollinger Bands</label>
            </div>
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="indicator-rsi">
                <label class="form-check-label" for="indicator-rsi">RSI</label>
            </div>
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="indicator-macd">
                <label class="form-check-label" for="indicator-macd">MACD</label>
            </div>
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="indicator-volume">
                <label class="form-check-label" for="indicator-volume">Volume</label>
            </div>
        </div>
    `;
    container.appendChild(indicatorSelector);
    
    // Add strategy logic builder
    const logicBuilder = document.createElement('div');
    logicBuilder.className = 'widget-item mb-3';
    logicBuilder.innerHTML = `
        <div class="widget-item-title">Strategy Logic</div>
        <div class="p-3">
            <h5 class="mb-3">Entry Conditions</h5>
            <div id="entry-conditions" class="mb-3">
                <div class="condition mb-2 d-flex align-items-center">
                    <select class="form-control mr-2">
                        <option>Price</option>
                        <option>RSI</option>
                        <option>MACD</option>
                        <option>Volume</option>
                    </select>
                    <select class="form-control mr-2">
                        <option>crosses above</option>
                        <option>crosses below</option>
                        <option>is greater than</option>
                        <option>is less than</option>
                    </select>
                    <select class="form-control">
                        <option>MA(20)</option>
                        <option>Upper BB</option>
                        <option>Lower BB</option>
                        <option>70</option>
                        <option>30</option>
                        <option>0</option>
                    </select>
                    <button class="btn btn-sm btn-danger ml-2"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <button id="add-entry-condition" class="btn btn-sm btn-secondary mb-3">Add Entry Condition</button>
            
            <h5 class="mb-3">Exit Conditions</h5>
            <div id="exit-conditions" class="mb-3">
                <div class="condition mb-2 d-flex align-items-center">
                    <select class="form-control mr-2">
                        <option>Price</option>
                        <option>RSI</option>
                        <option>MACD</option>
                        <option>P&L</option>
                    </select>
                    <select class="form-control mr-2">
                        <option>crosses above</option>
                        <option>crosses below</option>
                        <option>is greater than</option>
                        <option>is less than</option>
                    </select>
                    <select class="form-control">
                        <option>MA(20)</option>
                        <option>Take Profit (3%)</option>
                        <option>Stop Loss (2%)</option>
                        <option>70</option>
                        <option>30</option>
                    </select>
                    <button class="btn btn-sm btn-danger ml-2"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <button id="add-exit-condition" class="btn btn-sm btn-secondary mb-3">Add Exit Condition</button>
        </div>
    `;
    container.appendChild(logicBuilder);
    
    // Add save/test buttons
    const actionButtons = document.createElement('div');
    actionButtons.className = 'text-center mb-3';
    actionButtons.innerHTML = `
        <button id="save-strategy" class="btn btn-primary mr-2">Save Strategy</button>
        <button id="test-strategy" class="btn btn-success">Test Strategy</button>
    `;
    container.appendChild(actionButtons);
    
    // Add event listeners for strategy builder
    document.getElementById('load-template').addEventListener('click', function() {
        const template = document.getElementById('strategy-template').value;
        loadStrategyTemplate(template);
    });
    
    document.getElementById('add-entry-condition').addEventListener('click', function() {
        addStrategyCondition('entry-conditions');
    });
    
    document.getElementById('add-exit-condition').addEventListener('click', function() {
        addStrategyCondition
