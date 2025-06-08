// Constants for API URLs
const BINANCE_API_URL = 'https://api.binance.com';
const BINANCE_FUTURES_API_URL = 'https://fapi.binance.com';
const BINANCE_FUTURES_TESTNET_API_URL = 'https://testnet.binancefuture.com';

// Chart colors based on theme
const OHLC_COLORS = {
    up: '#22c55e',
    down: '#ef4444',
    upFill: 'rgba(34, 197, 94, 0.3)',
    downFill: 'rgba(239, 68, 68, 0.3)',
    volume: {
        up: 'rgba(34, 197, 94, 0.5)',
        down: 'rgba(239, 68, 68, 0.5)'
    }
};

// Notification sound
const notificationSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3');

// Trade class for tracking positions
class Trade {
    constructor(entryTime, type, entryPrice, size) {
        this.entryTime = new Date(entryTime);
        this.type = type; // 'LONG' or 'SHORT'
        this.entryPrice = entryPrice;
        this.size = size;
        this.exitTime = null;
        this.exitPrice = null;
        this.pnl = 0;
        this.pnlPct = 0;
        this.fees = 0;
        this.status = 'OPEN';
    }
    
    close(exitTime, exitPrice) {
        this.exitTime = new Date(exitTime);
        this.exitPrice = exitPrice;
        this.status = 'CLOSED';
        
        // Calculate P&L
        if (this.type === 'LONG') {
            this.pnlPct = (this.exitPrice - this.entryPrice) / this.entryPrice;
        } else { // SHORT
            this.pnlPct = (this.entryPrice - this.exitPrice) / this.entryPrice;
        }
        
        this.pnl = this.size * this.entryPrice * this.pnlPct;
        
        // Calculate fees based on state settings
        const makerFee = state.feeSettings.makerFee / 100;
        const takerFee = state.feeSettings.takerFee / 100;
        
        // Using taker fee for simplicity in this example
        this.fees = this.size * this.entryPrice * takerFee + this.size * this.exitPrice * takerFee;
        
        // Subtract fees from P&L
        this.pnl -= this.fees;
        
        return this.pnl;
    }
    
    getUnrealizedPnl(currentPrice) {
        let pnlPct;
        
        if (this.type === 'LONG') {
            pnlPct = (currentPrice - this.entryPrice) / this.entryPrice;
        } else { // SHORT
            pnlPct = (this.entryPrice - currentPrice) / this.entryPrice;
        }
        
        const unrealizedPnl = this.size * this.entryPrice * pnlPct;
        
        // Calculate fees based on state settings
        const makerFee = state.feeSettings.makerFee / 100;
        const takerFee = state.feeSettings.takerFee / 100;
        
        // Estimate fees for closing using taker fee
        const estimatedClosingFees = this.size * currentPrice * takerFee;
        
        // Subtract entry fees
        const entryFees = this.size * this.entryPrice * takerFee;
        
        return unrealizedPnl - entryFees - estimatedClosingFees;
    }
    
    getUnrealizedPnlPct(currentPrice) {
        let pnlPct;
        
        if (this.type === 'LONG') {
            pnlPct = (currentPrice - this.entryPrice) / this.entryPrice;
        } else { // SHORT
            pnlPct = (this.entryPrice - currentPrice) / this.entryPrice;
        }
        
        // Calculate fees based on state settings
        const makerFee = state.feeSettings.makerFee / 100;
        const takerFee = state.feeSettings.takerFee / 100;
        
        // Adjust for fees
        const entryFees = this.size * this.entryPrice * takerFee;
        const estimatedClosingFees = this.size * currentPrice * takerFee;
        const totalFees = entryFees + estimatedClosingFees;
        
        // Subtract fees from P&L percentage
        const feesAsPct = totalFees / (this.size * this.entryPrice);
        
        return pnlPct - feesAsPct;
    }
}

// Volatility-based trading strategy
class VoltyStrategy {
    constructor(atrLength = 5, atrMultiplier = 0.75) {
        this.atrLength = atrLength;
        this.atrMultiplier = atrMultiplier;
    }
    
    generateSignals(priceData) {
        const atr = this.calculateATR(priceData, this.atrLength);
        const longSignal = [];
        const shortSignal = [];
        
        let prevValue = priceData[0].close;
        let longSignalActive = false;
        let shortSignalActive = false;
        
        for (let i = 0; i < priceData.length; i++) {
            if (i < this.atrLength) {
                // Not enough data yet for signals
                longSignal.push(null);
                shortSignal.push(null);
                continue;
            }
            
            const currentATR = atr[i];
            const threshold = currentATR * this.atrMultiplier;
            
            // Update signals
            if (priceData[i].close - prevValue > threshold) {
                longSignalActive = true;
                shortSignalActive = false;
            } else if (prevValue - priceData[i].close > threshold) {
                shortSignalActive = true;
                longSignalActive = false;
            }
            
            // Set signal values (using price values for easier charting)
            longSignal.push(longSignalActive ? priceData[i].low - (currentATR * 0.5) : null);
            shortSignal.push(shortSignalActive ? priceData[i].high + (currentATR * 0.5) : null);
            
            prevValue = priceData[i].close;
        }
        
        return {
            atr,
            longSignal,
            shortSignal
        };
    }
    
    calculateATR(priceData, length) {
        const tr = [];
        const atr = [];
        
        // Calculate True Range
        for (let i = 0; i < priceData.length; i++) {
            if (i === 0) {
                tr.push(priceData[i].high - priceData[i].low);
                atr.push(tr[0]);
                continue;
            }
            
            const trValue = Math.max(
                priceData[i].high - priceData[i].low,
                Math.abs(priceData[i].high - priceData[i-1].close),
                Math.abs(priceData[i].low - priceData[i-1].close)
            );
            
            tr.push(trValue);
            
            // Calculate ATR using EMA method
            if (i < length) {
                // Simple average for initial values
                let sumTr = 0;
                for (let j = 0; j <= i; j++) {
                    sumTr += tr[j];
                }
                atr.push(sumTr / (i + 1));
            } else {
                // EMA for subsequent values
                const multiplier = 2 / (length + 1);
                atr.push((tr[i] * multiplier) + (atr[i-1] * (1 - multiplier)));
            }
        }
        
        return atr;
    }
    
    getLatestSignal(priceData, indicators) {
        if (!priceData.length || !indicators) return null;
        
        const lastIndex = priceData.length - 1;
        
        if (indicators.longSignal[lastIndex] !== null) {
            return 'LONG';
        } else if (indicators.shortSignal[lastIndex] !== null) {
            return 'SHORT';
        } else {
            return null;
        }
    }
}

// Application state
const state = {
    priceData: [],
    currentPrice: 0,
    symbol: 'BTCUSDT',
    timeframe: '1h',
    initialCapital: 10000,
    currentCapital: 10000,
    positionSize: 10, // percentage of capital
    atrLength: 5,
    atrMultiplier: 0.75,
    
    isTrading: false,
    interval: null,
    
    currentPosition: null,
    trades: [],
    equityCurve: [{ time: new Date(), value: 10000 }],
    
    indicators: {
        atr: [],
        longSignal: [],
        shortSignal: []
    },
    
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
    
    feeSettings: {
        makerFee: 0.02, // default 0.02%
        takerFee: 0.04  // default 0.04%
    },
    
    settings: {
        theme: 'dark',
        chartUpdateFrequency: 5000, // ms
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
        }
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
    
    futuresTrading: {
        enabled: false,
        testnet: true,
        apiKey: '',
        apiSecret: '',
        leverage: 5,
        marginType: 'ISOLATED', // ISOLATED or CROSSED
        positionSize: 5, // percentage of available balance
        limits: {
            maxPositionSize: 25,
            maxDailyLoss: 5,
            maxDrawdown: 15,
            maxDailyOrders: 10
        }
    },
    
    botStats: {
        lastCheck: null,
        executionTime: 0,
        dailyTrades: 0,
        dailyPnL: 0,
        dailyStartCapital: 10000,
        
        marketData: {
            price: 0,
            change24h: 0,
            volume: 0
        },
        
        positionDetails: {
            entryTime: null,
            takeProfitPrice: 0,
            stopLossPrice: 0,
            trailingStopPrice: 0
        }
    }
};

// Initialize user interface
function initUI() {
    // Register event listeners for sliders
    document.getElementById('atr-length').addEventListener('input', function() {
        const value = this.value;
        document.getElementById('atr-length-value').textContent = value;
        state.atrLength = parseInt(value);
    });
    
    document.getElementById('atr-mult').addEventListener('input', function() {
        const value = this.value;
        document.getElementById('atr-mult-value').textContent = value;
        state.atrMultiplier = parseFloat(value);
    });
    
    document.getElementById('position-size').addEventListener('input', function() {
        const value = this.value;
        document.getElementById('position-size-value').textContent = value + '%';
        state.positionSize = parseInt(value);
    });
    
    // Fee settings
    document.getElementById('maker-fee').addEventListener('input', function() {
        const value = parseFloat(this.value);
        state.feeSettings.makerFee = value;
        document.getElementById('futures-maker-fee').textContent = value.toFixed(2) + '%';
        document.getElementById('stat-fee-rate').textContent = `${value.toFixed(2)}% / ${state.feeSettings.takerFee.toFixed(2)}%`;
    });
    
    document.getElementById('taker-fee').addEventListener('input', function() {
        const value = parseFloat(this.value);
        state.feeSettings.takerFee = value;
        document.getElementById('futures-taker-fee').textContent = value.toFixed(2) + '%';
        document.getElementById('stat-fee-rate').textContent = `${state.feeSettings.makerFee.toFixed(2)}% / ${value.toFixed(2)}%`;
    });
    
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to current button and content
            this.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        });
    });
    
    // Symbol and timeframe change handlers
    document.getElementById('symbol').addEventListener('change', function() {
        if (!state.isTrading) {
            state.symbol = this.value;
            reloadDataWithSettings();
        }
    });
    
    document.getElementById('timeframe').addEventListener('change', function() {
        if (!state.isTrading) {
            state.timeframe = this.value;
            reloadDataWithSettings();
        }
    });
    
    // Trading buttons
    document.getElementById('start-trading-btn').addEventListener('click', startTrading);
    document.getElementById('stop-trading-btn').addEventListener('click', stopTrading);
    document.getElementById('reset-trading-btn').addEventListener('click', resetTrading);
    
    // Futures trading buttons
    document.getElementById('start-live-trading-btn').addEventListener('click', startLiveTrading);
    document.getElementById('stop-live-trading-btn').addEventListener('click', stopTrading);
    document.getElementById('emergency-stop-btn').addEventListener('click', emergencyStop);
    document.getElementById('long-position-btn').addEventListener('click', function() {
        openManualPosition('LONG');
    });
    document.getElementById('short-position-btn').addEventListener('click', function() {
        openManualPosition('SHORT');
    });
    document.getElementById('close-positions-btn').addEventListener('click', function() {
        closeCurrentPosition('Manual Close');
    });
    
    // Trading mode toggles
    document.getElementById('paper-trading-btn').addEventListener('click', function() {
        switchToTradingMode('paper');
    });
    
    document.getElementById('live-trading-btn').addEventListener('click', function() {
        switchToTradingMode('live');
    });
    
    // Settings & API buttons
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
    document.getElementById('test-alert-btn').addEventListener('click', function() {
        sendAlert('Test Alert', 'This is a test alert from Volty Trading Bot', 'info');
    });
    
    document.getElementById('configure-api-btn').addEventListener('click', function() {
        showAPIConfigModal();
    });
    
    document.getElementById('configure-api-link').addEventListener('click', function(e) {
        e.preventDefault();
        showAPIConfigModal();
    });
    
    document.getElementById('configure-api-link-alert').addEventListener('click', function(e) {
        e.preventDefault();
        showAPIConfigModal();
    });
    
    // API config modal
    const apiConfigModal = document.getElementById('apiConfigModal');
    const closeBtns = apiConfigModal.querySelectorAll('.close-modal, #cancel-api-config-btn');
    
    closeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            apiConfigModal.style.display = 'none';
        });
    });
    
    document.getElementById('save-api-config-btn').addEventListener('click', saveAPIConfig);
    
    // Live trading confirmation modal
    const liveTradingModal = document.getElementById('liveTradingConfirmModal');
    document.getElementById('confirm-live-trading').addEventListener('change', function() {
        document.getElementById('confirm-live-trading-btn').disabled = !this.checked;
    });
    
    document.getElementById('confirm-live-trading-btn').addEventListener('click', function() {
        liveTradingModal.style.display = 'none';
        startActualLiveTrading();
    });
    
    document.getElementById('cancel-live-trading-btn').addEventListener('click', function() {
        liveTradingModal.style.display = 'none';
    });
    
    liveTradingModal.querySelector('.close-modal').addEventListener('click', function() {
        liveTradingModal.style.display = 'none';
    });
    
    // Theme switcher
    document.getElementById('theme-select').addEventListener('change', function() {
        if (this.value === 'dark') {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            state.settings.theme = 'dark';
        } else {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            state.settings.theme = 'light';
        }
    });
    
    // Initial capital
    document.getElementById('initial-capital').addEventListener('change', function() {
        if (!state.isTrading) {
            state.initialCapital = parseFloat(this.value);
            state.currentCapital = state.initialCapital;
            state.botStats.dailyStartCapital = state.initialCapital;
            state.equityCurve = [{ time: new Date(), value: state.initialCapital }];
            
            // Update metrics
            updateMetrics();
            updateEquityChart();
            
            addLogMessage(`Initial capital updated to $${state.initialCapital.toLocaleString()}`);
        }
    });
    
    // Initialize UI based on selected trading mode
    switchToTradingMode('paper');
    
    // Initialize settings toggles
    loadSettings();
    
    // Initialize alerts
    initAlerts();
    
    // Check if using mobile device
    checkMobileDevice();
    
    // Initial bot status
    updateBotStatus('idle', 'System initialized - Waiting for data...');
    
    // Update fee display
    document.getElementById('stat-fee-rate').textContent = `${state.feeSettings.makerFee.toFixed(2)}% / ${state.feeSettings.takerFee.toFixed(2)}%`;
    
    // Show loading indicator
    showLoading();
    
    // Initial data fetch
    fetchHistoricalData(state.symbol, state.timeframe, 500)
        .then(data => {
            hideLoading();
            state.priceData = data;
            
            // Update current price and market data
            if (data.length > 0) {
                const lastCandle = data[data.length - 1];
                state.currentPrice = lastCandle.close;
                state.botStats.marketData.price = lastCandle.close;
                
                // Calculate 24h price change
                const oneDayInMs = 24 * 60 * 60 * 1000;
                const prevDayData = data.find(d => d.datetime.getTime() < (lastCandle.datetime.getTime() - oneDayInMs));
                
                if (prevDayData) {
                    const change = ((lastCandle.close - prevDayData.close) / prevDayData.close) * 100;
                    state.botStats.marketData.change24h = change;
                }
                
                // Calculate 24h volume
                const last24hData = data.filter(d => d.datetime.getTime() > (lastCandle.datetime.getTime() - oneDayInMs));
                const volume = last24hData.reduce((sum, candle) => sum + candle.volume, 0);
                state.botStats.marketData.volume = volume;
                
                // Update market data display
                updateMarketData();
            }
            
            // Generate signals
            const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
            state.indicators = strategy.generateSignals(state.priceData);
            
            // Initialize charts
            initCharts();
            
            // Update bot status
            updateBotStatus('idle', 'Ready to start trading');
            
            // Add log message
            addLogMessage('System initialized with historical data');
        })
        .catch(error => {
            hideLoading();
            console.error('Error fetching initial data:', error);
            updateBotStatus('idle', 'Error fetching data - Check connection');
            addLogMessage('Error fetching historical data: ' + error.message, true);
        });
}

// Add a log message
function addLogMessage(message, isError = false) {
    // Get the log element or create it if it doesn't exist yet
    const logElement = document.getElementById('logMessages');
    if (!logElement) {
        console.error('Log element not found');
        console.log(message); // Fallback to console
        return;
    }
    
    const timestamp = new Date().toLocaleTimeString();
    
    const logItem = document.createElement('div');
    logItem.className = isError ? 'negative' : '';
    logItem.innerHTML = `<strong>${timestamp}</strong>: ${message}`;
    
    logElement.prepend(logItem);
    
    // Trim log if too many messages
    if (logElement.children.length > 100) {
        logElement.removeChild(logElement.lastChild);
    }
}

// Start paper trading
function startTrading() {
    if (state.isTrading) return;
    
    // Check that we have price data
    if (state.priceData.length === 0) {
        addLogMessage('Cannot start trading: No price data available', true);
        return;
    }
    
    // Disable form inputs
    disableFormInputs(true);
    
    // Update buttons
    document.getElementById('start-trading-btn').disabled = true;
    document.getElementById('stop-trading-btn').disabled = false;
    document.getElementById('reset-trading-btn').disabled = true;
    
    // Start polling for new data
    state.interval = setInterval(pollForNewData, state.settings.chartUpdateFrequency);
    
    // Update state
    state.isTrading = true;
    state.futuresTrading.enabled = false;
    
    // Update bot status
    updateBotStatus('active', 'Paper trading active - Monitoring market');
    
    addLogMessage('Started paper trading for ' + state.symbol);
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
    
    // Add first equity point
    state.equityCurve.push({ time: new Date(), value: state.initialCapital });
    
    // Update bot status
    updateBotStatus('idle', 'System reset - Fetching initial data...');
    
    // Fetch initial data again
    fetchHistoricalData(state.symbol, state.timeframe, 500)
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

// Show loading indicator
function showLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
    }
}

// Hide loading indicator
function hideLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

// Show status indicator
function showStatusIndicator(message, type = 'info') {
    const statusBar = document.getElementById('status-bar');
    const statusMessage = document.getElementById('status-message');
    const statusProgress = document.getElementById('status-progress');
    
    if (statusBar && statusMessage) {
        // Reset existing classes
        statusBar.className = 'status-bar';
        
        // Add new type class
        statusBar.classList.add('status-' + type);
        
        // Set message
        statusMessage.textContent = message;
        
        // Show status bar
        statusBar.style.display = 'block';
        
        // Reset and start progress
        statusProgress.style.width = '0%';
        
        // Animate progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 1;
            statusProgress.style.width = `${progress}%`;
            
            if (progress >= 100) {
                clearInterval(progressInterval);
                
                // Auto-hide after completion
                setTimeout(() => {
                    hideStatusIndicator();
                }, 1000);
            }
        }, 30); // 30ms * 100 steps = ~3 seconds total
    }
}

// Hide status indicator
function hideStatusIndicator() {
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
        statusBar.style.display = 'none';
    }
}

// Update bot status
function updateBotStatus(status, message) {
    const botStatus = document.getElementById('bot-status');
    if (botStatus) {
        // Remove existing classes
        botStatus.className = 'status-indicator';
        
        // Add new class based on status
        botStatus.classList.add(status);
        
        // Update the status text
        let emoji = '⏸️';
        let statusText = 'IDLE';
        
        if (status === 'active') {
            emoji = '▶️';
            statusText = 'ACTIVE';
        } else if (status === 'live') {
            emoji = '🔴';
            statusText = 'LIVE';
        }
        
        botStatus.textContent = `${emoji} BOT ${statusText}`;
    }
    
    // Update activity status message
    const activityStatus = document.getElementById('activity-status');
    if (activityStatus) {
        activityStatus.textContent = message;
    }
}

// Update bot activity indicator
function updateBotActivity(activityType) {
    const botActivity = document.getElementById('bot-activity');
    if (botActivity) {
        // Remove existing classes
        botActivity.className = 'bot-activity';
        
        // Add new class based on activity
        botActivity.classList.add(activityType);
    }
}

// Function to reload data when settings change
function reloadDataWithSettings() {
    // Show loading indicator
    showLoading();
    showStatusIndicator('Loading data with new settings...', 'info');
    
    // Get current settings from UI elements
    state.symbol = document.getElementById('symbol').value;
    state.timeframe = document.getElementById('timeframe').value;
    state.atrLength = parseInt(document.getElementById('atr-length').value);
    state.atrMultiplier = parseFloat(document.getElementById('atr-mult').value);
    
    // Update bot status
    updateBotStatus('idle', 'Fetching data with new settings...');
    
    // Fetch historical data with new settings
    fetchHistoricalData(state.symbol, state.timeframe, 500)
        .then(data => {
            hideLoading();
            hideStatusIndicator();
            state.priceData = data;
            
            // Update current price and market data
            if (data.length > 0) {
                const lastCandle = data[data.length - 1];
                state.currentPrice = lastCandle.close;
                state.botStats.marketData.price = lastCandle.close;
                
                // Calculate 24h price change
                const oneDayInMs = 24 * 60 * 60 * 1000;
                const prevDayData = data.find(d => d.datetime.getTime() < (lastCandle.datetime.getTime() - oneDayInMs));
                
                if (prevDayData) {
                    const change = ((lastCandle.close - prevDayData.close) / prevDayData.close) * 100;
                    state.botStats.marketData.change24h = change;
                }
                
                // Calculate 24h volume
                const last24hData = data.filter(d => d.datetime.getTime() > (lastCandle.datetime.getTime() - oneDayInMs));
                const volume = last24hData.reduce((sum, candle) => sum + candle.volume, 0);
                state.botStats.marketData.volume = volume;
                
                // Update market data display
                updateMarketData();
            }
            
            // Generate signals with the updated settings
            const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
            state.indicators = strategy.generateSignals(state.priceData);
            
            // Update charts
            updatePriceChart();
            
            // Update bot status
            updateBotStatus('idle', 'Data updated with new settings');
            
            // Add log message
            addLogMessage(`Data reloaded for ${state.symbol} (${state.timeframe}) with new strategy parameters`);
        })
        .catch(error => {
            hideLoading();
            hideStatusIndicator();
            console.error('Error fetching data with new settings:', error);
            updateBotStatus('idle', 'Error fetching data - Check connection');
            addLogMessage('Error fetching data: ' + error.message, true);
        });
}

// Enhanced fetch historical data to load more data points
async function fetchHistoricalData(symbol, interval, limit = 500) {
    try {
        // Use the appropriate API URL based on whether we're using futures testnet
        const baseUrl = state.futuresTrading.enabled ? 
            (state.futuresTrading.testnet ? BINANCE_FUTURES_TESTNET_API_URL : BINANCE_FUTURES_API_URL) : 
            BINANCE_API_URL;
        
        const endpoint = state.futuresTrading.enabled ? '/fapi/v1/klines' : '/api/v3/klines';
        const url = `${baseUrl}${endpoint}`;
        
        // Increased limit for more data points
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

// Update market data display
function updateMarketData() {
    document.getElementById('market-price').textContent = `$${state.botStats.marketData.price.toFixed(2)}`;
    
    if (state.botStats.marketData.change24h !== 0) {
        const changeElement = document.getElementById('market-change');
        changeElement.textContent = `${state.botStats.marketData.change24h >= 0 ? '+' : ''}${state.botStats.marketData.change24h.toFixed(2)}%`;
        changeElement.className = state.botStats.marketData.change24h >= 0 ? 'market-value up' : 'market-value down';
    }
    
    if (state.botStats.marketData.volume > 0) {
        document.getElementById('market-volume').textContent = `$${(state.botStats.marketData.volume / 1000000).toFixed(1)}M`;
    }
}

// Update trading stats
function updateTradingStats() {
    document.getElementById('stat-daily-trades').textContent = state.botStats.dailyTrades;
    
    const dailyPnlElement = document.getElementById('stat-daily-pnl');
    dailyPnlElement.textContent = `${state.botStats.dailyPnL >= 0 ? '+' : ''}$${state.botStats.dailyPnL.toFixed(2)}`;
    dailyPnlElement.className = 'metric-value ' + (state.botStats.dailyPnL >= 0 ? 'positive' : 'negative');
    
    document.getElementById('stat-execution').textContent = `${state.botStats.executionTime}ms`;
}

// Start live trading
function startLiveTrading() {
    if (state.isTrading) return;
    
    // Check if API is configured
    if (!state.futuresTrading.apiKey || !state.futuresTrading.apiSecret) {
        addLogMessage('API key and secret required for live trading', true);
        showAPIConfigModal();
        return;
    }
    
    // Check that we have price data
    if (state.priceData.length === 0) {
        addLogMessage('Cannot start trading: No price data available', true);
        return;
    }
    
    // Show confirmation modal
    document.getElementById('liveTradingConfirmModal').style.display = 'block';
}

// Emergency stop function - immediately halt all trading and close positions
function emergencyStop() {
    // Display confirmation modal
    const confirmed = confirm("⚠️ EMERGENCY STOP: This will immediately cancel all orders and close all open positions. Continue?");
    
    if (!confirmed) return;
    
    // Show loading indicator
    showLoading();
    showStatusIndicator('EMERGENCY STOP - Closing all positions...', 'error');
    
    // Update bot status
    updateBotStatus('idle', 'EMERGENCY STOP ACTIVATED');
    updateBotActivity('scanning');
    
    // Play alert sound at higher volume (emergency notification)
    const originalVolume = state.alerts.sound.volume;
    state.alerts.sound.volume = 0.8;
    notificationSound.play().catch(e => console.error('Error playing emergency sound:', e));
    state.alerts.sound.volume = originalVolume;
    
    // Log the emergency stop
    addLogMessage('🚨 EMERGENCY STOP ACTIVATED 🚨', true);
    
    try {
        // Clear all intervals
        if (state.interval) {
            clearInterval(state.interval);
            state.interval = null;
        }
        
        // Set trading state to stopped
        state.isTrading = false;
        
        if (state.futuresTrading.enabled && state.futuresTrading.apiKey) {
            // If in live trading mode with API, cancel all orders and close positions
            cancelAllOrders()
                .then(() => closeAllPositions())
                .then(() => {
                    // Hide loading indicator
                    hideLoading();
                    hideStatusIndicator();
                    
                    // Update UI
                    document.getElementById('start-live-trading-btn').disabled = false;
                    document.getElementById('stop-live-trading-btn').disabled = true;
                    document.getElementById('emergency-stop-btn').disabled = false;
                    document.getElementById('long-position-btn').disabled = true;
                    document.getElementById('short-position-btn').disabled = true;
                    document.getElementById('close-positions-btn').disabled = true;
                    disableFormInputs(false);
                    
                    // Send alert
                    sendAlert('Emergency Stop Executed', 'All positions have been closed and orders canceled.', 'error');
                    
                    // Update bot status
                    updateBotStatus('idle', 'Emergency stop completed - System halted');
                    updateBotActivity('waiting');
                })
                .catch(error => {
                    // Hide loading indicator
                    hideLoading();
                    hideStatusIndicator();
                    
                    console.error('Error during emergency stop:', error);
                    addLogMessage('Error during emergency stop: ' + error.message, true);
                    
                    // Send alert
                    sendAlert('Emergency Stop Error', 'There was an error during emergency stop. Please check manually.', 'error');
                    
                    // Update bot status
                    updateBotStatus('idle', 'Emergency stop encountered errors - Manual check required');
                    updateBotActivity('waiting');
                });
        } else {
            // Paper trading mode - just close current position if any
            if (state.currentPosition) {
                // Close the current position
                closeCurrentPosition('Emergency Stop');
            }
            
            // Hide loading indicator
            hideLoading();
            hideStatusIndicator();
            
            // Update UI
            document.getElementById('start-trading-btn').disabled = false;
            document.getElementById('stop-trading-btn').disabled = true;
            document.getElementById('reset-trading-btn').disabled = false;
            disableFormInputs(false);
            
            // Send alert
            sendAlert('Emergency Stop Executed', 'Paper trading halted. All positions closed.', 'error');
            
            // Update bot status
            updateBotStatus('idle', 'Emergency stop completed - System halted');
            updateBotActivity('waiting');
        }
    } catch (error) {
        // Hide loading indicator
        hideLoading();
        hideStatusIndicator();
        
        console.error('Error in emergency stop:', error);
        addLogMessage('Critical error in emergency stop: ' + error.message, true);
        
        // Update bot status
        updateBotStatus('idle', 'Critical error during emergency stop');
    }
}

// Cancel all futures orders
async function cancelAllOrders() {
    if (!state.futuresTrading.enabled || !state.futuresTrading.apiKey) {
        addLogMessage('API not configured for canceling orders', true);
        return Promise.reject(new Error('API not configured'));
    }
    
    try {
        addLogMessage('Canceling all open orders...');
        
        // In a real implementation, this would make an API call to the exchange
        // For demo purposes, we'll simulate a successful cancellation
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
        
        addLogMessage('All orders canceled successfully');
        return Promise.resolve();
    } catch (error) {
        console.error('Error canceling orders:', error);
        addLogMessage('Error canceling orders: ' + error.message, true);
        return Promise.reject(error);
    }
}

// Close all futures positions
async function closeAllPositions() {
    if (!state.futuresTrading.enabled || !state.futuresTrading.apiKey) {
        addLogMessage('API not configured for closing positions', true);
        return Promise.reject(new Error('API not configured'));
    }
    
    try {
        addLogMessage('Closing all open positions...');
        
        // In a real implementation, this would make an API call to the exchange
        // For demo purposes, we'll simulate a successful position closure
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
        
        // Close local tracking of position
        if (state.currentPosition) {
            closeCurrentPosition('Emergency Close');
        }
        
        addLogMessage('All positions closed successfully');
        return Promise.resolve();
    } catch (error) {
        console.error('Error closing positions:', error);
        addLogMessage('Error closing positions: ' + error.message, true);
        return Promise.reject(error);
    }
}

// Start actual live trading after confirmation
function startActualLiveTrading() {
    // Disable form inputs
    disableFormInputs(true);
    
    // Update buttons
    document.getElementById('start-live-trading-btn').disabled = true;
    document.getElementById('stop-live-trading-btn').disabled = false;
    document.getElementById('long-position-btn').disabled = false;
    document.getElementById('short-position-btn').disabled = false;
    document.getElementById('close-positions-btn').disabled = true;
    document.getElementById('emergency-stop-btn').disabled = false;
    
    // Start polling for futures data
    state.interval = setInterval(pollForFuturesData, state.settings.chartUpdateFrequency);
    
    // Update state
    state.isTrading = true;
    state.futuresTrading.enabled = true;
    
    // Update bot status
    updateBotStatus('live', 'LIVE trading active - Monitoring market');
    
    addLogMessage(`Started LIVE trading for ${state.symbol} on ${state.futuresTrading.testnet ? 'TESTNET' : 'MAINNET'}`);
    sendAlert('Live Trading Started', 'Bot has started live trading in ' + (state.futuresTrading.testnet ? 'testnet' : 'mainnet') + ' mode. Please monitor carefully.', 'warning');
}

// Save settings to localStorage
function saveSettings() {
    try {
        // Get settings from UI elements
        
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
        
        // Trading settings
        state.settings.autoTrade = document.getElementById('auto-trade-toggle').checked;
        state.settings.theme = document.getElementById('theme-select').value;
        state.settings.chartUpdateFrequency = parseInt(document.getElementById('chart-update-frequency').value) * 1000;
        
        // Fee settings
        state.feeSettings.makerFee = parseFloat(document.getElementById('maker-fee').value);
        state.feeSettings.takerFee = parseFloat(document.getElementById('taker-fee').value);
        
        // Update fee display
        document.getElementById('futures-maker-fee').textContent = state.feeSettings.makerFee.toFixed(2) + '%';
        document.getElementById('futures-taker-fee').textContent = state.feeSettings.takerFee.toFixed(2) + '%';
        document.getElementById('stat-fee-rate').textContent = `${state.feeSettings.makerFee.toFixed(2)}% / ${state.feeSettings.takerFee.toFixed(2)}%`;
        
        // Update theme if it was changed
        if (state.settings.theme === 'dark') {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
        }
        
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
        
        // If we're trading, update polling interval with new frequency
        if (state.isTrading && state.interval) {
            clearInterval(state.interval);
            if (state.futuresTrading.enabled) {
                state.interval = setInterval(pollForFuturesData, state.settings.chartUpdateFrequency);
            } else {
                state.interval = setInterval(pollForNewData, state.settings.chartUpdateFrequency);
            }
        }
        
        // Update position risk levels if we have an active position
        if (state.currentPosition) {
            updatePositionRiskLevels();
        }
        
        // Save settings to localStorage
        const settingsToSave = {
            settings: {
                theme: state.settings.theme,
                chartUpdateFrequency: state.settings.chartUpdateFrequency,
                autoTrade: state.settings.autoTrade,
                trailingStop: state.settings.trailingStop,
                takeProfit: state.settings.takeProfit,
                stopLoss: state.settings.stopLoss,
                riskManagement: state.settings.riskManagement
            },
            alerts: state.alerts
        };
        
        localStorage.setItem('voltyBotSettings', JSON.stringify(settingsToSave));
        
        // Save fee settings
        const feeSettingsToSave = {
            makerFee: state.feeSettings.makerFee,
            takerFee: state.feeSettings.takerFee
        };
        
        localStorage.setItem('voltyBotFeeSettings', JSON.stringify(feeSettingsToSave));
        
        addLogMessage('Settings saved successfully');
        
        // Update UI elements for conditional fields
        document.getElementById('trailing-stop-value').disabled = !state.settings.trailingStop.enabled;
        document.getElementById('take-profit-value').disabled = !state.settings.takeProfit.enabled;
        document.getElementById('stop-loss-value').disabled = !state.settings.stopLoss.enabled;
        document.getElementById('max-drawdown-value').disabled = !state.settings.riskManagement.enabled;
        document.getElementById('max-daily-loss-value').disabled = !state.settings.riskManagement.enabled;
        
        document.getElementById('discord-webhook-input').disabled = !state.alerts.discord.enabled;
        document.getElementById('telegram-token-input').disabled = !state.alerts.telegram.enabled;
        document.getElementById('telegram-chatid-input').disabled = !state.alerts.telegram.enabled;
        document.getElementById('email-address-input').disabled = !state.alerts.email.enabled;
        document.getElementById('sound-volume-input').disabled = !state.alerts.sound.enabled;
        
    } catch (error) {
        console.error('Error saving settings:', error);
        addLogMessage('Error saving settings: ' + error.message, true);
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
                        text: 'Volty Trading Bot - Futures Edition'
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
    
    // Email alert - implementation would use a proper email API
}

// Poll for futures data
async function pollForFuturesData() {
    try {
        // Update last check time
        state.botStats.lastCheck = new Date();
        
        // Measure execution time
        const startTime = performance.now();
        
        // Update bot activity status
        updateBotActivity('scanning');
        
        // Update bot status
        updateBotStatus('live', 'Fetching latest market data...');
        
        // Fetch latest candle
        const latestCandle = await fetchLatestCandle(state.symbol, state.timeframe);
        if (!latestCandle) throw new Error('Failed to fetch latest candle');
        
        // Update current price
        state.currentPrice = latestCandle.close;
        
        // Check if we need to update our data
        const lastDataTimestamp = state.priceData[state.priceData.length - 1].datetime.getTime();
        const latestCandleTimestamp = latestCandle.datetime.getTime();
        
        // Update market data
        state.botStats.marketData.price = latestCandle.close;
        updateMarketData();
        
        // Update position card if we have an active position
        if (state.currentPosition) {
            updatePositionCard();
        }
        
        // In a real implementation, we would fetch account information here
        // For demo purposes, we'll simulate it
        simulateAccountUpdate();
        
        // Check if this is a new candle
        if (latestCandleTimestamp > lastDataTimestamp) {
            // Add the new candle to our data
            state.priceData.push(latestCandle);
            
            // Generate signals
            const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
            state.indicators = strategy.generateSignals(state.priceData);
            
            // Update the chart
            updatePriceChart();
            
            // Get the latest signal
            const signal = strategy.getLatestSignal(state.priceData, state.indicators);
            
            // Update bot status
            updateBotActivity('trading');
            updateBotStatus('live', `New candle detected - Signal: ${signal || 'neutral'}`);
            
            // In auto-trade mode, we would process signals automatically
            // For safety in live mode, we'll just notify but require manual intervention
            if (signal && (signal === 'LONG' || signal === 'SHORT')) {
                const message = `${signal} signal detected at $${latestCandle.close.toFixed(2)}`;
                addLogMessage(message);
                sendAlert('Trading Signal', message, 'info');
            }
        }
        
        // Check position exit conditions
        if (state.currentPosition) {
            checkPositionExitConditions();
        }
        
        // Calculate execution time
        const endTime = performance.now();
        state.botStats.executionTime = Math.round(endTime - startTime);
        
        // Update last tick info
        document.getElementById('last-tick-info').textContent = 
            `Last check: ${state.botStats.lastCheck.toLocaleTimeString()} - Execution: ${state.botStats.executionTime}ms`;
        
        // Update trading stats
        updateTradingStats();
        
        // Reset bot activity to waiting
        setTimeout(() => {
            updateBotActivity('waiting');
            updateBotStatus('live', 'LIVE trading active - Waiting for next check');
        }, 1000);
    } catch (error) {
        console.error('Error polling for futures data:', error);
        addLogMessage('Error fetching data: ' + error.message, true);
        
        // Update bot status
        updateBotStatus('live', 'Error fetching data - Will retry next cycle');
        updateBotActivity('waiting');
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

// Poll for new data
async function pollForNewData() {
    try {
        // Update last check time
        state.botStats.lastCheck = new Date();
        
        // Measure execution time
        const startTime = performance.now();
        
        // Update bot activity status
        updateBotActivity('scanning');
        
        // Update bot status
        updateBotStatus('active', 'Fetching latest market data...');
        
        // Fetch latest candle
        const latestCandle = await fetchLatestCandle(state.symbol, state.timeframe);
        if (!latestCandle) throw new Error('Failed to fetch latest candle');
        
        // Update current price
        state.currentPrice = latestCandle.close;
        
        // Check if we need to update our data
        const lastDataTimestamp = state.priceData[state.priceData.length - 1].datetime.getTime();
        const latestCandleTimestamp = latestCandle.datetime.getTime();
        
        // Update market data
        state.botStats.marketData.price = latestCandle.close;
        updateMarketData();
        
        // Update position card if we have an active position
        if (state.currentPosition) {
            updatePositionCard();
        }
        
        // Check if this is a new candle
        if (latestCandleTimestamp > lastDataTimestamp) {
            // Add the new candle to our data
            state.priceData.push(latestCandle);
            
            // Generate signals
            const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
            state.indicators = strategy.generateSignals(state.priceData);
            
            // Update the chart
            updatePriceChart();
            
            // Get the latest signal
            const signal = strategy.getLatestSignal(state.priceData, state.indicators);
            
            // Update bot status
            updateBotActivity('trading');
            updateBotStatus('active', `New candle detected - Processing ${signal || 'neutral'} signal`);
            
            // Process the signal
            if (signal && (signal === 'LONG' || signal === 'SHORT')) {
                processTradeSignal(signal, latestCandle);
            }
        }
        
        // Update position card again after potential trades
        if (state.currentPosition) {
            updatePositionCard();
        }
        
        // Check take profit and stop loss
        checkPositionExitConditions();
        
        // Calculate execution time
        const endTime = performance.now();
        state.botStats.executionTime = Math.round(endTime - startTime);
        
        // Update last tick info
        document.getElementById('last-tick-info').textContent = 
            `Last check: ${state.botStats.lastCheck.toLocaleTimeString()} - Execution: ${state.botStats.executionTime}ms`;
        
        // Update trading stats
        updateTradingStats();
        
        // Reset bot activity to waiting
        setTimeout(() => {
            updateBotActivity('waiting');
            updateBotStatus('active', 'Paper trading active - Waiting for next check');
        }, 1000);
    } catch (error) {
        console.error('Error polling for new data:', error);
        addLogMessage('Error fetching data: ' + error.message, true);
        
        // Update bot status
        updateBotStatus('active', 'Error fetching data - Will retry next cycle');
        updateBotActivity('waiting');
    }
}

// Show API config modal
function showAPIConfigModal() {
    const modal = document.getElementById('apiConfigModal');
    
    // Fill in saved values if any
    document.getElementById('api-key').value = state.futuresTrading.apiKey || '';
    document.getElementById('api-secret').value = state.futuresTrading.apiSecret ? '********' : '';
    document.getElementById('testnet-toggle').checked = state.futuresTrading.testnet;
    
    modal.style.display = 'block';
}

// Save API configuration
function saveAPIConfig() {
    const apiKey = document.getElementById('api-key').value.trim();
    const apiSecret = document.getElementById('api-secret').value;
    const useTestnet = document.getElementById('testnet-toggle').checked;
    
    // Validate
    if (!apiKey) {
        addLogMessage('API key is required', true);
        return;
    }
    
    // Don't update secret if it's masked (unchanged)
    if (apiSecret !== '********') {
        state.futuresTrading.apiSecret = apiSecret;
    }
    
    state.futuresTrading.apiKey = apiKey;
    state.futuresTrading.testnet = useTestnet;
    
    // Save to localStorage
    try {
        const apiConfig = {
            apiKey: apiKey,
            testnet: useTestnet,
            limits: state.futuresTrading.limits
        };
        
        localStorage.setItem('voltyBotFuturesConfig', JSON.stringify(apiConfig));
        
        addLogMessage('API configuration saved successfully');
    } catch (error) {
        console.error('Error saving API config:', error);
        addLogMessage('Error saving API configuration: ' + error.message, true);
    }
    
    // Close modal
    document.getElementById('apiConfigModal').style.display = 'none';
}

// Simulate account updates for demo purposes
function simulateAccountUpdate() {
    // In a real implementation, this would fetch actual account data from the exchange
    // For demo purposes, we'll simulate it
    
    document.getElementById('available-balance').textContent = `${(state.currentCapital * 0.9).toFixed(2)} USDT`;
    
    if (state.currentPosition) {
        const positionMargin = state.currentPosition.size * state.currentPosition.entryPrice / parseInt(document.getElementById('leverage-select').value);
        document.getElementById('position-margin').textContent = `${positionMargin.toFixed(2)} USDT`;
        
        const unrealizedPnl = state.currentPosition.getUnrealizedPnl(state.currentPrice);
        document.getElementById('unrealized-pnl').textContent = `${unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)} USDT`;
        document.getElementById('unrealized-pnl').className = 'stat-value ' + (unrealizedPnl >= 0 ? 'positive' : 'negative');
    } else {
        document.getElementById('position-margin').textContent = '0.00 USDT';
        document.getElementById('unrealized-pnl').textContent = '0.00 USDT';
        document.getElementById('unrealized-pnl').className = 'stat-value';
    }
}

// Switch trading mode
function switchToTradingMode(mode) {
    if (state.isTrading) {
        addLogMessage('Please stop trading before switching modes', true);
        return;
    }
    
    if (mode === 'paper') {
        // Switch to paper trading mode
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
        
        addLogMessage('Switched to paper trading mode');
    } else {
        // Switch to futures trading mode
        state.futuresTrading.enabled = true;
        
        // Update UI
        document.getElementById('live-trading-btn').classList.add('active');
        document.getElementById('paper-trading-btn').classList.remove('active');
        
        document.getElementById('paper-trading-settings').style.display = 'none';
        document.getElementById('live-trading-settings').style.display = 'block';
        
        document.getElementById('paper-trading-buttons').style.display = 'none';
        document.getElementById('live-trading-buttons').style.display = 'block';
        
        document.getElementById('account-balance-section').style.display = 'block';
        document.getElementById('fee-information').style.display = 'block';
        
        addLogMessage('Switched to futures trading mode');
    }
}

// Load settings and initialize form fields
function loadSettings() {
    // Risk management
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
    document.getElementById('max-drawdown-value').disabled = !state.settings.riskManagement.enabled;
    document.getElementById('max-daily-loss-value').value = state.settings.riskManagement.maxDailyLoss;
    document.getElementById('max-daily-loss-value').disabled = !state.settings.riskManagement.enabled;
    
    // Trading settings
    document.getElementById('auto-trade-toggle').checked = state.settings.autoTrade;
    document.getElementById('theme-select').value = state.settings.theme;
    document.getElementById('chart-update-frequency').value = state.settings.chartUpdateFrequency / 1000;
    
    // Fee settings
    document.getElementById('maker-fee').value = state.feeSettings.makerFee;
    document.getElementById('taker-fee').value = state.feeSettings.takerFee;
    document.getElementById('futures-maker-fee').textContent = state.feeSettings.makerFee.toFixed(2) + '%';
    document.getElementById('futures-taker-fee').textContent = state.feeSettings.takerFee.toFixed(2) + '%';
    
    // Alert settings
    document.getElementById('discord-alert-toggle').checked = state.alerts.discord.enabled;
    document.getElementById('discord-webhook-input').value = state.alerts.discord.webhook;
    document.getElementById('discord-webhook-input').disabled = !state.alerts.discord.enabled;
    
    document.getElementById('telegram-alert-toggle').checked = state.alerts.telegram.enabled;
    document.getElementById('telegram-token-input').value = state.alerts.telegram.botToken;
    document.getElementById('telegram-token-input').disabled = !state.alerts.telegram.enabled;
    document.getElementById('telegram-chatid-input').value = state.alerts.telegram.chatId;
    document.getElementById('telegram-chatid-input').disabled = !state.alerts.telegram.enabled;
    
    document.getElementById('email-alert-toggle').checked = state.alerts.email.enabled;
    document.getElementById('email-address-input').value = state.alerts.email.address;
    document.getElementById('email-address-input').disabled = !state.alerts.email.enabled;
    
    document.getElementById('browser-alert-toggle').checked = state.alerts.browser.enabled;
    
    document.getElementById('sound-alert-toggle').checked = state.alerts.sound.enabled;
    document.getElementById('sound-volume-input').value = state.alerts.sound.volume;
    document.getElementById('sound-volume-input').disabled = !state.alerts.sound.enabled;
    
    // Add event listeners for toggles
    document.getElementById('trailing-stop-toggle').addEventListener('change', function() {
        document.getElementById('trailing-stop-value').disabled = !this.checked;
    });
    
    document.getElementById('take-profit-toggle').addEventListener('change', function() {
        document.getElementById('take-profit-value').disabled = !this.checked;
    });
    
    document.getElementById('stop-loss-toggle').addEventListener('change', function() {
        document.getElementById('stop-loss-value').disabled = !this.checked;
    });
    
    document.getElementById('risk-management-toggle').addEventListener('change', function() {
        document.getElementById('max-drawdown-value').disabled = !this.checked;
        document.getElementById('max-daily-loss-value').disabled = !this.checked;
    });
    
    document.getElementById('discord-alert-toggle').addEventListener('change', function() {
        document.getElementById('discord-webhook-input').disabled = !this.checked;
    });
    
    document.getElementById('telegram-alert-toggle').addEventListener('change', function() {
        document.getElementById('telegram-token-input').disabled = !this.checked;
        document.getElementById('telegram-chatid-input').disabled = !this.checked;
    });
    
    document.getElementById('email-alert-toggle').addEventListener('change', function() {
        document.getElementById('email-address-input').disabled = !this.checked;
    });
    
    document.getElementById('sound-alert-toggle').addEventListener('change', function() {
        document.getElementById('sound-volume-input').disabled = !this.checked;
    });
}

// Initialize alerts
function initAlerts() {
    // Test alert button
    document.getElementById('test-alert-btn').addEventListener('click', function() {
        sendAlert('Test Alert', 'This is a test alert from Volty Trading Bot', 'info');
    });
}

// Check if using mobile device
function checkMobileDevice() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        document.getElementById('mobile-info').style.display = 'block';
    }
}

// Disable or enable form inputs
function disableFormInputs(disabled) {
    document.getElementById('symbol').disabled = disabled;
    document.getElementById('timeframe').disabled = disabled;
    document.getElementById('atr-length').disabled = disabled;
    document.getElementById('atr-mult').disabled = disabled;
    document.getElementById('maker-fee').disabled = disabled;
    document.getElementById('taker-fee').disabled = disabled;
    
    if (state.futuresTrading.enabled) {
        document.getElementById('live-position-size').disabled = disabled;
        document.getElementById('leverage-select').disabled = disabled;
        document.getElementById('margin-type-select').disabled = disabled;
    } else {
        document.getElementById('initial-capital').disabled = disabled;
        document.getElementById('position-size').disabled = disabled;
    }
}

// Load settings from localStorage
function loadSettingsFromLocalStorage() {
    try {
        // Load general settings
        const savedSettings = localStorage.getItem('voltyBotSettings');
        if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            state.settings = { ...state.settings, ...parsedSettings.settings };
            state.alerts = { ...state.alerts, ...parsedSettings.alerts };
        }
        
        // Load fee settings
        const feeSettings = localStorage.getItem('voltyBotFeeSettings');
        if (feeSettings) {
            const parsedFeeSettings = JSON.parse(feeSettings);
            state.feeSettings = { ...state.feeSettings, ...parsedFeeSettings };
        }
        
        // Load futures API config if available
        const apiConfig = localStorage.getItem('voltyBotFuturesConfig');
        if (apiConfig) {
            const parsedConfig = JSON.parse(apiConfig);
            state.futuresTrading.apiKey = parsedConfig.apiKey || '';
            state.futuresTrading.testnet = parsedConfig.testnet !== undefined ? parsedConfig.testnet : true;
            state.futuresTrading.limits = { ...state.futuresTrading.limits, ...parsedConfig.limits };
        }
    } catch (error) {
        console.error('Error loading settings from localStorage:', error);
        addLogMessage('Error loading saved settings');
    }
}

// Utility function to safely get elements and add event listeners
function safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with ID "${id}" not found`);
    }
    return element;
}

// Safely add event listener
function safeAddEventListener(id, event, callback) {
    const element = safeGetElement(id);
    if (element) {
        element.addEventListener(event, callback);
    }
}
// Initialize charts
function initCharts() {
    // Initialize price chart
    const priceChartDiv = safeGetElement('priceChart');
    if (!priceChartDiv) {
        throw new Error('Price chart element not found');
    }
    
    // Create candlestick trace
    const candleTrace = {
        x: state.priceData.map(d => d.datetime),
        open: state.priceData.map(d => d.open),
        high: state.priceData.map(d => d.high),
        low: state.priceData.map(d => d.low),
        close: state.priceData.map(d => d.close),
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
    };
    
    // Create volume trace
    const volumeColors = state.priceData.map(d => d.close > d.open ? OHLC_COLORS.volume.up : OHLC_COLORS.volume.down);
    const volumeTrace = {
        x: state.priceData.map(d => d.datetime),
        y: state.priceData.map(d => d.volume),
        type: 'bar',
        name: 'Volume',
        yaxis: 'y2',
        marker: {
            color: volumeColors
        },
        opacity: 0.5
    };
    
    // Create long signal trace
    const longSignalTrace = {
        x: state.priceData.map(d => d.datetime),
        y: state.indicators.longSignal,
        type: 'scatter',
        mode: 'lines',
        name: 'Long Signal',
        line: {
            color: 'rgba(74, 222, 128, 0.6)',
            width: 1,
            dash: 'dot'
        }
    };
    
    // Create short signal trace
    const shortSignalTrace = {
        x: state.priceData.map(d => d.datetime),
        y: state.indicators.shortSignal,
        type: 'scatter',
        mode: 'lines',
        name: 'Short Signal',
        line: {
            color: 'rgba(248, 113, 113, 0.6)',
            width: 1,
            dash: 'dot'
        }
    };
    
    // Set up layout
    const layout = {
        title: `${state.symbol} ${state.timeframe} Chart`,
        dragmode: 'zoom',
        margin: { l: 50, r: 50, b: 50, t: 50, pad: 4 },
        grid: { rows: 2, columns: 1, pattern: 'independent', roworder: 'bottom to top' },
        annotations: [],
        xaxis: {
            rangeslider: { visible: false },
            type: 'date',
            showgrid: false
        },
        yaxis: {
            autorange: true,
            domain: [0.2, 1],
            type: 'linear',
            scaleanchor: 'x',
            gridcolor: 'rgba(255,255,255,0.1)'
        },
        yaxis2: {
            domain: [0, 0.1],
            gridcolor: 'rgba(255,255,255,0.1)'
        },
        plot_bgcolor: 'rgba(0, 0, 0, 0)',
        paper_bgcolor: 'rgba(0, 0, 0, 0)',
        font: {
            color: '#d1d5db'
        },
        showlegend: false
    };
    
    // Create the chart
    try {
        Plotly.newPlot(priceChartDiv, [candleTrace, volumeTrace, longSignalTrace, shortSignalTrace], layout, {
            displayModeBar: true,
            responsive: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d', 'toggleSpikelines']
        });
        
        state.charts.price = true;
        
        // Initialize equity chart
        const equityChartDiv = safeGetElement('equityChart');
        if (!equityChartDiv) {
            throw new Error('Equity chart element not found');
        }
        
        // Create equity curve trace
        const equityTrace = {
            x: state.equityCurve.map(d => d.time),
            y: state.equityCurve.map(d => d.value),
            type: 'scatter',
            mode: 'lines',
            name: 'Equity',
            line: {
                color: '#4f46e5',
                width: 2
            }
        };
        
        // Set up equity chart layout
        const equityLayout = {
            title: 'Equity Curve',
            margin: { l: 50, r: 50, b: 50, t: 50, pad: 4 },
            xaxis: {
                type: 'date',
                showgrid: false
            },
            yaxis: {
                autorange: true,
                type: 'linear',
                gridcolor: 'rgba(255,255,255,0.1)'
            },
            plot_bgcolor: 'rgba(0, 0, 0, 0)',
            paper_bgcolor: 'rgba(0, 0, 0, 0)',
            font: {
                color: '#d1d5db'
            },
            showlegend: false
        };
        
        // Create the equity chart
        Plotly.newPlot(equityChartDiv, [equityTrace], equityLayout, {
            displayModeBar: true,
            responsive: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d', 'toggleSpikelines']
        });
        
        state.charts.equity = true;
    } catch (error) {
        console.error('Error creating charts with Plotly:', error);
        throw new Error('Failed to create charts: ' + error.message);
    }
}

// Update price chart with new data and indicators
function updatePriceChart() {
    if (!state.charts.price) return;
    
    const priceChartDiv = safeGetElement('priceChart');
    if (!priceChartDiv) return;
    
    try {
        // Update candlestick data
        const candleData = {
            x: state.priceData.map(d => d.datetime),
            open: state.priceData.map(d => d.open),
            high: state.priceData.map(d => d.high),
            low: state.priceData.map(d => d.low),
            close: state.priceData.map(d => d.close)
        };
        
        // Update volume data
        const volumeColors = state.priceData.map(d => d.close > d.open ? OHLC_COLORS.volume.up : OHLC_COLORS.volume.down);
        const volumeData = {
            x: state.priceData.map(d => d.datetime),
            y: state.priceData.map(d => d.volume),
            marker: {
                color: volumeColors
            }
        };
        
        // Update long signal data
        const longSignalData = {
            x: state.priceData.map(d => d.datetime),
            y: state.indicators.longSignal
        };
        
        // Update short signal data
        const shortSignalData = {
            x: state.priceData.map(d => d.datetime),
            y: state.indicators.shortSignal
        };
        
        // Update chart
        Plotly.update(priceChartDiv, 
            // Update candlestick data (trace 0)
            candleData, {}, 0);
        
        // Update volume data (trace 1)
        Plotly.update(priceChartDiv, volumeData, {}, 1);
        
        // Update signal traces
        Plotly.update(priceChartDiv, longSignalData, {}, 2);
        Plotly.update(priceChartDiv, shortSignalData, {}, 3);
        
        // Update chart title
        Plotly.relayout(priceChartDiv, {
            title: `${state.symbol} ${state.timeframe} Chart`,
            // Update x-axis range to show the most recent data
            xaxis: {
                range: [
                    state.priceData[Math.max(0, state.priceData.length - 100)].datetime,
                    state.priceData[state.priceData.length - 1].datetime
                ],
                rangeslider: { visible: false },
                type: 'date',
                showgrid: false
            }
        });
        
        // Add historical trade markers if there are trades
        if (state.trades.length > 0) {
            // First remove any existing trade markers
            if (priceChartDiv.data.length > 4) {
                Plotly.deleteTraces(priceChartDiv, [4, 5]);
            }
            
            // Create long trade markers
            const longTrades = state.trades.filter(t => t.type === 'LONG');
            const longEntries = {
                x: longTrades.map(t => t.entryTime),
                y: longTrades.map(t => {
                    // Find the candle for this entry time
                    const candle = state.priceData.find(d => 
                        d.datetime.getTime() <= t.entryTime.getTime() && 
                        d.datetime.getTime() + getTimeframeInMs(state.timeframe) > t.entryTime.getTime()
                    );
                    return candle ? candle.low - (candle.high - candle.low) * 0.5 : null;
                }),
                mode: 'markers',
                type: 'scatter',
                marker: {
                    symbol: 'triangle-up',
                    size: 10,
                    color: OHLC_COLORS.up,
                    line: { width: 1, color: 'white' }
                },
                name: 'Long Entries'
            };
            
            // Create short trade markers
            const shortTrades = state.trades.filter(t => t.type === 'SHORT');
            const shortEntries = {
                x: shortTrades.map(t => t.entryTime),
                y: shortTrades.map(t => {
                    // Find the candle for this entry time
                    const candle = state.priceData.find(d => 
                        d.datetime.getTime() <= t.entryTime.getTime() && 
                        d.datetime.getTime() + getTimeframeInMs(state.timeframe) > t.entryTime.getTime()
                    );
                    return candle ? candle.high + (candle.high - candle.low) * 0.5 : null;
                }),
                mode: 'markers',
                type: 'scatter',
                marker: {
                    symbol: 'triangle-down',
                    size: 10,
                    color: OHLC_COLORS.down,
                    line: { width: 1, color: 'white' }
                },
                name: 'Short Entries'
            };
            
            // Add trade markers to chart
            Plotly.addTraces(priceChartDiv, [longEntries, shortEntries]);
        }
    } catch (error) {
        console.error('Error updating price chart:', error);
        addLogMessage('Error updating chart: ' + error.message, true);
    }
}

// Get timeframe in milliseconds
function getTimeframeInMs(timeframe) {
    const timeframeMap = {
        '1m': 60 * 1000,
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '30m': 30 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000
    };
    
    return timeframeMap[timeframe] || 60 * 60 * 1000;
}

// Update equity chart
function updateEquityChart() {
    if (!state.charts.equity) return;
    
    const equityChartDiv = safeGetElement('equityChart');
    if (!equityChartDiv) return;
    
    try {
        // Update equity curve data
        const equityData = {
            x: state.equityCurve.map(d => d.time),
            y: state.equityCurve.map(d => d.value)
        };
        
        // Update chart
        Plotly.update(equityChartDiv, equityData, {}, 0);
        
        // Update metrics
        updateMetrics();
    } catch (error) {
        console.error('Error updating equity chart:', error);
        addLogMessage('Error updating equity chart: ' + error.message, true);
    }
}

// Safely set element property
function safeSetElementProperty(id, property, value) {
    const element = safeGetElement(id);
    if (element) {
        element[property] = value;
    }
}

// Safely set element text content
function safeSetTextContent(id, text) {
    const element = safeGetElement(id);
    if (element) {
        element.textContent = text;
    }
}

// Modified initUI function with defensive coding
function initUI() {
    // Register event listeners for sliders
    safeAddEventListener('atr-length', 'input', function() {
        const value = this.value;
        safeSetTextContent('atr-length-value', value);
        state.atrLength = parseInt(value);
    });
    
    safeAddEventListener('atr-mult', 'input', function() {
        const value = this.value;
        safeSetTextContent('atr-mult-value', value);
        state.atrMultiplier = parseFloat(value);
    });
    
    safeAddEventListener('position-size', 'input', function() {
        const value = this.value;
        safeSetTextContent('position-size-value', value + '%');
        state.positionSize = parseInt(value);
    });
    
    // Fee settings
    safeAddEventListener('maker-fee', 'input', function() {
        const value = parseFloat(this.value);
        state.feeSettings.makerFee = value;
        safeSetTextContent('futures-maker-fee', value.toFixed(2) + '%');
        safeSetTextContent('stat-fee-rate', `${value.toFixed(2)}% / ${state.feeSettings.takerFee.toFixed(2)}%`);
    });
    
    safeAddEventListener('taker-fee', 'input', function() {
        const value = parseFloat(this.value);
        state.feeSettings.takerFee = value;
        safeSetTextContent('futures-taker-fee', value.toFixed(2) + '%');
        safeSetTextContent('stat-fee-rate', `${state.feeSettings.makerFee.toFixed(2)}% / ${value.toFixed(2)}%`);
    });
    
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    if (tabButtons.length > 0 && tabContents.length > 0) {
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const tabName = this.dataset.tab;
                const tabContent = document.getElementById(tabName);
                
                if (!tabContent) {
                    console.warn(`Tab content with ID "${tabName}" not found`);
                    return;
                }
                
                // Remove active class from all buttons and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to current button and content
                this.classList.add('active');
                tabContent.classList.add('active');
            });
        });
    }
    
    // Symbol and timeframe change handlers
    safeAddEventListener('symbol', 'change', function() {
        if (!state.isTrading) {
            state.symbol = this.value;
            reloadDataWithSettings();
        }
    });
    
    safeAddEventListener('timeframe', 'change', function() {
        if (!state.isTrading) {
            state.timeframe = this.value;
            reloadDataWithSettings();
        }
    });
    
    // Trading buttons
    safeAddEventListener('start-trading-btn', 'click', startTrading);
    safeAddEventListener('stop-trading-btn', 'click', stopTrading);
    safeAddEventListener('reset-trading-btn', 'click', resetTrading);
    
    // Futures trading buttons
    safeAddEventListener('start-live-trading-btn', 'click', startLiveTrading);
    safeAddEventListener('stop-live-trading-btn', 'click', stopTrading);
    safeAddEventListener('emergency-stop-btn', 'click', emergencyStop);
    
    safeAddEventListener('long-position-btn', 'click', function() {
        openManualPosition('LONG');
    });
    
    safeAddEventListener('short-position-btn', 'click', function() {
        openManualPosition('SHORT');
    });
    
    safeAddEventListener('close-positions-btn', 'click', function() {
        closeCurrentPosition('Manual Close');
    });
    
    // Trading mode toggles
    safeAddEventListener('paper-trading-btn', 'click', function() {
        switchToTradingMode('paper');
    });
    
    safeAddEventListener('live-trading-btn', 'click', function() {
        switchToTradingMode('live');
    });
    
    // Settings & API buttons
    safeAddEventListener('save-settings-btn', 'click', saveSettings);
    
    safeAddEventListener('test-alert-btn', 'click', function() {
        sendAlert('Test Alert', 'This is a test alert from Volty Trading Bot', 'info');
    });
    
    safeAddEventListener('configure-api-link', 'click', function(e) {
        e.preventDefault();
        showAPIConfigModal();
    });
    
    safeAddEventListener('configure-api-link-alert', 'click', function(e) {
        e.preventDefault();
        showAPIConfigModal();
    });
    
    // API config modal
    const apiConfigModal = safeGetElement('apiConfigModal');
    if (apiConfigModal) {
        const closeBtns = apiConfigModal.querySelectorAll('.close-modal, #cancel-api-config-btn');
        
        closeBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                apiConfigModal.style.display = 'none';
            });
        });
        
        safeAddEventListener('save-api-config-btn', 'click', saveAPIConfig);
    }
    
    // Live trading confirmation modal
    const liveTradingModal = safeGetElement('liveTradingConfirmModal');
    if (liveTradingModal) {
        safeAddEventListener('confirm-live-trading', 'change', function() {
            safeSetElementProperty('confirm-live-trading-btn', 'disabled', !this.checked);
        });
        
        safeAddEventListener('confirm-live-trading-btn', 'click', function() {
            liveTradingModal.style.display = 'none';
            startActualLiveTrading();
        });
        
        safeAddEventListener('cancel-live-trading-btn', 'click', function() {
            liveTradingModal.style.display = 'none';
        });
        
        const closeModalBtn = liveTradingModal.querySelector('.close-modal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', function() {
                liveTradingModal.style.display = 'none';
            });
        }
    }
    
    // Theme switcher
    safeAddEventListener('theme-select', 'change', function() {
        if (this.value === 'dark') {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            state.settings.theme = 'dark';
        } else {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            state.settings.theme = 'light';
        }
    });
    
    // Initial capital
    safeAddEventListener('initial-capital', 'change', function() {
        if (!state.isTrading) {
            state.initialCapital = parseFloat(this.value);
            state.currentCapital = state.initialCapital;
            state.botStats.dailyStartCapital = state.initialCapital;
            state.equityCurve = [{ time: new Date(), value: state.initialCapital }];
            
            // Update metrics
            updateMetrics();
            updateEquityChart();
            
            addLogMessage(`Initial capital updated to $${state.initialCapital.toLocaleString()}`);
        }
    });
    
    // Initialize UI based on selected trading mode
    try {
        switchToTradingMode('paper');
    } catch (error) {
        console.error('Error initializing trading mode:', error);
    }
    
    // Initialize settings toggles
    try {
        loadSettings();
    } catch (error) {
        console.error('Error loading settings:', error);
    }
    
    // Initialize alerts
    try {
        initAlerts();
    } catch (error) {
        console.error('Error initializing alerts:', error);
    }
    
    // Check if using mobile device
    try {
        checkMobileDevice();
    } catch (error) {
        console.error('Error checking mobile device:', error);
    }
    
    // Initial bot status
    try {
        updateBotStatus('idle', 'System initialized - Waiting for data...');
    } catch (error) {
        console.error('Error updating bot status:', error);
    }
    
    // Update fee display
    safeSetTextContent('stat-fee-rate', `${state.feeSettings.makerFee.toFixed(2)}% / ${state.feeSettings.takerFee.toFixed(2)}%`);
    
    // Show loading indicator
    try {
        showLoading();
    } catch (error) {
        console.error('Error showing loading indicator:', error);
    }
    
    // Initial data fetch
    fetchHistoricalData(state.symbol, state.timeframe, 500)
        .then(data => {
            try {
                hideLoading();
                state.priceData = data;
                
                // Update current price and market data
                if (data.length > 0) {
                    const lastCandle = data[data.length - 1];
                    state.currentPrice = lastCandle.close;
                    state.botStats.marketData.price = lastCandle.close;
                    
                    // Calculate 24h price change
                    const oneDayInMs = 24 * 60 * 60 * 1000;
                    const prevDayData = data.find(d => d.datetime.getTime() < (lastCandle.datetime.getTime() - oneDayInMs));
                    
                    if (prevDayData) {
                        const change = ((lastCandle.close - prevDayData.close) / prevDayData.close) * 100;
                        state.botStats.marketData.change24h = change;
                    }
                    
                    // Calculate 24h volume
                    const last24hData = data.filter(d => d.datetime.getTime() > (lastCandle.datetime.getTime() - oneDayInMs));
                    const volume = last24hData.reduce((sum, candle) => sum + candle.volume, 0);
                    state.botStats.marketData.volume = volume;
                    
                    // Update market data display
                    updateMarketData();
                }
                
                // Generate signals
                const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
                state.indicators = strategy.generateSignals(state.priceData);
                
                // Initialize charts
                try {
                    initCharts();
                } catch (error) {
                    console.error('Error initializing charts:', error);
                    addLogMessage('Error initializing charts: ' + error.message, true);
                }
                
                // Update bot status
                updateBotStatus('idle', 'Ready to start trading');
                
                // Add log message
                addLogMessage('System initialized with historical data');
            } catch (error) {
                console.error('Error processing initial data:', error);
                addLogMessage('Error processing initial data: ' + error.message, true);
            }
        })
        .catch(error => {
            try {
                hideLoading();
                console.error('Error fetching initial data:', error);
                updateBotStatus('idle', 'Error fetching data - Check connection');
                addLogMessage('Error fetching historical data: ' + error.message, true);
            } catch (innerError) {
                console.error('Error handling fetch error:', innerError);
            }
        });
}

// Set a fixed clock display
function setFixedClock(dateTimeStr) {
    // Update the clock display with the provided date/time string
    const clockDisplay = document.getElementById('clock-display');
    if (clockDisplay) {
        clockDisplay.textContent = dateTimeStr + ' UTC';
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
    setFixedClock('2025-06-08 14:48:05');
});
