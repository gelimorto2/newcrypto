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
    highlight: '#4f46e5'  // Purple/Blue
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

// Strategy implementation using Bollinger Bands
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
            
            let sum = 0;
            const avgPrice = sma[i];
            
            for (let j = 0; j < this.period; j++) {
                sum += Math.pow(priceData[i - j].close - avgPrice, 2);
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
        
        // Generate signals based on BB crossovers
        const longSignal = [];
        const shortSignal = [];
        
        // Track the previous signal state
        let prevSignalState = null; // 'LONG', 'SHORT', or null
        
        for (let i = 0; i < priceData.length; i++) {
            if (i < this.period) {
                // Not enough data yet for signals
                longSignal.push(null);
                shortSignal.push(null);
                continue;
            }
            
            // Check if price crosses bands
            const priceClosesBelowLower = priceData[i].close < lowerBand[i];
            const priceClosesAboveUpper = priceData[i].close > upperBand[i];
            
            // Simple strategy:
            // - Long when price closes below lower band (oversold)
            // - Short when price closes above upper band (overbought)
            
            // Determine current signal
            let currentSignal = null;
            if (priceClosesBelowLower) {
                currentSignal = 'LONG';
            } else if (priceClosesAboveUpper) {
                currentSignal = 'SHORT';
            }
            
            // Set signal values only when direction changes
            if (currentSignal !== null && currentSignal !== prevSignalState) {
                if (currentSignal === 'LONG') {
                    longSignal.push(priceData[i].low * 0.99); // Slight offset for visibility
                    shortSignal.push(null);
                } else {
                    longSignal.push(null);
                    shortSignal.push(priceData[i].high * 1.01); // Slight offset for visibility
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
    bbPeriod: 20,     // Bollinger Bands period
    bbStdDev: 2,      // Bollinger Bands standard deviation
    
    previousPrice: 0,  // To track price changes
    priceChangePercent: 0,
    
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
        showPositionWidget: true,
        
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

// Function to initialize TradingView chart
function initTradingViewChart() {
    try {
        // Get the container element
        const container = document.getElementById('tradingview_chart');
        if (!container) {
            throw new Error('Chart container not found');
        }

        // Create a new TradingView widget
        new TradingView.widget({
            "autosize": true,
            "symbol": `BINANCE:${state.symbol}`,
            "interval": state.timeframe,
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1", // Candle style
            "locale": "en",
            "toolbar_bg": "#f1f3f6",
            "withdateranges": true,
            "hide_side_toolbar": false,
            "allow_symbol_change": true,
            "save_image": true,
            "container_id": "tradingview_chart",
            "studies": [
                {"id": "BB@tv-basicstudies", "inputs": {"length": state.bbPeriod, "mult": state.bbStdDev}}
            ],
            "disabled_features": ["use_localstorage_for_settings"],
            "enabled_features": ["study_templates"],
            "overrides": {
                "mainSeriesProperties.candleStyle.upColor": "#22c55e",
                "mainSeriesProperties.candleStyle.downColor": "#ef4444",
                "mainSeriesProperties.candleStyle.wickUpColor": "#22c55e",
                "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444"
            },
            "loading_screen": { "backgroundColor": "#131722", "foregroundColor": "#4f46e5" }
        });

        addLogMessage('TradingView chart initialized');
    } catch (error) {
        console.error('Error initializing TradingView chart:', error);
        addLogMessage('Error initializing chart: ' + error.message, true);
    }
}

// Update TradingView symbol
function updateTradingViewSymbol() {
    try {
        // Get the chart container
        const chartContainer = document.getElementById('tradingview_chart');
        if (!chartContainer) {
            addLogMessage('Chart container not found', true);
            return;
        }

        // Clear the container
        chartContainer.innerHTML = '';
        
        // Create a new TradingView widget
        new TradingView.widget({
            "autosize": true,
            "symbol": `BINANCE:${state.symbol}`,
            "interval": state.timeframe,
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1", // Candle style
            "locale": "en",
            "toolbar_bg": "#f1f3f6",
            "withdateranges": true,
            "hide_side_toolbar": false,
            "allow_symbol_change": true,
            "save_image": true,
            "container_id": "tradingview_chart",
            "studies": [
                {"id": "BB@tv-basicstudies", "inputs": {"length": state.bbPeriod, "mult": state.bbStdDev}}
            ],
            "disabled_features": ["use_localstorage_for_settings"],
            "enabled_features": ["study_templates"],
            "overrides": {
                "mainSeriesProperties.candleStyle.upColor": "#22c55e",
                "mainSeriesProperties.candleStyle.downColor": "#ef4444",
                "mainSeriesProperties.candleStyle.wickUpColor": "#22c55e",
                "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444"
            },
            "loading_screen": { "backgroundColor": "#131722", "foregroundColor": "#4f46e5" }
        });

        // Update live price widget
        updateLivePriceWidget();

        addLogMessage(`Updated TradingView chart to ${state.symbol}`);
        
        // Update position status badge if we have an active position
        updatePositionStatusBadge();
    } catch (error) {
        console.error('Error updating TradingView symbol:', error);
        addLogMessage('Error updating TradingView chart: ' + error.message, true);
    }
}

// Update live price widget
function updateLivePriceWidget() {
    try {
        const livePriceSymbol = document.getElementById('live-price-symbol');
        const livePriceValue = document.getElementById('live-price-value');
        const livePriceChange = document.getElementById('live-price-change');
        
        if (!livePriceSymbol || !livePriceValue || !livePriceChange) {
            console.error('Live price widget elements not found');
            return;
        }
        
        // Update symbol
        livePriceSymbol.textContent = state.symbol;
        
        // Update price
        livePriceValue.textContent = `$${state.currentPrice.toFixed(2)}`;
        
        // Update price change
        const changePercent = state.priceChangePercent;
        livePriceChange.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
        livePriceChange.style.color = changePercent >= 0 ? UI_COLORS.positive : UI_COLORS.negative;
    } catch (error) {
        console.error('Error updating live price widget:', error);
    }
}

// Update position status badge
function updatePositionStatusBadge() {
    try {
        const positionStatus = document.getElementById('position-status');
        const positionStatusInfo = document.getElementById('position-status-info');
        
        if (!positionStatus || !positionStatusInfo) {
            console.error('Position status elements not found');
            return;
        }
        
        if (!state.currentPosition) {
            positionStatus.style.display = 'none';
            return;
        }
        
        // Update class based on position type
        positionStatus.className = 'position-badge';
        positionStatus.classList.add(state.currentPosition.type.toLowerCase());
        
        // Show position status
        positionStatus.style.display = 'block';
        
        // Create position status text
        const pnlValue = state.currentPosition.getUnrealizedPnl(state.currentPrice);
        const pnlPercent = state.currentPosition.getUnrealizedPnlPct(state.currentPrice) * 100;
        const pnlText = `${pnlValue >= 0 ? '+' : ''}$${pnlValue.toFixed(2)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`;
        const pnlColor = pnlValue >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
        
        positionStatusInfo.innerHTML = `
            <div>
                <strong>${state.currentPosition.type}</strong> @ 
                <span style="color:var(--text-light)">$${state.currentPosition.entryPrice.toFixed(2)}</span>
            </div>
            <div style="margin-left:10px; color:${pnlColor}; font-weight:bold;">${pnlText}</div>
        `;
    } catch (error) {
        console.error('Error updating position status badge:', error);
    }
}

// Update position widget
function updatePositionWidget() {
    try {
        const positionWidget = document.getElementById('position-widget');
        const positionInfo = document.getElementById('position-info');
        const showWidgetToggle = document.getElementById('show-position-widget-toggle');
        
        // Check if widget should be shown based on settings
        const shouldShowWidget = showWidgetToggle ? showWidgetToggle.checked : state.settings.showPositionWidget;
        
        if (!positionWidget || !positionInfo) {
            console.error('Position widget elements not found');
            return;
        }
        
        // Show/hide widget based on settings
        if (!shouldShowWidget) {
            positionWidget.style.display = 'none';
            return;
        }
        
        if (!state.currentPosition) {
            positionInfo.style.display = 'none';
            positionWidget.style.display = shouldShowWidget ? 'block' : 'none';
            return;
        }
        
        // Show widget and position info
        positionWidget.style.display = 'block';
        positionInfo.style.display = 'block';
        
        // Set position type
        const positionType = document.getElementById('position-type');
        if (positionType) {
            positionType.textContent = state.currentPosition.type;
            positionType.style.color = state.currentPosition.type === 'LONG' ? UI_COLORS.positive : UI_COLORS.negative;
            positionType.style.fontWeight = 'bold';
        }
        
        // Set entry price
        const positionEntryPrice = document.getElementById('position-entry-price');
        if (positionEntryPrice) {
            positionEntryPrice.textContent = `$${state.currentPosition.entryPrice.toFixed(2)}`;
            positionEntryPrice.style.fontWeight = 'bold';
        }
        
        // Set current price
        const positionCurrentPrice = document.getElementById('position-current-price');
        if (positionCurrentPrice) {
            positionCurrentPrice.textContent = `$${state.currentPrice.toFixed(2)}`;
            positionCurrentPrice.style.fontWeight = 'bold';
        }
        
        // Calculate and set P&L
        const unrealizedPnl = state.currentPosition.getUnrealizedPnl(state.currentPrice);
        const unrealizedPnlPct = state.currentPosition.getUnrealizedPnlPct(state.currentPrice) * 100;
        
        const pnlElement = document.getElementById('position-pnl');
        if (pnlElement) {
            pnlElement.textContent = `${unrealizedPnl >= 0 ? '+' : ''}$${unrealizedPnl.toFixed(2)} (${unrealizedPnlPct >= 0 ? '+' : ''}${unrealizedPnlPct.toFixed(2)}%)`;
            pnlElement.style.color = unrealizedPnl >= 0 ? UI_COLORS.positive : UI_COLORS.negative;
            pnlElement.style.fontWeight = 'bold';
        }
        
        // Set risk levels
        const positionTp = document.getElementById('position-tp');
        if (positionTp) {
            if (state.settings.takeProfit.enabled && state.botStats.positionDetails.takeProfitPrice) {
                positionTp.textContent = `$${state.botStats.positionDetails.takeProfitPrice.toFixed(2)}`;
                positionTp.style.color = UI_COLORS.positive;
            } else {
                positionTp.textContent = 'Not Set';
                positionTp.style.color = UI_COLORS.neutral;
            }
        }
        
        const positionSl = document.getElementById('position-sl');
        if (positionSl) {
            if (state.settings.stopLoss.enabled && state.botStats.positionDetails.stopLossPrice) {
                positionSl.textContent = `$${state.botStats.positionDetails.stopLossPrice.toFixed(2)}`;
                positionSl.style.color = UI_COLORS.negative;
            } else {
                positionSl.textContent = 'Not Set';
                positionSl.style.color = UI_COLORS.neutral;
            }
        }
    } catch (error) {
        console.error('Error updating position widget:', error);
    }
}

// Initialize position widget dragging
function initPositionWidgetDrag() {
    const positionWidget = document.getElementById('position-widget');
    const positionWidgetHeader = positionWidget?.querySelector('.floating-widget-header');
    
    if (!positionWidget || !positionWidgetHeader) {
        return;
    }
    
    let isDragging = false;
    let offsetX, offsetY;
    
    positionWidgetHeader.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - positionWidget.getBoundingClientRect().left;
        offsetY = e.clientY - positionWidget.getBoundingClientRect().top;
        
        positionWidget.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const x = e.clientX - offsetX;
        const y = e.clientY - offsetY;
        
        positionWidget.style.left = `${x}px`;
        positionWidget.style.top = `${y}px`;
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        positionWidget.style.cursor = 'default';
    });
    
    // Close button functionality
    const closeButton = document.getElementById('close-position-widget');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            positionWidget.style.display = 'none';
            
            // Update checkbox if it exists
            const showWidgetToggle = document.getElementById('show-position-widget-toggle');
            if (showWidgetToggle) {
                showWidgetToggle.checked = false;
                state.settings.showPositionWidget = false;
            }
        });
    }
}

// Update the position info function to use the new widget and badge
function updatePositionInfo() {
    updatePositionWidget();
    updatePositionStatusBadge();
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
            state.previousPrice = state.currentPrice;
            state.currentPrice = lastCandle.close;
            state.botStats.marketData.price = lastCandle.close;
            
            // Calculate price change
            if (state.previousPrice > 0) {
                state.priceChangePercent = ((state.currentPrice - state.previousPrice) / state.previousPrice) * 100;
            }
            
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
        
        // Generate signals
        const strategy = new BollingerBandsStrategy(state.bbPeriod, state.bbStdDev);
        state.indicators = strategy.generateSignals(state.priceData);
        
        // Update TradingView symbol
        updateTradingViewSymbol();
        
        // Update live price widget
        updateLivePriceWidget();
        
        // Update market information
        updateMarketInfo();
        
        // Log current price
        addLogMessage(`Current price for ${state.symbol}: $${state.currentPrice.toFixed(2)}`);
        
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
        // Update live price widget
        updateLivePriceWidget();
    } catch (error) {
        console.error('Error updating market info:', error);
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

// Set up event listeners for Bollinger Bands parameters
function setupBollingerBandsEventListeners() {
    const bbPeriodInput = document.getElementById('bb-period');
    const bbPeriodValue = document.getElementById('bb-period-value');
    if (bbPeriodInput && bbPeriodValue) {
        bbPeriodInput.value = state.bbPeriod;
        bbPeriodValue.textContent = state.bbPeriod;
        
        bbPeriodInput.addEventListener('input', function() {
            state.bbPeriod = parseInt(this.value);
            bbPeriodValue.textContent = state.bbPeriod;
        });
    }
    
    const bbStdDevInput = document.getElementById('bb-stddev');
    const bbStdDevValue = document.getElementById('bb-stddev-value');
    if (bbStdDevInput && bbStdDevValue) {
        bbStdDevInput.value = state.bbStdDev;
        bbStdDevValue.textContent = state.bbStdDev;
        
        bbStdDevInput.addEventListener('input', function() {
            state.bbStdDev = parseFloat(this.value);
            bbStdDevValue.textContent = state.bbStdDev;
        });
    }
    
    // Position widget toggle
    const showPositionWidgetToggle = document.getElementById('show-position-widget-toggle');
    if (showPositionWidgetToggle) {
        showPositionWidgetToggle.checked = state.settings.showPositionWidget;
        
        showPositionWidgetToggle.addEventListener('change', function() {
            state.settings.showPositionWidget = this.checked;
            
            // Update position widget visibility
            const positionWidget = document.getElementById('position-widget');
            if (positionWidget) {
                positionWidget.style.display = this.checked && state.currentPosition ? 'block' : 'none';
            }
            
            addLogMessage(`Position widget ${this.checked ? 'enabled' : 'disabled'}`);
            saveSettings();
        });
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

// Fetch latest price for trading signals
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
        
        // Fetch the latest price only (not a full candle)
        const latestPrice = await fetchLatestPrice(state.symbol);
        
        // Update current price
        state.previousPrice = state.currentPrice;
        state.currentPrice = latestPrice;
        
        // Calculate price change
        if (state.previousPrice > 0) {
            state.priceChangePercent = ((state.currentPrice - state.previousPrice) / state.previousPrice) * 100;
        }
        
        // Update market info
        state.botStats.marketData.price = latestPrice;
        updateMarketInfo();
        updateLivePriceWidget();
        
        // Log the price update
        const priceChange = latestPrice - state.previousPrice;
        const logMessage = `Current price: $${latestPrice.toFixed(2)} (${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)})`;
        addLogMessage(logMessage);
        
        // Create a fake "current candle" for strategy calculation
        const lastRealCandle = state.priceData[state.priceData.length - 1];
        const currentTime = new Date();
        
        // Only create a new fake candle if we're still in the same candle period
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
        
        // Generate signals on the temporary data
        const strategy = new BollingerBandsStrategy(state.bbPeriod, state.bbStdDev);
        const currentIndicators = strategy.generateSignals(tempPriceData);
        
        // Get the latest signal
        const signal = strategy.getLatestSignal(tempPriceData, currentIndicators);
        
        // Update position info if we have an active position
        if (state.currentPosition) {
            updatePositionInfo();
        }
        
        // Process any trade signals if auto-trading is enabled
        if (signal && (signal === 'LONG' || signal === 'SHORT') && state.settings.autoTrade) {
            // Update bot status
            updateBotActivity('trading');
            updateBotStatus('active', `Processing ${signal} signal`);
            
            // Process the signal (implement your trading logic here)
            addLogMessage(`${signal} signal detected at $${latestPrice.toFixed(2)} - Processing trade...`);
        } else if (signal) {
            // Just notify about the signal
            const message = `${signal} signal detected at $${latestPrice.toFixed(2)} (Auto-trading ${state.settings.autoTrade ? 'enabled' : 'disabled'})`;
            addLogMessage(message);
        }
        
        // Calculate execution time
        const endTime = performance.now();
        state.botStats.executionTime = Math.round(endTime - startTime);
        
        // Reset bot activity to waiting
        setTimeout(() => {
            updateBotActivity('waiting');
            updateBotStatus('active', 'Waiting for next update...');
        }, 1000);
    } catch (error) {
        console.error('Error polling for new data:', error);
        addLogMessage('Error fetching data: ' + error.message, true);
        
        // Update bot status
        updateBotStatus('active', 'Error fetching data - Will retry next cycle');
        updateBotActivity('waiting');
    }
}

// Initialize application
function initApp() {
    try {
        // Set current timestamp
        const currentTime = new Date("2025-06-10 20:47:57");
        
        // Load settings from localStorage
        
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
        
        // Start the live clock
        startLiveClock();
        
        // Initialize position widget dragging
        initPositionWidgetDrag();
        
        // Set up event listeners
        setupEventListeners();
        
        // Set up Bollinger Bands event listeners
        setupBollingerBandsEventListeners();
        
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
                }
                
                // Generate signals
                const strategy = new BollingerBandsStrategy(state.bbPeriod, state.bbStdDev);
                state.indicators = strategy.generateSignals(state.priceData);
                
                // Initialize TradingView chart
                initTradingViewChart();
                
                // Update live price widget
                updateLivePriceWidget();
                
                // Update bot status
                updateBotStatus('idle', 'Ready to start trading');
                
                // Add log message
                addLogMessage('System initialized with historical data');
                showStatusIndicator('System initialized successfully', 'success');
                
                // Log user login with current time
                addLogMessage(`System initialized by user: gelimorto2 at ${currentTime.toISOString().replace('T', ' ').substr(0, 19)} UTC`);
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
    // Symbol and timeframe selectors
    const symbolSelect = safeGetElement('symbol');
    if (symbolSelect) {
        symbolSelect.value = state.symbol;
        symbolSelect.addEventListener('change', function() {
            state.symbol = this.value;
            
            if (!state.isTrading) {
                reloadDataWithSettings();
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
            } else {
                addLogMessage('Cannot change timeframe while trading is active', true);
                this.value = state.timeframe; // Reset to current value
            }
        });
    }
    
    // Trading control buttons
    const startTradingBtn = safeGetElement('start-trading-btn');
    const stopTradingBtn = safeGetElement('stop-trading-btn');
    const resetTradingBtn = safeGetElement('reset-trading-btn');
    
    if (startTradingBtn) {
        startTradingBtn.addEventListener('click', function() {
            state.isTrading = true;
            startTradingBtn.disabled = true;
            stopTradingBtn.disabled = false;
            resetTradingBtn.disabled = true;
            
            // Start polling for new data
            state.interval = setInterval(pollForNewData, state.settings.chartUpdateFrequency);
            
            updateBotStatus('active', 'Trading active - Monitoring market');
            updateBotActivity('scanning');
            
            addLogMessage('Started paper trading for ' + state.symbol);
        });
    }
    
    if (stopTradingBtn) {
        stopTradingBtn.addEventListener('click', function() {
            state.isTrading = false;
            startTradingBtn.disabled = false;
            stopTradingBtn.disabled = true;
            resetTradingBtn.disabled = false;
            
            // Clear polling interval
            if (state.interval) {
                clearInterval(state.interval);
                state.interval = null;
            }
            
            updateBotStatus('idle', 'Trading stopped - System idle');
            updateBotActivity('waiting');
            
            addLogMessage('Stopped paper trading');
        });
    }
    
    if (resetTradingBtn) {
        resetTradingBtn.addEventListener('click', function() {
            // Reset trading state
            state.currentPosition = null;
            state.trades = [];
            state.currentCapital = state.initialCapital;
            state.botStats.dailyTrades = 0;
            state.botStats.dailyPnL = 0;
            
            // Update UI
            updatePositionInfo();
            
            addLogMessage('Reset trading system');
        });
    }
    
    // Sidebar toggle
    const sidebarToggle = safeGetElement('sidebar-toggle');
    const sidebar = safeGetElement('sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('sidebar-collapsed');
            sidebarToggle.classList.toggle('collapsed');
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Last modification: 2025-06-10 20:47:57 UTC by gelimorto2
