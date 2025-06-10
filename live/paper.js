// Constants for API URLs
const BINANCE_API_URL = 'https://api.binance.com';
const BINANCE_TESTNET_API_URL = 'https://testnet.binance.vision';

// Notification sound
const notificationSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3');

// Text colors for UI
const UI_COLORS = {
    positive: '#22c55e',  // Green
    negative: '#ef4444',  // Red
    neutral: '#9ca3af',   // Gray
    highlight: '#4f46e5',  // Purple/Blue
    background: '#111827' // Dark background
};

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

// Bollinger Bands Strategy implementation
class BollingerBandsStrategy {
    constructor(period = 20, stdDev = 2) {
        this.period = period;
        this.stdDev = stdDev;
    }
    
    generateSignals(priceData) {
        // Calculate SMA
        const sma = [];
        for (let i = 0; i < priceData.length; i++) {
            if (i < this.period - 1) {
                sma.push(null);
                continue;
            }
            
            let sum = 0;
            for (let j = 0; j < this.period; j++) {
                sum += priceData[i - j].close;
            }
            
            sma.push(sum / this.period);
        }
        
        // Calculate Standard Deviation
        const stdDev = [];
        for (let i = 0; i < priceData.length; i++) {
            if (i < this.period - 1) {
                stdDev.push(null);
                continue;
            }
            
            const mean = sma[i];
            let sum = 0;
            for (let j = 0; j < this.period; j++) {
                sum += Math.pow(priceData[i - j].close - mean, 2);
            }
            
            stdDev.push(Math.sqrt(sum / this.period));
        }
        
        // Calculate Upper and Lower Bands
        const upperBand = [];
        const lowerBand = [];
        for (let i = 0; i < priceData.length; i++) {
            if (i < this.period - 1) {
                upperBand.push(null);
                lowerBand.push(null);
                continue;
            }
            
            upperBand.push(sma[i] + (stdDev[i] * this.stdDev));
            lowerBand.push(sma[i] - (stdDev[i] * this.stdDev));
        }
        
        // Generate signals based on Bollinger Bands
        const longSignal = [];
        const shortSignal = [];
        
        for (let i = 0; i < priceData.length; i++) {
            if (i < this.period - 1) {
                longSignal.push(null);
                shortSignal.push(null);
                continue;
            }
            
            // If price touches or crosses below lower band, generate long signal
            if (priceData[i].close <= lowerBand[i] && 
                (i === 0 || priceData[i-1].close > lowerBand[i-1])) {
                longSignal.push(priceData[i].low);
                shortSignal.push(null);
            } 
            // If price touches or crosses above upper band, generate short signal
            else if (priceData[i].close >= upperBand[i] && 
                    (i === 0 || priceData[i-1].close < upperBand[i-1])) {
                longSignal.push(null);
                shortSignal.push(priceData[i].high);
            } else {
                longSignal.push(null);
                shortSignal.push(null);
            }
        }
        
        return {
            sma,
            upperBand,
            lowerBand,
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
    
    // Bollinger Bands parameters
    bbPeriod: 20,
    bbStdDev: 2,
    
    isTrading: false,
    interval: null,
    clockInterval: null,
    
    currentPosition: null,
    trades: [],
    equityCurve: [{ time: new Date(), value: 10000 }],
    
    indicators: {
        sma: [],
        upperBand: [],
        lowerBand: [],
        longSignal: [],
        shortSignal: []
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
        makerFee: 0.1, // default 0.1% for spot trading
        takerFee: 0.1  // default 0.1% for spot trading
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
        },
        
        showPositionLines: true, // Setting for showing position lines on TradingView
        showPositionBadge: true  // New setting for showing position badge on chart
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
    
    liveTrading: {
        enabled: false,
        useTestnet: true,
        apiKey: '',
        apiSecret: '',
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
    
    usingTradingView: true, // Always use TradingView now
    
    // Position line properties for TradingView chart
    positionLines: {
        entry: null,
        takeProfit: null,
        stopLoss: null
    }
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
        logItem.className = isError ? 'log-message negative' : 'log-message';
        logItem.innerHTML = `<strong>${timestamp}</strong>: ${message}`;
        
        // Apply text color styles
        if (isError) {
            logItem.style.color = UI_COLORS.negative;
        } else {
            logItem.style.color = "var(--text-light)";
        }
        
        // Check for specific keywords to apply colors
        if (message.includes('LONG') && !isError) {
            logItem.style.color = UI_COLORS.positive;
        } else if (message.includes('SHORT') && !isError) {
            logItem.style.color = UI_COLORS.negative;
        }
        
        // Add to the top of the log
        logElement.prepend(logItem);
        
        // Trim log if too many messages
        if (logElement.children.length > 100) {
            logElement.removeChild(logElement.lastChild);
        }
    } catch (error) {
        console.error('Error adding log message:', error);
    }
}

// Reload data based on current settings
async function reloadDataWithSettings() {
    showLoading();
    showStatusIndicator('Loading data...', 'info');
    
    try {
        const data = await fetchHistoricalData(state.symbol, state.timeframe, 500);
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
        }
        
          // Generate signals with Bollinger Bands strategy
        const strategy = new BollingerBandsStrategy(state.bbPeriod, state.bbStdDev);
        state.indicators = strategy.generateSignals(state.priceData);
        
        // Update TradingView symbol
        updateTradingViewSymbol();
        
        // Update market information
        updateMarketInfo();
        
        // Log current price
        addLogMessage(`Current price for ${state.symbol}: $${state.currentPrice.toFixed(2)} (compare with TradingView)`);
        
        addLogMessage(`Data reloaded for ${state.symbol} (${state.timeframe})`);
    } catch (error) {
        hideLoading();
        hideStatusIndicator();
        console.error('Error reloading data:', error);
        addLogMessage('Error reloading data: ' + error.message, true);
    }
}

// Update market information
function updateMarketInfo() {
    try {
        const marketSymbol = safeGetElement('market-symbol');
        const marketPrice = safeGetElement('market-price');
        const marketChange = safeGetElement('market-change');
        const marketVolume = safeGetElement('market-volume');
        
        if (marketSymbol) {
            marketSymbol.textContent = state.symbol;
        }
        
        if (marketPrice) {
            marketPrice.textContent = `$${state.currentPrice.toFixed(2)}`;
        }
        
        if (marketChange) {
            const change = state.botStats.marketData.change24h;
            marketChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
            marketChange.style.color = change >= 0 ? UI_COLORS.positive : UI_COLORS.negative;
        }
        
        if (marketVolume) {
            const volume = state.botStats.marketData.volume;
            marketVolume.textContent = `$${(volume / 1000000).toFixed(2)}M`;
        }
    } catch (error) {
        console.error('Error updating market info:', error);
    }
}

// Update TradingView symbol and add position indicators
function updateTradingViewSymbol() {
    try {
        // Get the TradingView container
        const tradingViewContainer = document.getElementById('tradingview_chart');
        if (!tradingViewContainer) {
            console.error('TradingView container not found');
            return;
        }
        
        // Update the chart to show Bollinger Bands indicator
        const chartScript = document.querySelector('script[src*="embed-widget-advanced-chart.js"]');
        if (chartScript) {
            const chartConfig = JSON.parse(chartScript.textContent);
            chartConfig.symbol = `BINANCE:${state.symbol}`;
            chartConfig.interval = state.timeframe;
            
            // Ensure Bollinger Bands indicator is included
            if (!chartConfig.studies || !chartConfig.studies.includes("BB@tv-basicstudies")) {
                chartConfig.studies = ["BB@tv-basicstudies"];
            }
            
            chartScript.textContent = JSON.stringify(chartConfig, null, 2);
        }
        
        // Update position indicators if we have an active position
        if (state.currentPosition && state.settings.showPositionLines) {
            updatePositionIndicators();
        }
        
        addLogMessage(`Updated TradingView chart to ${state.symbol} with Bollinger Bands indicator`);
    } catch (error) {
        console.error('Error updating TradingView symbol:', error);
        addLogMessage('Error updating TradingView chart: ' + error.message, true);
    }
}

// Add position indicators to TradingView chart
function updatePositionIndicators() {
    try {
        // Check if we have a position
        if (!state.currentPosition) {
            // Hide position status badge
            const positionStatus = document.getElementById('position-status');
            if (positionStatus) {
                positionStatus.style.display = 'none';
            }
            return;
        }
        
        // Update position status badge
        const positionStatus = document.getElementById('position-status');
        if (positionStatus) {
            // Calculate profit/loss
            const pnl = state.currentPosition.getUnrealizedPnl(state.currentPrice);
            const pnlPct = state.currentPosition.getUnrealizedPnlPct(state.currentPrice) * 100;
            
            // Update class based on position type
            positionStatus.className = 'position-badge ' + state.currentPosition.type.toLowerCase();
            
            // Update badge content
            const positionStatusInfo = document.getElementById('position-status-info');
            if (positionStatusInfo) {
                positionStatusInfo.innerHTML = `
                    <div style="font-weight: bold; color: ${state.currentPosition.type === 'LONG' ? UI_COLORS.positive : UI_COLORS.negative};">
                        ${state.currentPosition.type} ${state.symbol}
                    </div>
                    <div style="margin-top: 3px; font-size: 0.8rem;">
                        Entry: $${state.currentPosition.entryPrice.toFixed(2)} | Current: $${state.currentPrice.toFixed(2)}
                    </div>
                    <div style="margin-top: 3px; color: ${pnl >= 0 ? UI_COLORS.positive : UI_COLORS.negative};">
                        ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)
                    </div>
                `;
            }
            
            // Show the badge
            positionStatus.style.display = 'block';
        }
    } catch (error) {
        console.error('Error updating position indicators:', error);
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

// Update position info in the widget panel
function updatePositionInfo() {
    try {
        const positionInfo = safeGetElement('position-info');
        
        if (!state.currentPosition) {
            if (positionInfo) positionInfo.style.display = 'none';
            // Hide position status badge
            const positionStatus = document.getElementById('position-status');
            if (positionStatus) {
                positionStatus.style.display = 'none';
            }
            return;
        }
        
        if (positionInfo) positionInfo.style.display = 'block';
        
        // Set position type
        const positionType = safeGetElement('position-type');
        if (positionType) {
            positionType.textContent = state.currentPosition.type;
            positionType.style.color = state.currentPosition.type === 'LONG' ? UI_COLORS.positive : UI_COLORS.negative;
            positionType.style.fontWeight = 'bold';
        }
        
        // Set entry price
        const positionEntryPrice = safeGetElement('position-entry-price');
        if (positionEntryPrice) {
            positionEntryPrice.textContent = `$${state.currentPosition.entryPrice.toFixed(2)}`;
            positionEntryPrice.style.fontWeight = 'bold';
        }
        
        // Set current price
        const positionCurrentPrice = safeGetElement('position-current-price');
        if (positionCurrentPrice) {
            positionCurrentPrice.textContent = `$${state.currentPrice.toFixed(2)}`;
            positionCurrentPrice.style.fontWeight = 'bold';
        }
        
        // Calculate and set P&L
        const unrealizedPnl = state.currentPosition.getUnrealizedPnl(state.currentPrice);
        const unrealizedPnlPct = state.currentPosition.getUnrealizedPnlPct(state.currentPrice) * 100;
        
        const pnlElement = safeGetElement('position-pnl');
        if (pnlElement) {
            pnlElement.textContent = `${unrealizedPnl >= 0 ? '+' : ''}$${unrealizedPnl.toFixed(2)} (${unrealizedPnlPct >= 0 ? '+' : ''}${unrealizedPnlPct.toFixed(2)}%)`;
            pnlElement.style.color = unrealizedPnl >= 0 ? UI_COLORS.positive : UI_COLORS.negative;
            pnlElement.style.fontWeight = 'bold';
        }
        
        // Set risk levels
        const positionTp = safeGetElement('position-tp');
        if (positionTp) {
            if (state.settings.takeProfit.enabled && state.botStats.positionDetails.takeProfitPrice) {
                positionTp.textContent = `$${state.botStats.positionDetails.takeProfitPrice.toFixed(2)}`;
                positionTp.style.color = UI_COLORS.positive;
            } else {
                positionTp.textContent = 'Not Set';
                positionTp.style.color = UI_COLORS.neutral;
            }
        }
        
        const positionSl = safeGetElement('position-sl');
        if (positionSl) {
            if (state.settings.stopLoss.enabled && state.botStats.positionDetails.stopLossPrice) {
                positionSl.textContent = `$${state.botStats.positionDetails.stopLossPrice.toFixed(2)}`;
                positionSl.style.color = UI_COLORS.negative;
            } else {
                positionSl.textContent = 'Not Set';
                positionSl.style.color = UI_COLORS.neutral;
            }
        }
        
        // Update position status badge
        updatePositionIndicators();
    } catch (error) {
        console.error('Error updating position info:', error);
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

// Update metrics
function updateMetrics() {
    try {
        // Only update if we have trades
        if (state.trades.length === 0) {
            const totalReturn = safeGetElement('total-return');
            const winRate = safeGetElement('win-rate');
            const profitFactor = safeGetElement('profit-factor');
            const maxDrawdown = safeGetElement('max-drawdown');
            
            if (totalReturn) {
                totalReturn.textContent = '0.00%';
                totalReturn.style.color = UI_COLORS.neutral;
            }
            if (winRate) {
                winRate.textContent = '0.0%';
                winRate.style.color = UI_COLORS.neutral;
            }
            if (profitFactor) {
                profitFactor.textContent = '0.00';
                profitFactor.style.color = UI_COLORS.neutral;
            }
            if (maxDrawdown) {
                maxDrawdown.textContent = '0.00%';
                maxDrawdown.style.color = UI_COLORS.neutral;
            }
            return;
        }
        
        // Calculate total return
        const totalReturnPct = ((state.currentCapital - state.initialCapital) / state.initialCapital) * 100;
        
        const totalReturn = safeGetElement('total-return');
        if (totalReturn) {
            totalReturn.textContent = `${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(2)}%`;
            totalReturn.style.color = totalReturnPct >= 0 ? UI_COLORS.positive : UI_COLORS.negative;
            totalReturn.style.fontWeight = 'bold';
        }
        
        // Calculate win rate
        const winningTrades = state.trades.filter(t => t.pnl > 0).length;
        const winRatePct = (winningTrades / state.trades.length) * 100;
        
        const winRate = safeGetElement('win-rate');
        if (winRate) {
            winRate.textContent = `${winRatePct.toFixed(1)}%`;
            winRate.style.color = winRatePct > 50 ? UI_COLORS.positive : UI_COLORS.negative;
        }
        
        // Calculate profit factor and average trade
        const grossProfit = state.trades.reduce((sum, t) => t.pnl > 0 ? sum + t.pnl : sum, 0);
        const grossLoss = Math.abs(state.trades.reduce((sum, t) => t.pnl < 0 ? sum + t.pnl : sum, 0));
        const profitFactorValue = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
        
        const profitFactor = safeGetElement('profit-factor');
        if (profitFactor) {
            profitFactor.textContent = `${profitFactorValue.toFixed(2)}`;
            profitFactor.style.color = profitFactorValue > 1 ? UI_COLORS.positive : UI_COLORS.negative;
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
            maxDrawdown.style.color = maxDrawdownPct > 5 ? UI_COLORS.negative : UI_COLORS.neutral;
        }
        
        // Update state metrics
        state.metrics = {
            totalReturn: totalReturnPct,
            winRate: winRatePct,
            profitFactor: profitFactorValue,
            maxDrawdown: maxDrawdownPct,
            totalTrades: state.trades.length,
            avgTrade: state.trades.reduce((sum, t) => sum + t.pnl, 0) / state.trades.length,
            maxWin: Math.max(...state.trades.map(t => t.pnl)),
            maxLoss: Math.min(...state.trades.map(t => t.pnl))
        };
    } catch (error) {
        console.error('Error updating metrics:', error);
    }
}

// Update trading stats
function updateTradingStats() {
    try {
        const dailyTrades = safeGetElement('stat-daily-trades');
        if (dailyTrades) {
            dailyTrades.textContent = state.botStats.dailyTrades;
            dailyTrades.style.fontWeight = 'bold';
        }
        
        const dailyPnl = safeGetElement('stat-daily-pnl');
        if (dailyPnl) {
            dailyPnl.textContent = `${state.botStats.dailyPnL >= 0 ? '+' : ''}$${state.botStats.dailyPnL.toFixed(2)}`;
            dailyPnl.style.color = state.botStats.dailyPnL >= 0 ? UI_COLORS.positive : UI_COLORS.negative;
            dailyPnl.style.fontWeight = 'bold';
        }
        
        // Update position badge if we have an active position
        if (state.currentPosition) {
            updatePositionIndicators();
        }
    } catch (error) {
        console.error('Error updating trading stats:', error);
    }
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
        
        const autoTradeToggle = safeGetElement('auto-trade-toggle');
        
        const showPositionWidgetToggle = safeGetElement('show-position-widget-toggle');
        
        // Bollinger Bands settings
        const bbPeriodInput = safeGetElement('bb-period');
        const bbStdDevInput = safeGetElement('bb-stddev');
        
        if (trailingStopToggle) state.settings.trailingStop.enabled = trailingStopToggle.checked;
        if (trailingStopValue) state.settings.trailingStop.percentage = parseFloat(trailingStopValue.value);
        
        if (takeProfitToggle) state.settings.takeProfit.enabled = takeProfitToggle.checked;
        if (takeProfitValue) state.settings.takeProfit.percentage = parseFloat(takeProfitValue.value);
        
        if (stopLossToggle) state.settings.stopLoss.enabled = stopLossToggle.checked;
        if (stopLossValue) state.settings.stopLoss.percentage = parseFloat(stopLossValue.value);
        
        if (autoTradeToggle) state.settings.autoTrade = autoTradeToggle.checked;
        
        if (showPositionWidgetToggle) {
            const positionWidget = document.getElementById('position-widget');
            if (positionWidget) {
                positionWidget.style.display = showPositionWidgetToggle.checked ? 'block' : 'none';
            }
        }
        
        if (bbPeriodInput) state.bbPeriod = parseInt(bbPeriodInput.value);
        if (bbStdDevInput) state.bbStdDev = parseFloat(bbStdDevInput.value);
        
        // Update position risk levels if we have an active position
        if (state.currentPosition) {
            updatePositionRiskLevels();
            updatePositionInfo();
        }
        
        // Save settings to localStorage
        const settingsToSave = {
            settings: state.settings,
            bbPeriod: state.bbPeriod,
            bbStdDev: state.bbStdDev
        };
        
        localStorage.setItem('voltyBotSettings', JSON.stringify(settingsToSave));
        
        // Update UI elements for conditional fields
        if (trailingStopValue) trailingStopValue.disabled = !state.settings.trailingStop.enabled;
        if (takeProfitValue) takeProfitValue.disabled = !state.settings.takeProfit.enabled;
        if (stopLossValue) stopLossValue.disabled = !state.settings.stopLoss.enabled;
        
        // Show confirmation
        addLogMessage('Settings saved successfully');
        showStatusIndicator('Settings saved', 'success');
        
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
}

// Load settings from localStorage
function loadSettingsFromLocalStorage() {
    try {
        // Load general settings
        const savedSettings = localStorage.getItem('voltyBotSettings');
        if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            if (parsedSettings.settings) {
                // Deep merge to preserve nested objects
                Object.keys(parsedSettings.settings).forEach(key => {
                    if (typeof parsedSettings.settings[key] === 'object' && 
                        parsedSettings.settings[key] !== null && 
                        state.settings[key] !== undefined) {
                        state.settings[key] = {
                            ...state.settings[key],
                            ...parsedSettings.settings[key]
                        };
                    } else {
                        state.settings[key] = parsedSettings.settings[key];
                    }
                });
            }
            
            // Load Bollinger Bands settings
            if (parsedSettings.bbPeriod) state.bbPeriod = parsedSettings.bbPeriod;
            if (parsedSettings.bbStdDev) state.bbStdDev = parsedSettings.bbStdDev;
            
            if (parsedSettings.alerts) {
                // Deep merge for alerts
                Object.keys(parsedSettings.alerts).forEach(key => {
                    if (typeof parsedSettings.alerts[key] === 'object' && 
                        parsedSettings.alerts[key] !== null && 
                        state.alerts[key] !== undefined) {
                        state.alerts[key] = {
                            ...state.alerts[key],
                            ...parsedSettings.alerts[key]
                        };
                    } else {
                        state.alerts[key] = parsedSettings.alerts[key];
                    }
                });
            }
        }
        
        // Load fee settings
        const feeSettings = localStorage.getItem('voltyBotFeeSettings');
        if (feeSettings) {
            const parsedFeeSettings = JSON.parse(feeSettings);
            state.feeSettings = { ...state.feeSettings, ...parsedFeeSettings };
        }
        
        // Load API config if available
        const apiConfig = localStorage.getItem('voltyBotAPIConfig');
        if (apiConfig) {
            const parsedConfig = JSON.parse(apiConfig);
            if (parsedConfig.apiKey) state.liveTrading.apiKey = parsedConfig.apiKey;
            if (parsedConfig.apiSecret) state.liveTrading.apiSecret = parsedConfig.apiSecret;
            if (parsedConfig.useTestnet !== undefined) state.liveTrading.useTestnet = parsedConfig.useTestnet;
        }
    } catch (error) {
        console.error('Error loading settings from localStorage:', error);
        addLogMessage('Error loading saved settings', true);
    }
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
        
        // Apply colors
        if (status === 'active') {
            botStatus.style.color = UI_COLORS.positive;
        } else if (status === 'live') {
            botStatus.style.color = UI_COLORS.highlight;
        } else {
            botStatus.style.color = UI_COLORS.neutral;
        }
    }
    
    // Update activity status message
    const activityStatus = safeGetElement('activity-status');
    if (activityStatus) {
        activityStatus.textContent = message;
        // Ensure the text is clearly visible by using a lighter color
        activityStatus.style.color = '#e5e7eb'; // Lighter gray for better visibility
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

// Check if using mobile device
function checkMobileDevice() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        addLogMessage('Mobile device detected. Some features may be limited.', true);
    }
    return isMobile;
}

// Disable or enable form inputs
function disableFormInputs(disabled) {
    try {
        const formInputs = [
            'symbol', 'timeframe', 'bb-period', 'bb-stddev', 
            'initial-capital', 'position-size',
            'trailing-stop-toggle', 'trailing-stop-value',
            'take-profit-toggle', 'take-profit-value',
            'stop-loss-toggle', 'stop-loss-value',
            'auto-trade-toggle', 'show-position-widget-toggle',
            'use-testnet-toggle'
        ];
        
        formInputs.forEach(id => {
            const element = safeGetElement(id);
            if (element) element.disabled = disabled;
        });
    } catch (error) {
        console.error('Error disabling form inputs:', error);
    }
}

// Fetch historical data from Binance API
async function fetchHistoricalData(symbol, interval, limit = 500) {
    try {
        // Determine which API URL to use based on testnet setting
        const baseUrl = state.liveTrading.useTestnet ? BINANCE_TESTNET_API_URL : BINANCE_API_URL;
        const endpoint = '/api/v3/klines';
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

// Fetch latest price for trading signals (simple version, not full candle)
async function fetchLatestPrice(symbol) {
    try {
        // Determine which API URL to use
        const baseUrl = state.liveTrading.useTestnet ? BINANCE_TESTNET_API_URL : BINANCE_API_URL;
        const endpoint = '/api/v3/ticker/price';
        const url = `${baseUrl}${endpoint}`;
        
        const params = new URLSearchParams({
            symbol: symbol
        });
        
        const data = await safeApiFetch(`${url}?${params.toString()}`);
        return parseFloat(data.price);
    } catch (error) {
        console.error('Error fetching latest price:', error);
        throw error;
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
    state.liveTrading.enabled = false;
    
    // Update bot status
    updateBotStatus('active', 'Paper trading active - Monitoring market');
    updateBotActivity('scanning');
    
    addLogMessage('Started paper trading for ' + state.symbol);
    sendAlert('Trading Started', `Paper trading started for ${state.symbol} on ${state.timeframe} timeframe`, 'success');
}

// Stop trading (both paper and live)
function stopTrading() {
    // Clear interval
    if (state.interval) {
        clearInterval(state.interval);
        state.interval = null;
    }
    
    // Set trading state
    state.isTrading = false;
    
    // Update buttons based on trading mode
    if (state.liveTrading.enabled) {
        const startLiveTradingBtn = safeGetElement('start-live-trading-btn');
        const stopLiveTradingBtn = safeGetElement('stop-live-trading-btn');
        
        if (startLiveTradingBtn) startLiveTradingBtn.disabled = false;
        if (stopLiveTradingBtn) stopLiveTradingBtn.disabled = true;
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
    updateBotActivity('waiting');
    
    const mode = state.liveTrading.enabled ? 'Live' : 'Paper';
    const message = `${mode} trading stopped`;
    addLogMessage(message);
    sendAlert('Trading Stopped', message, 'info');
}

// Reset paper trading
function resetTrading() {
    if (state.liveTrading.enabled) {
        addLogMessage('Reset not available in live trading mode', true);
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
    
    // Hide position status badge
    const positionStatus = document.getElementById('position-status');
    if (positionStatus) {
        positionStatus.style.display = 'none';
    }
    
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
            }
            
            // Generate signals
            const strategy = new BollingerBandsStrategy(state.bbPeriod, state.bbStdDev);
            state.indicators = strategy.generateSignals(state.priceData);
            
            // Update UI
            updateMetrics();
            updatePositionInfo();
            updateTradingStats();
            updateMarketInfo();
            
            // Hide position info
            const positionInfo = safeGetElement('position-info');
            if (positionInfo) positionInfo.style.display = 'none';
            
            // Update bot status
            updateBotStatus('idle', 'System reset complete - Ready to start trading');
            
            addLogMessage('Trading system reset');
            showStatusIndicator('Trading system reset complete', 'success');
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

// Poll for new data (updated to only fetch price and recalculate strategy)
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
        
        // Fetch the latest price only (not a full candle)
        const latestPrice = await fetchLatestPrice(state.symbol);
        
        // Update current price
        const previousPrice = state.currentPrice;
        state.currentPrice = latestPrice;
        
        // Update market info
        state.botStats.marketData.price = latestPrice;
        updateMarketInfo();
        
        // Log the price for comparison with TradingView (with colors)
        const priceChange = latestPrice - previousPrice;
        const priceChangeColor = priceChange >= 0 ? UI_COLORS.positive : UI_COLORS.negative;
        
        // Create a div for the log message with styled content
        const logElement = safeGetElement('logMessages');
        if (logElement) {
            const timestamp = new Date().toLocaleTimeString();
            const logItem = document.createElement('div');
            logItem.className = 'log-message';
            logItem.innerHTML = `<strong>${timestamp}</strong>: Current price: <span style="color:${priceChangeColor};font-weight:bold;">$${latestPrice.toFixed(2)} (${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)})</span> - Compare with TradingView`;
            
            // Add to the top of the log
            logElement.prepend(logItem);
            
            // Trim log if too many messages
            if (logElement.children.length > 100) {
                logElement.removeChild(logElement.lastChild);
            }
        }
        
        // Create a fake "current candle" for strategy calculation
        // This allows us to evaluate the strategy on the current price, even mid-candle
        const lastRealCandle = state.priceData[state.priceData.length - 1];
        const currentTime = new Date();
        
        // Only create a new fake candle if we're still in the same candle period
        // This prevents duplicating candles
        const timeframeMs = getTimeframeInMs(state.timeframe);
        const lastCandleEndTime = new Date(lastRealCandle.datetime.getTime() + timeframeMs);
        
        // Create a temporary copy of the price data to avoid modifying the original
        const tempPriceData = [...state.priceData];
        
        // If we're still in the current candle period, update the last candle
        // Otherwise, add a new one
        if (currentTime < lastCandleEndTime) {
            // We're still in the same candle - update the last candle with new price data
            const updatedLastCandle = {
                ...lastRealCandle,
                high: Math.max(lastRealCandle.high, latestPrice),
                low: Math.min(lastRealCandle.low, latestPrice),
                close: latestPrice
            };
            
            // Replace the last candle in the temporary data
            tempPriceData[tempPriceData.length - 1] = updatedLastCandle;
        } else {
            // We've moved to a new candle - add a new one
            const newCandle = {
                datetime: new Date(lastCandleEndTime),
                open: lastRealCandle.close,
                high: Math.max(lastRealCandle.close, latestPrice),
                low: Math.min(lastRealCandle.close, latestPrice),
                close: latestPrice,
                volume: 0 // We don't have volume data for incomplete candles
            };
            
            // Add the new candle to the temporary data
            tempPriceData.push(newCandle);
        }
        
        // Generate signals using Bollinger Bands strategy
        const strategy = new BollingerBandsStrategy(state.bbPeriod, state.bbStdDev);
        const currentIndicators = strategy.generateSignals(tempPriceData);
        
        // Get the latest signal
        const signal = strategy.getLatestSignal(tempPriceData, currentIndicators);
        
        // Update position info if we have an active position
        if (state.currentPosition) {
            updatePositionInfo();
        }
        
        // Check if we have a new signal
        if (signal && (signal === 'LONG' || signal === 'SHORT') && state.settings.autoTrade) {
            // Update bot status
            updateBotActivity('trading');
            updateBotStatus('active', `Processing ${signal} signal`);
            
            // Process the signal
            processTradeSignal(signal, tempPriceData[tempPriceData.length - 1]);
        } else if (signal) {
            // Just notify about the signal
            const message = `${signal} signal detected at $${latestPrice.toFixed(2)} (Auto-trading ${state.settings.autoTrade ? 'enabled' : 'disabled'})`;
            addLogMessage(message);
            sendAlert('Trading Signal', message, 'info');
        }
        
        // Update position info again after potential trades
        if (state.currentPosition) {
            updatePositionInfo();
        }
        
        // Check take profit and stop loss
        checkPositionExitConditions();
        
        // Calculate execution time
        const endTime = performance.now();
        state.botStats.executionTime = Math.round(endTime - startTime);
        
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
    updatePositionInfo();
    const positionInfo = safeGetElement('position-info');
    if (positionInfo) positionInfo.style.display = 'block';
    
    // Show position status badge
    const positionStatus = document.getElementById('position-status');
    if (positionStatus) {
        positionStatus.style.display = 'block';
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

// Close current position
function closeCurrentPosition(reason) {
    if (!state.currentPosition) {
        addLogMessage('No position to close', true);
        return;
    }
    
    // Get current price
    const exitPrice = state.currentPrice;
    
    // Close the position and calculate P&L
    const pnl = state.currentPosition.close(new Date(), exitPrice);
    
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
    updatePositionInfo();
    const positionInfo = safeGetElement('position-info');
    if (positionInfo) positionInfo.style.display = 'none';
    
    // Hide position status badge
    const positionStatus = document.getElementById('position-status');
    if (positionStatus) {
        positionStatus.style.display = 'none';
    }
    
    // Update metrics
    updateMetrics();
    updateTradingStats();
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
            updatePositionInfo();
        } else if (positionType === 'SHORT' && currentPrice < state.botStats.positionDetails.trailingStopPrice - (entryPrice * state.settings.trailingStop.percentage / 100)) {
            // New trailing stop level = current price + trailing stop distance
            state.botStats.positionDetails.trailingStopPrice = currentPrice + (entryPrice * state.settings.trailingStop.percentage / 100);
            updatePositionInfo();
        }
    }
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
    const paperTradingButtons = safeGetElement('paper-trading-buttons');
    const liveTradingButtons = safeGetElement('live-trading-buttons');
    const practiceIndicator = safeGetElement('practice-mode-indicator');
    const liveIndicator = safeGetElement('live-mode-indicator');
    
    if (mode === 'paper') {
        // Switch to paper trading mode
        state.liveTrading.enabled = false;
        
        // Update UI
        if (paperTradingBtn) paperTradingBtn.classList.add('active');
        if (liveTradingBtn) liveTradingBtn.classList.remove('active');
        
        if (paperTradingButtons) paperTradingButtons.style.display = 'flex';
        if (liveTradingButtons) liveTradingButtons.style.display = 'none';
        
        if (practiceIndicator) practiceIndicator.style.display = 'flex';
        if (liveIndicator) liveIndicator.style.display = 'none';
        
        addLogMessage('Switched to paper trading mode');
    } else {
        // Switch to live trading mode
        state.liveTrading.enabled = true;
        
        // Update UI
        if (liveTradingBtn) liveTradingBtn.classList.add('active');
        if (paperTradingBtn) paperTradingBtn.classList.remove('active');
        
        if (paperTradingButtons) paperTradingButtons.style.display = 'none';
        if (liveTradingButtons) liveTradingButtons.style.display = 'flex';
        
        if (practiceIndicator) practiceIndicator.style.display = 'none';
        if (liveIndicator) liveIndicator.style.display = 'flex';
        
        addLogMessage('Switched to live trading mode');
    }
}

// Emergency stop function
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

        // Close any open positions
        if (state.currentPosition) {
            closeCurrentPosition('Emergency Stop');
        }

        // Update UI buttons
        const startTradingBtn = safeGetElement('start-trading-btn');
        const stopTradingBtn = safeGetElement('stop-trading-btn');
        const resetTradingBtn = safeGetElement('reset-trading-btn');
        const startLiveTradingBtn = safeGetElement('start-live-trading-btn');
        const stopLiveTradingBtn = safeGetElement('stop-live-trading-btn');
        const emergencyStopBtn = safeGetElement('emergency-stop-btn');

        if (startTradingBtn) startTradingBtn.disabled = false;
        if (stopTradingBtn) stopTradingBtn.disabled = true;
        if (resetTradingBtn) resetTradingBtn.disabled = false;
        if (startLiveTradingBtn) startLiveTradingBtn.disabled = false;
        if (stopLiveTradingBtn) stopLiveTradingBtn.disabled = true;
        if (emergencyStopBtn) emergencyStopBtn.disabled = false;

        // Enable form inputs
        disableFormInputs(false);

        sendAlert('Emergency Stop Executed', 'All positions have been closed and trading has been halted.', 'error');
        updateBotStatus('idle', 'Emergency stop completed - System halted');
        updateBotActivity('waiting');
        
        hideLoading();
        hideStatusIndicator();
    } catch (error) {
        console.error('Error in emergency stop:', error);
        addLogMessage('Critical error in emergency stop: ' + error.message, true);
        updateBotStatus('idle', 'Critical error during emergency stop');
        hideLoading();
        hideStatusIndicator();
    }
}

// Initialize application
function initApp() {
    try {
        // Set current timestamp
        const currentTime = new Date("2025-06-10 12:17:34");
        
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
        
        // Set up testnet toggle
        const useTestnetToggle = safeGetElement('use-testnet-toggle');
        if (useTestnetToggle) {
            useTestnetToggle.checked = state.liveTrading.useTestnet;
            useTestnetToggle.addEventListener('change', function() {
                state.liveTrading.useTestnet = this.checked;
                addLogMessage(`Switched to ${state.liveTrading.useTestnet ? 'Testnet' : 'Mainnet'} API`);
                
                // If we're not trading, reload data with new settings
                if (!state.isTrading) {
                    reloadDataWithSettings();
                }
            });
        }
        
        // Start the live clock
        startLiveClock();
        
        // Check for mobile devices
        checkMobileDevice();
        
        // Set up event listeners
        setupEventListeners();
        
        // Initial bot status
        updateBotStatus('idle', 'System initializing - Loading data...');
        
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
                    
                    // Update market info
                    updateMarketInfo();
                }
                
                // Generate signals with Bollinger Bands strategy
                const strategy = new BollingerBandsStrategy(state.bbPeriod, state.bbStdDev);
                state.indicators = strategy.generateSignals(state.priceData);
                
                // Update TradingView chart
                updateTradingViewSymbol();
                
                // Update bot status
                updateBotStatus('idle', 'Ready to start trading');
                
                // Update trading stats
                updateTradingStats();
                
                // Update metrics
                updateMetrics();
                
                // Add log message
                addLogMessage('System initialized with historical data');
                showStatusIndicator('System initialized successfully', 'success');
                
                // Log user login with current time
                addLogMessage(`System initialized by user: gelimorto2 at ${currentTime.toISOString().replace('T', ' ').substr(0, 19)} UTC`);
                
                // Log current price with Bollinger Bands strategy info
                const logElement = safeGetElement('logMessages');
                if (logElement) {
                    const timestamp = new Date().toLocaleTimeString();
                    const logItem = document.createElement('div');
                    logItem.className = 'log-message';
                    logItem.innerHTML = `<strong>${timestamp}</strong>: Current price: <span style="color:${UI_COLORS.highlight};font-weight:bold;">$${state.currentPrice.toFixed(2)}</span> - Using Bollinger Bands (${state.bbPeriod}, ${state.bbStdDev})`;
                    
                    // Add to the top of the log
                    logElement.prepend(logItem);
                }
            })
            .catch(error => {
                hideLoading();
                console.error('Error fetching initial data:', error);
                updateBotStatus('idle', 'Error fetching data - Check connection');
                addLogMessage('Error fetching historical data: ' + error.message, true);
            });
    } catch (error) {
        console.error('Error during initialization:', error);
        addLogMessage('Error initializing the application: ' + error.message, true);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Strategy Parameters
    const symbolSelect = safeGetElement('symbol');
    if (symbolSelect) {
        symbolSelect.value = state.symbol;
        symbolSelect.addEventListener('change', function() {
            state.symbol = this.value;
            
            if (!state.isTrading) {
                reloadDataWithSettings();
                updateTradingViewSymbol();
            } else {
                addLogMessage('Cannot change symbol while trading is active', true);
                this.value = state.symbol; // Reset to current value
            }
        });
    }
    
    const timeframeSelect = safeGetElement('timeframe');
    if (timeframeSelect) {
        timeframeSelect.value = state.timeframe;
        timeframeSelect.addEventListener('change', function() {
            state.timeframe = this.value;
            
            if (!state.isTrading) {
                reloadDataWithSettings();
                updateTradingViewSymbol();
            } else {
                addLogMessage('Cannot change timeframe while trading is active', true);
                this.value = state.timeframe; // Reset to current value
            }
        });
    }
    
    const initialCapitalInput = safeGetElement('initial-capital');
    if (initialCapitalInput) {
        initialCapitalInput.value = state.initialCapital;
        initialCapitalInput.addEventListener('change', function() {
            const newValue = parseFloat(this.value);
            if (!isNaN(newValue) && newValue > 0) {
                state.initialCapital = newValue;
                state.currentCapital = newValue;
                addLogMessage(`Initial capital set to $${newValue}`);
            } else {
                this.value = state.initialCapital;
                addLogMessage('Invalid initial capital value', true);
            }
        });
    }
    
    const positionSizeInput = safeGetElement('position-size');
    const positionSizeValue = safeGetElement('position-size-value');
    if (positionSizeInput && positionSizeValue) {
        positionSizeInput.value = state.positionSize;
        positionSizeValue.textContent = `${state.positionSize}%`;
        
        positionSizeInput.addEventListener('input', function() {
            state.positionSize = parseFloat(this.value);
            positionSizeValue.textContent = `${state.positionSize}%`;
        });
    }
    
    // Bollinger Bands parameters
    const bbPeriodInput = safeGetElement('bb-period');
    const bbPeriodValue = safeGetElement('bb-period-value');
    if (bbPeriodInput && bbPeriodValue) {
        bbPeriodInput.value = state.bbPeriod;
        bbPeriodValue.textContent = state.bbPeriod;
        
        bbPeriodInput.addEventListener('input', function() {
            state.bbPeriod = parseInt(this.value);
            bbPeriodValue.textContent = state.bbPeriod;
        });
    }
    
    const bbStdDevInput = safeGetElement('bb-stddev');
    const bbStdDevValue = safeGetElement('bb-stddev-value');
    if (bbStdDevInput && bbStdDevValue) {
        bbStdDevInput.value = state.bbStdDev;
        bbStdDevValue.textContent = state.bbStdDev;
        
        bbStdDevInput.addEventListener('input', function() {
            state.bbStdDev = parseFloat(this.value);
            bbStdDevValue.textContent = state.bbStdDev;
        });
    }
    
    // Risk Management
    const takeProfitToggle = safeGetElement('take-profit-toggle');
    const takeProfitValue = safeGetElement('take-profit-value');
    if (takeProfitToggle && takeProfitValue) {
        takeProfitToggle.checked = state.settings.takeProfit.enabled;
        takeProfitValue.value = state.settings.takeProfit.percentage;
        takeProfitValue.disabled = !state.settings.takeProfit.enabled;
        
        takeProfitToggle.addEventListener('change', function() {
            state.settings.takeProfit.enabled = this.checked;
            takeProfitValue.disabled = !this.checked;
            saveSettings();
        });
        
        takeProfitValue.addEventListener('change', function() {
            state.settings.takeProfit.percentage = parseFloat(this.value);
            saveSettings();
        });
    }
    
    const stopLossToggle = safeGetElement('stop-loss-toggle');
    const stopLossValue = safeGetElement('stop-loss-value');
    if (stopLossToggle && stopLossValue) {
        stopLossToggle.checked = state.settings.stopLoss.enabled;
        stopLossValue.value = state.settings.stopLoss.percentage;
        stopLossValue.disabled = !state.settings.stopLoss.enabled;
        
        stopLossToggle.addEventListener('change', function() {
            state.settings.stopLoss.enabled = this.checked;
            stopLossValue.disabled = !this.checked;
            saveSettings();
        });
        
        stopLossValue.addEventListener('change', function() {
            state.settings.stopLoss.percentage = parseFloat(this.value);
            saveSettings();
        });
    }
    
    const trailingStopToggle = safeGetElement('trailing-stop-toggle');
    const trailingStopValue = safeGetElement('trailing-stop-value');
    if (trailingStopToggle && trailingStopValue) {
        trailingStopToggle.checked = state.settings.trailingStop.enabled;
        trailingStopValue.value = state.settings.trailingStop.percentage;
        trailingStopValue.disabled = !state.settings.trailingStop.enabled;
        
        trailingStopToggle.addEventListener('change', function() {
            state.settings.trailingStop.enabled = this.checked;
            trailingStopValue.disabled = !this.checked;
            saveSettings();
        });
        
        trailingStopValue.addEventListener('change', function() {
            state.settings.trailingStop.percentage = parseFloat(this.value);
            saveSettings();
        });
    }
    
    const autoTradeToggle = safeGetElement('auto-trade-toggle');
    if (autoTradeToggle) {
        autoTradeToggle.checked = state.settings.autoTrade;
        
        autoTradeToggle.addEventListener('change', function() {
            state.settings.autoTrade = this.checked;
            addLogMessage(`Auto-trading ${this.checked ? 'enabled' : 'disabled'}`);
            saveSettings();
        });
    }
    
    // Position widget toggle
    const showPositionWidgetToggle = safeGetElement('show-position-widget-toggle');
    if (showPositionWidgetToggle) {
        const positionWidget = document.getElementById('position-widget');
        showPositionWidgetToggle.checked = positionWidget && positionWidget.style.display !== 'none';
        
        showPositionWidgetToggle.addEventListener('change', function() {
            if (positionWidget) {
                positionWidget.style.display = this.checked ? 'block' : 'none';
            }
            saveSettings();
        });
    }
    
    // Trading Mode
    const paperTradingBtn = safeGetElement('paper-trading-btn');
    const liveTradingBtn = safeGetElement('live-trading-btn');
    if (paperTradingBtn && liveTradingBtn) {
        paperTradingBtn.addEventListener('click', function() {
            switchToTradingMode('paper');
        });
        
        liveTradingBtn.addEventListener('click', function() {
            switchToTradingMode('live');
        });
    }
    
    // Trading Buttons
    const startTradingBtn = safeGetElement('start-trading-btn');
    const stopTradingBtn = safeGetElement('stop-trading-btn');
    const resetTradingBtn = safeGetElement('reset-trading-btn');
    const emergencyStopBtn = safeGetElement('emergency-stop-btn');
    
    if (startTradingBtn) {
        startTradingBtn.addEventListener('click', startTrading);
    }
    
    if (stopTradingBtn) {
        stopTradingBtn.addEventListener('click', stopTrading);
    }
    
    if (resetTradingBtn) {
        resetTradingBtn.addEventListener('click', resetTrading);
    }
    
    if (emergencyStopBtn) {
        emergencyStopBtn.addEventListener('click', emergencyStop);
    }
    
    // Position Close Button
    const positionCloseBtn = safeGetElement('position-close-btn');
    if (positionCloseBtn) {
        positionCloseBtn.addEventListener('click', function() {
            if (state.currentPosition) {
                closeCurrentPosition('Manual Close');
            }
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Last modification: 2025-06-10 12:21:48 UTC by gelimorto2
