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

// Volty Expansion Close strategy implementation
class VoltyStrategy {
    constructor(atrLength = 5, atrMultiplier = 0.75) {
        this.atrLength = atrLength;
        this.atrMultiplier = atrMultiplier;
    }
    
    generateSignals(priceData) {
        // Calculate True Range
        const tr = [];
        for (let i = 0; i < priceData.length; i++) {
            if (i === 0) {
                tr.push(priceData[i].high - priceData[i].low);
                continue;
            }
            
            const trValue = Math.max(
                priceData[i].high - priceData[i].low,
                Math.abs(priceData[i].high - priceData[i-1].close),
                Math.abs(priceData[i].low - priceData[i-1].close)
            );
            
            tr.push(trValue);
        }
        
        // Calculate SMA of True Range (ATR)
        const atr = [];
        for (let i = 0; i < priceData.length; i++) {
            if (i < this.atrLength - 1) {
                atr.push(null);
                continue;
            }
            
            let sum = 0;
            for (let j = 0; j < this.atrLength; j++) {
                sum += tr[i - j];
            }
            
            atr.push((sum / this.atrLength) * this.atrMultiplier);
        }
        
        // Generate signals based on stop levels
        const longSignal = [];
        const shortSignal = [];
        
        // Track the previous signal state
        let prevSignalState = null; // 'LONG', 'SHORT', or null
        
        for (let i = 0; i < priceData.length; i++) {
            if (i < this.atrLength) {
                // Not enough data yet for signals
                longSignal.push(null);
                shortSignal.push(null);
                continue;
            }
            
            // Get reference close and ATR
            const referenceClose = priceData[i - this.atrLength].close;
            const currentATR = atr[i];
            
            // Calculate stop levels
            const longStopLevel = referenceClose + currentATR;
            const shortStopLevel = referenceClose - currentATR;
            
            // Check if current bar's high/low crossed the stop levels
            const longTriggered = (priceData[i].high >= longStopLevel);
            const shortTriggered = (priceData[i].low <= shortStopLevel);
            
            // Determine current signal
            let currentSignal = null;
            if (longTriggered) {
                currentSignal = 'LONG';
            } else if (shortTriggered) {
                currentSignal = 'SHORT';
            }
            
            // Set signal values only when direction changes
            if (currentSignal !== null && currentSignal !== prevSignalState) {
                if (currentSignal === 'LONG') {
                    longSignal.push(priceData[i].low - (priceData[i].high - priceData[i].low) * 0.3);
                    shortSignal.push(null);
                } else {
                    longSignal.push(null);
                    shortSignal.push(priceData[i].high + (priceData[i].high - priceData[i].low) * 0.3);
                }
                
                // Update previous state
                prevSignalState = currentSignal;
            } else {
                // No direction change
                longSignal.push(null);
                shortSignal.push(null);
            }
        }
        
        return {
            atr,
            longSignal,
            shortSignal
        };
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
    clockInterval: null,
    
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
    },
    
    usingTradingView: false
};

// Safely get element - returns null if element doesn't exist
function safeGetElement(id) {
    return document.getElementById(id);
}

// Safe API fetch with error handling and retry
async function safeApiFetch(url, options = {}) {
    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API fetch error:', error);
        addLogMessage(`API Error: ${error.message}`, true);
        
        // Depending on the error, you might want to retry or handle differently
        if (error.message.includes('429')) {
            addLogMessage('Rate limit exceeded. Waiting before retry...', true);
            // Wait for a bit then retry
            await new Promise(resolve => setTimeout(resolve, 5000));
            return safeApiFetch(url, options);
        }
        
        throw error;
    }
}

// Start a live updating clock
function startLiveClock() {
    // Create a function to update the clock
    function updateClock() {
        const now = new Date();
        
        // Format date as YYYY-MM-DD HH:MM:SS
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const day = String(now.getUTCDate()).padStart(2, '0');
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');
        
        const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        
        // Update the clock display
        const clockDisplay = safeGetElement('clock-display');
        if (clockDisplay) {
            clockDisplay.textContent = formattedDateTime + ' UTC';
        }
    }
    
    // Update immediately
    updateClock();
    
    // Then update every second
    state.clockInterval = setInterval(updateClock, 1000);
    
    return state.clockInterval;
}

// Initialize user interface
function initUI() {
    try {
        // Register event listeners for sliders
        const atrLengthSlider = safeGetElement('atr-length');
        const atrLengthValue = safeGetElement('atr-length-value');
        if (atrLengthSlider && atrLengthValue) {
            atrLengthSlider.addEventListener('input', function() {
                const value = this.value;
                atrLengthValue.textContent = value;
                state.atrLength = parseInt(value);
            });
        }
        
        const atrMultSlider = safeGetElement('atr-mult');
        const atrMultValue = safeGetElement('atr-mult-value');
        if (atrMultSlider && atrMultValue) {
            atrMultSlider.addEventListener('input', function() {
                const value = this.value;
                atrMultValue.textContent = value;
                state.atrMultiplier = parseFloat(value);
            });
        }
        
        const positionSizeSlider = safeGetElement('position-size');
        const positionSizeValue = safeGetElement('position-size-value');
        if (positionSizeSlider && positionSizeValue) {
            positionSizeSlider.addEventListener('input', function() {
                const value = this.value;
                positionSizeValue.textContent = value + '%';
                state.positionSize = parseInt(value);
            });
        }
        
        // Live trading specific inputs
        const liveAtrLengthSlider = safeGetElement('live-atr-length');
        const liveAtrLengthValue = safeGetElement('live-atr-length-value');
        if (liveAtrLengthSlider && liveAtrLengthValue) {
            liveAtrLengthSlider.addEventListener('input', function() {
                const value = this.value;
                liveAtrLengthValue.textContent = value;
                state.atrLength = parseInt(value);
            });
        }
        
        const liveAtrMultSlider = safeGetElement('live-atr-mult');
        const liveAtrMultValue = safeGetElement('live-atr-mult-value');
        if (liveAtrMultSlider && liveAtrMultValue) {
            liveAtrMultSlider.addEventListener('input', function() {
                const value = this.value;
                liveAtrMultValue.textContent = value;
                state.atrMultiplier = parseFloat(value);
            });
        }
        
        const livePositionSizeSlider = safeGetElement('live-position-size');
        const livePositionSizeValue = safeGetElement('live-position-size-value');
        if (livePositionSizeSlider && livePositionSizeValue) {
            livePositionSizeSlider.addEventListener('input', function() {
                const value = this.value;
                livePositionSizeValue.textContent = value + '%';
                state.futuresTrading.positionSize = parseInt(value);
            });
        }
        
        // Fee settings
        const makerFeeInput = safeGetElement('maker-fee');
        const futureMakerFee = safeGetElement('futures-maker-fee');
        const statFeeRate = safeGetElement('stat-fee-rate');
        if (makerFeeInput) {
            makerFeeInput.addEventListener('input', function() {
                const value = parseFloat(this.value);
                state.feeSettings.makerFee = value;
                if (futureMakerFee) futureMakerFee.textContent = value.toFixed(2) + '%';
                if (statFeeRate) statFeeRate.textContent = `${value.toFixed(2)}% / ${state.feeSettings.takerFee.toFixed(2)}%`;
            });
        }
        
        const takerFeeInput = safeGetElement('taker-fee');
        const futureTakerFee = safeGetElement('futures-taker-fee');
        if (takerFeeInput) {
            takerFeeInput.addEventListener('input', function() {
                const value = parseFloat(this.value);
                state.feeSettings.takerFee = value;
                if (futureTakerFee) futureTakerFee.textContent = value.toFixed(2) + '%';
                if (statFeeRate) statFeeRate.textContent = `${state.feeSettings.makerFee.toFixed(2)}% / ${value.toFixed(2)}%`;
            });
        }
        
        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-button');
        if (tabButtons) {
            tabButtons.forEach(button => {
                button.addEventListener('click', function() {
                    const tabName = this.dataset.tab;
                    
                    // Remove active class from all buttons and contents
                    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                    
                    // Add active class to current button and content
                    this.classList.add('active');
                    const tabContent = safeGetElement(tabName);
                    if (tabContent) tabContent.classList.add('active');
                });
            });
        }
        
        // Symbol and timeframe change handlers
        const symbolSelect = safeGetElement('symbol');
        if (symbolSelect) {
            symbolSelect.addEventListener('change', function() {
                if (!state.isTrading) {
                    state.symbol = this.value;
                    // Update market symbol display
                    const marketSymbol = safeGetElement('market-symbol');
                    if (marketSymbol) marketSymbol.textContent = state.symbol;
                    reloadDataWithSettings();
                }
            });
        }
        
        const timeframeSelect = safeGetElement('timeframe');
        if (timeframeSelect) {
            timeframeSelect.addEventListener('change', function() {
                if (!state.isTrading) {
                    state.timeframe = this.value;
                    reloadDataWithSettings();
                }
            });
        }
        
        // Live trading symbol and timeframe
        const liveSymbolSelect = safeGetElement('live-symbol');
        if (liveSymbolSelect) {
            liveSymbolSelect.addEventListener('change', function() {
                if (!state.isTrading) {
                    state.symbol = this.value;
                    // Update market symbol display
                    const marketSymbol = safeGetElement('market-symbol');
                    if (marketSymbol) marketSymbol.textContent = state.symbol;
                    reloadDataWithSettings();
                }
            });
        }
        
        const liveTimeframeSelect = safeGetElement('live-timeframe');
        if (liveTimeframeSelect) {
            liveTimeframeSelect.addEventListener('change', function() {
                if (!state.isTrading) {
                    state.timeframe = this.value;
                    reloadDataWithSettings();
                }
            });
        }
        
        // Trading buttons
        const startTradingBtn = safeGetElement('start-trading-btn');
        if (startTradingBtn) {
            startTradingBtn.addEventListener('click', startTrading);
        }
        
        const stopTradingBtn = safeGetElement('stop-trading-btn');
        if (stopTradingBtn) {
            stopTradingBtn.addEventListener('click', stopTrading);
        }
        
        const resetTradingBtn = safeGetElement('reset-trading-btn');
        if (resetTradingBtn) {
            resetTradingBtn.addEventListener('click', resetTrading);
        }
        
        // Position close button
        const positionCloseBtn = safeGetElement('position-close-btn');
        if (positionCloseBtn) {
            positionCloseBtn.addEventListener('click', function() {
                closeCurrentPosition('Manual Close');
            });
        }
        
        // Futures trading buttons
        const startLiveTradingBtn = safeGetElement('start-live-trading-btn');
        if (startLiveTradingBtn) {
            startLiveTradingBtn.addEventListener('click', startLiveTrading);
        }
        
        const stopLiveTradingBtn = safeGetElement('stop-live-trading-btn');
        if (stopLiveTradingBtn) {
            stopLiveTradingBtn.addEventListener('click', stopTrading);
        }
        
        const emergencyStopBtn = safeGetElement('emergency-stop-btn');
        if (emergencyStopBtn) {
            emergencyStopBtn.addEventListener('click', emergencyStop);
        }
        
        const longPositionBtn = safeGetElement('long-position-btn');
        if (longPositionBtn) {
            longPositionBtn.addEventListener('click', function() {
                openManualPosition('LONG');
            });
        }
        
        const shortPositionBtn = safeGetElement('short-position-btn');
        if (shortPositionBtn) {
            shortPositionBtn.addEventListener('click', function() {
                openManualPosition('SHORT');
            });
        }
        
        const closePositionsBtn = safeGetElement('close-positions-btn');
        if (closePositionsBtn) {
            closePositionsBtn.addEventListener('click', function() {
                closeCurrentPosition('Manual Close');
            });
        }
        
        // Trading mode toggles
        const paperTradingBtn = safeGetElement('paper-trading-btn');
        if (paperTradingBtn) {
            paperTradingBtn.addEventListener('click', function() {
                switchToTradingMode('paper');
            });
        }
        
        const liveTradingBtn = safeGetElement('live-trading-btn');
        if (liveTradingBtn) {
            liveTradingBtn.addEventListener('click', function() {
                switchToTradingMode('live');
            });
        }
        
        // Settings & API buttons
        const saveSettingsBtn = safeGetElement('save-settings-btn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', saveSettings);
        }
        
        const saveGeneralSettingsBtn = safeGetElement('save-general-settings-btn');
        if (saveGeneralSettingsBtn) {
            saveGeneralSettingsBtn.addEventListener('click', saveGeneralSettings);
        }
        
        const saveAlertsBtn = safeGetElement('save-alerts-btn');
        if (saveAlertsBtn) {
            saveAlertsBtn.addEventListener('click', saveAlertSettings);
        }
        
        const configureApiLink = safeGetElement('configure-api-link');
        if (configureApiLink) {
            configureApiLink.addEventListener('click', function(e) {
                e.preventDefault();
                showAPIConfigModal();
            });
        }
        
        const configureApiBtn = safeGetElement('configure-api-btn');
        if (configureApiBtn) {
            configureApiBtn.addEventListener('click', showAPIConfigModal);
        }
        
        const testAlertBtn = safeGetElement('test-alert-btn');
        if (testAlertBtn) {
            testAlertBtn.addEventListener('click', function() {
                sendAlert('Test Alert', 'This is a test notification to check your alert settings.', 'info');
            });
        }
        
        // Chart toggle button
        const toggleChartBtn = safeGetElement('toggle-chart-btn');
        if (toggleChartBtn) {
            toggleChartBtn.addEventListener('click', toggleChartType);
        }
        
        // API config modal
        const apiConfigModal = safeGetElement('apiConfigModal');
        if (apiConfigModal) {
            const closeBtns = apiConfigModal.querySelectorAll('.close-modal, #cancel-api-config-btn');
            closeBtns.forEach(btn => {
                btn.addEventListener('click', function() {
                    apiConfigModal.style.display = 'none';
                });
            });
            
            const saveApiConfigBtn = safeGetElement('save-api-config-btn');
            if (saveApiConfigBtn) {
                saveApiConfigBtn.addEventListener('click', saveAPIConfig);
            }
        }
        
        // Live trading confirmation modal
        const liveTradingModal = safeGetElement('liveTradingConfirmModal');
        if (liveTradingModal) {
            const confirmLiveTradingCheckbox = safeGetElement('confirm-live-trading');
            const confirmLiveTradingBtn = safeGetElement('confirm-live-trading-btn');
            
            if (confirmLiveTradingCheckbox && confirmLiveTradingBtn) {
                confirmLiveTradingCheckbox.addEventListener('change', function() {
                    confirmLiveTradingBtn.disabled = !this.checked;
                });
            }
            
            if (confirmLiveTradingBtn) {
                confirmLiveTradingBtn.addEventListener('click', function() {
                    liveTradingModal.style.display = 'none';
                    startActualLiveTrading();
                });
            }
            
            const cancelLiveTradingBtn = safeGetElement('cancel-live-trading-btn');
            if (cancelLiveTradingBtn) {
                cancelLiveTradingBtn.addEventListener('click', function() {
                    liveTradingModal.style.display = 'none';
                });
            }
            
            const closeModalBtn = liveTradingModal.querySelector('.close-modal');
            if (closeModalBtn) {
                closeModalBtn.addEventListener('click', function() {
                    liveTradingModal.style.display = 'none';
                });
            }
        }
        
        // Initial capital
        const initialCapitalInput = safeGetElement('initial-capital');
        if (initialCapitalInput) {
            initialCapitalInput.addEventListener('change', function() {
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
        }
        
        // Risk management toggles
        const trailingStopToggle = safeGetElement('trailing-stop-toggle');
        const trailingStopValue = safeGetElement('trailing-stop-value');
        if (trailingStopToggle && trailingStopValue) {
            trailingStopToggle.addEventListener('change', function() {
                trailingStopValue.disabled = !this.checked;
                state.settings.trailingStop.enabled = this.checked;
            });
        }
        
        const takeProfitToggle = safeGetElement('take-profit-toggle');
        const takeProfitValue = safeGetElement('take-profit-value');
        if (takeProfitToggle && takeProfitValue) {
            takeProfitToggle.addEventListener('change', function() {
                takeProfitValue.disabled = !this.checked;
                state.settings.takeProfit.enabled = this.checked;
            });
        }
        
        const stopLossToggle = safeGetElement('stop-loss-toggle');
        const stopLossValue = safeGetElement('stop-loss-value');
        if (stopLossToggle && stopLossValue) {
            stopLossToggle.addEventListener('change', function() {
                stopLossValue.disabled = !this.checked;
                state.settings.stopLoss.enabled = this.checked;
            });
        }
        
        const riskManagementToggle = safeGetElement('risk-management-toggle');
        const maxDrawdownValue = safeGetElement('max-drawdown-value');
        const maxDailyLossValue = safeGetElement('max-daily-loss-value');
        if (riskManagementToggle && maxDrawdownValue && maxDailyLossValue) {
            riskManagementToggle.addEventListener('change', function() {
                maxDrawdownValue.disabled = !this.checked;
                maxDailyLossValue.disabled = !this.checked;
                state.settings.riskManagement.enabled = this.checked;
            });
        }
        
        // Auto trade toggle
        const autoTradeToggle = safeGetElement('auto-trade-toggle');
        if (autoTradeToggle) {
            autoTradeToggle.addEventListener('change', function() {
                state.settings.autoTrade = this.checked;
            });
        }
        
        // Alert toggles
        const browserAlertToggle = safeGetElement('browser-alert-toggle');
        if (browserAlertToggle) {
            browserAlertToggle.addEventListener('change', function() {
                state.alerts.browser.enabled = this.checked;
            });
        }
        
        const soundAlertToggle = safeGetElement('sound-alert-toggle');
        const soundVolumeInput = safeGetElement('sound-volume-input');
        if (soundAlertToggle && soundVolumeInput) {
            soundAlertToggle.addEventListener('change', function() {
                state.alerts.sound.enabled = this.checked;
                soundVolumeInput.disabled = !this.checked;
            });
            
            soundVolumeInput.addEventListener('input', function() {
                state.alerts.sound.volume = parseFloat(this.value);
            });
        }
        
        const discordAlertToggle = safeGetElement('discord-alert-toggle');
        const discordWebhookInput = safeGetElement('discord-webhook-input');
        if (discordAlertToggle && discordWebhookInput) {
            discordAlertToggle.addEventListener('change', function() {
                state.alerts.discord.enabled = this.checked;
                discordWebhookInput.disabled = !this.checked;
            });
            
            discordWebhookInput.addEventListener('input', function() {
                state.alerts.discord.webhook = this.value;
            });
        }
        
        const telegramAlertToggle = safeGetElement('telegram-alert-toggle');
        const telegramTokenInput = safeGetElement('telegram-token-input');
        const telegramChatIdInput = safeGetElement('telegram-chatid-input');
        if (telegramAlertToggle && telegramTokenInput && telegramChatIdInput) {
            telegramAlertToggle.addEventListener('change', function() {
                state.alerts.telegram.enabled = this.checked;
                telegramTokenInput.disabled = !this.checked;
                telegramChatIdInput.disabled = !this.checked;
            });
            
            telegramTokenInput.addEventListener('input', function() {
                state.alerts.telegram.botToken = this.value;
            });
            
            telegramChatIdInput.addEventListener('input', function() {
                state.alerts.telegram.chatId = this.value;
            });
        }
        
        // Initialize UI based on selected trading mode
        switchToTradingMode('paper');
        
        // Initialize settings toggles
        loadSettings();
        
        // Check if using mobile device
        checkMobileDevice();
        
        // Initial bot status
        updateBotStatus('idle', 'System initialized - Waiting for data...');
        
        // Update fee display
        if (statFeeRate) {
            statFeeRate.textContent = `${state.feeSettings.makerFee.toFixed(2)}% / ${state.feeSettings.takerFee.toFixed(2)}%`;
        }
        
        // Market symbol display
        const marketSymbol = safeGetElement('market-symbol');
        if (marketSymbol) {
            marketSymbol.textContent = state.symbol;
        }
        
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
                
                // Try to initialize TradingView if available
                if (typeof TradingView !== 'undefined') {
                    initTradingViewWidget();
                }
                
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
            
    } catch (error) {
        console.error('Error initializing UI:', error);
        addLogMessage('Error initializing UI: ' + error.message, true);
    }
}

// Add a log message
function addLogMessage(message, isError = false) {
    try {
        // Get the log element or create it if it doesn't exist yet
        const logElement = safeGetElement('logMessages');
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
    } catch (error) {
        console.error('Error adding log message:', error);
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
    const startTradingBtn = safeGetElement('start-trading-btn');
    const stopTradingBtn = safeGetElement('stop-trading-btn');
    const resetTradingBtn = safeGetElement('reset-trading-btn');
    
    if (startTradingBtn) startTradingBtn.disabled = true;
    if (stopTradingBtn) stopTradingBtn.disabled = false;
    if (resetTradingBtn) resetTradingBtn.disabled = true;
    
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
        const startLiveTradingBtn = safeGetElement('start-live-trading-btn');
        const stopLiveTradingBtn = safeGetElement('stop-live-trading-btn');
        const configureApiBtn = safeGetElement('configure-api-btn');
        const longPositionBtn = safeGetElement('long-position-btn');
        const shortPositionBtn = safeGetElement('short-position-btn');
        const closePositionsBtn = safeGetElement('close-positions-btn');
        
        if (startLiveTradingBtn) startLiveTradingBtn.disabled = false;
        if (stopLiveTradingBtn) stopLiveTradingBtn.disabled = true;
        if (configureApiBtn) configureApiBtn.disabled = false;
        if (longPositionBtn) longPositionBtn.disabled = true;
        if (shortPositionBtn) shortPositionBtn.disabled = true;
        if (closePositionsBtn) closePositionsBtn.disabled = true;
    } else {
        const startTradingBtn = safeGetElement('start-trading-btn');
        const stopTradingBtn = safeGetElement('stop-trading-btn');
        const resetTradingBtn = safeGetElement('reset-trading-btn');
        
        if (startTradingBtn) startTradingBtn.disabled = false;
        if (stopTradingBtn) stopTradingBtn.disabled = true;
        if (resetTradingBtn) resetTradingBtn.disabled = false;
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
            updatePriceChart(true);
            updateEquityChart();
            updateMetrics();
            updateTradeHistory();
            updatePositionCard();
            updateTradingStats();
            
            // Hide position card
            const positionCard = safeGetElement('position-card');
            if (positionCard) positionCard.style.display = 'none';
            
            // Show empty trade history, hide trade history container
            const emptyTradeHistory = safeGetElement('empty-trade-history');
            const tradeHistoryContainer = safeGetElement('trade-history-container');
            if (emptyTradeHistory && tradeHistoryContainer) {
                emptyTradeHistory.style.display = 'block';
                tradeHistoryContainer.style.display = 'none';
            }
            
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
    const loadingIndicator = safeGetElement('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
    }
}

// Hide loading indicator
function hideLoading() {
    const loadingIndicator = safeGetElement('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

// Show status indicator
function showStatusIndicator(message, type = 'info') {
    const statusBar = safeGetElement('status-bar');
    const statusMessage = safeGetElement('status-message');
    const statusProgress = safeGetElement('status-progress');
    
    if (statusBar && statusMessage && statusProgress) {
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
    const statusBar = safeGetElement('status-bar');
    if (statusBar) {
        statusBar.style.display = 'none';
    }
}

// Update bot status
function updateBotStatus(status, message) {
    const botStatus = safeGetElement('bot-status');
    if (botStatus) {
        // Remove existing classes
        botStatus.className = 'status-indicator';
        
        // Add new class based on status
        botStatus.classList.add(status);
        
        // Update the status text
        let emoji = '<i class="fas fa-pause-circle"></i>';
        let statusText = 'IDLE';
        
        if (status === 'active') {
            emoji = '<i class="fas fa-play-circle"></i>';
            statusText = 'ACTIVE';
        } else if (status === 'live') {
            emoji = '<i class="fas fa-bolt"></i>';
            statusText = 'LIVE';
        }
        
        botStatus.innerHTML = `${emoji} BOT ${statusText}`;
    }
    
    // Update activity status message
    const activityStatus = safeGetElement('activity-status');
    if (activityStatus) {
        activityStatus.textContent = message;
    }
}

// Update bot activity indicator
function updateBotActivity(activityType) {
    const botActivity = safeGetElement('bot-activity');
    if (botActivity) {
        // Remove existing classes
        botActivity.className = 'bot-activity';
        
        // Add new class based on activity
        botActivity.classList.add(activityType);
    }
}

// Toggle between TradingView and Plotly charts
function toggleChartType() {
    const tradingViewContainer = safeGetElement('tradingview-chart');
    const plotlyChart = safeGetElement('priceChart');
    const toggleChartBtn = safeGetElement('toggle-chart-btn');
    
    if (!tradingViewContainer || !plotlyChart) return;
    
    if (state.usingTradingView) {
        // Switch to Plotly
        tradingViewContainer.style.display = 'none';
        plotlyChart.style.display = 'block';
        state.usingTradingView = false;
        
        if (toggleChartBtn) {
            toggleChartBtn.textContent = 'Switch to TradingView';
        }
        
        // Update Plotly chart
        updatePriceChart(true);
    } else {
        // Switch to TradingView
        plotlyChart.style.display = 'none';
        tradingViewContainer.style.display = 'block';
        state.usingTradingView = true;
        
        if (toggleChartBtn) {
            toggleChartBtn.textContent = 'Switch to Basic Chart';
        }
        
        // Initialize TradingView if not already done
        if (typeof TradingView !== 'undefined' && !document.querySelector('#tradingview-chart iframe')) {
            initTradingViewWidget();
        }
    }
}

// Initialize TradingView widget with proper exchange formatting
function initTradingViewWidget() {
    try {
        const tradingViewContainer = safeGetElement('tradingview-chart');
        if (!tradingViewContainer) {
            console.error('TradingView container not found');
            return false;
        }
        
        // Clear any existing content
        tradingViewContainer.innerHTML = '';
        
        // Format symbol correctly for TradingView with exchange prefix
        // TradingView requires exchange prefix for accurate data
        const formattedSymbol = `BINANCE:${state.symbol}`;
        
        // Create a new widget with more complete configuration
        new TradingView.widget({
            "width": "100%",
            "height": 500,
            "symbol": formattedSymbol,
            "interval": state.timeframe,
            "timezone": "Etc/UTC",
            "theme": state.settings.theme === 'dark' ? "dark" : "light",
            "style": "1", // Candles
            "locale": "en",
            "toolbar_bg": "#f1f3f6",
            "enable_publishing": false,
            "allow_symbol_change": true,
            "container_id": "tradingview-chart",
            "hide_side_toolbar": false,
            "hide_top_toolbar": false,
            "withdateranges": true,
            "save_image": false,
            "hideideas": true,
            "studies": [
                {"id": "ATR", "inputs": {"length": state.atrLength}}
            ],
            "supported_resolutions": ["1", "5", "15", "30", "60", "240", "1D"],
            "show_popup_button": false,
            "popup_width": "1000",
            "popup_height": "650",
            "autosize": true
        });
        
        // Set flag to indicate we're using TradingView
        state.usingTradingView = true;
        
        // Hide the Plotly chart if using TradingView
        const plotlyChart = safeGetElement('priceChart');
        if (plotlyChart) {
            plotlyChart.style.display = 'none';
        }
        
        // Update toggle button text
        const toggleChartBtn = safeGetElement('toggle-chart-btn');
        if (toggleChartBtn) {
            toggleChartBtn.textContent = 'Switch to Basic Chart';
        }
        
        // Add debug listener to check if TradingView loaded properly
        setTimeout(() => {
            const tvIframe = document.querySelector('#tradingview-chart iframe');
            if (tvIframe) {
                addLogMessage('TradingView chart loaded successfully');
            } else {
                addLogMessage('TradingView chart failed to load, using fallback chart', true);
                // Fall back to Plotly chart if TradingView fails
                state.usingTradingView = false;
                if (plotlyChart) {
                    plotlyChart.style.display = 'block';
                }
                if (tradingViewContainer) {
                    tradingViewContainer.style.display = 'none';
                }
                if (toggleChartBtn) {
                    toggleChartBtn.textContent = 'Switch to TradingView';
                }
                // Update Plotly chart
                updatePriceChart(true);
            }
        }, 3000);
        
        return true;
    } catch (error) {
        console.error('Error initializing TradingView widget:', error);
        addLogMessage('Failed to initialize TradingView chart: ' + error.message, true);
        
        // Fall back to Plotly chart
        state.usingTradingView = false;
        const plotlyChart = safeGetElement('priceChart');
        const tradingViewContainer = safeGetElement('tradingview-chart');
        
        if (plotlyChart) plotlyChart.style.display = 'block';
        if (tradingViewContainer) tradingViewContainer.style.display = 'none';
        
        // Update toggle button text
        const toggleChartBtn = safeGetElement('toggle-chart-btn');
        if (toggleChartBtn) {
            toggleChartBtn.textContent = 'Switch to TradingView';
        }
        
        // Update Plotly chart
        updatePriceChart(true);
        
        return false;
    }
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
        
        const data = await safeApiFetch(`${url}?${params.toString()}`);
        
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
    try {
        const marketPrice = safeGetElement('market-price');
        if (marketPrice) {
            marketPrice.textContent = `$${state.botStats.marketData.price.toFixed(2)}`;
        }
        
        const marketChange = safeGetElement('market-change');
        if (marketChange && state.botStats.marketData.change24h !== 0) {
            marketChange.textContent = `${state.botStats.marketData.change24h >= 0 ? '+' : ''}${state.botStats.marketData.change24h.toFixed(2)}%`;
            marketChange.className = state.botStats.marketData.change24h >= 0 ? 'market-value up' : 'market-value down';
        }
        
        const marketVolume = safeGetElement('market-volume');
        if (marketVolume && state.botStats.marketData.volume > 0) {
            marketVolume.textContent = `$${(state.botStats.marketData.volume / 1000000).toFixed(1)}M`;
        }
    } catch (error) {
        console.error('Error updating market data:', error);
    }
}

// Update trading stats
function updateTradingStats() {
    try {
        const dailyTrades = safeGetElement('stat-daily-trades');
        if (dailyTrades) {
            dailyTrades.textContent = state.botStats.dailyTrades;
        }
        
        const dailyPnl = safeGetElement('stat-daily-pnl');
        if (dailyPnl) {
            dailyPnl.textContent = `${state.botStats.dailyPnL >= 0 ? '+' : ''}$${state.botStats.dailyPnL.toFixed(2)}`;
            dailyPnl.className = 'stat-value ' + (state.botStats.dailyPnL >= 0 ? 'positive' : 'negative');
        }
        
        const executionTime = safeGetElement('stat-execution');
        if (executionTime) {
            executionTime.textContent = `${state.botStats.executionTime}ms`;
        }
    } catch (error) {
        console.error('Error updating trading stats:', error);
    }
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
    const liveTradingModal = safeGetElement('liveTradingConfirmModal');
    if (liveTradingModal) {
        liveTradingModal.style.display = 'block';
    }
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
                    const startLiveTradingBtn = safeGetElement('start-live-trading-btn');
                    const stopLiveTradingBtn = safeGetElement('stop-live-trading-btn');
                    const emergencyStopBtn = safeGetElement('emergency-stop-btn');
                    const longPositionBtn = safeGetElement('long-position-btn');
                    const shortPositionBtn = safeGetElement('short-position-btn');
                    const closePositionsBtn = safeGetElement('close-positions-btn');
                    
                    if (startLiveTradingBtn) startLiveTradingBtn.disabled = false;
                    if (stopLiveTradingBtn) stopLiveTradingBtn.disabled = true;
                    if (emergencyStopBtn) emergencyStopBtn.disabled = false;
                    if (longPositionBtn) longPositionBtn.disabled = true;
                    if (shortPositionBtn) shortPositionBtn.disabled = true;
                    if (closePositionsBtn) closePositionsBtn.disabled = true;
                    
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
            const startTradingBtn = safeGetElement('start-trading-btn');
            const stopTradingBtn = safeGetElement('stop-trading-btn');
            const resetTradingBtn = safeGetElement('reset-trading-btn');
            
            if (startTradingBtn) startTradingBtn.disabled = false;
            if (stopTradingBtn) stopTradingBtn.disabled = true;
            if (resetTradingBtn) resetTradingBtn.disabled = false;
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
        
        // Use the appropriate API URL
        const baseUrl = state.futuresTrading.testnet ? 
            BINANCE_FUTURES_TESTNET_API_URL : 
            BINANCE_FUTURES_API_URL;
        
        const endpoint = '/fapi/v1/allOpenOrders';
        const url = `${baseUrl}${endpoint}`;
        
        // Add timestamp and signature for authenticated request
        const timestamp = Date.now();
        const queryString = `symbol=${state.symbol}&timestamp=${timestamp}`;
        
        // In a real implementation, you would create a valid signature here
        // For demo purposes, we're skipping that step
        
        const response = await fetch(`${url}?${queryString}`, {
            method: 'DELETE',
            headers: {
                'X-MBX-APIKEY': state.futuresTrading.apiKey
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        addLogMessage('All orders canceled successfully');
        return data;
    } catch (error) {
        console.error('Error canceling orders:', error);
        addLogMessage('Error canceling orders: ' + error.message, true);
        throw error;
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
        
        // First, get current positions
        const positions = await getOpenPositions();
        
        if (!positions || positions.length === 0) {
            addLogMessage('No open positions to close');
            return [];
        }
        
        // Close each position
        const closePromises = positions.map(position => {
            return closePosition(position.symbol, position.positionSide, position.positionAmt);
        });
        
        await Promise.all(closePromises);
        
        // Close local tracking of position
        if (state.currentPosition) {
            closeCurrentPosition('Emergency Close');
        }
        
        addLogMessage('All positions closed successfully');
        return positions;
    } catch (error) {
        console.error('Error closing positions:', error);
        addLogMessage('Error closing positions: ' + error.message, true);
        throw error;
    }
}

// Get open positions
async function getOpenPositions() {
    try {
        // Use the appropriate API URL
        const baseUrl = state.futuresTrading.testnet ? 
            BINANCE_FUTURES_TESTNET_API_URL : 
            BINANCE_FUTURES_API_URL;
        
        const endpoint = '/fapi/v2/positionRisk';
        const url = `${baseUrl}${endpoint}`;
        
        // Add timestamp and signature for authenticated request
        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}`;
        
        // In a real implementation, you would create a valid signature here
        // For demo purposes, we're skipping that step
        
        const response = await fetch(`${url}?${queryString}`, {
            method: 'GET',
            headers: {
                'X-MBX-APIKEY': state.futuresTrading.apiKey
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        // Filter for positions with non-zero amount
        return data.filter(p => parseFloat(p.positionAmt) !== 0);
    } catch (error) {
        console.error('Error getting open positions:', error);
        addLogMessage('Error getting positions: ' + error.message, true);
        throw error;
    }
}

// Close a specific position
async function closePosition(symbol, positionSide, positionAmt) {
    try {
        // Use the appropriate API URL
        const baseUrl = state.futuresTrading.testnet ? 
            BINANCE_FUTURES_TESTNET_API_URL : 
            BINANCE_FUTURES_API_URL;
        
        const endpoint = '/fapi/v1/order';
        const url = `${baseUrl}${endpoint}`;
        
        // Calculate the opposite side for closing
        const side = parseFloat(positionAmt) > 0 ? 'SELL' : 'BUY';
        const quantity = Math.abs(parseFloat(positionAmt));
        
        // Add parameters for the request
        const timestamp = Date.now();
        const queryString = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${quantity}&reduceOnly=true&timestamp=${timestamp}`;
        
        // In a real implementation, you would create a valid signature here
        // For demo purposes, we're skipping that step
        
        const response = await fetch(`${url}?${queryString}`, {
            method: 'POST',
            headers: {
                'X-MBX-APIKEY': state.futuresTrading.apiKey
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        addLogMessage(`Closed ${symbol} position of ${quantity} contracts`);
        return data;
    } catch (error) {
        console.error(`Error closing position for ${symbol}:`, error);
        addLogMessage(`Error closing ${symbol} position: ${error.message}`, true);
        throw error;
    }
}

// Start actual live trading after confirmation
function startActualLiveTrading() {
    // Disable form inputs
    disableFormInputs(true);
    
    // Update buttons
    const startLiveTradingBtn = safeGetElement('start-live-trading-btn');
    const stopLiveTradingBtn = safeGetElement('stop-live-trading-btn');
    const longPositionBtn = safeGetElement('long-position-btn');
    const shortPositionBtn = safeGetElement('short-position-btn');
    const closePositionsBtn = safeGetElement('close-positions-btn');
    const emergencyStopBtn = safeGetElement('emergency-stop-btn');
    
    if (startLiveTradingBtn) startLiveTradingBtn.disabled = true;
    if (stopLiveTradingBtn) stopLiveTradingBtn.disabled = false;
    if (longPositionBtn) longPositionBtn.disabled = false;
    if (shortPositionBtn) shortPositionBtn.disabled = false;
    if (closePositionsBtn) closePositionsBtn.disabled = true;
    if (emergencyStopBtn) emergencyStopBtn.disabled = false;
    
    // Start polling for futures data
    state.interval = setInterval(pollForFuturesData, state.settings.chartUpdateFrequency);
    
    // Update state
    state.isTrading = true;
    state.futuresTrading.enabled = true;
    
    // Update mode indicators
    const practiceIndicator = safeGetElement('practice-mode-indicator');
    const liveIndicator = safeGetElement('live-mode-indicator');
    
    if (practiceIndicator) practiceIndicator.style.display = 'none';
    if (liveIndicator) liveIndicator.style.display = 'flex';
    
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
        const trailingStopToggle = safeGetElement('trailing-stop-toggle');
        const trailingStopValue = safeGetElement('trailing-stop-value');
        
        const takeProfitToggle = safeGetElement('take-profit-toggle');
        const takeProfitValue = safeGetElement('take-profit-value');
        
        const stopLossToggle = safeGetElement('stop-loss-toggle');
        const stopLossValue = safeGetElement('stop-loss-value');
        
        const riskManagementToggle = safeGetElement('risk-management-toggle');
        const maxDrawdownValue = safeGetElement('max-drawdown-value');
        const maxDailyLossValue = safeGetElement('max-daily-loss-value');
        
        if (trailingStopToggle) state.settings.trailingStop.enabled = trailingStopToggle.checked;
        if (trailingStopValue) state.settings.trailingStop.percentage = parseFloat(trailingStopValue.value);
        
        if (takeProfitToggle) state.settings.takeProfit.enabled = takeProfitToggle.checked;
        if (takeProfitValue) state.settings.takeProfit.percentage = parseFloat(takeProfitValue.value);
        
        if (stopLossToggle) state.settings.stopLoss.enabled = stopLossToggle.checked;
        if (stopLossValue) state.settings.stopLoss.percentage = parseFloat(stopLossValue.value);
        
        if (riskManagementToggle) state.settings.riskManagement.enabled = riskManagementToggle.checked;
        if (maxDrawdownValue) state.settings.riskManagement.maxDrawdown = parseFloat(maxDrawdownValue.value);
        if (maxDailyLossValue) state.settings.riskManagement.maxDailyLoss = parseFloat(maxDailyLossValue.value);
        
        // Trading settings
        const autoTradeToggle = safeGetElement('auto-trade-toggle');
        if (autoTradeToggle) state.settings.autoTrade = autoTradeToggle.checked;
        
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
            }
        };
        
        localStorage.setItem('voltyBotSettings', JSON.stringify(settingsToSave));
        
        // Update UI elements for conditional fields
        if (trailingStopValue) trailingStopValue.disabled = !state.settings.trailingStop.enabled;
        if (takeProfitValue) takeProfitValue.disabled = !state.settings.takeProfit.enabled;
        if (stopLossValue) stopLossValue.disabled = !state.settings.stopLoss.enabled;
        if (maxDrawdownValue) maxDrawdownValue.disabled = !state.settings.riskManagement.enabled;
        if (maxDailyLossValue) maxDailyLossValue.disabled = !state.settings.riskManagement.enabled;
        
        // Sync settings between paper and live trading modes
        syncTradingModeSettings();
        
        // Show confirmation
        addLogMessage('Risk management settings saved successfully');
        showStatusIndicator('Settings saved', 'success');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        addLogMessage('Error saving settings: ' + error.message, true);
    }
}

// Save general settings
function saveGeneralSettings() {
    try {
        // Get settings from UI elements
        const themeSelect = safeGetElement('theme-select');
        const chartUpdateFrequency = safeGetElement('chart-update-frequency');
        const makerFeeInput = safeGetElement('maker-fee');
        const takerFeeInput = safeGetElement('taker-fee');
        
        // Update state with new values
        if (themeSelect) state.settings.theme = themeSelect.value;
        if (chartUpdateFrequency) {
            const frequencyValue = parseInt(chartUpdateFrequency.value) * 1000;
            state.settings.chartUpdateFrequency = frequencyValue;
            
            // If we're trading, update polling interval with new frequency
            if (state.isTrading && state.interval) {
                clearInterval(state.interval);
                if (state.futuresTrading.enabled) {
                    state.interval = setInterval(pollForFuturesData, frequencyValue);
                } else {
                    state.interval = setInterval(pollForNewData, frequencyValue);
                }
            }
        }
        
        // Update fee settings
        if (makerFeeInput) state.feeSettings.makerFee = parseFloat(makerFeeInput.value);
        if (takerFeeInput) state.feeSettings.takerFee = parseFloat(takerFeeInput.value);
        
        // Update fee display
        const futureMakerFee = safeGetElement('futures-maker-fee');
        const futureTakerFee = safeGetElement('futures-taker-fee');
        const statFeeRate = safeGetElement('stat-fee-rate');
        
        if (futureMakerFee) futureMakerFee.textContent = state.feeSettings.makerFee.toFixed(2) + '%';
        if (futureTakerFee) futureTakerFee.textContent = state.feeSettings.takerFee.toFixed(2) + '%';
        if (statFeeRate) statFeeRate.textContent = `${state.feeSettings.makerFee.toFixed(2)}% / ${state.feeSettings.takerFee.toFixed(2)}%`;
        
        // Save to localStorage
        const settingsToSave = {
            settings: {
                ...state.settings
            }
        };
        
        localStorage.setItem('voltyBotSettings', JSON.stringify(settingsToSave));
        
        // Save fee settings
        const feeSettingsToSave = {
            makerFee: state.feeSettings.makerFee,
            takerFee: state.feeSettings.takerFee
        };
        
        localStorage.setItem('voltyBotFeeSettings', JSON.stringify(feeSettingsToSave));
        
        // Show confirmation
        addLogMessage('General settings saved successfully');
        showStatusIndicator('Settings saved', 'success');
        
    } catch (error) {
        console.error('Error saving general settings:', error);
        addLogMessage('Error saving general settings: ' + error.message, true);
    }
}

// Save alert settings
function saveAlertSettings() {
    try {
        // Get alert settings from UI elements
        const browserAlertToggle = safeGetElement('browser-alert-toggle');
        const soundAlertToggle = safeGetElement('sound-alert-toggle');
        const soundVolumeInput = safeGetElement('sound-volume-input');
        const discordAlertToggle = safeGetElement('discord-alert-toggle');
        const discordWebhookInput = safeGetElement('discord-webhook-input');
        const telegramAlertToggle = safeGetElement('telegram-alert-toggle');
        const telegramTokenInput = safeGetElement('telegram-token-input');
        const telegramChatIdInput = safeGetElement('telegram-chatid-input');
        
        // Update state with new values
        if (browserAlertToggle) state.alerts.browser.enabled = browserAlertToggle.checked;
        
        if (soundAlertToggle) state.alerts.sound.enabled = soundAlertToggle.checked;
        if (soundVolumeInput) state.alerts.sound.volume = parseFloat(soundVolumeInput.value);
        
        if (discordAlertToggle) state.alerts.discord.enabled = discordAlertToggle.checked;
        if (discordWebhookInput) state.alerts.discord.webhook = discordWebhookInput.value;
        
        if (telegramAlertToggle) state.alerts.telegram.enabled = telegramAlertToggle.checked;
        if (telegramTokenInput) state.alerts.telegram.botToken = telegramTokenInput.value;
        if (telegramChatIdInput) state.alerts.telegram.chatId = telegramChatIdInput.value;
        
        // Save to localStorage
        const alertsToSave = {
            alerts: {
                ...state.alerts
            }
        };
        
        // Merge with existing settings
        const existingSettings = localStorage.getItem('voltyBotSettings');
        if (existingSettings) {
            const parsedSettings = JSON.parse(existingSettings);
            const mergedSettings = {
                ...parsedSettings,
                alerts: alertsToSave.alerts
            };
            localStorage.setItem('voltyBotSettings', JSON.stringify(mergedSettings));
        } else {
            localStorage.setItem('voltyBotSettings', JSON.stringify(alertsToSave));
        }
        
        // Show confirmation
        addLogMessage('Alert settings saved successfully');
        showStatusIndicator('Settings saved', 'success');
        
    } catch (error) {
        console.error('Error saving alert settings:', error);
        addLogMessage('Error saving alert settings: ' + error.message, true);
    }
}

// Sync settings between paper and live trading modes
function syncTradingModeSettings() {
    try {
        // Paper trading to live trading
        const atrLengthSlider = safeGetElement('atr-length');
        const atrMultSlider = safeGetElement('atr-mult');
        const symbolSelect = safeGetElement('symbol');
        const timeframeSelect = safeGetElement('timeframe');
        
        const liveAtrLengthSlider = safeGetElement('live-atr-length');
        const liveAtrLengthValue = safeGetElement('live-atr-length-value');
        const liveAtrMultSlider = safeGetElement('live-atr-mult');
        const liveAtrMultValue = safeGetElement('live-atr-mult-value');
        const liveSymbolSelect = safeGetElement('live-symbol');
        const liveTimeframeSelect = safeGetElement('live-timeframe');
        
        if (atrLengthSlider && liveAtrLengthSlider && liveAtrLengthValue) {
            liveAtrLengthSlider.value = atrLengthSlider.value;
            liveAtrLengthValue.textContent = atrLengthSlider.value;
        }
        
        if (atrMultSlider && liveAtrMultSlider && liveAtrMultValue) {
            liveAtrMultSlider.value = atrMultSlider.value;
            liveAtrMultValue.textContent = atrMultSlider.value;
        }
        
        if (symbolSelect && liveSymbolSelect) {
            liveSymbolSelect.value = symbolSelect.value;
        }
        
        if (timeframeSelect && liveTimeframeSelect) {
            liveTimeframeSelect.value = timeframeSelect.value;
        }
    } catch (error) {
        console.error('Error syncing trading mode settings:', error);
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
        try {
            fetch(state.alerts.discord.webhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: `**${title}**\n${message}`,
                    username: 'Volty Trading Bot'
                })
            }).catch(error => {
                console.error('Error sending Discord alert:', error);
            });
        } catch (error) {
            console.error('Error sending Discord alert:', error);
        }
    }
    
    // Telegram alerts
    if (state.alerts.telegram.enabled && state.alerts.telegram.botToken && state.alerts.telegram.chatId) {
        try {
            const telegramText = `*${title}*\n${message}`;
            const url = `https://api.telegram.org/bot${state.alerts.telegram.botToken}/sendMessage?chat_id=${state.alerts.telegram.chatId}&text=${encodeURIComponent(telegramText)}&parse_mode=Markdown`;
            
            fetch(url).catch(error => {
                console.error('Error sending Telegram alert:', error);
            });
        } catch (error) {
            console.error('Error sending Telegram alert:', error);
        }
    }
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
        
        // Fetch account information
        fetchAccountInfo();
        
        // Check if this is a new candle
        if (latestCandleTimestamp > lastDataTimestamp) {
            // Add the new candle to our data
            state.priceData.push(latestCandle);
            
            // Generate signals
            const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
            state.indicators = strategy.generateSignals(state.priceData);
            
            // Update the chart
            if (!state.usingTradingView) {
                updatePriceChart(true);
            }
            
            // Get the latest signal
            const signal = strategy.getLatestSignal(state.priceData, state.indicators);
            
            // Update bot status
            updateBotActivity('trading');
            updateBotStatus('live', `New candle detected - Signal: ${signal || 'neutral'}`);
            
            // In auto-trade mode, we process signals automatically
            if (signal && (signal === 'LONG' || signal === 'SHORT') && state.settings.autoTrade) {
                processTradeSignal(signal, latestCandle);
            } else {
                // Just notify about the signal
                if (signal) {
                    const message = `${signal} signal detected at $${latestCandle.close.toFixed(2)}`;
                    addLogMessage(message);
                    sendAlert('Trading Signal', message, 'info');
                }
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
        const lastTickInfo = safeGetElement('last-tick-info');
        if (lastTickInfo) {
            lastTickInfo.textContent = 
                `Last check: ${state.botStats.lastCheck.toLocaleTimeString()} - Execution: ${state.botStats.executionTime}ms`;
        }
        
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

// Fetch account information for futures trading
async function fetchAccountInfo() {
    if (!state.futuresTrading.enabled || !state.futuresTrading.apiKey) {
        return;
    }
    
    try {
        // Use the appropriate API URL
        const baseUrl = state.futuresTrading.testnet ? 
            BINANCE_FUTURES_TESTNET_API_URL : 
            BINANCE_FUTURES_API_URL;
        
        const endpoint = '/fapi/v2/account';
        const url = `${baseUrl}${endpoint}`;
        
        // Add timestamp and signature for authenticated request
        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}`;
        
        // In a real implementation, you would create a valid signature here
        // For demo purposes, we're skipping that step
        
        const response = await fetch(`${url}?${queryString}`, {
            method: 'GET',
            headers: {
                'X-MBX-APIKEY': state.futuresTrading.apiKey
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        // Update UI with account information
        updateAccountInfo(data);
        
    } catch (error) {
        console.error('Error fetching account info:', error);
        // Don't show this error in the log to avoid spam
    }
}

// Update account information in UI
function updateAccountInfo(accountData) {
    try {
        const availableBalance = safeGetElement('available-balance');
        const positionMarginElement = safeGetElement('position-margin');
        const unrealizedPnlElement = safeGetElement('unrealized-pnl');
        
        if (accountData && accountData.availableBalance) {
            if (availableBalance) {
                availableBalance.textContent = `${parseFloat(accountData.availableBalance).toFixed(2)} USDT`;
            }
        }
        
        // Process positions for the current symbol
        if (accountData && accountData.positions) {
            const currentPosition = accountData.positions.find(p => 
                p.symbol === state.symbol && parseFloat(p.positionAmt) !== 0
            );
            
            if (currentPosition) {
                if (positionMarginElement) {
                    positionMarginElement.textContent = `${parseFloat(currentPosition.isolatedMargin).toFixed(2)} USDT`;
                }
                
                if (unrealizedPnlElement) {
                    const unrealizedPnl = parseFloat(currentPosition.unrealizedProfit);
                    unrealizedPnlElement.textContent = `${unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)} USDT`;
                    unrealizedPnlElement.className = 'stat-value ' + (unrealizedPnl >= 0 ? 'positive' : 'negative');
                }
            } else {
                if (positionMarginElement) positionMarginElement.textContent = '0.00 USDT';
                if (unrealizedPnlElement) {
                    unrealizedPnlElement.textContent = '0.00 USDT';
                    unrealizedPnlElement.className = 'stat-value';
                }
            }
        }
    } catch (error) {
        console.error('Error updating account info:', error);
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
        
        const data = await safeApiFetch(`${url}?${params.toString()}`);
        
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

// Poll for new data (paper trading)
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
            if (!state.usingTradingView) {
                updatePriceChart(true);
            }
            
            // Get the latest signal
            const signal = strategy.getLatestSignal(state.priceData, state.indicators);
            
            // Update bot status
            updateBotActivity('trading');
            updateBotStatus('active', `New candle detected - Processing ${signal || 'neutral'} signal`);
            
            // Process the signal
            if (signal && (signal === 'LONG' || signal === 'SHORT') && state.settings.autoTrade) {
                processTradeSignal(signal, latestCandle);
            } else if (signal) {
                // Just notify about the signal
                const message = `${signal} signal detected at $${latestCandle.close.toFixed(2)} (Auto-trading disabled)`;
                addLogMessage(message);
                sendAlert('Trading Signal', message, 'info');
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
        const lastTickInfo = safeGetElement('last-tick-info');
        if (lastTickInfo) {
            lastTickInfo.textContent = 
                `Last check: ${state.botStats.lastCheck.toLocaleTimeString()} - Execution: ${state.botStats.executionTime}ms`;
        }
        
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
    const modal = safeGetElement('apiConfigModal');
    
    if (modal) {
        // Fill in saved values if any
        const apiKeyInput = safeGetElement('api-key');
        const apiSecretInput = safeGetElement('api-secret');
        const testnetToggle = safeGetElement('testnet-toggle');
        
        if (apiKeyInput) apiKeyInput.value = state.futuresTrading.apiKey || '';
        if (apiSecretInput) apiSecretInput.value = state.futuresTrading.apiSecret ? '********' : '';
        if (testnetToggle) testnetToggle.checked = state.futuresTrading.testnet;
        
        modal.style.display = 'block';
    }
}

// Save API configuration
function saveAPIConfig() {
    const apiKeyInput = safeGetElement('api-key');
    const apiSecretInput = safeGetElement('api-secret');
    const testnetToggle = safeGetElement('testnet-toggle');
    
    // Validate
    if (!apiKeyInput || apiKeyInput.value.trim() === '') {
        addLogMessage('API key is required', true);
        return;
    }
    
    const apiKey = apiKeyInput.value.trim();
    const apiSecret = apiSecretInput ? apiSecretInput.value : '';
    const useTestnet = testnetToggle ? testnetToggle.checked : true;
    
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
    const apiConfigModal = safeGetElement('apiConfigModal');
    if (apiConfigModal) apiConfigModal.style.display = 'none';
}

// Switch trading mode
function switchToTradingMode(mode) {
    if (state.isTrading) {
        addLogMessage('Please stop trading before switching modes', true);
        return;
    }
    
    // Get UI elements
    const paperTradingBtn = safeGetElement('paper-trading-btn');
    const liveTradingBtn = safeGetElement('live-trading-btn');
    const paperTradingSettings = safeGetElement('paper-trading-settings');
    const liveTradingSettings = safeGetElement('live-trading-settings');
    const paperTradingButtons = safeGetElement('paper-trading-buttons');
    const liveTradingButtons = safeGetElement('live-trading-buttons');
    const accountBalanceSection = safeGetElement('account-balance-section');
    const feeInformation = safeGetElement('fee-information');
    const practiceIndicator = safeGetElement('practice-mode-indicator');
    const liveIndicator = safeGetElement('live-mode-indicator');
    
    if (mode === 'paper') {
        // Switch to paper trading mode
        state.futuresTrading.enabled = false;
        
        // Update UI
        if (paperTradingBtn) paperTradingBtn.classList.add('active');
        if (liveTradingBtn) liveTradingBtn.classList.remove('active');
        
        if (paperTradingSettings) paperTradingSettings.style.display = 'block';
        if (liveTradingSettings) liveTradingSettings.style.display = 'none';
        
        if (paperTradingButtons) paperTradingButtons.style.display = 'block';
        if (liveTradingButtons) liveTradingButtons.style.display = 'none';
        
        if (accountBalanceSection) accountBalanceSection.style.display = 'none';
        if (feeInformation) feeInformation.style.display = 'none';
        
        if (practiceIndicator) practiceIndicator.style.display = 'flex';
        if (liveIndicator) liveIndicator.style.display = 'none';
        
        addLogMessage('Switched to paper trading mode');
    } else {
        // Switch to futures trading mode
        state.futuresTrading.enabled = true;
        
        // Update UI
        if (liveTradingBtn) liveTradingBtn.classList.add('active');
        if (paperTradingBtn) paperTradingBtn.classList.remove('active');
        
        if (paperTradingSettings) paperTradingSettings.style.display = 'none';
        if (liveTradingSettings) liveTradingSettings.style.display = 'block';
        
        if (paperTradingButtons) paperTradingButtons.style.display = 'none';
        if (liveTradingButtons) liveTradingButtons.style.display = 'block';
        
        if (accountBalanceSection) accountBalanceSection.style.display = 'block';
        if (feeInformation) feeInformation.style.display = 'block';
        
        if (practiceIndicator) practiceIndicator.style.display = 'none';
        if (liveIndicator) liveIndicator.style.display = 'flex';
        
        addLogMessage('Switched to futures trading mode');
    }
}

// Load settings and initialize form fields
function loadSettings() {
    try {
        // Load settings from localStorage
        loadSettingsFromLocalStorage();
        
        // Risk management
        const trailingStopToggle = safeGetElement('trailing-stop-toggle');
        const trailingStopValue = safeGetElement('trailing-stop-value');
        if (trailingStopToggle && trailingStopValue) {
            trailingStopToggle.checked = state.settings.trailingStop.enabled;
            trailingStopValue.value = state.settings.trailingStop.percentage;
            trailingStopValue.disabled = !state.settings.trailingStop.enabled;
        }
        
        const takeProfitToggle = safeGetElement('take-profit-toggle');
        const takeProfitValue = safeGetElement('take-profit-value');
        if (takeProfitToggle && takeProfitValue) {
            takeProfitToggle.checked = state.settings.takeProfit.enabled;
            takeProfitValue.value = state.settings.takeProfit.percentage;
            takeProfitValue.disabled = !state.settings.takeProfit.enabled;
        }
        
        const stopLossToggle = safeGetElement('stop-loss-toggle');
        const stopLossValue = safeGetElement('stop-loss-value');
        if (stopLossToggle && stopLossValue) {
            stopLossToggle.checked = state.settings.stopLoss.enabled;
            stopLossValue.value = state.settings.stopLoss.percentage;
            stopLossValue.disabled = !state.settings.stopLoss.enabled;
        }
        
        const riskManagementToggle = safeGetElement('risk-management-toggle');
        const maxDrawdownValue = safeGetElement('max-drawdown-value');
        const maxDailyLossValue = safeGetElement('max-daily-loss-value');
        if (riskManagementToggle && maxDrawdownValue && maxDailyLossValue) {
            riskManagementToggle.checked = state.settings.riskManagement.enabled;
            maxDrawdownValue.value = state.settings.riskManagement.maxDrawdown;
            maxDrawdownValue.disabled = !state.settings.riskManagement.enabled;
            maxDailyLossValue.value = state.settings.riskManagement.maxDailyLoss;
            maxDailyLossValue.disabled = !state.settings.riskManagement.enabled;
        }
        
        // Auto-trade toggle
        const autoTradeToggle = safeGetElement('auto-trade-toggle');
        if (autoTradeToggle) {
            autoTradeToggle.checked = state.settings.autoTrade;
        }
        
        // Alert settings
        const browserAlertToggle = safeGetElement('browser-alert-toggle');
        if (browserAlertToggle) {
            browserAlertToggle.checked = state.alerts.browser.enabled;
        }
        
        const soundAlertToggle = safeGetElement('sound-alert-toggle');
        const soundVolumeInput = safeGetElement('sound-volume-input');
        if (soundAlertToggle && soundVolumeInput) {
            soundAlertToggle.checked = state.alerts.sound.enabled;
            soundVolumeInput.value = state.alerts.sound.volume;
            soundVolumeInput.disabled = !state.alerts.sound.enabled;
        }
        
        const discordAlertToggle = safeGetElement('discord-alert-toggle');
        const discordWebhookInput = safeGetElement('discord-webhook-input');
        if (discordAlertToggle && discordWebhookInput) {
            discordAlertToggle.checked = state.alerts.discord.enabled;
            discordWebhookInput.value = state.alerts.discord.webhook;
            discordWebhookInput.disabled = !state.alerts.discord.enabled;
        }
        
        const telegramAlertToggle = safeGetElement('telegram-alert-toggle');
        const telegramTokenInput = safeGetElement('telegram-token-input');
        const telegramChatIdInput = safeGetElement('telegram-chatid-input');
        if (telegramAlertToggle && telegramTokenInput && telegramChatIdInput) {
            telegramAlertToggle.checked = state.alerts.telegram.enabled;
            telegramTokenInput.value = state.alerts.telegram.botToken;
            telegramTokenInput.disabled = !state.alerts.telegram.enabled;
            telegramChatIdInput.value = state.alerts.telegram.chatId;
            telegramChatIdInput.disabled = !state.alerts.telegram.enabled;
        }
        
        // Fee settings
        const makerFeeInput = safeGetElement('maker-fee');
        const takerFeeInput = safeGetElement('taker-fee');
        const futureMakerFee = safeGetElement('futures-maker-fee');
        const futureTakerFee = safeGetElement('futures-taker-fee');
        
        if (makerFeeInput) makerFeeInput.value = state.feeSettings.makerFee;
        if (takerFeeInput) takerFeeInput.value = state.feeSettings.takerFee;
        if (futureMakerFee) futureMakerFee.textContent = state.feeSettings.makerFee.toFixed(2) + '%';
        if (futureTakerFee) futureTakerFee.textContent = state.feeSettings.takerFee.toFixed(2) + '%';
        
        // General settings
        const themeSelect = safeGetElement('theme-select');
        if (themeSelect) {
            themeSelect.value = state.settings.theme;
        }
        
        const chartUpdateFrequency = safeGetElement('chart-update-frequency');
        if (chartUpdateFrequency) {
            chartUpdateFrequency.value = state.settings.chartUpdateFrequency / 1000;
        }
        
    } catch (error) {
        console.error('Error loading settings:', error);
        addLogMessage('Error loading settings: ' + error.message, true);
    }
}

// Load settings from localStorage
function loadSettingsFromLocalStorage() {
    try {
        // Load general settings
        const savedSettings = localStorage.getItem('voltyBotSettings');
        if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            if (parsedSettings.settings) {
                state.settings = { ...state.settings, ...parsedSettings.settings };
            }
            if (parsedSettings.alerts) {
                state.alerts = { ...state.alerts, ...parsedSettings.alerts };
            }
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
            if (parsedConfig.limits) {
                state.futuresTrading.limits = { ...state.futuresTrading.limits, ...parsedConfig.limits };
            }
        }
    } catch (error) {
        console.error('Error loading settings from localStorage:', error);
        addLogMessage('Error loading saved settings');
    }
}

// Check if using mobile device
function checkMobileDevice() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const mobileInfo = safeGetElement('mobile-info');
    if (isMobile && mobileInfo) {
        mobileInfo.style.display = 'block';
    }
}

// Disable or enable form inputs
function disableFormInputs(disabled) {
    try {
        const formInputs = [
            'symbol', 'timeframe', 'atr-length', 'atr-mult', 
            'maker-fee', 'taker-fee', 'live-symbol', 'live-timeframe',
            'live-atr-length', 'live-atr-mult', 'live-position-size',
            'leverage-select', 'margin-type-select', 'initial-capital',
            'position-size'
        ];
        
        formInputs.forEach(id => {
            const element = safeGetElement(id);
            if (element) element.disabled = disabled;
        });
    } catch (error) {
        console.error('Error disabling form inputs:', error);
    }
}

// Initialize charts
function initCharts() {
    try {
        // Initialize price chart
        const priceChartDiv = safeGetElement('priceChart');
        if (!priceChartDiv) {
            throw new Error('Price chart element not found');
        }
        
        // Generate signals
        const strategy = new VoltyStrategy(state.atrLength, state.atrMultiplier);
        state.indicators = strategy.generateSignals(state.priceData);
        
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
        
        // Determine the range for x-axis (for autoscrolling)
        const visibleCandles = 100;
        const startIndex = Math.max(0, state.priceData.length - visibleCandles);
        const xaxisRange = [
            state.priceData[startIndex].datetime,
            // Add a little buffer to the right
            new Date(state.priceData[state.priceData.length - 1].datetime.getTime() + getTimeframeInMs(state.timeframe) * 0.1)
        ];
        
        // Set up layout
        const layout = {
            title: `${state.symbol} ${state.timeframe} Chart`,
            dragmode: 'zoom',
            margin: { l: 50, r: 50, b: 50, t: 50, pad: 4 },
            grid: { rows: 2, columns: 1, pattern: 'independent', roworder: 'bottom to top' },
            xaxis: {
                rangeslider: { visible: false },
                type: 'date',
                showgrid: false,
                range: xaxisRange
            },
            yaxis: {
                autorange: true,
                domain: [0.2, 1],
                type: 'linear',
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
        
        // Create the chart with candlestick and volume traces first
        Plotly.newPlot(priceChartDiv, [candleTrace, volumeTrace], layout, {
            displayModeBar: true,
            responsive: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d', 'toggleSpikelines']
        });
        
        // Add signal traces after chart is created
        updatePriceChart(true);
        
        state.charts.price = true;
        
        // Initialize equity chart
        const equityChartDiv = safeGetElement('equityChart');
        if (equityChartDiv) {
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
                },
                fill: 'tozeroy',
                fillcolor: 'rgba(79, 70, 229, 0.1)'
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
                    type: 'linear', // Use linear scale for clearer representation
                    gridcolor: 'rgba(255,255,255,0.1)'
                },
                plot_bgcolor: 'rgba(0, 0, 0, 0)',
                paper_bgcolor: 'rgba(0, 0, 0, 0)',
                font: {
                    color: '#d1d5db'
                },
                showlegend: false,
                height: 300,
                width: equityChartDiv.offsetWidth
            };
            
            // Create the equity chart
            Plotly.newPlot(equityChartDiv, [equityTrace], equityLayout, {
                displayModeBar: true,
                responsive: true,
                displaylogo: false,
                modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d', 'toggleSpikelines']
            });
            
            state.charts.equity = true;
        }
        
    } catch (error) {
        console.error('Error creating charts with Plotly:', error);
        addLogMessage('Failed to create charts: ' + error.message, true);
    }
}

// Update price chart with new data and indicators
function updatePriceChart(autoscroll = true) {
    try {
        const priceChartDiv = safeGetElement('priceChart');
        if (!priceChartDiv) {
            console.error('Price chart element not found');
            return;
        }
        
        // Clear any existing data
        Plotly.purge(priceChartDiv);
        
        // Create fresh candlestick trace
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
        
        // Create signal traces (only for direction changes)
        const dataTraces = [candleTrace, volumeTrace];
        
        if (state.indicators && state.indicators.longSignal && state.indicators.shortSignal) {
            // Create arrays to store direction change points
            const longChangePoints = {
                x: [],
                y: []
            };
            
            const shortChangePoints = {
                x: [],
                y: []
            };
            
            // Track the previous signal state
            let prevSignalState = null; // 'LONG', 'SHORT', or null
            
            // Find direction changes
            for (let i = 0; i < state.priceData.length; i++) {
                // Determine current signal
                let currentSignal = null;
                if (state.indicators.longSignal[i] !== null) {
                    currentSignal = 'LONG';
                } else if (state.indicators.shortSignal[i] !== null) {
                    currentSignal = 'SHORT';
                }
                
                // Check if direction changed
                if (currentSignal !== null && currentSignal !== prevSignalState) {
                    // Direction changed - add a marker
                    if (currentSignal === 'LONG') {
                        longChangePoints.x.push(state.priceData[i].datetime);
                        longChangePoints.y.push(state.priceData[i].low - (state.priceData[i].high - state.priceData[i].low) * 0.3);
                    } else if (currentSignal === 'SHORT') {
                        shortChangePoints.x.push(state.priceData[i].datetime);
                        shortChangePoints.y.push(state.priceData[i].high + (state.priceData[i].high - state.priceData[i].low) * 0.3);
                    }
                    
                    // Update previous state
                    prevSignalState = currentSignal;
                }
            }
            
            // Create traces for direction changes
            if (longChangePoints.x.length > 0) {
                const longSignalTrace = {
                    x: longChangePoints.x,
                    y: longChangePoints.y,
                    type: 'scatter',
                    mode: 'markers',
                    name: 'Long Signal',
                    marker: {
                        symbol: 'triangle-up',
                        size: 12,
                        color: 'rgba(74, 222, 128, 1)',
                        line: { width: 2, color: 'white' }
                    }
                };
                dataTraces.push(longSignalTrace);
            }
            
            if (shortChangePoints.x.length > 0) {
                const shortSignalTrace = {
                    x: shortChangePoints.x,
                    y: shortChangePoints.y,
                    type: 'scatter',
                    mode: 'markers',
                    name: 'Short Signal',
                    marker: {
                        symbol: 'triangle-down',
                        size: 12,
                        color: 'rgba(248, 113, 113, 1)',
                        line: { width: 2, color: 'white' }
                    }
                };
                dataTraces.push(shortSignalTrace);
            }
        }
        
        // Add trade markers (only when direction changes)
        if (state.trades && state.trades.length > 0) {
            // Track the previous trade type
            let prevTradeType = null;
            const tradeChangePoints = {
                long: { x: [], y: [] },
                short: { x: [], y: [] }
            };
            
            // Sort trades by entry time
            const sortedTrades = [...state.trades].sort((a, b) => a.entryTime - b.entryTime);
            
            // Find direction changes in trades
            for (const trade of sortedTrades) {
                if (trade.type !== prevTradeType) {
                    // Find the candle for this entry time
                    const candle = state.priceData.find(d => 
                        d.datetime.getTime() <= trade.entryTime.getTime() && 
                        d.datetime.getTime() + getTimeframeInMs(state.timeframe) > trade.entryTime.getTime()
                    );
                    
                    if (candle) {
                        if (trade.type === 'LONG') {
                            tradeChangePoints.long.x.push(trade.entryTime);
                            tradeChangePoints.long.y.push(candle.low - (candle.high - candle.low) * 0.5);
                        } else {
                            tradeChangePoints.short.x.push(trade.entryTime);
                            tradeChangePoints.short.y.push(candle.high + (candle.high - candle.low) * 0.5);
                        }
                    }
                    
                    // Update previous type
                    prevTradeType = trade.type;
                }
            }
            
            // Create traces for trade direction changes
            if (tradeChangePoints.long.x.length > 0) {
                const longTradeTrace = {
                    x: tradeChangePoints.long.x,
                    y: tradeChangePoints.long.y,
                    mode: 'markers',
                    type: 'scatter',
                    marker: {
                        symbol: 'triangle-up',
                        size: 16,
                        color: OHLC_COLORS.up,
                        line: { width: 2, color: 'white' }
                    },
                    name: 'Long Entries'
                };
                dataTraces.push(longTradeTrace);
            }
            
            if (tradeChangePoints.short.x.length > 0) {
                const shortTradeTrace = {
                    x: tradeChangePoints.short.x,
                    y: tradeChangePoints.short.y,
                    mode: 'markers',
                    type: 'scatter',
                    marker: {
                        symbol: 'triangle-down',
                        size: 16,
                        color: OHLC_COLORS.down,
                        line: { width: 2, color: 'white' }
                    },
                    name: 'Short Entries'
                };
                dataTraces.push(shortTradeTrace);
            }
        }
        
        // Determine the range for x-axis (for autoscrolling)
        let xaxisRange = [];
        if (autoscroll) {
            // Show the last N candles (adjust as needed)
            const visibleCandles = 100;
            const startIndex = Math.max(0, state.priceData.length - visibleCandles);
            xaxisRange = [
                state.priceData[startIndex].datetime,
                // Add a little buffer to the right
                new Date(state.priceData[state.priceData.length - 1].datetime.getTime() + getTimeframeInMs(state.timeframe) * 0.1)
            ];
        }
        
        // Set up layout
        const layout = {
            title: `${state.symbol} ${state.timeframe} Chart`,
            dragmode: 'zoom',
            margin: { l: 50, r: 50, b: 50, t: 50, pad: 4 },
            grid: { rows: 2, columns: 1, pattern: 'independent', roworder: 'bottom to top' },
            xaxis: {
                rangeslider: { visible: false },
                type: 'date',
                showgrid: false,
                range: xaxisRange.length ? xaxisRange : undefined
            },
            yaxis: {
                autorange: true,
                domain: [0.2, 1],
                type: 'linear',
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
        
        // Create the chart from scratch
        Plotly.newPlot(priceChartDiv, dataTraces, layout, {
            displayModeBar: true,
            responsive: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d', 'toggleSpikelines']
        });
        
        state.charts.price = true;
        
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
        
        // Use linear scale for better visualization
        Plotly.relayout(equityChartDiv, {
            yaxis: {
                type: 'linear',
                autorange: true
            },
            height: 300,
            width: equityChartDiv.offsetWidth
        });
        
        // Update metrics
        updateMetrics();
    } catch (error) {
        console.error('Error updating equity chart:', error);
        addLogMessage('Error updating equity chart: ' + error.message, true);
    }
}

// Process trade signal
function processTradeSignal(signal, candle) {
    // Check if auto-trading is enabled
    if (!state.settings.autoTrade) {
        addLogMessage(`Signal: ${signal} detected, but auto-trading is disabled`);
        return;
    }
    
    // Check if we already have a position
    if (state.currentPosition) {
        // If we have a position in the opposite direction, close it and open a new one
        if (state.currentPosition.type !== signal) {
            addLogMessage(`Closing ${state.currentPosition.type} position to reverse to ${signal}`);
            closeCurrentPosition('Signal Reverse');
            openPosition(signal, candle);
        } else {
            addLogMessage(`${signal} signal confirmed, already in position`);
        }
    } else {
        // Open new position
        openPosition(signal, candle);
    }
}

// Open a position
function openPosition(type, candle) {
    // Calculate position size based on percentage of capital
    const positionSize = (state.currentCapital * state.positionSize) / 100;
    const entryPrice = candle.close;
    
    // Create new trade
    state.currentPosition = new Trade(
        candle.datetime,
        type,
        entryPrice,
        positionSize / entryPrice
    );
    
    // Calculate risk levels
    updatePositionRiskLevels();
    
    // Update UI
    updatePositionCard();
    const positionCard = safeGetElement('position-card');
    if (positionCard) positionCard.style.display = 'block';
    
    const closePositionsBtn = safeGetElement('close-positions-btn');
    if (closePositionsBtn && state.futuresTrading.enabled) {
        closePositionsBtn.disabled = false;
    }
    
    // Show/hide empty trade history message
    const emptyTradeHistory = safeGetElement('empty-trade-history');
    const tradeHistoryContainer = safeGetElement('trade-history-container');
    if (emptyTradeHistory && tradeHistoryContainer) {
        emptyTradeHistory.style.display = 'none';
        tradeHistoryContainer.style.display = 'block';
    }
    
    // Send alert
    sendAlert(
        `New ${type} Position Opened`,
        `Opened ${type} position at $${entryPrice.toFixed(2)} with size ${positionSize.toFixed(2)} USDT`,
        'success'
    );
    
    // Log the new position
    addLogMessage(`Opened ${type} position at $${entryPrice.toFixed(2)} with size ${positionSize.toFixed(2)} USDT`);
    
    // Increment daily trades counter
    state.botStats.dailyTrades++;
}

// Open manual position (from UI)
function openManualPosition(type) {
    if (!state.isTrading) {
        addLogMessage('Cannot open position: Trading is not active', true);
        return;
    }
    
    if (state.currentPosition) {
        addLogMessage('Cannot open position: Already have an active position', true);
        return;
    }
    
    // Get current candle
    const currentCandle = state.priceData[state.priceData.length - 1];
    
    // Open position
    openPosition(type, currentCandle);
}

// Close current position
function closeCurrentPosition(reason) {
    if (!state.currentPosition) {
        addLogMessage('No position to close', true);
        return;
    }
    
    // Get current candle
    const currentCandle = state.priceData[state.priceData.length - 1];
    const exitPrice = currentCandle.close;
    
    // Close the position and calculate P&L
    const pnl = state.currentPosition.close(currentCandle.datetime, exitPrice);
    
    // Update capital
    state.currentCapital += pnl;
    
    // Add to equity curve
    state.equityCurve.push({
        time: new Date(),
        value: state.currentCapital
    });
    
    // Add to trades history
    state.trades.push(state.currentPosition);
    
    // Update daily P&L
    state.botStats.dailyPnL += pnl;
    
    // Send alert
    const pnlPct = state.currentPosition.pnlPct * 100;
    const pnlText = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`;
    
    sendAlert(
        `Position Closed: ${reason}`,
        `Closed ${state.currentPosition.type} position at $${exitPrice.toFixed(2)} with P&L: ${pnlText}`,
        pnl >= 0 ? 'success' : 'warning'
    );
    
    // Log the closure
    addLogMessage(`Closed ${state.currentPosition.type} position at $${exitPrice.toFixed(2)} with P&L: ${pnlText} (${reason})`);
    
    // Clear current position
    state.currentPosition = null;
    
    // Update UI
    updatePositionCard();
    const positionCard = safeGetElement('position-card');
    if (positionCard) positionCard.style.display = 'none';
    
    const closePositionsBtn = safeGetElement('close-positions-btn');
    if (closePositionsBtn) closePositionsBtn.disabled = true;
    
    // Update metrics and charts
    updateMetrics();
    updateEquityChart();
    updateTradeHistory();
}

// Check position exit conditions
function checkPositionExitConditions() {
    if (!state.currentPosition) return;
    
    const currentPrice = state.currentPrice;
    const entryPrice = state.currentPosition.entryPrice;
    const positionType = state.currentPosition.type;
    
    // Calculate profit/loss percentage
    let pnlPct;
    if (positionType === 'LONG') {
        pnlPct = (currentPrice - entryPrice) / entryPrice * 100;
    } else {
        pnlPct = (entryPrice - currentPrice) / entryPrice * 100;
    }
    
    // Check take profit
    if (state.settings.takeProfit.enabled && pnlPct >= state.settings.takeProfit.percentage) {
        closeCurrentPosition('Take Profit');
        return;
    }
    
    // Check stop loss
    if (state.settings.stopLoss.enabled && pnlPct <= -state.settings.stopLoss.percentage) {
        closeCurrentPosition('Stop Loss');
        return;
    }
    
    // Check trailing stop
    if (state.settings.trailingStop.enabled && state.botStats.positionDetails.trailingStopPrice > 0) {
        if (positionType === 'LONG' && currentPrice <= state.botStats.positionDetails.trailingStopPrice) {
            closeCurrentPosition('Trailing Stop');
            return;
        } else if (positionType === 'SHORT' && currentPrice >= state.botStats.positionDetails.trailingStopPrice) {
            closeCurrentPosition('Trailing Stop');
            return;
        }
        
        // Update trailing stop level if price moves in favorable direction
        if (positionType === 'LONG' && currentPrice > state.botStats.positionDetails.trailingStopPrice + (entryPrice * state.settings.trailingStop.percentage / 100)) {
            // New trailing stop level = current price - trailing stop distance
            state.botStats.positionDetails.trailingStopPrice = currentPrice - (entryPrice * state.settings.trailingStop.percentage / 100);
            updatePositionCard();
        } else if (positionType === 'SHORT' && currentPrice < state.botStats.positionDetails.trailingStopPrice - (entryPrice * state.settings.trailingStop.percentage / 100)) {
            // New trailing stop level = current price + trailing stop distance
            state.botStats.positionDetails.trailingStopPrice = currentPrice + (entryPrice * state.settings.trailingStop.percentage / 100);
            updatePositionCard();
        }
    }
}

// Update position risk levels
function updatePositionRiskLevels() {
    if (!state.currentPosition) return;
    
    const entryPrice = state.currentPosition.entryPrice;
    const positionType = state.currentPosition.type;
    
    // Calculate take profit price
    if (state.settings.takeProfit.enabled) {
        const tpPct = state.settings.takeProfit.percentage / 100;
        state.botStats.positionDetails.takeProfitPrice = positionType === 'LONG' 
            ? entryPrice * (1 + tpPct) 
            : entryPrice * (1 - tpPct);
    } else {
        state.botStats.positionDetails.takeProfitPrice = 0;
    }
    
    // Calculate stop loss price
    if (state.settings.stopLoss.enabled) {
        const slPct = state.settings.stopLoss.percentage / 100;
        state.botStats.positionDetails.stopLossPrice = positionType === 'LONG' 
            ? entryPrice * (1 - slPct) 
            : entryPrice * (1 + slPct);
    } else {
        state.botStats.positionDetails.stopLossPrice = 0;
    }
    
    // Initialize trailing stop price
    if (state.settings.trailingStop.enabled) {
        const tsPct = state.settings.trailingStop.percentage / 100;
        state.botStats.positionDetails.trailingStopPrice = positionType === 'LONG' 
            ? entryPrice * (1 - tsPct) 
            : entryPrice * (1 + tsPct);
    } else {
        state.botStats.positionDetails.trailingStopPrice = 0;
    }
    
    // Store entry time
    state.botStats.positionDetails.entryTime = state.currentPosition.entryTime;
}

// Update position card
function updatePositionCard() {
    try {
        if (!state.currentPosition) {
            const positionCard = safeGetElement('position-card');
            if (positionCard) positionCard.style.display = 'none';
            return;
        }
        
        const positionCard = safeGetElement('position-card');
        if (positionCard) positionCard.style.display = 'block';
        
        // Set position type
        const positionType = safeGetElement('position-type');
        if (positionType) {
            positionType.textContent = state.currentPosition.type;
            positionType.className = 'metric-value ' + (state.currentPosition.type === 'LONG' ? 'positive' : 'negative');
        }
        
        // Set entry price
        const positionEntryPrice = safeGetElement('position-entry-price');
        if (positionEntryPrice) {
            positionEntryPrice.textContent = `$${state.currentPosition.entryPrice.toFixed(2)}`;
        }
        
        // Set current price
        const positionCurrentPrice = safeGetElement('position-current-price');
        if (positionCurrentPrice) {
            positionCurrentPrice.textContent = `$${state.currentPrice.toFixed(2)}`;
        }
        
        // Calculate and set P&L
        const unrealizedPnl = state.currentPosition.getUnrealizedPnl(state.currentPrice);
        const unrealizedPnlPct = state.currentPosition.getUnrealizedPnlPct(state.currentPrice) * 100;
        
        const pnlElement = safeGetElement('position-pnl');
        if (pnlElement) {
            pnlElement.textContent = `${unrealizedPnl >= 0 ? '+' : ''}$${unrealizedPnl.toFixed(2)} (${unrealizedPnlPct >= 0 ? '+' : ''}${unrealizedPnlPct.toFixed(2)}%)`;
            pnlElement.className = 'metric-value ' + (unrealizedPnl >= 0 ? 'positive' : 'negative');
        }
        
        // Set entry time
        const positionEntryTime = safeGetElement('position-entry-time');
        if (positionEntryTime) {
            positionEntryTime.textContent = state.currentPosition.entryTime.toLocaleTimeString();
        }
        
        // Set position size
        const positionSizeInfo = safeGetElement('position-size-info');
        if (positionSizeInfo) {
            positionSizeInfo.textContent = `${state.currentPosition.size.toFixed(6)} (≈$${(state.currentPosition.size * state.currentPosition.entryPrice).toFixed(2)})`;
        }
        
        // Set risk levels
        const positionTp = safeGetElement('position-tp');
        if (positionTp) {
            if (state.settings.takeProfit.enabled && state.botStats.positionDetails.takeProfitPrice) {
                positionTp.textContent = `$${state.botStats.positionDetails.takeProfitPrice.toFixed(2)}`;
            } else {
                positionTp.textContent = 'Not Set';
            }
        }
        
        const positionSl = safeGetElement('position-sl');
        if (positionSl) {
            if (state.settings.stopLoss.enabled && state.botStats.positionDetails.stopLossPrice) {
                positionSl.textContent = `$${state.botStats.positionDetails.stopLossPrice.toFixed(2)}`;
            } else {
                positionSl.textContent = 'Not Set';
            }
        }
        
        const positionTs = safeGetElement('position-ts');
        if (positionTs) {
            if (state.settings.trailingStop.enabled && state.botStats.positionDetails.trailingStopPrice) {
                positionTs.textContent = `$${state.botStats.positionDetails.trailingStopPrice.toFixed(2)}`;
            } else {
                positionTs.textContent = 'Not Set';
            }
        }
    } catch (error) {
        console.error('Error updating position card:', error);
    }
}

// Update trade history
function updateTradeHistory() {
    try {
        const tradeTableBody = safeGetElement('trade-history-body');
        if (!tradeTableBody) return;
        
        // Clear existing rows
        tradeTableBody.innerHTML = '';
        
        if (state.trades.length === 0) {
            const emptyTradeHistory = safeGetElement('empty-trade-history');
            const tradeHistoryContainer = safeGetElement('trade-history-container');
            
            if (emptyTradeHistory) emptyTradeHistory.style.display = 'block';
            if (tradeHistoryContainer) tradeHistoryContainer.style.display = 'none';
            return;
        }
        
        // Show trade history container, hide empty state
        const emptyTradeHistory = safeGetElement('empty-trade-history');
        const tradeHistoryContainer = safeGetElement('trade-history-container');
        
        if (emptyTradeHistory) emptyTradeHistory.style.display = 'none';
        if (tradeHistoryContainer) tradeHistoryContainer.style.display = 'block';
        
        // Create rows for each trade (most recent first)
        const sortedTrades = [...state.trades].reverse();
        
        sortedTrades.forEach(trade => {
            const row = document.createElement('tr');
            row.className = trade.type === 'LONG' ? 'trade-long' : 'trade-short';
            
            // Add trade data
            row.innerHTML = `
                <td>${trade.entryTime.toLocaleString()}</td>
                <td>${trade.type}</td>
                <td>$${trade.entryPrice.toFixed(2)}</td>
                <td>$${trade.exitPrice ? trade.exitPrice.toFixed(2) : '-'}</td>
                <td>${(trade.size * trade.entryPrice).toFixed(2)} USDT</td>
                <td class="${trade.pnl >= 0 ? 'positive' : 'negative'}">${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)} (${(trade.pnlPct * 100).toFixed(2)}%)</td>
            `;
            
            tradeTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error updating trade history:', error);
    }
}

// Update metrics
function updateMetrics() {
    try {
        // Only update if we have trades
        if (state.trades.length === 0) {
            const totalReturn = safeGetElement('total-return');
            const totalReturnDelta = safeGetElement('total-return-delta');
            const winRate = safeGetElement('win-rate');
            const winRateDelta = safeGetElement('win-rate-delta');
            const profitFactor = safeGetElement('profit-factor');
            const profitFactorDelta = safeGetElement('profit-factor-delta');
            const maxDrawdown = safeGetElement('max-drawdown');
            const maxDrawdownDelta = safeGetElement('max-drawdown-delta');
            
            if (totalReturn) totalReturn.textContent = '0.00%';
            if (totalReturnDelta) totalReturnDelta.textContent = '$0.00';
            if (winRate) winRate.textContent = '0.0%';
            if (winRateDelta) winRateDelta.textContent = '0 trades';
            if (profitFactor) profitFactor.textContent = '0.00';
            if (profitFactorDelta) profitFactorDelta.textContent = 'Avg: $0.00';
            if (maxDrawdown) maxDrawdown.textContent = '0.00%';
            if (maxDrawdownDelta) maxDrawdownDelta.textContent = 'Sharpe: 0.00';
            return;
        }
        
        // Calculate total return
        const totalReturnPct = ((state.currentCapital - state.initialCapital) / state.initialCapital) * 100;
        
        const totalReturn = safeGetElement('total-return');
        if (totalReturn) {
            totalReturn.textContent = `${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(2)}%`;
            totalReturn.className = 'metric-value ' + (totalReturnPct >= 0 ? 'positive' : 'negative');
        }
        
        const totalReturnDelta = safeGetElement('total-return-delta');
        if (totalReturnDelta) {
            totalReturnDelta.textContent = `${totalReturnPct >= 0 ? '+' : ''}$${(state.currentCapital - state.initialCapital).toFixed(2)}`;
        }
        
        // Calculate win rate
        const winningTrades = state.trades.filter(t => t.pnl > 0).length;
        const winRatePct = (winningTrades / state.trades.length) * 100;
        
        const winRate = safeGetElement('win-rate');
        if (winRate) {
            winRate.textContent = `${winRatePct.toFixed(1)}%`;
        }
        
        const winRateDelta = safeGetElement('win-rate-delta');
        if (winRateDelta) {
            winRateDelta.textContent = `${winningTrades}/${state.trades.length} trades`;
        }
        
        // Calculate profit factor and average trade
        const grossProfit = state.trades.reduce((sum, t) => t.pnl > 0 ? sum + t.pnl : sum, 0);
        const grossLoss = Math.abs(state.trades.reduce((sum, t) => t.pnl < 0 ? sum + t.pnl : sum, 0));
        const profitFactorValue = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
        const avgTrade = state.trades.reduce((sum, t) => sum + t.pnl, 0) / state.trades.length;
        
        const profitFactor = safeGetElement('profit-factor');
        if (profitFactor) {
            profitFactor.textContent = `${profitFactorValue.toFixed(2)}`;
        }
        
        const profitFactorDelta = safeGetElement('profit-factor-delta');
        if (profitFactorDelta) {
            profitFactorDelta.textContent = `Avg: ${avgTrade >= 0 ? '+' : ''}$${avgTrade.toFixed(2)}`;
        }
        
        // Calculate max drawdown
        let maxDrawdownPct = 0;
        let peak = state.initialCapital;
        
        // Generate equity curve data if we don't have it
        if (state.equityCurve.length <= 1) {
            state.equityCurve = [{ time: new Date(0), value: state.initialCapital }];
            
            // Sort trades by entry time
            const sortedTrades = [...state.trades].sort((a, b) => a.entryTime - b.entryTime);
            
            // Reconstruct equity curve
            let currentEquity = state.initialCapital;
            sortedTrades.forEach(trade => {
                currentEquity += trade.pnl;
                state.equityCurve.push({
                    time: new Date(trade.exitTime),
                    value: currentEquity
                });
            });
        }
        
        // Calculate max drawdown from equity curve
        for (const point of state.equityCurve) {
            if (point.value > peak) {
                peak = point.value;
            }
            
            const drawdown = ((peak - point.value) / peak) * 100;
            if (drawdown > maxDrawdownPct) {
                maxDrawdownPct = drawdown;
            }
        }
        
        const maxDrawdown = safeGetElement('max-drawdown');
        if (maxDrawdown) {
            maxDrawdown.textContent = `${maxDrawdownPct.toFixed(2)}%`;
        }
        
        // Calculate simple Sharpe ratio (approximation for demo)
        // Using average return / standard deviation of returns
        const returns = [];
        for (let i = 1; i < state.equityCurve.length; i++) {
            const prevValue = state.equityCurve[i-1].value;
            const currentValue = state.equityCurve[i].value;
            returns.push((currentValue - prevValue) / prevValue);
        }
        
        let sharpeRatio = 0;
        if (returns.length > 0) {
            const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
            const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
            const stdDev = Math.sqrt(variance);
            sharpeRatio = stdDev === 0 ? 0 : (avgReturn / stdDev) * Math.sqrt(252); // Annualized
        }
        
        const maxDrawdownDelta = safeGetElement('max-drawdown-delta');
        if (maxDrawdownDelta) {
            maxDrawdownDelta.textContent = `Sharpe: ${sharpeRatio.toFixed(2)}`;
        }
        
        // Update state metrics
        state.metrics = {
            totalReturn: totalReturnPct,
            winRate: winRatePct,
            profitFactor: profitFactorValue,
            maxDrawdown: maxDrawdownPct,
            sharpeRatio,
            totalTrades: state.trades.length,
            avgTrade,
            maxWin: Math.max(...state.trades.map(t => t.pnl)),
            maxLoss: Math.min(...state.trades.map(t => t.pnl))
        };
    } catch (error) {
        console.error('Error updating metrics:', error);
    }
}

// Initialize the system when DOM content is loaded
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Load settings from localStorage
        loadSettingsFromLocalStorage();
        
        // Request notification permission
        if ('Notification' in window) {
            Notification.requestPermission();
        }
        
        // Add user login info
        const userInfo = safeGetElement('user-info');
        if (userInfo) {
            userInfo.textContent = 'User: gelimorto2';
        }
        
        // Set document title with user info
        document.title = `Volty Trading Bot | ${state.symbol} - ${state.timeframe} | User: gelimorto2`;
        
        // Initialize UI
        initUI();
        
        // Start the live clock
        startLiveClock();
        
        // Try to initialize TradingView if available
        const scriptExists = document.querySelector('script[src*="tradingview.com"]');
        if (scriptExists) {
            // Wait for TradingView to load
            window.addEventListener('load', function() {
                if (typeof TradingView !== 'undefined') {
                    initTradingViewWidget();
                } else {
                    console.warn('TradingView library not available, using Plotly charts only');
                }
            });
        }
        
        // Log user login with current time
        addLogMessage(`System initialized by user: gelimorto2 at 2025-06-08 20:34:15 UTC`);
    } catch (error) {
        console.error('Error during initialization:', error);
        alert('Error initializing the application. Please check the console for details.');
    }
});

// Handle window resize for charts
window.addEventListener('resize', function() {
    // Update equity chart width on resize for better fit
    const equityChartDiv = safeGetElement('equityChart');
    if (equityChartDiv && state.charts.equity) {
        Plotly.relayout(equityChartDiv, {
            width: equityChartDiv.offsetWidth
        });
    }
});

// Clean up resources before page unload
window.addEventListener('beforeunload', function() {
    // Clear all intervals
    if (state.interval) clearInterval(state.interval);
    if (state.clockInterval) clearInterval(state.clockInterval);
    
    // Save current state if needed
    try {
        // Save current state excluding large data structures
        const stateToSave = {
            symbol: state.symbol,
            timeframe: state.timeframe,
            initialCapital: state.initialCapital,
            currentCapital: state.currentCapital,
            atrLength: state.atrLength,
            atrMultiplier: state.atrMultiplier,
            settings: state.settings,
            feeSettings: state.feeSettings
        };
        
        localStorage.setItem('voltyBotCurrentState', JSON.stringify(stateToSave));
    } catch (error) {
        console.error('Error saving state on exit:', error);
    }
});
