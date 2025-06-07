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
        strategy: 'original',
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
            original: {
                shortPeriod: 12,
                longPeriod: 26,
                signalPeriod: 9,
                overbought: 0.5,
                oversold: -0.5
            },
            macd: {
                fastPeriod: 12,
                slowPeriod: 26,
                signalPeriod: 9
            },
            rsi: {
                period: 14,
                overbought: 70,
                oversold: 30
            },
            bb: {
                period: 20,
                stdDev: 2
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
    if (webSocketHandler && webSocketHandler.isConnected) {
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
    }
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
    botState.availablePairs
        .filter(pair => !popularPairs.includes(pair.symbol))
        .sort((a, b) => a.symbol.localeCompare(b.symbol))
        .forEach(pair => {
            const option = document.createElement('option');
            option.value = pair.symbol;
            option.textContent = `${pair.baseAsset}/${pair.quoteAsset}`;
            symbolSelect.appendChild(option);
        });
    
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
    
    // Other elements
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
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Initialize UI elements
function initUI() {
    // Start/Stop bot buttons
    elements.startBotButton.addEventListener('click', startBot);
    elements.stopBotButton.addEventListener('click', stopBot);
    
    // Paper trading toggle
    elements.paperModeToggle.addEventListener('change', toggleTradingMode);
    
    // API keys update button
    elements.updateApiKeysButton.addEventListener('click', () => {
        elements.apiKeysModal.style.display = 'block';
    });
    
    // Save API keys button
    elements.saveNewApiKeysButton.addEventListener('click', updateApiKeys);
    
    // Reset paper balance button
    elements.resetPaperBalanceButton.addEventListener('click', resetPaperBalance);
    
    // Test notification button
    elements.testNotificationButton.addEventListener('click', testNotification);
    
    // Save settings button
    elements.saveSettingsButton.addEventListener('click', saveSettingsFromUI);
    
    // Clear logs button
    elements.clearLogsButton.addEventListener('click', clearLogs);
    
    // JSON validation and application
    elements.validateJsonButton.addEventListener('click', validateStrategyJson);
    elements.applyJsonButton.addEventListener('click', applyStrategyJson);
    
    // Backtest button
    elements.runBacktestButton.addEventListener('click', runBacktest);
    
    // Export/Import settings
    elements.exportSettingsButton.addEventListener('click', exportSettings);
    elements.importSettingsButton.addEventListener('click', () => {
        elements.importSettingsModal.style.display = 'block';
    });
    elements.confirmImportButton.addEventListener('click', importSettings);
    
    // WebSocket reconnect button
    elements.reconnectWebsocketButton.addEventListener('click', () => {
        webSocketHandler.init();
    });
    
    // Connection status modal
    elements.connectionStatus.addEventListener('click', showConnectionStatusModal);
    elements.reconnectWsButton.addEventListener('click', () => {
        webSocketHandler.init();
        elements.connectionStatusModal.style.display = 'none';
    });
    
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
        if (event.target === elements.apiKeysModal) {
            elements.apiKeysModal.style.display = 'none';
        } else if (event.target === elements.importSettingsModal) {
            elements.importSettingsModal.style.display = 'none';
        } else if (event.target === elements.connectionStatusModal) {
            elements.connectionStatusModal.style.display = 'none';
        }
    });
    
    // Set initial date values for backtest
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    elements.backtestEndInput.valueAsDate = today;
    elements.backtestStartInput.valueAsDate = oneMonthAgo;
    
    // Update paper/live mode display
    updateTradingMode();
    
    // Update balance display
    updateBalanceDisplay();
}

// Show connection status modal
function showConnectionStatusModal() {
    // Update connection details
    if (webSocketHandler) {
        const status = webSocketHandler.getStatus();
        elements.wsStatus.textContent = status.connected ? 'Connected' : 'Disconnected';
        elements.lastMessageTime.textContent = status.lastMessageTime;
        elements.wsStatus.className = status.connected ? 'status running' : 'status stopped';
    }
    
    // Update API status
    if (botState.connection) {
        elements.apiStatus.textContent = 'Connected to Binance API';
        elements.apiStatus.className = 'status running';
    } else {
        elements.apiStatus.textContent = 'Not connected to API';
        elements.apiStatus.className = 'status stopped';
    }
    
    // Show modal
    elements.connectionStatusModal.style.display = 'block';
}

// Initialize WebSocket connection
function initWebSocket() {
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
    elements.connectionStatus.textContent = 'Connecting...';
    elements.connectionStatus.className = 'status warning';
    elements.wsIndicator.className = 'websocket-status connecting';
    
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
    elements.connectionStatus.textContent = 'Connected';
    elements.connectionStatus.className = 'status running';
    elements.wsIndicator.className = 'websocket-status connected';
    
    // Update connection details
    if (elements.connectionDetails) {
        elements.connectionDetails.textContent = `WebSocket connected to ${botState.settings.symbol}`;
    }
    
    logMessage('info', 'WebSocket connected and subscribed to data streams');
}

// Handle WebSocket disconnected event
function handleWebSocketDisconnected() {
    // Update UI
    elements.connectionStatus.textContent = 'Disconnected';
    elements.connectionStatus.className = 'status stopped';
    elements.wsIndicator.className = 'websocket-status disconnected';
    
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
        updatePriceDisplay(data);
        
        logMessage('debug', `Ticker update: ${data.s} - 24h change: ${data.P}%`);
    }
}

// Update price display with ticker data
function updatePriceDisplay(tickerData) {
    const priceInfo = document.createElement('div');
    priceInfo.className = 'price-info';
    priceInfo.innerHTML = `
        <div class="current-price">${parseFloat(tickerData.c).toFixed(2)} USDT</div>
        <div class="price-change ${parseFloat(tickerData.P) >= 0 ? 'positive' : 'negative'}">
            ${parseFloat(tickerData.P) >= 0 ? '+' : ''}${parseFloat(tickerData.P).toFixed(2)}%
        </div>
    `;
    
    // Update or replace existing price info
    const existingPriceInfo = document.querySelector('.price-info');
    if (existingPriceInfo) {
        existingPriceInfo.parentNode.replaceChild(priceInfo, existingPriceInfo);
    } else {
        // Add before chart if doesn't exist
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
            chartContainer.parentNode.insertBefore(priceInfo, chartContainer);
        }
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
        elements.priceChart.style.opacity = '0.5';
        
        // Get data through Binance API
        if (botState.connection) {
            const data = await botState.connection.getKlines({
                symbol: botState.settings.symbol,
                interval: botState.settings.timeframe,
                limit: 100
            });
            
            // Clear existing data
            botState.chart.data.datasets[0].data = [];
            
            // Set chart data
            if (data && data.length) {
                // Store candles for strategy analysis
                botState.marketData.candles = data;
                
                // Set current price from last candle
                botState.marketData.currentPrice = data[data.length - 1].close;
                
                // Add candles to chart
                botState.chart.data.datasets[0].data = data;
                
                // Update chart
                botState.chart.update();
                
                // Update positions with current price
                updatePositionsDisplay();
                
                logMessage('info', `Loaded ${data.length} historical candles for ${botState.settings.symbol}`);
            } else {
                logMessage('error', 'Failed to load historical data');
            }
        } else {
            logMessage('error', 'No API connection available');
        }
        
        // Reset loading state
        elements.priceChart.style.opacity = '1';
    } catch (error) {
        console.error('Error loading historical data:', error);
        logMessage('error', `Failed to load historical data: ${error.message}`);
        elements.priceChart.style.opacity = '1';
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
        // Since we're using the public API, we'll continue with the current client
        logMessage('warning', 'Using public API for trading (demo mode)');
    }
    
    // Subscribe to data streams if needed
    if (webSocketHandler && !webSocketHandler.isConnected) {
        webSocketHandler.init();
    }
    
    // Update UI
    elements.startBotButton.style.display = 'none';
    elements.stopBotButton.style.display = 'inline-block';
    
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
    elements.startBotButton.style.display = 'inline-block';
    elements.stopBotButton.style.display = 'none';
    
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

// ... continuing from where we left off

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
        
        // Execute strategy
        const signal = TradingStrategies.executeStrategy(
            botState.settings.strategy,
            botState.settings.strategyParams[botState.settings.strategy],
            botState.marketData.candles
        );
        
        // Process signal if exists
        if (signal) {
            logMessage('info', `Signal generated: ${signal.action} at ${signal.price}`);
            
            // Check if we can execute trade
            if (canExecuteTrade(signal.action)) {
                // Execute trade
                executeTrade(signal);
            }
        }
    }, intervalTime);
    
    logMessage('info', 'Trading loop started');
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
    
    if (botState.positions.length === 0) {
        container.innerHTML = '<p>No active positions.</p>';
        return;
    }
    
    let html = '';
    botState.positions.forEach(position => {
        const currentPrice = botState.marketData.currentPrice;
        const unrealizedPnl = (currentPrice - position.entryPrice) * position.quantity;
        const pnlPercent = ((currentPrice / position.entryPrice) - 1) * 100;
        
        html += `
            <div class="position-card">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <h4>${position.symbol}</h4>
                    <span class="badge ${unrealizedPnl >= 0 ? 'profit' : 'loss'}">${pnlPercent.toFixed(2)}%</span>
                </div>
                <div>Entry: ${position.entryPrice.toFixed(2)} USDT</div>
                <div>Quantity: ${position.quantity}</div>
                <div>Current: ${currentPrice.toFixed(2)} USDT</div>
                <div>Unrealized P&L: ${unrealizedPnl.toFixed(2)} USDT</div>
                <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                    <div>SL: ${position.stopLoss.toFixed(2)}</div>
                    <div>TP: ${position.takeProfit.toFixed(2)}</div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Update trades table
function updateTradesTable() {
    const tbody = elements.tradesTable;
    
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
    elements.apiKeyDisplay.textContent = '•'.repeat(8) + newApiKey.substring(newApiKey.length - 4);
    elements.apiSecretDisplay.textContent = '•'.repeat(8) + newApiSecret.substring(newApiSecret.length - 4);
    
    // Close modal
    elements.apiKeysModal.style.display = 'none';
    
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
    botState.balance.USDT = parseFloat(elements.initialBalanceInput.value) || 10000;
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
    const webhookUrl = elements.discordWebhookUrl.value;
    
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
    botState.settings.symbol = elements.symbolSelect.value;
    botState.settings.timeframe = elements.timeframeSelect.value;
    botState.settings.strategy = elements.strategySelect.value;
    
    // Risk management
    botState.settings.amount = parseFloat(elements.amountInput.value);
    botState.settings.maxPositions = parseInt(elements.maxPositionsInput.value);
    botState.settings.stopLoss = parseFloat(elements.stopLossInput.value);
    botState.settings.takeProfit = parseFloat(elements.takeProfitInput.value);
    
    // Paper trading settings
    botState.settings.initialBalance = parseFloat(elements.initialBalanceInput.value);
    
    // Notifications
    botState.settings.notifications.discordWebhookUrl = elements.discordWebhookUrl.value;
    botState.settings.notifications.notifyTrades = elements.notifyTradesCheckbox.checked;
    botState.settings.notifications.notifySignals = elements.notifySignalsCheckbox.checked;
    botState.settings.notifications.notifyErrors = elements.notifyErrorsCheckbox.checked;
    
    // Save settings
    saveSettings();
    
    // Reload data for new symbol/timeframe
    loadHistoricalData();
    
    // Update WebSocket subscriptions
    if (webSocketHandler && webSocketHandler.isConnected) {
        // Unsubscribe from old streams
        webSocketHandler.unsubscribe(`${botState.settings.symbol.toLowerCase()}@kline_${botState.settings.timeframe}`);
        webSocketHandler.unsubscribe(`${botState.settings.symbol.toLowerCase()}@trade`);
        webSocketHandler.unsubscribe(`${botState.settings.symbol.toLowerCase()}@ticker`);
        
        // Subscribe to new streams
        webSocketHandler.subscribe(`${botState.settings.symbol.toLowerCase()}@kline_${botState.settings.timeframe}`);
        webSocketHandler.subscribe(`${botState.settings.symbol.toLowerCase()}@trade`);
        webSocketHandler.subscribe(`${botState.settings.symbol.toLowerCase()}@ticker`);
    }
    
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
    elements.symbolSelect.value = botState.settings.symbol;
    elements.timeframeSelect.value = botState.settings.timeframe;
    elements.strategySelect.value = botState.settings.strategy;
    elements.amountInput.value = botState.settings.amount;
    elements.maxPositionsInput.value = botState.settings.maxPositions;
    elements.stopLossInput.value = botState.settings.stopLoss;
    elements.takeProfitInput.value = botState.settings.takeProfit;
    elements.initialBalanceInput.value = botState.settings.initialBalance;
    elements.discordWebhookUrl.value = botState.settings.notifications.discordWebhookUrl;
    elements.notifyTradesCheckbox.checked = botState.settings.notifications.notifyTrades;
    elements.notifySignalsCheckbox.checked = botState.settings.notifications.notifySignals;
    elements.notifyErrorsCheckbox.checked = botState.settings.notifications.notifyErrors;
    elements.paperModeToggle.checked = !botState.isPaperTrading;
    
    // Update trading mode display
    updateTradingMode();
    
    // Load paper trading state
    loadPaperTradingState();
    
    // Display API key info if available
    const apiKey = localStorage.getItem('apiKey');
    if (apiKey) {
        elements.apiKeyDisplay.textContent = '•'.repeat(8) + apiKey.substring(apiKey.length - 4);
    }
    
    const apiSecret = localStorage.getItem('apiSecret');
    if (apiSecret) {
        elements.apiSecretDisplay.textContent = '•'.repeat(8) + apiSecret.substring(apiSecret.length - 4);
    }
    
    // Set strategy JSON editor content
    const strategyParams = botState.settings.strategyParams[botState.settings.strategy];
    elements.jsonEditor.textContent = JSON.stringify({
        strategy: botState.settings.strategy,
        parameters: strategyParams
    }, null, 2);
    
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
                    text: 'Binance Trading Bot'
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
    
    // Check strategy
    if (!botState.settings.strategyParams[botState.settings.strategy]) {
        showAlert('Invalid trading strategy.', 'error');
        return false;
    }
    
    return true;
}

// Validate strategy JSON
function validateStrategyJson() {
    try {
        const jsonText = elements.jsonEditor.textContent;
        const strategyConfig = JSON.parse(jsonText);
        
        // Basic validation
        if (!strategyConfig.strategy || !strategyConfig.parameters) {
            throw new Error('JSON must contain strategy and parameters fields');
        }
        
        // Check if strategy is valid
        const validStrategies = ['original', 'macd', 'rsi', 'bb'];
        if (!validStrategies.includes(strategyConfig.strategy)) {
            throw new Error(`Invalid strategy. Must be one of: ${validStrategies.join(', ')}`);
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
        const jsonText = elements.jsonEditor.textContent;
        const strategyConfig = JSON.parse(jsonText);
        
        // Update strategy in settings
        botState.settings.strategy = strategyConfig.strategy;
        elements.strategySelect.value = strategyConfig.strategy;
        
        // Update strategy parameters
        botState.settings.strategyParams[strategyConfig.strategy] = strategyConfig.parameters;
        
        // Save settings
        saveSettings();
        
        showAlert('Strategy applied successfully', 'success');
        logMessage('info', `Strategy updated to ${strategyConfig.strategy}`);
        
        return true;
    } catch (e) {
        showAlert(`Failed to apply strategy: ${e.message}`, 'error');
        return false;
    }
}

// Export settings to JSON
function exportSettings() {
    try {
        // Create a full export of settings
        const exportData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            settings: botState.settings,
            paperTrading: botState.isPaperTrading
        };
        
        // Add paper trading state if in paper mode
        if (botState.isPaperTrading) {
            exportData.paperTradingState = {
                balance: botState.balance,
                positions: botState.positions,
                trades: botState.trades
            };
        }
        
        // Convert to JSON string
        const jsonString = JSON.stringify(exportData, null, 2);
        
        // Create download link
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `trading-bot-settings-${new Date().toISOString().slice(0,10)}.json`);
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
        
        // Validate import data
        if (!importData.settings) {
            throw new Error('Invalid settings file format');
        }
        
        // Update settings
        botState.settings = importData.settings;
        
        // Update trading mode if specified
        if (importData.hasOwnProperty('paperTrading')) {
            botState.isPaperTrading = importData.paperTrading;
            elements.paperModeToggle.checked = !botState.isPaperTrading;
            updateTradingMode();
        }
        
        // Import paper trading state if available
        if (importData.paperTradingState && botState.isPaperTrading) {
            botState.balance = importData.paperTradingState.balance || botState.balance;
            botState.positions = importData.paperTradingState.positions || [];
            botState.trades = importData.paperTradingState.trades || [];
            
            updateBalanceDisplay();
            updatePositionsDisplay();
            updateTradesTable();
            savePaperTradingState();
        }
        
        // Update UI
        loadSettings();
        
        // Save settings
        saveSettings();
        
        // Close modal
        elements.importSettingsModal.style.display = 'none';
        
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
    
    // Validate dates
    if (new Date(startDate) >= new Date(endDate)) {
        showAlert('Start date must be before end date', 'error');
        return;
    }
    
    showAlert('Backtest started. This may take a few moments...', 'success');
    
    // Start backtest in background
    setTimeout(async () => {
        try {
            // Fetch historical data
            const historicalData = await fetchHistoricalData(
                botState.settings.symbol,
                botState.settings.timeframe,
                startDate,
                endDate
            );
            
            if (!historicalData || historicalData.length === 0) {
                showAlert('No historical data available for the selected period', 'error');
                return;
            }
            
            // Run backtest
            const results = backtest(
                historicalData,
                botState.settings.strategy,
                botState.settings.strategyParams[botState.settings.strategy],
                botState.settings.amount,
                botState.settings.stopLoss,
                botState.settings.takeProfit
            );
            
            // Display results
            displayBacktestResults(results);
            
        } catch (error) {
            console.error('Backtest error:', error);
            showAlert(`Backtest failed: ${error.message}`, 'error');
        }
    }, 100);
}

// Fetch historical data for backtesting
async function fetchHistoricalData(symbol, timeframe, startDate, endDate) {
    try {
        // Convert dates to timestamps
        const startTime = new Date(startDate).getTime();
        const endTime = new Date(endDate).getTime();
        
        // Use Binance API to get historical data
        if (botState.connection) {
            return await botState.connection.getKlines({
                symbol: symbol,
                interval: timeframe,
                startTime: startTime,
                endTime: endTime,
                limit: 1000 // Maximum allowed by Binance API
            });
        } else {
            throw new Error('No API connection available');
        }
    } catch (error) {
        console.error('Error fetching historical data:', error);
        throw error;
    }
}

// Run backtest with historical data
function backtest(historicalData, strategy, strategyParams, amount, stopLossPercent, takeProfitPercent) {
    // Initialize results
    const results = {
        trades: [],
        summary: {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            totalProfit: 0,
            totalLoss: 0,
            netProfit: 0,
            maxDrawdown: 0,
            profitFactor: 0
        }
    };
    
    // Initialize backtest state
    let equity = amount;
    let position = null;
    let maxEquity = amount;
    let drawdown = 0;
    
    // Process each candle
    for (let i = 50; i < historicalData.length; i++) { // Skip first 50 candles for indicators to warm up
        const candle = historicalData[i];
        const price = parseFloat(candle.close);
        
        // Skip if no price
        if (!price) continue;
        
        // Get subset of data for signal calculation
        const dataSubset = historicalData.slice(0, i + 1);
        
        // Check for position exit (stop loss or take profit)
        if (position) {
            // Check stop loss
            if (price <= position.stopLoss) {
                // Close position at stop loss
                const loss = (position.stopLoss - position.entryPrice) * position.quantity;
                equity += loss;
                
                // Record trade
                results.trades.push({
                    entry: position.entryTime,
                    exit: candle.time,
                    entryPrice: position.entryPrice,
                    exitPrice: position.stopLoss,
                    quantity: position.quantity,
                    profit: loss,
                    type: 'STOP_LOSS'
                });
                
                // Update stats
                results.summary.totalTrades++;
                results.summary.losingTrades++;
                results.summary.totalLoss += Math.abs(loss);
                
                // Reset position
                position = null;
            }
            // Check take profit
            else if (price >= position.takeProfit) {
                // Close position at take profit
                const profit = (position.takeProfit - position.entryPrice) * position.quantity;
                equity += profit;
                
                // Record trade
                results.trades.push({
                    entry: position.entryTime,
                    exit: candle.time,
                    entryPrice: position.entryPrice,
                    exitPrice: position.takeProfit,
                    quantity: position.quantity,
                    profit: profit,
                    type: 'TAKE_PROFIT'
                });
                
                // Update stats
                results.summary.totalTrades++;
                results.summary.winningTrades++;
                results.summary.totalProfit += profit;
                
                // Reset position
                position = null;
            }
        }
        
        // Get signal
        const signal = TradingStrategies.executeStrategy(strategy, strategyParams, dataSubset);
        
        // Process signal
        if (signal) {
            if (signal.action === 'BUY' && !position) {
                // Calculate quantity
                const quantity = amount / price;
                
                // Open position
                position = {
                    entryPrice: price,
                    entryTime: candle.time,
                    quantity: quantity,
                    stopLoss: price * (1 - stopLossPercent / 100),
                    takeProfit: price * (1 + takeProfitPercent / 100)
                };
            }
            else if (signal.action === 'SELL' && position) {
                // Close position at market
                const profit = (price - position.entryPrice) * position.quantity;
                equity += profit;
                
                // Record trade
                results.trades.push({
                    entry: position.entryTime,
                    exit: candle.time,
                    entryPrice: position.entryPrice,
                    exitPrice: price,
                    quantity: position.quantity,
                    profit: profit,
                    type: 'SIGNAL'
                });
                
                // Update stats
                results.summary.totalTrades++;
                if (profit >= 0) {
                    results.summary.winningTrades++;
                    results.summary.totalProfit += profit;
                } else {
                    results.summary.losingTrades++;
                    results.summary.totalLoss += Math.abs(profit);
                }
                
                // Reset position
                position = null;
            }
        }
        
        // Update max equity and drawdown
        if (equity > maxEquity) {
            maxEquity = equity;
        } else {
            const currentDrawdown = (maxEquity - equity) / maxEquity * 100;
            if (currentDrawdown > drawdown) {
                drawdown = currentDrawdown;
            }
        }
    }
    
    // Calculate summary stats
    results.summary.netProfit = results.summary.totalProfit - results.summary.totalLoss;
    results.summary.winRate = results.summary.totalTrades > 0 
        ? (results.summary.winningTrades / results.summary.totalTrades) * 100 
        : 0;
    results.summary.maxDrawdown = drawdown;
    results.summary.profitFactor = results.summary.totalLoss > 0 
        ? results.summary.totalProfit / results.summary.totalLoss 
        : results.summary.totalProfit > 0 ? Infinity : 0;
    
    return results;
}

// Display backtest results
function displayBacktestResults(results) {
    // Create modal for backtest results
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.width = '80%';
    content.style.maxWidth = '800px';
    
    // Add close button
    const closeButton = document.createElement('span');
    closeButton.className = 'close';
    closeButton.innerHTML = '&times;';
    closeButton.onclick = function() {
        document.body.removeChild(modal);
    };
    
    // Create content
    let html = `
        <h3>Backtest Results</h3>
        <div class="panel">
            <h4>Summary</h4>
            <table>
                <tr>
                    <td>Total Trades:</td>
                    <td>${results.summary.totalTrades}</td>
                </tr>
                <tr>
                    <td>Win Rate:</td>
                    <td>${results.summary.winRate.toFixed(2)}%</td>
                </tr>
                <tr>
                    <td>Net Profit:</td>
                    <td class="${results.summary.netProfit >= 0 ? 'profit' : 'loss'}">${results.summary.netProfit.toFixed(2)} USDT</td>
                </tr>
                <tr>
                    <td>Max Drawdown:</td>
                    <td>${results.summary.maxDrawdown.toFixed(2)}%</td>
                </tr>
                <tr>
                    <td>Profit Factor:</td>
                    <td>${results.summary.profitFactor.toFixed(2)}</td>
                </tr>
            </table>
        </div>
        
        <div class="panel">
            <h4>Trades</h4>
            <table>
                <thead>
                    <tr>
                        <th>Entry Time</th>
                        <th>Exit Time</th>
                        <th>Entry Price</th>
                        <th>Exit Price</th>
                        <th>Type</th>
                        <th>Profit</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add trades (limit to max 20 for display)
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
            ${results.trades.length > 20 ? `<p>Showing ${maxTrades} of ${results.trades.length} trades</p>` : ''}
        </div>
    `;
    
    // Set content
    content.innerHTML = html;
    content.prepend(closeButton);
    
    // Add to modal
    modal.appendChild(content);
    
    // Add to document
    document.body.appendChild(modal);
    
    // Log backtest results
    logMessage('info', `Backtest completed: ${results.summary.totalTrades} trades, ${results.summary.winRate.toFixed(2)}% win rate, ${results.summary.netProfit.toFixed(2)} USDT profit`);
}

// Show alert message
function showAlert(message, type = 'success') {
    // Create alert element
    const alertElement = document.createElement('div');
    alertElement.className = `alert ${type}`;
    alertElement.textContent = message;
    
    // Add to document
    document.body.appendChild(alertElement);
    
    // Position at the top
    alertElement.style.position = 'fixed';
    alertElement.style.top = '20px';
    alertElement.style.left = '50%';
    alertElement.style.transform = 'translateX(-50%)';
    alertElement.style.zIndex = '9999';
    
    // Remove after 3 seconds
    setTimeout(() => {
        alertElement.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(alertElement);
        }, 300);
    }, 3000);
}

// Log message to log container
function logMessage(level, message) {
    // Check if we should log this level
    const selectedLevel = elements.logLevelSelect ? elements.logLevelSelect.value : 'info';
    const levels = ['debug', 'info', 'warning', 'error'];
    const selectedIndex = levels.indexOf(selectedLevel);
    const messageIndex = levels.indexOf(level);
    
    if (messageIndex < selectedIndex) {
        // Skip logs below the selected level
        return;
    }
    
    // Create log element
    const logElement = document.createElement('div');
    logElement.className = `log-entry ${level}`;
    
    // Format timestamp
    const timestamp = new Date().toISOString();
    
    // Set content
    logElement.innerHTML = `
        <span class="log-time">${timestamp}</span>
        <span class="log-level">[${level.toUpperCase()}]</span>
        <span class="log-message">${message}</span>
    `;
    
    // Add to container
    if (elements.logContainer) {
        elements.logContainer.appendChild(logElement);
        
        // Scroll to bottom
        elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
    }
    
    // Log to console as well
    console[level === 'warning' ? 'warn' : level](message);
}

// Update date and time
function updateDateTime() {
    const now = new Date();
    const dateTimeElement = document.getElementById('current-datetime');
    if (dateTimeElement) {
        dateTimeElement.textContent = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Setup authentication
    setupAuthentication();
    
    // Initialize date and time in footer
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Add custom styles for price info
    const style = document.createElement('style');
    style.textContent = `
        .price-info {
            background-color: #161b22;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 20px;
            border: 1px solid #30363d;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .current-price {
            font-size: 24px;
            font-weight: bold;
        }
        .price-change {
            font-size: 16px;
            font-weight: bold;
            padding: 4px 8px;
            border-radius: 4px;
        }
        .price-change.positive {
            background-color: #238636;
            color: white;
        }
        .price-change.negative {
            background-color: #da3633;
            color: white;
        }
        
        /* Log entry styles */
        .log-entry {
            padding: 4px 0;
            border-bottom: 1px solid #30363d;
        }
        .log-time {
            color: #8b949e;
            margin-right: 8px;
        }
        .log-level {
            font-weight: bold;
            margin-right: 8px;
        }
        .log-entry.debug .log-level {
            color: #8b949e;
        }
        .log-entry.info .log-level {
            color: #58a6ff;
        }
        .log-entry.warning .log-level {
            color: #f0883e;
        }
        .log-entry.error .log-level {
            color: #f85149;
        }
    `;
    document.head.appendChild(style);
});
