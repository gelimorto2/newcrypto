// Constants and settings
const CURRENT_UTC_DATETIME = '2025-06-06 23:49:33';
const CURRENT_USER = 'gelimorto2';
const BINANCE_API_URL = 'https://api.binance.com/api/v3';
const BINANCE_API_TRADE_URL = 'https://api.binance.com/api/v3';
const POLL_INTERVAL = 5000; // 5 seconds
const OHLC_COLORS = {
    up: 'rgba(34, 197, 94, 0.8)',
    down: 'rgba(239, 68, 68, 0.8)',
    upFill: 'rgba(34, 197, 94, 0.2)',
    downFill: 'rgba(239, 68, 68, 0.2)',
    volume: {
        up: 'rgba(34, 197, 94, 0.5)',
        down: 'rgba(239, 68, 68, 0.5)'
    }
};

// Application state
const state = {
    priceData: [],
    trades: [],
    historicalTrades: [],
    equityCurve: [],
    currentPosition: null,
    isTrading: false,
    initialCapital: 10000,
    currentCapital: 10000,
    positionSize: 0.1,
    atrLength: 5,
    atrMultiplier: 0.75,
    symbol: 'BTCUSDT',
    timeframe: '1h',
    currentPrice: 0,
    currentUser: CURRENT_USER,
    currentDateTime: CURRENT_UTC_DATETIME,
    indicators: {
        atr: [],
        longSignal: [],
        shortSignal: []
    },
    interval: null,
    charts: {
        price: null,
        equity: null
    },
    metrics: {
        totalReturn: 0,
        winRate: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        totalTrades: 0,
        avgTrade: 0,
        maxWin: 0,
        maxLoss: 0
    },
    backtest: {
        capital: 10000,
        trades: []
    },
    alerts: {
        discord: {
            enabled: false,
            webhook: '',
            includeChart: true,
            includeMetrics: true,
            includeSignals: true
        },
        telegram: {
            enabled: false,
            botToken: '',
            chatId: ''
        },
        email: {
            enabled: false,
            address: ''
        },
        browser: {
            enabled: true
        },
        sound: {
            enabled: true,
            volume: 0.5
        }
    },
    settings: {
        theme: 'dark',
        chartUpdateFrequency: 5000,
        autoTrade: true,
        trailingStop: {
            enabled: false,
            percentage: 1.5
        },
        takeProfit: {
            enabled: true,
            percentage: 3.0
        },
        stopLoss: {
            enabled: true,
            percentage: 2.0
        },
        riskManagement: {
            enabled: false,
            maxDrawdown: 10,
            maxDailyLoss: 5
        },
        chart: {
            autoScroll: true,
            type: 'candlestick',
            showVolume: true,
            showIndicators: true
        },
        export: {
            directory: './trading_data',
            autoExport: false,
            jsonFormat: true
        },
        network: {
            retryAttempts: 3,
            timeoutSeconds: 30,
            usePublicApiFallback: true
        }
    },
    botStats: {
        status: 'idle',
        lastTickTime: null,
        lastTickPrice: 0,
        executionTime: 0,
        dailyTrades: 0,
        dailyPnL: 0,
        dailyStartCapital: 0,
        marketData: {
            price: 0,
            change24h: 0,
            volume: 0
        },
        tradingDay: new Date().toDateString(),
        positionDetails: {
            entryTime: null,
            takeProfitPrice: 0,
            stopLossPrice: 0,
            highestPnl: null
        },
        networkStatus: {
            isOnline: false,
            lastChecked: null,
            failCount: 0
        }
    },
    // Real money trading specific state
    realMoney: {
        enabled: false,
        apiKey: '',
        apiSecret: '',
        apiKeyValid: false,
        orderType: 'MARKET',
        tradeAmount: 50,
        maxDailyLoss: 100,
        leverage: 1,
        slippage: 0.1,
        cooldown: 5,
        tradingHours: '0-23',
        balance: {
            USDT: 0,
            BTC: 0,
            totalValue: 0
        },
        pendingOrder: null,
        openOrders: [],
        realTrades: []
    },
    logs: []
};

// Notification sound
let notificationSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-interface-click-1126.mp3');

// Login system functionality
const loginSystem = {
    isLoggedIn: false,
    username: CURRENT_USER,
    defaultPassword: 'trading2025',
    loginModal: null,
    
    init() {
        setTimeout(() => {
            try {
                this.loginModal = new bootstrap.Modal(document.getElementById('loginModal'), {
                    backdrop: 'static',
                    keyboard: false
                });
                
                this.showLogin();
                
                document.getElementById('login-submit-btn').addEventListener('click', () => this.attemptLogin());
                document.getElementById('toggle-password-btn').addEventListener('click', this.togglePasswordVisibility);
                
                document.getElementById('login-password').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.attemptLogin();
                    }
                });
            } catch (error) {
                console.error('Error initializing login modal:', error);
                try {
                    $('#loginModal').modal('show');
                } catch (e) {
                    console.error('Error showing login modal with jQuery:', e);
                }
            }
        }, 500);
    },
    
    showLogin() {
        document.getElementById('login-error').style.display = 'none';
        document.getElementById('login-password').value = '';
        
        document.getElementById('login-username').value = this.username;
        
        if (this.loginModal) {
            this.loginModal.show();
        } else {
            setTimeout(() => {
                try {
                    this.loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
                    this.loginModal.show();
                } catch (error) {
                    console.error('Error showing login modal:', error);
                    try {
                        $('#loginModal').modal('show');
                    } catch (e) {
                        console.error('Error showing login modal with jQuery:', e);
                    }
                }
            }, 100);
        }
    },
    
    togglePasswordVisibility() {
        const passwordInput = document.getElementById('login-password');
        const icon = this.querySelector('i');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            passwordInput.type = 'password';
            icon.className = 'fas fa-eye';
        }
    },
    
    checkRememberedLogin() {
        try {
            const remembered = localStorage.getItem('voltyBotRememberedLogin');
            if (remembered) {
                const loginData = JSON.parse(remembered);
                const expiryDate = new Date(loginData.expiry);
                
                if (expiryDate > new Date()) {
                    return true;
                }
                
                localStorage.removeItem('voltyBotRememberedLogin');
            }
        } catch (error) {
            console.error('Error checking remembered login:', error);
        }
        
        return false;
    },
    
    saveRememberedLogin() {
        try {
            if (document.getElementById('remember-login').checked) {
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + 30);
                
                const loginData = {
                    username: this.username,
                    expiry: expiry.toISOString()
                };
                
                localStorage.setItem('voltyBotRememberedLogin', JSON.stringify(loginData));
            }
        } catch (error) {
            console.error('Error saving remembered login:', error);
        }
    },
    
    attemptLogin() {
        const passwordInput = document.getElementById('login-password').value;
        
        if (passwordInput === this.defaultPassword) {
            this.isLoggedIn = true;
            this.saveRememberedLogin();
            
            try {
                this.loginModal.hide();
            } catch (error) {
                console.error('Error hiding login modal:', error);
                try {
                    $('#loginModal').modal('hide');
                } catch (e) {
                    console.error('Error hiding login modal with jQuery:', e);
                }
            }
            
            initializeAfterLogin();
            addLogMessage('Login successful', false);
        } else {
            document.getElementById('login-error').style.display = 'block';
            document.getElementById('login-password').value = '';
        }
    },
    
    logout() {
        this.isLoggedIn = false;
        localStorage.removeItem('voltyBotRememberedLogin');
        window.location.reload();
    }
};

// User progress saving functionality
const progressManager = {
    saveProgress() {
        try {
            const progressData = {
                currentCapital: state.currentCapital,
                trades: state.trades,
                equityCurve: state.equityCurve,
                metrics: state.metrics,
                botStats: state.botStats,
                lastSaveTime: new Date().toISOString()
            };
            
            localStorage.setItem('voltyBotUserProgress', JSON.stringify(progressData));
            addLogMessage('Progress saved successfully');
            
            return true;
        } catch (error) {
            console.error('Error saving progress:', error);
            addLogMessage('Error saving progress: ' + error.message, true);
            return false;
        }
    },
    
    loadProgress() {
        try {
            const savedProgress = localStorage.getItem('voltyBotUserProgress');
            
            if (savedProgress) {
                const progressData = JSON.parse(savedProgress);
                
                state.currentCapital = progressData.currentCapital;
                state.trades = progressData.trades.map(t => {
                    const trade = new Trade(
                        new Date(t.entryTime),
                        t.type,
                        t.entryPrice,
                        t.size,
                        t.isRealMoney,
                        t.orderId
                    );
                    
                    if (t.exitTime) {
                        trade.exitTime = new Date(t.exitTime);
                        trade.exitPrice = t.exitPrice;
                        trade.pnl = t.pnl;
                        trade.pnlPct = t.pnlPct;
                    }
                    
                    return trade;
                });
                
                state.equityCurve = progressData.equityCurve.map(point => ({
                    time: new Date(point.time),
                    value: point.value
                }));
                
                state.metrics = progressData.metrics;
                state.botStats = progressData.botStats;
                
                addLogMessage(`Progress loaded from ${new Date(progressData.lastSaveTime).toLocaleString()}`);
                
                return true;
            }
        } catch (error) {
            console.error('Error loading progress:', error);
            addLogMessage('Error loading progress: ' + error.message, true);
        }
        
        return false;
    },
    
    clearProgress() {
        try {
            localStorage.removeItem('voltyBotUserProgress');
            addLogMessage('Progress cleared');
            return true;
        } catch (error) {
            console.error('Error clearing progress:', error);
            addLogMessage('Error clearing progress: ' + error.message, true);
            return false;
        }
    },
    
    autoSave() {
        if (state.isTrading) {
            this.saveProgress();
        }
    }
};

// Initialize auto-save feature
function initAutoSave() {
    setInterval(() => {
        progressManager.autoSave();
    }, 5 * 60 * 1000);
}

// Load user progress
function loadUserProgress() {
    progressManager.loadProgress();
}

// Data classes
class Trade {
    constructor(entryTime, type, entryPrice, size, isRealMoney = false, orderId = null) {
        this.entryTime = entryTime;
        this.exitTime = null;
        this.type = type; // 'LONG' or 'SHORT'
        this.entryPrice = entryPrice;
        this.exitPrice = null;
        this.size = size;
        this.pnl = 0;
        this.pnlPct = 0;
        this.isRealMoney = isRealMoney;
        this.orderId = orderId; // Binance order ID for real money trades
    }

    close(exitTime, exitPrice) {
        this.exitTime = exitTime;
        this.exitPrice = exitPrice;
        
        if (this.type === 'LONG') {
            this.pnl = (exitPrice - this.entryPrice) * this.size;
            this.pnlPct = (exitPrice - this.entryPrice) / this.entryPrice;
        } else { // SHORT
            this.pnl = (this.entryPrice - exitPrice) * this.size;
            this.pnlPct = (this.entryPrice - exitPrice) / this.entryPrice;
        }
        
        return this.pnl;
    }

    getUnrealizedPnl(currentPrice) {
        if (this.type === 'LONG') {
            return (currentPrice - this.entryPrice) * this.size;
        } else { // SHORT
            return (this.entryPrice - currentPrice) * this.size;
        }
    }

    getUnrealizedPnlPct(currentPrice) {
        if (this.type === 'LONG') {
            return (currentPrice - this.entryPrice) / this.entryPrice;
        } else { // SHORT
            return (this.entryPrice - currentPrice) / this.entryPrice;
        }
    }
}

// Strategy and Trading logic
class VoltyStrategy {
    constructor(length = 5, atrMult = 0.75) {
        this.length = length;
        this.atrMult = atrMult;
    }

    calculateATR(data) {
        const trueRanges = [];
        
        for (let i = 0; i < data.length; i++) {
            const high = data[i].high;
            const low = data[i].low;
            const close = i > 0 ? data[i-1].close : data[i].open;
            
            const tr1 = high - low;
            const tr2 = Math.abs(high - close);
            const tr3 = Math.abs(low - close);
            
            const tr = Math.max(tr1, Math.max(tr2, tr3));
            trueRanges.push(tr);
        }
        
        // Calculate simple moving average of true ranges
        const atr = [];
        for (let i = 0; i < trueRanges.length; i++) {
            if (i < this.length - 1) {
                atr.push(null);
            } else {
                let sum = 0;
                for (let j = 0; j < this.length; j++) {
                    sum += trueRanges[i - j];
                }
                atr.push(sum / this.length);
            }
        }
        
        return atr;
    }

    generateSignals(data) {
        // Calculate ATR
        const atr = this.calculateATR(data);
        const atrs = atr.map(val => val !== null ? val * this.atrMult : null);
        
        // Calculate signal levels
        const longSignal = [];
        const shortSignal = [];
        
        for (let i = 0; i < data.length; i++) {
            if (atrs[i] === null) {
                longSignal.push(null);
                shortSignal.push(null);
            } else {
                longSignal.push(data[i].close + atrs[i]);
                shortSignal.push(data[i].close - atrs[i]);
            }
        }
        
        // Generate entry signals
        const longEntry = [];
        const shortEntry = [];
        
        for (let i = 2; i < data.length; i++) {
            // Long entry: current high >= previous long signal AND previous high < signal before that
            const isLongEntry = data[i].high >= longSignal[i-1] && data[i-1].high < longSignal[i-2];
            
            // Short entry: current low <= previous short signal AND previous low > signal before that
            const isShortEntry = data[i].low <= shortSignal[i-1] && data[i-1].low > shortSignal[i-2];
            
            longEntry.push(isLongEntry);
            shortEntry.push(isShortEntry);
        }
        
        return {
            atr,
            atrs,
            longSignal,
            shortSignal,
            longEntry,
            shortEntry
        };
    }

    checkForSignals(data, lastSignals) {
        if (data.length < 3) return { longEntry: false, shortEntry: false };
        
        const i = data.length - 1;
        const signalIndex = i - 2; // Adjust for signal calculation
        
        if (signalIndex < 0 || signalIndex >= lastSignals.longEntry.length || 
            signalIndex >= lastSignals.shortEntry.length) {
            return { longEntry: false, shortEntry: false };
        }
        
        return {
            longEntry: lastSignals.longEntry[signalIndex],
            shortEntry: lastSignals.shortEntry[signalIndex]
        };
    }

    // Method to check for real-time signals
    checkRealtimeSignals(data, lastSignals) {
        if (data.length < 3) return { longEntry: false, shortEntry: false };
        
        const currentBar = data[data.length - 1];
        const previousBar = data[data.length - 2];
        const twoBarsBack = data[data.length - 3];
        
        // Get the most recent long and short signal levels
        const recentLongSignal = lastSignals.longSignal[lastSignals.longSignal.length - 2]; // Previous bar's signal
        const recentShortSignal = lastSignals.shortSignal[lastSignals.shortSignal.length - 2]; // Previous bar's signal
        
        // Get the signal level from two bars back
        const olderLongSignal = lastSignals.longSignal[lastSignals.longSignal.length - 3]; // Two bars back signal
        const olderShortSignal = lastSignals.shortSignal[lastSignals.shortSignal.length - 3]; // Two bars back signal
        
        // Check for long entry: current high crosses above previous long signal AND previous high was below signal before that
        const isLongEntry = currentBar.high >= recentLongSignal && previousBar.high < olderLongSignal;
        
        // Check for short entry: current low crosses below previous short signal AND previous low was above signal before that
        const isShortEntry = currentBar.low <= recentShortSignal && previousBar.low > olderShortSignal;
        
        // Also check for intra-bar signals (more aggressive)
        const isAggressiveLongEntry = currentBar.high >= recentLongSignal && !state.currentPosition;
        const isAggressiveShortEntry = currentBar.low <= recentShortSignal && !state.currentPosition;
        
        return {
            longEntry: isLongEntry || isAggressiveLongEntry,
            shortEntry: isShortEntry || isAggressiveShortEntry
        };
    }
}

// Binance API client
class BinanceAPI {
    constructor(apiKey = '', apiSecret = '') {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.baseUrl = 'https://api.binance.com';
        this.useAuthentication = apiKey && apiSecret;
    }
    
    // Generate signature for authenticated requests
    generateSignature(queryString) {
        return CryptoJS.HmacSHA256(queryString, this.apiSecret).toString();
    }
    
    // Generate headers for authenticated requests
    getHeaders() {
        return this.useAuthentication ? 
            { 'X-MBX-APIKEY': this.apiKey } : 
            {};
    }
    
    // Test connectivity to the API
    async testConnectivity() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v3/ping`, {
                timeout: state.settings.network.timeoutSeconds * 1000
            });
            return response.status === 200;
        } catch (error) {
            console.error('Error testing connectivity:', error);
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('Network timeout. Please check your internet connection.');
            } else if (error.code === 'ERR_NETWORK') {
                throw new Error('Network error. Unable to connect to Binance servers.');
            }
            return false;
        }
    }
    
    // Get account information (authenticated)
    async getAccountInfo() {
        if (!this.useAuthentication) {
            throw new Error('API key and secret required for account information');
        }
        
        try {
            const timestamp = Date.now();
            const queryString = `timestamp=${timestamp}`;
            const signature = this.generateSignature(queryString);
            
            const response = await axios.get(
                `${this.baseUrl}/api/v3/account?${queryString}&signature=${signature}`,
                { 
                    headers: this.getHeaders(),
                    timeout: state.settings.network.timeoutSeconds * 1000
                }
            );
            
            return response.data;
        } catch (error) {
            if (error.response && error.response.data) {
                throw new Error(`Binance API error: ${error.response.data.msg || JSON.stringify(error.response.data)}`);
            } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('Network timeout when fetching account information.');
            } else if (error.code === 'ERR_NETWORK') {
                throw new Error('Network error. Unable to connect to Binance servers.');
            }
            throw error;
        }
    }
    
    // Get current price for a symbol (public API)
    async getCurrentPrice(symbol) {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v3/ticker/price?symbol=${symbol}`, {
                timeout: state.settings.network.timeoutSeconds * 1000
            });
            return parseFloat(response.data.price);
        } catch (error) {
            if (error.response && error.response.data) {
                throw new Error(`Binance API error: ${error.response.data.msg || JSON.stringify(error.response.data)}`);
            } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('Network timeout when fetching price data.');
            } else if (error.code === 'ERR_NETWORK') {
                throw new Error('Network error. Unable to connect to Binance servers.');
            }
            throw error;
        }
    }
    
    // Get historical klines (candlestick data) - public API
    async getHistoricalData(symbol, interval, limit = 100) {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v3/klines`, {
                params: {
                    symbol,
                    interval,
                    limit
                },
                timeout: state.settings.network.timeoutSeconds * 1000
            });
            
            return response.data.map(candle => ({
                time: candle[0],
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5])
            }));
        } catch (error) {
            if (error.response && error.response.data) {
                throw new Error(`Binance API error: ${error.response.data.msg || JSON.stringify(error.response.data)}`);
            } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('Network timeout when fetching historical data.');
            } else if (error.code === 'ERR_NETWORK') {
                throw new Error('Network error. Unable to connect to Binance servers.');
            }
            throw error;
        }
    }
    
    // Get 24hr ticker for symbol (public API)
    async get24hrTicker(symbol) {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v3/ticker/24hr?symbol=${symbol}`, {
                timeout: state.settings.network.timeoutSeconds * 1000
            });
            
            return {
                priceChange: parseFloat(response.data.priceChange),
                priceChangePercent: parseFloat(response.data.priceChangePercent),
                weightedAvgPrice: parseFloat(response.data.weightedAvgPrice),
                lastPrice: parseFloat(response.data.lastPrice),
                volume: parseFloat(response.data.volume),
                quoteVolume: parseFloat(response.data.quoteVolume)
            };
        } catch (error) {
            if (error.response && error.response.data) {
                throw new Error(`Binance API error: ${error.response.data.msg || JSON.stringify(error.response.data)}`);
            } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('Network timeout when fetching 24hr ticker data.');
            } else if (error.code === 'ERR_NETWORK') {
                throw new Error('Network error. Unable to connect to Binance servers.');
            }
            throw error;
        }
    }
    
    // Place a market order (authenticated)
    async placeMarketOrder(symbol, side, quantity) {
        if (!this.useAuthentication) {
            throw new Error('API key and secret required for placing orders');
        }
        
        try {
            const timestamp = Date.now();
            const queryString = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;
            const signature = this.generateSignature(queryString);
            
            const response = await axios.post(
                `${this.baseUrl}/api/v3/order?${queryString}&signature=${signature}`,
                null,
                { 
                    headers: this.getHeaders(),
                    timeout: state.settings.network.timeoutSeconds * 1000
                }
            );
            
            return response.data;
        } catch (error) {
            if (error.response && error.response.data) {
                throw new Error(`Binance API error: ${error.response.data.msg || JSON.stringify(error.response.data)}`);
            } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('Network timeout when placing market order.');
            } else if (error.code === 'ERR_NETWORK') {
                throw new Error('Network error. Unable to connect to Binance servers.');
            }
            throw error;
        }
    }
    
    // Place a limit order (authenticated)
    async placeLimitOrder(symbol, side, quantity, price) {
        if (!this.useAuthentication) {
            throw new Error('API key and secret required for placing orders');
        }
        
        try {
            const timestamp = Date.now();
            const queryString = `symbol=${symbol}&side=${side}&type=LIMIT&timeInForce=GTC&quantity=${quantity}&price=${price}&timestamp=${timestamp}`;
            const signature = this.generateSignature(queryString);
            
            const response = await axios.post(
                `${this.baseUrl}/api/v3/order?${queryString}&signature=${signature}`,
                null,
                { 
                    headers: this.getHeaders(),
                    timeout: state.settings.network.timeoutSeconds * 1000
                }
            );
            
            return response.data;
        } catch (error) {
            if (error.response && error.response.data) {
                throw new Error(`Binance API error: ${error.response.data.msg || JSON.stringify(error.response.data)}`);
            } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('Network timeout when placing limit order.');
            } else if (error.code === 'ERR_NETWORK') {
                throw new Error('Network error. Unable to connect to Binance servers.');
            }
            throw error;
        }
    }
    
    // Get order status (authenticated)
    async getOrder(symbol, orderId) {
        if (!this.useAuthentication) {
            throw new Error('API key and secret required for order status');
        }
        
        try {
            const timestamp = Date.now();
            const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
            const signature = this.generateSignature(queryString);
            
            const response = await axios.get(
                `${this.baseUrl}/api/v3/order?${queryString}&signature=${signature}`,
                { 
                    headers: this.getHeaders(),
                    timeout: state.settings.network.timeoutSeconds * 1000
                }
            );
            
            return response.data;
        } catch (error) {
            if (error.response && error.response.data) {
                throw new Error(`Binance API error: ${error.response.data.msg || JSON.stringify(error.response.data)}`);
            } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('Network timeout when getting order status.');
            } else if (error.code === 'ERR_NETWORK') {
                throw new Error('Network error. Unable to connect to Binance servers.');
            }
            throw error;
        }
    }
    
    // Cancel an order (authenticated)
    async cancelOrder(symbol, orderId) {
        if (!this.useAuthentication) {
            throw new Error('API key and secret required for cancelling orders');
        }
        
        try {
            const timestamp = Date.now();
            const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
            const signature = this.generateSignature(queryString);
            
            const response = await axios.delete(
                `${this.baseUrl}/api/v3/order?${queryString}&signature=${signature}`,
                { 
                    headers: this.getHeaders(),
                    timeout: state.settings.network.timeoutSeconds * 1000
                }
            );
            
            return response.data;
        } catch (error) {
            if (error.response && error.response.data) {
                throw new Error(`Binance API error: ${error.response.data.msg || JSON.stringify(error.response.data)}`);
            } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('Network timeout when cancelling order.');
            } else if (error.code === 'ERR_NETWORK') {
                throw new Error('Network error. Unable to connect to Binance servers.');
            }
            throw error;
        }
    }
    
    // Get account balance (authenticated)
    async getBalance() {
        if (!this.useAuthentication) {
            throw new Error('API key and secret required for account balance');
        }
        
        try {
            const accountInfo = await this.getAccountInfo();
            
            // Extract balances
            const balances = {};
            for (const asset of accountInfo.balances) {
                balances[asset.asset] = {
                    free: parseFloat(asset.free),
                    locked: parseFloat(asset.locked)
                };
            }
            
            return balances;
        } catch (error) {
            throw error;
        }
    }
}

// File system helper for exporting data
const FileSystemHelper = {
    exportTrades(trades) {
        try {
            // Format the trades for export
            const formattedTrades = trades.map((trade, index) => ({
                id: index + 1,
                entryTime: new Date(trade.entryTime).toISOString(),
                exitTime: trade.exitTime ? new Date(trade.exitTime).toISOString() : null,
                type: trade.type,
                entryPrice: trade.entryPrice,
                exitPrice: trade.exitPrice,
                size: trade.size,
                pnl: trade.pnl,
                pnlPct: trade.pnlPct,
                isRealMoney: trade.isRealMoney,
                orderId: trade.orderId
            }));
            
            // Create JSON blob
            const jsonData = JSON.stringify(formattedTrades, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `volty_trades_${new Date().toISOString().split('T')[0]}.json`;
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            return true;
        } catch (error) {
            console.error('Error exporting trades:', error);
            return false;
        }
    },
    
    exportLogs(logs) {
        try {
            // Format the logs for export
            const formattedLogs = logs.map(log => ({
                timestamp: log.timestamp,
                message: log.message,
                isError: log.isError
            }));
            
            // Create JSON blob
            const jsonData = JSON.stringify(formattedLogs, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `volty_logs_${new Date().toISOString().split('T')[0]}.json`;
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            return true;
        } catch (error) {
            console.error('Error exporting logs:', error);
            return false;
        }
    }
};

// Helper function to format large numbers
function formatLargeNumber(num) {
    if (num >= 1e9) {
        return `$${(num / 1e9).toFixed(2)}B`;
    } else if (num >= 1e6) {
        return `$${(num / 1e6).toFixed(2)}M`;
    } else if (num >= 1e3) {
        return `$${(num / 1e3).toFixed(2)}K`;
    } else {
        return `$${num.toFixed(2)}`;
    }
}

// Initialize after successful login
function initializeAfterLogin() {
    // Set the current date/time
    const clockDisplay = document.getElementById('clock-display');
    if (clockDisplay) clockDisplay.textContent = CURRENT_UTC_DATETIME + ' UTC';
    
    // Set the username
    const userLogin = document.getElementById('user-login');
    if (userLogin) userLogin.textContent = CURRENT_USER;
    
    // Add log message
    addLogMessage('Session started');
    
    // Load settings from storage
    loadSettingsFromStorage();
    
    // Load settings into UI
    loadSettings();
    
    // Load user progress
    loadUserProgress();
    
    // Fetch initial data
    fetchInitialData();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize auto-save
    initAutoSave();
    
    // Initialize settings tab
    initializeSettingsTab();
}

// Test network connection
async function testNetworkConnection() {
    try {
        showLoading();
        
        // Create Binance API instance without auth for public API
        const binanceApi = new BinanceAPI();
        
        // Test connectivity
        const isConnected = await binanceApi.testConnectivity();
        
        // Update network status in UI
        updateNetworkStatus(isConnected);
        
        // Update state
        state.botStats.networkStatus.isOnline = isConnected;
        state.botStats.networkStatus.lastChecked = new Date();
        state.botStats.networkStatus.failCount = 0;
        
        if (isConnected) {
            addLogMessage('Network connection successful');
        } else {
            addLogMessage('Network connection test failed', true);
        }
        
        return isConnected;
    } catch (error) {
        console.error('Network connection test error:', error);
        addLogMessage('Network error: ' + error.message, true);
        
        // Update network status in UI
        updateNetworkStatus(false);
        
        // Update state
        state.botStats.networkStatus.isOnline = false;
        state.botStats.networkStatus.lastChecked = new Date();
        state.botStats.networkStatus.failCount++;
        
        return false;
    } finally {
        hideLoading();
    }
}

// Update network status in UI
function updateNetworkStatus(isOnline) {
    const networkStatus = document.getElementById('network-status');
    if (!networkStatus) return;
    
    if (isOnline) {
        networkStatus.className = 'network-status online';
        networkStatus.innerHTML = `
            <div class="network-status-dot online"></div>
            <span>Network: Online</span>
            <button class="btn btn-sm btn-outline-secondary ms-auto test-connection-btn" id="test-connection-btn">
                Test
            </button>
        `;
    } else {
        networkStatus.className = 'network-status offline';
        networkStatus.innerHTML = `
            <div class="network-status-dot offline"></div>
            <span>Network: Offline</span>
            <button class="btn btn-sm btn-outline-secondary ms-auto test-connection-btn" id="test-connection-btn">
                Test
            </button>
        `;
    }
    
    // Re-attach event listener
    document.getElementById('test-connection-btn').addEventListener('click', testNetworkConnection);
}

// Fetch initial data
async function fetchInitialData() {
    try {
        showLoading();
        
        // Test network connection first
        const isConnected = await testNetworkConnection();
        
        if (!isConnected) {
            addLogMessage('Cannot fetch data: Network is offline', true);
            hideLoading();
            return;
        }
        
        // Create Binance API instance for paper trading (public API)
        const binanceApi = new BinanceAPI();
        
        try {
            // Fetch historical price data
            state.priceData = await binanceApi.getHistoricalData(state.symbol, state.timeframe, 100);
            
            if (state.priceData.length > 0) {
                // Set current price
                state.currentPrice = state.priceData[state.priceData.length - 1].close;
                state.botStats.marketData.price = state.currentPrice;
                
                // Fetch 24h change and volume
                try {
                    const ticker = await binanceApi.get24hrTicker(state.symbol);
                    state.botStats.marketData.change24h = ticker.priceChangePercent;
                    state.botStats.marketData.volume = ticker.quoteVolume;
                } catch (error) {
                    console.error('Error fetching 24h ticker data:', error);
                    addLogMessage('Error fetching market data: ' + error.message, true);
                    // Set default values
                    state.botStats.marketData.change24h = 0;
                    state.botStats.marketData.volume = 0;
                }
                
                // Update market data display
                updateMarketData();
                
                // Calculate indicators
                const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
                state.indicators = strategy.generateSignals(state.priceData);
                
                // Initialize charts
                initCharts();
                
                // Update price chart
                updatePriceChart();
                
                // Log success
                addLogMessage(`Loaded ${state.priceData.length} historical candles for ${state.symbol}`);
            } else {
                addLogMessage('No price data received from Binance API', true);
            }
        } catch (error) {
            console.error('Error fetching historical data:', error);
            addLogMessage('Error fetching historical data: ' + error.message, true);
        }
        
        // Check if we have API keys for real money mode
        if (state.realMoney.apiKey && state.realMoney.apiSecret) {
            try {
                // Test API keys
                await testApiKeys(state.realMoney.apiKey, state.realMoney.apiSecret);
            } catch (error) {
                console.error('Error testing API keys:', error);
                addLogMessage('Error testing API keys: ' + error.message, true);
            }
        }
        
        // Update UI
        updateMetrics();
        updateTradeHistory();
        updatePositionCard();
        
    } catch (error) {
        console.error('Error initializing data:', error);
        addLogMessage('Error initializing data: ' + error.message, true);
    } finally {
        hideLoading();
    }
}

// Initialize settings tab
function initializeSettingsTab() {
    // Event listeners for settings tab
    
    // Risk management toggle
    const riskManagementToggle = document.getElementById('risk-management-toggle');
    const maxDrawdownValue = document.getElementById('max-drawdown-value');
    const maxDailyLossValue = document.getElementById('max-daily-loss-value');
    
    if (riskManagementToggle && maxDrawdownValue && maxDailyLossValue) {
        riskManagementToggle.addEventListener('change', function() {
            state.settings.riskManagement.enabled = this.checked;
            maxDrawdownValue.disabled = !this.checked;
            maxDailyLossValue.disabled = !this.checked;
        });
    }
    
    // Trailing stop toggle
    const trailingStopToggle = document.getElementById('trailing-stop-toggle');
    const trailingStopValue = document.getElementById('trailing-stop-value');
    
    if (trailingStopToggle && trailingStopValue) {
        trailingStopToggle.addEventListener('change', function() {
            state.settings.trailingStop.enabled = this.checked;
            trailingStopValue.disabled = !this.checked;
        });
    }
    
    // Chart type
    const chartTypeSelect = document.getElementById('chart-type');
    if (chartTypeSelect) {
        chartTypeSelect.addEventListener('change', function() {
            state.settings.chart.type = this.value;
            updatePriceChart();
        });
    }
    
    // Show volume toggle
    const showVolumeToggle = document.getElementById('show-volume-toggle');
    if (showVolumeToggle) {
        showVolumeToggle.addEventListener('change', function() {
            state.settings.chart.showVolume = this.checked;
            updatePriceChart();
        });
    }
    
    // Show indicators toggle
    const showIndicatorsToggle = document.getElementById('show-indicators-toggle');
    if (showIndicatorsToggle) {
        showIndicatorsToggle.addEventListener('change', function() {
            state.settings.chart.showIndicators = this.checked;
            updatePriceChart();
        });
    }
    
    // Theme select
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.addEventListener('change', function() {
            state.settings.theme = this.value;
            if (this.value === 'light') {
                document.body.classList.add('light-theme');
                document.body.classList.remove('dark-theme');
            } else {
                document.body.classList.add('dark-theme');
                document.body.classList.remove('light-theme');
            }
        });
    }
    
    // Network settings
    const retryAttemptsInput = document.getElementById('retry-attempts');
    if (retryAttemptsInput) {
        retryAttemptsInput.addEventListener('change', function() {
            state.settings.network.retryAttempts = parseInt(this.value);
        });
    }
    
    const timeoutSecondsInput = document.getElementById('timeout-seconds');
    if (timeoutSecondsInput) {
        timeoutSecondsInput.addEventListener('change', function() {
            state.settings.network.timeoutSeconds = parseInt(this.value);
        });
    }
    
    const fallbackApiToggle = document.getElementById('fallback-api-toggle');
    if (fallbackApiToggle) {
        fallbackApiToggle.addEventListener('change', function() {
            state.settings.network.usePublicApiFallback = this.checked;
        });
    }
    
    // Notification settings
    const browserAlertToggle = document.getElementById('browser-alert-toggle');
    if (browserAlertToggle) {
        browserAlertToggle.addEventListener('change', function() {
            state.alerts.browser.enabled = this.checked;
        });
    }
    
    const soundAlertToggle = document.getElementById('sound-alert-toggle');
    const soundVolumeInput = document.getElementById('sound-volume-input');
    
    if (soundAlertToggle && soundVolumeInput) {
        soundAlertToggle.addEventListener('change', function() {
            state.alerts.sound.enabled = this.checked;
            soundVolumeInput.disabled = !this.checked;
        });
        
        soundVolumeInput.addEventListener('input', function() {
            state.alerts.sound.volume = parseFloat(this.value);
        });
    }
    
    // Discord webhook
    const discordAlertToggle = document.getElementById('discord-alert-toggle');
    const discordWebhookInput = document.getElementById('discord-webhook-input');
    
    if (discordAlertToggle && discordWebhookInput) {
        discordAlertToggle.addEventListener('change', function() {
            state.alerts.discord.enabled = this.checked;
            discordWebhookInput.disabled = !this.checked;
        });
        
        discordWebhookInput.addEventListener('change', function() {
            state.alerts.discord.webhook = this.value;
        });
    }
    
    // Telegram notifications
    const telegramAlertToggle = document.getElementById('telegram-alert-toggle');
    const telegramTokenInput = document.getElementById('telegram-token-input');
    const telegramChatIdInput = document.getElementById('telegram-chatid-input');
    
    if (telegramAlertToggle && telegramTokenInput && telegramChatIdInput) {
        telegramAlertToggle.addEventListener('change', function() {
            state.alerts.telegram.enabled = this.checked;
            telegramTokenInput.disabled = !this.checked;
            telegramChatIdInput.disabled = !this.checked;
        });
        
        telegramTokenInput.addEventListener('change', function() {
            state.alerts.telegram.botToken = this.value;
        });
        
        telegramChatIdInput.addEventListener('change', function() {
            state.alerts.telegram.chatId = this.value;
        });
    }
    
    // Save all settings button
    const saveAllSettingsBtn = document.getElementById('save-all-settings-btn');
    if (saveAllSettingsBtn) {
        saveAllSettingsBtn.addEventListener('click', function() {
            saveAllSettings();
        });
    }
}

// Save all settings
function saveAllSettings() {
    try {
        // Get values from all settings inputs
        // Risk management
        const riskManagementToggle = document.getElementById('risk-management-toggle');
        const maxDrawdownValue = document.getElementById('max-drawdown-value');
        const maxDailyLossValue = document.getElementById('max-daily-loss-value');
        
        if (riskManagementToggle && maxDrawdownValue && maxDailyLossValue) {
            state.settings.riskManagement.enabled = riskManagementToggle.checked;
            state.settings.riskManagement.maxDrawdown = parseFloat(maxDrawdownValue.value);
            state.settings.riskManagement.maxDailyLoss = parseFloat(maxDailyLossValue.value);
        }
        
        // Trailing stop
        const trailingStopToggle = document.getElementById('trailing-stop-toggle');
        const trailingStopValue = document.getElementById('trailing-stop-value');
        
        if (trailingStopToggle && trailingStopValue) {
            state.settings.trailingStop.enabled = trailingStopToggle.checked;
            state.settings.trailingStop.percentage = parseFloat(trailingStopValue.value);
        }
        
        // Chart settings
        const chartTypeSelect = document.getElementById('chart-type');
        const showVolumeToggle = document.getElementById('show-volume-toggle');
        const showIndicatorsToggle = document.getElementById('show-indicators-toggle');
        
        if (chartTypeSelect) {
            state.settings.chart.type = chartTypeSelect.value;
        }
        
        if (showVolumeToggle) {
            state.settings.chart.showVolume = showVolumeToggle.checked;
        }
        
        if (showIndicatorsToggle) {
            state.settings.chart.showIndicators = showIndicatorsToggle.checked;
        }
        
        // Network settings
        const retryAttemptsInput = document.getElementById('retry-attempts');
        const timeoutSecondsInput = document.getElementById('timeout-seconds');
        const fallbackApiToggle = document.getElementById('fallback-api-toggle');
        
        if (retryAttemptsInput) {
            state.settings.network.retryAttempts = parseInt(retryAttemptsInput.value);
        }
        
        if (timeoutSecondsInput) {
            state.settings.network.timeoutSeconds = parseInt(timeoutSecondsInput.value);
        }
        
        if (fallbackApiToggle) {
            state.settings.network.usePublicApiFallback = fallbackApiToggle.checked;
        }
        
        // Alert settings
        const browserAlertToggle = document.getElementById('browser-alert-toggle');
        const soundAlertToggle = document.getElementById('sound-alert-toggle');
        const soundVolumeInput = document.getElementById('sound-volume-input');
        
        if (browserAlertToggle) {
            state.alerts.browser.enabled = browserAlertToggle.checked;
        }
        
        if (soundAlertToggle && soundVolumeInput) {
            state.alerts.sound.enabled = soundAlertToggle.checked;
            state.alerts.sound.volume = parseFloat(soundVolumeInput.value);
        }
        
        // External notification settings
        const discordAlertToggle = document.getElementById('discord-alert-toggle');
        const discordWebhookInput = document.getElementById('discord-webhook-input');
        
        if (discordAlertToggle && discordWebhookInput) {
            state.alerts.discord.enabled = discordAlertToggle.checked;
            state.alerts.discord.webhook = discordWebhookInput.value;
        }
        
        const telegramAlertToggle = document.getElementById('telegram-alert-toggle');
        const telegramTokenInput = document.getElementById('telegram-token-input');
        const telegramChatIdInput = document.getElementById('telegram-chatid-input');
        
        if (telegramAlertToggle && telegramTokenInput && telegramChatIdInput) {
            state.alerts.telegram.enabled = telegramAlertToggle.checked;
            state.alerts.telegram.botToken = telegramTokenInput.value;
            state.alerts.telegram.chatId = telegramChatIdInput.value;
        }
        
                // Save settings to localStorage
        localStorage.setItem('voltyBotSettings', JSON.stringify({
            settings: state.settings,
            alerts: state.alerts,
            realMoney: {
                orderType: state.realMoney.orderType,
                tradeAmount: state.realMoney.tradeAmount,
                maxDailyLoss: state.realMoney.maxDailyLoss
            }
        }));
        
        // Apply settings
        updatePriceChart();
        
        // Log success
        addLogMessage('All settings saved successfully');
    } catch (error) {
        console.error('Error saving settings:', error);
        addLogMessage('Error saving settings: ' + error.message, true);
    }
}

// Load settings into the UI
function loadSettings() {
    // Risk management settings
    const riskManagementToggle = document.getElementById('risk-management-toggle');
    const maxDrawdownValue = document.getElementById('max-drawdown-value');
    const maxDailyLossValue = document.getElementById('max-daily-loss-value');
    
    if (riskManagementToggle) riskManagementToggle.checked = state.settings.riskManagement.enabled;
    if (maxDrawdownValue) {
        maxDrawdownValue.value = state.settings.riskManagement.maxDrawdown;
        maxDrawdownValue.disabled = !state.settings.riskManagement.enabled;
    }
    if (maxDailyLossValue) {
        maxDailyLossValue.value = state.settings.riskManagement.maxDailyLoss;
        maxDailyLossValue.disabled = !state.settings.riskManagement.enabled;
    }
    
    // Trailing stop
    const trailingStopToggle = document.getElementById('trailing-stop-toggle');
    const trailingStopValue = document.getElementById('trailing-stop-value');
    
    if (trailingStopToggle) trailingStopToggle.checked = state.settings.trailingStop.enabled;
    if (trailingStopValue) {
        trailingStopValue.value = state.settings.trailingStop.percentage;
        trailingStopValue.disabled = !state.settings.trailingStop.enabled;
    }
    
    // Take profit and stop loss
    const takeProfitToggle = document.getElementById('take-profit-toggle');
    const takeProfitValue = document.getElementById('take-profit-value');
    const stopLossToggle = document.getElementById('stop-loss-toggle');
    const stopLossValue = document.getElementById('stop-loss-value');
    
    if (takeProfitToggle) takeProfitToggle.checked = state.settings.takeProfit.enabled;
    if (takeProfitValue) {
        takeProfitValue.value = state.settings.takeProfit.percentage;
        takeProfitValue.disabled = !state.settings.takeProfit.enabled;
    }
    
    if (stopLossToggle) stopLossToggle.checked = state.settings.stopLoss.enabled;
    if (stopLossValue) {
        stopLossValue.value = state.settings.stopLoss.percentage;
        stopLossValue.disabled = !state.settings.stopLoss.enabled;
    }
    
    // Strategy parameters
    const atrLength = document.getElementById('atr-length');
    const atrLengthValue = document.getElementById('atr-length-value');
    const atrMult = document.getElementById('atr-mult');
    const atrMultValue = document.getElementById('atr-mult-value');
    
    if (atrLength) {
        atrLength.value = state.atrLength;
        if (atrLengthValue) atrLengthValue.textContent = state.atrLength;
    }
    
    if (atrMult) {
        atrMult.value = state.atrMultiplier;
        if (atrMultValue) atrMultValue.textContent = state.atrMultiplier;
    }
    
    // Trading settings
    const initialCapital = document.getElementById('initial-capital');
    const positionSize = document.getElementById('position-size');
    const positionSizeValue = document.getElementById('position-size-value');
    
    if (initialCapital) initialCapital.value = state.initialCapital;
    if (positionSize) {
        positionSize.value = state.positionSize * 100;
        if (positionSizeValue) positionSizeValue.textContent = (state.positionSize * 100) + '%';
    }
    
    // Real money trading settings
    const orderTypeSelect = document.getElementById('order-type');
    const tradeAmountInput = document.getElementById('trade-amount');
    const maxDailyLossInput = document.getElementById('max-daily-loss');
    
    if (orderTypeSelect) orderTypeSelect.value = state.realMoney.orderType;
    if (tradeAmountInput) tradeAmountInput.value = state.realMoney.tradeAmount;
    if (maxDailyLossInput) maxDailyLossInput.value = state.realMoney.maxDailyLoss;
    
    // Chart and network settings
    updateSettingsTab();
}

// Update settings tab with current values
function updateSettingsTab() {
    // Chart settings
    const chartTypeSelect = document.getElementById('chart-type');
    const showVolumeToggle = document.getElementById('show-volume-toggle');
    const showIndicatorsToggle = document.getElementById('show-indicators-toggle');
    
    if (chartTypeSelect) chartTypeSelect.value = state.settings.chart.type || 'candlestick';
    if (showVolumeToggle) showVolumeToggle.checked = state.settings.chart.showVolume !== false;
    if (showIndicatorsToggle) showIndicatorsToggle.checked = state.settings.chart.showIndicators !== false;
    
    // Theme
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) themeSelect.value = state.settings.theme;
    
    // Chart update frequency
    const chartUpdateFrequency = document.getElementById('chart-update-frequency');
    if (chartUpdateFrequency) chartUpdateFrequency.value = state.settings.chartUpdateFrequency / 1000;
    
    // Auto trade
    const autoTradeToggle = document.getElementById('auto-trade-toggle');
    if (autoTradeToggle) autoTradeToggle.checked = state.settings.autoTrade;
    
    // Network settings
    const retryAttemptsInput = document.getElementById('retry-attempts');
    const timeoutSecondsInput = document.getElementById('timeout-seconds');
    const fallbackApiToggle = document.getElementById('fallback-api-toggle');
    
    if (retryAttemptsInput) retryAttemptsInput.value = state.settings.network.retryAttempts;
    if (timeoutSecondsInput) timeoutSecondsInput.value = state.settings.network.timeoutSeconds;
    if (fallbackApiToggle) fallbackApiToggle.checked = state.settings.network.usePublicApiFallback;
    
    // Alert settings
    const browserAlertToggle = document.getElementById('browser-alert-toggle');
    const soundAlertToggle = document.getElementById('sound-alert-toggle');
    const soundVolumeInput = document.getElementById('sound-volume-input');
    
    if (browserAlertToggle) browserAlertToggle.checked = state.alerts.browser.enabled;
    if (soundAlertToggle) soundAlertToggle.checked = state.alerts.sound.enabled;
    if (soundVolumeInput) {
        soundVolumeInput.value = state.alerts.sound.volume;
        soundVolumeInput.disabled = !state.alerts.sound.enabled;
    }
    
    // External notification settings
    const discordAlertToggle = document.getElementById('discord-alert-toggle');
    const discordWebhookInput = document.getElementById('discord-webhook-input');
    
    if (discordAlertToggle) discordAlertToggle.checked = state.alerts.discord.enabled;
    if (discordWebhookInput) {
        discordWebhookInput.value = state.alerts.discord.webhook;
        discordWebhookInput.disabled = !state.alerts.discord.enabled;
    }
    
    const telegramAlertToggle = document.getElementById('telegram-alert-toggle');
    const telegramTokenInput = document.getElementById('telegram-token-input');
    const telegramChatIdInput = document.getElementById('telegram-chatid-input');
    
    if (telegramAlertToggle) telegramAlertToggle.checked = state.alerts.telegram.enabled;
    if (telegramTokenInput) {
        telegramTokenInput.value = state.alerts.telegram.botToken;
        telegramTokenInput.disabled = !state.alerts.telegram.enabled;
    }
    if (telegramChatIdInput) {
        telegramChatIdInput.value = state.alerts.telegram.chatId;
        telegramChatIdInput.disabled = !state.alerts.telegram.enabled;
    }
}

// Load settings from localStorage
function loadSettingsFromStorage() {
    try {
        const savedSettings = localStorage.getItem('voltyBotSettings');
        
        if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            
            // Merge settings with defaults
            if (parsedSettings.settings) {
                state.settings = { ...state.settings, ...parsedSettings.settings };
            }
            
            if (parsedSettings.alerts) {
                state.alerts = { ...state.alerts, ...parsedSettings.alerts };
            }
            
            if (parsedSettings.realMoney) {
                Object.assign(state.realMoney, parsedSettings.realMoney);
            }
            
            // Apply theme
            if (state.settings.theme === 'light') {
                document.body.classList.add('light-theme');
                document.body.classList.remove('dark-theme');
            } else {
                document.body.classList.add('dark-theme');
                document.body.classList.remove('light-theme');
            }
            
            addLogMessage('Settings loaded from storage');
            return true;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        addLogMessage('Error loading settings: ' + error.message, true);
    }
    
    return false;
}

// Display loading indicator
function showLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
}

// Hide loading indicator
function hideLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
}

// Update bot status UI
function updateBotStatus(status, message = '') {
    state.botStats.status = status;
    
    const botStatus = document.getElementById('bot-status');
    const activityStatus = document.getElementById('activity-status');
    
    if (botStatus) {
        switch (status) {
            case 'active':
                botStatus.textContent = '✅ BOT ACTIVE';
                botStatus.className = 'status-indicator active';
                break;
            case 'idle':
                botStatus.textContent = '⏸️ BOT IDLE';
                botStatus.className = 'status-indicator idle';
                break;
            case 'error':
                botStatus.textContent = '❌ BOT ERROR';
                botStatus.className = 'status-indicator error';
                break;
            default:
                if (state.realMoney.enabled) {
                    botStatus.textContent = '💰 REAL MONEY TRADING';
                    botStatus.className = 'status-indicator real-money';
                } else {
                    botStatus.textContent = '🔴 PAPER TRADING';
                    botStatus.className = 'status-indicator live';
                }
        }
    }
    
    if (activityStatus && message) {
        activityStatus.textContent = message;
    }
    
    // Update last tick time
    const now = new Date();
    state.botStats.lastTickTime = now;
    
    const lastTickInfo = document.getElementById('last-tick-info');
    if (lastTickInfo) {
        lastTickInfo.textContent = `Last check: ${now.toLocaleTimeString()}`;
    }
}

// Update market data display
function updateMarketData() {
    const marketPrice = document.getElementById('market-price');
    const changeElement = document.getElementById('market-change');
    const volumeElement = document.getElementById('market-volume');
    
    if (marketPrice) marketPrice.textContent = '$' + state.botStats.marketData.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    if (changeElement) {
        const changeValue = state.botStats.marketData.change24h;
        changeElement.textContent = (changeValue >= 0 ? '+' : '') + changeValue.toFixed(2) + '%';
        changeElement.className = changeValue >= 0 ? 'market-value up' : 'market-value down';
    }
    
    if (volumeElement) volumeElement.textContent = formatLargeNumber(state.botStats.marketData.volume);
}

// Initialize charts
function initCharts() {
    try {
        // Check if Plotly and chart elements exist
        if (!window.Plotly || !document.getElementById('priceChart') || !document.getElementById('equityChart')) {
            console.error('Plotly or chart elements not found');
            return;
        }
        
        if (state.priceData.length === 0) {
            // Display empty charts with placeholder text
            Plotly.newPlot('priceChart', [{
                x: [new Date()],
                y: [0],
                type: 'scatter',
                mode: 'lines',
                name: 'Price',
                line: { color: '#3b82f6', width: 2 }
            }], {
                margin: { l: 50, r: 20, t: 20, b: 30 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { color: '#f1f5f9' },
                xaxis: {
                    gridcolor: 'rgba(255,255,255,0.1)',
                    title: 'Time',
                    tickfont: { color: '#f1f5f9' }
                },
                yaxis: {
                    gridcolor: 'rgba(255,255,255,0.1)',
                    title: 'Price ($)',
                    tickfont: { color: '#f1f5f9' }
                },
                annotations: [{
                    x: 0.5,
                    y: 0.5,
                    xref: 'paper',
                    yref: 'paper',
                    text: 'No price data available.<br>Connect your API key or start trading to see data.',
                    showarrow: false,
                    font: { color: '#f1f5f9', size: 14 }
                }]
            }, { responsive: true });
            
            Plotly.newPlot('equityChart', [{
                x: [new Date()],
                y: [state.initialCapital],
                type: 'scatter',
                mode: 'lines',
                name: 'Equity',
                line: { color: '#22c55e', width: 2 }
            }], {
                margin: { l: 50, r: 20, t: 20, b: 30 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { color: '#f1f5f9' },
                xaxis: {
                    gridcolor: 'rgba(255,255,255,0.1)',
                    title: 'Time',
                    tickfont: { color: '#f1f5f9' }
                },
                yaxis: {
                    gridcolor: 'rgba(255,255,255,0.1)',
                    title: 'Equity ($)',
                    tickfont: { color: '#f1f5f9' }
                },
                annotations: [{
                    x: 0.5,
                    y: 0.5,
                    xref: 'paper',
                    yref: 'paper',
                    text: 'No equity data available.<br>Make trades to see your equity curve.',
                    showarrow: false,
                    font: { color: '#f1f5f9', size: 14 }
                }]
            }, { responsive: true });
            
            return;
        }
        
        // Create price chart with available data
        updatePriceChart();
        updateEquityChart();
    } catch (error) {
        console.error('Error initializing charts:', error);
        addLogMessage('Error initializing charts: ' + error.message, true);
    }
}

// Update price chart with latest data
function updatePriceChart() {
    try {
        if (!window.Plotly || !document.getElementById('priceChart') || state.priceData.length === 0) {
            return;
        }
        
        // Extract data for Plotly
        const dates = state.priceData.map(candle => new Date(candle.time));
        const opens = state.priceData.map(candle => candle.open);
        const highs = state.priceData.map(candle => candle.high);
        const lows = state.priceData.map(candle => candle.low);
        const closes = state.priceData.map(candle => candle.close);
        const volumes = state.priceData.map(candle => candle.volume);
        
        // Create colors for volume bars
        const volumeColors = state.priceData.map(candle => candle.close >= candle.open ? OHLC_COLORS.volume.up : OHLC_COLORS.volume.down);
        
        const traces = [];
        
        // Chart type based on settings
        if (state.settings.chart.type === 'candlestick') {
            traces.push({
                x: dates,
                open: opens,
                high: highs,
                low: lows,
                close: closes,
                type: 'candlestick',
                name: 'Price',
                increasing: {
                    line: { color: OHLC_COLORS.up },
                    fillcolor: OHLC_COLORS.upFill
                },
                decreasing: {
                    line: { color: OHLC_COLORS.down },
                    fillcolor: OHLC_COLORS.downFill
                }
            });
        } else if (state.settings.chart.type === 'ohlc') {
            traces.push({
                x: dates,
                open: opens,
                high: highs,
                low: lows,
                close: closes,
                type: 'ohlc',
                name: 'Price',
                increasing: { line: { color: OHLC_COLORS.up } },
                decreasing: { line: { color: OHLC_COLORS.down } }
            });
        } else {
            // Default to line chart
            traces.push({
                x: dates,
                y: closes,
                type: 'scatter',
                mode: 'lines',
                name: 'Price',
                line: { color: '#3b82f6', width: 2 }
            });
        }
        
        // Add volume if enabled
        if (state.settings.chart.showVolume) {
            traces.push({
                x: dates,
                y: volumes,
                type: 'bar',
                name: 'Volume',
                yaxis: 'y2',
                marker: { color: volumeColors },
                opacity: 0.5
            });
        }
        
        // Add indicators if enabled
        if (state.settings.chart.showIndicators && state.indicators && state.indicators.longSignal && state.indicators.longSignal.length > 0) {
            // Long signal line
            traces.push({
                x: dates,
                y: state.indicators.longSignal,
                type: 'scatter',
                mode: 'lines',
                name: 'Long Signal',
                line: {
                    color: 'rgba(34, 197, 94, 0.8)',
                    width: 1,
                    dash: 'dot'
                }
            });
            
            // Short signal line
            traces.push({
                x: dates,
                y: state.indicators.shortSignal,
                type: 'scatter',
                mode: 'lines',
                name: 'Short Signal',
                line: {
                    color: 'rgba(239, 68, 68, 0.8)',
                    width: 1,
                    dash: 'dot'
                }
            });
        }
        
        // Add trade markers
        if (state.trades.length > 0) {
            const longEntries = [];
            const longExits = [];
            const shortEntries = [];
            const shortExits = [];
            
            state.trades.forEach(trade => {
                if (trade.type === 'LONG') {
                    longEntries.push({
                        x: new Date(trade.entryTime),
                        y: trade.entryPrice
                    });
                    
                    if (trade.exitTime) {
                        longExits.push({
                            x: new Date(trade.exitTime),
                            y: trade.exitPrice
                        });
                    }
                } else {
                    shortEntries.push({
                        x: new Date(trade.entryTime),
                        y: trade.entryPrice
                    });
                    
                    if (trade.exitTime) {
                        shortExits.push({
                            x: new Date(trade.exitTime),
                            y: trade.exitPrice
                        });
                    }
                }
            });
            
            if (longEntries.length > 0) {
                traces.push({
                    x: longEntries.map(p => p.x),
                    y: longEntries.map(p => p.y),
                    type: 'scatter',
                    mode: 'markers',
                    name: 'Long Entry',
                    marker: {
                        color: 'rgba(34, 197, 94, 1)',
                        size: 10,
                        symbol: 'triangle-up'
                    }
                });
            }
            
            if (longExits.length > 0) {
                traces.push({
                    x: longExits.map(p => p.x),
                    y: longExits.map(p => p.y),
                    type: 'scatter',
                    mode: 'markers',
                    name: 'Long Exit',
                    marker: {
                        color: 'rgba(34, 197, 94, 0.8)',
                        size: 10,
                        symbol: 'circle'
                    }
                });
            }
            
            if (shortEntries.length > 0) {
                traces.push({
                    x: shortEntries.map(p => p.x),
                    y: shortEntries.map(p => p.y),
                    type: 'scatter',
                    mode: 'markers',
                    name: 'Short Entry',
                    marker: {
                        color: 'rgba(239, 68, 68, 1)',
                        size: 10,
                        symbol: 'triangle-down'
                    }
                });
            }
            
            if (shortExits.length > 0) {
                traces.push({
                    x: shortExits.map(p => p.x),
                    y: shortExits.map(p => p.y),
                    type: 'scatter',
                    mode: 'markers',
                    name: 'Short Exit',
                    marker: {
                        color: 'rgba(239, 68, 68, 0.8)',
                        size: 10,
                        symbol: 'circle'
                    }
                });
            }
        }
        
        // Update chart layout
        const layout = {
            margin: { l: 50, r: 20, t: 20, b: 30 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: {
                color: '#f1f5f9'
            },
            xaxis: {
                gridcolor: 'rgba(255,255,255,0.1)',
                title: 'Time',
                tickfont: {
                    color: '#f1f5f9'
                }
            },
            yaxis: {
                gridcolor: 'rgba(255,255,255,0.1)',
                title: 'Price ($)',
                tickfont: {
                    color: '#f1f5f9'
                },
                domain: state.settings.chart.showVolume ? [0.2, 1] : [0, 1]
            },
            showlegend: true,
            legend: {
                x: 0.01,
                y: 0.99,
                bgcolor: 'rgba(0,0,0,0.3)',
                bordercolor: 'rgba(255,255,255,0.2)',
                borderwidth: 1
            }
        };
        
        // Add volume axis if needed
        if (state.settings.chart.showVolume) {
            layout.yaxis2 = {
                gridcolor: 'rgba(255,255,255,0.1)',
                title: 'Volume',
                tickfont: {
                    color: '#f1f5f9'
                },
                domain: [0, 0.15],
                showticklabels: false
            };
        }
        
        // Update the chart
        Plotly.newPlot('priceChart', traces, layout, { responsive: true });
        
        // Auto-scroll if enabled
        if (state.settings.chart.autoScroll) {
            const xRange = [
                dates[Math.max(0, dates.length - 50)],
                dates[dates.length - 1]
            ];
            
            Plotly.relayout('priceChart', {'xaxis.range': xRange});
        }
    } catch (error) {
        console.error('Error updating price chart:', error);
        addLogMessage('Error updating price chart: ' + error.message, true);
    }
}

// Update equity curve chart
function updateEquityChart() {
    try {
        if (!window.Plotly || !document.getElementById('equityChart')) {
            return;
        }
        
        let equityData = [];
        
        // Add live trading equity
        if (state.equityCurve.length > 0) {
            equityData.push({
                x: state.equityCurve.map(p => p.time),
                y: state.equityCurve.map(p => p.value),
                type: 'scatter',
                mode: 'lines',
                name: 'Live Trading',
                line: {
                    color: '#22c55e',
                    width: 2
                }
            });
        } else {
            // Just add initial capital point if no trades
            equityData.push({
                x: [new Date()],
                y: [state.currentCapital],
                type: 'scatter',
                mode: 'lines',
                name: 'Equity',
                line: {
                    color: '#22c55e',
                    width: 2
                }
            });
        }
        
        // Update chart layout
        const layout = {
            margin: { l: 50, r: 20, t: 20, b: 30 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: {
                color: '#f1f5f9'
            },
            xaxis: {
                gridcolor: 'rgba(255,255,255,0.1)',
                title: 'Time',
                tickfont: {
                    color: '#f1f5f9'
                }
            },
            yaxis: {
                gridcolor: 'rgba(255,255,255,0.1)',
                title: 'Equity ($)',
                tickfont: {
                    color: '#f1f5f9'
                }
            },
            showlegend: true,
            legend: {
                x: 0.01,
                y: 0.99,
                bgcolor: 'rgba(0,0,0,0.3)',
                bordercolor: 'rgba(255,255,255,0.2)',
                borderwidth: 1
            }
        };
        
        // Update the chart
        Plotly.newPlot('equityChart', equityData, layout, { responsive: true });
    } catch (error) {
        console.error('Error updating equity chart:', error);
        addLogMessage('Error updating equity chart: ' + error.message, true);
    }
}

// Test API keys
async function testApiKeys(apiKey, apiSecret) {
    try {
        showLoading();
        
        const binanceApi = new BinanceAPI(apiKey, apiSecret);
        const isConnected = await binanceApi.testConnectivity();
        
        if (isConnected) {
            // Test account info
            const accountInfo = await binanceApi.getAccountInfo();
            
            // Update state
            state.realMoney.apiKeyValid = true;
            
            // Update UI
            const apiKeyStatus = document.getElementById('api-key-status');
            const apiKeyStatusText = document.getElementById('api-key-status-text');
            
            if (apiKeyStatus) apiKeyStatus.className = 'api-key-status valid';
            if (apiKeyStatusText) apiKeyStatusText.textContent = 'Valid';
            
            // Update account balance
            await updateAccountBalance();
            
            // Log success
            addLogMessage('API keys validated successfully');
        } else {
            throw new Error('API connection test failed');
        }
    } catch (error) {
        console.error('Error testing API keys:', error);
        
        // Update state
        state.realMoney.apiKeyValid = false;
        
        // Update UI
        const apiKeyStatus = document.getElementById('api-key-status');
        const apiKeyStatusText = document.getElementById('api-key-status-text');
        
        if (apiKeyStatus) apiKeyStatus.className = 'api-key-status invalid';
        if (apiKeyStatusText) apiKeyStatusText.textContent = 'Invalid';
        
        // Log error
        addLogMessage('API key validation failed: ' + error.message, true);
    } finally {
        hideLoading();
    }
}

// Update account balance (for real money trading)
async function updateAccountBalance() {
    if (!state.realMoney.enabled || !state.realMoney.apiKeyValid) {
        return;
    }
    
    try {
        const binanceApi = new BinanceAPI(state.realMoney.apiKey, state.realMoney.apiSecret);
        const balances = await binanceApi.getBalance();
        
        // Update state with balance information
        if (balances.USDT) {
            state.realMoney.balance.USDT = balances.USDT.free + balances.USDT.locked;
        }
        
        if (balances.BTC) {
            state.realMoney.balance.BTC = balances.BTC.free + balances.BTC.locked;
        }
        
        // Calculate total value in USD
        const btcPrice = state.currentPrice;
        const totalValue = state.realMoney.balance.USDT + (state.realMoney.balance.BTC * btcPrice);
        state.realMoney.balance.totalValue = totalValue;
        
        // Update UI
        updateBalanceDisplay();
    } catch (error) {
        console.error('Error updating account balance:', error);
        addLogMessage('Error updating account balance: ' + error.message, true);
    }
}

// Update balance display in UI
function updateBalanceDisplay() {
    const usdtBalance = document.getElementById('usdt-balance');
    const btcBalance = document.getElementById('btc-balance');
    const totalBalance = document.getElementById('total-balance');
    
    if (usdtBalance) usdtBalance.textContent = state.realMoney.balance.USDT.toFixed(2);
    if (btcBalance) btcBalance.textContent = state.realMoney.balance.BTC.toFixed(8);
    if (totalBalance) totalBalance.textContent = '$' + state.realMoney.balance.totalValue.toFixed(2);
}

// Setup event listeners
function setupEventListeners() {
    // Network test button
    const testConnectionBtn = document.getElementById('test-connection-btn');
    if (testConnectionBtn) {
        testConnectionBtn.addEventListener('click', testNetworkConnection);
    }
    
    // Start trading button
    const startTradingBtn = document.getElementById('start-trading-btn');
    if (startTradingBtn) {
        startTradingBtn.addEventListener('click', startTrading);
    }
    
    // Stop trading button
    const stopTradingBtn = document.getElementById('stop-trading-btn');
    if (stopTradingBtn) {
        stopTradingBtn.addEventListener('click', stopTrading);
    }
    
    // Reset trading button
    const resetTradingBtn = document.getElementById('reset-trading-btn');
    if (resetTradingBtn) {
        resetTradingBtn.addEventListener('click', resetTrading);
    }
    
    // Clear log button
    const clearLogBtn = document.getElementById('clear-log-btn');
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', clearLogs);
    }
    
    // Trading mode switch
    const paperTradingIcon = document.getElementById('paper-trading-icon');
    if (paperTradingIcon) {
        paperTradingIcon.addEventListener('click', switchToPaperTrading);
    }
    
    const realTradingIcon = document.getElementById('real-trading-icon');
    if (realTradingIcon) {
        realTradingIcon.addEventListener('click', switchToRealMoney);
    }
    
    // Emergency sell button
    const emergencySellBtn = document.getElementById('emergency-sell-btn');
    if (emergencySellBtn) {
        emergencySellBtn.addEventListener('click', function() {
            if (confirm('WARNING: This will immediately SELL all current positions. Continue?')) {
                emergencySell();
            }
        });
    }
    
    // API key management
    const saveApiKeysBtn = document.getElementById('save-api-keys-btn');
    if (saveApiKeysBtn) {
        saveApiKeysBtn.addEventListener('click', saveApiKeys);
    }
    
    // API key visibility toggles
    const showApiKeyBtn = document.getElementById('show-api-key-btn');
    if (showApiKeyBtn) {
        showApiKeyBtn.addEventListener('click', function() {
            toggleFieldVisibility('api-key', this);
        });
    }
    
    const showApiSecretBtn = document.getElementById('show-api-secret-btn');
    if (showApiSecretBtn) {
        showApiSecretBtn.addEventListener('click', function() {
            toggleFieldVisibility('api-secret', this);
        });
    }
    
    // Take profit and stop loss toggles
    const takeProfitToggle = document.getElementById('take-profit-toggle');
    const takeProfitValue = document.getElementById('take-profit-value');
    if (takeProfitToggle && takeProfitValue) {
        takeProfitToggle.addEventListener('change', function() {
            state.settings.takeProfit.enabled = this.checked;
            takeProfitValue.disabled = !this.checked;
        });
    }
    
    const stopLossToggle = document.getElementById('stop-loss-toggle');
    const stopLossValue = document.getElementById('stop-loss-value');
    if (stopLossToggle && stopLossValue) {
        stopLossToggle.addEventListener('change', function() {
            state.settings.stopLoss.enabled = this.checked;
            stopLossValue.disabled = !this.checked;
        });
    }
    
    // Strategy parameter sliders
    const atrLengthSlider = document.getElementById('atr-length');
    const atrLengthValue = document.getElementById('atr-length-value');
    if (atrLengthSlider && atrLengthValue) {
        atrLengthSlider.addEventListener('input', function() {
            atrLengthValue.textContent = this.value;
            state.atrLength = parseInt(this.value);
        });
    }
    
    const atrMultSlider = document.getElementById('atr-mult');
    const atrMultValue = document.getElementById('atr-mult-value');
    if (atrMultSlider && atrMultValue) {
        atrMultSlider.addEventListener('input', function() {
            atrMultValue.textContent = this.value;
            state.atrMultiplier = parseFloat(this.value);
        });
    }
    
    // Position size slider
    const positionSizeSlider = document.getElementById('position-size');
    const positionSizeValue = document.getElementById('position-size-value');
    if (positionSizeSlider && positionSizeValue) {
        positionSizeSlider.addEventListener('input', function() {
            positionSizeValue.textContent = this.value + '%';
            state.positionSize = parseInt(this.value) / 100;
        });
    }
    
    // Chart auto-scroll toggle
    const autoScrollToggle = document.getElementById('auto-scroll-toggle');
    if (autoScrollToggle) {
        autoScrollToggle.addEventListener('change', function() {
            state.settings.chart.autoScroll = this.checked;
        });
    }
    
    // Chart controls
    const refreshChartBtn = document.getElementById('refresh-chart-btn');
    if (refreshChartBtn) {
        refreshChartBtn.addEventListener('click', function() {
            updatePriceChart();
            updateEquityChart();
        });
    }
    
    // Chart zoom controls
    const chartZoomIn = document.getElementById('chart-zoom-in');
    if (chartZoomIn) {
        chartZoomIn.addEventListener('click', function() {
            const layout = document.getElementById('priceChart')._fullLayout;
            const xRange = layout.xaxis.range;
            
            // Zoom in by 25%
            const center = (xRange[0] + xRange[1]) / 2;
            const range = xRange[1] - xRange[0];
            const newRange = range * 0.75;
            const newXRange = [center - newRange/2, center + newRange/2];
            
            Plotly.relayout('priceChart', {'xaxis.range': newXRange});
        });
    }
    
    const chartZoomOut = document.getElementById('chart-zoom-out');
    if (chartZoomOut) {
        chartZoomOut.addEventListener('click', function() {
            const layout = document.getElementById('priceChart')._fullLayout;
            const xRange = layout.xaxis.range;
            
            // Zoom out by 33%
            const center = (xRange[0] + xRange[1]) / 2;
            const range = xRange[1] - xRange[0];
            const newRange = range * 1.33;
            const newXRange = [center - newRange/2, center + newRange/2];
            
            Plotly.relayout('priceChart', {'xaxis.range': newXRange});
        });
    }
    
    const chartReset = document.getElementById('chart-reset');
    if (chartReset) {
        chartReset.addEventListener('click', function() {
            Plotly.relayout('priceChart', {
                'xaxis.autorange': true,
                'yaxis.autorange': true
            });
        });
    }
    
    // Export buttons
    const exportTradesBtn = document.getElementById('export-trades-btn');
    if (exportTradesBtn) {
        exportTradesBtn.addEventListener('click', function() {
            FileSystemHelper.exportTrades(state.trades);
            addLogMessage('Trades exported successfully');
        });
    }
    
    const exportLogsBtn = document.getElementById('export-logs-btn');
    if (exportLogsBtn) {
        exportLogsBtn.addEventListener('click', function() {
            FileSystemHelper.exportLogs(state.logs);
            addLogMessage('Logs exported successfully');
        });
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to log out?')) {
                loginSystem.logout();
            }
        });
    }
}

// Toggle field visibility (password/text)
function toggleFieldVisibility(fieldId, button) {
    const field = document.getElementById(fieldId);
    const icon = button.querySelector('i');
    
    if (field.type === 'password') {
        field.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        field.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// Save API keys
function saveApiKeys() {
    const apiKeyInput = document.getElementById('api-key');
    const apiSecretInput = document.getElementById('api-secret');
    
    if (!apiKeyInput || !apiSecretInput) {
        addLogMessage('API key input fields not found', true);
        return;
    }
    
    const apiKey = apiKeyInput.value.trim();
    const apiSecret = apiSecretInput.value.trim();
    
    if (!apiKey || !apiSecret) {
        addLogMessage('API key and secret are required', true);
        return;
    }
    
    // Update state
    state.realMoney.apiKey = apiKey;
    state.realMoney.apiSecret = apiSecret;
    
    // Test the API keys
    testApiKeys(apiKey, apiSecret);
}

// Switch to real money trading mode
function switchToRealMoney() {
    if (state.realMoney.enabled) {
        addLogMessage('Already in real money mode', true);
        return;
    }
    
    // Confirm the switch
    if (!confirm('WARNING: You are about to switch to REAL MONEY trading mode. This will use real funds. Are you sure?')) {
        return;
    }
    
    // Double confirm for safety
    if (!confirm('FINAL WARNING: Real money trading can result in financial loss. Do you accept the risk?')) {
        return;
    }
    
    // Update state
    state.realMoney.enabled = true;
    
    // Update UI
    updateTradingMode();
    
    // Show real money sections
    const realMoneyElements = [
        'api-key-section', 'real-money-warning', 'balance-section', 
        'real-trading-settings'
    ];
    
    realMoneyElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'block';
    });
    
    // Hide paper trading sections
    const paperElement = document.getElementById('paper-trading-settings');
    if (paperElement) paperElement.style.display = 'none';
    
    // Update mode icons
    const paperIcon = document.querySelector('.mode-icon.paper');
    const realIcon = document.querySelector('.mode-icon.real');
    
    if (paperIcon) paperIcon.classList.remove('active');
    if (realIcon) realIcon.classList.add('active');
    
    // Update bot status
    updateBotStatus('idle', 'Switched to REAL MONEY mode');
    
    // Log the change
    addLogMessage('Switched to REAL MONEY trading mode');
}

// Switch to paper trading mode
function switchToPaperTrading() {
    if (!state.realMoney.enabled) {
        addLogMessage('Already in paper trading mode', true);
        return;
    }
    
    // Update state
    state.realMoney.enabled = false;
    
    // Update UI
    updateTradingMode();
    
    // Hide real money sections
    const realMoneyElements = [
        'api-key-section', 'real-money-warning', 'balance-section', 
        'real-trading-settings'
    ];
    
    realMoneyElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
    
    // Show paper trading sections
    const paperElement = document.getElementById('paper-trading-settings');
    if (paperElement) paperElement.style.display = 'block';
    
    // Update mode icons
    const paperIcon = document.querySelector('.mode-icon.paper');
    const realIcon = document.querySelector('.mode-icon.real');
    
    if (paperIcon) paperIcon.classList.add('active');
    if (realIcon) realIcon.classList.remove('active');
    
    // Update bot status
    updateBotStatus('idle', 'Switched to paper trading mode');
    
    // Log the change
    addLogMessage('Switched to paper trading mode');
}

// Update trading mode in the UI
function updateTradingMode() {
    const botStatus = document.getElementById('bot-status');
    
    if (botStatus) {
        if (state.realMoney.enabled) {
            botStatus.textContent = '💰 REAL MONEY TRADING';
            botStatus.className = 'status-indicator real-money';
        } else {
            botStatus.textContent = '🔴 PAPER TRADING';
            botStatus.className = 'status-indicator live';
        }
    }
}

// Emergency sell all positions
function emergencySell() {
    if (state.currentPosition) {
        exitPosition('Emergency Sell');
        addLogMessage('EMERGENCY SELL executed - Position closed', true);
    } else {
        addLogMessage('No open position to sell', true);
    }
}

// Log message function
function addLogMessage(message, isError = false) {
    // Create timestamp
    const timestamp = new Date().toLocaleString();
    
    // Log to console
    if (isError) {
        console.error(`[${timestamp}] ${message}`);
    } else {
        console.log(`[${timestamp}] ${message}`);
    }
    
    // Store in logs array
    state.logs.push({
        timestamp,
        message,
        isError
    });
    
    // Update UI
    const logElement = document.getElementById('logMessages');
    if (logElement) {
        // Create UI element
        const logItem = document.createElement('div');
        logItem.className = isError ? 'negative' : '';
        logItem.innerHTML = `<strong>${timestamp}</strong>: ${message}`;
        
        // Add to UI (at the top)
        logElement.prepend(logItem);
        
        // Limit the number of log messages in the UI
        while (logElement.childElementCount > 100) {
            logElement.removeChild(logElement.lastChild);
        }
    }
}

// Clear logs
function clearLogs() {
    const logElement = document.getElementById('logMessages');
    if (logElement) {
        logElement.innerHTML = '';
    }
    
    addLogMessage('Logs cleared');
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    // Set current date/time constants
    state.currentDateTime = '2025-06-06 23:53:57';
    state.currentUser = 'gelimorto2';
    
    // Initialize login system
    loginSystem.init();
});
