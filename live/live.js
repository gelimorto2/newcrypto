// Constants and Configuration
const API_URL = 'https://api.binance.com';
const API_KEY_STORAGE = 'binance_api_keys';
const SETTINGS_STORAGE = 'trading_settings';
const PROXY_URL = 'https://your-cors-proxy.com/'; // Add a CORS proxy

// State variables
let apiKey = '';
let apiSecret = '';
let isPaperTrading = false; // New variable to track trading mode
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
let pingInterval = null;
let apiPingLatency = 0;
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
    startLiveClock();
    checkMobileDevice();
    loadSettings();
    
    // Initialize with trading inactive
    updateBotStatus(false);
    
    // Load initial empty chart
    initializeEmptyCharts();
    
    // Check for stored API keys
    checkStoredApiKeys();
    
    // Add mutation observer to detect tab changes that might affect chart visibility
    const tabContent = document.querySelector('.tab-content');
    if (tabContent) {
        const observer = new MutationObserver(() => {
            // When tabs change, ensure charts render correctly
            setTimeout(ensureChartsRendered, 100);
        });
        
        observer.observe(tabContent, {
            attributes: true,
            childList: true,
            subtree: true
        });
    }
});

// Cache frequently used DOM elements
function cacheElements() {
    // Main elements
    elements.loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    elements.apiKeyForm = document.getElementById('apiKeyForm');
    elements.apiKeyInput = document.getElementById('apiKey');
    elements.apiSecretInput = document.getElementById('apiSecret');
    elements.rememberKeysCheckbox = document.getElementById('rememberLogin'); // Fixed reference
    
    // Status and info elements
    elements.clockDisplay = document.getElementById('clock-display');
    elements.botStatus = document.getElementById('bot-status');
    elements.botActivity = document.getElementById('bot-activity');
    elements.activityStatus = document.getElementById('activity-status');
    elements.lastTickInfo = document.getElementById('last-tick-info');
    elements.tradingModeIndicator = document.getElementById('trading-mode-indicator');
    
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
    elements.statPing = document.getElementById('stat-ping');
    
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
    
    // Cache new elements
    elements.usernameInput = document.getElementById('username');
    elements.passwordInput = document.getElementById('password');
    elements.loginButton = document.getElementById('loginButton');
    elements.tradingModeSwitch = document.getElementById('tradingModeSwitch');
    elements.tradingModeIndicator = document.getElementById('trading-mode-indicator');
    elements.switchTradingModeBtn = document.getElementById('switch-trading-mode-btn');
    elements.manualApiKeyButton = document.getElementById('manualApiKeyButton');
    elements.apiKeyInputs = document.getElementById('apiKeyInputs');
    elements.standardLoginForm = document.getElementById('standardLoginForm');
    elements.liveModeWarning = document.getElementById('liveModeWarning');
    
    // Account balance display elements
    elements.btcBalanceValue = document.getElementById('btc-balance');
    elements.ethBalanceValue = document.getElementById('eth-balance');
    elements.usdtBalanceValue = document.getElementById('usdt-balance');
    elements.totalValueValue = document.getElementById('total-value');
}

// Setup event listeners
function setupEventListeners() {
    // API key form submission
    if (elements.apiKeyForm) {
        elements.apiKeyForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const key = elements.apiKeyInput.value.trim();
            const secret = elements.apiSecretInput.value.trim();
            if (key && secret) {
                connectToApi(key, secret, elements.rememberKeysCheckbox.checked);
            }
        });
    }
    
    // Switch to paper trading
    if (elements.switchTradingModeBtn) {
        elements.switchTradingModeBtn.addEventListener('click', toggleTradingMode);
    }
    
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
    
    // Add login button handler
    elements.loginButton.addEventListener('click', () => {
        const isApiMode = elements.apiKeyInputs.style.display !== 'none';
        
        if (isApiMode) {
            // Direct API key login
            const key = elements.apiKeyInput.value.trim();
            const secret = elements.apiSecretInput.value.trim();
            if (key && secret) {
                connectToApi(key, secret, elements.rememberKeysCheckbox.checked);
            }
        } else {
            // Username/password login
            const username = elements.usernameInput.value.trim();
            const password = elements.passwordInput.value.trim();
            if (username && password) {
                handleLogin(username, password);
            }
        }
    });
    
    // Trading mode switch
    elements.tradingModeSwitch.addEventListener('change', (e) => {
        const isPaperMode = e.target.checked;
        document.getElementById('loginButtonText').textContent = isPaperMode ? 
            'Start Paper Trading' : 'Login to Live Trading';
        elements.liveModeWarning.style.display = isPaperMode ? 'none' : 'block';
    });
    
    // Switch between API key input and standard login
    elements.manualApiKeyButton.addEventListener('click', () => {
        const isApiMode = elements.apiKeyInputs.style.display !== 'none';
        
        if (isApiMode) {
            elements.apiKeyInputs.style.display = 'none';
            elements.standardLoginForm.style.display = 'block';
            document.getElementById('manualKeyText').textContent = 'Use API Keys Directly';
        } else {
            elements.apiKeyInputs.style.display = 'block';
            elements.standardLoginForm.style.display = 'none';
            document.getElementById('manualKeyText').textContent = 'Use Standard Login';
        }
    });
}

// Update bot status display
function updateBotStatus(isActive) {
    if (isActive) {
        elements.botStatus.textContent = '🔴 LIVE TRADING - ACTIVE';
        elements.botStatus.classList.remove('idle');
        elements.botStatus.classList.add('active');
        elements.botActivity.classList.remove('scanning', 'waiting');
        elements.botActivity.classList.add('trading');
        elements.activityStatus.textContent = 'Trading Active';
    } else {
        elements.botStatus.textContent = '🔴 LIVE TRADING - IDLE';
        elements.botStatus.classList.remove('active');
        elements.botStatus.classList.add('idle');
        elements.botActivity.classList.remove('trading');
        elements.botActivity.classList.add('waiting');
        elements.activityStatus.textContent = 'Trading Inactive';
    }
}

// Start the live clock
function startLiveClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

// Improved function to initialize empty charts
function initializeEmptyCharts() {
    // Default empty data point for charts
    const defaultData = [{
        time: Math.floor(Date.now() / 1000),
        value: 0
    }];
    
    // Initialize with empty but valid data structures
    initializePriceChart([]);
    initializeEquityChart(defaultData);
    initializeDepthChart();
    
    // Add fallback timeout to ensure charts render
    setTimeout(() => {
        if (chartInstance && chartInstance.chart) {
            chartInstance.chart.applyOptions({
                width: elements.priceChart.clientWidth,
                height: elements.priceChart.clientHeight
            });
        }
        
        if (equityChartInstance && equityChartInstance.chart) {
            equityChartInstance.chart.applyOptions({
                width: elements.equityChart.clientWidth,
                height: elements.equityChart.clientHeight
            });
        }
        
        if (depthChartInstance && depthChartInstance.chart) {
            depthChartInstance.chart.applyOptions({
                width: elements.depthChart.clientWidth,
                height: elements.depthChart.clientHeight
            });
        }
    }, 500);
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
    
    // Focus on username input
    setTimeout(() => {
        if (elements.usernameInput) {
            elements.usernameInput.focus();
        }
    }, 500);
}

// Add simplified login handling
function handleLogin(username, password) {
    showLoading(true);
    
    // Demo version can use simplified auth
    if (username === 'demo' && password === 'demo') {
        // Use paper trading mode
        initializePaperTrading(username);
        elements.loginModal.hide();
        showLoading(false);
        return;
    }
    
    // For real accounts, attempt to get API key from server
    fetch('https://api.yourtrading.com/auth', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username,
            password
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data && data.success) {
            connectToApi(data.apiKey, data.apiSecret, true);
        } else {
            showAlert('Invalid username or password', 'danger');
        }
    })
    .catch(error => {
        console.error('Login error:', error);
        showAlert('Failed to connect to authentication server', 'danger');
    })
    .finally(() => {
        showLoading(false);
    });
}

// Initialize paper trading mode
function initializePaperTrading(username) {
    // Set paper trading mode
    isPaperTrading = true;
    
    // Update UI for paper trading
    if (elements.tradingModeIndicator) {
        elements.tradingModeIndicator.textContent = '📝 PAPER TRADING';
        elements.tradingModeIndicator.className = 'status-indicator paper';
    }
    document.body.classList.add('paper-trading-mode');
    
    // Update switch button text
    if (elements.switchTradingModeBtn) {
        elements.switchTradingModeBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Switch to Live Trading';
    }
    
    // Set demo balance
    if (elements.accountBalance) {
        elements.accountBalance.value = '10000.00';
    }
    if (elements.currentBalance) {
        elements.currentBalance.textContent = '$10,000.00';
    }
    
    // Initialize the app in paper trading mode
    logMessage(`Logged in as ${username} (Paper Trading Mode)`, 'success');
    showAlert('Paper Trading Mode active. No real funds will be used.', 'info');
    
    // Initialize charts and other components
    fetchInitialData();
    updateApiStatus(true, true);
}

// Toggle between paper and live trading
function toggleTradingMode() {
    if (isTrading) {
        showAlert('Please stop trading before switching modes', 'warning');
        return;
    }
    
    // If currently in paper mode, prompt for login
    if (isPaperTrading) {
        if (confirm('Switch to LIVE trading mode? This will use real funds.')) {
            isPaperTrading = false;
            
            // Update UI for live trading
            if (elements.tradingModeIndicator) {
                elements.tradingModeIndicator.textContent = '🔴 LIVE TRADING';
                elements.tradingModeIndicator.className = 'status-indicator live';
            }
            
            document.body.classList.remove('paper-trading-mode');
            
            // Update switch button text
            if (elements.switchTradingModeBtn) {
                elements.switchTradingModeBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Switch to Paper Trading';
            }
            
            logout();
            showLoginModal();
        }
    } else {
        // If in live mode, confirm switch to paper
        if (confirm('Switch to PAPER trading mode? Your current session will be ended.')) {
            logout();
            initializePaperTrading('paper');
        }
    }
}

// Update API status display with trading mode indicator
function updateApiStatus(connected, isPaperMode = false) {
    if (!elements.apiStatusBadge || !elements.apiKeyMasked) return;
    
    if (connected) {
        elements.apiStatusBadge.textContent = isPaperMode ? 'Paper Mode' : 'Connected';
        elements.apiStatusBadge.className = `badge ${isPaperMode ? 'bg-info' : 'bg-success'} me-2`;
        elements.apiKeyMasked.textContent = isPaperMode ? 
            'Paper Trading - No API Key Used' : 
            `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
    } else {
        elements.apiStatusBadge.textContent = 'Disconnected';
        elements.apiStatusBadge.className = 'badge bg-danger me-2';
        elements.apiKeyMasked.textContent = '••••••••••••••••';
    }
}

// Connect to the API with the provided keys
function connectToApi(key, secret, remember) {
    showLoading(true);
    
    // Validate API keys
    validateApiKeys(key, secret)
        .then(valid => {
            if (valid) {
                // Store API keys
                apiKey = key;
                apiSecret = secret;
                
                if (remember && key && secret) {
                    const encrypted = btoa(JSON.stringify({
                        key,
                        secret
                    }));
                    localStorage.setItem(API_KEY_STORAGE, encrypted);
                }
                
                // Update UI
                elements.loginModal.hide();
                updateApiStatus(true, isPaperTrading);
                
                // Fetch initial data
                fetchAccountBalance();
                fetchInitialData();
                
                // Start API ping check
                startPingCheck();
                
                logMessage('Connected to Binance API', 'success');
                showAlert('API connection successful', 'success');
            } else {
                showAlert('Invalid API keys', 'danger');
            }
        })
        .catch(error => {
            console.error('API validation error:', error);
            showAlert('Failed to validate API keys', 'danger');
        })
        .finally(() => {
            showLoading(false);
        });
}

// Validate API keys by making a test request
async function validateApiKeys(key, secret) {
    if (!key || !secret) return false;
    
    // For paper trading mode, always return valid
    if (isPaperTrading) return true;
    
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
        
        return response.ok;
    } catch (error) {
        console.error('API validation error:', error);
        return false;
    }
}

// Create HMAC SHA256 signature for Binance API
function createSignature(queryString, secret) {
    // Use CryptoJS for HMAC SHA256
    return CryptoJS.HmacSHA256(queryString, secret).toString();
}

// Start periodic API ping check
function startPingCheck() {
    if (pingInterval) clearInterval(pingInterval);
    
    pingInterval = setInterval(async () => {
        if (!apiKey || !apiSecret) return;
        
        const start = performance.now();
        
        try {
            const response = await fetch(`${API_URL}/api/v3/ping`);
            if (response.ok) {
                const end = performance.now();
                apiPingLatency = Math.round(end - start);
                
                if (elements.statPing) {
                    elements.statPing.textContent = `${apiPingLatency}ms`;
                }
            }
        } catch (error) {
            console.error('API ping error:', error);
        }
    }, 10000); // Check every 10 seconds
}

// Fetch account balance from Binance
async function fetchAccountBalance() {
    if (isPaperTrading) {
        // For paper trading, we use the stored balance
        const balance = parseFloat(elements.accountBalance.value);
        if (elements.currentBalance) {
            elements.currentBalance.textContent = `$${formatNumber(balance)}`;
        }
        
        // Update additional balance displays for paper trading
        if (elements.btcBalanceValue) elements.btcBalanceValue.textContent = '0.00000000';
        if (elements.ethBalanceValue) elements.ethBalanceValue.textContent = '0.00000000';
        if (elements.usdtBalanceValue) elements.usdtBalanceValue.textContent = `$${formatNumber(balance)}`;
        if (elements.totalValueValue) elements.totalValueValue.textContent = `$${formatNumber(balance)}`;
        
        return;
    }
    
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
        
        // Find USDT and other stablecoin balances
        const stablecoins = ['USDT', 'BUSD', 'USDC', 'DAI'];
        let totalBalance = 0;
        let usdtBalance = 0;
        
        stablecoins.forEach(coin => {
            const coinBalance = data.balances.find(b => b.asset === coin);
            if (coinBalance) {
                const amount = parseFloat(coinBalance.free) + parseFloat(coinBalance.locked);
                totalBalance += amount;
                if (coin === 'USDT') usdtBalance = amount;
            }
        });
        
        // Also fetch BTC and ETH balances and their prices
        let btcBalance = 0;
        let ethBalance = 0;
        
        const btcData = data.balances.find(b => b.asset === 'BTC');
        const ethData = data.balances.find(b => b.asset === 'ETH');
        
        if (btcData) {
            btcBalance = parseFloat(btcData.free) + parseFloat(btcData.locked);
        }
        
        if (ethData) {
            ethBalance = parseFloat(ethData.free) + parseFloat(ethData.locked);
        }
        
        // Fetch current prices for BTC and ETH
        if (btcBalance > 0 || ethBalance > 0) {
            try {
                const pricesResponse = await fetch(`${API_URL}/api/v3/ticker/price?symbols=["BTCUSDT","ETHUSDT"]`);
                if (pricesResponse.ok) {
                    const pricesData = await pricesResponse.json();
                    
                    const btcPrice = pricesData.find(p => p.symbol === 'BTCUSDT')?.price || 0;
                    const ethPrice = pricesData.find(p => p.symbol === 'ETHUSDT')?.price || 0;
                    
                    totalBalance += btcBalance * parseFloat(btcPrice);
                    totalBalance += ethBalance * parseFloat(ethPrice);
                }
            } catch (priceError) {
                console.error('Error fetching prices:', priceError);
            }
        }
        
        // Update balance displays
        const formattedBalance = totalBalance.toFixed(2);
        if (elements.accountBalance) {
            elements.accountBalance.value = formattedBalance;
        }
        if (elements.currentBalance) {
            elements.currentBalance.textContent = `$${formatNumber(formattedBalance)}`;
        }
        
        // Update additional balance display
        if (elements.btcBalanceValue) elements.btcBalanceValue.textContent = btcBalance.toFixed(8);
        if (elements.ethBalanceValue) elements.ethBalanceValue.textContent = ethBalance.toFixed(8);
        if (elements.usdtBalanceValue) elements.usdtBalanceValue.textContent = `$${formatNumber(usdtBalance)}`;
        if (elements.totalValueValue) elements.totalValueValue.textContent = `$${formatNumber(totalBalance)}`;
        
        logMessage(`Account balance updated: $${formattedBalance}`, 'info');
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
        let url = `${API_URL}/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=100`;
        
        const response = await fetch(url);
        
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
        if (candleData.length > 0) {
            currentPrice = candleData[candleData.length - 1].close;
        }
        
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
        
        if (elements.marketPrice) elements.marketPrice.textContent = `$${price}`;
        if (elements.marketChange) {
            elements.marketChange.textContent = `${change}%`;
            elements.marketChange.className = 'market-value ' + (change >= 0 ? 'up' : 'down');
        }
        if (elements.marketVolume) elements.marketVolume.textContent = `$${volume}`;
        
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
    initializePriceChart(candleData);
    initializeEquityChart(equityHistory);
    initializeDepthChart();
}

// Initialize price chart
function initializePriceChart(data) {
    if (chartInstance) {
        chartInstance.remove();
    }
    
    if (!elements.priceChart) return;
    
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

    if (data && data.length > 0) {
        candleSeries.setData(data);
        
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
        const volumeData = data.map(candle => ({
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
    }
    
    // Handle window resize
    const resizeObserver = new ResizeObserver(() => {
        chart.applyOptions({
            width: elements.priceChart.clientWidth,
            height: elements.priceChart.clientHeight
        });
    });
    
    resizeObserver.observe(elements.priceChart);
    
    chartInstance = {
        chart,
        candleSeries,
        remove: () => {
            chart.remove();
            resizeObserver.disconnect();
        }
    };
}

// Initialize equity chart
function initializeEquityChart(data) {
    if (equityChartInstance) {
        equityChartInstance.remove();
    }
    
    if (!elements.equityChart) return;
    
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
    
    // Initialize with starting balance if equity history is empty
    if (data.length === 0 && elements.accountBalance && elements.accountBalance.value) {
        const startingBalance = parseFloat(elements.accountBalance.value);
        if (startingBalance > 0) {
            equityHistory.push({
                time: Math.floor(Date.now() / 1000),
                value: startingBalance
            });
            data = equityHistory;
        }
    }
    
    if (data && data.length > 0) {
        lineSeries.setData(data);
    }
    
    // Handle window resize
    const resizeObserver = new ResizeObserver(() => {
        chart.applyOptions({
            width: elements.equityChart.clientWidth,
            height: elements.equityChart.clientHeight
        });
    });
    
    resizeObserver.observe(elements.equityChart);
    
    equityChartInstance = {
        chart,
        lineSeries,
        remove: () => {
            chart.remove();
            resizeObserver.disconnect();
        }
    };
}

// Initialize depth chart
function initializeDepthChart() {
    if (depthChartInstance) {
        depthChartInstance.remove();
    }
    
    if (!elements.depthChart) return;
    
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

// Improved depth chart update function with error handling
function updateDepthChart() {
    if (!depthChartInstance) return;
    
    try {
        const { bidSeries, askSeries } = depthChartInstance;
        
        // If orderbook is empty, don't try to update
        if (!orderBook.bids.length && !orderBook.asks.length) return;
        
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
        
        // Set data to series with error handling
        if (bidData.length > 0) {
            bidSeries.setData(bidData);
        }
        
        if (askData.length > 0) {
            askSeries.setData(askData);
        }
    } catch (error) {
        console.error('Error updating depth chart:', error);
        logMessage('Failed to update order book visualization', 'error');
    }
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
    updateBotStatus(true);
    
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

// Improved WebSocket connection with reconnection
function connectToWebSocket(symbol) {
    // Close existing socket if any
    if (websocket) {
        websocket.close();
    }
    
    const streamName = `${symbol}@kline_1m`;
    websocket = new WebSocket(`wss://stream.binance.com:9443/ws/${streamName}`);
    
    // Track reconnection attempts
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimeout = null;
    
    websocket.onopen = () => {
        console.log('WebSocket connected');
        logMessage('Connected to Binance WebSocket', 'info');
        reconnectAttempts = 0; // Reset reconnect counter on successful connection
    };
    
    websocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.e === 'kline') {
                const candle = data.k;
                
                // Update current price
                currentPrice = parseFloat(candle.c);
                if (elements.marketPrice) {
                    elements.marketPrice.textContent = `$${formatNumber(currentPrice)}`;
                }
                
                // Update last tick info
                if (elements.lastTickInfo) {
                    elements.lastTickInfo.textContent = `Last update: ${formatTime(new Date())}`;
                }
                
                // Update position if exists
                if (currentPosition) {
                    updatePositionCard();
                }
                
                // Execute trading strategy
                if (isTrading) {
                    executeStrategy();
                }
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
            logMessage('Error processing market data', 'error');
        }
    };
    
    websocket.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        
        // Only attempt to reconnect if we're still in trading mode
        if (isTrading && reconnectAttempts < maxReconnectAttempts) {
            logMessage(`WebSocket disconnected. Attempting to reconnect (${reconnectAttempts + 1}/${maxReconnectAttempts})...`, 'warning');
            
            // Exponential backoff for reconnect attempts
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            reconnectAttempts++;
            
            reconnectTimeout = setTimeout(() => {
                connectToWebSocket(symbol);
            }, delay);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
            logMessage('Failed to reconnect to WebSocket after maximum attempts. Trading stopped.', 'error');
            stopTrading();
        }
    };
    
    websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        logMessage('WebSocket connection error', 'error');
    };
    
    // Add cleanup function to clear any pending reconnect attempts
    return function cleanup() {
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
        }
        if (websocket) {
            websocket.close();
        }
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
    if (elements.statExecution) {
        elements.statExecution.textContent = `${executionTime}ms`;
    }
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
    
    const takeProfitValue = document.getElementById('take-profit-value');
    const stopLossValue = document.getElementById('stop-loss-value');
    
    if (!takeProfitValue || !stopLossValue) {
        showAlert('Missing take profit or stop loss settings', 'warning');
        return;
    }
    
    const takeProfitPercent = parseFloat(takeProfitValue.value) / 100;
    const stopLossPercent = parseFloat(stopLossValue.value) / 100;
    
    const quantity = (positionSize / currentPrice).toFixed(6);
    const takeProfitPrice = (currentPrice * (1 + takeProfitPercent)).toFixed(2);
    const stopLossPrice = (currentPrice * (1 - stopLossPercent)).toFixed(2);
    
    showLoading(true);
    
    try {
        if (isPaperTrading) {
            // Paper trading mode - simulate order execution
            currentPosition = {
                type: 'long',
                entryPrice: currentPrice,
                entryTime: Date.now(),
                quantity: parseFloat(quantity),
                takeProfitPrice: parseFloat(takeProfitPrice),
                stopLossPrice: parseFloat(stopLossPrice),
                orderId: Math.floor(Math.random() * 1000000)
            };
            
            updatePositionCard();
            logMessage(`Opened LONG position: ${quantity} ${symbol} at $${currentPosition.entryPrice} (PAPER)`, 'success');
            showAlert(`Paper long position opened at $${currentPosition.entryPrice}`, 'success');
            
            showLoading(false);
            return;
        }
        
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
        const takeProfitToggle = document.getElementById('take-profit-toggle');
        const stopLossToggle = document.getElementById('stop-loss-toggle');
        
        if (takeProfitToggle && takeProfitToggle.checked) {
            createTakeProfitOrder(symbol, quantity, takeProfitPrice);
        }
        
        if (stopLossToggle && stopLossToggle.checked) {
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
    
    const takeProfitValue = document.getElementById('take-profit-value');
    const stopLossValue = document.getElementById('stop-loss-value');
    
    if (!takeProfitValue || !stopLossValue) {
        showAlert('Missing take profit or stop loss settings', 'warning');
        return;
    }
    
    const takeProfitPercent = parseFloat(takeProfitValue.value) / 100;
    const stopLossPercent = parseFloat(stopLossValue.value) / 100;
    
    const quantity = (positionSize / currentPrice).toFixed(6);
    const takeProfitPrice = (currentPrice * (1 - takeProfitPercent)).toFixed(2);
    const stopLossPrice = (currentPrice * (1 + stopLossPercent)).toFixed(2);
    
    showLoading(true);
    
    try {
        if (isPaperTrading) {
            // Paper trading mode - simulate order execution
            currentPosition = {
                type: 'short',
                entryPrice: currentPrice,
                entryTime: Date.now(),
                quantity: parseFloat(quantity),
                takeProfitPrice: parseFloat(takeProfitPrice),
                stopLossPrice: parseFloat(stopLossPrice),
                orderId: Math.floor(Math.random() * 1000000)
            };
            
            updatePositionCard();
            logMessage(`Opened SHORT position: ${quantity} ${symbol} at $${currentPosition.entryPrice} (PAPER)`, 'success');
            showAlert(`Paper short position opened at $${currentPosition.entryPrice}`, 'success');
            
            showLoading(false);
            return;
        }
        
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
        const takeProfitToggle = document.getElementById('take-profit-toggle');
        const stopLossToggle = document.getElementById('stop-loss-toggle');
        
        if (takeProfitToggle && takeProfitToggle.checked) {
            createTakeProfitOrder(symbol, quantity, takeProfitPrice, 'short');
        }
        
        if (stopLossToggle && stopLossToggle.checked) {
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
        if (isPaperTrading) {
            // Paper trading - simulate TP order
            currentPosition.takeProfitOrderId = Math.floor(Math.random() * 1000000);
            logMessage(`Take profit order set at $${price} (PAPER)`, 'info');
            return;
        }
        
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
        if (isPaperTrading) {
            // Paper trading - simulate SL order
            currentPosition.stopLossOrderId = Math.floor(Math.random() * 1000000);
            logMessage(`Stop loss order set at $${price} (PAPER)`, 'info');
            return;
        }
        
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
        if (isPaperTrading) {
            // Paper trading - simulate position closing
            const exitPrice = currentPrice;
            
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
            
            // Update paper balance
            const currentBalance = parseFloat(elements.accountBalance.value);
            const newBalance = currentBalance + pnl;
            elements.accountBalance.value = newBalance.toFixed(2);
            
            if (elements.currentBalance) {
                elements.currentBalance.textContent = `$${formatNumber(newBalance)}`;
            }
            
            // Update equity history
            updateEquityHistory();
            
            logMessage(`Closed ${currentPosition.type.toUpperCase()} position: ${quantity} ${symbol} at $${exitPrice} (P&L: $${pnl.toFixed(2)}) (PAPER)`, 
                pnl >= 0 ? 'success' : 'warning');
            
            showAlert(`Paper position closed with ${pnl >= 0 ? 'profit' : 'loss'}: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`, 
                pnl >= 0 ? 'success' : 'warning');
            
            // Clear current position
            currentPosition = null;
            elements.positionCard.style.display = 'none';
            
            showLoading(false);
            return;
        }
        
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
    if (isPaperTrading) return { success: true }; // Mock success for paper trading
    
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
    
    const stopLossValue = document.getElementById('stop-loss-value');
    const takeProfitValue = document.getElementById('take-profit-value');
    
    if (!stopLossValue || !takeProfitValue) return;
    
    const stopLossPercent = parseFloat(stopLossValue.value) / 100;
    const takeProfitPercent = parseFloat(takeProfitValue.value) / 100;
    
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
    if (!currentPosition || !currentPrice || !elements.positionCard) return;
    
    elements.positionCard.style.display = 'block';
    
    if (elements.positionType) {
        elements.positionType.textContent = currentPosition.type.toUpperCase();
        elements.positionType.className = 'metric-value ' + (currentPosition.type === 'long' ? 'positive' : 'negative');
    }
    
    if (elements.positionEntryPrice) {
        elements.positionEntryPrice.textContent = `$${formatNumber(currentPosition.entryPrice)}`;
    }
    
    if (elements.positionCurrentPrice) {
        elements.positionCurrentPrice.textContent = `$${formatNumber(currentPrice)}`;
    }
    
    // Calculate unrealized P&L
    const unrealizedPnl = currentPosition.type === 'long'
        ? (currentPrice - currentPosition.entryPrice) * currentPosition.quantity
        : (currentPosition.entryPrice - currentPrice) * currentPosition.quantity;
    
    const pnlPercent = (unrealizedPnl / (currentPosition.entryPrice * currentPosition.quantity)) * 100;
    
    if (elements.positionPnl) {
        elements.positionPnl.textContent = `$${formatNumber(unrealizedPnl)} (${pnlPercent.toFixed(2)}%)`;
        elements.positionPnl.className = 'metric-value ' + (unrealizedPnl >= 0 ? 'positive' : 'negative');
    }
    
    if (elements.positionEntryTime) {
        elements.positionEntryTime.textContent = formatDateTime(new Date(currentPosition.entryTime));
    }
    
    if (elements.positionSizeInfo) {
        elements.positionSizeInfo.textContent = currentPosition.quantity;
    }
    
    if (elements.positionTp) {
        elements.positionTp.textContent = `$${formatNumber(currentPosition.takeProfitPrice)}`;
    }
    
    if (elements.positionSl) {
        elements.positionSl.textContent = `$${formatNumber(currentPosition.stopLossPrice)}`;
    }
}

// Update trade history table
function updateTradeHistory() {
    if (!elements.tradeHistory) return;
    
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
    if (!elements.accountBalance) return;
    
    const balance = parseFloat(elements.accountBalance.value);
    
    equityHistory.push({
        time: Math.floor(Date.now() / 1000),
        value: balance
    });
    
    // Update equity chart
    if (equityChartInstance && equityChartInstance.lineSeries) {
        equityChartInstance.lineSeries.setData(equityHistory);
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
    if (elements.totalTrades) elements.totalTrades.textContent = totalTrades;
    
    if (elements.winRate) {
        elements.winRate.textContent = `${winRate.toFixed(1)}%`;
    }
    
    if (elements.winRateDelta) {
        elements.winRateDelta.textContent = `${winningTrades}W / ${losingTrades}L`;
    }
    
    if (elements.profitFactor) {
        elements.profitFactor.textContent = profitFactor.toFixed(2);
    }
    
    if (elements.profitFactorDelta) {
        elements.profitFactorDelta.textContent = `Avg: $${(grossProfit / (winningTrades || 1)).toFixed(2)}`;
    }
    
    if (elements.maxWin) elements.maxWin.textContent = `$${formatNumber(maxWin)}`;
    if (elements.maxLoss) elements.maxLoss.textContent = `$${formatNumber(maxLoss)}`;
    
    if (elements.maxDrawdown) {
        elements.maxDrawdown.textContent = `${maxDrawdown.toFixed(2)}%`;
    }
    
    // Update daily stats
    if (elements.statDailyTrades) elements.statDailyTrades.textContent = todayTrades.length;
    
    if (elements.statDailyPnl) {
        elements.statDailyPnl.textContent = `$${formatNumber(dailyPnl)}`;
        elements.statDailyPnl.className = 'stat-value ' + (dailyPnl >= 0 ? 'positive' : 'negative');
    }
    
    // Calculate total return
    const initialBalance = equityHistory[0]?.value || 10000;
    const currentBalance = parseFloat(elements.accountBalance.value);
    const totalReturn = ((currentBalance - initialBalance) / initialBalance) * 100;
    
    if (elements.totalReturn) {
        elements.totalReturn.textContent = `${totalReturn.toFixed(2)}%`;
        elements.totalReturn.className = 'metric-value ' + (totalReturn >= 0 ? 'positive' : 'negative');
    }
    
    if (elements.totalReturnDelta) {
        elements.totalReturnDelta.textContent = `$${formatNumber(currentBalance - initialBalance)}`;
        elements.totalReturnDelta.className = 'metric-delta ' + (totalReturn >= 0 ? 'positive' : 'negative');
    }
}

// Stop trading
function stopTrading() {
    if (!isTrading) return;
    
    // Disconnect WebSocket with proper cleanup
    if (websocket) {
        // We need to set a flag to prevent reconnection attempts
        isTrading = false;
        websocket.close();
        websocket = null;
    }
    
    // Update UI
    updateBotStatus(false);
    
    // Enable/disable buttons
    if (elements.startTradingBtn) elements.startTradingBtn.disabled = false;
    if (elements.stopTradingBtn) elements.stopTradingBtn.disabled = true;
    if (elements.emergencySellBtn) elements.emergencySellBtn.disabled = true;
    if (elements.symbolSelect) elements.symbolSelect.disabled = false;
    if (elements.timeframeSelect) elements.timeframeSelect.disabled = false;
    
    // Enable strategy parameters
    if (elements.atrLength) elements.atrLength.disabled = false;
    if (elements.atrMult) elements.atrMult.disabled = false;
    
    logMessage('Trading stopped', 'warning');
    showAlert('Trading has been stopped', 'warning');
}

// Logout from the application
function logout() {
    // Disconnect WebSocket
    if (websocket) {
        websocket.close();
    }
    
    // Stop ping interval
    if (pingInterval) {
        clearInterval(pingInterval);
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
        theme: document.getElementById('theme-select')?.value || 'dark',
        symbol: elements.symbolSelect?.value || 'BTCUSDT',
        timeframe: elements.timeframeSelect?.value || '1h',
        atrLength: elements.atrLength?.value || 5,
        atrMult: elements.atrMult?.value || 0.75,
        positionSize: elements.positionSize?.value || 5,
        takeProfit: document.getElementById('take-profit-value')?.value || 3.0,
        stopLoss: document.getElementById('stop-loss-value')?.value || 2.0,
        trailingStop: document.getElementById('trailing-stop-value')?.value || 1.5,
        maxDrawdown: document.getElementById('max-drawdown-value')?.value || 10,
        maxDailyLoss: document.getElementById('max-daily-loss-value')?.value || 5,
        chartUpdateFrequency: document.getElementById('chart-update-frequency')?.value || 5,
        toggles: {
            autoTrade: document.getElementById('auto-trade-toggle')?.checked || false,
            trailingStop: document.getElementById('trailing-stop-toggle')?.checked || false,
            takeProfit: document.getElementById('take-profit-toggle')?.checked || true,
            stopLoss: document.getElementById('stop-loss-toggle')?.checked || true,
            riskManagement: document.getElementById('risk-management-toggle')?.checked || true,
            discordAlert: document.getElementById('discord-alert-toggle')?.checked || false,
            telegramAlert: document.getElementById('telegram-alert-toggle')?.checked || false,
            emailAlert: document.getElementById('email-alert-toggle')?.checked || false,
            browserAlert: document.getElementById('browser-alert-toggle')?.checked || true,
            soundAlert: document.getElementById('sound-alert-toggle')?.checked || true
        },
        alerts: {
            discordWebhook: document.getElementById('discord-webhook-input')?.value || '',
            telegramToken: document.getElementById('telegram-token-input')?.value || '',
            telegramChatId: document.getElementById('telegram-chatid-input')?.value || '',
            emailAddress: document.getElementById('email-address-input')?.value || '',
            soundVolume: document.getElementById('sound-volume-input')?.value || 0.5
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
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = settings.theme || 'dark';
        }
        document.body.className = `${settings.theme || 'dark'}-theme`;
        
        // Apply data settings
        if (elements.symbolSelect) {
            elements.symbolSelect.value = settings.symbol || 'BTCUSDT';
        }
        
        if (elements.timeframeSelect) {
            elements.timeframeSelect.value = settings.timeframe || '1h';
        }
        
        // Apply strategy parameters
        if (elements.atrLength) {
            elements.atrLength.value = settings.atrLength || 5;
        }
        
        if (elements.atrLengthValue) {
            elements.atrLengthValue.textContent = settings.atrLength || 5;
        }
        
        if (elements.atrMult) {
            elements.atrMult.value = settings.atrMult || 0.75;
        }
        
        if (elements.atrMultValue) {
            elements.atrMultValue.textContent = settings.atrMult || 0.75;
        }
        
        // Apply trading settings
        if (elements.positionSize) {
            elements.positionSize.value = settings.positionSize || 5;
        }
        
        if (elements.positionSizeValue) {
            elements.positionSizeValue.textContent = `${settings.positionSize || 5}%`;
        }
        
        const takeProfitValue = document.getElementById('take-profit-value');
        if (takeProfitValue) {
            takeProfitValue.value = settings.takeProfit || 3.0;
        }
        
        const stopLossValue = document.getElementById('stop-loss-value');
        if (stopLossValue) {
            stopLossValue.value = settings.stopLoss || 2.0;
        }
        
        const trailingStopValue = document.getElementById('trailing-stop-value');
        if (trailingStopValue) {
            trailingStopValue.value = settings.trailingStop || 1.5;
        }
        
        const maxDrawdownValue = document.getElementById('max-drawdown-value');
        if (maxDrawdownValue) {
            maxDrawdownValue.value = settings.maxDrawdown || 10;
        }
        
        const maxDailyLossValue = document.getElementById('max-daily-loss-value');
        if (maxDailyLossValue) {
            maxDailyLossValue.value = settings.maxDailyLoss || 5;
        }
        
        const chartUpdateFrequency = document.getElementById('chart-update-frequency');
        if (chartUpdateFrequency) {
            chartUpdateFrequency.value = settings.chartUpdateFrequency || 5;
        }
        
        // Apply toggles
        if (settings.toggles) {
            const autoTradeToggle = document.getElementById('auto-trade-toggle');
            if (autoTradeToggle) {
                autoTradeToggle.checked = settings.toggles.autoTrade;
            }
            
            const trailingStopToggle = document.getElementById('trailing-stop-toggle');
            if (trailingStopToggle) {
                trailingStopToggle.checked = settings.toggles.trailingStop;
            }
            
            const takeProfitToggle = document.getElementById('take-profit-toggle');
            if (takeProfitToggle) {
                takeProfitToggle.checked = settings.toggles.takeProfit;
            }
            
            const stopLossToggle = document.getElementById('stop-loss-toggle');
            if (stopLossToggle) {
                stopLossToggle.checked = settings.toggles.stopLoss;
            }
            
            const riskManagementToggle = document.getElementById('risk-management-toggle');
            if (riskManagementToggle) {
                riskManagementToggle.checked = settings.toggles.riskManagement;
            }
            
            const discordAlertToggle = document.getElementById('discord-alert-toggle');
            if (discordAlertToggle) {
                discordAlertToggle.checked = settings.toggles.discordAlert;
            }
            
            const telegramAlertToggle = document.getElementById('telegram-alert-toggle');
            if (telegramAlertToggle) {
                telegramAlertToggle.checked = settings.toggles.telegramAlert;
            }
            
            const emailAlertToggle = document.getElementById('email-alert-toggle');
            if (emailAlertToggle) {
                emailAlertToggle.checked = settings.toggles.emailAlert;
            }
            
            const browserAlertToggle = document.getElementById('browser-alert-toggle');
            if (browserAlertToggle) {
                browserAlertToggle.checked = settings.toggles.browserAlert;
            }
            
            const soundAlertToggle = document.getElementById('sound-alert-toggle');
            if (soundAlertToggle) {
                soundAlertToggle.checked = settings.toggles.soundAlert;
            }
        }
        
        // Apply alert settings
        if (settings.alerts) {
            const discordWebhookInput = document.getElementById('discord-webhook-input');
            if (discordWebhookInput) {
                discordWebhookInput.value = settings.alerts.discordWebhook || '';
            }
            
            const telegramTokenInput = document.getElementById('telegram-token-input');
            if (telegramTokenInput) {
                telegramTokenInput.value = settings.alerts.telegramToken || '';
            }
            
            const telegramChatIdInput = document.getElementById('telegram-chatid-input');
            if (telegramChatIdInput) {
                telegramChatIdInput.value = settings.alerts.telegramChatId || '';
            }
            
            const emailAddressInput = document.getElementById('email-address-input');
            if (emailAddressInput) {
                emailAddressInput.value = settings.alerts.emailAddress || '';
            }
            
            const soundVolumeInput = document.getElementById('sound-volume-input');
            if (soundVolumeInput) {
                soundVolumeInput.value = settings.alerts.soundVolume || 0.5;
            }
        }
        
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Update the clock display with real-time
function updateClock() {
    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').split('.')[0] + ' UTC';
    if (elements.clockDisplay) {
        elements.clockDisplay.textContent = formattedDate;
    }
}

// Check if the device is mobile
function checkMobileDevice() {
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        const mobileInfo = document.getElementById('mobile-info');
        if (mobileInfo) {
            mobileInfo.style.display = 'block';
        }
    }
}

// Show or hide loading indicator
function showLoading(show) {
    if (elements.loadingIndicator) {
        elements.loadingIndicator.style.display = show ? 'flex' : 'none';
    }
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
    
    const container = document.querySelector('.container-fluid');
    if (container) {
        container.insertBefore(alertDiv, document.querySelector('.row'));
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            alertDiv.classList.remove('show');
            setTimeout(() => alertDiv.remove(), 300);
        }, 5000);
    }
}

// Add log message
function logMessage(message, type = 'info') {
    if (!elements.logMessages) return;
    
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

// Add this throttling function for chart updates
function throttle(func, delay) {
    let lastCall = 0;
    return function(...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            return func.apply(this, args);
        }
    };
}

// Create a throttled resize handler to prevent excessive updates
const throttledResizeHandler = throttle(() => {
    if (chartInstance && chartInstance.chart) {
        chartInstance.chart.applyOptions({
            width: elements.priceChart.clientWidth,
            height: elements.priceChart.clientHeight
        });
    }
    
    if (equityChartInstance && equityChartInstance.chart) {
        equityChartInstance.chart.applyOptions({
            width: elements.equityChart.clientWidth,
            height: elements.equityChart.clientHeight
        });
    }
    
    if (depthChartInstance && depthChartInstance.chart) {
        depthChartInstance.chart.applyOptions({
            width: elements.depthChart.clientWidth,
            height: elements.depthChart.clientHeight
        });
    }
}, 100); // 100ms throttle

// Replace the resize event listener
window.removeEventListener('resize', window.resizeHandler); // Remove if exists
window.resizeHandler = throttledResizeHandler;
window.addEventListener('resize', window.resizeHandler);

// Add a periodic check to ensure charts are properly sized
function ensureChartsRendered() {
    if (chartInstance && chartInstance.chart) {
        chartInstance.chart.applyOptions({
            width: elements.priceChart.clientWidth,
            height: elements.priceChart.clientHeight
        });
        chartInstance.chart.timeScale().fitContent();
    }
    
    if (equityChartInstance && equityChartInstance.chart) {
        equityChartInstance.chart.applyOptions({
            width: elements.equityChart.clientWidth,
            height: elements.equityChart.clientHeight
        });
        equityChartInstance.chart.timeScale().fitContent();
    }
    
    if (depthChartInstance && depthChartInstance.chart) {
        depthChartInstance.chart.applyOptions({
            width: elements.depthChart.clientWidth,
            height: elements.depthChart.clientHeight
        });
    }
}

// Call this periodically to ensure charts are rendered correctly
setInterval(ensureChartsRendered, 60000); // Check every minute