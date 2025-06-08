// Constants and settings
const BINANCE_API_URL = 'https://api.binance.com/api/v3';
// Fix: Remove /fapi/v1 from base URLs
const BINANCE_FUTURES_API_URL = 'https://fapi.binance.com';
const BINANCE_FUTURES_TESTNET_API_URL = 'https://testnet.binancefuture.com';
const PROXY_URL = 'https://cors-anywhere.herokuapp.com/'; // Use a CORS proxy if needed
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
    historicalTrades: [], // Added to store historical trades (backtest)
    equityCurve: [],
    currentPosition: null,
    isTrading: false,
    initialCapital: 10000,
    currentCapital: 10000,
    positionSize: 0.1, // 10% for paper trading
    livePositionSize: 0.05, // 5% for live trading
    atrLength: 5,
    atrMultiplier: 0.75,
    symbol: 'BTCUSDT',
    timeframe: '1h',
    currentPrice: 0,
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
        capital: 10000, // Separate capital for backtest
        trades: [] // Backtest trades
    },
    alerts: {
        discord: {
            enabled: false,
            webhook: ''
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
        autoTrade: true, // Set to true by default to ensure trades are executed
        trailingStop: {
            enabled: false,
            percentage: 1.5
        },
        takeProfit: {
            enabled: true, // Enabled by default
            percentage: 3.0
        },
        stopLoss: {
            enabled: true, // Enabled by default
            percentage: 2.0
        },
        riskManagement: {
            enabled: false,
            maxDrawdown: 10,
            maxDailyLoss: 5
        }
    },
    botStats: {
        status: 'idle', // idle, scanning, trading
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
            stopLossPrice: 0
        }
    },
    // New futures trading configuration
    futuresTrading: {
        enabled: true,      // Enable futures by default
        testnet: true,      // Use testnet by default
        apiKey: '',
        apiSecret: '',
        authenticated: false,
        balances: {
            totalWalletBalance: 0,
            totalUnrealizedProfit: 0,
            totalMarginBalance: 0,
            availableBalance: 0
        },
        fees: {
            maker: 0.0002, // Default 0.02%
            taker: 0.0004  // Default 0.04%
        },
        leverage: 5,        // Default 5x leverage
        marginType: 'ISOLATED', // ISOLATED or CROSSED
        limits: {
            maxPositionSize: 25, // Max 25% of balance
            maxLeverage: 20,     // Max 20x leverage
            maxDailyLoss: 5,     // 5% of balance
            maxDrawdown: 15,     // 15% from peak
            maxOrders: 10        // Max 10 orders per day
        },
        dailyStats: {
            orders: 0,
            peakBalance: 0,
            startBalance: 0,
            currentDrawdown: 0
        },
        fundingInfo: {
            rate: 0,
            nextTime: null,
            interval: '8h'
        },
        positions: [],      // Current open positions
        orderHistory: []    // Order history
    },
    // General status indicator
    statusIndicator: {
        visible: false,
        message: '',
        progress: 0,
        type: 'info' // info, warning, error, success
    }
};

// Notification sound
let notificationSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-interface-click-1126.mp3');

// Data classes
class Trade {
    constructor(entryTime, type, entryPrice, size, leverage = 1, isFees = false) {
        this.entryTime = entryTime;
        this.exitTime = null;
        this.type = type; // 'LONG' or 'SHORT'
        this.entryPrice = entryPrice;
        this.exitPrice = null;
        this.size = size;
        this.leverage = leverage; // Added for futures
        this.pnl = 0;
        this.pnlPct = 0;
        this.fees = 0;      // Store trading fees
        this.hasFees = isFees; // Whether fees are calculated
        this.orderId = null; // For live trading
        this.liquidationPrice = 0; // For futures
        this.marginType = 'ISOLATED'; // Default to ISOLATED
    }

    close(exitTime, exitPrice, feesPercentage = 0) {
        this.exitTime = exitTime;
        this.exitPrice = exitPrice;
        
        if (this.hasFees) {
            // Calculate fees for entry and exit (futures)
            const notionalValue = this.size * this.entryPrice; // Contract value
            const entryFee = notionalValue * feesPercentage;
            const exitFee = this.size * exitPrice * feesPercentage;
            this.fees = entryFee + exitFee;
        }
        
        // Calculate PNL for futures (with leverage)
        if (this.type === 'LONG') {
            const percentChange = (exitPrice - this.entryPrice) / this.entryPrice;
            this.pnl = this.size * this.entryPrice * percentChange * this.leverage - this.fees;
            this.pnlPct = percentChange * this.leverage;
        } else { // SHORT
            const percentChange = (this.entryPrice - exitPrice) / this.entryPrice;
            this.pnl = this.size * this.entryPrice * percentChange * this.leverage - this.fees;
            this.pnlPct = percentChange * this.leverage;
        }
        
        // Adjust percentage return to account for fees if applicable
        if (this.hasFees) {
            this.pnlPct = this.pnl / (this.size * this.entryPrice / this.leverage);
        }
        
        return this.pnl;
    }

    getUnrealizedPnl(currentPrice, feesPercentage = 0) {
        let unrealizedFees = 0;
        const notionalValue = this.size * this.entryPrice; // Contract value
        
        if (this.hasFees) {
            // Calculate entry fee
            const entryFee = notionalValue * feesPercentage;
            // Estimate exit fee
            const exitFee = this.size * currentPrice * feesPercentage;
            unrealizedFees = entryFee + exitFee;
        }
        
        // Calculate unrealized PNL for futures (with leverage)
        if (this.type === 'LONG') {
            const percentChange = (currentPrice - this.entryPrice) / this.entryPrice;
            return notionalValue * percentChange * this.leverage - unrealizedFees;
        } else { // SHORT
            const percentChange = (this.entryPrice - currentPrice) / this.entryPrice;
            return notionalValue * percentChange * this.leverage - unrealizedFees;
        }
    }

    getUnrealizedPnlPct(currentPrice, feesPercentage = 0) {
        const pnl = this.getUnrealizedPnl(currentPrice, feesPercentage);
        // Return percentage based on the actual margin used (considering leverage)
        return pnl / (this.size * this.entryPrice / this.leverage);
    }

    // Calculate liquidation price for futures
    calculateLiquidationPrice(maintenanceMargin = 0.004) {
        // This is a simplified calculation, actual liquidation price depends on many factors
        if (this.type === 'LONG') {
            // For longs: Entry price * (1 - Initial margin / leverage)
            this.liquidationPrice = this.entryPrice * (1 - (1 / this.leverage) + maintenanceMargin);
        } else { // SHORT
            // For shorts: Entry price * (1 + Initial margin / leverage)
            this.liquidationPrice = this.entryPrice * (1 + (1 / this.leverage) - maintenanceMargin);
        }
        return this.liquidationPrice;
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

// Binance Futures API Connector 
class BinanceFuturesConnector {
    constructor(apiKey, apiSecret, testnet = true) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.testnet = testnet;
        this.baseUrl = testnet ? BINANCE_FUTURES_TESTNET_API_URL : BINANCE_FUTURES_API_URL;
        this.lastRequestTime = 0;
        this.requestCount = 0;
    }

    // Generate signature for authenticated requests
    generateSignature(queryString) {
        return CryptoJS.HmacSHA256(queryString, this.apiSecret).toString();
    }

    // Rate limiter to avoid Binance API limits
    async rateLimiter() {
        const now = Date.now();
        const elapsedTime = now - this.lastRequestTime;
        
        // If less than 500ms have passed since last request, wait
        if (elapsedTime < 500) {
            await new Promise(resolve => setTimeout(resolve, 500 - elapsedTime));
        }
        
        this.lastRequestTime = Date.now();
        this.requestCount++;
        
        return true;
    }

    // Helper for making authenticated requests
    async makeAuthenticatedRequest(endpoint, params = {}, method = 'GET') {
        await this.rateLimiter();
        
        try {
            const timestamp = Date.now();
            let queryString = `timestamp=${timestamp}`;
            
            // Add other parameters to query string
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) {
                    queryString += `&${key}=${encodeURIComponent(value)}`;
                }
            });
            
            // Generate signature
            const signature = this.generateSignature(queryString);
            queryString += `&signature=${signature}`;
            
            // Build URL
            const url = `${this.baseUrl}${endpoint}?${queryString}`;
            
            const headers = {
                'X-MBX-APIKEY': this.apiKey
            };
            
            // Make the request
            const response = await fetch(url, {
                method,
                headers
            });
            
            // Handle non-OK responses
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Binance API error: ${JSON.stringify(errorData)}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error making authenticated request:', error);
            throw error;
        }
    }

    // Make a public request (no authentication needed)
    async makePublicRequest(endpoint, params = {}) {
        await this.rateLimiter();
        
        try {
            let queryString = Object.entries(params)
                .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                .join('&');
            
            const url = `${this.baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Binance API error: ${JSON.stringify(errorData)}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error making public request:', error);
            throw error;
        }
    }

    // Test API key validity
    async testConnectivity() {
        try {
            // First test ping to check connectivity
            await this.makePublicRequest('/fapi/v1/ping');
            
            // Then test authenticated endpoint
            // FIX: Use /fapi/v2/account instead of /fapi/v1/account
            const accountInfo = await this.makeAuthenticatedRequest('/fapi/v2/account');
            
            return {
                success: true,
                account: {
                    canTrade: accountInfo.canTrade,
                    totalWalletBalance: accountInfo.totalWalletBalance,
                    totalUnrealizedProfit: accountInfo.totalUnrealizedProfit,
                    availableBalance: accountInfo.availableBalance
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get futures account information
    async getAccountInfo() {
        // FIX: Use /fapi/v2/account instead of /fapi/v1/account
        return this.makeAuthenticatedRequest('/fapi/v2/account');
    }

    // Get account balance
    async getBalance() {
        const accountInfo = await this.getAccountInfo();
        
        const totalWalletBalance = parseFloat(accountInfo.totalWalletBalance);
        const totalUnrealizedProfit = parseFloat(accountInfo.totalUnrealizedProfit);
        const totalMarginBalance = parseFloat(accountInfo.totalMarginBalance);
        const availableBalance = parseFloat(accountInfo.availableBalance);
        
        return {
            totalWalletBalance,
            totalUnrealizedProfit,
            totalMarginBalance,
            availableBalance
        };
    }

    // Get exchange information
    async getExchangeInfo(symbol) {
        if (symbol) {
            return this.makePublicRequest('/fapi/v1/exchangeInfo', { symbol });
        }
        return this.makePublicRequest('/fapi/v1/exchangeInfo');
    }

    // Get latest price for a symbol
    async getSymbolPrice(symbol) {
        const result = await this.makePublicRequest('/fapi/v1/ticker/price', { symbol });
        return parseFloat(result.price);
    }

    // Get kline/candlestick data
    async getKlines(symbol, interval, limit = 100) {
        const result = await this.makePublicRequest('/fapi/v1/klines', { 
            symbol, 
            interval, 
            limit 
        });
        
        return result.map(kline => ({
            datetime: new Date(kline[0]),
            open: parseFloat(kline[1]),
            high: parseFloat(kline[2]),
            low: parseFloat(kline[3]),
            close: parseFloat(kline[4]),
            volume: parseFloat(kline[5])
        }));
    }

    // Get current position information
    async getPositionInfo(symbol) {
        // FIX: Use /fapi/v2/positionRisk instead of /fapi/v1/positionRisk
        const positions = await this.makeAuthenticatedRequest('/fapi/v2/positionRisk', { symbol });
        return positions.filter(p => parseFloat(p.positionAmt) !== 0);
    }

    // Get all open positions
    async getAllPositions() {
        // FIX: Use /fapi/v2/positionRisk instead of /fapi/v1/positionRisk
        return this.makeAuthenticatedRequest('/fapi/v2/positionRisk');
    }

    // Change leverage for a symbol
    async changeLeverage(symbol, leverage) {
        return this.makeAuthenticatedRequest('/fapi/v1/leverage', {
            symbol,
            leverage
        }, 'POST');
    }

    // Change margin type (ISOLATED or CROSSED)
    async changeMarginType(symbol, marginType) {
        return this.makeAuthenticatedRequest('/fapi/v1/marginType', {
            symbol,
            marginType // ISOLATED or CROSSED
        }, 'POST');
    }

    // Get funding rate
    async getFundingRate(symbol) {
        return this.makePublicRequest('/fapi/v1/fundingRate', { symbol });
    }

    // Place a market order
    async placeMarketOrder(symbol, side, quantity, reduceOnly = false) {
        return this.makeAuthenticatedRequest('/fapi/v1/order', {
            symbol,
            side,
            type: 'MARKET',
            quantity,
            reduceOnly,
            timestamp: Date.now()
        }, 'POST');
    }

    // Place a limit order
    async placeLimitOrder(symbol, side, quantity, price, timeInForce = 'GTC', reduceOnly = false) {
        return this.makeAuthenticatedRequest('/fapi/v1/order', {
            symbol,
            side,
            type: 'LIMIT',
            timeInForce,
            quantity,
            price,
            reduceOnly,
            timestamp: Date.now()
        }, 'POST');
    }

    // Place a stop market order
    async placeStopMarketOrder(symbol, side, quantity, stopPrice, reduceOnly = false) {
        return this.makeAuthenticatedRequest('/fapi/v1/order', {
            symbol,
            side,
            type: 'STOP_MARKET',
            quantity,
            stopPrice,
            reduceOnly,
            timestamp: Date.now()
        }, 'POST');
    }

    // Place a take profit market order
    async placeTakeProfitMarketOrder(symbol, side, quantity, stopPrice, reduceOnly = false) {
        return this.makeAuthenticatedRequest('/fapi/v1/order', {
            symbol,
            side,
            type: 'TAKE_PROFIT_MARKET',
            quantity,
            stopPrice,
            reduceOnly,
            timestamp: Date.now()
        }, 'POST');
    }

    // Cancel an order
    async cancelOrder(symbol, orderId) {
        return this.makeAuthenticatedRequest('/fapi/v1/order', {
            symbol,
            orderId,
            timestamp: Date.now()
        }, 'DELETE');
    }

    // Cancel all orders for a symbol
    async cancelAllOrders(symbol) {
        return this.makeAuthenticatedRequest('/fapi/v1/allOpenOrders', {
            symbol,
            timestamp: Date.now()
        }, 'DELETE');
    }

    // Get order status
    async getOrder(symbol, orderId) {
        return this.makeAuthenticatedRequest('/fapi/v1/order', {
            symbol,
            orderId,
            timestamp: Date.now()
        });
    }

    // Get all open orders
    async getOpenOrders(symbol) {
        return this.makeAuthenticatedRequest('/fapi/v1/openOrders', {
            symbol,
            timestamp: Date.now()
        });
    }

    // Get all orders
    async getAllOrders(symbol, limit = 500) {
        return this.makeAuthenticatedRequest('/fapi/v1/allOrders', {
            symbol,
            limit,
            timestamp: Date.now()
        });
    }

    // Get trading fee rates
    async getTradingFee(symbol) {
        return this.makeAuthenticatedRequest('/fapi/v1/commissionRate', { symbol });
    }
}

// Futures Trading Manager
class FuturesTradingManager {
    constructor(binanceConnector, symbol) {
        this.binance = binanceConnector;
        this.symbol = symbol;
        this.state = {
            connected: false,
            balances: {
                totalWalletBalance: 0,
                totalUnrealizedProfit: 0,
                totalMarginBalance: 0,
                availableBalance: 0
            },
            positions: [],
            orders: [],
            fees: {
                maker: 0.0002, // Default 0.02%
                taker: 0.0004  // Default 0.04%
            },
            leverage: 5, // Default 5x leverage
            marginType: 'ISOLATED', // ISOLATED or CROSSED
            limits: state.futuresTrading.limits,
            dailyStats: {
                orders: 0,
                startBalance: 0,
                peakBalance: 0,
                currentDrawdown: 0
            },
            fundingInfo: {
                rate: 0,
                nextTime: null,
            }
        };
    }

    // Initialize connection and fetch account data
    async initialize() {
        try {
            // Test connection
            const connectivityTest = await this.binance.testConnectivity();
            if (!connectivityTest.success) {
                throw new Error('Failed to connect to Binance Futures API');
            }
            
            // Get account balances
            await this.syncAccount();
            
            // Get open positions
            const positions = await this.binance.getPositionInfo(this.symbol);
            this.state.positions = positions || [];
            
            // Get open orders
            const openOrders = await this.binance.getOpenOrders(this.symbol);
            this.state.orders = openOrders || [];
            
            // Get trading fees
            try {
                const feeData = await this.binance.getTradingFee(this.symbol);
                if (feeData && feeData.length > 0) {
                    this.state.fees.maker = parseFloat(feeData[0].makerCommissionRate);
                    this.state.fees.taker = parseFloat(feeData[0].takerCommissionRate);
                }
            } catch (error) {
                console.warn('Could not fetch fee data, using default rates', error);
            }
            
            // Get funding rates
            try {
                const fundingData = await this.binance.getFundingRate(this.symbol);
                if (fundingData && fundingData.length > 0) {
                    this.state.fundingInfo.rate = parseFloat(fundingData[0].fundingRate);
                    this.state.fundingInfo.nextTime = new Date(fundingData[0].nextFundingTime);
                }
            } catch (error) {
                console.warn('Could not fetch funding data', error);
            }
            
            // Update daily stats
            this.state.dailyStats.startBalance = this.state.balances.totalWalletBalance;
            this.state.dailyStats.peakBalance = this.state.balances.totalWalletBalance;
            
            // Set leverage and margin type
            await this.setLeverage(this.state.leverage);
            await this.setMarginType(this.state.marginType);
            
            // Mark as connected
            this.state.connected = true;
            
            return {
                success: true,
                balances: this.state.balances,
                positions: this.state.positions,
                fees: this.state.fees,
                fundingRate: this.state.fundingInfo.rate
            };
        } catch (error) {
            console.error('Error initializing futures trading:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Sync account information with Binance
    async syncAccount() {
        try {
            const balance = await this.binance.getBalance();
            
            this.state.balances = {
                totalWalletBalance: balance.totalWalletBalance,
                totalUnrealizedProfit: balance.totalUnrealizedProfit,
                totalMarginBalance: balance.totalMarginBalance,
                availableBalance: balance.availableBalance
            };
            
            // Update drawdown stats
            if (balance.totalMarginBalance > this.state.dailyStats.peakBalance) {
                this.state.dailyStats.peakBalance = balance.totalMarginBalance;
            }
            
            if (this.state.dailyStats.peakBalance > 0) {
                this.state.dailyStats.currentDrawdown = 
                    (this.state.dailyStats.peakBalance - balance.totalMarginBalance) / this.state.dailyStats.peakBalance * 100;
            }
            
            return this.state.balances;
        } catch (error) {
            console.error('Error syncing account:', error);
            throw error;
        }
    }

    // Set leverage for the symbol
    async setLeverage(leverage) {
        try {
            const result = await this.binance.changeLeverage(this.symbol, leverage);
            this.state.leverage = result.leverage;
            return result;
        } catch (error) {
            console.error('Error setting leverage:', error);
            throw error;
        }
    }

    // Set margin type for the symbol
    async setMarginType(marginType) {
        try {
            await this.binance.changeMarginType(this.symbol, marginType);
            this.state.marginType = marginType;
            return true;
        } catch (error) {
            // If already set to the requested margin type, consider it a success
            if (error.message.includes("No need to change margin type")) {
                this.state.marginType = marginType;
                return true;
            }
            console.error('Error setting margin type:', error);
            throw error;
        }
    }

    // Get current positions for the symbol
    async getPositions() {
        try {
            const positions = await this.binance.getPositionInfo(this.symbol);
            this.state.positions = positions.filter(p => parseFloat(p.positionAmt) !== 0);
            return this.state.positions;
        } catch (error) {
            console.error('Error getting positions:', error);
            throw error;
        }
    }

    // Calculate quantity based on USD amount and current price
    async calculateQuantity(usdAmount) {
        try {
            const price = await this.binance.getSymbolPrice(this.symbol);
            
            // Convert USD amount to contract quantity
            // For BTC, quantity is in BTC. For most other contracts, it's in whole contracts
            // Binance Futures requires specific precision for different symbols
            const quantity = usdAmount / price;
            
            // Round to appropriate precision (this is simplified, may need adjustment per symbol)
            return Math.floor(quantity * 1000) / 1000; // Round to 3 decimal places for most futures
        } catch (error) {
            console.error('Error calculating quantity:', error);
            throw error;
        }
    }

    // Place a market order with position sizing based on account balance
    async placeMarketOrder(side, percentOfBalance = 5, reduceOnly = false) {
        try {
            // Check if we're within daily order limit
            if (this.state.dailyStats.orders >= this.state.limits.maxOrders) {
                throw new Error(`Daily order limit (${this.state.limits.maxOrders}) reached`);
            }
            
            // Check drawdown limits
            if (this.state.dailyStats.currentDrawdown > this.state.limits.maxDrawdown) {
                throw new Error(`Max drawdown limit (${this.state.limits.maxDrawdown}%) exceeded: ${this.state.dailyStats.currentDrawdown.toFixed(2)}%`);
            }
            
            // Calculate daily PnL percentage
            const dailyPnlPercentage = ((this.state.balances.totalMarginBalance - this.state.dailyStats.startBalance) / this.state.dailyStats.startBalance) * 100;
            
            // Check daily loss limit
            if (dailyPnlPercentage < -this.state.limits.maxDailyLoss) {
                throw new Error(`Max daily loss limit (${this.state.limits.maxDailyLoss}%) exceeded: ${dailyPnlPercentage.toFixed(2)}%`);
            }
            
            // Calculate USD amount to trade
            const usdAmount = this.state.balances.availableBalance * (percentOfBalance / 100);
            
            // Convert to quantity
            const quantity = await this.calculateQuantity(usdAmount);
            
            // Place the order
            const order = await this.binance.placeMarketOrder(
                this.symbol,
                side,
                quantity.toFixed(3), // Adjust precision as needed
                reduceOnly
            );
            
            // Increment order count
            this.state.dailyStats.orders++;
            
            // Update orders list
            this.state.orders.push(order);
            
            // Create a Trade object for tracking
            const tradeObj = new Trade(
                new Date(),
                side === 'BUY' ? 'LONG' : 'SHORT',
                parseFloat(order.avgPrice || await this.binance.getSymbolPrice(this.symbol)),
                parseFloat(order.executedQty),
                this.state.leverage,
                true // Enable fee calculation
            );
            
            tradeObj.orderId = order.orderId;
            tradeObj.marginType = this.state.marginType;
            tradeObj.calculateLiquidationPrice();
            
            // Sync account data
            await this.syncAccount();
            
            // Get updated positions
            await this.getPositions();
            
            return {
                success: true,
                order,
                trade: tradeObj
            };
        } catch (error) {
            console.error('Error placing market order:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Place stop loss and take profit orders for an open position
    async placeStopLossAndTakeProfitOrders(stopLossPercent, takeProfitPercent) {
        try {
            // First check if we have an open position
            const positions = await this.getPositions();
            if (!positions || positions.length === 0) {
                throw new Error('No open position found');
            }
            
            const position = positions[0];
            const positionAmt = parseFloat(position.positionAmt);
            const entryPrice = parseFloat(position.entryPrice);
            
            // Determine position side
            const isLong = positionAmt > 0;
            const positionSide = isLong ? 'LONG' : 'SHORT';
            
            // Calculate stop loss and take profit prices
            let stopLossPrice, takeProfitPrice;
            
            if (isLong) {
                stopLossPrice = entryPrice * (1 - stopLossPercent / 100);
                takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);
            } else {
                stopLossPrice = entryPrice * (1 + stopLossPercent / 100);
                takeProfitPrice = entryPrice * (1 - takeProfitPercent / 100);
            }
            
            // Place stop loss order
            const stopLossSide = isLong ? 'SELL' : 'BUY';
            const stopLossOrder = await this.binance.placeStopMarketOrder(
                this.symbol,
                stopLossSide,
                Math.abs(positionAmt),
                stopLossPrice.toFixed(2),
                true // Reduce only
            );
            
            // Place take profit order
            const takeProfitSide = isLong ? 'SELL' : 'BUY';
            const takeProfitOrder = await this.binance.placeTakeProfitMarketOrder(
                this.symbol,
                takeProfitSide,
                Math.abs(positionAmt),
                takeProfitPrice.toFixed(2),
                true // Reduce only
            );
            
            return {
                success: true,
                position: positionSide,
                stopLoss: {
                    price: stopLossPrice,
                    order: stopLossOrder
                },
                takeProfit: {
                    price: takeProfitPrice,
                    order: takeProfitOrder
                }
            };
        } catch (error) {
            console.error('Error placing stop loss and take profit orders:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Close all positions for the symbol
    async closeAllPositions() {
        try {
            // First get all open positions
            const positions = await this.getPositions();
            
            if (!positions || positions.length === 0) {
                return {
                    success: true,
                    message: 'No open positions to close'
                };
            }
            
            const closedPositions = [];
            
            // Close each position with a market order
            for (const position of positions) {
                const positionAmt = parseFloat(position.positionAmt);
                
                // Skip if position amount is 0
                if (positionAmt === 0) continue;
                
                // Determine order side to close the position
                const side = positionAmt > 0 ? 'SELL' : 'BUY';
                
                // Place a market order to close the position
                const result = await this.binance.placeMarketOrder(
                    this.symbol,
                    side,
                    Math.abs(positionAmt).toFixed(3),
                    true // Reduce only
                );
                
                closedPositions.push({
                    symbol: position.symbol,
                    positionAmt,
                    side,
                    result
                });
            }
            
            // Cancel all open orders
            await this.binance.cancelAllOrders(this.symbol);
            
            // Sync account information
            await this.syncAccount();
            
            return {
                success: true,
                closedPositions,
                message: `Closed ${closedPositions.length} positions and cancelled all orders`
            };
        } catch (error) {
            console.error('Error closing all positions:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Emergency stop - close all positions and cancel all orders
    async emergencyStop() {
        try {
            // Close all positions and cancel all orders
            const result = await this.closeAllPositions();
            
            // Sync account data
            await this.syncAccount();
            
            return {
                success: true,
                message: 'Emergency stop executed successfully',
                details: result
            };
        } catch (error) {
            console.error('Error executing emergency stop:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Calculate unrealized PnL for all open positions
    async calculateTotalUnrealizedPnL() {
        try {
            // Get current positions
            await this.getPositions();
            
            if (this.state.positions.length === 0) {
                return {
                    totalUnrealizedProfit: 0,
                    positionDetails: []
                };
            }
            
            // Get current price
            const currentPrice = await this.binance.getSymbolPrice(this.symbol);
            
            let totalUnrealizedProfit = 0;
            const positionDetails = [];
            
            for (const position of this.state.positions) {
                const positionAmt = parseFloat(position.positionAmt);
                const entryPrice = parseFloat(position.entryPrice);
                const unrealizedProfit = parseFloat(position.unrealizedProfit);
                
                // Calculate PnL percentage
                const leverageBracket = parseFloat(position.leverage);
                const marginType = position.marginType;
                const notionalValue = Math.abs(positionAmt) * entryPrice;
                const margin = notionalValue / leverageBracket;
                
                // Calculate unrealized PnL percentage
                const unrealizedPnLPercentage = (unrealizedProfit / margin) * 100;
                
                // Add to total
                totalUnrealizedProfit += unrealizedProfit;
                
                // Create position detail object
                positionDetails.push({
                    symbol: position.symbol,
                    positionAmt,
                    entryPrice,
                    markPrice: currentPrice,
                    unrealizedProfit,
                    unrealizedPnLPercentage,
                    leverage: leverageBracket,
                    marginType,
                    liquidationPrice: parseFloat(position.liquidationPrice),
                    positionSide: positionAmt > 0 ? 'LONG' : 'SHORT'
                });
            }
            
            return {
                totalUnrealizedProfit,
                positionDetails
            };
        } catch (error) {
            console.error('Error calculating unrealized PnL:', error);
            throw error;
        }
    }
}

// Status indicator functions
function showStatusIndicator(message, type = 'info') {
    state.statusIndicator.visible = true;
    state.statusIndicator.message = message;
    state.statusIndicator.type = type;
    state.statusIndicator.progress = 0;
    
    const statusBar = document.getElementById('status-bar');
    const statusMessage = document.getElementById('status-message');
    const statusProgress = document.getElementById('status-progress');
    
    if (!statusBar) return; // Safety check
    
    statusBar.style.display = 'block';
    statusMessage.textContent = message;
    statusProgress.style.width = '0%';
    
    // Set appropriate color based on type
    statusBar.className = 'status-bar';
    statusBar.classList.add(`status-${type}`);
}

function updateStatusProgress(progress) {
    if (!state.statusIndicator.visible) return;
    
    state.statusIndicator.progress = progress;
    
    const statusProgress = document.getElementById('status-progress');
    if (statusProgress) {
        statusProgress.style.width = `${progress}%`;
    }
}

function hideStatusIndicator() {
    state.statusIndicator.visible = false;
    
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
        statusBar.style.display = 'none';
    }
}

// Show loading indicator
function showLoading() {
    document.getElementById('loadingIndicator').style.display = 'flex';
}

// Hide loading indicator
function hideLoading() {
    document.getElementById('loadingIndicator').style.display = 'none';
}

// Update the clock display
function updateClock() {
    const now = new Date();
    const clockDisplay = document.getElementById('clock-display');
    
    // Format: YYYY-MM-DD HH:MM:SS UTC
    const formattedTime = now.toISOString().replace('T', ' ').substr(0, 19) + ' UTC';
    clockDisplay.textContent = formattedTime;
}

// Set specific fixed clock date
function setFixedClock(dateTimeString) {
    const clockDisplay = document.getElementById('clock-display');
    clockDisplay.textContent = dateTimeString + ' UTC';
}

// Update bot status display
function updateBotStatus(status, message) {
    const botStatus = document.getElementById('bot-status');
    const activityStatus = document.getElementById('activity-status');
    const botActivity = document.getElementById('bot-activity');
    
    // Update the status indicator
    botStatus.className = 'status-indicator';
    switch (status) {
        case 'idle':
            botStatus.classList.add('idle');
            botStatus.textContent = '⏸️ BOT IDLE';
            break;
        case 'active':
            botStatus.classList.add('active');
            botStatus.textContent = '✅ BOT ACTIVE';
            break;
        case 'trading':
            botStatus.classList.add('live');
            botStatus.textContent = state.futuresTrading.enabled ? '🔴 FUTURES TRADING' : '🟢 PAPER TRADING';
            break;
        default:
            botStatus.classList.add('idle');
            botStatus.textContent = '⏸️ BOT IDLE';
    }
    
    // Update activity message
    activityStatus.textContent = message || 'Waiting for update';
    
    // Update the activity indicator appearance
    botActivity.className = 'bot-activity';
    if (status === 'active') {
        botActivity.classList.add('scanning');
    } else if (status === 'trading') {
        botActivity.classList.add('trading');
    } else {
        botActivity.classList.add('waiting');
    }
    
    // Update last tick information
    const lastTickInfo = document.getElementById('last-tick-info');
    if (state.botStats.lastTickTime) {
        const formattedTime = new Date(state.botStats.lastTickTime).toLocaleTimeString();
        lastTickInfo.textContent = `Last check: ${formattedTime} - Execution: ${state.botStats.executionTime}ms`;
    }
    
    // Also update the status indicator
    if (message) {
        showStatusIndicator(message, 
            status === 'trading' ? 'warning' : 
            status === 'active' ? 'info' : 'normal');
    }
}

// Update market data display
function updateMarketData() {
    // Update the market data elements
    document.getElementById('market-price').textContent = `$${state.botStats.marketData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const changeElement = document.getElementById('market-change');
    const change = state.botStats.marketData.change24h;
    changeElement.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    changeElement.className = 'market-value';
    if (change > 0) {
        changeElement.classList.add('up');
    } else if (change < 0) {
        changeElement.classList.add('down');
    }
    
    document.getElementById('market-volume').textContent = `$${formatLargeNumber(state.botStats.marketData.volume)}`;
}

// Update account balance display for futures trading
function updateAccountBalances(balances) {
    document.getElementById('total-wallet-balance').textContent = `$${balances.totalWalletBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('available-balance').textContent = `$${balances.availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('unrealized-pnl').textContent = `$${balances.totalUnrealizedProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    // Update color of unrealized PnL
    const pnlElement = document.getElementById('unrealized-pnl');
    pnlElement.className = 'balance-value';
    if (balances.totalUnrealizedProfit > 0) {
        pnlElement.classList.add('positive');
    } else if (balances.totalUnrealizedProfit < 0) {
        pnlElement.classList.add('negative');
    }
}

// Update fee and funding rate display
function updateFeeDisplay() {
    document.getElementById('maker-fee').textContent = `${(state.futuresTrading.fees.maker * 100).toFixed(3)}%`;
    document.getElementById('taker-fee').textContent = `${(state.futuresTrading.fees.taker * 100).toFixed(3)}%`;
    
    // Update funding rate display
    const fundingRateElement = document.getElementById('funding-rate');
    const fundingRate = state.futuresTrading.fundingInfo.rate;
    
    if (fundingRateElement) {
        fundingRateElement.textContent = `${(fundingRate * 100).toFixed(4)}%`;
        fundingRateElement.className = '';
        
        // Positive funding rate is paid by longs to shorts
        // Negative funding rate is paid by shorts to longs
        if (fundingRate > 0) {
            fundingRateElement.classList.add('negative'); // Negative for longs
        } else if (fundingRate < 0) {
            fundingRateElement.classList.add('positive'); // Positive for longs
        }
    }
    
    // Update next funding time if available
    const nextFundingElement = document.getElementById('next-funding-time');
    if (nextFundingElement && state.futuresTrading.fundingInfo.nextTime) {
        nextFundingElement.textContent = new Date(state.futuresTrading.fundingInfo.nextTime).toLocaleTimeString();
    }
}

// Update leverage display
function updateLeverageDisplay(leverage) {
    document.getElementById('current-leverage').textContent = `${leverage}x`;
}

// Helper function to format large numbers
function formatLargeNumber(num) {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1) + 'B';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    } else {
        return num.toFixed(0);
    }
}

// Update trading statistics
function updateTradingStats() {
    // Check if it's a new day
    const today = new Date().toDateString();
    if (today !== state.botStats.tradingDay) {
        // Reset daily stats
        state.botStats.tradingDay = today;
        state.botStats.dailyTrades = 0;
        state.botStats.dailyPnL = 0;
        state.botStats.dailyStartCapital = state.currentCapital;
        
        // Reset daily stats for futures trading
        if (state.futuresTrading.enabled) {
            state.futuresTrading.dailyStats.orders = 0;
            if (state.futuresTrading.balances.totalWalletBalance) {
                state.futuresTrading.dailyStats.startBalance = state.futuresTrading.balances.totalWalletBalance;
                state.futuresTrading.dailyStats.peakBalance = state.futuresTrading.balances.totalWalletBalance;
            }
        }
    }
    
    // Update stats display
    document.getElementById('stat-daily-trades').textContent = state.botStats.dailyTrades;
    
    const dailyPnlElement = document.getElementById('stat-daily-pnl');
    const dailyPnl = state.botStats.dailyPnL;
    dailyPnlElement.textContent = `${dailyPnl >= 0 ? '+' : ''}$${dailyPnl.toFixed(2)}`;
    dailyPnlElement.className = 'stat-value';
    if (dailyPnl > 0) {
        dailyPnlElement.classList.add('positive');
    } else if (dailyPnl < 0) {
        dailyPnlElement.classList.add('negative');
    }
    
    document.getElementById('stat-execution').textContent = `${state.botStats.executionTime}ms`;
}

// Add HTML elements for Futures trading UI
function addFuturesUI() {
    // Add a status bar container for showing current operations
    const statusBarContainer = document.createElement('div');
    statusBarContainer.className = 'status-bar-container';
    statusBarContainer.innerHTML = `
        <div id="status-bar" class="status-bar" style="display:none;">
            <div id="status-message" class="status-message">Processing...</div>
            <div class="progress-container">
                <div id="status-progress" class="progress-bar" style="width:0%"></div>
            </div>
        </div>
    `;
    
    // Insert after the main header
    const header = document.querySelector('.gradient-header');
    if (header && header.parentNode) {
        header.parentNode.insertBefore(statusBarContainer, header.nextSibling);
    }
    
    // Add to our HTML to support futures trading
    document.getElementById('account-balance-section').innerHTML = `
        <h6>Futures Account Balance</h6>
        <div class="balance-item">
            <span class="balance-label">Wallet Balance:</span>
            <span class="balance-value" id="total-wallet-balance">$0.00</span>
        </div>
        <div class="balance-item">
            <span class="balance-label">Available Balance:</span>
            <span class="balance-value" id="available-balance">$0.00</span>
        </div>
        <div class="balance-item">
            <span class="balance-label">Unrealized P&L:</span>
            <span class="balance-value" id="unrealized-pnl">$0.00</span>
        </div>
    `;
    
    // Update fee information to include funding rate
    document.getElementById('fee-information').innerHTML = `
        <div class="fees-label">Trading Information</div>
        <div class="d-flex justify-content-between">
            <span>Maker Fee:</span>
            <span class="fees-value" id="maker-fee">0.02%</span>
        </div>
        <div class="d-flex justify-content-between">
            <span>Taker Fee:</span>
            <span class="fees-value" id="taker-fee">0.04%</span>
        </div>
        <div class="d-flex justify-content-between">
            <span>Funding Rate:</span>
            <span class="fees-value" id="funding-rate">0.00%</span>
        </div>
        <div class="d-flex justify-content-between">
            <span>Next Funding:</span>
            <span class="fees-value" id="next-funding-time">--:--:--</span>
        </div>
        <div class="d-flex justify-content-between mt-2">
            <span>Leverage:</span>
            <span class="fees-value" id="current-leverage">5x</span>
        </div>
    `;
    
    // Add leverage control to live trading settings
    const liveTradingSettings = document.getElementById('live-trading-settings');
    
    // Add leverage and margin type controls before the existing position size control
    const leverageControl = document.createElement('div');
    leverageControl.className = 'mb-3';
    leverageControl.innerHTML = `
        <label for="leverage-select" class="form-label">Leverage</label>
        <select class="form-select" id="leverage-select">
            <option value="1">1x</option>
            <option value="2">2x</option>
            <option value="3">3x</option>
            <option value="5" selected>5x</option>
            <option value="10">10x</option>
            <option value="20">20x</option>
        </select>
    `;
    
    const marginTypeControl = document.createElement('div');
    marginTypeControl.className = 'mb-3';
    marginTypeControl.innerHTML = `
        <label for="margin-type-select" class="form-label">Margin Type</label>
        <select class="form-select" id="margin-type-select">
            <option value="ISOLATED" selected>Isolated</option>
            <option value="CROSSED">Cross</option>
        </select>
    `;
    
    // Insert before the existing position size control
    liveTradingSettings.insertBefore(leverageControl, liveTradingSettings.firstChild);
    liveTradingSettings.insertBefore(marginTypeControl, liveTradingSettings.firstChild.nextSibling);
    
    // Add trade direction buttons
    const tradingButtons = document.getElementById('live-trading-buttons');
    const tradeDirectionButtons = document.createElement('div');
    tradeDirectionButtons.className = 'mb-3';
    tradeDirectionButtons.innerHTML = `
        <div class="d-flex justify-content-between mb-3">
            <button id="long-position-btn" class="btn btn-success flex-grow-1 me-2" style="display: none;">
                LONG <i class="bi bi-arrow-up-right"></i>
            </button>
            <button id="short-position-btn" class="btn btn-danger flex-grow-1 ms-2" style="display: none;">
                SHORT <i class="bi bi-arrow-down-right"></i>
            </button>
        </div>
        <button id="close-positions-btn" class="btn btn-warning w-100 mb-3" style="display: none;">
            Close All Positions
        </button>
    `;
    
    tradingButtons.insertBefore(tradeDirectionButtons, tradingButtons.firstChild);
    
    // Add event listeners for the new buttons
    document.getElementById('leverage-select').addEventListener('change', async function() {
        const leverage = parseInt(this.value);
        await changeLeverage(leverage);
    });
    
    document.getElementById('margin-type-select').addEventListener('change', async function() {
        const marginType = this.value;
        await changeMarginType(marginType);
    });
    
    document.getElementById('long-position-btn').addEventListener('click', function() {
        showTradeConfirmation('LONG', state.currentPrice);
    });
    
    document.getElementById('short-position-btn').addEventListener('click', function() {
        showTradeConfirmation('SHORT', state.currentPrice);
    });
    
    document.getElementById('close-positions-btn').addEventListener('click', closeAllPositions);
    
    // Add CSS for the status bar
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .status-bar-container {
            width: 100%;
            padding: 0.5rem;
            margin-bottom: 1rem;
            z-index: 1000;
        }
        
        .status-bar {
            background: rgba(0, 0, 0, 0.7);
            border-radius: 8px;
            padding: 0.75rem 1rem;
            margin-bottom: 1rem;
            color: white;
            font-weight: 500;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            position: relative;
        }
        
        .status-bar.status-info {
            background: rgba(59, 130, 246, 0.8);
        }
        
        .status-bar.status-warning {
            background: rgba(245, 158, 11, 0.8);
        }
        
        .status-bar.status-error {
            background: rgba(239, 68, 68, 0.8);
        }
        
        .status-bar.status-success {
            background: rgba(34, 197, 94, 0.8);
        }
        
        .status-message {
            margin-bottom: 0.5rem;
        }
        
        .progress-container {
            height: 4px;
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 2px;
            overflow: hidden;
        }
        
        .progress-bar {
            height: 100%;
            background-color: rgba(255, 255, 255, 0.8);
            transition: width 0.3s ease;
        }
        
        /* Fix overlapping UI elements */
        .card {
            z-index: 1;
            overflow: visible;
        }
        
        .modal {
            z-index: 2000;
        }
        
        #loadingIndicator {
            z-index: 3000;
        }
        
        /* Prevent overflow issues in the position card */
        #position-card .metric-value {
            word-break: break-word;
        }
        
        /* Fix potential overlaps in trading controls */
        #live-trading-buttons button,
        #paper-trading-buttons button {
            margin-bottom: 0.5rem;
        }
    `;
    
    // Add the style element to the document
    document.head.appendChild(styleElement);
}

// Function to change leverage
async function changeLeverage(leverage) {
    if (!state.futuresTrading.enabled || !state.futuresTrading.authenticated) {
        addLogMessage('Cannot change leverage - not in futures mode or not authenticated', true);
        return;
    }
    
    try {
        showStatusIndicator(`Setting leverage to ${leverage}x...`, 'info');
        
        await state.futuresTrading.manager.setLeverage(leverage);
        updateLeverageDisplay(leverage);
        
        hideStatusIndicator();
        addLogMessage(`Leverage changed to ${leverage}x`);
    } catch (error) {
        hideStatusIndicator();
        console.error('Error changing leverage:', error);
        addLogMessage(`Failed to change leverage: ${error.message}`, true);
    }
}

// Function to change margin type
async function changeMarginType(marginType) {
    if (!state.futuresTrading.enabled || !state.futuresTrading.authenticated) {
        addLogMessage('Cannot change margin type - not in futures mode or not authenticated', true);
        return;
    }
    
    try {
        showStatusIndicator(`Setting margin type to ${marginType}...`, 'info');
        
        await state.futuresTrading.manager.setMarginType(marginType);
        
        hideStatusIndicator();
        addLogMessage(`Margin type changed to ${marginType}`);
    } catch (error) {
        hideStatusIndicator();
        console.error('Error changing margin type:', error);
        addLogMessage(`Failed to change margin type: ${error.message}`, true);
    }
}

// Function to close all positions
async function closeAllPositions() {
    if (!state.futuresTrading.enabled || !state.futuresTrading.authenticated) {
        addLogMessage('Cannot close positions - not in futures mode or not authenticated', true);
        return;
    }
    
    const confirmClose = confirm('Are you sure you want to close all positions?');
    if (!confirmClose) return;
    
    showLoading();
    showStatusIndicator('Closing all positions...', 'warning');
    updateBotStatus('trading', 'Closing all positions...');
    
    try {
        const result = await state.futuresTrading.manager.closeAllPositions();
        hideLoading();
        hideStatusIndicator();
        
        if (result.success) {
            addLogMessage(`All positions closed: ${result.message}`);
            sendAlert('Positions Closed', result.message, 'success');
            
            // Update UI
            await updateFuturesPositions();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        hideLoading();
        hideStatusIndicator();
        console.error('Error closing positions:', error);
        addLogMessage(`Failed to close positions: ${error.message}`, true);
        sendAlert('Error Closing Positions', error.message, 'error');
    }
    
    updateBotStatus('active', 'Positions closed - monitoring market');
}

// Update the UI to show current futures positions
async function updateFuturesPositions() {
    if (!state.futuresTrading.enabled || !state.futuresTrading.authenticated || !state.futuresTrading.manager) {
        return;
    }
    
    try {
        // Fetch current account information
        const accountInfo = await state.futuresTrading.manager.syncAccount();
        updateAccountBalances(accountInfo);
        
        // Get current unrealized PnL information
        const pnlInfo = await state.futuresTrading.manager.calculateTotalUnrealizedPnL();
        
        // Hide position card if no positions
        const positionCard = document.getElementById('position-card');
        if (pnlInfo.positionDetails.length === 0) {
            positionCard.style.display = 'none';
            return;
        }
        
        // Update position card with position information
        positionCard.style.display = 'block';
        
        // Get the first position (assuming single position for now)
        const position = pnlInfo.positionDetails[0];
        
        document.getElementById('position-type').textContent = position.positionSide;
        document.getElementById('position-type').className = 'metric-value ' + (position.positionSide === 'LONG' ? 'positive' : 'negative');
        
        document.getElementById('position-entry-price').textContent = `$${position.entryPrice.toFixed(2)}`;
        document.getElementById('position-current-price').textContent = `$${position.markPrice.toFixed(2)}`;
        
        const pnlElement = document.getElementById('position-pnl');
        pnlElement.textContent = `${position.unrealizedProfit >= 0 ? '+' : ''}$${position.unrealizedProfit.toFixed(2)} (${position.unrealizedPnLPercentage >= 0 ? '+' : ''}${position.unrealizedPnLPercentage.toFixed(2)}%)`;
        pnlElement.className = 'metric-value ' + (position.unrealizedProfit >= 0 ? 'positive' : 'negative');
        
        // Update size and leverage information
        document.getElementById('position-size-info').textContent = `${Math.abs(position.positionAmt).toFixed(5)} (${position.leverage}x)`;
        
        // Update liquidation price
        document.getElementById('position-entry-time').innerHTML = `Liq. Price: <strong class="negative">$${position.liquidationPrice.toFixed(2)}</strong>`;
        
        // Update TP/SL based on the settings
        if (state.settings.takeProfit.enabled) {
            const takeProfitPrice = position.positionSide === 'LONG' ? 
                position.entryPrice * (1 + state.settings.takeProfit.percentage / 100) : 
                position.entryPrice * (1 - state.settings.takeProfit.percentage / 100);
            
            document.getElementById('position-tp').textContent = `$${takeProfitPrice.toFixed(2)}`;
        } else {
            document.getElementById('position-tp').textContent = 'Not Set';
        }
        
        if (state.settings.stopLoss.enabled) {
            const stopLossPrice = position.positionSide === 'LONG' ? 
                position.entryPrice * (1 - state.settings.stopLoss.percentage / 100) : 
                position.entryPrice * (1 + state.settings.stopLoss.percentage / 100);
            
            document.getElementById('position-sl').textContent = `$${stopLossPrice.toFixed(2)}`;
        } else {
            document.getElementById('position-sl').textContent = 'Not Set';
        }
    } catch (error) {
        console.error('Error updating futures positions:', error);
        addLogMessage(`Error updating position information: ${error.message}`, true);
    }
}

// Initialize UI elements and event listeners
function initUI() {
    // Set fixed clock date from user's specified time
    setFixedClock('2025-06-08 11:28:43');
    
    // Add Futures UI elements
    addFuturesUI();
    
    // Update slider value displays
    document.getElementById('atr-length').addEventListener('input', function() {
        document.getElementById('atr-length-value').textContent = this.value;
    });
    
    document.getElementById('atr-mult').addEventListener('input', function() {
        document.getElementById('atr-mult-value').textContent = this.value;
    });
    
    document.getElementById('position-size').addEventListener('input', function() {
        document.getElementById('position-size-value').textContent = `${this.value}%`;
    });

    document.getElementById('live-position-size').addEventListener('input', function() {
        document.getElementById('live-position-size-value').textContent = `${this.value}%`;
    });
    
    // Trading mode selector buttons
    document.getElementById('paper-trading-btn').addEventListener('click', function() {
        switchTradingMode('paper');
    });

    document.getElementById('live-trading-btn').addEventListener('click', function() {
        switchTradingMode('futures');
    });
    
    // Paper trading buttons
    document.getElementById('start-trading-btn').addEventListener('click', startPaperTrading);
    document.getElementById('stop-trading-btn').addEventListener('click', stopTrading);
    document.getElementById('reset-trading-btn').addEventListener('click', resetTrading);
    
    // Futures trading buttons
    document.getElementById('start-live-trading-btn').addEventListener('click', startFuturesTrading);
    document.getElementById('stop-live-trading-btn').addEventListener('click', stopTrading);
    document.getElementById('emergency-stop-btn').addEventListener('click', emergencyStop);
    document.getElementById('configure-api-btn').addEventListener('click', showApiConfigModal);
    
    // Configure API links
    document.getElementById('configure-api-link').addEventListener('click', showApiConfigModal);
    document.getElementById('configure-api-link-alert').addEventListener('click', showApiConfigModal);
    
    // API Configuration modal
    document.getElementById('testnetToggle').addEventListener('change', function() {
        state.futuresTrading.testnet = this.checked;
    });
    
    document.getElementById('toggleApiSecret').addEventListener('click', toggleApiSecretVisibility);
    document.getElementById('testApiConnectionBtn').addEventListener('click', testApiConnection);
    document.getElementById('fetchBalancesBtn').addEventListener('click', fetchBalances);
    document.getElementById('saveApiConfigBtn').addEventListener('click', saveApiConfig);
    
    // Settings tab listeners
    document.getElementById('settings-tab').addEventListener('click', function() {
        loadSettings();
    });
    
    // Save settings button
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
    
    // Initialize Alerts
    initAlerts();
    
    // Check if mobile device
    checkMobileDevice();
    
    // Update bot status to idle
    updateBotStatus('idle', 'System initializing...');
    
    // Load data
    showLoading();
    showStatusIndicator('Fetching historical data...', 'info');
    fetchHistoricalData(state.symbol, state.timeframe, 100)
        .then(data => {
            hideLoading();
            hideStatusIndicator();
            state.priceData = data;
            
            // Set current price for market data
            if (data.length > 0) {
                const lastCandle = data[data.length - 1];
                state.currentPrice = lastCandle.close;
                state.botStats.marketData.price = lastCandle.close;
                
                // Get 24h change from API
                showStatusIndicator('Fetching market data...', 'info');
                fetch(`${BINANCE_FUTURES_TESTNET_API_URL}/fapi/v1/ticker/24hr?symbol=${state.symbol}`)
                    .then(response => response.json())
                    .then(data => {
                        hideStatusIndicator();
                        state.botStats.marketData.change24h = parseFloat(data.priceChangePercent);
                        state.botStats.marketData.volume = parseFloat(data.quoteVolume);
                        updateMarketData();
                    })
                    .catch(err => {
                        hideStatusIndicator();
                        console.error('Error fetching 24h ticker:', err);
                        // Fallback to a random number for demo
                        state.botStats.marketData.change24h = (Math.random() * 6) - 3;
                        state.botStats.marketData.volume = 1000000000 * Math.random();
                        updateMarketData();
                    });
            }
            
            // Generate signals
            showStatusIndicator('Calculating trading signals...', 'info');
            const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
            state.indicators = strategy.generateSignals(state.priceData);
            
            initCharts();
            updatePriceChart();
            updateEquityChart();
            hideStatusIndicator();
            
            // Update market data display
            updateMarketData();
            
            // Update bot status
            updateBotStatus('idle', 'System ready - waiting to start trading');
            addLogMessage('System initialized and ready for trading');
        })
        .catch(error => {
            hideLoading();
            hideStatusIndicator();
            console.error('Error fetching data:', error);
            addLogMessage('Error initializing system: ' + error.message, true);
            
            // Generate mock data for demo purposes if API fails
            addLogMessage('Unable to fetch data from Binance API. Please check your connection.', true);
            
            // Set sensible defaults
            state.currentPrice = 50000; // Example BTC price
            state.botStats.marketData.price = 50000;
            state.botStats.marketData.change24h = 0;
            state.botStats.marketData.volume = 0;
            updateMarketData();
            
            // Update bot status
            updateBotStatus('idle', 'System ready - waiting to start trading');
        });
}

// Switch between paper and futures trading modes
function switchTradingMode(mode) {
    if (state.isTrading) {
        addLogMessage('Please stop trading before switching modes', true);
        return;
    }
    
    if (mode === 'paper') {
        // Switch to paper trading
        state.futuresTrading.enabled = false;
        
        // Update UI
        document.getElementById('paper-trading-btn').classList.add('active');
        document.getElementById('live-trading-btn').classList.remove('active');
        
        document.getElementById('paper-trading-settings').style.display = 'block';
        document.getElementById('live-trading-settings').style.display = 'none';
        
        document.getElementById('paper-trading-buttons').style.display = 'block';
        document.getElementById('live-trading-buttons').style.display = 'none';
        
        document.getElementById('account-balance-section').style.display = 'none';
        document.getElementById('fee-information').style.display = 'none';
        document.getElementById('api-connection-status').style.display = 'none';
        
        // Hide trade direction buttons
        document.getElementById('long-position-btn').style.display = 'none';
        document.getElementById('short-position-btn').style.display = 'none';
        document.getElementById('close-positions-btn').style.display = 'none';
        
        addLogMessage('Switched to Paper Trading mode');
    } else {
        // Switch to futures trading
        state.futuresTrading.enabled = true;
        
        // Update UI
        document.getElementById('paper-trading-btn').classList.remove('active');
        document.getElementById('live-trading-btn').classList.add('active');
        
        document.getElementById('paper-trading-settings').style.display = 'none';
        document.getElementById('live-trading-settings').style.display = 'block';
        
        document.getElementById('paper-trading-buttons').style.display = 'none';
        document.getElementById('live-trading-buttons').style.display = 'block';
        
        document.getElementById('account-balance-section').style.display = 'block';
        document.getElementById('fee-information').style.display = 'block';
        document.getElementById('api-connection-status').style.display = 'block';
        
        // Update API connection status
        updateApiConnectionStatus();
        
        addLogMessage('Switched to Futures Trading mode - Configure API before trading');
        
        // If API is not configured, show the modal
        if (!state.futuresTrading.apiKey) {
            showApiConfigModal();
        }
    }
}

// Update API connection status display
function updateApiConnectionStatus() {
    const apiStatus = document.getElementById('api-connection-status');
    
    if (state.futuresTrading.authenticated) {
        apiStatus.className = 'api-status connected';
        apiStatus.innerHTML = `API Connected ${state.futuresTrading.testnet ? '<span class="badge bg-warning">Testnet</span>' : ''}`;
    } else if (state.futuresTrading.apiKey) {
        apiStatus.className = 'api-status connecting';
        apiStatus.innerHTML = 'API Key Set - Not Verified';
    } else {
        apiStatus.className = 'api-status disconnected';
        apiStatus.innerHTML = 'API Disconnected - <a href="#" id="configure-api-link">Configure</a>';
        
        // Re-add event listener
        document.getElementById('configure-api-link').addEventListener('click', showApiConfigModal);
    }
}

// Show API Configuration Modal
function showApiConfigModal() {
    // Populate form with existing values
    document.getElementById('apiKeyInput').value = state.futuresTrading.apiKey || '';
    document.getElementById('apiSecretInput').value = state.futuresTrading.apiSecret || '';
    document.getElementById('testnetToggle').checked = state.futuresTrading.testnet;
    
    document.getElementById('maxPositionSize').value = state.futuresTrading.limits.maxPositionSize;
    document.getElementById('maxDailyLoss').value = state.futuresTrading.limits.maxDailyLoss;
    document.getElementById('maxDrawdown').value = state.futuresTrading.limits.maxDrawdown;
    document.getElementById('maxOrderCount').value = state.futuresTrading.limits.maxOrders;
    
    // Update connection badge
    const apiConnectionBadge = document.getElementById('apiConnectionBadge');
    
    if (state.futuresTrading.authenticated) {
        apiConnectionBadge.textContent = state.futuresTrading.testnet ? 'Connected (Testnet)' : 'Connected';
        apiConnectionBadge.className = 'api-badge badge-connected';
    } else if (state.futuresTrading.apiKey) {
        apiConnectionBadge.textContent = 'Not Verified';
        apiConnectionBadge.className = 'api-badge badge-disconnected';
    } else {
        apiConnectionBadge.textContent = 'Disconnected';
        apiConnectionBadge.className = 'api-badge badge-disconnected';
    }
    
    // Update API test status
    document.getElementById('apiTestStatus').innerHTML = '';
    
    // Show modal
    const apiConfigModal = new bootstrap.Modal(document.getElementById('apiConfigModal'));
    apiConfigModal.show();
}

// Toggle API secret visibility
function toggleApiSecretVisibility() {
    const apiSecretInput = document.getElementById('apiSecretInput');
    const toggleBtn = document.getElementById('toggleApiSecret').querySelector('i');
    
    if (apiSecretInput.type === 'password') {
        apiSecretInput.type = 'text';
        toggleBtn.className = 'bi bi-eye-slash';
    } else {
        apiSecretInput.type = 'password';
        toggleBtn.className = 'bi bi-eye';
    }
}

// Test API connection
async function testApiConnection() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const apiSecret = document.getElementById('apiSecretInput').value.trim();
    const useTestnet = document.getElementById('testnetToggle').checked;
    
    if (!apiKey || !apiSecret) {
        document.getElementById('apiTestStatus').innerHTML = 
            `<div class="alert alert-danger">Please enter both API key and secret</div>`;
        return;
    }
    
    document.getElementById('apiTestStatus').innerHTML = 
        `<div class="alert alert-info">Testing connection to Binance Futures API...</div>`;
    
    try {
        // Create a temporary connector
        const connector = new BinanceFuturesConnector(apiKey, apiSecret, useTestnet);
        
        // Test connection
        const result = await connector.testConnectivity();
        
        if (result.success) {
            document.getElementById('apiTestStatus').innerHTML = 
                `<div class="alert alert-success">
                    <strong>Connection successful!</strong><br>
                    Account Details:<br>
                    Total Wallet Balance: $${parseFloat(result.account.totalWalletBalance).toFixed(2)}<br>
                    Unrealized PnL: $${parseFloat(result.account.totalUnrealizedProfit).toFixed(2)}<br>
                    Available Balance: $${parseFloat(result.account.availableBalance).toFixed(2)}<br>
                    Trading enabled: ${result.account.canTrade ? 'Yes' : 'No'}
                </div>`;
            
            // Update connection badge
            const apiConnectionBadge = document.getElementById('apiConnectionBadge');
            apiConnectionBadge.textContent = useTestnet ? 'Connected (Testnet)' : 'Connected';
            apiConnectionBadge.className = 'api-badge badge-connected';
        } else {
            document.getElementById('apiTestStatus').innerHTML = 
                `<div class="alert alert-danger">
                    <strong>Connection failed:</strong><br>
                    ${result.error}
                </div>`;
        }
    } catch (error) {
        document.getElementById('apiTestStatus').innerHTML = 
            `<div class="alert alert-danger">
                <strong>Error testing connection:</strong><br>
                ${error.message}
            </div>`;
    }
}

// Fetch balances from Binance
async function fetchBalances() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const apiSecret = document.getElementById('apiSecretInput').value.trim();
    const useTestnet = document.getElementById('testnetToggle').checked;
    
    if (!apiKey || !apiSecret) {
        document.getElementById('apiTestStatus').innerHTML = 
            `<div class="alert alert-danger">Please enter both API key and secret</div>`;
        return;
    }
    
    document.getElementById('apiTestStatus').innerHTML = 
        `<div class="alert alert-info">Fetching futures account information...</div>`;
    
    try {
        // Create a temporary connector
        const connector = new BinanceFuturesConnector(apiKey, apiSecret, useTestnet);
        
        // Get account info
        const accountInfo = await connector.getAccountInfo();
        
        // Get current positions
        const positions = await connector.getAllPositions();
        const activePositions = positions.filter(p => parseFloat(p.positionAmt) !== 0);
        
        // Format the results
        let positionHtml = '';
        if (activePositions.length > 0) {
            positionHtml = '<h6 class="mt-3">Open Positions:</h6><ul>';
            for (const position of activePositions) {
                const posAmt = parseFloat(position.positionAmt);
                const entryPrice = parseFloat(position.entryPrice);
                const markPrice = parseFloat(position.markPrice);
                const pnl = parseFloat(position.unrealizedProfit);
                const pnlClass = pnl >= 0 ? 'positive' : 'negative';
                
                positionHtml += `
                    <li>
                        <strong>${position.symbol}</strong> - 
                        ${posAmt > 0 ? 'LONG' : 'SHORT'} ${Math.abs(posAmt).toFixed(5)} @ $${entryPrice.toFixed(2)}<br>
                        Mark Price: $${markPrice.toFixed(2)}<br>
                        P&L: <span class="${pnlClass}">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</span>
                    </li>
                `;
            }
            positionHtml += '</ul>';
        }
        
        document.getElementById('apiTestStatus').innerHTML = 
            `<div class="alert alert-success">
                <strong>Account Information:</strong><br>
                Total Wallet Balance: $${parseFloat(accountInfo.totalWalletBalance).toFixed(2)}<br>
                Unrealized PnL: $${parseFloat(accountInfo.totalUnrealizedProfit).toFixed(2)}<br>
                Total Margin Balance: $${parseFloat(accountInfo.totalMarginBalance).toFixed(2)}<br>
                Available Balance: $${parseFloat(accountInfo.availableBalance).toFixed(2)}<br>
                ${positionHtml}
            </div>`;
        
        // Try to get trading fees
        try {
            const feeData = await connector.getTradingFee(state.symbol);
            if (feeData) {
                document.getElementById('apiTestStatus').innerHTML += 
                    `<div class="alert alert-info">
                        <strong>Trading Fees for ${state.symbol}:</strong><br>
                        Maker Fee: ${(parseFloat(feeData[0].makerCommissionRate) * 100).toFixed(4)}%<br>
                        Taker Fee: ${(parseFloat(feeData[0].takerCommissionRate) * 100).toFixed(4)}%
                    </div>`;
            }
        } catch (feeError) {
            console.warn('Could not fetch fee data:', feeError);
        }
    } catch (error) {
        document.getElementById('apiTestStatus').innerHTML = 
            `<div class="alert alert-danger">
                <strong>Error fetching account information:</strong><br>
                ${error.message}
            </div>`;
    }
}

// Save API configuration
function saveApiConfig() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const apiSecret = document.getElementById('apiSecretInput').value.trim();
    const useTestnet = document.getElementById('testnetToggle').checked;
    
    // Save limits
    state.futuresTrading.limits.maxPositionSize = parseFloat(document.getElementById('maxPositionSize').value);
    state.futuresTrading.limits.maxDailyLoss = parseFloat(document.getElementById('maxDailyLoss').value);
    state.futuresTrading.limits.maxDrawdown = parseFloat(document.getElementById('maxDrawdown').value);
    state.futuresTrading.limits.maxOrders = parseInt(document.getElementById('maxOrderCount').value);
    
    // Update state
    state.futuresTrading.apiKey = apiKey;
    state.futuresTrading.apiSecret = apiSecret;
    state.futuresTrading.testnet = useTestnet;
    
    // Reset authentication state
    state.futuresTrading.authenticated = false;
    
    // Close modal
    const apiConfigModal = bootstrap.Modal.getInstance(document.getElementById('apiConfigModal'));
    apiConfigModal.hide();
    
    // Update status display
    updateApiConnectionStatus();
    
    // Save to secure storage (in this case localStorage, but should be more secure in production)
    try {
        const apiConfig = {
            apiKey: state.futuresTrading.apiKey,
            testnet: state.futuresTrading.testnet,
            // We don't store the secret in localStorage for security reasons
            // Use a more secure approach in production
            apiSecretSet: !!state.futuresTrading.apiSecret,
            limits: state.futuresTrading.limits
        };
        
        localStorage.setItem('voltyBotFuturesConfig', JSON.stringify(apiConfig));
        
        addLogMessage('API configuration saved');
    } catch (error) {
        console.error('Error saving API config:', error);
        addLogMessage('Error saving API configuration', true);
    }
    
    // If we have API keys, try to verify them
    if (apiKey && apiSecret) {
        verifyAndInitializeFuturesTrading();
    }
}

// Verify API keys and initialize futures trading
async function verifyAndInitializeFuturesTrading() {
    if (!state.futuresTrading.apiKey || !state.futuresTrading.apiSecret) {
        addLogMessage('API keys not configured', true);
        return false;
    }
    
    addLogMessage('Verifying Futures API connection...');
    showStatusIndicator('Verifying API connection...', 'info');
    
    try {
        // Create binance connector
        const connector = new BinanceFuturesConnector(
            state.futuresTrading.apiKey, 
            state.futuresTrading.apiSecret, 
            state.futuresTrading.testnet
        );
        
        // Test connection
        const result = await connector.testConnectivity();
        
        if (!result.success) {
            hideStatusIndicator();
            addLogMessage(`API connection failed: ${result.error}`, true);
            return false;
        }
        
        // Create trading manager
        showStatusIndicator('Initializing futures trading...', 'info');
        const tradingManager = new FuturesTradingManager(connector, state.symbol);
        
        // Initialize trading manager
        const initResult = await tradingManager.initialize();
        
        hideStatusIndicator();
        
        if (!initResult.success) {
            addLogMessage(`Failed to initialize futures trading: ${initResult.error}`, true);
            return false;
        }
        
        // Update state with account info
        state.futuresTrading.authenticated = true;
        state.futuresTrading.balances = initResult.balances;
        state.futuresTrading.fees = initResult.fees;
        state.futuresTrading.fundingInfo.rate = initResult.fundingRate || 0;
        
        // Store the trading manager in state for later use
        state.futuresTrading.manager = tradingManager;
        
        // Update UI with balance information
        updateAccountBalances(initResult.balances);
        
        // Update fee and funding display
        updateFeeDisplay();
        
        // Update leverage display
        updateLeverageDisplay(tradingManager.state.leverage);
        
        // Update leverage select element
        document.getElementById('leverage-select').value = tradingManager.state.leverage.toString();
        
        // Update margin type select element
        document.getElementById('margin-type-select').value = tradingManager.state.marginType;
        
        // Update API connection status
        updateApiConnectionStatus();
        
        // Show trade direction buttons
        document.getElementById('long-position-btn').style.display = 'block';
        document.getElementById('short-position-btn').style.display = 'block';
        document.getElementById('close-positions-btn').style.display = 'block';
        
        addLogMessage(`API connection verified. Trading ${state.futuresTrading.testnet ? 'on testnet' : 'on mainnet'}`);
        return true;
    } catch (error) {
        hideStatusIndicator();
        console.error('Error verifying API:', error);
        addLogMessage(`API verification error: ${error.message}`, true);
        return false;
    }
}

// Start paper trading
function startPaperTrading() {
    showLoading();
    showStatusIndicator('Starting paper trading...', 'info');
    
    // Update state with form values
    state.symbol = document.getElementById('symbol').value;
    state.timeframe = document.getElementById('timeframe').value;
    state.atrLength = parseInt(document.getElementById('atr-length').value);
    state.atrMultiplier = parseFloat(document.getElementById('atr-mult').value);
    state.initialCapital = parseFloat(document.getElementById('initial-capital').value);
    state.positionSize = parseInt(document.getElementById('position-size').value) / 100;
    
    // Reset if not already trading
    if (!state.isTrading) {
        state.currentCapital = state.initialCapital;
        state.trades = [];
        state.equityCurve = [{ time: new Date(), value: state.initialCapital }];
        state.botStats.dailyStartCapital = state.initialCapital;
        updateEquityChart();
        updateMetrics();
        updateTradeHistory();
    }
    
    // Update bot status
    updateBotStatus('active', 'Fetching initial data...');
    
    // Disable/enable buttons
    document.getElementById('start-trading-btn').disabled = true;
    document.getElementById('stop-trading-btn').disabled = false;
    document.getElementById('reset-trading-btn').disabled = true;
    
    // Disable form inputs
    disableFormInputs(true);
    
    // Fetch initial data and start interval
    fetchHistoricalData(state.symbol, state.timeframe, 100)
        .then(data => {
            hideLoading();
            hideStatusIndicator();
            state.priceData = data;
            
            // Update current price and market data
            if (data.length > 0) {
                const lastCandle = data[data.length - 1];
                state.currentPrice = lastCandle.close;
                state.botStats.marketData.price = lastCandle.close;
                
                // Update market data display
                updateMarketData();
            }
            
            // Generate signals
            const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
            const signals = strategy.generateSignals(state.priceData);
            state.indicators = signals;
            
            // Update chart
            updatePriceChart();
            
            // Set trading state
            state.isTrading = true;
            
            // Update bot status
            updateBotStatus('trading', 'Monitoring market for trading signals...');
            
            // Start polling for new data using the configured frequency
            state.interval = setInterval(pollForNewData, state.settings.chartUpdateFrequency);
            
            const message = `Paper trading started on ${state.symbol} (${state.timeframe}) at ${getCurrentDateTime()}`;
            addLogMessage(message);
            sendAlert('Paper Trading Started', message, 'success');
            
            // Execute strategy immediately after starting
            executeStrategy();
        })
        .catch(error => {
            hideLoading();
            hideStatusIndicator();
            console.error('Error fetching data:', error);
            addLogMessage('Error starting trading: ' + error.message, true);
            
            // Enable buttons
            document.getElementById('start-trading-btn').disabled = false;
            document.getElementById('stop-trading-btn').disabled = true;
            document.getElementById('reset-trading-btn').disabled = false;
            
            // Enable form inputs
            disableFormInputs(false);
        });
}

// Start futures trading
async function startFuturesTrading() {
    // Check if API is configured and verified
    if (!state.futuresTrading.authenticated) {
        // Try to verify and initialize if we have API keys
        if (state.futuresTrading.apiKey && state.futuresTrading.apiSecret) {
            showStatusIndicator('Verifying API connection...', 'info');
            const verified = await verifyAndInitializeFuturesTrading();
            hideStatusIndicator();
            if (!verified) {
                sendAlert('API Error', 'Please configure and verify your API keys before starting futures trading', 'error');
                return;
            }
        } else {
            showApiConfigModal();
            sendAlert('API Not Configured', 'Please configure your API keys before starting futures trading', 'error');
            return;
        }
    }
    
    showLoading();
    showStatusIndicator('Starting futures trading...', 'warning');
    
    // Update state with form values
    state.symbol = document.getElementById('symbol').value;
    state.timeframe = document.getElementById('timeframe').value;
    state.atrLength = parseInt(document.getElementById('atr-length').value);
    state.atrMultiplier = parseFloat(document.getElementById('atr-mult').value);
    state.livePositionSize = parseInt(document.getElementById('live-position-size').value) / 100;
    
    // Update bot status
    updateBotStatus('active', 'Initializing futures trading...');
    
    // Disable/enable buttons
    document.getElementById('start-live-trading-btn').disabled = true;
    document.getElementById('stop-live-trading-btn').disabled = false;
    document.getElementById('configure-api-btn').disabled = true;
    document.getElementById('emergency-stop-btn').disabled = false;
    document.getElementById('long-position-btn').disabled = false;
    document.getElementById('short-position-btn').disabled = false;
    document.getElementById('close-positions-btn').disabled = false;
    
    // Disable form inputs
    disableFormInputs(true);
    
    try {
        // Sync account before starting
        showStatusIndicator('Syncing account data...', 'info');
        await state.futuresTrading.manager.syncAccount();
        
        // Update UI with balance information
        updateAccountBalances(state.futuresTrading.manager.state.balances);
        
        // Fetch initial data and start interval
        showStatusIndicator('Fetching market data...', 'info');
        const data = await fetchHistoricalData(state.symbol, state.timeframe, 100);
        
        hideLoading();
        hideStatusIndicator();
        state.priceData = data;
        
        // Update current price and market data
        if (data.length > 0) {
            const lastCandle = data[data.length - 1];
            state.currentPrice = lastCandle.close;
            state.botStats.marketData.price = lastCandle.close;
            
            // Update market data display
            updateMarketData();
        }
        
        // Generate signals
        showStatusIndicator('Calculating trading signals...', 'info');
        const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
        const signals = strategy.generateSignals(state.priceData);
        state.indicators = signals;
        hideStatusIndicator();
        
        // Update chart
        updatePriceChart();
        
        // Update positions display
        await updateFuturesPositions();
        
        // Set trading state
        state.isTrading = true;
        
        // Update bot status
        updateBotStatus('trading', 'Futures trading active - monitoring market...');
        
        // Start polling for new data using the configured frequency
        state.interval = setInterval(pollForFuturesData, state.settings.chartUpdateFrequency);
        
        const message = `Futures trading started on ${state.symbol} (${state.timeframe}) at ${getCurrentDateTime()}`;
        addLogMessage(message);
        sendAlert('Futures Trading Started', message, 'success');
        
        // Execute strategy immediately after starting
        executeFuturesStrategy();
    } catch (error) {
        hideLoading();
        hideStatusIndicator();
        console.error('Error starting futures trading:', error);
        addLogMessage('Error starting futures trading: ' + error.message, true);
        
        // Enable buttons
        document.getElementById('start-live-trading-btn').disabled = false;
        document.getElementById('stop-live-trading-btn').disabled = true;
        document.getElementById('configure-api-btn').disabled = false;
        document.getElementById('emergency-stop-btn').disabled = false;
        document.getElementById('long-position-btn').disabled = true;
        document.getElementById('short-position-btn').disabled = true;
        document.getElementById('close-positions-btn').disabled = true;
        
        // Enable form inputs
        disableFormInputs(false);
    }
}

// Get current date and time in formatted string
function getCurrentDateTime() {
    return new Date().toLocaleString();
}

// Execute paper trading strategy on current data
function executeStrategy() {
    if (!state.isTrading) return;
    
    const startTime = performance.now();
    
    // Update bot status
    updateBotStatus('active', 'Analyzing market data...');
    
    // Generate signals
    const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
    const signals = strategy.generateSignals(state.priceData);
    state.indicators = signals;
    
    // Check for take profit or stop loss
    if (state.currentPosition) {
        const tpHit = checkTakeProfit();
        const slHit = checkStopLoss();
        
        if (tpHit || slHit) {
            // Position closed by TP/SL, nothing more to do
            const endTime = performance.now();
            state.botStats.executionTime = Math.round(endTime - startTime);
            updateTradingStats();
            return;
        }
    }
    
    // Check for trade signals
    const realtimeSignals = strategy.checkRealtimeSignals(state.priceData, signals);
    
    if (realtimeSignals.longEntry || realtimeSignals.shortEntry) {
        // Update bot status to indicate trading
        updateBotStatus('trading', realtimeSignals.longEntry ? 'Executing LONG signal...' : 'Executing SHORT signal...');
        
        // Process the trade signal
        processTradeSignal(realtimeSignals.longEntry ? 'LONG' : 'SHORT', state.priceData[state.priceData.length - 1]);
    } else {
        // No signal, update bot status
        updateBotStatus('active', 'Monitoring market - No signals detected');
    }
    
    // Record execution time
    const endTime = performance.now();
    state.botStats.executionTime = Math.round(endTime - startTime);
    
    // Update trading stats display
    updateTradingStats();
}

// Execute futures trading strategy
async function executeFuturesStrategy() {
    if (!state.isTrading || !state.futuresTrading.enabled || !state.futuresTrading.authenticated) return;
    
    const startTime = performance.now();
    
    // Update bot status
    updateBotStatus('active', 'Analyzing market data for futures trading...');
    
    try {
        // Generate signals
        const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
        const signals = strategy.generateSignals(state.priceData);
        state.indicators = signals;
        
        // Check for open positions
        const positionsInfo = await state.futuresTrading.manager.getPositions();
        const hasOpenPositions = positionsInfo && positionsInfo.length > 0;
        
        // Check for take profit or stop loss if we have positions
        if (hasOpenPositions) {
            // Get position P&L
            const pnlInfo = await state.futuresTrading.manager.calculateTotalUnrealizedPnL();
            
            // Since TP/SL are handled by the exchange in futures trading,
            // we just display the current position state
            await updateFuturesPositions();
            
            // Check for signals that would close/reverse positions
            const realtimeSignals = strategy.checkRealtimeSignals(state.priceData, signals);
            
            // For position management, we could implement additional logic here
            // such as trailing stops or partial close based on signals
        } else {
            // No open positions, check for new entry signals
            const realtimeSignals = strategy.checkRealtimeSignals(state.priceData, signals);
            
            // If auto trade is enabled and we have a signal
            if (state.settings.autoTrade) {
                if (realtimeSignals.longEntry) {
                    updateBotStatus('trading', 'LONG signal detected - showing confirmation...');
                    
                    // Show trade confirmation modal
                    showTradeConfirmation('LONG', state.currentPrice);
                    
                } else if (realtimeSignals.shortEntry) {
                    updateBotStatus('trading', 'SHORT signal detected - showing confirmation...');
                    
                    // Show trade confirmation modal
                    showTradeConfirmation('SHORT', state.currentPrice);
                }
            }
        }
        
        // Record execution time
        const endTime = performance.now();
        state.botStats.executionTime = Math.round(endTime - startTime);
        
        // Update trading stats display
        updateTradingStats();
    } catch (error) {
        console.error('Error executing futures strategy:', error);
        addLogMessage(`Strategy execution error: ${error.message}`, true);
        
        // Record execution time
        const endTime = performance.now();
        state.botStats.executionTime = Math.round(endTime - startTime);
        updateTradingStats();
    }
}

// Show trade confirmation modal for futures trading
function showTradeConfirmation(tradeType, currentPrice) {
    // Calculate trade parameters
    const balances = state.futuresTrading.manager.state.balances;
    const availableBalance = balances.availableBalance;
    
    // Calculate position size based on settings and leverage
    const leverage = state.futuresTrading.manager.state.leverage;
    const positionValue = availableBalance * state.livePositionSize;
    const notionalValue = positionValue * leverage; // Total position value with leverage
    const quantity = notionalValue / currentPrice;
    
    // Calculate estimated fees
    const estimatedFee = notionalValue * state.futuresTrading.fees.taker;
    
    // Calculate liquidation price (simplified estimate)
    let liquidationPrice;
    if (tradeType === 'LONG') {
        liquidationPrice = currentPrice * (1 - (1 / leverage) + 0.004); // 0.4% maintenance margin (simplified)
    } else {
        liquidationPrice = currentPrice * (1 + (1 / leverage) - 0.004);
    }
    
    // Calculate PNL at target percentages
    const takeProfit = state.settings.takeProfit.percentage;
    const stopLoss = state.settings.stopLoss.percentage;
    
    let takeProfitPrice, stopLossPrice;
    
    if (tradeType === 'LONG') {
        takeProfitPrice = currentPrice * (1 + takeProfit / 100);
        stopLossPrice = currentPrice * (1 - stopLoss / 100);
    } else {
        takeProfitPrice = currentPrice * (1 - takeProfit / 100);
        stopLossPrice = currentPrice * (1 + stopLoss / 100);
    }
    
    // Calculate estimated PNL
    const takeProfitPnl = (positionValue * (takeProfit / 100) * leverage) - estimatedFee;
    const stopLossPnl = (positionValue * (stopLoss / 100) * leverage * -1) - estimatedFee;
    
    // Populate confirmation modal
    document.getElementById('tradeConfirmationModalLabel').textContent = `Confirm ${tradeType} Trade`;
    
    document.getElementById('tradeConfirmationBody').innerHTML = `
        <div class="alert alert-warning">
            <strong>Warning:</strong> This will place a real futures order using your funds.
        </div>
        <div class="mb-2">
            <strong>Symbol:</strong> ${state.symbol}
        </div>
        <div class="mb-2">
            <strong>Direction:</strong> ${tradeType}
        </div>
        <div class="mb-2">
            <strong>Current Price:</strong> $${currentPrice.toFixed(2)}
        </div>
        <div class="mb-2">
            <strong>Available Balance:</strong> $${availableBalance.toFixed(2)}
        </div>
        <div class="mb-2">
            <strong>Leverage:</strong> ${leverage}x
        </div>
        <div class="mb-2">
            <strong>Position Size:</strong> ${(state.livePositionSize * 100).toFixed(0)}% of balance
        </div>
        <div class="mb-2">
            <strong>Margin Used:</strong> $${positionValue.toFixed(2)}
        </div>
        <div class="mb-2">
            <strong>Notional Value:</strong> $${notionalValue.toFixed(2)}
        </div>
        <div class="mb-2">
            <strong>Quantity:</strong> ${quantity.toFixed(5)} ${state.symbol.substring(0, 3)}
        </div>
        <div class="mb-2">
            <strong>Estimated Fee:</strong> $${estimatedFee.toFixed(4)}
        </div>
        <div class="mb-2">
            <strong class="negative">Est. Liquidation Price:</strong> $${liquidationPrice.toFixed(2)}
        </div>
        <div class="mt-3 mb-3 p-2" style="background-color: rgba(0,0,0,0.1); border-radius: 5px;">
            <div class="mb-2">
                <strong>Take Profit (${takeProfit}%):</strong>
            </div>
            <div class="d-flex justify-content-between mb-2">
                <span>Price: $${takeProfitPrice.toFixed(2)}</span>
                <span class="positive">+$${takeProfitPnl.toFixed(2)}</span>
            </div>
            
            <div class="mb-2">
                <strong>Stop Loss (${stopLoss}%):</strong>
            </div>
            <div class="d-flex justify-content-between">
                <span>Price: $${stopLossPrice.toFixed(2)}</span>
                <span class="negative">-$${Math.abs(stopLossPnl).toFixed(2)}</span>
            </div>
        </div>
    `;
    
    // Set up confirm button action
    const confirmButton = document.getElementById('confirmTradeButton');
    confirmButton.onclick = async () => {
        // Hide the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('tradeConfirmationModal'));
        modal.hide();
        
        // Place the order
        await executeFuturesOrder(tradeType);
    };
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('tradeConfirmationModal'));
    modal.show();
}

// Execute a futures order
async function executeFuturesOrder(tradeType) {
    updateBotStatus('trading', 'Executing futures order...');
    addLogMessage(`Placing ${tradeType} futures order...`);
    showStatusIndicator(`Placing ${tradeType} order...`, 'warning');
    
    try {
        // Place the order
        const side = tradeType === 'LONG' ? 'BUY' : 'SELL';
        const result = await state.futuresTrading.manager.placeMarketOrder(side, state.livePositionSize * 100);
        
        if (result.success) {
            addLogMessage(`Order executed successfully. Order ID: ${result.order.orderId}`);
            
            // Update current position info
            await updateFuturesPositions();
            
            // Place stop loss and take profit orders if enabled
            if (state.settings.takeProfit.enabled || state.settings.stopLoss.enabled) {
                showStatusIndicator('Setting stop loss and take profit...', 'info');
                const tpResult = await state.futuresTrading.manager.placeStopLossAndTakeProfitOrders(
                    state.settings.stopLoss.percentage,
                    state.settings.takeProfit.percentage
                );
                
                if (tpResult.success) {
                    addLogMessage(`Stop loss and take profit orders placed successfully`);
                } else {
                    addLogMessage(`Failed to place stop loss and take profit orders: ${tpResult.error}`, true);
                }
            }
            
            hideStatusIndicator();
            
            // Update bot status
            updateBotStatus('trading', 'Order executed - monitoring position...');
            
            // Increment trades counter
            state.botStats.dailyTrades++;
            updateTradingStats();
            
            // Send alert
            sendAlert('Futures Order Executed', `${tradeType} position opened at $${state.currentPrice.toFixed(2)}`, 'success');
        } else {
            throw new Error(`Order failed: ${result.error}`);
        }
    } catch (error) {
        hideStatusIndicator();
        console.error('Error placing futures order:', error);
        addLogMessage(`Order execution failed: ${error.message}`, true);
        sendAlert('Order Failed', `Failed to place ${tradeType} order: ${error.message}`, 'error');
        
        // Update bot status
        updateBotStatus('active', 'Order failed - continuing to monitor market...');
    }
}

// Emergency stop for futures trading
async function emergencyStop() {
    if (!state.futuresTrading.enabled || !state.futuresTrading.authenticated) {
        addLogMessage('Emergency stop not applicable - not in futures trading mode', true);
        return;
    }
    
    const confirmStop = confirm('EMERGENCY STOP: This will cancel all orders and close all positions. Continue?');
    if (!confirmStop) return;
    
    showLoading();
    showStatusIndicator('EMERGENCY STOP - Closing all positions...', 'error');
    updateBotStatus('trading', 'EMERGENCY STOP INITIATED - Cancelling all orders and closing positions...');
    addLogMessage('EMERGENCY STOP INITIATED', true);
    
    try {
        // Execute emergency stop through trading manager
        const result = await state.futuresTrading.manager.emergencyStop();
        
        hideLoading();
        hideStatusIndicator();
        
        if (result.success) {
            addLogMessage(`Emergency stop completed: ${result.message}`);
            sendAlert('Emergency Stop', 'Successfully cancelled all orders and closed positions', 'success');
            
            // Update positions
            await updateFuturesPositions();
            
            // Stop trading
            stopTrading();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        hideLoading();
        hideStatusIndicator();
        console.error('Error during emergency stop:', error);
        addLogMessage(`Emergency stop failed: ${error.message}`, true);
        sendAlert('Emergency Stop Failed', `Error: ${error.message}`, 'error');
    }
}

// Check if take profit has been hit
function checkTakeProfit() {
    if (!state.currentPosition || !state.settings.takeProfit.enabled) return false;
    
    const currentPrice = state.currentPrice;
    const takeProfitPrice = state.botStats.positionDetails.takeProfitPrice;
    
    // Check if price has reached take profit level
    if (state.currentPosition.type === 'LONG' && currentPrice >= takeProfitPrice) {
        const message = `Take Profit triggered at $${currentPrice.toFixed(2)} (Target: $${takeProfitPrice.toFixed(2)})`;
        addLogMessage(message);
        sendAlert('Take Profit Triggered', message, 'success');
        
        closeCurrentPosition('Take Profit');
        return true;
    } else if (state.currentPosition.type === 'SHORT' && currentPrice <= takeProfitPrice) {
        const message = `Take Profit triggered at $${currentPrice.toFixed(2)} (Target: $${takeProfitPrice.toFixed(2)})`;
        addLogMessage(message);
        sendAlert('Take Profit Triggered', message, 'success');
        
        closeCurrentPosition('Take Profit');
        return true;
    }
    
    return false;
}

// Check if stop loss has been hit
function checkStopLoss() {
    if (!state.currentPosition || !state.settings.stopLoss.enabled) return false;
    
    const currentPrice = state.currentPrice;
    const stopLossPrice = state.botStats.positionDetails.stopLossPrice;
    
    // Check if price has reached stop loss level
    if (state.currentPosition.type === 'LONG' && currentPrice <= stopLossPrice) {
        const message = `Stop Loss triggered at $${currentPrice.toFixed(2)} (Level: $${stopLossPrice.toFixed(2)})`;
        addLogMessage(message, true);
        sendAlert('Stop Loss Triggered', message, 'error');
        
        closeCurrentPosition('Stop Loss');
        return true;
    } else if (state.currentPosition.type === 'SHORT' && currentPrice >= stopLossPrice) {
        const message = `Stop Loss triggered at $${currentPrice.toFixed(2)} (Level: $${stopLossPrice.toFixed(2)})`;
        addLogMessage(message, true);
        sendAlert('Stop Loss Triggered', message, 'error');
        
        closeCurrentPosition('Stop Loss');
        return true;
    }
    
    return false;
}

// Poll for new data from Binance API
function pollForNewData() {
    showStatusIndicator('Fetching latest data...', 'info');
    fetchLatestCandle(state.symbol, state.timeframe)
        .then(newCandle => {
            if (!newCandle) {
                hideStatusIndicator();
                return;
            }
            
            // Update bot stats
            state.botStats.lastTickTime = new Date();
            state.botStats.lastTickPrice = newCandle.close;
            
            // Update last tick info
            document.getElementById('last-tick-info').textContent = `Last check: ${new Date().toLocaleTimeString()} - Execution: ${state.botStats.executionTime}ms`;
            
            // Update price data
            const lastCandleTime = state.priceData.length > 0 ? state.priceData[state.priceData.length - 1].datetime : null;
            
            if (!lastCandleTime || newCandle.datetime > lastCandleTime) {
                // Add new candle
                state.priceData.push(newCandle);
                state.currentPrice = newCandle.close;
                
                // Update market data
                state.botStats.marketData.price = newCandle.close;
                updateMarketData();
                
                // If we have too many candles, remove the oldest one
                if (state.priceData.length > 100) {
                    state.priceData.shift();
                }
                
                // Update metrics if we have a position
                if (state.currentPosition) {
                    updatePositionCard();
                }
                
                // Update chart
                updatePriceChart();
                
                // Add log message for new candle
                addLogMessage(`New candle: ${formatDateTime(newCandle.datetime)} - Open: $${newCandle.open.toFixed(2)}, Close: $${newCandle.close.toFixed(2)}`);
            } else {
                // Update last candle
                state.priceData[state.priceData.length - 1] = newCandle;
                state.currentPrice = newCandle.close;
                
                // Update market data
                state.botStats.marketData.price = newCandle.close;
                updateMarketData();
                
                // Update metrics if we have a position
                if (state.currentPosition) {
                    updatePositionCard();
                }
                
                // Update chart
                updatePriceChart();
            }
            
            hideStatusIndicator();
            
            // Execute trading strategy
            executeStrategy();
        })
        .catch(error => {
            hideStatusIndicator();
            console.error('Error polling for new data:', error);
            addLogMessage('Error fetching latest data: ' + error.message, true);
        });
}

// Poll for futures data
async function pollForFuturesData() {
    try {
        showStatusIndicator('Fetching latest data...', 'info');
        
        // Fetch latest candle
        const newCandle = await fetchLatestCandle(state.symbol, state.timeframe);
        if (!newCandle) {
            hideStatusIndicator();
            return;
        }
        
        // Update bot stats
        state.botStats.lastTickTime = new Date();
        state.botStats.lastTickPrice = newCandle.close;
        
        // Update last tick info
        document.getElementById('last-tick-info').textContent = `Last check: ${new Date().toLocaleTimeString()} - Execution: ${state.botStats.executionTime}ms`;
        
        // Update price data
        const lastCandleTime = state.priceData.length > 0 ? state.priceData[state.priceData.length - 1].datetime : null;
        
        if (!lastCandleTime || newCandle.datetime > lastCandleTime) {
            // Add new candle
            state.priceData.push(newCandle);
            state.currentPrice = newCandle.close;
            
            // Update market data
            state.botStats.marketData.price = newCandle.close;
            updateMarketData();
            
            // If we have too many candles, remove the oldest one
            if (state.priceData.length > 100) {
                state.priceData.shift();
            }
            
            // Update chart
            updatePriceChart();
            
            // Add log message for new candle
            addLogMessage(`New candle: ${formatDateTime(newCandle.datetime)} - Open: $${newCandle.open.toFixed(2)}, Close: $${newCandle.close.toFixed(2)}`);
            
            // Periodically sync account (every 5 candles)
            if (state.priceData.length % 5 === 0) {
                showStatusIndicator('Syncing account data...', 'info');
                await state.futuresTrading.manager.syncAccount();
                updateAccountBalances(state.futuresTrading.manager.state.balances);
            }
            
            // Update positions
            await updateFuturesPositions();
        } else {
            // Update last candle
            state.priceData[state.priceData.length - 1] = newCandle;
            state.currentPrice = newCandle.close;
            
            // Update market data
            state.botStats.marketData.price = newCandle.close;
            updateMarketData();
            
            // Update chart
            updatePriceChart();
            
            // Update position if exists
            await updateFuturesPositions();
        }
        
        hideStatusIndicator();
        
        // Execute futures trading strategy
        await executeFuturesStrategy();
    } catch (error) {
        hideStatusIndicator();
        console.error('Error polling for futures data:', error);
        addLogMessage('Error fetching latest data: ' + error.message, true);
    }
}

// Process a paper trade signal
function processTradeSignal(signalType, candle) {
    // Only process if auto trade is enabled or we don't have a position
    if (!state.settings.autoTrade && state.currentPosition) return;
    
    // If we have a position, check if we need to close it
    if (state.currentPosition) {
        // Close position on opposite signal
        if ((state.currentPosition.type === 'LONG' && signalType === 'SHORT') ||
            (state.currentPosition.type === 'SHORT' && signalType === 'LONG')) {
            
// Process a paper trade signal
function processTradeSignal(signalType, candle) {
    // Only process if auto trade is enabled or we don't have a position
    if (!state.settings.autoTrade && state.currentPosition) return;
    
    // If we have a position, check if we need to close it
    if (state.currentPosition) {
        // Close position on opposite signal
        if ((state.currentPosition.type === 'LONG' && signalType === 'SHORT') ||
            (state.currentPosition.type === 'SHORT' && signalType === 'LONG')) {
            
            // Close the position
            const pnl = state.currentPosition.close(candle.datetime, candle.open);
            state.currentCapital += pnl;
            
            // Update daily P&L
            state.botStats.dailyPnL += pnl;
            
            // Add to trades
            state.trades.push(state.currentPosition);
            state.botStats.dailyTrades++;
            
            // Update equity curve
            state.equityCurve.push({ time: candle.datetime, value: state.currentCapital });
            
            // Add log message
            const pnlText = pnl >= 0 ? 
                `+$${pnl.toFixed(2)} (+${(state.currentPosition.pnlPct * 100).toFixed(2)}%)` : 
                `-$${Math.abs(pnl).toFixed(2)} (${(state.currentPosition.pnlPct * 100).toFixed(2)}%)`;
            
            const message = `Closed ${state.currentPosition.type} position at $${candle.open.toFixed(2)} - P&L: ${pnlText}`;
            addLogMessage(message, pnl < 0);
            sendAlert('Position Closed', message, pnl >= 0 ? 'success' : 'error');
            
            // Clear current position
            state.currentPosition = null;
            
            // Update UI
            updateMetrics();
            updateTradeHistory();
            updateEquityChart();
            updatePositionCard();
            updateTradingStats();
        }
    }
    
    // If we don't have a position, open one
    if (!state.currentPosition) {
        const entryPrice = candle.open;
        const tradeSize = state.currentCapital * state.positionSize / entryPrice;
        
        // Create new position
        state.currentPosition = new Trade(candle.datetime, signalType, entryPrice, tradeSize);
        
        // Update position entry time in bot stats
        state.botStats.positionDetails.entryTime = candle.datetime;
        
        // Calculate take profit and stop loss levels
        updatePositionRiskLevels();
        
        // Add log message
        const message = `Opened ${signalType} position at $${entryPrice.toFixed(2)} - Size: ${tradeSize.toFixed(6)}`;
        addLogMessage(message);
        sendAlert('New Position', message, 'info');
        
        // Update UI
        updatePositionCard();
    }
}

// Close the current paper position with a reason
function closeCurrentPosition(reason) {
    if (!state.currentPosition) return;
    
    const exitPrice = state.currentPrice;
    const pnl = state.currentPosition.close(new Date(), exitPrice);
    state.currentCapital += pnl;
    
    // Update daily P&L
    state.botStats.dailyPnL += pnl;
    
    // Add to trades
    state.trades.push(state.currentPosition);
    state.botStats.dailyTrades++;
    
    // Update equity curve
    state.equityCurve.push({ time: new Date(), value: state.currentCapital });
    
    // Add log message
    const pnlText = pnl >= 0 ? 
        `+$${pnl.toFixed(2)} (+${(state.currentPosition.pnlPct * 100).toFixed(2)}%)` : 
        `-$${Math.abs(pnl).toFixed(2)} (${(state.currentPosition.pnlPct * 100).toFixed(2)}%)`;
    
    const message = `Closed ${state.currentPosition.type} position at $${exitPrice.toFixed(2)} - P&L: ${pnlText} - Reason: ${reason}`;
    addLogMessage(message, pnl < 0);
    sendAlert(`Position Closed: ${reason}`, message, pnl >= 0 ? 'success' : 'error');
    
    // Clear current position
    state.currentPosition = null;
    
    // Update UI
    updateMetrics();
    updateTradeHistory();
    updateEquityChart();
    updatePositionCard();
    updateTradingStats();
}

// Stop trading (both paper and futures)
function stopTrading() {
    // Clear interval
    if (state.interval) {
        clearInterval(state.interval);
        state.interval = null;
    }
    
    // Set trading state
    state.isTrading = false;
    
    // Update buttons based on trading mode
    if (state.futuresTrading.enabled) {
        document.getElementById('start-live-trading-btn').disabled = false;
        document.getElementById('stop-live-trading-btn').disabled = true;
        document.getElementById('configure-api-btn').disabled = false;
        document.getElementById('emergency-stop-btn').disabled = false;
        document.getElementById('long-position-btn').disabled = true;
        document.getElementById('short-position-btn').disabled = true;
        document.getElementById('close-positions-btn').disabled = true;
    } else {
        document.getElementById('start-trading-btn').disabled = false;
        document.getElementById('stop-trading-btn').disabled = true;
        document.getElementById('reset-trading-btn').disabled = false;
    }
    
    // Enable form inputs
    disableFormInputs(false);
    
    // Update bot status
    updateBotStatus('idle', 'Trading stopped - System idle');
    
    const mode = state.futuresTrading.enabled ? 'Futures' : 'Paper';
    const message = `${mode} trading stopped`;
    addLogMessage(message);
    sendAlert('Trading Stopped', message, 'info');
}

// Reset paper trading
function resetTrading() {
    if (state.futuresTrading.enabled) {
        addLogMessage('Reset not available in futures trading mode', true);
        return;
    }
    
    showLoading();
    showStatusIndicator('Resetting system...', 'info');
    
    // Reset state
    state.trades = [];
    state.equityCurve = [];
    state.currentPosition = null;
    state.currentCapital = state.initialCapital;
    state.botStats.dailyTrades = 0;
    state.botStats.dailyPnL = 0;
    state.botStats.dailyStartCapital = state.initialCapital;
    state.metrics = {
        totalReturn: 0,
        winRate: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        totalTrades: 0,
        avgTrade: 0,
        maxWin: 0,
        maxLoss: 0
    };
    
    // Update bot status
    updateBotStatus('idle', 'System reset - Fetching initial data...');
    
    // Fetch initial data again
    fetchHistoricalData(state.symbol, state.timeframe, 100)
        .then(data => {
            hideLoading();
            hideStatusIndicator();
            state.priceData = data;
            
            // Update current price and market data
            if (data.length > 0) {
                const lastCandle = data[data.length - 1];
                state.currentPrice = lastCandle.close;
                state.botStats.marketData.price = lastCandle.close;
                
                // Update market data display
                updateMarketData();
            }
            
            // Generate signals
            const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
            state.indicators = strategy.generateSignals(state.priceData);
            
            // Update UI
            updatePriceChart();
            updateEquityChart();
            updateMetrics();
            updateTradeHistory();
            updatePositionCard();
            updateTradingStats();
            
            // Clear log
            document.getElementById('logMessages').innerHTML = '';
            
            // Update bot status
            updateBotStatus('idle', 'System reset complete - Ready to start trading');
            
            addLogMessage('Trading system reset');
        })
        .catch(error => {
            hideLoading();
            hideStatusIndicator();
            console.error('Error fetching data for reset:', error);
            addLogMessage('Error resetting system: ' + error.message, true);
            
            // Update bot status
            updateBotStatus('idle', 'System reset failed - Check connection');
        });
}

// Fetch historical data from Binance API
async function fetchHistoricalData(symbol, interval, limit = 100) {
    try {
        // Use the appropriate API URL based on whether we're using futures testnet
        const baseUrl = state.futuresTrading.enabled ? 
            (state.futuresTrading.testnet ? BINANCE_FUTURES_TESTNET_API_URL : BINANCE_FUTURES_API_URL) : 
            BINANCE_API_URL;
        
        const endpoint = state.futuresTrading.enabled ? '/fapi/v1/klines' : '/api/v3/klines';
        const url = `${baseUrl}${endpoint}`;
        
        const params = new URLSearchParams({
            symbol: symbol,
            interval: interval,
            limit: limit
        });
        
        const response = await fetch(`${url}?${params.toString()}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        // Format the data
        return data.map(d => ({
            datetime: new Date(d[0]),
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5])
        }));
    } catch (error) {
        console.error('Error fetching historical data:', error);
        throw error;
    }
}

// Fetch the latest candle
async function fetchLatestCandle(symbol, interval) {
    try {
        // Use the appropriate API URL based on whether we're using futures testnet
        const baseUrl = state.futuresTrading.enabled ? 
            (state.futuresTrading.testnet ? BINANCE_FUTURES_TESTNET_API_URL : BINANCE_FUTURES_API_URL) : 
            BINANCE_API_URL;
        
        const endpoint = state.futuresTrading.enabled ? '/fapi/v1/klines' : '/api/v3/klines';
        const url = `${baseUrl}${endpoint}`;
        
        const params = new URLSearchParams({
            symbol: symbol,
            interval: interval,
            limit: 1
        });
        
        const response = await fetch(`${url}?${params.toString()}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.length === 0) return null;
        
        // Format the data
        const d = data[0];
        return {
            datetime: new Date(d[0]),
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5])
        };
    } catch (error) {
        console.error('Error fetching latest candle:', error);
        throw error;
    }
}

// Initialize the system when DOM content is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Load settings from localStorage
    loadSettingsFromLocalStorage();
    
    // Request notification permission
    if ('Notification' in window) {
        Notification.requestPermission();
    }
    
    // Initialize UI
    initUI();
    
    // Set fixed clock date from user's specified time
    setFixedClock('2025-06-08 11:35:57');
});
