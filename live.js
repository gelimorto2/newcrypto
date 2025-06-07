// Global state for bot
let botState = {
    isRunning: false,
    isPaperTrading: true,
    isLoggedIn: false,
    connection: null,
    positions: [],
    trades: [],
    balance: {
        USDT: 10000,
        BTC: 0,
        ETH: 0
    },
    marketData: {
        currentPrice: null,
        candles: []
    },
    pnl: {
        daily: 0,
        total: 0
    },
    settings: {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        strategy: 'volty',
        amount: 100,
        maxPositions: 3,
        stopLoss: 2,
        takeProfit: 5,
        initialBalance: 10000,
        notifications: {
            discordWebhookUrl: '',
            notifyTrades: true,
            notifySignals: true,
            notifyErrors: true
        },
        strategyParams: {
            volty: {
                length: 5,
                atrMult: 0.75
            }
        }
    },
    chart: null,
    priceDataTimer: null,
    tradingInterval: null,
    availablePairs: []
};

// DOM elements cache
const elements = {};

// Setup authentication
function setupAuthentication() {
    // Cache login elements
    elements.loginOverlay = document.getElementById('login-overlay');
    elements.loginForm = document.getElementById('login-form');
    elements.usernameInput = document.getElementById('username');
    elements.passwordInput = document.getElementById('password');
    elements.loginButton = document.getElementById('login-button');
    elements.logoutButton = document.getElementById('logout-button');
    
    // Prefill with demo credentials
    elements.usernameInput.value = 'admin';
    elements.passwordInput.value = 'admin';
    
    // Login button click event
    elements.loginButton.addEventListener('click', handleLogin);
    
    // Enter key in password field
    elements.passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
    
    // Logout button click event
    elements.logoutButton.addEventListener('click', handleLogout);
    
    // Check for saved login
    const savedLogin = localStorage.getItem('isLoggedIn');
    if (savedLogin === 'true') {
        // Auto login for demo
        handleLogin(true);
    }
}

// Handle login
function handleLogin(autoLogin = false) {
    const username = elements.usernameInput.value;
    const password = elements.passwordInput.value;
    
    // Simple validation (for demo)
    if (!autoLogin && (username !== 'admin' || password !== 'admin')) {
        showAlert('Invalid credentials. Try using admin/admin.', 'error');
        return;
    }
    
    // Hide login overlay
    elements.loginOverlay.style.display = 'none';
    
    // Set login state
    botState.isLoggedIn = true;
    localStorage.setItem('isLoggedIn', 'true');
    
    // Initialize the application
    initializeApp();
    
    logMessage('info', 'User logged in successfully');
}

// Handle logout
function handleLogout() {
    // Reset login state
    botState.isLoggedIn = false;
    localStorage.removeItem('isLoggedIn');
    
    // Stop the bot if running
    if (botState.isRunning) {
        stopBot();
    }
    
    // Close WebSocket connection
    if (typeof webSocketHandler !== 'undefined' && webSocketHandler.isConnected) {
        webSocketHandler.close();
    }
    
    // Show login overlay
    elements.loginOverlay.style.display = 'flex';
    
    logMessage('info', 'User logged out');
}

// Initialize the application after login
function initializeApp() {
    // Cache DOM elements
    cacheElements();
    
    // Initialize tab navigation
    initTabs();
    
    // Initialize UI elements
    initUI();
    
    // Load saved settings
    loadSettings();
    
    // Initialize Binance API client
    initializeApiClient();
    
    // Load available trading pairs
    loadTradingPairs();
    
    // Initialize chart
    initChart();
    
    // Initialize WebSocket connection
    initWebSocket();
    
    // Initialize market data updates
    startMarketDataUpdates();
    
    // Log initialization
    logMessage('info', 'Application initialized');
}

// Initialize Binance API client
async function initializeApiClient() {
    try {
        // Create API client without authentication for public data
        botState.connection = new BinanceApiClient();
        
        // Check connection by getting server time
        const exchangeInfo = await botState.connection.getExchangeInfo();
        
        if (exchangeInfo) {
            logMessage('info', 'Successfully connected to Binance API');
        }
    } catch (error) {
        console.error('Error initializing API client:', error);
        logMessage('error', `Failed to connect to Binance API: ${error.message}`);
        
        // Create a mock connection for fallback
        botState.connection = {
            async getKlines(params) {
                return generateMockHistoricalData(params.symbol, params.interval, 100);
            },
            async getTradingPairs() {
                return [
                    { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT' },
                    { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT' },
                    { symbol: 'BNBUSDT', baseAsset: 'BNB', quoteAsset: 'USDT' },
                    { symbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDT' },
                    { symbol: 'ADAUSDT', baseAsset: 'ADA', quoteAsset: 'USDT' },
                    { symbol: 'DOGEUSDT', baseAsset: 'DOGE', quoteAsset: 'USDT' }
                ];
            }
        };
        
        logMessage('warning', 'Using mock data due to API connection issues');
    }
}

// Generate mock historical data
function generateMockHistoricalData(symbol, interval, limit) {
    const candles = [];
    let basePrice = symbol.includes('BTC') ? 40000 : symbol.includes('ETH') ? 2800 : 300;
    const now = Date.now();
    const intervalMs = getIntervalInMs(interval);
    
    for (let i = 0; i < limit; i++) {
        // Add some random price movement
        const change = (Math.random() - 0.5) * basePrice * 0.02;
        basePrice += change;
        
        // Create candlestick with OHLCV data
        const open = basePrice;
        const high = open + (Math.random() * open * 0.01);
        const low = open - (Math.random() * open * 0.01);
        const close = low + (Math.random() * (high - low));
        const volume = Math.random() * 100 + 50;
        
        // Format as candle object
        candles.push({
            time: now - ((limit - i) * intervalMs),
            open: open,
            high: high,
            low: low,
            close: close,
            volume: volume
        });
    }
    
    return candles;
}

// Get interval in milliseconds
function getIntervalInMs(interval) {
    const units = {
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000
    };
    
    const match = interval.match(/(\d+)([mhdw])/);
    if (!match) return 60 * 60 * 1000; // Default to 1h
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    return value * units[unit];
}

// Load available trading pairs
async function loadTradingPairs() {
    try {
        if (!botState.connection) {
            return;
        }
        
        const pairs = await botState.connection.getTradingPairs();
        
        // Filter for USDT pairs (most common for trading)
        botState.availablePairs = pairs.filter(pair => pair.quoteAsset === 'USDT');
        
        // Populate trading pair dropdown
        updateTradingPairsDropdown();
        
        logMessage('info', `Loaded ${botState.availablePairs.length} trading pairs`);
    } catch (error) {
        console.error('Error loading trading pairs:', error);
        logMessage('error', `Failed to load trading pairs: ${error.message}`);
    }
}

// Update trading pairs dropdown
function updateTradingPairsDropdown() {
    const symbolSelect = elements.symbolSelect;
    if (!symbolSelect) return;
    
    // Clear current options
    symbolSelect.innerHTML = '';
    
    // Add popular pairs first
    const popularPairs = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'DOGEUSDT'];
    
    popularPairs.forEach(pair => {
        const option = document.createElement('option');
        option.value = pair;
        option.textContent = pair.replace('USDT', '/USDT');
        symbolSelect.appendChild(option);
    });
    
    // Add separator
    const separator = document.createElement('option');
    separator.disabled = true;
    separator.textContent = '──────────';
    symbolSelect.appendChild(separator);
    
    // Add other pairs
    if (botState.availablePairs && botState.availablePairs.length > 0) {
        botState.availablePairs
            .filter(pair => !popularPairs.includes(pair.symbol))
            .sort((a, b) => a.symbol.localeCompare(b.symbol))
            .forEach(pair => {
                const option = document.createElement('option');
                option.value = pair.symbol;
                option.textContent = `${pair.baseAsset}/${pair.quoteAsset}`;
                symbolSelect.appendChild(option);
            });
    }
    
    // Set selected value from settings
    symbolSelect.value = botState.settings.symbol;
}

// Cache DOM elements for better performance
function cacheElements() {
    // Dashboard elements
    elements.balanceDisplay = document.getElementById('balance-display');
    elements.positionsCount = document.getElementById('positions-count');
    elements.pnlToday = document.getElementById('pnl-today');
    elements.startBotButton = document.getElementById('start-bot');
    elements.stopBotButton = document.getElementById('stop-bot');
    elements.positionsContainer = document.getElementById('positions-container');
    elements.tradesTable = document.getElementById('trades-table');
    elements.priceChart = document.getElementById('price-chart');
    elements.currentPrice = document.getElementById('current-price');
    elements.priceChange = document.getElementById('price-change');
    elements.indicatorsContainer = document.getElementById('indicators-container');
    elements.voltyValue = document.getElementById('volty-value');
    elements.voltyDetail = document.getElementById('volty-detail');
    
    // Market stats elements
    elements.highValue = document.getElementById('high-value');
    elements.lowValue = document.getElementById('low-value');
    elements.volumeValue = document.getElementById('volume-value');
    elements.changeValue = document.getElementById('change-value');
    
    // Settings elements
    elements.apiKeyDisplay = document.getElementById('api-key-display');
    elements.apiSecretDisplay = document.getElementById('api-secret-display');
    elements.updateApiKeysButton = document.getElementById('update-api-keys');
    elements.symbolSelect = document.getElementById('symbol');
    elements.timeframeSelect = document.getElementById('timeframe');
    elements.strategySelect = document.getElementById('strategy');
    elements.amountInput = document.getElementById('amount');
    elements.maxPositionsInput = document.getElementById('maxPositions');
    elements.stopLossInput = document.getElementById('stopLoss');
    elements.takeProfitInput = document.getElementById('takeProfit');
    elements.initialBalanceInput = document.getElementById('initialBalance');
    elements.resetPaperBalanceButton = document.getElementById('reset-paper-balance');
    elements.discordWebhookInput = document.getElementById('discordWebhookUrl');
    elements.notifyTradesCheckbox = document.getElementById('notifyTrades');
    elements.notifySignalsCheckbox = document.getElementById('notifySignals');
    elements.notifyErrorsCheckbox = document.getElementById('notifyErrors');
    elements.testNotificationButton = document.getElementById('test-notification');
    elements.saveSettingsButton = document.getElementById('save-settings');
    elements.paperModeToggle = document.getElementById('paper-mode-toggle');
    elements.modeDisplay = document.getElementById('mode-display');
    elements.voltyLengthInput = document.getElementById('volty-length');
    elements.voltyAtrMultInput = document.getElementById('volty-atr-mult');
    elements.pairSearchInput = document.getElementById('pair-search');
    
    // Logs elements
    elements.logLevelSelect = document.getElementById('log-level');
    elements.clearLogsButton = document.getElementById('clear-logs');
    elements.logContainer = document.getElementById('log-container');
    
    // Advanced elements
    elements.jsonEditor = document.getElementById('json-editor');
    elements.validateJsonButton = document.getElementById('validate-json');
    elements.applyJsonButton = document.getElementById('apply-json');
    elements.backtestStartInput = document.getElementById('backtest-start');
    elements.backtestEndInput = document.getElementById('backtest-end');
    elements.runBacktestButton = document.getElementById('run-backtest');
    elements.exportSettingsButton = document.getElementById('export-settings');
    elements.importSettingsButton = document.getElementById('import-settings');
    elements.websocketUrl = document.getElementById('websocket-url');
    elements.reconnectWebsocketButton = document.getElementById('reconnect-websocket');
    
    // Modal elements
    elements.apiKeysModal = document.getElementById('api-keys-modal');
    elements.newApiKeyInput = document.getElementById('new-api-key');
    elements.newApiSecretInput = document.getElementById('new-api-secret');
    elements.saveNewApiKeysButton = document.getElementById('save-new-api-keys');
    elements.importSettingsModal = document.getElementById('import-settings-modal');
    elements.importJsonInput = document.getElementById('import-json');
    elements.confirmImportButton = document.getElementById('confirm-import');
    elements.connectionStatusModal = document.getElementById('connection-status-modal');
    
    // Connection status elements
    elements.currentDatetime = document.getElementById('current-datetime');
    elements.connectionStatus = document.getElementById('connection-status');
    elements.connectionDetails = document.getElementById('connection-details');
    elements.wsIndicator = document.getElementById('ws-indicator');
    elements.wsStatus = document.getElementById('ws-status');
    elements.lastMessageTime = document.getElementById('last-message-time');
    elements.apiStatus = document.getElementById('api-status');
    elements.reconnectWsButton = document.getElementById('reconnect-ws-button');
}

// Initialize tab navigation
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Deactivate all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Activate clicked tab
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            const tabContent = document.getElementById(tabId);
            if (tabContent) {
                tabContent.classList.add('active');
            }
        });
    });
}

// Initialize UI elements
function initUI() {
    // Start/Stop bot buttons
    if (elements.startBotButton) {
        elements.startBotButton.addEventListener('click', startBot);
    }
    if (elements.stopBotButton) {
        elements.stopBotButton.addEventListener('click', stopBot);
    }
    
    // Paper trading toggle
    if (elements.paperModeToggle) {
        elements.paperModeToggle.addEventListener('change', toggleTradingMode);
    }
    
    // API keys update button
    if (elements.updateApiKeysButton) {
        elements.updateApiKeysButton.addEventListener('click', () => {
            if (elements.apiKeysModal) {
                elements.apiKeysModal.style.display = 'block';
            }
        });
    }
    
    // Save API keys button
    if (elements.saveNewApiKeysButton) {
        elements.saveNewApiKeysButton.addEventListener('click', updateApiKeys);
    }
    
    // Reset paper balance button
    if (elements.resetPaperBalanceButton) {
        elements.resetPaperBalanceButton.addEventListener('click', resetPaperBalance);
    }
    
    // Test notification button
    if (elements.testNotificationButton) {
        elements.testNotificationButton.addEventListener('click', testNotification);
    }
    
    // Save settings button
    if (elements.saveSettingsButton) {
        elements.saveSettingsButton.addEventListener('click', saveSettingsFromUI);
    }
    
    // Clear logs button
    if (elements.clearLogsButton) {
        elements.clearLogsButton.addEventListener('click', clearLogs);
    }
    
    // JSON validation and application
    if (elements.validateJsonButton) {
        elements.validateJsonButton.addEventListener('click', validateStrategyJson);
    }
    if (elements.applyJsonButton) {
        elements.applyJsonButton.addEventListener('click', applyStrategyJson);
    }
    
    // Backtest button
    if (elements.runBacktestButton) {
        elements.runBacktestButton.addEventListener('click', runBacktest);
    }
    
    // Export/Import settings
    if (elements.exportSettingsButton) {
        elements.exportSettingsButton.addEventListener('click', exportSettings);
    }
    if (elements.importSettingsButton) {
        elements.importSettingsButton.addEventListener('click', () => {
            if (elements.importSettingsModal) {
                elements.importSettingsModal.style.display = 'block';
            }
        });
    }
    if (elements.confirmImportButton) {
        elements.confirmImportButton.addEventListener('click', importSettings);
    }
    
    // WebSocket reconnect button
    if (elements.reconnectWebsocketButton) {
        elements.reconnectWebsocketButton.addEventListener('click', () => {
            if (typeof webSocketHandler !== 'undefined') {
                webSocketHandler.init();
            }
        });
    }
    
    // Connection status modal
    if (elements.connectionStatus) {
        elements.connectionStatus.addEventListener('click', showConnectionStatusModal);
    }
    if (elements.reconnectWsButton) {
        elements.reconnectWsButton.addEventListener('click', () => {
            if (typeof webSocketHandler !== 'undefined') {
                webSocketHandler.init();
            }
            if (elements.connectionStatusModal) {
                elements.connectionStatusModal.style.display = 'none';
            }
        });
    }
    
    // Close buttons for modals
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (elements.apiKeysModal && event.target === elements.apiKeysModal) {
            elements.apiKeysModal.style.display = 'none';
        } else if (elements.importSettingsModal && event.target === elements.importSettingsModal) {
            elements.importSettingsModal.style.display = 'none';
        } else if (elements.connectionStatusModal && event.target === elements.connectionStatusModal) {
            elements.connectionStatusModal.style.display = 'none';
        }
    });
    
    // Pair search functionality
    if (elements.pairSearchInput) {
        elements.pairSearchInput.addEventListener('input', searchTradingPairs);
    }
    
    // Set initial date values for backtest
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    if (elements.backtestEndInput) {
        elements.backtestEndInput.valueAsDate = today;
    }
    if (elements.backtestStartInput) {
        elements.backtestStartInput.valueAsDate = oneMonthAgo;
    }
    
    // Update paper/live mode display
    updateTradingMode();
    
    // Update balance display
    updateBalanceDisplay();
    
    // Set up Volty Expansion strategy parameters
    setupVoltyExpansionParams();
}

// Search trading pairs
function searchTradingPairs() {
    if (!elements.pairSearchInput || !elements.symbolSelect) return;
    
    const query = elements.pairSearchInput.value.trim().toUpperCase();
    const options = elements.symbolSelect.options;
    
    for (let i = 0; i < options.length; i++) {
        const option = options[i];
        if (option.disabled) continue; // Skip separators
        
        const match = option.value.includes(query) || option.textContent.includes(query);
        option.style.display = match ? '' : 'none';
    }
}

// Set up Volty Expansion strategy parameters
function setupVoltyExpansionParams() {
    // Update input fields with current values
    if (elements.voltyLengthInput && elements.voltyAtrMultInput) {
        elements.voltyLengthInput.value = botState.settings.strategyParams.volty.length;
        elements.voltyAtrMultInput.value = botState.settings.strategyParams.volty.atrMult;
        
        // Add event listeners to update strategy parameters
        elements.voltyLengthInput.addEventListener('change', () => {
            const length = parseInt(elements.voltyLengthInput.value);
            if (!isNaN(length) && length > 0) {
                botState.settings.strategyParams.volty.length = length;
                updateJsonEditor();
            }
        });
        
        elements.voltyAtrMultInput.addEventListener('change', () => {
            const atrMult = parseFloat(elements.voltyAtrMultInput.value);
            if (!isNaN(atrMult) && atrMult > 0) {
                botState.settings.strategyParams.volty.atrMult = atrMult;
                updateJsonEditor();
            }
        });
    }
    
    // Update JSON editor with current parameters
    updateJsonEditor();
}

// Update JSON editor with current parameters
function updateJsonEditor() {
    if (elements.jsonEditor) {
        const jsonContent = {
            strategy: 'volty',
            parameters: botState.settings.strategyParams.volty
        };
        
        elements.jsonEditor.textContent = JSON.stringify(jsonContent, null, 2);
    }
}

// Show connection status modal
function showConnectionStatusModal() {
    if (!elements.connectionStatusModal) return;
    
    // Update connection details
    if (typeof webSocketHandler !== 'undefined') {
        const status = webSocketHandler.getStatus ? webSocketHandler.getStatus() : { connected: false, lastMessageTime: 'Never' };
        if (elements.wsStatus) {
            elements.wsStatus.textContent = status.connected ? 'Connected' : 'Disconnected';
            elements.wsStatus.className = status.connected ? 'status running' : 'status stopped';
        }
        if (elements.lastMessageTime) {
            elements.lastMessageTime.textContent = status.lastMessageTime;
        }
    }
    
    // Update API status
    if (elements.apiStatus) {
        if (botState.connection) {
            elements.apiStatus.textContent = 'Connected to Binance API';
            elements.apiStatus.className = 'status running';
        } else {
            elements.apiStatus.textContent = 'Not connected to API';
            elements.apiStatus.className = 'status stopped';
        }
    }
    
    // Show modal
    elements.connectionStatusModal.style.display = 'block';
}

// Initialize WebSocket connection
function initWebSocket() {
    // Only initialize if webSocketHandler is available
    if (typeof webSocketHandler === 'undefined') {
        console.error('WebSocket handler not available');
        logMessage('error', 'WebSocket handler not available');
        return;
    }
    
    // Set custom WebSocket URL if provided
    if (elements.websocketUrl && elements.websocketUrl.value) {
        webSocketHandler.baseUrl = elements.websocketUrl.value;
    }
    
    // Initialize WebSocket with Binance stream
    webSocketHandler.init();
    
    // Register WebSocket event listeners
    webSocketHandler.on('connecting', handleWebSocketConnecting);
    webSocketHandler.on('connected', handleWebSocketConnected);
    webSocketHandler.on('disconnected', handleWebSocketDisconnected);
    webSocketHandler.on('kline', handleKlineUpdate);
    webSocketHandler.on('trade', handleTradeUpdate);
    webSocketHandler.on('ticker', handleTickerUpdate);
    webSocketHandler.on('error', handleWebSocketError);
}

// Handle WebSocket connecting event
function handleWebSocketConnecting() {
    // Update UI
    if (elements.connectionStatus) {
        elements.connectionStatus.textContent = 'Connecting...';
        elements.connectionStatus.className = 'status warning';
    }
    if (elements.wsIndicator) {
        elements.wsIndicator.className = 'websocket-status connecting';
    }
    
    // Update connection details
    if (elements.connectionDetails) {
        elements.connectionDetails.textContent = 'WebSocket connecting...';
    }
}

// Handle WebSocket connected event
function handleWebSocketConnected() {
    // Subscribe to kline data for the selected symbol and timeframe
    const klineStream = `${botState.settings.symbol.toLowerCase()}@kline_${botState.settings.timeframe}`;
    webSocketHandler.subscribe(klineStream);
    
    // Subscribe to trade data
    const tradeStream = `${botState.settings.symbol.toLowerCase()}@trade`;
    webSocketHandler.subscribe(tradeStream);
    
    // Subscribe to ticker data
    const tickerStream = `${botState.settings.symbol.toLowerCase()}@ticker`;
    webSocketHandler.subscribe(tickerStream);
    
    // Update UI
    if (elements.connectionStatus) {
        elements.connectionStatus.textContent = 'Connected';
        elements.connectionStatus.className = 'status running';
    }
    if (elements.wsIndicator) {
        elements.wsIndicator.className = 'websocket-status connected';
    }
    
    // Update connection details
    if (elements.connectionDetails) {
        elements.connectionDetails.textContent = `WebSocket connected to ${botState.settings.symbol}`;
    }
    
    logMessage('info', 'WebSocket connected and subscribed to data streams');
}

// Handle WebSocket disconnected event
function handleWebSocketDisconnected() {
    // Update UI
    if (elements.connectionStatus) {
        elements.connectionStatus.textContent = 'Disconnected';
        elements.connectionStatus.className = 'status stopped';
    }
    if (elements.wsIndicator) {
        elements.wsIndicator.className = 'websocket-status disconnected';
    }
    
    // Update connection details
    if (elements.connectionDetails) {
        elements.connectionDetails.textContent = 'WebSocket disconnected';
    }
    
    // If bot is running, stop it
    if (botState.isRunning) {
        stopBot();
    }
    
    logMessage('warning', 'WebSocket disconnected');
}

// Handle kline (candlestick) update from WebSocket
function handleKlineUpdate(data) {
    // Update current price
    if (data.k.s === botState.settings.symbol) {
        botState.marketData.currentPrice = parseFloat(data.k.c);
        
        // Add candle to chart data
        updateChartWithNewCandle({
            time: data.k.t,
            open: parseFloat(data.k.o),
            high: parseFloat(data.k.h),
            low: parseFloat(data.k.l),
            close: parseFloat(data.k.c),
            volume: parseFloat(data.k.v)
        });
        
        // Check positions for stop loss/take profit
        checkPositions();
        
        // Update positions display with new prices
        updatePositionsDisplay();
        
        // Update price display
        updateCurrentPriceDisplay();
        
        // Run strategy check
        if (botState.isRunning) {
            checkStrategySignal();
        }
        
        logMessage('debug', `New kline data received: ${botState.settings.symbol} ${data.k.i} - Price: ${botState.marketData.currentPrice}`);
    }
}

// Handle trade update from WebSocket
function handleTradeUpdate(data) {
    // Update the latest trade price
    if (data.s === botState.settings.symbol) {
        const price = parseFloat(data.p);
        
        // Only update current price to prevent chart jumps
        // Candles will be updated by the kline stream
        botState.marketData.currentPrice = price;
        
        // Update current price display
        updateCurrentPriceDisplay();
        
        // Check positions more frequently with trade updates
        checkPositions();
        
        logMessage('debug', `Trade update: ${data.s} - Price: ${price}`);
    }
}

// Handle ticker update from WebSocket
function handleTickerUpdate(data) {
    // Update 24h ticker data if needed
    if (data.s === botState.settings.symbol) {
        // Update price display in UI
        updateMarketStats(data);
        
        logMessage('debug', `Ticker update: ${data.s} - 24h change: ${data.P}%`);
    }
}

// Update current price display
function updateCurrentPriceDisplay() {
    if (!elements.currentPrice || !botState.marketData.currentPrice) return;
    
    elements.currentPrice.textContent = `${botState.marketData.currentPrice.toFixed(2)} USDT`;
}

// Update market statistics
function updateMarketStats(tickerData) {
    if (!tickerData) return;
    
    // Update 24h high
    if (elements.highValue) {
        elements.highValue.textContent = parseFloat(tickerData.h).toFixed(2);
    }
    
    // Update 24h low
    if (elements.lowValue) {
        elements.lowValue.textContent = parseFloat(tickerData.l).toFixed(2);
    }
    
    // Update 24h volume
    if (elements.volumeValue) {
        elements.volumeValue.textContent = parseFloat(tickerData.v).toFixed(2);
    }
    
    // Update 24h price change
    if (elements.changeValue) {
        const changePercent = parseFloat(tickerData.P);
        elements.changeValue.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
        elements.changeValue.style.color = changePercent >= 0 ? '#238636' : '#da3633';
    }
    
    // Update price change display
    if (elements.priceChange) {
        const changePercent = parseFloat(tickerData.P);
        elements.priceChange.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
        elements.priceChange.className = `price-change ${changePercent >= 0 ? 'positive' : 'negative'}`;
        
        // Update icon
        const icon = document.createElement('i');
        icon.className = `fas fa-caret-${changePercent >= 0 ? 'up' : 'down'}`;
        
        // Replace existing content
        elements.priceChange.innerHTML = '';
        elements.priceChange.appendChild(icon);
        elements.priceChange.appendChild(document.createTextNode(` ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`));
    }
}

// Handle WebSocket error
function handleWebSocketError(error) {
    logMessage('error', `WebSocket error: ${error.message || 'Unknown error'}`);
    
    // If bot is running, stop it
    if (botState.isRunning) {
        stopBot();
    }
}

// Initialize chart
function initChart() {
    try {
        // Get the chart canvas element
        const chartCanvas = document.getElementById('price-chart');
        if (!chartCanvas) return;
        
        // Clear existing chart if any
        if (botState.chart) {
            botState.chart.destroy();
        }
        
        // Create chart using Chart.js
        botState.chart = new Chart(chartCanvas, {
            type: 'candlestick',
            data: {
                datasets: [{
                    label: botState.settings.symbol,
                    data: []
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: getTimeUnit(botState.settings.timeframe),
                            displayFormats: {
                                minute: 'HH:mm',
                                hour: 'MM-dd HH:mm',
                                day: 'MMM dd'
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#8b949e'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#8b949e'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const data = context.raw;
                                return [
                                    `Open: ${data.open}`,
                                    `High: ${data.high}`,
                                    `Low: ${data.low}`,
                                    `Close: ${data.close}`,
                                    `Volume: ${data.volume}`
                                ];
                            }
                        }
                    }
                }
            }
        });
        
        // Initial chart data load
        loadHistoricalData();
    } catch (error) {
        console.error('Error initializing chart:', error);
        logMessage('error', `Failed to initialize chart: ${error.message}`);
    }
}

// Get time unit for chart based on timeframe
function getTimeUnit(timeframe) {
    if (timeframe.includes('m')) {
        return 'minute';
    } else if (timeframe.includes('h')) {
        return 'hour';
    } else if (timeframe.includes('d')) {
        return 'day';
    } else if (timeframe.includes('w')) {
        return 'week';
    }
    return 'hour'; // Default
}

// Update chart with new candle
function updateChartWithNewCandle(candle) {
    if (!botState.chart) return;
    
    // Get dataset
    const dataset = botState.chart.data.datasets[0];
    
    // Check if we already have this candle
    const existingIndex = dataset.data.findIndex(item => item.time === candle.time);
    
    if (existingIndex !== -1) {
        // Update existing candle
        dataset.data[existingIndex] = candle;
    } else {
        // Add new candle
        dataset.data.push(candle);
        
        // Update candles array for strategy calculations
        botState.marketData.candles.push(candle);
        
        // Limit to last 100 candles
        if (dataset.data.length > 100) {
            dataset.data.shift();
            botState.marketData.candles.shift();
        }
    }
    
    // Update chart
    botState.chart.update();
}

// Load historical data for chart
async function loadHistoricalData() {
    try {
        // Show loading state
        if (elements.priceChart) {
            elements.priceChart.style.opacity = '0.5';
        }
        
        // Get data through Binance API
        if (botState.connection) {
            const data = await botState.connection.getKlines({
                symbol: botState.settings.symbol,
                interval: botState.settings.timeframe,
                limit: 100
            });
            
            // Clear existing data
            if (botState.chart && botState.chart.data.datasets[0]) {
                botState.chart.data.datasets[0].data = [];
            }
            
            // Set chart data
            if (data && data.length) {
                // Store candles for strategy analysis
                botState.marketData.candles = data;
                
                // Set current price from last candle
                botState.marketData.currentPrice = data[data.length - 1].close;
                
                // Add candles to chart
                if (botState.chart && botState.chart.data.datasets[0]) {
                    botState.chart.data.datasets[0].data = data;
                    
                    // Update chart
                    botState.chart.update();
                }
                
                // Update positions with current price
                updatePositionsDisplay();
                
                // Update current price display
                updateCurrentPriceDisplay();
                
                // Update Volatility Expansion indicator
                updateVoltyIndicatorDisplay();
                
                logMessage('info', `Loaded ${data.length} historical candles for ${botState.settings.symbol}`);
            } else {
                logMessage('error', 'Failed to load historical data');
            }
        } else {
            logMessage('error', 'No API connection available');
        }
        
        // Reset loading state
        if (elements.priceChart) {
            elements.priceChart.style.opacity = '1';
        }
    } catch (error) {
        console.error('Error loading historical data:', error);
        logMessage('error', `Failed to load historical data: ${error.message}`);
        if (elements.priceChart) {
            elements.priceChart.style.opacity = '1';
        }
    }
}

// Start market data updates
function startMarketDataUpdates() {
    // Clear existing timer
    if (botState.priceDataTimer) {
        clearInterval(botState.priceDataTimer);
    }
    
    // Set update interval based on timeframe
    let interval = 60000; // Default 1 minute
    
    switch (botState.settings.timeframe) {
        case '1m':
            interval = 60000;
            break;
        case '5m':
            interval = 5 * 60000;
            break;
        case '15m':
            interval = 15 * 60000;
            break;
        case '1h':
            interval = 60 * 60000;
            break;
        case '4h':
            interval = 4 * 60 * 60000;
            break;
        case '1d':
            interval = 24 * 60 * 60000;
            break;
    }
    
    // Set timer for regular updates
    botState.priceDataTimer = setInterval(() => {
        // Reload historical data
        loadHistoricalData();
        
        // Check positions
        checkPositions();
        
        // Update UI
        updateBalanceDisplay();
        updatePositionsDisplay();
    }, interval);
    
    logMessage('info', `Market data updates started with ${botState.settings.timeframe} interval`);
}

// Toggle between paper and live trading modes
function toggleTradingMode() {
    if (!elements.paperModeToggle) return;
    
    botState.isPaperTrading = !elements.paperModeToggle.checked;
    updateTradingMode();
    saveSettings();
    
    if (botState.isRunning) {
        stopBot();
        showAlert('Bot stopped due to trading mode change', 'warning');
    }
    
    logMessage('info', `Trading mode changed to ${botState.isPaperTrading ? 'Paper Trading' : 'Live Trading'}`);
}

// Update trading mode display
function updateTradingMode() {
    if (elements.modeDisplay) {
        elements.modeDisplay.textContent = botState.isPaperTrading ? 'Paper Trading' : 'Live Trading';
        elements.modeDisplay.className = `status ${botState.isPaperTrading ? 'paper' : 'running'}`;
    }
}

// Update balance display
function updateBalanceDisplay() {
    if (elements.balanceDisplay) {
        if (botState.isPaperTrading) {
            elements.balanceDisplay.innerHTML = `
                <div>USDT: ${botState.balance.USDT.toFixed(2)}</div>
                <div>Positions: ${botState.positions.length}</div>
            `;
        } else {
            // For live trading, get balance from API
            if (botState.connection) {
                // In a real implementation, you would use the Binance API to get account info
                // Since we're using the public API, we'll show a placeholder message
                elements.balanceDisplay.innerHTML = 'API Key required for balance';
            } else {
                elements.balanceDisplay.innerHTML = 'Not connected to API';
            }
        }
    }
    
    // Update positions count
    if (elements.positionsCount) {
        elements.positionsCount.textContent = botState.positions.length;
    }
    
    // Update PnL today
    if (elements.pnlToday) {
        elements.pnlToday.textContent = `${botState.pnl.daily.toFixed(2)} USDT`;
        elements.pnlToday.className = botState.pnl.daily >= 0 ? 'profit' : 'loss';
    }
}

// Start the bot
function startBot() {
    if (botState.isRunning) {
        showAlert('Bot is already running', 'warning');
        return;
    }
    
    // Validate settings
    if (!validateSettings()) {
        return;
    }
    
    // Initialize API connection if in live mode
    if (!botState.isPaperTrading) {
        // Check if API keys are configured
        const apiKey = localStorage.getItem('apiKey');
        const apiSecret = localStorage.getItem('apiSecret');
        
        if (!apiKey || !apiSecret) {
            showAlert('Please configure API keys before starting live trading', 'error');
            return;
        }
        
        // In a real implementation, you would create an authenticated API client
        // Since we're using the public API, we'll just continue with the current client
        logMessage('warning', 'Using public API for trading (demo mode)');
    }
    
    // Subscribe to data streams if needed
    if (typeof webSocketHandler !== 'undefined' && !webSocketHandler.isConnected) {
        webSocketHandler.init();
    }
    
    // Update UI
    if (elements.startBotButton) {
        elements.startBotButton.style.display = 'none';
    }
    if (elements.stopBotButton) {
        elements.stopBotButton.style.display = 'inline-block';
    }
    
    // Set bot state
    botState.isRunning = true;
    
    // Reload historical data
    loadHistoricalData();
    
    // Initialize trading logic loop
    startTradingLoop();
    
    showAlert('Bot started successfully', 'success');
    logMessage('info', `Bot started in ${botState.isPaperTrading ? 'paper' : 'live'} trading mode`);
}

// Stop the bot
function stopBot() {
    if (!botState.isRunning) {
        showAlert('Bot is not running', 'warning');
        return;
    }
    
    // Update UI
    if (elements.startBotButton) {
        elements.startBotButton.style.display = 'inline-block';
    }
    if (elements.stopBotButton) {
        elements.stopBotButton.style.display = 'none';
    }
    
    // Set bot state
    botState.isRunning = false;
    
    // Clear trading interval
    if (botState.tradingInterval) {
        clearInterval(botState.tradingInterval);
        botState.tradingInterval = null;
    }
    
    showAlert('Bot stopped', 'success');
    logMessage('info', 'Bot stopped');
}

// Start trading logic loop
function startTradingLoop() {
    // Clear any existing interval
    if (botState.tradingInterval) {
        clearInterval(botState.tradingInterval);
    }
    
    // Set interval for checking strategy signals
    const intervalTime = 60000; // Check every minute
    
    botState.tradingInterval = setInterval(() => {
        if (!botState.isRunning) {
            clearInterval(botState.tradingInterval);
            return;
        }
        
        // Skip if no market data
        if (!botState.marketData.candles || botState.marketData.candles.length === 0) {
            return;
        }
        
        // Check for strategy signals
        checkStrategySignal();
    }, intervalTime);
    
    logMessage('info', 'Trading loop started with Volatility Expansion Close strategy');
}

// Check for strategy signals
function checkStrategySignal() {
    if (!botState.marketData.candles || botState.marketData.candles.length === 0) return;
    
    try {
        // Execute Volatility Expansion Close strategy
        const result = executeVoltyExpansionStrategy(
            botState.marketData.candles,
            botState.settings.strategyParams.volty
        );
        
        // Update indicator display
        updateVoltyIndicatorDisplay(result.values);
        
        // Process signal if exists
        if (result.signal) {
            logMessage('info', `Signal generated: ${result.signal.action} at ${result.signal.price} (Reason: ${result.signal.reason})`);
            
            // Check if we can execute trade
            if (canExecuteTrade(result.signal.action)) {
                // Execute trade
                executeTrade(result.signal);
            }
        }
    } catch (error) {
        console.error('Error checking strategy signal:', error);
        logMessage('error', `Failed to check strategy signal: ${error.message}`);
    }
}

// Execute Volatility Expansion Close strategy
function executeVoltyExpansionStrategy(candles, params = {}) {
    // Default parameters if not provided
    const length = params.length || 5;
    const numATRs = params.atrMult || 0.75;
    
    // Need enough candles for calculation
    if (candles.length < length + 1) {
        return { values: {}, signal: null };
    }
    
    // Calculate True Range (TR) for each candle
    const trueRanges = [];
    for (let i = 1; i < candles.length; i++) {
        const high = parseFloat(candles[i].high);
        const low = parseFloat(candles[i].low);
        const prevClose = parseFloat(candles[i-1].close);
        
        // True Range = max(high - low, abs(high - prevClose), abs(low - prevClose))
        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trueRanges.push(tr);
    }
    
    // Calculate Simple Moving Average (SMA) of True Range
    const smaValues = [];
    for (let i = length - 1; i < trueRanges.length; i++) {
        const trSlice = trueRanges.slice(i - length + 1, i + 1);
        const sum = trSlice.reduce((total, val) => total + val, 0);
        const sma = sum / length;
        smaValues.push(sma);
    }
    
    // Get the current SMA of TR
    const currentSMA = smaValues[smaValues.length - 1];
    
    // Calculate ATR band value
    const atrs = currentSMA * numATRs;
    
    // Get current close price
    const currentClose = parseFloat(candles[candles.length - 1].close);
    
    // Calculate long and short entry prices
    const longEntry = currentClose + atrs;
    const shortEntry = currentClose - atrs;
    
    // Check for signals
    let signal = null;
    const previousCandle = candles[candles.length - 2];
    const previousClose = parseFloat(previousCandle.close);
    
    // Check if current price breaks above or below the bands
    if (currentClose > previousClose + atrs) {
        // Long signal
        signal = {
            action: 'BUY',
            price: currentClose,
            reason: 'VOLTY_EXPAN_CLOSE_LONG'
        };
    } else if (currentClose < previousClose - atrs) {
        // Short signal
        signal = {
            action: 'SELL',
            price: currentClose,
            reason: 'VOLTY_EXPAN_CLOSE_SHORT'
        };
    }
    
    return {
        values: {
            length: length,
            atrMult: numATRs,
            atr: currentSMA,
            atrs: atrs,
            longEntry: longEntry,
            shortEntry: shortEntry,
            currentClose: currentClose,
            previousClose: previousClose
        },
        signal: signal
    };
}

// Update Volatility Expansion indicator display
function updateVoltyIndicatorDisplay(values = null) {
    if (!elements.voltyValue || !elements.voltyDetail) return;
    
    // If no values provided, calculate from current data
    if (!values && botState.marketData.candles && botState.marketData.candles.length > 0) {
        const result = executeVoltyExpansionStrategy(
            botState.marketData.candles,
            botState.settings.strategyParams.volty
        );
        values = result.values;
    }
    
    // If we have values, update the display
    if (values && Object.keys(values).length > 0) {
        elements.voltyValue.textContent = `ATR: ${values.atr.toFixed(4)}`;
        
        elements.voltyDetail.innerHTML = `
            <div>Length: ${values.length} | Multiplier: ${values.atrMult}</div>
            <div>Long Entry: ${values.longEntry.toFixed(2)}</div>
            <div>Short Entry: ${values.shortEntry.toFixed(2)}</div>
            <div>Current Close: ${values.currentClose.toFixed(2)}</div>
        `;
    } else {
        elements.voltyValue.textContent = 'ATR: -';
        elements.voltyDetail.textContent = 'Waiting for data...';
    }
}

// Check if trade can be executed
function canExecuteTrade(action) {
    // Check if we can open a new position
    if (action === 'BUY') {
        // Check if we've reached max positions
        if (botState.positions.length >= botState.settings.maxPositions) {
            logMessage('info', `Cannot open new position: reached max positions (${botState.settings.maxPositions})`);
            return false;
        }
        
        // Check if we have enough balance
        if (botState.balance.USDT < botState.settings.amount) {
            logMessage('warning', `Cannot open new position: insufficient balance (${botState.balance.USDT} USDT)`);
            return false;
        }
    }
    
    return true;
}

// Execute a trade based on signal
async function executeTrade(signal) {
    try {
        // Calculate quantity based on current price and amount
        const quantity = (botState.settings.amount / signal.price).toFixed(6);
        
        let result;
        
        // Handle trade execution differently based on mode
        if (botState.isPaperTrading) {
            // Paper trading - simulate order execution
            result = {
                orderId: Date.now(),
                symbol: botState.settings.symbol,
                side: signal.action,
                type: 'MARKET',
                quantity: quantity,
                price: signal.price.toFixed(2),
                status: 'FILLED',
                time: Date.now()
            };
            
            // Update paper trading balance
            if (signal.action === 'BUY') {
                botState.balance.USDT -= botState.settings.amount;
            } else if (signal.action === 'SELL' && botState.positions.length > 0) {
                // Calculate profit/loss
                const position = botState.positions[0]; // For SELL we use the first position (FIFO)
                const pnl = (signal.price - position.entryPrice) * position.quantity;
                botState.balance.USDT += parseFloat(position.entryPrice) * parseFloat(position.quantity) + pnl;
            }
        } else {
            // Live trading - in a real implementation, you would execute an order via the Binance API
            // Since we're using the public API, we'll just simulate the order
            result = {
                orderId: Date.now(),
                symbol: botState.settings.symbol,
                side: signal.action,
                type: 'MARKET',
                quantity: quantity,
                price: signal.price.toFixed(2),
                status: 'FILLED',
                time: Date.now()
            };
            
            logMessage('warning', 'Using simulated order execution (demo mode)');
        }
        
        // Log the trade
        logMessage('info', `Trade executed: ${signal.action} ${quantity} ${botState.settings.symbol} at ${signal.price}`);
        
        // Send notification if enabled
        if (botState.settings.notifications.notifyTrades) {
            sendDiscordNotification({
                title: 'Trade Executed',
                description: `${signal.action} ${quantity} ${botState.settings.symbol} at ${signal.price}`,
                color: signal.action === 'BUY' ? 0x00FF00 : 0xFF0000
            });
        }
        
        // Update positions
        if (signal.action === 'BUY') {
            // Add new position
            const position = {
                id: result.orderId,
                symbol: botState.settings.symbol,
                entryPrice: signal.price,
                quantity: quantity,
                time: new Date().toISOString(),
                stopLoss: signal.price * (1 - botState.settings.stopLoss / 100),
                takeProfit: signal.price * (1 + botState.settings.takeProfit / 100)
            };
            
            botState.positions.push(position);
            updatePositionsDisplay();
        } else {
            // Close position if SELL
            // Find the position to close (FIFO)
            if (botState.positions.length > 0) {
                const position = botState.positions.shift(); // Remove first position
                
                // Calculate profit/loss
                const pnl = (signal.price - position.entryPrice) * position.quantity;
                botState.pnl.daily += pnl;
                botState.pnl.total += pnl;
                
                // Add to trades history
                const trade = {
                    id: result.orderId,
                    symbol: position.symbol,
                    entryPrice: position.entryPrice,
                    exitPrice: signal.price,
                    quantity: position.quantity,
                    pnl: pnl,
                    entryTime: position.time,
                    exitTime: new Date().toISOString()
                };
                
                botState.trades.unshift(trade); // Add to beginning of array
                updateTradesTable();
                updatePositionsDisplay();
            }
        }
        
        // Save paper trading state if in paper mode
        if (botState.isPaperTrading) {
            savePaperTradingState();
        }
        
        return result;
    } catch (error) {
        console.error('Error executing trade:', error);
        logMessage('error', `Failed to execute trade: ${error.message}`);
        
        if (botState.settings.notifications.notifyErrors) {
            sendDiscordNotification({
                title: 'Trade Execution Error',
                description: `Failed to execute ${signal.action} order: ${error.message}`,
                color: 0xFF0000
            });
        }
        
        return null;
    }
}

// Check positions for stop loss and take profit
function checkPositions() {
    if (!botState.isRunning || !botState.positions.length || !botState.marketData.currentPrice) return;
    
    const currentPrice = botState.marketData.currentPrice;
    let positionsUpdated = false;
    
    // Create a copy of positions array to iterate (since we might remove items)
    const positions = [...botState.positions];
    
    positions.forEach(position => {
        // Check stop loss
        if (currentPrice <= position.stopLoss) {
            logMessage('info', `Stop loss triggered for ${position.symbol} at ${currentPrice}`);
            
            // Create sell signal
            const signal = {
                action: 'SELL',
                price: currentPrice,
                reason: 'STOP_LOSS'
            };
            
            // Execute sell order
            executeTrade(signal);
            positionsUpdated = true;
        }
        // Check take profit
        else if (currentPrice >= position.takeProfit) {
            logMessage('info', `Take profit triggered for ${position.symbol} at ${currentPrice}`);
            
            // Create sell signal
            const signal = {
                action: 'SELL',
                price: currentPrice,
                reason: 'TAKE_PROFIT'
            };
            
            // Execute sell order
            executeTrade(signal);
            positionsUpdated = true;
        }
    });
    
    // Update positions display if needed
    if (positionsUpdated) {
        updatePositionsDisplay();
    }
}

// Update positions display
function updatePositionsDisplay() {
    const container = elements.positionsContainer;
    if (!container) return;
    
    if (botState.positions.length === 0) {
        container.innerHTML = '<p>No active positions.</p>';
        return;
    }
    
    let html = '';
    botState.positions.forEach(position => {
        const currentPrice = botState.marketData.currentPrice || position.entryPrice;
        const unrealizedPnl = (currentPrice - position.entryPrice) * position.quantity;
        const pnlPercent = ((currentPrice / position.entryPrice) - 1) * 100;
        
        html += `
            <div class="position-card">
                <div class="position-header">
                    <h4>${position.symbol}</h4>
                    <span class="badge ${unrealizedPnl >= 0 ? 'profit' : 'loss'}">${pnlPercent.toFixed(2)}%</span>
                </div>
                <div class="position-details">
                    <div class="position-detail">
                        <div class="position-detail-label">Entry Price</div>
                        <div>${position.entryPrice.toFixed(2)} USDT</div>
                    </div>
                    <div class="position-detail">
                        <div class="position-detail-label">Quantity</div>
                        <div>${position.quantity}</div>
                    </div>
                    <div class="position-detail">
                        <div class="position-detail-label">Current Price</div>
                        <div>${currentPrice.toFixed(2)} USDT</div>
                    </div>
                    <div class="position-detail">
                        <div class="position-detail-label">Unrealized P&L</div>
                        <div class="${unrealizedPnl >= 0 ? 'profit' : 'loss'}">${unrealizedPnl.toFixed(2)} USDT</div>
                    </div>
                </div>
                <div class="position-actions">
                    <div>
                        <div class="position-detail-label">Stop Loss</div>
                        <div>${position.stopLoss.toFixed(2)}</div>
                    </div>
                    <div>
                        <div class="position-detail-label">Take Profit</div>
                        <div>${position.takeProfit.toFixed(2)}</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Update trades table
function updateTradesTable() {
    const tbody = elements.tradesTable;
    if (!tbody) return;
    
    // Clear current rows
    tbody.innerHTML = '';
    
    // Add new rows (limited to last 10 trades)
    const tradesCount = Math.min(botState.trades.length, 10);
    for (let i = 0; i < tradesCount; i++) {
        const trade = botState.trades[i];
        const row = document.createElement('tr');
        
        // Format time
        const exitTime = new Date(trade.exitTime);
        const formattedTime = exitTime.toLocaleString();
        
        row.innerHTML = `
            <td>${formattedTime}</td>
            <td>${trade.symbol}</td>
            <td>MARKET</td>
            <td>SELL</td>
            <td>${trade.exitPrice.toFixed(2)}</td>
            <td>${trade.quantity}</td>
            <td class="${trade.pnl >= 0 ? 'profit' : 'loss'}">${trade.pnl.toFixed(2)} USDT</td>
        `;
        
        tbody.appendChild(row);
    }
}

// Update API keys
function updateApiKeys() {
    if (!elements.newApiKeyInput || !elements.newApiSecretInput) return;
    
    const newApiKey = elements.newApiKeyInput.value;
    const newApiSecret = elements.newApiSecretInput.value;
    
    if (!newApiKey || !newApiSecret) {
        showAlert('Please enter both API Key and Secret', 'error');
        return;
    }
    
    // Save API keys (in a real app, these should be encrypted)
    localStorage.setItem('apiKey', newApiKey);
    localStorage.setItem('apiSecret', newApiSecret);
    
    // Update masked display
    if (elements.apiKeyDisplay && elements.apiSecretDisplay) {
        elements.apiKeyDisplay.textContent = '•'.repeat(8) + newApiKey.substring(newApiKey.length - 4);
        elements.apiSecretDisplay.textContent = '•'.repeat(8) + newApiSecret.substring(newApiSecret.length - 4);
    }
    
    // Close modal
    if (elements.apiKeysModal) {
        elements.apiKeysModal.style.display = 'none';
    }
    
    // Clear inputs
    elements.newApiKeyInput.value = '';
    elements.newApiSecretInput.value = '';
    
    showAlert('API keys updated successfully', 'success');
    logMessage('info', 'API keys updated');
}

// Reset paper trading balance
function resetPaperBalance() {
    if (!botState.isPaperTrading) {
        showAlert('This option is only available in paper trading mode', 'warning');
        return;
    }
    
    // Reset balance
    botState.balance.USDT = parseFloat(elements.initialBalanceInput ? elements.initialBalanceInput.value : 10000) || 10000;
    botState.balance.BTC = 0;
    botState.balance.ETH = 0;
    
    // Clear positions and trades
    botState.positions = [];
    botState.trades = [];
    
    // Reset PnL
    botState.pnl.daily = 0;
    botState.pnl.total = 0;
    
    // Update UI
    updateBalanceDisplay();
    updatePositionsDisplay();
    updateTradesTable();
    
    // Save state
    savePaperTradingState();
    
    showAlert('Paper trading balance reset', 'success');
    logMessage('info', `Paper trading balance reset to ${botState.balance.USDT} USDT`);
}

// Test notification
function testNotification() {
    if (!elements.discordWebhookInput) return;
    
    const webhookUrl = elements.discordWebhookInput.value;
    
    if (!webhookUrl) {
        showAlert('Please enter a Discord webhook URL', 'warning');
        return;
    }
    
    // Send test notification
    sendDiscordNotification({
        title: 'Test Notification',
        description: 'This is a test notification from your trading bot.',
        color: 0x58a6ff
    });
    
    showAlert('Test notification sent', 'success');
}

// Save settings from UI
function saveSettingsFromUI() {
    // Trading parameters
    if (elements.symbolSelect) botState.settings.symbol = elements.symbolSelect.value;
    if (elements.timeframeSelect) botState.settings.timeframe = elements.timeframeSelect.value;
    if (elements.strategySelect) botState.settings.strategy = 'volty'; // Only volty strategy supported
    
    // Volty Expansion parameters
    if (elements.voltyLengthInput) botState.settings.strategyParams.volty.length = parseInt(elements.voltyLengthInput.value) || 5;
    if (elements.voltyAtrMultInput) botState.settings.strategyParams.volty.atrMult = parseFloat(elements.voltyAtrMultInput.value) || 0.75;
    
    // Risk management
    if (elements.amountInput) botState.settings.amount = parseFloat(elements.amountInput.value);
    if (elements.maxPositionsInput) botState.settings.maxPositions = parseInt(elements.maxPositionsInput.value);
    if (elements.stopLossInput) botState.settings.stopLoss = parseFloat(elements.stopLossInput.value);
    if (elements.takeProfitInput) botState.settings.takeProfit = parseFloat(elements.takeProfitInput.value);
    
    // Paper trading settings
    if (elements.initialBalanceInput) botState.settings.initialBalance = parseFloat(elements.initialBalanceInput.value);
    
    // Notifications
    if (elements.discordWebhookInput) botState.settings.notifications.discordWebhookUrl = elements.discordWebhookInput.value;
    if (elements.notifyTradesCheckbox) botState.settings.notifications.notifyTrades = elements.notifyTradesCheckbox.checked;
    if (elements.notifySignalsCheckbox) botState.settings.notifications.notifySignals = elements.notifySignalsCheckbox.checked;
    if (elements.notifyErrorsCheckbox) botState.settings.notifications.notifyErrors = elements.notifyErrorsCheckbox.checked;
    
    // Save settings
    saveSettings();
    
    // Reload data for new symbol/timeframe
    loadHistoricalData();
    
    // Update WebSocket subscriptions
    if (typeof webSocketHandler !== 'undefined' && webSocketHandler.isConnected) {
        // Unsubscribe from old streams
        webSocketHandler.unsubscribe(`${botState.settings.symbol.toLowerCase()}@kline_${botState.settings.timeframe}`);
        webSocketHandler.unsubscribe(`${botState.settings.symbol.toLowerCase()}@trade`);
        webSocketHandler.unsubscribe(`${botState.settings.symbol.toLowerCase()}@ticker`);
        
        // Subscribe to new streams
        webSocketHandler.subscribe(`${botState.settings.symbol.toLowerCase()}@kline_${botState.settings.timeframe}`);
        webSocketHandler.subscribe(`${botState.settings.symbol.toLowerCase()}@trade`);
        webSocketHandler.subscribe(`${botState.settings.symbol.toLowerCase()}@ticker`);
    }
    
    // Update JSON editor
    updateJsonEditor();
    
    showAlert('Settings saved successfully', 'success');
    logMessage('info', 'Settings updated');
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('botSettings', JSON.stringify(botState.settings));
    localStorage.setItem('isPaperTrading', botState.isPaperTrading.toString());
}

// Load settings from localStorage
function loadSettings() {
    // Load settings
    const savedSettings = localStorage.getItem('botSettings');
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            botState.settings = {...botState.settings, ...settings};
            
            // Ensure volty params exist
            if (!botState.settings.strategyParams.volty) {
                botState.settings.strategyParams.volty = {
                    length: 5,
                    atrMult: 0.75
                };
            }
        } catch (error) {
            console.error('Error parsing saved settings:', error);
        }
    }
    
    // Load paper trading mode
    const savedPaperMode = localStorage.getItem('isPaperTrading');
    if (savedPaperMode !== null) {
        botState.isPaperTrading = savedPaperMode === 'true';
    }
    
    // Apply settings to UI
    if (elements.symbolSelect) elements.symbolSelect.value = botState.settings.symbol;
    if (elements.timeframeSelect) elements.timeframeSelect.value = botState.settings.timeframe;
    if (elements.strategySelect) elements.strategySelect.value = 'volty'; // Only volty strategy supported
    if (elements.amountInput) elements.amountInput.value = botState.settings.amount;
    if (elements.maxPositionsInput) elements.maxPositionsInput.value = botState.settings.maxPositions;
    if (elements.stopLossInput) elements.stopLossInput.value = botState.settings.stopLoss;
    if (elements.takeProfitInput) elements.takeProfitInput.value = botState.settings.takeProfit;
    if (elements.initialBalanceInput) elements.initialBalanceInput.value = botState.settings.initialBalance;
    if (elements.discordWebhookInput) elements.discordWebhookInput.value = botState.settings.notifications.discordWebhookUrl;
    if (elements.notifyTradesCheckbox) elements.notifyTradesCheckbox.checked = botState.settings.notifications.notifyTrades;
    if (elements.notifySignalsCheckbox) elements.notifySignalsCheckbox.checked = botState.settings.notifications.notifySignals;
    if (elements.notifyErrorsCheckbox) elements.notifyErrorsCheckbox.checked = botState.settings.notifications.notifyErrors;
    if (elements.paperModeToggle) elements.paperModeToggle.checked = !botState.isPaperTrading;
    
    // Volty Expansion specific parameters
    if (elements.voltyLengthInput) elements.voltyLengthInput.value = botState.settings.strategyParams.volty.length;
    if (elements.voltyAtrMultInput) elements.voltyAtrMultInput.value = botState.settings.strategyParams.volty.atrMult;
    
    // Update trading mode display
    updateTradingMode();
    
    // Load paper trading state
    loadPaperTradingState();
    
    // Display API key info if available
    const apiKey = localStorage.getItem('apiKey');
    if (apiKey && elements.apiKeyDisplay) {
        elements.apiKeyDisplay.textContent = '•'.repeat(8) + apiKey.substring(apiKey.length - 4);
    }
    
    const apiSecret = localStorage.getItem('apiSecret');
    if (apiSecret && elements.apiSecretDisplay) {
        elements.apiSecretDisplay.textContent = '•'.repeat(8) + apiSecret.substring(apiSecret.length - 4);
    }
    
    // Set strategy JSON editor content
    updateJsonEditor();
    
    logMessage('info', 'Settings loaded');
}

// Save paper trading state
function savePaperTradingState() {
    if (botState.isPaperTrading) {
        localStorage.setItem('paperTradingBalance', JSON.stringify(botState.balance));
        localStorage.setItem('paperTradingPositions', JSON.stringify(botState.positions));
        localStorage.setItem('paperTradingTrades', JSON.stringify(botState.trades));
        localStorage.setItem('paperTradingPnL', JSON.stringify(botState.pnl));
    }
}

// Load paper trading state
function loadPaperTradingState() {
    if (botState.isPaperTrading) {
        const savedBalance = localStorage.getItem('paperTradingBalance');
        if (savedBalance) {
            try {
                botState.balance = JSON.parse(savedBalance);
            } catch (error) {
                console.error('Error parsing saved balance:', error);
            }
        }
        
        const savedPositions = localStorage.getItem('paperTradingPositions');
        if (savedPositions) {
            try {
                botState.positions = JSON.parse(savedPositions);
            } catch (error) {
                console.error('Error parsing saved positions:', error);
            }
        }
        
        const savedTrades = localStorage.getItem('paperTradingTrades');
        if (savedTrades) {
            try {
                botState.trades = JSON.parse(savedTrades);
            } catch (error) {
                console.error('Error parsing saved trades:', error);
            }
        }
        
        const savedPnL = localStorage.getItem('paperTradingPnL');
        if (savedPnL) {
            try {
                botState.pnl = JSON.parse(savedPnL);
            } catch (error) {
                console.error('Error parsing saved PnL:', error);
            }
        }
        
        // Update UI
        updateBalanceDisplay();
        updatePositionsDisplay();
        updateTradesTable();
    }
}

// Clear logs
function clearLogs() {
    if (elements.logContainer) {
        elements.logContainer.innerHTML = '';
    }
}

// Send Discord notification
function sendDiscordNotification(notification) {
    const webhookUrl = botState.settings.notifications.discordWebhookUrl;
    
    if (!webhookUrl) {
        logMessage('warning', 'Discord webhook URL not configured');
        return;
    }
    
    // Prepare payload
    const payload = {
        embeds: [
            {
                title: notification.title || 'Trading Bot Notification',
                description: notification.description || '',
                color: notification.color || 0x0099ff,
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'CryptoTrader Pro'
                }
            }
        ]
    };
    
    // Send webhook request
    fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }).then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        logMessage('info', `Notification sent: ${notification.title}`);
    }).catch(error => {
        console.error('Error sending notification:', error);
        logMessage('error', `Failed to send notification: ${error.message}`);
    });
}

// Validate settings before starting the bot
function validateSettings() {
    // Check amount
    if (isNaN(botState.settings.amount) || botState.settings.amount <= 0) {
        showAlert('Invalid trade amount. Please enter a positive number.', 'error');
        return false;
    }
    
    // Check stop loss and take profit
    if (isNaN(botState.settings.stopLoss) || botState.settings.stopLoss <= 0) {
        showAlert('Invalid stop loss. Please enter a positive number.', 'error');
        return false;
    }
    
    if (isNaN(botState.settings.takeProfit) || botState.settings.takeProfit <= 0) {
        showAlert('Invalid take profit. Please enter a positive number.', 'error');
        return false;
    }
    
    // Check Volty parameters
    if (isNaN(botState.settings.strategyParams.volty.length) || botState.settings.strategyParams.volty.length <= 0) {
        showAlert('Invalid Volty Expansion length. Please enter a positive number.', 'error');
        return false;
    }
    
    if (isNaN(botState.settings.strategyParams.volty.atrMult) || botState.settings.strategyParams.volty.atrMult <= 0) {
        showAlert('Invalid Volty Expansion ATR multiplier. Please enter a positive number.', 'error');
        return false;
    }
    
    return true;
}

// Validate strategy JSON
function validateStrategyJson() {
    if (!elements.jsonEditor) return;
    
    try {
        const jsonText = elements.jsonEditor.textContent;
        const strategyConfig = JSON.parse(jsonText);
        
        // Basic validation
        if (!strategyConfig.strategy || !strategyConfig.parameters) {
            throw new Error('JSON must contain strategy and parameters fields');
        }
        
        // Check if strategy is valid (only volty supported)
        if (strategyConfig.strategy !== 'volty') {
            throw new Error('Only "volty" strategy is supported');
        }
        
        // Check parameters
        if (typeof strategyConfig.parameters.length !== 'number' || strategyConfig.parameters.length <= 0) {
            throw new Error('Length parameter must be a positive number');
        }
        
        if (typeof strategyConfig.parameters.atrMult !== 'number' || strategyConfig.parameters.atrMult <= 0) {
            throw new Error('atrMult parameter must be a positive number');
        }
        
        // Format the JSON for better readability
        elements.jsonEditor.textContent = JSON.stringify(strategyConfig, null, 2);
        
        showAlert('JSON is valid', 'success');
        return true;
    } catch (e) {
        showAlert(`Invalid JSON: ${e.message}`, 'error');
        return false;
    }
}

// Apply strategy JSON
function applyStrategyJson() {
    if (!validateStrategyJson()) return;
    
    try {
        if (!elements.jsonEditor) return;
        
        const jsonText = elements.jsonEditor.textContent;
        const strategyConfig = JSON.parse(jsonText);
        
        // Update strategy parameters
        botState.settings.strategyParams.volty = strategyConfig.parameters;
        
        // Update UI
        if (elements.voltyLengthInput) elements.voltyLengthInput.value = strategyConfig.parameters.length;
        if (elements.voltyAtrMultInput) elements.voltyAtrMultInput.value = strategyConfig.parameters.atrMult;
        
        // Save settings
        saveSettings();
        
        showAlert('Strategy applied successfully', 'success');
        logMessage('info', 'Volatility Expansion Close strategy parameters updated');
        
        return true;
    } catch (e) {
        showAlert(`Failed to apply strategy: ${e.message}`, 'error');
        return false;
    }
}


// Export settings to JSON
function exportSettings() {
    try {
        const exportData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            settings: botState.settings,
            paperTrading: botState.isPaperTrading,
        };

        if (botState.isPaperTrading) {
            exportData.paperTradingState = {
                balance: botState.balance,
                positions: botState.positions,
                trades: botState.trades,
                pnl: botState.pnl,
            };
        }

        const jsonString = JSON.stringify(exportData, null, 2);
        const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(jsonString)}`;
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute('href', dataStr);
        downloadAnchorNode.setAttribute('download', `trading-bot-settings-${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();

        showAlert('Settings exported successfully', 'success');
    } catch (e) {
        showAlert(`Failed to export settings: ${e.message}`, 'error');
    }
}

// Import settings from JSON
function importSettings() {
    try {
        const jsonText = elements.importJsonInput.value;
        if (!jsonText) {
            showAlert('Please paste a valid JSON settings file', 'error');
            return;
        }

        const importData = JSON.parse(jsonText);
        if (!importData.settings) {
            throw new Error('Invalid settings file format');
        }

        botState.settings = importData.settings;

        if (importData.hasOwnProperty('paperTrading')) {
            botState.isPaperTrading = importData.paperTrading;
            elements.paperModeToggle.checked = !botState.isPaperTrading;
            updateTradingMode();
        }

        if (importData.paperTradingState && botState.isPaperTrading) {
            botState.balance = importData.paperTradingState.balance || botState.balance;
            botState.positions = importData.paperTradingState.positions || [];
            botState.trades = importData.paperTradingState.trades || [];
            botState.pnl = importData.paperTradingState.pnl || botState.pnl;

            updateBalanceDisplay();
            updatePositionsDisplay();
            updateTradesTable();
            savePaperTradingState();
        }

        loadSettings();
        saveSettings();

        if (elements.importSettingsModal) {
            elements.importSettingsModal.style.display = 'none';
        }

        showAlert('Settings imported successfully', 'success');
    } catch (e) {
        showAlert(`Failed to import settings: ${e.message}`, 'error');
    }
}

// Run backtest
function runBacktest() {
    const startDate = elements.backtestStartInput.value;
    const endDate = elements.backtestEndInput.value;

    if (!startDate || !endDate) {
        showAlert('Please select start and end dates for backtesting', 'error');
        return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
        showAlert('Start date must be before end date', 'error');
        return;
    }

    showAlert('Backtest started. This may take a few moments...', 'success');

    setTimeout(async () => {
        try {
            const historicalData = await fetchHistoricalData(botState.settings.symbol, botState.settings.timeframe, startDate, endDate);

            if (!historicalData || historicalData.length === 0) {
                showAlert('No historical data available for the selected period', 'error');
                return;
            }

            const results = backtest(historicalData, botState.settings.strategyParams.volty, botState.settings.amount, botState.settings.stopLoss, botState.settings.takeProfit);
            displayBacktestResults(results);
        } catch (error) {
            console.error('Backtest error:', error);
            showAlert(`Backtest failed: ${error.message}`, 'error');
        }
    }, 100);
}

// Display backtest results
function displayBacktestResults(results) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';

    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.width = '80%';
    content.style.maxWidth = '800px';

    const closeButton = document.createElement('span');
    closeButton.className = 'close';
    closeButton.innerHTML = '&times;';
    closeButton.onclick = function () {
        document.body.removeChild(modal);
    };

    let html = `
        <h3>Backtest Results</h3>
        <div class="panel">
            <h4>Summary</h4>
            <table>
                <tr><td>Total Trades:</td><td>${results.summary.totalTrades}</td></tr>
                <tr><td>Win Rate:</td><td>${results.summary.winRate.toFixed(2)}%</td></tr>
                <tr><td>Net Profit:</td><td class="${results.summary.netProfit >= 0 ? 'profit' : 'loss'}">${results.summary.netProfit.toFixed(2)} USDT</td></tr>
                <tr><td>Profit Factor:</td><td>${results.summary.profitFactor.toFixed(2)}</td></tr>
            </table>
        </div>
        <div class="panel">
            <h4>Trades</h4>
            <table>
                <thead>
                    <tr><th>Entry Time</th><th>Exit Time</th><th>Entry Price</th><th>Exit Price</th><th>Type</th><th>Profit</th></tr>
                </thead>
                <tbody>
    `;

    const maxTrades = Math.min(results.trades.length, 20);
    for (let i = 0; i < maxTrades; i++) {
        const trade = results.trades[i];
        html += `
            <tr>
                <td>${new Date(trade.entry).toLocaleString()}</td>
                <td>${new Date(trade.exit).toLocaleString()}</td>
                <td>${trade.entryPrice.toFixed(2)}</td>
                <td>${trade.exitPrice.toFixed(2)}</td>
                <td>${trade.type}</td>
                <td class="${trade.profit >= 0 ? 'profit' : 'loss'}">${trade.profit.toFixed(2)} USDT</td>
            </tr>
        `;
    }

    html += `
                </tbody>
            </table>
        </div>
    `;

    content.innerHTML = html;
    content.prepend(closeButton);
    modal.appendChild(content);
    document.body.appendChild(modal);

    logMessage('info', `Backtest completed: ${results.summary.totalTrades} trades, ${results.summary.winRate.toFixed(2)}% win rate, ${results.summary.netProfit.toFixed(2)} USDT profit`);
}

// Show alert message
function showAlert(message, type = 'success') {
    const alertElement = document.createElement('div');
    alertElement.className = `alert ${type}`;
    alertElement.textContent = message;
    document.body.appendChild(alertElement);

    alertElement.style.position = 'fixed';
    alertElement.style.top = '20px';
    alertElement.style.left = '50%';
    alertElement.style.transform = 'translateX(-50%)';
    alertElement.style.zIndex = '9999';

    setTimeout(() => {
        alertElement.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(alertElement);
        }, 300);
    }, 3000);
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    setupAuthentication();
    updateDateTime();
    setInterval(updateDateTime, 1000);
});
