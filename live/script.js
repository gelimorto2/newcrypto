// Constants and Configuration
const API_URL = 'https://api.binance.com';
const API_KEY_STORAGE = 'binance_api_keys';
const SETTINGS_STORAGE = 'trading_settings';

// State variables
let apiKey = '';
let apiSecret = '';
let chartInstance = null;
let equityChartInstance = null;
let depthChartInstance = null;
let isTrading = false;
let currentPrice = 0;
let candleData = [];
let tradeHistory = [];
let equityHistory = [];
let currentPosition = null;
let websocket = null;
let orderBook = {
    bids: [],
    asks: []
};

// Cache DOM elements
const elements = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    setupEventListeners();
    updateClock();
    setInterval(updateClock, 1000);
    checkMobileDevice();
    loadSettings();
    checkStoredApiKeys();
});

// Cache frequently used DOM elements
function cacheElements() {
    // Main elements
    elements.loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    elements.apiKeyForm = document.getElementById('apiKeyForm');
    elements.apiKeyInput = document.getElementById('apiKey');
    elements.apiSecretInput = document.getElementById('apiSecret');
    elements.rememberKeysCheckbox = document.getElementById('rememberKeys');
    elements.usePaperTradingBtn = document.getElementById('usePaperTradingBtn');
    
    // Status and info elements
    elements.clockDisplay = document.getElementById('clock-display');
    elements.botStatus = document.getElementById('bot-status');
    elements.botActivity = document.getElementById('bot-activity');
    elements.activityStatus = document.getElementById('activity-status');
    elements.lastTickInfo = document.getElementById('last-tick-info');
    
    // Market data elements
    elements.marketPrice = document.getElementById('market-price');
    elements.marketChange = document.getElementById('market-change');
    elements.marketVolume = document.getElementById('market-volume');
    
    // Trading control elements
    elements.startTradingBtn = document.getElementById('start-trading-btn');
    elements.stopTradingBtn = document.getElementById('stop-trading-btn');
    elements.emergencySellBtn = document.getElementById('emergency-sell-btn');
    elements.logoutBtn = document.getElementById('logout-btn');
    
    // Chart elements
    elements.priceChart = document.getElementById('priceChart');
    elements.equityChart = document.getElementById('equityChart');
    elements.depthChart = document.getElementById('depthChart');
    
    // Settings elements
    elements.symbolSelect = document.getElementById('symbol');
    elements.timeframeSelect = document.getElementById('timeframe');
    elements.atrLength = document.getElementById('atr-length');
    elements.atrLengthValue = document.getElementById('atr-length-value');
    elements.atrMult = document.getElementById('atr-mult');
    elements.atrMultValue = document.getElementById('atr-mult-value');
    elements.accountBalance = document.getElementById('account-balance');
    elements.refreshBalanceBtn = document.getElementById('refresh-balance-btn');
    elements.positionSize = document.getElementById('position-size');
    elements.positionSizeValue = document.getElementById('position-size-value');
    
    // Metrics elements
    elements.totalReturn = document.getElementById('total-return');
    elements.totalReturnDelta = document.getElementById('total-return-delta');
    elements.winRate = document.getElementById('win-rate');
    elements.winRateDelta = document.getElementById('win-rate-delta');
    elements.profitFactor = document.getElementById('profit-factor');
    elements.profitFactorDelta = document.getElementById('profit-factor-delta');
    elements.maxDrawdown = document.getElementById('max-drawdown');
    elements.maxDrawdownDelta = document.getElementById('max-drawdown-delta');
    elements.maxWin = document.getElementById('max-win');
    elements.maxLoss = document.getElementById('max-loss');
    elements.currentBalance = document.getElementById('current-balance');
    elements.totalTrades = document.getElementById('total-trades');
    
    // Trade stats elements
    elements.statDailyTrades = document.getElementById('stat-daily-trades');
    elements.statDailyPnl = document.getElementById('stat-daily-pnl');
    elements.statExecution = document.getElementById('stat-execution');
    
    // Position card elements
    elements.positionCard = document.getElementById('position-card');
    elements.positionType = document.getElementById('position-type');
    elements.positionEntryPrice = document.getElementById('position-entry-price');
    elements.positionCurrentPrice = document.getElementById('position-current-price');
    elements.positionPnl = document.getElementById('position-pnl');
    elements.positionEntryTime = document.getElementById('position-entry-time');
    elements.positionSizeInfo = document.getElementById('position-size-info');
    elements.positionTp = document.getElementById('position-tp');
    elements.positionSl = document.getElementById('position-sl');
    
    // API settings elements
    elements.apiStatusBadge = document.getElementById('api-status-badge');
    elements.apiKeyMasked = document.getElementById('api-key-masked');
    elements.updateApiKeysBtn = document.getElementById('update-api-keys-btn');
    elements.removeApiKeysBtn = document.getElementById('remove-api-keys-btn');
    
    // Log messages
    elements.logMessages = document.getElementById('logMessages');
    
    // Trade history
    elements.tradeHistory = document.getElementById('tradeHistory').querySelector('tbody');
    
    // Loading indicator
    elements.loadingIndicator = document.getElementById('loadingIndicator');
}

// Setup event listeners
function setupEventListeners() {
    // API key form submission
    elements.apiKeyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const key = elements.apiKeyInput.value.trim();
        const secret = elements.apiSecretInput.value.trim();
        if (key && secret) {
            connectToApi(key, secret, elements.rememberKeysCheckbox.checked);
        }
    });
    
    // Switch to paper trading
    elements.usePaperTradingBtn.addEventListener('click', () => {
        window.location.href = '../paper/paper.html';
    });
    
    // Trading control buttons
    elements.startTradingBtn.addEventListener('click', startTrading);
    elements.stopTradingBtn.addEventListener('click', stopTrading);
    elements.emergencySellBtn.addEventListener('click', emergencySell);
    elements.logoutBtn.addEventListener('click', logout);
    
    // Settings updates
    elements.symbolSelect.addEventListener('change', () => {
        if (!isTrading) {
            fetchInitialData();
        } else {
            showAlert('Please stop trading before changing symbol', 'warning');
        }
    });
    
    elements.timeframeSelect.addEventListener('change', () => {
        if (!isTrading) {
            fetchInitialData();
        } else {
            showAlert('Please stop trading before changing timeframe', 'warning');
        }
    });
    
    // Range input updates
    elements.atrLength.addEventListener('input', () => {
        elements.atrLengthValue.textContent = elements.atrLength.value;
    });
    
    elements.atrMult.addEventListener('input', () => {
        elements.atrMultValue.textContent = elements.atrMult.value;
    });
    
    elements.positionSize.addEventListener('input', () => {
        elements.positionSizeValue.textContent = `${elements.positionSize.value}%`;
    });
    
    // Refresh balance button
    elements.refreshBalanceBtn.addEventListener('click', fetchAccountBalance);
    
    // API key management
    elements.updateApiKeysBtn.addEventListener('click', () => {
        elements.loginModal.show();
    });
    
    elements.removeApiKeysBtn.addEventListener('click', () => {
        localStorage.removeItem(API_KEY_STORAGE);
        showAlert('API keys removed. Please log in again.', 'warning');
        setTimeout(() => {
            logout();
        }, 2000);
    });
    
    // Save settings button
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
    
    // Theme toggle
    document.getElementById('theme-select').addEventListener('change', (e) => {
        const theme = e.target.value;
        document.body.className = `${theme}-theme`;
        saveSettings();
    });
}

// Check for stored API keys
function checkStoredApiKeys() {
    const storedKeys = localStorage.getItem(API_KEY_STORAGE);
    if (storedKeys) {
        try {
            const decrypted = JSON.parse(atob(storedKeys));
            apiKey = decrypted.key;
            apiSecret = decrypted.secret;
            validateApiKeys(apiKey, apiSecret);
        } catch (error) {
            console.error('Error decoding stored API keys:', error);
            showLoginModal();
        }
    } else {
        showLoginModal();
    }
}

// Show the login modal
function showLoginModal() {
    elements.loginModal.show();
}

// Connect to Binance API
function connectToApi(key, secret, remember) {
    showLoading(true);
    
    // Validate the API keys by making a test request
    validateApiKeys(key, secret)
        .then(() => {
            apiKey = key;
            apiSecret = secret;
            
            if (remember) {
                // Store encrypted API keys in local storage
                const encrypted = btoa(JSON.stringify({ key, secret }));
                localStorage.setItem(API_KEY_STORAGE, encrypted);
            }
            
            elements.loginModal.hide();
            initializeApp();
        })
        .catch(error => {
            console.error('API connection error:', error);
            showAlert('Failed to connect to Binance API. Please check your API keys.', 'danger');
        })
        .finally(() => {
            showLoading(false);
        });
}

// Validate API keys by making a test request
async function validateApiKeys(key, secret) {
    try {
        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}`;
        const signature = createSignature(queryString, secret);
        
        const response = await fetch(`${API_URL}/api/v3/account?${queryString}&signature=${signature}`, {
            method: 'GET',
            headers: {
                'X-MBX-APIKEY': key
            }
        });
        
        if (!response.ok) {
            throw new Error(`API request failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API validation error:', error);
        throw error;
    }
}

// Create HMAC SHA256 signature for API requests
function createSignature(queryString, secret) {
    return CryptoJS.HmacSHA256(queryString, secret).toString(CryptoJS.enc.Hex);
}

// Initialize the app after successful API connection
function initializeApp() {
    updateApiStatus(true);
    fetchAccountBalance();
    fetchInitialData();
    logMessage('Connected to Binance API successfully', 'success');
}

// Update API connection status display
function updateApiStatus(connected) {
    if (connected) {
        elements.apiStatusBadge.textContent = 'Connected';
        elements.apiStatusBadge.className = 'badge bg-success me-2';
        elements.apiKeyMasked.textContent = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
    } else {
        elements.apiStatusBadge.textContent = 'Disconnected';
        elements.apiStatusBadge.className = 'badge bg-danger me-2';
        elements.apiKeyMasked.textContent = '••••••••••••••••';
    }
}

// Fetch account balance from Binance
async function fetchAccountBalance() {
    if (!apiKey || !apiSecret) {
        showAlert('API keys are required to fetch balance', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}`;
        const signature = createSignature(queryString, apiSecret);
        
        const response = await fetch(`${API_URL}/api/v3/account?${queryString}&signature=${signature}`, {
            method: 'GET',
            headers: {
                'X-MBX-APIKEY': apiKey
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch account balance: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Find USDT balance
        const usdtBalance = data.balances.find(b => b.asset === 'USDT');
        const balance = parseFloat(usdtBalance ? usdtBalance.free : 0).toFixed(2);
        
        elements.accountBalance.value = balance;
        elements.currentBalance.textContent = `$${formatNumber(balance)}`;
        
        logMessage(`Account balance updated: $${balance}`, 'info');
    } catch (error) {
        console.error('Error fetching account balance:', error);
        showAlert('Failed to fetch account balance', 'danger');
    } finally {
        showLoading(false);
    }
}

// Fetch initial market data
async function fetchInitialData() {
    const symbol = elements.symbolSelect.value;
    const timeframe = elements.timeframeSelect.value;
    
    showLoading(true);
    
    try {
        // Fetch historical candles
        const response = await fetch(`${API_URL}/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=100`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch historical data: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Process candle data
        candleData = data.map(candle => ({
            time: candle[0] / 1000,
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
        }));
        
        // Update current price
        currentPrice = candleData[candleData.length - 1].close;
        
        // Update market data display
        updateMarketData(symbol);
        
        // Initialize charts
        initializeCharts();
        
        // Fetch order book data
        fetchOrderBook(symbol);
        
        logMessage(`Loaded historical data for ${symbol} (${timeframe})`, 'info');
    } catch (error) {
        console.error('Error fetching initial data:', error);
        showAlert('Failed to fetch market data', 'danger');
    } finally {
        showLoading(false);
    }
}

// Fetch order book data
async function fetchOrderBook(symbol) {
    try {
        const response = await fetch(`${API_URL}/api/v3/depth?symbol=${symbol}&limit=20`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch order book: ${response.status}`);
        }
        
        const data = await response.json();
        
        orderBook = {
            bids: data.bids.map(bid => ({
                price: parseFloat(bid[0]),
                volume: parseFloat(bid[1])
            })),
            asks: data.asks.map(ask => ({
                price: parseFloat(ask[0]),
                volume: parseFloat(ask[1])
            }))
        };
        
        updateDepthChart();
    } catch (error) {
        console.error('Error fetching order book:', error);
    }
}

// Update market data display
async function updateMarketData(symbol) {
    try {
        // Fetch 24h ticker data
        const response = await fetch(`${API_URL}/api/v3/ticker/24hr?symbol=${symbol}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch ticker data: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update market data display
        const price = parseFloat(data.lastPrice).toFixed(2);
        const change = parseFloat(data.priceChangePercent).toFixed(2);
        const volume = formatLargeNumber(parseFloat(data.quoteVolume));
        
        elements.marketPrice.textContent = `$${price}`;
        elements.marketChange.textContent = `${change}%`;
        elements.marketChange.className = 'market-value ' + (change >= 0 ? 'up' : 'down');
        elements.marketVolume.textContent = `$${volume}`;
        
        // Update current price
        currentPrice = parseFloat(data.lastPrice);
        
        // Update position info if there's an active position
        if (currentPosition) {
            updatePositionCard();
        }
    } catch (error) {
        console.error('Error updating market data:', error);
    }
}

// Initialize charts
function initializeCharts() {
    initializePriceChart();
    initializeEquityChart();
    initializeDepthChart();
}

// Initialize price chart
function initializePriceChart() {
    if (chartInstance) {
        chartInstance.remove();
    }
    
    const chart = LightweightCharts.createChart(elements.priceChart, {
        width: elements.priceChart.clientWidth,
        height: elements.priceChart.clientHeight,
        layout: {
            backgroundColor: 'transparent',
            textColor: '#d1d4dc',
        },
        grid: {
            vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
            horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: 'rgba(197, 203, 206, 0.8)',
        },
        timeScale: {
            borderColor: 'rgba(197, 203, 206, 0.8)',
            timeVisible: true,
            secondsVisible: false,
        },
    });

    const candleSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
    });

    candleSeries.setData(candleData);
    
    // Add volume series
    const volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
            type: 'volume',
        },
        priceScaleId: '',
        scaleMargins: {
            top: 0.8,
            bottom: 0,
        },
    });
    
    // Set volume data
    const volumeData = candleData.map(candle => ({
        time: candle.time,
        value: candle.volume,
        color: candle.close > candle.open ? '#26a69a' : '#ef5350',
    }));
    
    volumeSeries.setData(volumeData);
    
    // Add markers for trades
    if (tradeHistory.length > 0) {
        const markers = tradeHistory.map(trade => {
            return {
                time: trade.entryTime / 1000,
                position: trade.type === 'long' ? 'belowBar' : 'aboveBar',
                color: trade.type === 'long' ? '#26a69a' : '#ef5350',
                shape: trade.type === 'long' ? 'arrowUp' : 'arrowDown',
                text: trade.type === 'long' ? 'BUY' : 'SELL',
            };
        });
        
        candleSeries.setMarkers(markers);
    }
    
    // Handle window resize
    const resizeObserver = new ResizeObserver(() => {
        chart.applyOptions({
            width: elements.priceChart.clientWidth,
            height: elements.priceChart.clientHeight
        });
    });
    
    resizeObserver.observe(elements.priceChart);
    
    chartInstance = chart;
}

// Initialize equity chart
function initializeEquityChart() {
    if (equityChartInstance) {
        equityChartInstance.remove();
    }
    
    const chart = LightweightCharts.createChart(elements.equityChart, {
        width: elements.equityChart.clientWidth,
        height: elements.equityChart.clientHeight,
        layout: {
            backgroundColor: 'transparent',
            textColor: '#d1d4dc',
        },
        grid: {
            vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
            horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
        },
        rightPriceScale: {
            borderColor: 'rgba(197, 203, 206, 0.8)',
        },
        timeScale: {
            borderColor: 'rgba(197, 203, 206, 0.8)',
            timeVisible: true,
        },
    });
    
    const lineSeries = chart.addLineSeries({
        color: '#3b82f6',
        lineWidth: 2,
    });
    
    // Initialize with starting balance if no equity history
    if (equityHistory.length === 0) {
        const startingBalance = parseFloat(elements.accountBalance.value);
        equityHistory.push({
            time: Math.floor(Date.now() / 1000),
            value: startingBalance
        });
    }
    
    lineSeries.setData(equityHistory);
    
    // Handle window resize
    const resizeObserver = new ResizeObserver(() => {
        chart.applyOptions({
            width: elements.equityChart.clientWidth,
            height: elements.equityChart.clientHeight
        });
    });
    
    resizeObserver.observe(elements.equityChart);
    
    equityChartInstance = chart;
}

// Initialize depth chart
function initializeDepthChart() {
    if (depthChartInstance) {
        depthChartInstance.remove();
    }
    
    const chart = LightweightCharts.createChart(elements.depthChart, {
        width: elements.depthChart.clientWidth,
        height: elements.depthChart.clientHeight,
        layout: {
            backgroundColor: 'transparent',
            textColor: '#d1d4dc',
        },
        grid: {
            vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
            horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
        },
        rightPriceScale: {
            borderColor: 'rgba(197, 203, 206, 0.8)',
        },
    });
    
    const bidSeries = chart.addAreaSeries({
        topColor: 'rgba(38, 166, 154, 0.4)',
        bottomColor: 'rgba(38, 166, 154, 0.0)',
        lineColor: 'rgba(38, 166, 154, 1)',
        lineWidth: 2,
    });
    
    const askSeries = chart.addAreaSeries({
        topColor: 'rgba(239, 83, 80, 0.4)',
        bottomColor: 'rgba(239, 83, 80, 0.0)',
        lineColor: 'rgba(239, 83, 80, 1)',
        lineWidth: 2,
    });
    
    // Handle window resize
    const resizeObserver = new ResizeObserver(() => {
        chart.applyOptions({
            width: elements.depthChart.clientWidth,
            height: elements.depthChart.clientHeight
        });
    });
    
    resizeObserver.observe(elements.depthChart);
    
    depthChartInstance = {
        chart,
        bidSeries,
        askSeries,
        remove: () => {
            chart.remove();
            resizeObserver.disconnect();
        }
    };
    
    updateDepthChart();
}

// Update depth chart with order book data
function updateDepthChart() {
    if (!depthChartInstance) return;
    
    const { bidSeries, askSeries } = depthChartInstance;
    
    // Calculate cumulative volumes
    let cumulativeBids = [];
    let cumulativeAsks = [];
    
    let bidVolume = 0;
    let askVolume = 0;
    
    for (let i = 0; i < orderBook.bids.length; i++) {
        bidVolume += orderBook.bids[i].volume;
        cumulativeBids.push({
            value: bidVolume,
            price: orderBook.bids[i].price
        });
    }
    
    for (let i = 0; i < orderBook.asks.length; i++) {
        askVolume += orderBook.asks[i].volume;
        cumulativeAsks.push({
            value: askVolume,
            price: orderBook.asks[i].price
        });
    }
    
    // Convert to series data
    const bidData = cumulativeBids.map(bid => ({
        value: bid.value,
        time: bid.price
    }));
    
    const askData = cumulativeAsks.map(ask => ({
        value: ask.value,
        time: ask.price
    }));
    
    // Set data to series
    bidSeries.setData(bidData);
    askSeries.setData(askData);
}

// Start trading
function startTrading() {
    if (isTrading) return;
    
    if (!apiKey || !apiSecret) {
        showAlert('API keys are required to start trading', 'warning');
        return;
    }
    
    const symbol = elements.symbolSelect.value;
    const timeframe = elements.timeframeSelect.value;
    
    // Connect to WebSocket for real-time price updates
    connectToWebSocket(symbol.toLowerCase());
    
    // Update UI
    isTrading = true;
    elements.botStatus.textContent = '🔴 LIVE TRADING - ACTIVE';
    elements.botStatus.classList.remove('idle');
    elements.botStatus.classList.add('active');
    elements.botActivity.classList.remove('scanning', 'waiting');
    elements.botActivity.classList.add('trading');
    elements.activityStatus.textContent = 'Trading Active';
    
    // Enable/disable buttons
    elements.startTradingBtn.disabled = true;
    elements.stopTradingBtn.disabled = false;
    elements.emergencySellBtn.disabled = false;
    elements.symbolSelect.disabled = true;
    elements.timeframeSelect.disabled = true;
    
    // Disable strategy parameters
    elements.atrLength.disabled = true;
    elements.atrMult.disabled = true;
    
    logMessage(`Started live trading on ${symbol} (${timeframe})`, 'success');
    showAlert('Live trading started. Be cautious with real funds!', 'info');
}

// Connect to WebSocket for real-time data
function connectToWebSocket(symbol) {
    if (websocket) {
        websocket.close();
    }
    
    const streamName = `${symbol}@kline_1m`;
    websocket = new WebSocket(`wss://stream.binance.com:9443/ws/${streamName}`);
    
    websocket.onopen = () => {
        console.log('WebSocket connected');
        logMessage('Connected to Binance WebSocket', 'info');
    };
    
    websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.e === 'kline') {
            const candle = data.k;
            const currentTime = new Date().toISOString();
            
            // Update current price
            currentPrice = parseFloat(candle.c);
            elements.marketPrice.textContent = `$${formatNumber(currentPrice)}`;
            
            // Update last tick info
            elements.lastTickInfo.textContent = `Last update: ${formatTime(new Date())}`;
            
            // Update position if exists
            if (currentPosition) {
                updatePositionCard();
            }
            
            // Execute trading strategy
            if (isTrading) {
                executeStrategy();
            }
        }
    };
    
    websocket.onclose = () => {
        console.log('WebSocket disconnected');
    };
    
    websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        logMessage('WebSocket connection error', 'error');
    };
}

// Execute trading strategy
function executeStrategy() {
    if (!isTrading || !candleData.length) return;
    
    const startTime = performance.now();
    const atrLength = parseInt(elements.atrLength.value);
    const atrMult = parseFloat(elements.atrMult.value);
    
    // Calculate ATR
    const atr = calculateATR(candleData, atrLength);
    
    // Simple example strategy - Volty with ATR
    const lastCandle = candleData[candleData.length - 1];
    const prevCandle = candleData[candleData.length - 2];
    
    if (!currentPosition) {
        // Check for entry signal
        if (lastCandle.close > prevCandle.close + (atr * atrMult)) {
            // Long signal
            openLongPosition();
        } else if (lastCandle.close < prevCandle.close - (atr * atrMult)) {
            // Short signal
            openShortPosition();
        }
    } else {
        // Check for exit signal
        if (currentPosition.type === 'long') {
            if (lastCandle.close < prevCandle.close - (atr * atrMult)) {
                closePosition();
            }
        } else if (currentPosition.type === 'short') {
            if (lastCandle.close > prevCandle.close + (atr * atrMult)) {
                closePosition();
            }
        }
        
        // Check stop loss and take profit
        checkStopLossAndTakeProfit();
    }
    
    const endTime = performance.now();
    const executionTime = Math.round(endTime - startTime);
    elements.statExecution.textContent = `${executionTime}ms`;
}

// Calculate ATR (Average True Range)
function calculateATR(data, length) {
    if (data.length < length + 1) return 0;
    
    const trueRanges = [];
    
    for (let i = 1; i < data.length; i++) {
        const current = data[i];
        const previous = data[i - 1];
        
        const tr1 = current.high - current.low;
        const tr2 = Math.abs(current.high - previous.close);
        const tr3 = Math.abs(current.low - previous.close);
        
        const trueRange = Math.max(tr1, tr2, tr3);
        trueRanges.push(trueRange);
    }
    
    // Calculate ATR as simple moving average of true ranges
    const atr = trueRanges.slice(-length).reduce((sum, tr) => sum + tr, 0) / length;
    
    return atr;
}

// Open a long position
async function openLongPosition() {
    if (currentPosition) return;
    
    const symbol = elements.symbolSelect.value;
    const positionSizePercent = parseInt(elements.positionSize.value) / 100;
    const accountBalance = parseFloat(elements.accountBalance.value);
    const positionSize = accountBalance * positionSizePercent;
    
    const takeProfitPercent = parseFloat(document.getElementById('take-profit-value').value) / 100;
    const stopLossPercent = parseFloat(document.getElementById('stop-loss-value').value) / 100;
    
    const quantity = (positionSize / currentPrice).toFixed(6);
    const takeProfitPrice = (currentPrice * (1 + takeProfitPercent)).toFixed(2);
    const stopLossPrice = (currentPrice * (1 - stopLossPercent)).toFixed(2);
    
    showLoading(true);
    
    try {
        // Create a market buy order
        const timestamp = Date.now();
        const queryString = `symbol=${symbol}&side=BUY&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;
        const signature = createSignature(queryString, apiSecret);
        
        const response = await fetch(`${API_URL}/api/v3/order?${queryString}&signature=${signature}`, {
            method: 'POST',
            headers: {
                'X-MBX-APIKEY': apiKey
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to open long position: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Create position object
        currentPosition = {
            type: 'long',
            entryPrice: parseFloat(data.fills[0].price),
            entryTime: Date.now(),
            quantity: parseFloat(quantity),
            takeProfitPrice: parseFloat(takeProfitPrice),
            stopLossPrice: parseFloat(stopLossPrice),
            orderId: data.orderId
        };
        
        updatePositionCard();
        logMessage(`Opened LONG position: ${quantity} ${symbol} at $${currentPosition.entryPrice}`, 'success');
        showAlert(`Long position opened at $${currentPosition.entryPrice}`, 'success');
        
        // Create TP and SL orders if enabled
        if (document.getElementById('take-profit-toggle').checked) {
            createTakeProfitOrder(symbol, quantity, takeProfitPrice);
        }
        
        if (document.getElementById('stop-loss-toggle').checked) {
            createStopLossOrder(symbol, quantity, stopLossPrice);
        }
        
    } catch (error) {
        console.error('Error opening long position:', error);
        logMessage(`Failed to open long position: ${error.message}`, 'error');
        showAlert('Failed to open long position', 'danger');
    } finally {
        showLoading(false);
    }
}

// Open a short position
async function openShortPosition() {
    if (currentPosition) return;
    
    const symbol = elements.symbolSelect.value;
    const positionSizePercent = parseInt(elements.positionSize.value) / 100;
    const accountBalance = parseFloat(elements.accountBalance.value);
    const positionSize = accountBalance * positionSizePercent;
    
    const takeProfitPercent = parseFloat(document.getElementById('take-profit-value').value) / 100;
    const stopLossPercent = parseFloat(document.getElementById('stop-loss-value').value) / 100;
    
    const quantity = (positionSize / currentPrice).toFixed(6);
    const takeProfitPrice = (currentPrice * (1 - takeProfitPercent)).toFixed(2);
    const stopLossPrice = (currentPrice * (1 + stopLossPercent)).toFixed(2);
    
    showLoading(true);
    
    try {
        // Create a market sell order
        const timestamp = Date.now();
        const queryString = `symbol=${symbol}&side=SELL&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;
        const signature = createSignature(queryString, apiSecret);
        
        const response = await fetch(`${API_URL}/api/v3/order?${queryString}&signature=${signature}`, {
            method: 'POST',
            headers: {
                'X-MBX-APIKEY': apiKey
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to open short position: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Create position object
        currentPosition = {
            type: 'short',
            entryPrice: parseFloat(data.fills[0].price),
            entryTime: Date.now(),
            quantity: parseFloat(quantity),
            takeProfitPrice: parseFloat(takeProfitPrice),
            stopLossPrice: parseFloat(stopLossPrice),
            orderId: data.orderId
        };
        
        updatePositionCard();
        logMessage(`Opened SHORT position: ${quantity} ${symbol} at $${currentPosition.entryPrice}`, 'success');
        showAlert(`Short position opened at $${currentPosition.entryPrice}`, 'success');
        
        // Create TP and SL orders if enabled
        if (document.getElementById('take-profit-toggle').checked) {
            createTakeProfitOrder(symbol, quantity, takeProfitPrice, 'short');
        }
        
        if (document.getElementById('stop-loss-toggle').checked) {
            createStopLossOrder(symbol, quantity, stopLossPrice, 'short');
        }
        
    } catch (error) {
        console.error('Error opening short position:', error);
        logMessage(`Failed to open short position: ${error.message}`, 'error');
        showAlert('Failed to open short position', 'danger');
    } finally {
        showLoading(false);
    }
}

// Create a take profit order
async function createTakeProfitOrder(symbol, quantity, price, positionType = 'long') {
    try {
        const side = positionType === 'long' ? 'SELL' : 'BUY';
        const timestamp = Date.now();
        const queryString = `symbol=${symbol}&side=${side}&type=LIMIT&timeInForce=GTC&quantity=${quantity}&price=${price}&timestamp=${timestamp}`;
        const signature = createSignature(queryString, apiSecret);
        
        const response = await fetch(`${API_URL}/api/v3/order?${queryString}&signature=${signature}`, {
            method: 'POST',
            headers: {
                'X-MBX-APIKEY': apiKey
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to create take profit order: ${response.status}`);
        }
        
        const data = await response.json();
        currentPosition.takeProfitOrderId = data.orderId;
        
        logMessage(`Take profit order set at $${price}`, 'info');
    } catch (error) {
        console.error('Error creating take profit order:', error);
        logMessage(`Failed to set take profit: ${error.message}`, 'error');
    }
}

// Create a stop loss order
async function createStopLossOrder(symbol, quantity, price, positionType = 'long') {
    try {
        const side = positionType === 'long' ? 'SELL' : 'BUY';
        const timestamp = Date.now();
        const queryString = `symbol=${symbol}&side=${side}&type=STOP_LOSS_LIMIT&timeInForce=GTC&quantity=${quantity}&price=${price}&stopPrice=${price}&timestamp=${timestamp}`;
        const signature = createSignature(queryString, apiSecret);
        
        const response = await fetch(`${API_URL}/api/v3/order?${queryString}&signature=${signature}`, {
            method: 'POST',
            headers: {
                'X-MBX-APIKEY': apiKey
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to create stop loss order: ${response.status}`);
        }
        
        const data = await response.json();
        currentPosition.stopLossOrderId = data.orderId;
        
        logMessage(`Stop loss order set at $${price}`, 'info');
    } catch (error) {
        console.error('Error creating stop loss order:', error);
        logMessage(`Failed to set stop loss: ${error.message}`, 'error');
    }
}

// Close the current position
async function closePosition() {
    if (!currentPosition) return;
    
    const symbol = elements.symbolSelect.value;
    const quantity = currentPosition.quantity;
    
    showLoading(true);
    
    try {
        // Cancel any open take profit or stop loss orders
        if (currentPosition.takeProfitOrderId) {
            await cancelOrder(symbol, currentPosition.takeProfitOrderId);
        }
        
        if (currentPosition.stopLossOrderId) {
            await cancelOrder(symbol, currentPosition.stopLossOrderId);
        }
        
        // Create a market order to close the position
        const side = currentPosition.type === 'long' ? 'SELL' : 'BUY';
        const timestamp = Date.now();
        const queryString = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;
        const signature = createSignature(queryString, apiSecret);
        
        const response = await fetch(`${API_URL}/api/v3/order?${queryString}&signature=${signature}`, {
            method: 'POST',
            headers: {
                'X-MBX-APIKEY': apiKey
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to close position: ${response.status}`);
        }
        
        const data = await response.json();
        const exitPrice = parseFloat(data.fills[0].price);
        
        // Calculate profit/loss
        const pnl = currentPosition.type === 'long' 
            ? (exitPrice - currentPosition.entryPrice) * quantity
            : (currentPosition.entryPrice - exitPrice) * quantity;
        
        const pnlPercent = (pnl / (currentPosition.entryPrice * quantity)) * 100;
        
        // Add to trade history
        const trade = {
            entryTime: currentPosition.entryTime,
            exitTime: Date.now(),
            type: currentPosition.type,
            entryPrice: currentPosition.entryPrice,
            exitPrice: exitPrice,
            quantity: quantity,
            pnl: pnl,
            pnlPercent: pnlPercent
        };
        
        tradeHistory.push(trade);
        updateTradeHistory();
        updateStatistics();
        
        // Update equity history
        updateEquityHistory();
        
        logMessage(`Closed ${currentPosition.type.toUpperCase()} position: ${quantity} ${symbol} at $${exitPrice} (P&L: $${pnl.toFixed(2)})`, 
            pnl >= 0 ? 'success' : 'warning');
        
        showAlert(`Position closed with ${pnl >= 0 ? 'profit' : 'loss'}: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`, 
            pnl >= 0 ? 'success' : 'warning');
        
        // Clear current position
        currentPosition = null;
        elements.positionCard.style.display = 'none';
        
        // Refresh account balance
        fetchAccountBalance();
        
    } catch (error) {
        console.error('Error closing position:', error);
        logMessage(`Failed to close position: ${error.message}`, 'error');
        showAlert('Failed to close position', 'danger');
    } finally {
        showLoading(false);
    }
}

// Cancel an order
async function cancelOrder(symbol, orderId) {
    try {
        const timestamp = Date.now();
        const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
        const signature = createSignature(queryString, apiSecret);
        
        const response = await fetch(`${API_URL}/api/v3/order?${queryString}&signature=${signature}`, {
            method: 'DELETE',
            headers: {
                'X-MBX-APIKEY': apiKey
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to cancel order: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error canceling order:', error);
        return null;
    }
}

// Emergency sell - force close any open position
function emergencySell() {
    if (!currentPosition) {
        showAlert('No active position to close', 'warning');
        return;
    }
    
    // Confirm before executing
    if (confirm('⚠️ EMERGENCY SELL: Are you sure you want to close your position immediately?')) {
        logMessage('EMERGENCY SELL triggered by user', 'warning');
        closePosition();
    }
}

// Check stop loss and take profit levels
function checkStopLossAndTakeProfit() {
    if (!currentPosition || !currentPrice) return;
    
    const stopLossPercent = parseFloat(document.getElementById('stop-loss-value').value) / 100;
    const takeProfitPercent = parseFloat(document.getElementById('take-profit-value').value) / 100;
    
    if (currentPosition.type === 'long') {
        // Check stop loss
        if (currentPrice <= currentPosition.entryPrice * (1 - stopLossPercent)) {
            logMessage(`Stop loss triggered at $${currentPrice}`, 'warning');
            closePosition();
            return;
        }
        
        // Check take profit
        if (currentPrice >= currentPosition.entryPrice * (1 + takeProfitPercent)) {
            logMessage(`Take profit triggered at $${currentPrice}`, 'success');
            closePosition();
            return;
        }
    } else if (currentPosition.type === 'short') {
        // Check stop loss
        if (currentPrice >= currentPosition.entryPrice * (1 + stopLossPercent)) {
            logMessage(`Stop loss triggered at $${currentPrice}`, 'warning');
            closePosition();
            return;
        }
        
        // Check take profit
        if (currentPrice <= currentPosition.entryPrice * (1 - takeProfitPercent)) {
            logMessage(`Take profit triggered at $${currentPrice}`, 'success');
            closePosition();
            return;
        }
    }
}

// Update position card with current position details
function updatePositionCard() {
    if (!currentPosition || !currentPrice) return;
    
    elements.positionCard.style.display = 'block';
    elements.positionType.textContent = currentPosition.type.toUpperCase();
    elements.positionType.className = 'metric-value ' + (currentPosition.type === 'long' ? 'positive' : 'negative');
    
    elements.positionEntryPrice.textContent = `$${formatNumber(currentPosition.entryPrice)}`;
    elements.positionCurrentPrice.textContent = `$${formatNumber(currentPrice)}`;
    
    // Calculate unrealized P&L
    const unrealizedPnl = currentPosition.type === 'long'
        ? (currentPrice - currentPosition.entryPrice) * currentPosition.quantity
        : (currentPosition.entryPrice - currentPrice) * currentPosition.quantity;
    
    const pnlPercent = (unrealizedPnl / (currentPosition.entryPrice * currentPosition.quantity)) * 100;
    
    elements.positionPnl.textContent = `$${formatNumber(unrealizedPnl)} (${pnlPercent.toFixed(2)}%)`;
    elements.positionPnl.className = 'metric-value ' + (unrealizedPnl >= 0 ? 'positive' : 'negative');
    
    elements.positionEntryTime.textContent = formatDateTime(new Date(currentPosition.entryTime));
    elements.positionSizeInfo.textContent = currentPosition.quantity;
    elements.positionTp.textContent = `$${formatNumber(currentPosition.takeProfitPrice)}`;
    elements.positionSl.textContent = `$${formatNumber(currentPosition.stopLossPrice)}`;
}

// Update trade history table
function updateTradeHistory() {
    elements.tradeHistory.innerHTML = '';
    
    tradeHistory.slice().reverse().forEach((trade, index) => {
        const row = document.createElement('tr');
        row.className = trade.pnl >= 0 ? 'trade-long' : 'trade-short';
        
        row.innerHTML = `
            <td>${tradeHistory.length - index}</td>
            <td>${formatDateTime(new Date(trade.entryTime))}</td>
            <td>${formatDateTime(new Date(trade.exitTime))}</td>
            <td>${trade.type.toUpperCase()}</td>
            <td>$${formatNumber(trade.entryPrice)}</td>
            <td>$${formatNumber(trade.exitPrice)}</td>
            <td>${trade.quantity}</td>
            <td class="${trade.pnl >= 0 ? 'positive' : 'negative'}">$${formatNumber(trade.pnl)}</td>
            <td class="${trade.pnl >= 0 ? 'positive' : 'negative'}">${trade.pnlPercent.toFixed(2)}%</td>
        `;
        
        elements.tradeHistory.appendChild(row);
    });
}

// Update equity history
function updateEquityHistory() {
    const balance = parseFloat(elements.accountBalance.value);
    
    equityHistory.push({
        time: Math.floor(Date.now() / 1000),
        value: balance
    });
    
    // Update equity chart
    if (equityChartInstance) {
        const lineSeries = equityChartInstance.series()[0];
        lineSeries.setData(equityHistory);
    }
}

// Update trading statistics
function updateStatistics() {
    if (tradeHistory.length === 0) return;
    
    // Calculate statistics
    const totalTrades = tradeHistory.length;
    const winningTrades = tradeHistory.filter(trade => trade.pnl > 0).length;
    const losingTrades = totalTrades - winningTrades;
    
    const winRate = (winningTrades / totalTrades) * 100;
    
    const grossProfit = tradeHistory
        .filter(trade => trade.pnl > 0)
        .reduce((sum, trade) => sum + trade.pnl, 0);
    
    const grossLoss = Math.abs(tradeHistory
        .filter(trade => trade.pnl < 0)
        .reduce((sum, trade) => sum + trade.pnl, 0));
    
    const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
    
    const maxWin = Math.max(...tradeHistory.map(trade => trade.pnl));
    const maxLoss = Math.min(...tradeHistory.map(trade => trade.pnl));
    
    // Calculate drawdown
    let maxDrawdown = 0;
    let peak = 0;
    
    equityHistory.forEach(point => {
        if (point.value > peak) {
            peak = point.value;
        }
        
        const drawdown = ((peak - point.value) / peak) * 100;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    });
    
    // Calculate daily statistics
    const today = new Date().setHours(0, 0, 0, 0);
    const todayTrades = tradeHistory.filter(trade => new Date(trade.exitTime).setHours(0, 0, 0, 0) === today);
    const dailyPnl = todayTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    
    // Update UI
    elements.totalTrades.textContent = totalTrades;
    elements.winRate.textContent = `${winRate.toFixed(1)}%`;
    elements.winRateDelta.textContent = `${winningTrades}W / ${losingTrades}L`;
    
    elements.profitFactor.textContent = profitFactor.toFixed(2);
    elements.profitFactorDelta.textContent = `Avg: $${(grossProfit / winningTrades).toFixed(2)}`;
    
    elements.maxWin.textContent = `$${formatNumber(maxWin)}`;
    elements.maxLoss.textContent = `$${formatNumber(maxLoss)}`;
    
    elements.maxDrawdown.textContent = `${maxDrawdown.toFixed(2)}%`;
    
    // Update daily stats
    elements.statDailyTrades.textContent = todayTrades.length;
    elements.statDailyPnl.textContent = `$${formatNumber(dailyPnl)}`;
    elements.statDailyPnl.className = 'stat-value ' + (dailyPnl >= 0 ? 'positive' : 'negative');
    
    // Calculate total return
    const initialBalance = equityHistory[0]?.value || 10000;
    const currentBalance = parseFloat(elements.accountBalance.value);
    const totalReturn = ((currentBalance - initialBalance) / initialBalance) * 100;
    
    elements.totalReturn.textContent = `${totalReturn.toFixed(2)}%`;
    elements.totalReturnDelta.textContent = `$${formatNumber(currentBalance - initialBalance)}`;
    elements.totalReturn.className = 'metric-value ' + (totalReturn >= 0 ? 'positive' : 'negative');
    elements.totalReturnDelta.className = 'metric-delta ' + (totalReturn >= 0 ? 'positive' : 'negative');
}

// Stop trading
function stopTrading() {
    if (!isTrading) return;
    
    // Disconnect WebSocket
    if (websocket) {
        websocket.close();
        websocket = null;
    }
    
    // Update UI
    isTrading = false;
    elements.botStatus.textContent = '🔴 LIVE TRADING - IDLE';
    elements.botStatus.classList.remove('active');
    elements.botStatus.classList.add('idle');
    elements.botActivity.classList.remove('trading');
    elements.botActivity.classList.add('waiting');
    elements.activityStatus.textContent = 'Trading Stopped';
    
    // Enable/disable buttons
    elements.startTradingBtn.disabled = false;
    elements.stopTradingBtn.disabled = true;
    elements.emergencySellBtn.disabled = true;
    elements.symbolSelect.disabled = false;
    elements.timeframeSelect.disabled = false;
    
    // Enable strategy parameters
    elements.atrLength.disabled = false;
    elements.atrMult.disabled = false;
    
    logMessage('Trading stopped', 'warning');
    showAlert('Trading has been stopped', 'warning');
}

// Logout from the application
function logout() {
    // Disconnect WebSocket
    if (websocket) {
        websocket.close();
    }
    
    // Stop trading if active
    if (isTrading) {
        stopTrading();
    }
    
    // Clear API keys
    apiKey = '';
    apiSecret = '';
    
    // Update UI
    updateApiStatus(false);
    
    // Show login modal
    showLoginModal();
    
    logMessage('Logged out', 'info');
}

// Save settings to local storage
function saveSettings() {
    const settings = {
        theme: document.getElementById('theme-select').value,
        symbol: elements.symbolSelect.value,
        timeframe: elements.timeframeSelect.value,
        atrLength: elements.atrLength.value,
        atrMult: elements.atrMult.value,
        positionSize: elements.positionSize.value,
        takeProfit: document.getElementById('take-profit-value').value,
        stopLoss: document.getElementById('stop-loss-value').value,
        trailingStop: document.getElementById('trailing-stop-value').value,
        maxDrawdown: document.getElementById('max-drawdown-value').value,
        maxDailyLoss: document.getElementById('max-daily-loss-value').value,
        chartUpdateFrequency: document.getElementById('chart-update-frequency').value,
        toggles: {
            autoTrade: document.getElementById('auto-trade-toggle').checked,
            trailingStop: document.getElementById('trailing-stop-toggle').checked,
            takeProfit: document.getElementById('take-profit-toggle').checked,
            stopLoss: document.getElementById('stop-loss-toggle').checked,
            riskManagement: document.getElementById('risk-management-toggle').checked,
            discordAlert: document.getElementById('discord-alert-toggle').checked,
            telegramAlert: document.getElementById('telegram-alert-toggle').checked,
            emailAlert: document.getElementById('email-alert-toggle').checked,
            browserAlert: document.getElementById('browser-alert-toggle').checked,
            soundAlert: document.getElementById('sound-alert-toggle').checked
        },
        alerts: {
            discordWebhook: document.getElementById('discord-webhook-input').value,
            telegramToken: document.getElementById('telegram-token-input').value,
            telegramChatId: document.getElementById('telegram-chatid-input').value,
            emailAddress: document.getElementById('email-address-input').value,
            soundVolume: document.getElementById('sound-volume-input').value
        }
    };
    
    localStorage.setItem(SETTINGS_STORAGE, JSON.stringify(settings));
    showAlert('Settings saved successfully', 'success');
}

// Load settings from local storage
function loadSettings() {
    const storedSettings = localStorage.getItem(SETTINGS_STORAGE);
    if (!storedSettings) return;
    
    try {
        const settings = JSON.parse(storedSettings);
        
        // Apply theme
        document.getElementById('theme-select').value = settings.theme || 'dark';
        document.body.className = `${settings.theme || 'dark'}-theme`;
        
        // Apply data settings
        elements.symbolSelect.value = settings.symbol || 'BTCUSDT';
        elements.timeframeSelect.value = settings.timeframe || '1h';
        
        // Apply strategy parameters
        elements.atrLength.value = settings.atrLength || 5;
        elements.atrLengthValue.textContent = settings.atrLength || 5;
        elements.atrMult.value = settings.atrMult || 0.75;
        elements.atrMultValue.textContent = settings.atrMult || 0.75;
        
        // Apply trading settings
        elements.positionSize.value = settings.positionSize || 10;
        elements.positionSizeValue.textContent = `${settings.positionSize || 10}%`;
        
        document.getElementById('take-profit-value').value = settings.takeProfit || 3.0;
        document.getElementById('stop-loss-value').value = settings.stopLoss || 2.0;
        document.getElementById('trailing-stop-value').value = settings.trailingStop || 1.5;
        document.getElementById('max-drawdown-value').value = settings.maxDrawdown || 10;
        document.getElementById('max-daily-loss-value').value = settings.maxDailyLoss || 5;
        document.getElementById('chart-update-frequency').value = settings.chartUpdateFrequency || 5;
        
        // Apply toggles
        if (settings.toggles) {
            document.getElementById('auto-trade-toggle').checked = settings.toggles.autoTrade;
            document.getElementById('trailing-stop-toggle').checked = settings.toggles.trailingStop;
            document.getElementById('take-profit-toggle').checked = settings.toggles.takeProfit;
            document.getElementById('stop-loss-toggle').checked = settings.toggles.stopLoss;
            document.getElementById('risk-management-toggle').checked = settings.toggles.riskManagement;
            document.getElementById('discord-alert-toggle').checked = settings.toggles.discordAlert;
            document.getElementById('telegram-alert-toggle').checked = settings.toggles.telegramAlert;
            document.getElementById('email-alert-toggle').checked = settings.toggles.emailAlert;
            document.getElementById('browser-alert-toggle').checked = settings.toggles.browserAlert;
            document.getElementById('sound-alert-toggle').checked = settings.toggles.soundAlert;
        }
        
        // Apply alert settings
        if (settings.alerts) {
            document.getElementById('discord-webhook-input').value = settings.alerts.discordWebhook || '';
            document.getElementById('telegram-token-input').value = settings.alerts.telegramToken || '';
            document.getElementById('telegram-chatid-input').value = settings.alerts.telegramChatId || '';
            document.getElementById('email-address-input').value = settings.alerts.emailAddress || '';
            document.getElementById('sound-volume-input').value = settings.alerts.soundVolume || 0.5;
        }
        
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Update the clock display
function updateClock() {
    const now = new Date();
    elements.clockDisplay.textContent = formatDateTime(now);
}

// Check if the device is mobile
function checkMobileDevice() {
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        document.getElementById('mobile-info').style.display = 'block';
    }
}

// Show or hide loading indicator
function showLoading(show) {
    elements.loadingIndicator.style.display = show ? 'flex' : 'none';
}

// Show alert message
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.setAttribute('role', 'alert');
    
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.querySelector('.container-fluid').insertBefore(alertDiv, document.querySelector('.row'));
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 300);
    }, 5000);
}

// Add log message
function logMessage(message, type = 'info') {
    const logDiv = document.createElement('div');
    logDiv.className = `log-message ${type}`;
    
    logDiv.innerHTML = `
        <span class="log-time">${formatTime(new Date())}</span>
        <span class="log-text">${message}</span>
    `;
    
    elements.logMessages.appendChild(logDiv);
    elements.logMessages.scrollTop = elements.logMessages.scrollHeight;
    
    // Limit log messages to 100
    while (elements.logMessages.children.length > 100) {
        elements.logMessages.removeChild(elements.logMessages.firstChild);
    }
}

// Format date and time
function formatDateTime(date) {
    return date.toISOString().replace('T', ' ').split('.')[0] + ' UTC';
}

// Format time only
function formatTime(date) {
    return date.toTimeString().split(' ')[0];
}

// Format number with commas
function formatNumber(number) {
    return parseFloat(number).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Format large numbers with K, M, B suffixes
function formatLargeNumber(number) {
    if (number >= 1000000000) {
        return (number / 1000000000).toFixed(2) + 'B';
    } else if (number >= 1000000) {
        return (number / 1000000).toFixed(2) + 'M';
    } else if (number >= 1000) {
        return (number / 1000).toFixed(2) + 'K';
    } else {
        return number.toFixed(2);
    }
}

// Window resize event handler
window.addEventListener('resize', () => {
    if (chartInstance) {
        chartInstance.applyOptions({
            width: elements.priceChart.clientWidth,
            height: elements.priceChart.clientHeight
        });
    }
    
    if (equityChartInstance) {
        equityChartInstance.applyOptions({
            width: elements.equityChart.clientWidth,
            height: elements.equityChart.clientHeight
        });
    }
    
    if (depthChartInstance) {
        depthChartInstance.chart.applyOptions({
            width: elements.depthChart.clientWidth,
            height: elements.depthChart.clientHeight
        });
    }
});

// Fix for settings tab toggle behavior
document.addEventListener('DOMContentLoaded', function() {
    // Fix toggling behavior for settings inputs
    function setupToggle(toggleId, inputId) {
        const toggle = document.getElementById(toggleId);
        const input = document.getElementById(inputId);
        
        if (toggle && input) {
            toggle.addEventListener('change', function() {
                input.disabled = !this.checked;
            });
            
            // Initialize state
            input.disabled = !toggle.checked;
        }
    }
    
    // Setup all toggles
    setupToggle('trailing-stop-toggle', 'trailing-stop-value');
    setupToggle('take-profit-toggle', 'take-profit-value');
    setupToggle('stop-loss-toggle', 'stop-loss-value');
    setupToggle('risk-management-toggle', 'max-drawdown-value');
    setupToggle('risk-management-toggle', 'max-daily-loss-value');
    setupToggle('discord-alert-toggle', 'discord-webhook-input');
    setupToggle('telegram-alert-toggle', 'telegram-token-input');
    setupToggle('telegram-alert-toggle', 'telegram-chatid-input');
    setupToggle('email-alert-toggle', 'email-address-input');
    setupToggle('sound-alert-toggle', 'sound-volume-input');
});