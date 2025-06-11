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
    constructor(entryTime, type, entryPrice, size, reason = 'Signal') {
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
        this.reason = reason; // Entry reason
        this.exitReason = ''; // Exit reason
    }
    
    close(exitTime, exitPrice, reason = 'Manual Close') {
        this.exitTime = new Date(exitTime);
        this.exitPrice = exitPrice;
        this.status = 'CLOSED';
        this.exitReason = reason;
        
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

// Custom VolumeAndBBStrategy class
class VolumeAndBBStrategy {
    constructor(volumeCandles = 3, volumeIncreasePercentage = 20, bbLength = 20, bbDeviation = 2.0) {
        this.volumeCandles = volumeCandles;
        this.volumeIncreasePercentage = volumeIncreasePercentage;
        this.bbLength = bbLength;
        this.bbDeviation = bbDeviation;
        this.signalHistory = [];
    }
    
    generateSignals(priceData) {
        // Reset signal history
        this.signalHistory = [];
        
        // Calculate Bollinger Bands
        const bbData = this.calculateBollingerBands(priceData);
        
        // Buy signals based on volume increase
        const buySignals = this.generateBuySignals(priceData);
        
        // Sell signals based on Bollinger Bands
        const sellSignals = this.generateSellSignals(priceData, bbData);
        
        // Combine results
        return {
            bbData,
            buySignals,
            sellSignals
        };
    }
    
    calculateBollingerBands(priceData) {
        const bbData = {
            upperBand: [],
            middleBand: [],
            lowerBand: []
        };
        
        // Calculate SMA and Bollinger Bands
        for (let i = 0; i < priceData.length; i++) {
            if (i < this.bbLength - 1) {
                bbData.upperBand.push(null);
                bbData.middleBand.push(null);
                bbData.lowerBand.push(null);
                continue;
            }
            
            // Calculate SMA (middle band)
            let sum = 0;
            for (let j = 0; j < this.bbLength; j++) {
                sum += priceData[i - j].close;
            }
            const sma = sum / this.bbLength;
            
            // Calculate standard deviation
            let sumSquaredDiff = 0;
            for (let j = 0; j < this.bbLength; j++) {
                const diff = priceData[i - j].close - sma;
                sumSquaredDiff += diff * diff;
            }
            const stdDev = Math.sqrt(sumSquaredDiff / this.bbLength);
            
            // Calculate bands
            bbData.middleBand.push(sma);
            bbData.upperBand.push(sma + this.bbDeviation * stdDev);
            bbData.lowerBand.push(sma - this.bbDeviation * stdDev);
        }
        
        return bbData;
    }
    
    generateBuySignals(priceData) {
        const buySignals = [];
        
        // Need enough candles for volume comparison
        for (let i = 0; i < priceData.length; i++) {
            if (i < this.volumeCandles) {
                buySignals.push(null);
                continue;
            }
            
            // Calculate average volume over the specified number of previous candles
            let avgVolume = 0;
            for (let j = 1; j <= this.volumeCandles; j++) {
                avgVolume += priceData[i - j].volume;
            }
            avgVolume /= this.volumeCandles;
            
            // Current volume exceeds average by the specified percentage
            const currentVolume = priceData[i].volume;
            const volumeIncreasePct = ((currentVolume - avgVolume) / avgVolume) * 100;
            
            if (volumeIncreasePct >= this.volumeIncreasePercentage) {
                // Signal a buy at the low of the candle for better visualization
                buySignals.push(priceData[i].low * 0.999);
                
                // Add to signal history for chart markers
                this.signalHistory.push({
                    time: priceData[i].datetime.getTime() / 1000, // Convert to UNIX timestamp
                    position: 'belowBar',
                    color: '#22c55e',
                    shape: 'arrowUp',
                    text: `Vol +${volumeIncreasePct.toFixed(0)}%`,
                    type: 'LONG',
                    price: priceData[i].close
                });
            } else {
                buySignals.push(null);
            }
        }
        
        return buySignals;
    }
    
    generateSellSignals(priceData, bbData) {
        const sellSignals = [];
        
        // Need enough candles for BB calculation
        for (let i = 0; i < priceData.length; i++) {
            if (i < this.bbLength) {
                sellSignals.push(null);
                continue;
            }
            
            // Price touches or exceeds upper band = potential sell signal
            if (bbData.upperBand[i] && priceData[i].high >= bbData.upperBand[i]) {
                // Signal a sell at the high of the candle for better visualization
                sellSignals.push(priceData[i].high * 1.001);
                
                // Add to signal history for chart markers
                this.signalHistory.push({
                    time: priceData[i].datetime.getTime() / 1000, // Convert to UNIX timestamp
                    position: 'aboveBar',
                    color: '#ef4444',
                    shape: 'arrowDown',
                    text: 'Upper BB',
                    type: 'SHORT',
                    price: priceData[i].close
                });
            } else {
                sellSignals.push(null);
            }
        }
        
        return sellSignals;
    }
    
    getLatestSignal(priceData, indicators) {
        if (!priceData.length || !indicators) return null;
        
        const lastIndex = priceData.length - 1;
        
        if (indicators.buySignals[lastIndex] !== null) {
            return {
                type: 'LONG',
                reason: 'Volume Surge'
            };
        } else if (indicators.sellSignals[lastIndex] !== null) {
            return {
                type: 'SHORT',
                reason: 'Upper Bollinger Band'
            };
        } else {
            return null;
        }
    }
}

// Application state
// State Definition
const state = {
    // Market settings
    symbol: 'BTCUSDT',
    timeframe: '60', // Default to 1h
    priceData: [],
    currentPrice: 0,
    
    // Strategy parameters
    volumeCandles: 3,
    volumeIncreasePercentage: 20,
    bbLength: 20,
    bbDeviation: 2,
    
    // Trading parameters
    initialCapital: 10000,
    currentCapital: 10000,
    positionSize: 10, // Percentage of capital to use per trade
    
    // Trading state
    isTrading: false,
    currentPosition: null,
    trades: [],
    equityCurve: [{time: new Date(), value: 10000}],
    
    // Indicator data
    indicators: {},
    signalHistory: [],
    
    // Interval reference for polling
    interval: null,
    
    // Settings
    settings: {
        takeProfit: {
            enabled: true,
            percentage: 3
        },
        stopLoss: {
            enabled: true,
            percentage: 2
        },
        trailingStop: {
            enabled: false,
            percentage: 1.5
        },
        autoTrade: true,
        showPositionLines: true,
        chartUpdateFrequency: 5000 // 5 seconds
    },
    
    // Live trading settings
    liveTrading: {
        enabled: false,
        apiKey: '',
        apiSecret: '',
        useTestnet: true,
        accountInfo: null
    },
    
    // Notification settings
    alerts: {
        browser: {
            enabled: true
        },
        sound: {
            enabled: true
        },
        discord: {
            enabled: false,
            webhook: ''
        }
    },
    
    // Bot statistics
    botStats: {
        startTime: new Date(),
        lastCheck: null,
        executionTime: 0,
        dailyTrades: 0,
        dailyPnL: 0,
        dailyStartCapital: 10000,
        positionDetails: {
            takeProfitPrice: 0,
            stopLossPrice: 0,
            trailingStopPrice: 0
        },
        marketData: {
            price: 0,
            change24h: 0,
            volume: 0
        }
    },
    
    // Trading metrics
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
    
    // Other UI state
    priceChangePercent: 0,
    isMobileDevice: false
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
        
        // Generate signals using the volume and bollinger bands strategy
        const strategy = new VolumeAndBBStrategy(
            state.volumeCandles,
            state.volumeIncreasePercentage,
            state.bbLength,
            state.bbDeviation
        );
        
        state.indicators = strategy.generateSignals(state.priceData);
        state.signalHistory = strategy.signalHistory; // Store signal markers for the chart
        
        // Update TradingView symbol by refreshing the widget
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
// Update market information in top bar and widgets
function updateMarketInfo() {
    try {
        // Update the market info widget in the side panel
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
        
        // Update the live status display in the top bar
        const marketSymbolBadge = safeGetElement('market-symbol-badge');
        const marketPriceBadge = safeGetElement('market-price-badge');
        const marketChangeBadge = safeGetElement('market-change-badge');
        
        if (marketSymbolBadge) {
            marketSymbolBadge.textContent = state.symbol.replace('USDT', '/USDT');
        }
        
        if (marketPriceBadge) {
            marketPriceBadge.textContent = `$${state.currentPrice.toFixed(2)}`;
        }
        
        if (marketChangeBadge) {
            const change = state.botStats.marketData.change24h;
            marketChangeBadge.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
            marketChangeBadge.style.color = change >= 0 ? UI_COLORS.positive : UI_COLORS.negative;
        }
    } catch (error) {
        console.error('Error updating market info:', error);
    }
}


// Update TradingView symbol and add position indicators
// Update TradingView symbol and add position indicators
function updateTradingViewSymbol() {
    try {
        // For TradingView's Advanced Chart Widget, we need to update the symbol directly in the HTML
        // Since the Advanced Chart is embedded directly via script tag in the HTML, we'll need to reload it
        
        // Find the TradingView container div
        const tvContainer = document.querySelector('.tradingview-widget-container');
        if (!tvContainer) {
            console.error('TradingView container not found');
            addLogMessage('TradingView container not found', true);
            return;
        }
        
        // Get the widget div
        const widgetDiv = tvContainer.querySelector('.tradingview-widget-container__widget');
        if (!widgetDiv) {
            console.error('TradingView widget div not found');
            addLogMessage('TradingView widget div not found', true);
            return;
        }
        
        // Clear existing widget content
        widgetDiv.innerHTML = '';
        
        // Create new script element for the Advanced Chart
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        script.async = true;
        
        // Create the config object for the widget with custom Bollinger Bands
        const config = {
            "autosize": true,
            "symbol": `BINANCE:${state.symbol}`,
            "interval": state.timeframe,
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1",
            "locale": "en",
            "withdateranges": true,
            "hide_side_toolbar": false,
            "allow_symbol_change": true,
            "details": true,
            "show_popup_button": true,
            "popup_width": "1000",
            "popup_height": "650",
            "studies": [
                {
                    "id": "BB@tv-basicstudies",
                    "inputs": {
                        "length": state.bbLength,
                        "stdDev": state.bbDeviation
                    }
                }
            ],
            "support_host": "https://www.tradingview.com"
        };
        
        // Set the script text content to the stringified config
        script.text = JSON.stringify(config);
        
        // Append the script to the widget div
        widgetDiv.appendChild(script);
        
        // Update signal display separately

        // Update position indicators if needed
        if (state.currentPosition && state.settings.showPositionLines) {
            updatePositionInfo();
            updateFloatingPositionIndicator();
        }
        
        addLogMessage(`Updated chart to ${state.symbol} with BB(${state.bbLength}, ${state.bbDeviation})`);
    } catch (error) {
        console.error('Error updating TradingView symbol:', error);
        addLogMessage('Error updating chart: ' + error.message, true);
    }
}

// Update chart when Bollinger Bands settings change
function setupBollingerBandsEventListeners() {
    const bbLength = safeGetElement('bb-length');
    const bbLengthValue = safeGetElement('bb-length-value');
    if (bbLength && bbLengthValue) {
        bbLength.value = state.bbLength;
        bbLengthValue.textContent = state.bbLength;
        
        bbLength.addEventListener('input', function() {
            state.bbLength = parseInt(this.value);
            bbLengthValue.textContent = state.bbLength;
        });
        
        bbLength.addEventListener('change', function() {
            // Only update chart when user stops dragging slider
            if (!state.isTrading) {
                updateTradingViewSymbol();
            }
        });
    }
    
    const bbDev = safeGetElement('bb-dev');
    const bbDevValue = safeGetElement('bb-dev-value');
    if (bbDev && bbDevValue) {
        bbDev.value = state.bbDeviation;
        bbDevValue.textContent = state.bbDeviation;
        
        bbDev.addEventListener('input', function() {
            state.bbDeviation = parseFloat(this.value);
            bbDevValue.textContent = state.bbDeviation;
        });
        
        bbDev.addEventListener('change', function() {
            // Only update chart when user stops dragging slider
            if (!state.isTrading) {
                updateTradingViewSymbol();
            }
        });
    }
    
    // Add save settings button to update chart with new BB settings
    const saveSettingsBtn = safeGetElement('save-settings-btn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', function() {
            saveSettings();
            if (!state.isTrading) {
                updateTradingViewSymbol();
            }
        });
    }
}


// Update signal display with visual representation of past signals

// Update position info in the widget panel
function updatePositionInfo() {
    try {
        const positionInfo = safeGetElement('position-info');
        
        if (!state.currentPosition) {
            if (positionInfo) positionInfo.style.display = 'none';
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
        
        // Add floating position indicator on chart
        updateFloatingPositionIndicator();
    } catch (error) {
        console.error('Error updating position info:', error);
    }
}

// Update floating position indicator on chart
// Update floating position indicator on chart (left side)
function updateFloatingPositionIndicator() {
    try {
        // Get the existing indicator
        const indicator = safeGetElement('floating-position-indicator');
        
        if (!state.currentPosition) {
            if (indicator) indicator.style.display = 'none';
            return;
        }
        
        // Calculate profit/loss
        const pnl = state.currentPosition.getUnrealizedPnl(state.currentPrice);
        const pnlPct = state.currentPosition.getUnrealizedPnlPct(state.currentPrice) * 100;
        
        // Create content
        const content = `
            <div style="margin-bottom: 5px; font-size: 16px;">
                ${state.currentPosition.type} Position @ $${state.currentPosition.entryPrice.toFixed(2)}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>PnL:</span>
                <span>${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)</span>
            </div>
            ${state.settings.takeProfit.enabled ? `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 3px;">
                    <span>TP:</span>
                    <span>$${state.botStats.positionDetails.takeProfitPrice.toFixed(2)}</span>
                </div>
            ` : ''}
            ${state.settings.stopLoss.enabled ? `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 3px;">
                    <span>SL:</span>
                    <span>$${state.botStats.positionDetails.stopLossPrice.toFixed(2)}</span>
                </div>
            ` : ''}
        `;
        
        if (indicator) {
            // Update existing indicator
            indicator.innerHTML = content;
            indicator.className = `floating-position-indicator ${state.currentPosition.type.toLowerCase()}`;
            indicator.style.display = 'block';
        } else {
            // Create new indicator if it doesn't exist
            const newIndicator = document.createElement('div');
            newIndicator.id = 'floating-position-indicator';
            newIndicator.className = `floating-position-indicator ${state.currentPosition.type.toLowerCase()}`;
            newIndicator.innerHTML = content;
            
            // Add to chart container
            const chartContainer = document.querySelector('.chart-container');
            if (chartContainer) {
                chartContainer.appendChild(newIndicator);
            }
        }
    } catch (error) {
        console.error('Error updating floating position indicator:', error);
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
        
        // Add last check info
        const lastTickInfo = safeGetElement('last-tick-info');
        if (lastTickInfo && state.botStats.lastCheck) {
            lastTickInfo.innerHTML = `Last check: <span style="color: ${UI_COLORS.highlight};">${state.botStats.lastCheck.toLocaleTimeString()}</span> | Exec: <span style="color: ${UI_COLORS.highlight};">${state.botStats.executionTime}ms</span>`;
        }
    } catch (error) {
        console.error('Error updating trading stats:', error);
    }
}

// Send Discord notification
async function sendDiscordNotification(title, message, color = 0x4f46e5, isError = false) {
    try {
        if (!state.alerts.discord.enabled || !state.alerts.discord.webhook) {
            return false;
        }
        
        // Create Discord embed
        const embed = {
            title: title,
            description: message,
            color: isError ? 0xef4444 : color, // Red for errors, passed color otherwise
            timestamp: new Date().toISOString(),
            footer: {
                text: `Volty Trading Bot | ${state.symbol}`
            },
            fields: []
        };
        
        // Add additional fields if we have a position
        if (state.currentPosition) {
            const pnl = state.currentPosition.getUnrealizedPnl(state.currentPrice);
            const pnlPct = state.currentPosition.getUnrealizedPnlPct(state.currentPrice) * 100;
            
            embed.fields.push(
                {
                    name: 'Position',
                    value: `${state.currentPosition.type} @ $${state.currentPosition.entryPrice.toFixed(2)}`,
                    inline: true
                },
                {
                    name: 'Current P&L',
                    value: `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`,
                    inline: true
                }
            );
        }
        
        // Add current price
        embed.fields.push({
            name: 'Current Price',
            value: `$${state.currentPrice.toFixed(2)}`,
            inline: true
        });
        
        // Send the webhook
        const response = await fetch(state.alerts.discord.webhook, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'Volty Trading Bot',
                avatar_url: 'https://i.imgur.com/fKL31aD.png',
                embeds: [embed]
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Discord webhook error (${response.status}): ${errorText}`);
        }
        
        return true;
    } catch (error) {
        console.error('Error sending Discord notification:', error);
        addLogMessage(`Discord notification failed: ${error.message}`, true);
        return false;
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
    
    // Discord notification
    if (state.alerts.discord.enabled && state.alerts.discord.webhook) {
        // Map alert types to Discord colors
        const colorMap = {
            info: 0x4f46e5,    // Purple/Blue
            success: 0x22c55e,  // Green
            warning: 0xf59e0b,  // Yellow/Orange
            error: 0xef4444    // Red
        };
        
        sendDiscordNotification(
            title,
            message,
            colorMap[type] || 0x4f46e5,
            type === 'error'
        );
    }
}

// Save settings to localStorage
function saveSettings() {
    try {
        // Get settings from UI elements
        
        // Volume and BB strategy settings
        const volumeCandles = safeGetElement('volume-candles');
        const volumeIncrease = safeGetElement('volume-increase');
        const bbLength = safeGetElement('bb-length');
        const bbDev = safeGetElement('bb-dev');
        
        if (volumeCandles) state.volumeCandles = parseInt(volumeCandles.value);
        if (volumeIncrease) state.volumeIncreasePercentage = parseInt(volumeIncrease.value);
        if (bbLength) state.bbLength = parseInt(bbLength.value);
        if (bbDev) state.bbDeviation = parseFloat(bbDev.value);
        
        // Risk management settings
        const trailingStopToggle = safeGetElement('trailing-stop-toggle');
        const trailingStopValue = safeGetElement('trailing-stop-value');
        
        const takeProfitToggle = safeGetElement('take-profit-toggle');
        const takeProfitValue = safeGetElement('take-profit-value');
        
        const stopLossToggle = safeGetElement('stop-loss-toggle');
        const stopLossValue = safeGetElement('stop-loss-value');
        
        const autoTradeToggle = safeGetElement('auto-trade-toggle');
        
        const showPositionLinesToggle = safeGetElement('show-position-lines-toggle');
        
        if (trailingStopToggle) state.settings.trailingStop.enabled = trailingStopToggle.checked;
        if (trailingStopValue) state.settings.trailingStop.percentage = parseFloat(trailingStopValue.value);
        
        if (takeProfitToggle) state.settings.takeProfit.enabled = takeProfitToggle.checked;
        if (takeProfitValue) state.settings.takeProfit.percentage = parseFloat(takeProfitValue.value);
        
        if (stopLossToggle) state.settings.stopLoss.enabled = stopLossToggle.checked;
        if (stopLossValue) state.settings.stopLoss.percentage = parseFloat(stopLossValue.value);
        
        if (autoTradeToggle) state.settings.autoTrade = autoTradeToggle.checked;
        
        if (showPositionLinesToggle) state.settings.showPositionLines = showPositionLinesToggle.checked;
        
        // Notification settings
        const browserNotificationsToggle = safeGetElement('browser-notifications-toggle');
        const soundNotificationsToggle = safeGetElement('sound-notifications-toggle');
        const discordNotificationsToggle = safeGetElement('discord-notifications-toggle');
        const discordWebhook = safeGetElement('discord-webhook');
        
        if (browserNotificationsToggle) state.alerts.browser.enabled = browserNotificationsToggle.checked;
        if (soundNotificationsToggle) state.alerts.sound.enabled = soundNotificationsToggle.checked;
        if (discordNotificationsToggle) state.alerts.discord.enabled = discordNotificationsToggle.checked;
        if (discordWebhook) state.alerts.discord.webhook = discordWebhook.value;
        
        // Update position risk levels if we have an active position
        if (state.currentPosition) {
            updatePositionRiskLevels();
            updatePositionInfo();
        }
        
        // Save settings to localStorage
        const settingsToSave = {
            settings: state.settings,
            alerts: state.alerts,
            volumeCandles: state.volumeCandles,
            volumeIncreasePercentage: state.volumeIncreasePercentage,
            bbLength: state.bbLength,
            bbDeviation: state.bbDeviation
        };
        
        localStorage.setItem('voltyBotSettings', JSON.stringify(settingsToSave));
        
        // Update UI elements for conditional fields
        if (trailingStopValue) trailingStopValue.disabled = !state.settings.trailingStop.enabled;
        if (takeProfitValue) takeProfitValue.disabled = !state.settings.takeProfit.enabled;
        if (stopLossValue) stopLossValue.disabled = !state.settings.stopLoss.enabled;
        if (discordWebhook) discordWebhook.disabled = !state.alerts.discord.enabled;
        
        // Show confirmation
        addLogMessage('Settings saved successfully');
        showStatusIndicator('Settings saved', 'success');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        addLogMessage('Error saving settings: ' + error.message, true);
    }
}

// Save API credentials to localStorage (encrypted)
function saveApiCredentials() {
    try {
        const apiKey = safeGetElement('api-key').value;
        const apiSecret = safeGetElement('api-secret').value;
        const useTestnet = safeGetElement('use-testnet-toggle').checked;
        
        if (!apiKey || !apiSecret) {
            showStatusIndicator('API key and secret are required', 'error');
            return false;
        }
        
        // Simple encryption (not secure, but better than plaintext)
        const encryptedKey = btoa(apiKey);
        const encryptedSecret = btoa(apiSecret);
        
        // Save to state
        state.liveTrading.apiKey = apiKey;
        state.liveTrading.apiSecret = apiSecret;
        state.liveTrading.useTestnet = useTestnet;
        
        // Save to localStorage
        const apiConfig = {
            apiKey: encryptedKey,
            apiSecret: encryptedSecret,
            useTestnet: useTestnet
        };
        
        localStorage.setItem('voltyBotAPIConfig', JSON.stringify(apiConfig));
        
        addLogMessage('API credentials saved successfully');
        showStatusIndicator('API credentials saved', 'success');
        
        return true;
    } catch (error) {
        console.error('Error saving API credentials:', error);
        addLogMessage('Error saving API credentials: ' + error.message, true);
        return false;
    }
}

// Update signal display with visual representation of past signals

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
            
            // Load strategy parameters
            if (parsedSettings.volumeCandles !== undefined) state.volumeCandles = parsedSettings.volumeCandles;
            if (parsedSettings.volumeIncreasePercentage !== undefined) state.volumeIncreasePercentage = parsedSettings.volumeIncreasePercentage;
            if (parsedSettings.bbLength !== undefined) state.bbLength = parsedSettings.bbLength;
            if (parsedSettings.bbDeviation !== undefined) state.bbDeviation = parsedSettings.bbDeviation;
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
            if (parsedConfig.apiKey) state.liveTrading.apiKey = atob(parsedConfig.apiKey);
            if (parsedConfig.apiSecret) state.liveTrading.apiSecret = atob(parsedConfig.apiSecret);
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
            'symbol', 'timeframe', 'volume-candles', 'volume-increase', 
            'bb-length', 'bb-dev', 'initial-capital', 'position-size',
            'trailing-stop-toggle', 'trailing-stop-value',
            'take-profit-toggle', 'take-profit-value',
            'stop-loss-toggle', 'stop-loss-value',
            'auto-trade-toggle', 'show-position-lines-toggle',
            'use-testnet-toggle',
            'browser-notifications-toggle', 'sound-notifications-toggle',
            'discord-notifications-toggle', 'discord-webhook'
        ];
        
        formInputs.forEach(id => {
            const element = safeGetElement(id);
            if (element) element.disabled = disabled;
        });
    } catch (error) {
        console.error('Error disabling form inputs:', error);
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
            const strategy = new VolumeAndBBStrategy(
                state.volumeCandles,
                state.volumeIncreasePercentage,
                state.bbLength,
                state.bbDeviation
            );
            state.indicators = strategy.generateSignals(state.priceData);
            state.signalHistory = strategy.signalHistory;
            
            // Update UI
            updateMetrics();
            updatePositionInfo();
            updateTradingStats();
            updateMarketInfo();
            
            // Remove any position indicators
            const floatingIndicator = safeGetElement('floating-position-indicator');
            if (floatingIndicator) {
                floatingIndicator.remove();
            }
            
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
        updateBotStatus(state.liveTrading.enabled ? 'live' : 'active', 'Fetching latest market data...');
        
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
        
        const logMessage = `Current price: $${latestPrice.toFixed(2)} (${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)})`;
        
        // Create a div for the log message with styled content
        const logElement = safeGetElement('logMessages');
        if (logElement) {
            const timestamp = new Date().toLocaleTimeString();
            const logItem = document.createElement('div');
            logItem.className = 'log-message';
            logItem.innerHTML = `<strong>${timestamp}</strong>: Current price: <span style="color:${priceChangeColor};font-weight:bold;">$${latestPrice.toFixed(2)} (${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)})</span>`;
            
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
        
        // Generate signals on the temporary data using our custom strategy
        const strategy = new VolumeAndBBStrategy(
            state.volumeCandles,
            state.volumeIncreasePercentage,
            state.bbLength,
            state.bbDeviation
        );
        
        const currentIndicators = strategy.generateSignals(tempPriceData);
        
        // Get the latest signal
        const signal = strategy.getLatestSignal(tempPriceData, currentIndicators);
        
        // Update position info if we have an active position
        if (state.currentPosition) {
            updatePositionInfo();
        }
        
        // Check if we have a new signal
        if (signal && state.settings.autoTrade) {
            // Update bot status
            updateBotActivity('trading');
            updateBotStatus(state.liveTrading.enabled ? 'live' : 'active', `Processing ${signal.type} signal`);
            
            // Process the signal
            processTradeSignal(signal, tempPriceData[tempPriceData.length - 1]);
        } else if (signal) {
            // Just notify about the signal
            const message = `${signal.type} signal detected (${signal.reason}) at $${latestPrice.toFixed(2)} (Auto-trading ${state.settings.autoTrade ? 'enabled' : 'disabled'})`;
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
            const mode = state.liveTrading.enabled ? 'LIVE' : 'Paper';
            updateBotStatus(state.liveTrading.enabled ? 'live' : 'active', `${mode} trading active - Waiting for next check`);
        }, 1000);
    } catch (error) {
        console.error('Error polling for new data:', error);
        addLogMessage('Error fetching data: ' + error.message, true);
        
        // Update bot status
        updateBotStatus(state.liveTrading.enabled ? 'live' : 'active', 'Error fetching data - Will retry next cycle');
        updateBotActivity('waiting');
    }
}

// Process trade signal
function processTradeSignal(signal, candle) {
    // Check if auto-trading is enabled
    if (!state.settings.autoTrade) {
        addLogMessage(`Signal: ${signal.type} (${signal.reason}) detected, but auto-trading is disabled`);
        return;
    }
    
    // Check if we already have a position
    if (state.currentPosition) {
        // If we have a position in the opposite direction, close it and open a new one
        if (state.currentPosition.type !== signal.type) {
            addLogMessage(`Closing ${state.currentPosition.type} position to reverse to ${signal.type} (${signal.reason})`);
            closeCurrentPosition('Signal Reverse');
            openPosition(signal.type, candle, signal.reason);
        } else {
            addLogMessage(`${signal.type} signal (${signal.reason}) confirmed, already in position`);
        }
    } else {
        // Open new position
        openPosition(signal.type, candle, signal.reason);
    }
}

// Open a position
function openPosition(type, candle, reason = 'Strategy Signal') {
    // Calculate position size based on percentage of capital
    const positionSize = (state.currentCapital * state.positionSize) / 100;
    const entryPrice = candle.close;
    
    // Create new trade
    state.currentPosition = new Trade(
        candle.datetime,
        type,
        entryPrice,
        positionSize / entryPrice,
        reason
    );
    
    // Calculate risk levels
    updatePositionRiskLevels();
    
    // Update UI
    updatePositionInfo();
    const positionInfo = safeGetElement('position-info');
    if (positionInfo) positionInfo.style.display = 'block';
    
    // Send alert
    sendAlert(
        `New ${type} Position Opened`,
        `Opened ${type} position at $${entryPrice.toFixed(2)} with size ${positionSize.toFixed(2)} USDT (${reason})`,
        'success'
    );
    
    // Log the new position
    addLogMessage(`Opened ${type} position at $${entryPrice.toFixed(2)} with size ${positionSize.toFixed(2)} USDT (${reason})`);
    
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
    const pnl = state.currentPosition.close(new Date(), exitPrice, reason);
    
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
    
    // Remove floating position indicator
    const floatingIndicator = safeGetElement('floating-position-indicator');
    if (floatingIndicator) {
        floatingIndicator.remove();
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
        // Check for API credentials
        if (!state.liveTrading.apiKey || !state.liveTrading.apiSecret) {
            showApiConfigModal();
            return;
        }
        
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

// Initialize application
function initApp() {
    try {
        // Set current timestamp
        const currentTime = new Date("2025-06-11 21:28:13");
        
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
                
                // Generate signals using the volume and BB strategy
                const strategy = new VolumeAndBBStrategy(
                    state.volumeCandles,
                    state.volumeIncreasePercentage,
                    state.bbLength,
                    state.bbDeviation
                );
                state.indicators = strategy.generateSignals(state.priceData);
                state.signalHistory = strategy.signalHistory;
                
                // Update signal display

                
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
                
                // Log current price
                const priceMsg = `Current price for ${state.symbol}: $${state.currentPrice.toFixed(2)}`;
                const logElement = safeGetElement('logMessages');
                if (logElement) {
                    const timestamp = new Date().toLocaleTimeString();
                    const logItem = document.createElement('div');
                    logItem.className = 'log-message';
                    logItem.innerHTML = `<strong>${timestamp}</strong>: Current price: <span style="color:${UI_COLORS.highlight};font-weight:bold;">$${state.currentPrice.toFixed(2)}</span>`;
                    
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
    
    // Volume strategy settings
    const volumeCandles = safeGetElement('volume-candles');
    const volumeCandlesValue = safeGetElement('volume-candles-value');
    if (volumeCandles && volumeCandlesValue) {
        volumeCandles.value = state.volumeCandles;
        volumeCandlesValue.textContent = state.volumeCandles;
        
        volumeCandles.addEventListener('input', function() {
            state.volumeCandles = parseInt(this.value);
            volumeCandlesValue.textContent = state.volumeCandles;
        });
    }
    
    const volumeIncrease = safeGetElement('volume-increase');
    const volumeIncreaseValue = safeGetElement('volume-increase-value');
    if (volumeIncrease && volumeIncreaseValue) {
        volumeIncrease.value = state.volumeIncreasePercentage;
        volumeIncreaseValue.textContent = state.volumeIncreasePercentage;
        
        volumeIncrease.addEventListener('input', function() {
            state.volumeIncreasePercentage = parseInt(this.value);
            volumeIncreaseValue.textContent = state.volumeIncreasePercentage;
        });
    }
    
    // Bollinger Bands settings
    const bbLength = safeGetElement('bb-length');
    const bbLengthValue = safeGetElement('bb-length-value');
    if (bbLength && bbLengthValue) {
        bbLength.value = state.bbLength;
        bbLengthValue.textContent = state.bbLength;
        
        bbLength.addEventListener('input', function() {
            state.bbLength = parseInt(this.value);
            bbLengthValue.textContent = state.bbLength;
        });
    }
    
    const bbDev = safeGetElement('bb-dev');
    const bbDevValue = safeGetElement('bb-dev-value');
    if (bbDev && bbDevValue) {
        bbDev.value = state.bbDeviation;
        bbDevValue.textContent = state.bbDeviation;
        
        bbDev.addEventListener('input', function() {
            state.bbDeviation = parseFloat(this.value);
            bbDevValue.textContent = state.bbDeviation;
        });
    }
    
    // Risk Management
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
    
    const autoTradeToggle = safeGetElement('auto-trade-toggle');
    if (autoTradeToggle) {
        autoTradeToggle.checked = state.settings.autoTrade;
        
        autoTradeToggle.addEventListener('change', function() {
            state.settings.autoTrade = this.checked;
            addLogMessage(`Auto-trading ${this.checked ? 'enabled' : 'disabled'}`);
            saveSettings();
        });
    }
    
    // Show position lines toggle
    const showPositionLinesToggle = safeGetElement('show-position-lines-toggle');
    if (showPositionLinesToggle) {
        showPositionLinesToggle.checked = state.settings.showPositionLines;
        
        showPositionLinesToggle.addEventListener('change', function() {
            state.settings.showPositionLines = this.checked;
            addLogMessage(`Position indicators ${this.checked ? 'enabled' : 'disabled'}`);
            
            // Update position indicators if we have an active position
            if (state.currentPosition) {
                updatePositionInfo();
            }
            
            saveSettings();
        });
    }
    
    // API Configuration
    const apiKey = safeGetElement('api-key');
    const apiSecret = safeGetElement('api-secret');
    const saveApiBtn = safeGetElement('save-api-btn');
    const testApiBtn = safeGetElement('test-api-btn');
    
    if (apiKey && state.liveTrading.apiKey) {
        apiKey.value = state.liveTrading.apiKey;
    }
    
    if (apiSecret && state.liveTrading.apiSecret) {
        apiSecret.value = state.liveTrading.apiSecret;
    }
    
    if (saveApiBtn) {
        saveApiBtn.addEventListener('click', saveApiCredentials);
    }
    
    // Notification Settings
    const browserNotificationsToggle = safeGetElement('browser-notifications-toggle');
    const soundNotificationsToggle = safeGetElement('sound-notifications-toggle');
    const discordNotificationsToggle = safeGetElement('discord-notifications-toggle');
    const discordWebhook = safeGetElement('discord-webhook');
    const testDiscordBtn = safeGetElement('test-discord-btn');
    
    if (browserNotificationsToggle) {
        browserNotificationsToggle.checked = state.alerts.browser.enabled;
        browserNotificationsToggle.addEventListener('change', function() {
            state.alerts.browser.enabled = this.checked;
            if (this.checked && Notification.permission !== 'granted') {
                Notification.requestPermission();
            }
            saveSettings();
        });
    }
    
    if (soundNotificationsToggle) {
        soundNotificationsToggle.checked = state.alerts.sound.enabled;
        soundNotificationsToggle.addEventListener('change', function() {
            state.alerts.sound.enabled = this.checked;
            saveSettings();
        });
    }
    
    if (discordNotificationsToggle) {
        discordNotificationsToggle.checked = state.alerts.discord.enabled;
        discordNotificationsToggle.addEventListener('change', function() {
            state.alerts.discord.enabled = this.checked;
            if (discordWebhook) discordWebhook.disabled = !this.checked;
            saveSettings();
        });
    }
    
    if (discordWebhook) {
        discordWebhook.value = state.alerts.discord.webhook;
        discordWebhook.disabled = !state.alerts.discord.enabled;
        discordWebhook.addEventListener('change', function() {
            state.alerts.discord.webhook = this.value;
            saveSettings();
        });
    }
    
    if (testDiscordBtn) {
        testDiscordBtn.addEventListener('click', function() {
            const webhook = safeGetElement('discord-webhook').value;
            if (!webhook) {
                showStatusIndicator('Discord webhook URL is required', 'error');
                return;
            }
            
            // Save webhook temporarily
            const originalWebhook = state.alerts.discord.webhook;
            state.alerts.discord.webhook = webhook;
            
            // Send test notification
            sendDiscordNotification(
                'Discord Webhook Test',
                `This is a test notification from Volty Trading Bot.\nTimestamp: ${new Date().toISOString()}\nSymbol: ${state.symbol}`
            ).then(success => {
                if (success) {
                    showStatusIndicator('Discord webhook test successful', 'success');
                } else {
                    showStatusIndicator('Discord webhook test failed', 'error');
                }
                
                // Restore original webhook
                state.alerts.discord.webhook = originalWebhook;
            });
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
    
    if (startTradingBtn) {
        startTradingBtn.addEventListener('click', startTrading);
    }
    
    if (stopTradingBtn) {
        stopTradingBtn.addEventListener('click', stopTrading);
    }
    
    if (resetTradingBtn) {
        resetTradingBtn.addEventListener('click', resetTrading);
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
    
    // Sidebar toggle
    const sidebarToggle = safeGetElement('sidebar-toggle');
    const sidebar = safeGetElement('sidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('sidebar-collapsed');
            this.classList.toggle('collapsed');
        });
    }
    
    // Widget panel toggle
    const widgetPanelToggle = safeGetElement('widget-panel-toggle');
    const widgetPanel = safeGetElement('widget-panel');
    if (widgetPanelToggle && widgetPanel) {
        widgetPanelToggle.addEventListener('click', function() {
            widgetPanel.classList.toggle('open');
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Last modification: 2025-06-11 21:28:13 UTC by gelimorto2
