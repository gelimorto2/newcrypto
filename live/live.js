document.addEventListener("click", function(e) {
  console.log("Element clicked:", e.target);
}, true);


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
    priceDataTimer: null
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
    elements.passwordInput.value = '';
    
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
    
    // Initialize chart
    initChart();
    
    // Initialize WebSocket connection
    initWebSocket();
    
    // Initialize market data updates
    startMarketDataUpdates();
    
    // Log initialization
    logMessage('info', 'Application initialized');
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

// Initialize WebSocket connection
function initWebSocket() {
    // Initialize WebSocket with Binance stream
    webSocketHandler.init();
    
    // Register WebSocket event listeners
    webSocketHandler.on('connected', handleWebSocketConnected);
    webSocketHandler.on('disconnected', handleWebSocketDisconnected);
    webSocketHandler.on('kline', handleKlineUpdate);
    webSocketHandler.on('trade', handleTradeUpdate);
    webSocketHandler.on('ticker', handleTickerUpdate);
    webSocketHandler.on('error', handleWebSocketError);
}

// Handle WebSocket connected event
function handleWebSocketConnected() {
    // Subscribe to kline data for the selected symbol and timeframe
    const klineStream = `${botState.settings.symbol.toLowerCase()}@kline_${botState.settings.timeframe}`;
    webSocketHandler.subscribe(klineStream);
    
    // Subscribe to trade data
    const tradeStream = `${botState.settings.symbol.toLowerCase()}@trade`;
    webSocketHandler.subscribe(tradeStream);
    
    // Update UI
    elements.connectionStatus.textContent = 'Connected';
    elements.connectionStatus.className = 'status running';
    
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
        // You can use this for additional market data display
        logMessage('debug', `Ticker update: ${data.s} - 24h change: ${data.p}%`);
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
    // Get the chart canvas element
    const chartCanvas = document.getElementById('price-chart');
    
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
                        unit: 'hour',
                        displayFormats: {
                            hour: 'MM-dd HH:mm'
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
                                `Close: ${data.close}`
                            ];
                        }
                    }
                }
            }
        }
    });
    
    // Initial chart data load
    loadHistoricalData();
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
        
        // Limit to last 100 candles
        if (dataset.data.length > 100) {
            dataset.data.shift();
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
        
        // Get data through Binance API or mock data
        let data;
        
        if (botState.connection) {
            // Use API client
            data = await botState.connection.getKlines({
                symbol: botState.settings.symbol,
                interval: botState.settings.timeframe,
                limit: 100
            });
        } else {
            // Create mock connection for paper trading
            const mockClient = new BinanceApiClient('demo', 'demo');
            data = await mockClient.getKlines({
                symbol: botState.settings.symbol,
                interval: botState.settings.timeframe,
                limit: 100
            });
        }
        
        // Clear existing data
        botState.chart.data.datasets[0].data = [];
        
        // Set chart data
        if (data && data.length) {
            // Store candles for strategy analysis
            botState.marketData.candles = data;
            
            // Set current price from last candle
            botState.marketData.currentPrice = parseFloat(data[data.length - 1].close);
            
            // Add candles to chart
            data.forEach(candle => {
                botState.chart.data.datasets[0].data.push({
                    time: candle.time,
                    open: parseFloat(candle.open),
                    high: parseFloat(candle.high),
                    low: parseFloat(candle.low),
                    close: parseFloat(candle.close),
                    volume: parseFloat(candle.volume)
                });
            });
            
            // Update chart
            botState.chart.update();
            
            // Update positions with current price
            updatePositionsDisplay();
            
            logMessage('info', `Loaded ${data.length} historical candles for ${botState.settings.symbol}`);
        } else {
            logMessage('error', 'Failed to load historical data');
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
                botState.connection.getAccountInfo().then(accountInfo => {
                    const balances = accountInfo.balances || [];
                    const usdtBalance = balances.find(b => b.asset === 'USDT');
                    const btcBalance = balances.find(b => b.asset === 'BTC');
                    const ethBalance = balances.find(b => b.asset === 'ETH');
                    
                    elements.balanceDisplay.innerHTML = `
                        <div>USDT: ${usdtBalance ? parseFloat(usdtBalance.free).toFixed(2) : '0.00'}</div>
                        <div>BTC: ${btcBalance ? parseFloat(btcBalance.free).toFixed(8) : '0.00000000'}</div>
                        <div>ETH: ${ethBalance ? parseFloat(ethBalance.free).toFixed(8) : '0.00000000'}</div>
                    `;
                }).catch(error => {
                    console.error('Error fetching account info:', error);
                    logMessage('error', `Failed to fetch account info: ${error.message}`);
                });
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
        
        // Create API client
        try {
            botState.connection = new BinanceApiClient(apiKey, apiSecret);
            logMessage('info', 'Connected to Binance API');
        } catch (error) {
            showAlert(`Failed to connect to API: ${error.message}`, 'error');
            logMessage('error', `API connection error: ${error.message}`);
            return;
        }
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
        
        // Execute strategy
        const signal = executeStrategy(
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

// Execute trading strategy
function executeStrategy(strategy, params, data) {
    // This is a placeholder for strategy execution
    // In a real application, this would implement the actual trading strategies
    
    // Mock strategy for demo
    if (Math.random() > 0.95) { // 5% chance of signal
        // Generate random signal
        const action = Math.random() > 0.5 ? 'BUY' : 'SELL';
        
        return {
            action: action,
            price: botState.marketData.currentPrice,
            reason: 'STRATEGY_SIGNAL'
        };
    }
    
    return null;
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
        
        // Subscribe to new streams
        webSocketHandler.subscribe(`${botState.settings.symbol.toLowerCase()}@kline_${botState.settings.timeframe}`);
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
    
    // In a real app, this would send an actual webhook request
    // For demo purposes, we'll just log it
    console.log('Sending Discord notification:', payload);
    logMessage('info', `Notification sent: ${notification.title}`);
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Setup authentication
    setupAuthentication();
    
    // Initialize date and time in footer
    updateDateTime();
    setInterval(updateDateTime, 1000);
});
