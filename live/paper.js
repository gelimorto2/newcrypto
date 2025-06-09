/**
 * Volty Trading Bot - Main JavaScript
 * 
 * This file contains the core functionality for the Volty Trading Bot,
 * including strategy implementation, API interactions, and UI updates.
 */

// Global state object to track application state
const state = {
    isTrading: false,
    isLiveTrading: false,
    isScanningMarket: false,
    currentMode: 'paper', // 'paper' or 'live'
    currentSymbol: 'BTCUSDT',
    currentTimeframe: '1h',
    initialCapital: 10000,
    equity: 10000,
    positionSize: 10, // percentage
    atrLength: 5,
    atrMultiplier: 0.75,
    priceData: [],
    indicators: {},
    currentPosition: null,
    tradeHistory: [],
    equityHistory: [],
    lastCheck: null,
    executionTime: 0,
    chartType: 'candles', // 'candles', 'ohlc', or 'line'
    chartStyle: {
        showMA: true,
        showVolty: true,
        showVolume: false,
        candleLimit: 100
    },
    tradingViewWidget: null,
    pollingInterval: null,
    apiKeys: {
        key: '',
        secret: '',
        encrypted: false,
        testnet: false
    },
    isEmergencyStop: false
};

/**
 * Trade class for managing individual trades
 */
class Trade {
    constructor(entryTime, type, entryPrice, size) {
        this.entryTime = entryTime;
        this.type = type; // 'long' or 'short'
        this.entryPrice = entryPrice;
        this.size = size; // in base units (e.g., BTC)
        this.sizeUsd = size * entryPrice;
        this.exitTime = null;
        this.exitPrice = null;
        this.pnl = 0;
        this.pnlPct = 0;
        this.status = 'open';
        
        // Fee calculation (maker/taker)
        const makerFee = 0.0002; // 0.02%
        const takerFee = 0.0004; // 0.04%
        this.entryFee = this.sizeUsd * takerFee;
    }
    
    // Close a trade
    close(exitTime, exitPrice) {
        this.exitTime = exitTime;
        this.exitPrice = exitPrice;
        this.status = 'closed';
        
        // Calculate P&L including fees
        const takerFee = 0.0004; // 0.04%
        const exitFee = this.size * exitPrice * takerFee;
        
        if (this.type === 'long') {
            this.pnl = (this.size * exitPrice) - (this.size * this.entryPrice) - this.entryFee - exitFee;
        } else { // short
            this.pnl = (this.size * this.entryPrice) - (this.size * exitPrice) - this.entryFee - exitFee;
        }
        
        this.pnlPct = (this.pnl / this.sizeUsd) * 100;
        return this.pnl;
    }
    
    // Calculate unrealized P&L
    getUnrealizedPnl(currentPrice) {
        if (this.status === 'closed') {
            return this.pnl;
        }
        
        const takerFee = 0.0004; // 0.04%
        const exitFee = this.size * currentPrice * takerFee;
        
        if (this.type === 'long') {
            return (this.size * currentPrice) - (this.size * this.entryPrice) - this.entryFee - exitFee;
        } else { // short
            return (this.size * this.entryPrice) - (this.size * currentPrice) - this.entryFee - exitFee;
        }
    }
    
    // Calculate unrealized P&L percentage
    getUnrealizedPnlPct(currentPrice) {
        if (this.status === 'closed') {
            return this.pnlPct;
        }
        
        const unrealizedPnl = this.getUnrealizedPnl(currentPrice);
        return (unrealizedPnl / this.sizeUsd) * 100;
    }
}

/**
 * Volty Strategy implementation
 */
class VoltyStrategy {
    constructor(atrLength = 5, atrMultiplier = 0.75) {
        this.atrLength = atrLength;
        this.atrMultiplier = atrMultiplier;
    }
    
    // Generate strategy indicators
    generateSignals(priceData) {
        if (!priceData || priceData.length < this.atrLength + 10) {
            return {
                volatilityBands: { upper: [], lower: [], middle: [] },
                signals: []
            };
        }
        
        // Calculate ATR (Average True Range)
        const trueRanges = [];
        for (let i = 1; i < priceData.length; i++) {
            const high = priceData[i].high;
            const low = priceData[i].low;
            const prevClose = priceData[i - 1].close;
            
            const tr1 = high - low;
            const tr2 = Math.abs(high - prevClose);
            const tr3 = Math.abs(low - prevClose);
            
            const trueRange = Math.max(tr1, tr2, tr3);
            trueRanges.push(trueRange);
        }
        
        // Calculate ATR as simple moving average of true ranges
        const atr = [];
        for (let i = 0; i < trueRanges.length; i++) {
            if (i < this.atrLength - 1) {
                atr.push(null);
            } else {
                let sum = 0;
                for (let j = 0; j < this.atrLength; j++) {
                    sum += trueRanges[i - j];
                }
                atr.push(sum / this.atrLength);
            }
        }
        
        // Calculate 20-period EMA for middle band
        const ema20 = [];
        const k = 2 / (20 + 1);
        for (let i = 0; i < priceData.length; i++) {
            if (i === 0) {
                ema20.push(priceData[i].close);
            } else {
                ema20.push(priceData[i].close * k + ema20[i - 1] * (1 - k));
            }
        }
        
        // Calculate volatility bands
        const upper = [];
        const lower = [];
        const middle = [];
        const signals = [];
        
        for (let i = 0; i < priceData.length; i++) {
            if (i < this.atrLength) {
                upper.push(null);
                lower.push(null);
                middle.push(ema20[i]);
                signals.push(null);
            } else {
                const multipliedATR = atr[i - 1] * this.atrMultiplier;
                middle.push(ema20[i]);
                upper.push(ema20[i] + multipliedATR);
                lower.push(ema20[i] - multipliedATR);
                
                // Generate signals
                if (i > 0) {
                    const prevClose = priceData[i - 1].close;
                    const prevUpper = upper[i - 1];
                    const prevLower = lower[i - 1];
                    const currClose = priceData[i].close;
                    
                    if (prevClose <= prevUpper && currClose > upper[i]) {
                        signals.push('sell'); // Sell signal when price crosses above upper band
                    } else if (prevClose >= prevLower && currClose < lower[i]) {
                        signals.push('buy'); // Buy signal when price crosses below lower band
                    } else {
                        signals.push(null);
                    }
                } else {
                    signals.push(null);
                }
            }
        }
        
        return {
            volatilityBands: { upper, lower, middle },
            signals
        };
    }
    
    // Get the latest signal
    getLatestSignal(priceData, indicators) {
        if (!indicators || !indicators.signals || indicators.signals.length === 0) {
            return null;
        }
        
        const latestSignal = indicators.signals[indicators.signals.length - 1];
        
        if (latestSignal === 'buy') {
            return 'long';
        } else if (latestSignal === 'sell') {
            return 'short';
        }
        
        return null;
    }
}

// API Endpoints
const API = {
    BINANCE: 'https://api.binance.com',
    BINANCE_TESTNET: 'https://testnet.binance.vision',
    
    // Fetch historical klines (candles)
    async fetchHistoricalData(symbol, interval, limit = 500) {
        try {
            const baseUrl = state.apiKeys.testnet ? this.BINANCE_TESTNET : this.BINANCE;
            const endpoint = '/api/v3/klines';
            const url = `${baseUrl}${endpoint}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Transform the Binance kline data into our format
            return data.map(kline => ({
                time: new Date(kline[0]),
                open: parseFloat(kline[1]),
                high: parseFloat(kline[2]),
                low: parseFloat(kline[3]),
                close: parseFloat(kline[4]),
                volume: parseFloat(kline[5])
            }));
        } catch (error) {
            console.error('Error fetching historical data:', error);
            addLogMessage(`Error fetching data: ${error.message}`, true);
            return [];
        }
    },
    
    // Fetch latest candle
    async fetchLatestCandle(symbol, interval) {
        try {
            const baseUrl = state.apiKeys.testnet ? this.BINANCE_TESTNET : this.BINANCE;
            const endpoint = '/api/v3/klines';
            const url = `${baseUrl}${endpoint}?symbol=${symbol}&interval=${interval}&limit=1`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.length === 0) {
                return null;
            }
            
            const kline = data[0];
            return {
                time: new Date(kline[0]),
                open: parseFloat(kline[1]),
                high: parseFloat(kline[2]),
                low: parseFloat(kline[3]),
                close: parseFloat(kline[4]),
                volume: parseFloat(kline[5])
            };
        } catch (error) {
            console.error('Error fetching latest candle:', error);
            addLogMessage(`Error fetching latest data: ${error.message}`, true);
            return null;
        }
    }
};

/**
 * UI Utility Functions
 */

// Add a log message to the UI
function addLogMessage(message, isError = false) {
    const logMessages = document.getElementById('logMessages');
    if (!logMessages) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logItem = document.createElement('div');
    logItem.className = isError ? 'text-danger' : '';
    logItem.innerHTML = `<strong>${timestamp}</strong>: ${message}`;
    
    // Add message to top of log
    logMessages.insertBefore(logItem, logMessages.firstChild);
    
    // Limit the number of log messages to avoid memory issues
    if (logMessages.children.length > 100) {
        logMessages.removeChild(logMessages.lastChild);
    }
    
    console.log(`[${isError ? 'ERROR' : 'INFO'}] ${message}`);
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

// Show status message
function showStatusIndicator(message, type = 'info') {
    const statusBar = document.getElementById('status-bar');
    const statusMessage = document.getElementById('status-message');
    const statusProgress = document.getElementById('status-progress');
    
    if (!statusBar || !statusMessage || !statusProgress) return;
    
    // Reset classes and add new type
    statusBar.className = 'status-bar';
    statusBar.classList.add(`status-${type}`);
    
    // Set message
    statusMessage.textContent = message;
    
    // Show status bar
    statusBar.style.display = 'flex';
    
    // Reset and animate progress
    statusProgress.style.width = '0%';
    
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 1;
        statusProgress.style.width = `${progress}%`;
        
        if (progress >= 100) {
            clearInterval(progressInterval);
            setTimeout(() => {
                statusBar.style.display = 'none';
            }, 1000);
        }
    }, 30);
}

// Update bot status indicator
function updateBotStatus(status, message) {
    const botStatus = document.getElementById('bot-status');
    const activityStatus = document.getElementById('activity-status');
    
    if (!botStatus || !activityStatus) return;
    
    // Remove existing classes
    botStatus.className = 'status-indicator';
    
    // Add appropriate class and update content
    if (status === 'idle') {
        botStatus.classList.add('idle');
        botStatus.innerHTML = '<i class="fas fa-pause-circle"></i> BOT IDLE';
    } else if (status === 'active') {
        botStatus.classList.add('active');
        botStatus.innerHTML = '<i class="fas fa-play-circle"></i> BOT ACTIVE';
    } else if (status === 'live') {
        botStatus.classList.add('live');
        botStatus.innerHTML = '<i class="fas fa-bolt"></i> BOT LIVE';
    }
    
    activityStatus.textContent = message;
}

// Update bot activity indicator
function updateBotActivity(activity) {
    const botActivity = document.getElementById('bot-activity');
    if (!botActivity) return;
    
    // Remove existing classes
    botActivity.className = 'bot-activity';
    
    // Add appropriate class
    if (activity === 'waiting') {
        botActivity.classList.add('waiting');
    } else if (activity === 'scanning') {
        botActivity.classList.add('scanning');
    } else if (activity === 'trading') {
        botActivity.classList.add('trading');
    }
}

// Start a live updating clock
function startLiveClock() {
    function updateClock() {
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const day = String(now.getUTCDate()).padStart(2, '0');
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');
        
        const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        
        const clockDisplay = document.getElementById('clock-display');
        if (clockDisplay) {
            clockDisplay.textContent = `${formattedDateTime} UTC`;
        }
    }
    
    // Update immediately
    updateClock();
    
    // Then update every second
    return setInterval(updateClock, 1000);
}

// Update market data display
function updateMarketData(price, change24h, volume24h) {
    const marketPrice = document.getElementById('market-price');
    const marketChange = document.getElementById('market-change');
    const marketVolume = document.getElementById('market-volume');
    
    if (marketPrice) {
        marketPrice.textContent = `$${price.toFixed(2)}`;
    }
    
    if (marketChange) {
        const changeSign = change24h >= 0 ? '+' : '';
        marketChange.textContent = `${changeSign}${change24h.toFixed(2)}%`;
        marketChange.className = 'market-value ' + (change24h >= 0 ? 'up' : 'down');
    }
    
    if (marketVolume) {
        const volumeInMillions = volume24h / 1000000;
        marketVolume.textContent = `$${volumeInMillions.toFixed(1)}M`;
    }
}

// Update position card
function updatePositionCard() {
    const positionCard = document.getElementById('position-card');
    if (!positionCard) return;
    
    if (!state.currentPosition) {
        positionCard.style.display = 'none';
        return;
    }
    
    positionCard.style.display = 'block';
    
    // Position type
    const positionType = document.getElementById('position-type');
    if (positionType) {
        positionType.textContent = state.currentPosition.type.toUpperCase();
        positionType.className = 'metric-value ' + 
            (state.currentPosition.type === 'long' ? 'positive' : 'negative');
    }
    
    // Entry time
    const positionEntryTime = document.getElementById('position-entry-time');
    if (positionEntryTime) {
        positionEntryTime.textContent = state.currentPosition.entryTime.toLocaleTimeString();
    }
    
    // Entry price
    const positionEntryPrice = document.getElementById('position-entry-price');
    if (positionEntryPrice) {
        positionEntryPrice.textContent = `$${state.currentPosition.entryPrice.toFixed(2)}`;
    }
    
    // Current price
    const positionCurrentPrice = document.getElementById('position-current-price');
    if (positionCurrentPrice && state.priceData.length > 0) {
        const currentPrice = state.priceData[state.priceData.length - 1].close;
        positionCurrentPrice.textContent = `$${currentPrice.toFixed(2)}`;
    }
    
    // Position size
    const positionSizeInfo = document.getElementById('position-size-info');
    if (positionSizeInfo) {
        positionSizeInfo.textContent = 
            `${state.currentPosition.size.toFixed(6)} (≈$${state.currentPosition.sizeUsd.toFixed(2)})`;
    }
    
    // Unrealized P&L
    const positionPnl = document.getElementById('position-pnl');
    if (positionPnl && state.priceData.length > 0) {
        const currentPrice = state.priceData[state.priceData.length - 1].close;
        const unrealizedPnl = state.currentPosition.getUnrealizedPnl(currentPrice);
        const unrealizedPnlPct = state.currentPosition.getUnrealizedPnlPct(currentPrice);
        
        const pnlSign = unrealizedPnl >= 0 ? '+' : '';
        positionPnl.textContent = 
            `${pnlSign}$${unrealizedPnl.toFixed(2)} (${pnlSign}${unrealizedPnlPct.toFixed(2)}%)`;
        positionPnl.className = 'metric-value ' + (unrealizedPnl >= 0 ? 'positive' : 'negative');
    }
    
    // Risk levels
    updateRiskLevels();
}

// Update risk levels (TP, SL, TS)
function updateRiskLevels() {
    if (!state.currentPosition) return;
    
    const takeProfitPct = 3.0; // 3% take profit
    const stopLossPct =
