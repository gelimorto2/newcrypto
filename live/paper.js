// Constants and settings
const BINANCE_API_URL = 'https://api.binance.com/api/v3';
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
    positionSize: 0.1,
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
    }
};

// Notification sound
let notificationSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-interface-click-1126.mp3');

// Data classes
class Trade {
    constructor(entryTime, type, entryPrice, size) {
        this.entryTime = entryTime;
        this.exitTime = null;
        this.type = type; // 'LONG' or 'SHORT'
        this.entryPrice = entryPrice;
        this.exitPrice = null;
        this.size = size;
        this.pnl = 0;
        this.pnlPct = 0;
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

    // New method to check for real-time signals
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

// Backtester - Run strategy on historical data
class Backtester {
    constructor(initialCapital = 10000, positionSize = 0.1) {
        this.initialCapital = initialCapital;
        this.positionSize = positionSize;
    }
    
    runBacktest(data, strategy) {
        if (data.length < 10) return [];
        
        // Generate signals
        const signals = strategy.generateSignals(data);
        
        // Run backtest
        const trades = [];
        let currentPosition = null;
        let currentCapital = this.initialCapital;
        
        // Start from the earliest point where we have signal data
        for (let i = 2; i < data.length; i++) {
            const longEntryIndex = i - 2;
            const shortEntryIndex = i - 2;
            
            // Check if we have a valid signal index
            if (longEntryIndex < 0 || longEntryIndex >= signals.longEntry.length ||
                shortEntryIndex < 0 || shortEntryIndex >= signals.shortEntry.length) {
                continue;
            }
            
            const longEntry = signals.longEntry[longEntryIndex];
            const shortEntry = signals.shortEntry[shortEntryIndex];
            
            // If we have a position, check for exit
            if (currentPosition) {
                if ((currentPosition.type === 'LONG' && shortEntry) ||
                    (currentPosition.type === 'SHORT' && longEntry)) {
                    
                    // Close position
                    const exitPrice = data[i].open;
                    const pnl = currentPosition.close(data[i].datetime, exitPrice);
                    currentCapital += pnl;
                    
                    // Add to trades
                    trades.push(currentPosition);
                    currentPosition = null;
                }
            }
            
            // If we don't have a position, check for entry
            if (!currentPosition && (longEntry || shortEntry)) {
                const entryPrice = data[i].open;
                const tradeSize = currentCapital * this.positionSize / entryPrice;
                const type = longEntry ? 'LONG' : 'SHORT';
                
                currentPosition = new Trade(data[i].datetime, type, entryPrice, tradeSize);
            }
        }
        
        // Close any open position at the end
        if (currentPosition) {
            const lastData = data[data.length - 1];
            currentPosition.close(lastData.datetime, lastData.close);
            trades.push(currentPosition);
        }
        
        return trades;
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
            botStatus.textContent = '🔴 LIVE TRADING';
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

// Initialize UI elements and event listeners
function initUI() {
    // Start the clock
    updateClock();
    setInterval(updateClock, 1000);
    
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
    
    // Start trading button
    document.getElementById('start-trading-btn').addEventListener('click', startTrading);
    
    // Stop trading button
    document.getElementById('stop-trading-btn').addEventListener('click', stopTrading);
    
    // Reset button
    document.getElementById('reset-trading-btn').addEventListener('click', resetTrading);
    
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
    
    // Load sample data
    showLoading();
    fetchHistoricalData('BTCUSDT', '1h', 100)
        .then(data => {
            hideLoading();
            state.priceData = data;
            
            // Set current price for market data
            if (data.length > 0) {
                const lastCandle = data[data.length - 1];
                state.currentPrice = lastCandle.close;
                state.botStats.marketData.price = lastCandle.close;
                
                // Simulate 24h change
                const changePercentage = (Math.random() * 6) - 3; // Random between -3% and +3%
                state.botStats.marketData.change24h = changePercentage;
                
                // Simulate volume
                state.botStats.marketData.volume = lastCandle.volume * lastCandle.close;
            }
            
            // Generate signals
            const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
            state.indicators = strategy.generateSignals(state.priceData);
            
            // Run backtest on historical data
            runHistoricalBacktest();
            
            initCharts();
            updatePriceChart();
            updateEquityChart();
            
            // Update market data display
            updateMarketData();
            
            // Update bot status
            updateBotStatus('idle', 'System ready - waiting to start trading');
            addLogMessage('System initialized and ready for trading');
        })
        .catch(error => {
            hideLoading();
            console.error('Error fetching sample data:', error);
            addLogMessage('Error initializing system: ' + error.message, true);
            
            // Generate mock data for demo purposes
            const mockData = generateMockData(100);
            state.priceData = mockData;
            
            // Set current price for market data
            if (mockData.length > 0) {
                const lastCandle = mockData[mockData.length - 1];
                state.currentPrice = lastCandle.close;
                state.botStats.marketData.price = lastCandle.close;
                
                // Simulate 24h change
                const changePercentage = (Math.random() * 6) - 3; // Random between -3% and +3%
                state.botStats.marketData.change24h = changePercentage;
                
                // Simulate volume
                state.botStats.marketData.volume = 1000000000 * Math.random(); // Random volume
            }
            
            // Generate signals
            const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
            state.indicators = strategy.generateSignals(state.priceData);
            
            // Run backtest on mock data
            runHistoricalBacktest();
            
            initCharts();
            updatePriceChart();
            updateEquityChart();
            
            // Update market data display
            updateMarketData();
            
            // Update bot status
            updateBotStatus('idle', 'System ready with mock data - waiting to start trading');
            addLogMessage('Using mock data for demonstration purposes');
        });
}

// Initialize alerts setup
function initAlerts() {
    // Set up alert toggle handlers
    document.getElementById('discord-alert-toggle').addEventListener('change', function() {
        state.alerts.discord.enabled = this.checked;
        document.getElementById('discord-webhook-input').disabled = !this.checked;
    });
    
    document.getElementById('telegram-alert-toggle').addEventListener('change', function() {
        state.alerts.telegram.enabled = this.checked;
        document.getElementById('telegram-token-input').disabled = !this.checked;
        document.getElementById('telegram-chatid-input').disabled = !this.checked;
    });
    
    document.getElementById('email-alert-toggle').addEventListener('change', function() {
        state.alerts.email.enabled = this.checked;
        document.getElementById('email-address-input').disabled = !this.checked;
    });
    
    document.getElementById('browser-alert-toggle').addEventListener('change', function() {
        state.alerts.browser.enabled = this.checked;
    });
    
    document.getElementById('sound-alert-toggle').addEventListener('change', function() {
        state.alerts.sound.enabled = this.checked;
        document.getElementById('sound-volume-input').disabled = !this.checked;
    });
    
    // Sound volume control
    document.getElementById('sound-volume-input').addEventListener('input', function() {
        state.alerts.sound.volume = parseFloat(this.value);
        notificationSound.volume = parseFloat(this.value);
    });
    
    // Test alert button
    document.getElementById('test-alert-btn').addEventListener('click', function() {
        sendAlert('Test alert', 'This is a test alert message from Volty Trading Bot', 'info');
    });
}

// Check if running on a mobile device
function checkMobileDevice() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        addLogMessage('Running on a mobile device. Some features may be limited.', false);
        document.getElementById('mobile-info').style.display = 'block';
    } else {
        document.getElementById('mobile-info').style.display = 'none';
    }
}

// Load settings into the UI
function loadSettings() {
    // Risk management settings
    document.getElementById('trailing-stop-toggle').checked = state.settings.trailingStop.enabled;
    document.getElementById('trailing-stop-value').value = state.settings.trailingStop.percentage;
    document.getElementById('trailing-stop-value').disabled = !state.settings.trailingStop.enabled;
    
    document.getElementById('take-profit-toggle').checked = state.settings.takeProfit.enabled;
    document.getElementById('take-profit-value').value = state.settings.takeProfit.percentage;
    document.getElementById('take-profit-value').disabled = !state.settings.takeProfit.enabled;
    
    document.getElementById('stop-loss-toggle').checked = state.settings.stopLoss.enabled;
    document.getElementById('stop-loss-value').value = state.settings.stopLoss.percentage;
    document.getElementById('stop-loss-value').disabled = !state.settings.stopLoss.enabled;
    
    document.getElementById('risk-management-toggle').checked = state.settings.riskManagement.enabled;
    document.getElementById('max-drawdown-value').value = state.settings.riskManagement.maxDrawdown;
    document.getElementById('max-daily-loss-value').value = state.settings.riskManagement.maxDailyLoss;
    document.getElementById('max-drawdown-value').disabled = !state.settings.riskManagement.enabled;
    document.getElementById('max-daily-loss-value').disabled = !state.settings.riskManagement.enabled;
    
    // Auto trade setting
    document.getElementById('auto-trade-toggle').checked = state.settings.autoTrade;
    
    // Theme setting
    document.getElementById('theme-select').value = state.settings.theme;
    
    // Chart update frequency
    document.getElementById('chart-update-frequency').value = state.settings.chartUpdateFrequency / 1000;
    
    // Alert settings
    document.getElementById('discord-alert-toggle').checked = state.alerts.discord.enabled;
    document.getElementById('discord-webhook-input').value = state.alerts.discord.webhook;
    document.getElementById('discord-webhook-input').disabled = !state.alerts.discord.enabled;
    
    document.getElementById('telegram-alert-toggle').checked = state.alerts.telegram.enabled;
    document.getElementById('telegram-token-input').value = state.alerts.telegram.botToken;
    document.getElementById('telegram-chatid-input').value = state.alerts.telegram.chatId;
    document.getElementById('telegram-token-input').disabled = !state.alerts.telegram.enabled;
    document.getElementById('telegram-chatid-input').disabled = !state.alerts.telegram.enabled;
    
    document.getElementById('email-alert-toggle').checked = state.alerts.email.enabled;
    document.getElementById('email-address-input').value = state.alerts.email.address;
    document.getElementById('email-address-input').disabled = !state.alerts.email.enabled;
    
    document.getElementById('browser-alert-toggle').checked = state.alerts.browser.enabled;
    
    document.getElementById('sound-alert-toggle').checked = state.alerts.sound.enabled;
    document.getElementById('sound-volume-input').value = state.alerts.sound.volume;
    document.getElementById('sound-volume-input').disabled = !state.alerts.sound.enabled;
}

// Save settings from the UI
function saveSettings() {
    // Risk management settings
    state.settings.trailingStop.enabled = document.getElementById('trailing-stop-toggle').checked;
    state.settings.trailingStop.percentage = parseFloat(document.getElementById('trailing-stop-value').value);
    
    state.settings.takeProfit.enabled = document.getElementById('take-profit-toggle').checked;
    state.settings.takeProfit.percentage = parseFloat(document.getElementById('take-profit-value').value);
    
    state.settings.stopLoss.enabled = document.getElementById('stop-loss-toggle').checked;
    state.settings.stopLoss.percentage = parseFloat(document.getElementById('stop-loss-value').value);
    
    state.settings.riskManagement.enabled = document.getElementById('risk-management-toggle').checked;
    state.settings.riskManagement.maxDrawdown = parseFloat(document.getElementById('max-drawdown-value').value);
    state.settings.riskManagement.maxDailyLoss = parseFloat(document.getElementById('max-daily-loss-value').value);
    
    // Auto trade setting
    state.settings.autoTrade = document.getElementById('auto-trade-toggle').checked;
    
    // Theme setting
    state.settings.theme = document.getElementById('theme-select').value;
    applyTheme(state.settings.theme);
    
    // Chart update frequency
    state.settings.chartUpdateFrequency = parseInt(document.getElementById('chart-update-frequency').value) * 1000;
    
    // Alert settings
    state.alerts.discord.enabled = document.getElementById('discord-alert-toggle').checked;
    state.alerts.discord.webhook = document.getElementById('discord-webhook-input').value;
    
    state.alerts.telegram.enabled = document.getElementById('telegram-alert-toggle').checked;
    state.alerts.telegram.botToken = document.getElementById('telegram-token-input').value;
    state.alerts.telegram.chatId = document.getElementById('telegram-chatid-input').value;
    
    state.alerts.email.enabled = document.getElementById('email-alert-toggle').checked;
    state.alerts.email.address = document.getElementById('email-address-input').value;
    
    state.alerts.browser.enabled = document.getElementById('browser-alert-toggle').checked;
    
    state.alerts.sound.enabled = document.getElementById('sound-alert-toggle').checked;
    state.alerts.sound.volume = parseFloat(document.getElementById('sound-volume-input').value);
    notificationSound.volume = state.alerts.sound.volume;
    
    // If trading is active, update the polling interval
    if (state.interval) {
        clearInterval(state.interval);
        state.interval = setInterval(pollForNewData, state.settings.chartUpdateFrequency);
    }
    
    // Save settings to localStorage
    saveSettingsToLocalStorage();
    
    addLogMessage('Settings saved successfully');
    
    // Test alert
    sendAlert('Settings Saved', 'Your trading bot settings have been updated', 'info');
    
    // Update position take profit and stop loss if we have an active position
    if (state.currentPosition) {
        updatePositionRiskLevels();
    }
}

// Update position take profit and stop loss levels
function updatePositionRiskLevels() {
    if (!state.currentPosition) return;
    
    // Calculate take profit and stop loss prices
    let takeProfitPrice = 0;
    let stopLossPrice = 0;
    
    if (state.currentPosition.type === 'LONG') {
        if (state.settings.takeProfit.enabled) {
            takeProfitPrice = state.currentPosition.entryPrice * (1 + state.settings.takeProfit.percentage / 100);
        }
        if (state.settings.stopLoss.enabled) {
            stopLossPrice = state.currentPosition.entryPrice * (1 - state.settings.stopLoss.percentage / 100);
        }
    } else { // SHORT
        if (state.settings.takeProfit.enabled) {
            takeProfitPrice = state.currentPosition.entryPrice * (1 - state.settings.takeProfit.percentage / 100);
        }
        if (state.settings.stopLoss.enabled) {
            stopLossPrice = state.currentPosition.entryPrice * (1 + state.settings.stopLoss.percentage / 100);
        }
    }
    
    // Update state
    state.botStats.positionDetails.takeProfitPrice = takeProfitPrice;
    state.botStats.positionDetails.stopLossPrice = stopLossPrice;
    
    // Update UI
    if (document.getElementById('position-tp')) {
        document.getElementById('position-tp').textContent = takeProfitPrice > 0 ? `$${takeProfitPrice.toFixed(2)}` : 'None';
    }
    if (document.getElementById('position-sl')) {
        document.getElementById('position-sl').textContent = stopLossPrice > 0 ? `$${stopLossPrice.toFixed(2)}` : 'None';
    }
}

// Apply theme
function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
    } else {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
    }
    
    // Update charts with new theme
    updatePriceChart();
    updateEquityChart();
}

// Save settings to localStorage
function saveSettingsToLocalStorage() {
    try {
        localStorage.setItem('voltyBotSettings', JSON.stringify({
            settings: state.settings,
            alerts: state.alerts
        }));
    } catch (error) {
        console.error('Error saving settings to localStorage:', error);
    }
}

// Load settings from localStorage
function loadSettingsFromLocalStorage() {
    try {
        const savedSettings = localStorage.getItem('voltyBotSettings');
        if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            state.settings = { ...state.settings, ...parsedSettings.settings };
            state.alerts = { ...state.alerts, ...parsedSettings.alerts };
        }
    } catch (error) {
        console.error('Error loading settings from localStorage:', error);
    }
}

// Send alert through configured channels
function sendAlert(title, message, type = 'info') {
    // Log message
    addLogMessage(`ALERT: ${title} - ${message}`, type === 'error');
    
    // Browser notification
    if (state.alerts.browser.enabled) {
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification(title, {
                    body: message,
                    icon: type === 'error' ? 'https://img.icons8.com/color/48/000000/high-priority.png' : 
                           type === 'success' ? 'https://img.icons8.com/color/48/000000/ok.png' : 
                           'https://img.icons8.com/color/48/000000/info.png'
                });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification(title, {
                            body: message,
                            icon: type === 'error' ? 'https://img.icons8.com/color/48/000000/high-priority.png' : 
                                   type === 'success' ? 'https://img.icons8.com/color/48/000000/ok.png' : 
                                   'https://img.icons8.com/color/48/000000/info.png'
                        });
                    }
                });
            }
        }
    }
    
    // Sound alert
    if (state.alerts.sound.enabled) {
        notificationSound.volume = state.alerts.sound.volume;
        notificationSound.play().catch(e => console.error('Error playing notification sound:', e));
    }
    
    // Discord webhook
    if (state.alerts.discord.enabled && state.alerts.discord.webhook) {
        const color = type === 'error' ? 16711680 : type === 'success' ? 65280 : 255;
        
        fetch(state.alerts.discord.webhook, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                embeds: [{
                    title: title,
                    description: message,
                    color: color,
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: 'Volty Trading Bot'
                    }
                }]
            })
        }).catch(error => {
            console.error('Error sending Discord alert:', error);
        });
    }
    
    // Telegram alert
    if (state.alerts.telegram.enabled && state.alerts.telegram.botToken && state.alerts.telegram.chatId) {
        const telegramMessage = `*${title}*\n${message}`;
        const telegramUrl = `https://api.telegram.org/bot${state.alerts.telegram.botToken}/sendMessage?chat_id=${state.alerts.telegram.chatId}&text=${encodeURIComponent(telegramMessage)}&parse_mode=Markdown`;
        
        fetch(telegramUrl).catch(error => {
            console.error('Error sending Telegram alert:', error);
        });
    }
    
    // Email alert (using Email.js service - would require the library and account setup in production)
    if (state.alerts.email.enabled && state.alerts.email.address) {
        console.log(`Email alert would be sent to ${state.alerts.email.address}`);
        // In a real implementation, you would integrate with an email service like Email.js
    }
}

// Run backtest on historical data
function runHistoricalBacktest() {
    // Create backtester
    const backtester = new Backtester(
        state.initialCapital,
        state.positionSize
    );
    
    // Run backtest
    const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
    const historicalTrades = backtester.runBacktest(state.priceData, strategy);
    
    // Store historical trades
    state.backtest.trades = historicalTrades;
    
    // Add log message
    if (historicalTrades.length > 0) {
        addLogMessage(`Backtest found ${historicalTrades.length} historical trades`);
    }
}

// Generate mock data for demo purposes
function generateMockData(count) {
    const data = [];
    let currentPrice = 50000;
    let date = new Date();
    date.setHours(date.getHours() - count);
    
    for (let i = 0; i < count; i++) {
        const change = (Math.random() - 0.5) * 1000;
        const open = currentPrice;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * 200;
        const low = Math.min(open, close) - Math.random() * 200;
        const volume = Math.random() * 100 + 50;
        
        data.push({
            datetime: new Date(date),
            open: open,
            high: high,
            low: low,
            close: close,
            volume: volume
        });
        
        currentPrice = close;
        date = new Date(date.getTime() + 60 * 60 * 1000); // Add 1 hour
    }
    
    return data;
}

// Initialize the price and equity charts using Plotly
function initCharts() {
    // Create empty price chart
    state.charts.price = createEmptyPriceChart();
    
    // Create empty equity chart
    state.charts.equity = createEmptyEquityChart();
}

// Create an empty price chart
function createEmptyPriceChart() {
    const layout = {
        title: 'Price Chart',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: 'white' },
        xaxis: {
            gridcolor: 'rgba(255,255,255,0.1)',
            zerolinecolor: 'rgba(255,255,255,0.3)',
            rangeslider: { visible: false }
        },
        yaxis: {
            gridcolor: 'rgba(255,255,255,0.1)',
            zerolinecolor: 'rgba(255,255,255,0.3)'
        },
        showlegend: true,
        legend: { 
            orientation: 'h',
            y: 1.1,
            bgcolor: 'rgba(0,0,0,0)',
            font: { color: 'white' }
        },
        margin: { t: 50, b: 40, l: 60, r: 40 },
        hovermode: 'closest',
        height: 600
    };
    
    Plotly.newPlot('priceChart', [], layout, { responsive: true });
    return document.getElementById('priceChart');
}

// Create an empty equity chart
function createEmptyEquityChart() {
    const layout = {
        title: 'Equity Curve',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: 'white' },
        xaxis: {
            gridcolor: 'rgba(255,255,255,0.1)',
            zerolinecolor: 'rgba(255,255,255,0.3)'
        },
        yaxis: {
            gridcolor: 'rgba(255,255,255,0.1)',
            zerolinecolor: 'rgba(255,255,255,0.3)'
        },
        showlegend: false,
        margin: { t: 50, b: 40, l: 60, r: 40 },
        hovermode: 'closest',
        height: 400
    };
    
    Plotly.newPlot('equityChart', [], layout, { responsive: true });
    return document.getElementById('equityChart');
}

// Start the trading process
function startTrading() {
    showLoading();
    
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
            
            // Run backtest on historical data
            runHistoricalBacktest();
            
            // Update chart
            updatePriceChart();
            
            // Set trading state
            state.isTrading = true;
            
            // Update bot status
            updateBotStatus('trading', 'Monitoring market for trading signals...');
            
            // Start polling for new data using the configured frequency
            state.interval = setInterval(pollForNewData, state.settings.chartUpdateFrequency);
            
            const message = `Trading started on ${state.symbol} (${state.timeframe}) at ${getCurrentDateTime()}`;
            addLogMessage(message);
            sendAlert('Trading Started', message, 'success');
            
            // Execute strategy immediately after starting
            executeStrategy();
        })
        .catch(error => {
            hideLoading();
            console.error('Error fetching data:', error);
            addLogMessage('Error starting trading: ' + error.message, true);
            
            // Use mock data for demo purposes
            const mockData = generateMockData(100);
            state.priceData = mockData;
            
            // Update current price and market data
            if (mockData.length > 0) {
                const lastCandle = mockData[mockData.length - 1];
                state.currentPrice = lastCandle.close;
                state.botStats.marketData.price = lastCandle.close;
                
                // Update market data display
                updateMarketData();
            }
            
            // Generate signals
            const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
            const signals = strategy.generateSignals(state.priceData);
            state.indicators = signals;
            
            // Run backtest on historical data
            runHistoricalBacktest();
            
            // Update chart
            updatePriceChart();
            
            // Set trading state
            state.isTrading = true;
            
            // Update bot status
            updateBotStatus('trading', 'Monitoring mock market for trading signals...');
            
            // Start polling for new data (using mock data function)
            state.interval = setInterval(pollForMockData, state.settings.chartUpdateFrequency);
            
            const message = `Trading started on ${state.symbol} (${state.timeframe}) with MOCK DATA at ${getCurrentDateTime()}`;
            addLogMessage(message);
            sendAlert('Trading Started (Mock Data)', message, 'info');
            
            // Enable buttons
            document.getElementById('stop-trading-btn').disabled = false;
            
            // Execute strategy immediately after starting
            executeStrategy();
        });
}

// Get current date and time in formatted string
function getCurrentDateTime() {
    return new Date().toLocaleString();
}

// Execute trading strategy on current data
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

// Poll for mock data (for demonstration when API fails)
function pollForMockData() {
    const lastCandle = state.priceData[state.priceData.length - 1];
    const newTime = new Date(lastCandle.datetime.getTime() + 60 * 60 * 1000); // Add 1 hour
    
    // Generate new mock candle
    const change = (Math.random() - 0.5) * 500;
    const open = lastCandle.close;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * 100;
    const low = Math.min(open, close) - Math.random() * 100;
    const volume = Math.random() * 100 + 50;
    
    const newCandle = {
        datetime: newTime,
        open: open,
        high: high,
        low: low,
        close: close,
        volume: volume
    };
    
    // Add new candle to data
    state.priceData.push(newCandle);
    state.currentPrice = newCandle.close;
    
    // Update bot stats
    state.botStats.lastTickTime = new Date();
    state.botStats.lastTickPrice = newCandle.close;
    state.botStats.marketData.price = newCandle.close;
    
    // Update market data display
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
    
    // Execute trading strategy
    executeStrategy();
}

// Stop the trading process
function stopTrading() {
    // Clear interval
    if (state.interval) {
        clearInterval(state.interval);
        state.interval = null;
    }
    
    // Set trading state
    state.isTrading = false;
    
    // Update bot status
    updateBotStatus('idle', 'Trading stopped - System idle');
    
    // Enable/disable buttons
    document.getElementById('start-trading-btn').disabled = false;
    document.getElementById('stop-trading-btn').disabled = true;
    document.getElementById('reset-trading-btn').disabled = false;
    
    // Enable form inputs
    disableFormInputs(false);
    
    const message = 'Trading stopped';
    addLogMessage(message);
    sendAlert('Trading Stopped', message, 'info');
}

// Reset the trading system
function resetTrading() {
    showLoading();
    
    // Reset state
    state.priceData = [];
    state.trades = [];
    state.backtest.trades = [];
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
            
            // Run backtest on historical data
            runHistoricalBacktest();
            
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
            console.error('Error fetching data for reset:', error);
            addLogMessage('Error resetting system: ' + error.message, true);
            
            // Use mock data for demo purposes
            const mockData = generateMockData(100);
            state.priceData = mockData;
            
            // Update current price and market data
            if (mockData.length > 0) {
                const lastCandle = mockData[mockData.length - 1];
                state.currentPrice = lastCandle.close;
                state.botStats.marketData.price = lastCandle.close;
                
                // Update market data display
                updateMarketData();
            }
            
            // Generate signals
            const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
            state.indicators = strategy.generateSignals(state.priceData);
            
            // Run backtest on historical data
            runHistoricalBacktest();
            
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
            updateBotStatus('idle', 'System reset complete with mock data - Ready to start trading');
            
            addLogMessage('Trading system reset with mock data');
        });
}

// Poll for new data
function pollForNewData() {
    fetchLatestCandle(state.symbol, state.timeframe)
        .then(newCandle => {
            if (!newCandle) return;
            
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
            
            // Execute trading strategy
            executeStrategy();
        })
        .catch(error => {
            console.error('Error polling for new data:', error);
            addLogMessage('Error fetching latest data: ' + error.message, true);
            
            // Fall back to mock data update if API fails
            pollForMockData();
        });
}

// Process a trade signal
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

// Close the current position with a reason
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

// Update the price chart
function updatePriceChart() {
    if (!state.charts.price || state.priceData.length === 0) return;
    
    // Format data for Plotly
    const dates = state.priceData.map(d => d.datetime);
    const open = state.priceData.map(d => d.open);
    const high = state.priceData.map(d => d.high);
    const low = state.priceData.map(d => d.low);
    const close = state.priceData.map(d => d.close);
    const volume = state.priceData.map(d => d.volume);
    
    // Candlestick trace
    const candlestickTrace = {
        x: dates,
        open: open,
        high: high,
        low: low,
        close: close,
        type: 'candlestick',
        name: 'Price',
        increasing: { line: { color: OHLC_COLORS.up }, fillcolor: OHLC_COLORS.upFill },
        decreasing: { line: { color: OHLC_COLORS.down }, fillcolor: OHLC_COLORS.downFill }
    };
    
    // Volume trace
    const volumeColors = state.priceData.map((d, i) => 
        d.close >= d.open ? OHLC_COLORS.volume.up : OHLC_COLORS.volume.down
    );
    
    const volumeTrace = {
        x: dates,
        y: volume,
        type: 'bar',
        name: 'Volume',
        yaxis: 'y2',
        marker: {
            color: volumeColors
        },
        opacity: 0.5
    };
    
    // Prepare indicator traces if available
    const traces = [candlestickTrace, volumeTrace];
    
    // Add signal lines if we have them
    if (state.indicators.longSignal && state.indicators.longSignal.length > 0) {
        const validIndices = state.indicators.longSignal
            .map((val, index) => val !== null ? index : -1)
            .filter(index => index !== -1);
            
        if (validIndices.length > 0) {
            const longSignalTrace = {
                x: validIndices.map(i => state.priceData[i].datetime),
                y: validIndices.map(i => state.indicators.longSignal[i]),
                type: 'scatter',
                mode: 'lines',
                name: 'Long Signal',
                line: {
                    color: 'rgba(34, 197, 94, 0.7)',
                    width: 1,
                    dash: 'dash'
                }
            };
            
            traces.push(longSignalTrace);
        }
    }
    
    if (state.indicators.shortSignal && state.indicators.shortSignal.length > 0) {
        const validIndices = state.indicators.shortSignal
            .map((val, index) => val !== null ? index : -1)
            .filter(index => index !== -1);
            
        if (validIndices.length > 0) {
            const shortSignalTrace = {
                x: validIndices.map(i => state.priceData[i].datetime),
                y: validIndices.map(i => state.indicators.shortSignal[i]),
                type: 'scatter',
                mode: 'lines',
                name: 'Short Signal',
                line: {
                    color: 'rgba(239, 68, 68, 0.7)',
                    width: 1,
                    dash: 'dash'
                }
            };
            
            traces.push(shortSignalTrace);
        }
    }
    
    // Add take profit and stop loss lines if there is a position
    if (state.currentPosition) {
        // Take profit line
        if (state.settings.takeProfit.enabled && state.botStats.positionDetails.takeProfitPrice > 0) {
            const tpTrace = {
                x: dates,
                y: Array(dates.length).fill(state.botStats.positionDetails.takeProfitPrice),
                type: 'scatter',
                mode: 'lines',
                name: 'Take Profit',
                line: {
                    color: 'rgba(34, 197, 94, 1)',
                    width: 1,
                    dash: 'dot'
                }
            };
            traces.push(tpTrace);
        }
        
        // Stop loss line
        if (state.settings.stopLoss.enabled && state.botStats.positionDetails.stopLossPrice > 0) {
            const slTrace = {
                x: dates,
                y: Array(dates.length).fill(state.botStats.positionDetails.stopLossPrice),
                type: 'scatter',
                mode: 'lines',
                name: 'Stop Loss',
                line: {
                    color: 'rgba(239, 68, 68, 1)',
                    width: 1,
                    dash: 'dot'
                }
            };
            traces.push(slTrace);
        }
    }
    
    // Add backtest trade markers
    if (state.backtest.trades.length > 0) {
        // Long entries
        const longEntries = state.backtest.trades.filter(trade => trade.type === 'LONG');
        if (longEntries.length > 0) {
            const longEntryTrace = {
                x: longEntries.map(t => t.entryTime),
                y: longEntries.map(t => t.entryPrice),
                type: 'scatter',
                mode: 'markers',
                name: 'Backtest Long Entry',
                marker: {
                    color: 'rgba(34, 197, 94, 0.7)',
                    size: 10,
                    symbol: 'triangle-up',
                    line: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        width: 1
                    }
                }
            };
            traces.push(longEntryTrace);
        }
        
        // Long exits
        const longExits = longEntries.filter(t => t.exitTime !== null);
        if (longExits.length > 0) {
            const longExitTrace = {
                x: longExits.map(t => t.exitTime),
                y: longExits.map(t => t.exitPrice),
                type: 'scatter',
                mode: 'markers',
                name: 'Backtest Long Exit',
                marker: {
                    color: 'rgba(34, 197, 94, 0.7)',
                    size: 10,
                    symbol: 'triangle-down',
                    line: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        width: 1
                    }
                }
            };
            traces.push(longExitTrace);
        }
        
        // Short entries
        const shortEntries = state.backtest.trades.filter(trade => trade.type === 'SHORT');
        if (shortEntries.length > 0) {
            const shortEntryTrace = {
                x: shortEntries.map(t => t.entryTime),
                y: shortEntries.map(t => t.entryPrice),
                type: 'scatter',
                mode: 'markers',
                name: 'Backtest Short Entry',
                marker: {
                    color: 'rgba(239, 68, 68, 0.7)',
                    size: 10,
                    symbol: 'triangle-down',
                    line: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        width: 1
                    }
                }
            };
            traces.push(shortEntryTrace);
        }
        
        // Short exits
        const shortExits = shortEntries.filter(t => t.exitTime !== null);
        if (shortExits.length > 0) {
            const shortExitTrace = {
                x: shortExits.map(t => t.exitTime),
                y: shortExits.map(t => t.exitPrice),
                type: 'scatter',
                mode: 'markers',
                name: 'Backtest Short Exit',
                marker: {
                    color: 'rgba(239, 68, 68, 0.7)',
                    size: 10,
                    symbol: 'triangle-up',
                    line: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        width: 1
                    }
                }
            };
            traces.push(shortExitTrace);
        }
    }
    
    // Add live trade markers
    if (state.trades.length > 0) {
        // Long entries
        const longEntries = state.trades.filter(trade => trade.type === 'LONG');
        if (longEntries.length > 0) {
            const longEntryTrace = {
                x: longEntries.map(t => t.entryTime),
                y: longEntries.map(t => t.entryPrice),
                type: 'scatter',
                mode: 'markers',
                name: 'Live Long Entry',
                marker: {
                    color: 'rgba(34, 197, 94, 1)',
                    size: 12,
                    symbol: 'triangle-up',
                    line: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        width: 2
                    }
                }
            };
            traces.push(longEntryTrace);
        }
        
        // Long exits
        const longExits = longEntries.filter(t => t.exitTime !== null);
        if (longExits.length > 0) {
            const longExitTrace = {
                x: longExits.map(t => t.exitTime),
                y: longExits.map(t => t.exitPrice),
                type: 'scatter',
                mode: 'markers',
                name: 'Live Long Exit',
                marker: {
                    color: 'rgba(34, 197, 94, 1)',
                    size: 12,
                    symbol: 'triangle-down',
                    line: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        width: 2
                    }
                }
            };
            traces.push(longExitTrace);
        }
        
        // Short entries
        const shortEntries = state.trades.filter(trade => trade.type === 'SHORT');
        if (shortEntries.length > 0) {
            const shortEntryTrace = {
                x: shortEntries.map(t => t.entryTime),
                y: shortEntries.map(t => t.entryPrice),
                type: 'scatter',
                mode: 'markers',
                name: 'Live Short Entry',
                marker: {
                    color: 'rgba(239, 68, 68, 1)',
                    size: 12,
                    symbol: 'triangle-down',
                    line: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        width: 2
                    }
                }
            };
            traces.push(shortEntryTrace);
        }
        
        // Short exits
        const shortExits = shortEntries.filter(t => t.exitTime !== null);
        if (shortExits.length > 0) {
            const shortExitTrace = {
                x: shortExits.map(t => t.exitTime),
                y: shortExits.map(t => t.exitPrice),
                type: 'scatter',
                mode: 'markers',
                name: 'Live Short Exit',
                marker: {
                    color: 'rgba(239, 68, 68, 1)',
                    size: 12,
                    symbol: 'triangle-up',
                    line: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        width: 2
                    }
                }
            };
            traces.push(shortExitTrace);
        }
    }
    
    // Add current position marker
    if (state.currentPosition) {
        const positionTrace = {
            x: [state.currentPosition.entryTime],
            y: [state.currentPosition.entryPrice],
            type: 'scatter',
            mode: 'markers',
            name: state.currentPosition.type === 'LONG' ? 'Current Long' : 'Current Short',
            marker: {
                color: state.currentPosition.type === 'LONG' ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)',
                size: 14,
                symbol: 'star',
                line: {
                    color: 'rgba(255, 255, 255, 0.8)',
                    width: 2
                }
            }
        };
        traces.push(positionTrace);
    }
    
    // Set layout with dual y-axis
    const layout = {
        title: `${state.symbol} (${state.timeframe})`,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: 'white' },
        xaxis: {
            gridcolor: 'rgba(255,255,255,0.1)',
            zerolinecolor: 'rgba(255,255,255,0.3)',
            rangeslider: { visible: false }
        },
        yaxis: {
            title: 'Price',
            gridcolor: 'rgba(255,255,255,0.1)',
            zerolinecolor: 'rgba(255,255,255,0.3)',
            side: 'right'
        },
        yaxis2: {
            title: 'Volume',
            overlaying: 'y',
            side: 'left',
            showgrid: false,
            domain: [0, 0.2]
        },
        showlegend: true,
        legend: { 
            orientation: 'h',
            y: 1.1,
            bgcolor: 'rgba(0,0,0,0)',
            font: { color: 'white' }
        },
        margin: { t: 50, b: 40, l: 60, r: 40 },
        hovermode: 'closest',
        height: 600,
        annotations: generateTradeAnnotations()
    };
    
    // Apply light theme if needed
    if (state.settings.theme === 'light') {
        layout.paper_bgcolor = 'rgba(255,255,255,0)';
        layout.plot_bgcolor = 'rgba(255,255,255,0)';
        layout.font.color = '#334155';
        layout.xaxis.gridcolor = 'rgba(0,0,0,0.1)';
        layout.xaxis.zerolinecolor = 'rgba(0,0,0,0.3)';
        layout.yaxis.gridcolor = 'rgba(0,0,0,0.1)';
        layout.yaxis.zerolinecolor = 'rgba(0,0,0,0.3)';
    }
    
    // Update the chart
    Plotly.react('priceChart', traces, layout, { responsive: true });
}

// Generate trade annotations for the chart
function generateTradeAnnotations() {
    const annotations = [];
    
    // Add backtest trade annotations
    if (state.backtest.trades.length > 0) {
        // Filter to only include a reasonable number of annotations to prevent clutter
        const significantTrades = state.backtest.trades
            .filter((trade, index) => 
                // Include trades with significant PnL or every 3rd trade
                Math.abs(trade.pnl) > state.initialCapital * 0.01 || index % 3 === 0
            )
            .slice(0, 10); // Limit to 10 annotations
        
        for (const trade of significantTrades) {
            if (trade.pnl === 0) continue; // Skip trades with no PnL
            
            // Add entry annotation
            annotations.push({
                x: trade.entryTime,
                y: trade.entryPrice,
                xref: 'x',
                yref: 'y',
                text: trade.type === 'LONG' ? '↑' : '↓',
                showarrow: true,
                arrowhead: 2,
                arrowsize: 1,
                arrowcolor: trade.type === 'LONG' ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)',
                ax: 0,
                ay: trade.type === 'LONG' ? -20 : 20,
                font: {
                    color: 'white',
                    size: 12
                }
            });
            
            // Add exit annotation if available
            if (trade.exitTime) {
                const pnlText = trade.pnl >= 0 ? '+' : '';
                annotations.push({
                    x: trade.exitTime,
                    y: trade.exitPrice,
                    xref: 'x',
                    yref: 'y',
                    text: `${pnlText}${(trade.pnlPct * 100).toFixed(1)}%`,
                    showarrow: true,
                    arrowhead: 4,
                    arrowsize: 1,
                    arrowcolor: trade.pnl >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)',
                    ax: 0,
                    ay: trade.pnl >= 0 ? -20 : 20,
                    font: {
                        color: trade.pnl >= 0 ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)',
                        size: 10
                    }
                });
            }
        }
    }
    
    // Add live trade annotations
    if (state.trades.length > 0) {
        for (const trade of state.trades) {
            // Add entry annotation
            annotations.push({
                x: trade.entryTime,
                y: trade.entryPrice,
                xref: 'x',
                yref: 'y',
                text: trade.type === 'LONG' ? '↑' : '↓',
                showarrow: true,
                arrowhead: 7,
                arrowsize: 1.5,
                arrowcolor: trade.type === 'LONG' ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)',
                ax: 0,
                ay: trade.type === 'LONG' ? -30 : 30,
                font: {
                    color: 'white',
                    size: 14
                }
            });
            
            // Add exit annotation if available
            if (trade.exitTime) {
                const pnlText = trade.pnl >= 0 ? '+' : '';
                annotations.push({
                    x: trade.exitTime,
                    y: trade.exitPrice,
                    xref: 'x',
                    yref: 'y',
                    text: `${pnlText}${(trade.pnlPct * 100).toFixed(1)}%`,
                    showarrow: true,
                    arrowhead: 7,
                    arrowsize: 1.5,
                    arrowcolor: trade.pnl >= 0 ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)',
                    ax: 0,
                    ay: trade.pnl >= 0 ? -30 : 30,
                    font: {
                        color: trade.pnl >= 0 ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)',
                        size: 12
                    }
                });
            }
        }
    }
    
    // Add current position annotation if available
    if (state.currentPosition) {
        annotations.push({
            x: state.currentPosition.entryTime,
            y: state.currentPosition.entryPrice,
            xref: 'x',
            yref: 'y',
            text: state.currentPosition.type === 'LONG' ? '▲ LONG' : '▼ SHORT',
            showarrow: true,
            arrowhead: 0,
            arrowsize: 1.5,
            arrowcolor: state.currentPosition.type === 'LONG' ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)',
            ax: 0,
            ay: state.currentPosition.type === 'LONG' ? -40 : 40,
            font: {
                color: 'white',
                size: 14,
                weight: 'bold'
            }
        });
    }
    
    return annotations;
}

// Update the equity curve chart
function updateEquityChart() {
    if (state.equityCurve.length === 0) {
        const layout = {
            title: 'Equity Curve',
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: 'white' },
            xaxis: {
                gridcolor: 'rgba(255,255,255,0.1)',
                zerolinecolor: 'rgba(255,255,255,0.3)'
            },
            yaxis: {
                gridcolor: 'rgba(255,255,255,0.1)',
                zerolinecolor: 'rgba(255,255,255,0.3)'
            },
            showlegend: false,
            margin: { t: 50, b: 40, l: 60, r: 40 },
            hovermode: 'closest',
            height: 400
        };
        
        // Apply light theme if needed
        if (state.settings.theme === 'light') {
            layout.paper_bgcolor = 'rgba(255,255,255,0)';
            layout.plot_bgcolor = 'rgba(255,255,255,0)';
            layout.font.color = '#334155';
            layout.xaxis.gridcolor = 'rgba(0,0,0,0.1)';
            layout.xaxis.zerolinecolor = 'rgba(0,0,0,0.3)';
            layout.yaxis.gridcolor = 'rgba(0,0,0,0.1)';
            layout.yaxis.zerolinecolor = 'rgba(0,0,0,0.3)';
        }
        
        Plotly.react('equityChart', [], layout, { responsive: true });
        return;
    }
    
    // Format equity data
    const trace = {
        x: state.equityCurve.map(point => point.time),
        y: state.equityCurve.map(point => point.value),
        type: 'scatter',
        mode: 'lines',
        name: 'Equity',
        line: {
            color: 'rgba(34, 197, 94, 1)',
            width: 2
        },
        fill: 'tozeroy',
        fillcolor: 'rgba(34, 197, 94, 0.1)'
    };
    
    const layout = {
        title: 'Equity Curve',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: 'white' },
        xaxis: {
            gridcolor: 'rgba(255,255,255,0.1)',
            zerolinecolor: 'rgba(255,255,255,0.3)'
        },
        yaxis: {
            gridcolor: 'rgba(255,255,255,0.1)',
            zerolinecolor: 'rgba(255,255,255,0.3)'
        },
        showlegend: false,
        margin: { t: 50, b: 40, l: 60, r: 40 },
        hovermode: 'closest',
        height: 400
    };
    
    // Apply light theme if needed
    if (state.settings.theme === 'light') {
        layout.paper_bgcolor = 'rgba(255,255,255,0)';
        layout.plot_bgcolor = 'rgba(255,255,255,0)';
        layout.font.color = '#334155';
        layout.xaxis.gridcolor = 'rgba(0,0,0,0.1)';
        layout.xaxis.zerolinecolor = 'rgba(0,0,0,0.3)';
        layout.yaxis.gridcolor = 'rgba(0,0,0,0.1)';
        layout.yaxis.zerolinecolor = 'rgba(0,0,0,0.3)';
    }
    
    Plotly.react('equityChart', [trace], layout, { responsive: true });
}

// Update the metrics display
function updateMetrics() {
    if (state.trades.length === 0) {
        // Reset metrics
        document.getElementById('total-return').textContent = '0.00%';
        document.getElementById('total-return-delta').textContent = '$0.00';
        document.getElementById('win-rate').textContent = '0.0%';
        document.getElementById('win-rate-delta').textContent = '0 trades';
        document.getElementById('profit-factor').textContent = '0.00';
        document.getElementById('profit-factor-delta').textContent = 'Avg: $0.00';
        document.getElementById('max-drawdown').textContent = '0.00%';
        document.getElementById('max-drawdown-delta').textContent = 'Sharpe: 0.00';
        document.getElementById('max-win').textContent = '$0.00';
        document.getElementById('max-loss').textContent = '$0.00';
        document.getElementById('final-capital').textContent = `$${state.currentCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('total-trades').textContent = '0';
        return;
    }
    
    // Calculate metrics
    const totalReturn = (state.currentCapital - state.initialCapital) / state.initialCapital;
    
    const winningTrades = state.trades.filter(t => t.pnl > 0);
    const losingTrades = state.trades.filter(t => t.pnl < 0);
    
    const winRate = winningTrades.length / state.trades.length;
    
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    
    const avgTrade = state.trades.reduce((sum, t) => sum + t.pnl, 0) / state.trades.length;
    const maxWin = Math.max(...state.trades.map(t => t.pnl));
    const maxLoss = Math.min(...state.trades.map(t => t.pnl));
    
    // Calculate max drawdown
    let peak = state.equityCurve[0].value;
    let maxDD = 0;
    
    for (const point of state.equityCurve) {
        if (point.value > peak) {
            peak = point.value;
        }
        const dd = (peak - point.value) / peak;
        if (dd > maxDD) {
            maxDD = dd;
        }
    }
    
    // Calculate Sharpe ratio (simplified)
    let sharpeRatio = 0;
    if (state.equityCurve.length > 1) {
        const returns = [];
        for (let i = 1; i < state.equityCurve.length; i++) {
            returns.push((state.equityCurve[i].value - state.equityCurve[i-1].value) / state.equityCurve[i-1].value);
        }
        
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        
        sharpeRatio = stdDev > 0 ? mean / stdDev * Math.sqrt(252) : 0;
    }
    
    // Save metrics to state
    state.metrics = {
        totalReturn,
        winRate,
        profitFactor,
        maxDrawdown: maxDD,
        sharpeRatio,
        totalTrades: state.trades.length,
        avgTrade,
        maxWin,
        maxLoss
    };
    
    // Update UI
    document.getElementById('total-return').textContent = `${(totalReturn * 100).toFixed(2)}%`;
    document.getElementById('total-return-delta').textContent = `$${(totalReturn * state.initialCapital).toFixed(2)}`;
    document.getElementById('win-rate').textContent = `${(winRate * 100).toFixed(1)}%`;
    document.getElementById('win-rate-delta').textContent = `${state.trades.length} trades`;
    document.getElementById('profit-factor').textContent = profitFactor === Infinity ? '∞' : profitFactor.toFixed(2);
    document.getElementById('profit-factor-delta').textContent = `Avg: $${avgTrade.toFixed(2)}`;
    document.getElementById('max-drawdown').textContent = `${(maxDD * 100).toFixed(2)}%`;
    document.getElementById('max-drawdown-delta').textContent = `Sharpe: ${sharpeRatio.toFixed(2)}`;
    document.getElementById('max-win').textContent = `$${maxWin.toFixed(2)}`;
    document.getElementById('max-loss').textContent = `$${maxLoss.toFixed(2)}`;
    document.getElementById('final-capital').textContent = `$${state.currentCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('total-trades').textContent = state.trades.length.toString();
}

// Update the trade history table
function updateTradeHistory() {
    const tradeHistoryElement = document.getElementById('tradeHistory').querySelector('tbody');
    tradeHistoryElement.innerHTML = '';
    
    // Combine historical and live trades
    const allTrades = [
        ...state.backtest.trades.map(trade => ({ ...trade, isBacktest: true })),
        ...state.trades.map(trade => ({ ...trade, isBacktest: false }))
    ].sort((a, b) => a.entryTime - b.entryTime);
    
    if (allTrades.length === 0) return;
    
    // Create rows for each trade
    allTrades.forEach((trade, index) => {
        const row = document.createElement('tr');
        
        // Add trade class
        if (trade.pnl > 0) {
            row.classList.add('trade-long');
        } else if (trade.pnl < 0) {
            row.classList.add('trade-short');
        }
        
        // Add backtest indicator
        const tradeTypeText = trade.isBacktest ? 
            `${trade.type} (Backtest)` : 
            trade.type;
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${formatDateTime(trade.entryTime)}</td>
            <td>${trade.exitTime ? formatDateTime(trade.exitTime) : '-'}</td>
            <td>${tradeTypeText}</td>
            <td>$${trade.entryPrice.toFixed(4)}</td>
            <td>${trade.exitPrice ? '$' + trade.exitPrice.toFixed(4) : '-'}</td>
            <td>${trade.size.toFixed(6)}</td>
            <td class="${trade.pnl >= 0 ? 'positive' : 'negative'}">${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}</td>
            <td class="${trade.pnlPct >= 0 ? 'positive' : 'negative'}">${trade.pnlPct >= 0 ? '+' : ''}${(trade.pnlPct * 100).toFixed(2)}%</td>
        `;
        
        tradeHistoryElement.appendChild(row);
    });
}

// Update the position card
function updatePositionCard() {
    const positionCard = document.getElementById('position-card');
    
    if (!state.currentPosition) {
        positionCard.style.display = 'none';
        return;
    }
    
    positionCard.style.display = 'block';
    
    // Calculate unrealized P&L
    const unrealizedPnl = state.currentPosition.getUnrealizedPnl(state.currentPrice);
    const unrealizedPnlPct = state.currentPosition.getUnrealizedPnlPct(state.currentPrice);
    
    // Update position card elements
    document.getElementById('position-type').textContent = state.currentPosition.type;
    document.getElementById('position-type').className = state.currentPosition.type === 'LONG' ? 'metric-value positive' : 'metric-value negative';
    
    document.getElementById('position-entry-price').textContent = `$${state.currentPosition.entryPrice.toFixed(4)}`;
    document.getElementById('position-current-price').textContent = `$${state.currentPrice.toFixed(4)}`;
    
    const pnlElement = document.getElementById('position-pnl');
    pnlElement.textContent = `${unrealizedPnl >= 0 ? '+' : ''}$${unrealizedPnl.toFixed(2)} (${unrealizedPnlPct >= 0 ? '+' : ''}${(unrealizedPnlPct * 100).toFixed(2)}%)`;
    pnlElement.className = unrealizedPnl >= 0 ? 'metric-value positive' : 'metric-value negative';
    
    // Update additional position details
    document.getElementById('position-entry-time').textContent = formatDateTime(state.currentPosition.entryTime);
    document.getElementById('position-size-info').textContent = state.currentPosition.size.toFixed(8);
    
    // Update TP/SL if set
    if (state.settings.takeProfit.enabled && state.botStats.positionDetails.takeProfitPrice > 0) {
        document.getElementById('position-tp').textContent = `$${state.botStats.positionDetails.takeProfitPrice.toFixed(2)}`;
    } else {
        document.getElementById('position-tp').textContent = 'Not Set';
    }
    
    if (state.settings.stopLoss.enabled && state.botStats.positionDetails.stopLossPrice > 0) {
        document.getElementById('position-sl').textContent = `$${state.botStats.positionDetails.stopLossPrice.toFixed(2)}`;
    } else {
        document.getElementById('position-sl').textContent = 'Not Set';
    }
}

// Add a log message
function addLogMessage(message, isError = false) {
    const logElement = document.getElementById('logMessages');
    const timestamp = new Date().toLocaleTimeString();
    
    const logItem = document.createElement('div');
    logItem.className = isError ? 'negative' : '';
    logItem.innerHTML = `<strong>${timestamp}</strong>: ${message}`;
    
    logElement.prepend(logItem);
}

// Disable or enable form inputs
function disableFormInputs(disabled) {
    document.getElementById('symbol').disabled = disabled;
    document.getElementById('timeframe').disabled = disabled;
    document.getElementById('atr-length').disabled = disabled;
    document.getElementById('atr-mult').disabled = disabled;
    document.getElementById('initial-capital').disabled = disabled;
    document.getElementById('position-size').disabled = disabled;
}

// Format a datetime for display
function formatDateTime(date) {
    return new Date(date).toLocaleString();
}

// Fetch historical data from Binance API
async function fetchHistoricalData(symbol, interval, limit = 100) {
    try {
        // Use the proxy URL to avoid CORS issues
        const url = `${BINANCE_API_URL}/klines`;
        const params = new URLSearchParams({
            symbol: symbol,
            interval: interval,
            limit: limit
        });
        
        const response = await axios.get(`${url}?${params.toString()}`);
        
        // Format the data
        return response.data.map(d => ({
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
        // Use the proxy URL to avoid CORS issues
        const url = `${BINANCE_API_URL}/klines`;
        const params = new URLSearchParams({
            symbol: symbol,
            interval: interval,
            limit: 1
        });
        
        const response = await axios.get(`${url}?${params.toString()}`);
        
        if (response.data.length === 0) return null;
        
        // Format the data
        const d = response.data[0];
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

// Load settings from localStorage when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Load settings from localStorage
    loadSettingsFromLocalStorage();
    
    // Request notification permission
    if ('Notification' in window) {
        Notification.requestPermission();
    }
    
    // Initialize UI
    initUI();
    
    // Update current date and time in the header
    updateClock();
    
    // Show current UTC time
    document.getElementById('clock-display').textContent = new Date().toISOString().replace('T', ' ').substr(0, 19) + ' UTC';
});
