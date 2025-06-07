// Define constants for localStorage keys and API settings
const API_KEY_STORAGE = 'trading_bot_api_key';
const API_SECRET_STORAGE = 'trading_bot_api_secret';
const SETTINGS_STORAGE = 'trading_bot_settings';
const API_URL = 'https://api.binance.com'; // Binance API base URL

console.log('Constants initialized:', { API_KEY_STORAGE, API_SECRET_STORAGE, SETTINGS_STORAGE, API_URL });
const SESSION_STORAGE_PREFIX = 'trading_session_';
const VERSION = '1.2.0'; // Version tracking for compatibility

// State variables
let apiKey = '';
let apiSecret = '';
let isPaperTrading = true; // Default to paper trading for safety
let chartInstance = null;
let equityChartInstance = null;
let depthChartInstance = null;
let plotlyChart = null;
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
let logScaleEnabled = true; // Default to logarithmic scale for equity chart
let sessionSaveInterval = null;
let lastErrorTime = 0; // Prevent spamming alerts
let lastNotificationTime = 0;

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
    
    // Load saved sessions for display in login modal
    loadSavedSessions();
    
    // Register service worker for better offline support if supported
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => {
            console.log('Service Worker registration failed:', err);
        });
    }
    
    // Add debugging
    setTimeout(debugInitialization, 1000);
});

// Debug initialization
function debugInitialization() {
    console.log('=== Debugging Initialization ===');
    console.log('DOM Ready:', document.readyState);
    console.log('Elements cached:', elements !== undefined);
    console.log('App Version:', VERSION);
    
    // Check if key elements exist
    const elementIds = [
        'tradingview_chart', 'start-trading-btn', 
        'symbol', 'timeframe', 'loadingIndicator'
    ];
    
    elementIds.forEach(id => {
        console.log(`Element #${id} exists:`, document.getElementById(id) !== null);
    });
    
    // Check event listener setup
    if (elements.startTradingBtn) {
        console.log('Start Trading button registered:', elements.startTradingBtn !== null);
    }
    
    console.log('isPaperTrading:', isPaperTrading);
    console.log('API Key exists:', apiKey !== undefined && apiKey.length > 0);
    console.log('=== End Debugging ===');
}

// Cache frequently used DOM elements
function cacheElements() {
    // Main elements
    elements.loginModal = document.getElementById('loginModal');
    if (elements.loginModal) {
        elements.loginModal = new bootstrap.Modal(elements.loginModal);
    }
    
    // Load session modal
    elements.loadSessionModal = document.getElementById('loadSessionModal');
    if (elements.loadSessionModal) {
        elements.loadSessionModal = new bootstrap.Modal(elements.loadSessionModal);
    }
    
    elements.apiKeyForm = document.getElementById('apiKeyForm');
    elements.apiKeyInput = document.getElementById('apiKey');
    elements.apiSecretInput = document.getElementById('apiSecret');
    elements.rememberKeysCheckbox = document.getElementById('rememberLogin');
    
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
    
    // Session management elements
    elements.saveSessionBtn = document.getElementById('save-session-btn');
    elements.loadSessionBtn = document.getElementById('load-session-btn');
    elements.sessionsList = document.getElementById('sessionsList');
    elements.sessionFilesList = document.getElementById('sessionFilesList');
    elements.savedSessions = document.getElementById('savedSessions');
    
    // Chart elements
    elements.priceChart = document.getElementById('priceChart');
    elements.equityChart = document.getElementById('equityChart');
    elements.depthChart = document.getElementById('depthChart');
    elements.tradingViewChart = document.getElementById('tradingview_chart');
    elements.logScaleToggle = document.getElementById('log-scale-toggle');
    
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
    
    // Discord notification elements
    elements.discordAlertToggle = document.getElementById('discord-alert-toggle');
    elements.discordWebhookInput = document.getElementById('discord-webhook-input');
    elements.discordTradeAlerts = document.getElementById('discord-trade-alerts');
    elements.discordPriceAlerts = document.getElementById('discord-price-alerts');
    elements.discordDailySummary = document.getElementById('discord-daily-summary');
    elements.discordErrorAlerts = document.getElementById('discord-error-alerts');
    
    // Log messages
    elements.logMessages = document.getElementById('logMessages');
    
    // Trade history
    const tradeHistoryTable = document.getElementById('tradeHistory');
    if (tradeHistoryTable) {
        elements.tradeHistory = tradeHistoryTable.querySelector('tbody');
    }
    
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
    
    // Test alert button
    elements.testAlertBtn = document.getElementById('test-alert-btn');
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
    
    // FIX: Make sure we properly attach the click handler for the start trading button
    if (elements.startTradingBtn) {
        elements.startTradingBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Start trading button clicked');
            startTrading();
        });
    }
    
    // Other trading control buttons
    if (elements.stopTradingBtn) {
        elements.stopTradingBtn.addEventListener('click', stopTrading);
    }
    
    if (elements.emergencySellBtn) {
        elements.emergencySellBtn.addEventListener('click', emergencySell);
    }
    
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', logout);
    }
    
    // Settings updates
    if (elements.symbolSelect) {
        elements.symbolSelect.addEventListener('change', () => {
            if (!isTrading) {
                fetchInitialData();
            } else {
                showAlert('Please stop trading before changing symbol', 'warning');
            }
        });
    }
    
    if (elements.timeframeSelect) {
        elements.timeframeSelect.addEventListener('change', () => {
            if (!isTrading) {
                fetchInitialData();
            } else {
                showAlert('Please stop trading before changing timeframe', 'warning');
            }
        });
    }
    
    // Range input updates
    if (elements.atrLength && elements.atrLengthValue) {
        elements.atrLength.addEventListener('input', () => {
            elements.atrLengthValue.textContent = elements.atrLength.value;
        });
    }
    
    if (elements.atrMult && elements.atrMultValue) {
        elements.atrMult.addEventListener('input', () => {
            elements.atrMultValue.textContent = elements.atrMult.value;
        });
    }
    
    if (elements.positionSize && elements.positionSizeValue) {
        elements.positionSize.addEventListener('input', () => {
            elements.positionSizeValue.textContent = `${elements.positionSize.value}%`;
        });
    }
    
    // Refresh balance button
    if (elements.refreshBalanceBtn) {
        elements.refreshBalanceBtn.addEventListener('click', fetchAccountBalance);
    }
    
    // API key management
    if (elements.updateApiKeysBtn) {
        elements.updateApiKeysBtn.addEventListener('click', () => {
            elements.loginModal.show();
        });
    }
    
    if (elements.removeApiKeysBtn) {
        elements.removeApiKeysBtn.addEventListener('click', () => {
            localStorage.removeItem(API_KEY_STORAGE);
            showAlert('API keys removed. Please log in again.', 'warning');
            setTimeout(() => {
                logout();
            }, 2000);
        });
    }
    
    // Save settings button
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }
    
    // Theme toggle
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            document.body.className = `${theme}-theme`;
            saveSettings();
            
            // Update chart theme
            if (plotlyChart) {
                updatePlotlyChartTheme();
            }
        });
    }
    
    // Add login button handler
    if (elements.loginButton) {
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
    }
    
    // Trading mode switch
    if (elements.tradingModeSwitch) {
        elements.tradingModeSwitch.addEventListener('change', (e) => {
            const isPaperMode = e.target.checked;
            if (document.getElementById('loginButtonText')) {
                document.getElementById('loginButtonText').textContent = isPaperMode ? 
                    'Start Paper Trading' : 'Login to Live Trading';
            }
            if (elements.liveModeWarning) {
                elements.liveModeWarning.style.display = isPaperMode ? 'none' : 'block';
            }
        });
    }
    
    // Switch between API key input and standard login
    if (elements.manualApiKeyButton) {
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
    
    // Session management
    if (elements.saveSessionBtn) {
        elements.saveSessionBtn.addEventListener('click', saveCurrentSession);
    }
    
    if (elements.loadSessionBtn) {
        elements.loadSessionBtn.addEventListener('click', () => {
            if (elements.loadSessionModal) {
                loadSavedSessionFiles();
                elements.loadSessionModal.show();
            }
        });
    }
    
    // Logarithmic scale toggle for equity chart
    if (elements.logScaleToggle) {
        elements.logScaleToggle.addEventListener('change', (e) => {
            logScaleEnabled = e.target.checked;
            if (equityChartInstance) {
                updateEquityChart(equityHistory);
            }
        });
    }
    
    // Test alert button
    if (elements.testAlertBtn) {
        elements.testAlertBtn.addEventListener('click', () => {
            // Test all enabled alert methods
            const testMessage = {
                title: "Test Alert",
                content: "This is a test alert from your trading bot.",
                type: "info"
            };
            
            // Send test alerts through all enabled channels
            sendAlerts(testMessage);
            showAlert('Test alerts sent to all enabled channels', 'info');
        });
    }
}

// Update bot status display
function updateBotStatus(isActive) {
    if (!elements.botStatus) return;
    
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

// Save the current trading session
function saveCurrentSession() {
    if (!tradeHistory || tradeHistory.length === 0 || !equityHistory || equityHistory.length === 0) {
        showAlert('No trading data to save.', 'warning');
        return;
    }

    const sessionData = {
        tradeHistory,
        equityHistory,
        currentPosition,
        candleData,
        settings: {
            symbol: elements.symbolSelect.value,
            timeframe: elements.timeframeSelect.value,
            atrLength: elements.atrLength.value,
            atrMult: elements.atrMult.value,
            positionSize: elements.positionSize.value,
            accountBalance: elements.accountBalance.value,
        },
        timestamp: new Date().toISOString(),
    };

    const sessionKey = `${SESSION_STORAGE_PREFIX}${Date.now()}`;
    localStorage.setItem(sessionKey, JSON.stringify(sessionData));
    showAlert('Trading session saved successfully.', 'success');
    loadSavedSessions();
}

// Log messages to the UI and console
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

    console.log(`[${type.toUpperCase()}] ${message}`);
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

// Show alert messages in the UI
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

// Format time for log messages
function formatTime(date) {
    return date.toTimeString().split(' ')[0];
}

// Show the login modal
function showLoginModal() {
    if (!elements.loginModal) return;

    elements.loginModal.show();

    // Focus on username input
    setTimeout(() => {
        if (elements.usernameInput) {
            elements.usernameInput.focus();
        }
    }, 500);
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

// Emergency sell - force close any open position
function emergencySell() {
    if (!currentPosition) {
        showAlert('No active position to close.', 'warning');
        return;
    }

    // Confirm before executing
    if (confirm('⚠️ EMERGENCY SELL: Are you sure you want to close your position immediately?')) {
        logMessage('EMERGENCY SELL triggered by user.', 'warning');
        closePosition();
        showAlert('Emergency sell executed. Position closed.', 'success');
    }
}

// Logout the user and reset the application state
function logout() {
    console.log('Logging out...');

    // Reset API keys
    apiKey = '';
    apiSecret = '';

    // Clear stored API keys
    localStorage.removeItem(API_KEY_STORAGE);

    // Stop trading if active
    if (isTrading) {
        stopTrading();
    }

    // Reset UI elements
    if (elements.accountBalance) {
        elements.accountBalance.value = '0.00';
    }
    if (elements.currentBalance) {
        elements.currentBalance.textContent = '$0.00';
    }
    if (elements.tradingModeIndicator) {
        elements.tradingModeIndicator.textContent = '🔴 LIVE TRADING - IDLE';
        elements.tradingModeIndicator.className = 'status-indicator idle';
    }
    if (elements.botStatus) {
        elements.botStatus.textContent = '🔴 LIVE TRADING - IDLE';
        elements.botStatus.className = 'status-indicator idle';
    }
    if (elements.activityStatus) {
        elements.activityStatus.textContent = 'Trading Inactive';
    }
    if (elements.lastTickInfo) {
        elements.lastTickInfo.textContent = 'Last check: Never';
    }
    if (elements.positionCard) {
        elements.positionCard.style.display = 'none';
    }

    // Reset state variables
    isPaperTrading = true;
    isTrading = false;
    currentPosition = null;
    tradeHistory = [];
    equityHistory = [];
    candleData = [];

    // Reset charts
    initializeEmptyCharts();

    // Show login modal
    showLoginModal();

    logMessage('User logged out successfully.', 'info');
    showAlert('You have been logged out.', 'success');
}

// Fetch account balance from Binance API or simulate for paper trading
async function fetchAccountBalance() {
    console.log('Fetching account balance...');

    if (isPaperTrading) {
        // Simulate account balance for paper trading
        const simulatedBalance = {
            USDT: 10000,
            BTC: 0.5,
            ETH: 10,
        };

        // Update UI with simulated balance
        if (elements.usdtBalanceValue) {
            elements.usdtBalanceValue.textContent = `$${formatNumber(simulatedBalance.USDT)}`;
        }
        if (elements.btcBalanceValue) {
            elements.btcBalanceValue.textContent = simulatedBalance.BTC.toFixed(8);
        }
        if (elements.ethBalanceValue) {
            elements.ethBalanceValue.textContent = simulatedBalance.ETH.toFixed(8);
        }
        if (elements.totalValueValue) {
            elements.totalValueValue.textContent = `$${formatNumber(simulatedBalance.USDT)}`;
        }

        logMessage('Simulated account balance fetched successfully.', 'info');
        return;
    }

    if (!apiKey || !apiSecret) {
        showAlert('API keys are required to fetch account balance.', 'danger');
        console.error('API keys are missing!');
        return;
    }

    try {
        // Prepare API call
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

        // Parse balances
        const balances = data.balances.reduce((acc, balance) => {
            acc[balance.asset] = parseFloat(balance.free);
            return acc;
        }, {});

        const usdtBalance = balances.USDT || 0;
        const btcBalance = balances.BTC || 0;
        const ethBalance = balances.ETH || 0;

        const totalValue = usdtBalance + (btcBalance * currentPrice) + (ethBalance * currentPrice);

        // Update UI
        if (elements.usdtBalanceValue) {
            elements.usdtBalanceValue.textContent = `$${formatNumber(usdtBalance)}`;
        }
        if (elements.btcBalanceValue) {
            elements.btcBalanceValue.textContent = btcBalance.toFixed(8);
        }
        if (elements.ethBalanceValue) {
            elements.ethBalanceValue.textContent = ethBalance.toFixed(8);
        }
        if (elements.totalValueValue) {
            elements.totalValueValue.textContent = `$${formatNumber(totalValue)}`;
        }

        logMessage('Account balance fetched successfully.', 'success');
    } catch (error) {
        console.error('Error fetching account balance:', error);
        showAlert('Failed to fetch account balance.', 'danger');
    }
}

// Create HMAC SHA256 signature for Binance API
function createSignature(queryString, secret) {
    return CryptoJS.HmacSHA256(queryString, secret).toString();
}

// Save bot settings to localStorage
function saveSettings() {
    console.log('Saving bot settings...');

    const settings = {
        symbol: elements.symbolSelect ? elements.symbolSelect.value : 'BTCUSDT',
        timeframe: elements.timeframeSelect ? elements.timeframeSelect.value : '1h',
        atrLength: elements.atrLength ? elements.atrLength.value : 5,
        atrMult: elements.atrMult ? elements.atrMult.value : 0.75,
        positionSize: elements.positionSize ? elements.positionSize.value : 5,
        theme: document.body.classList.contains('dark-theme') ? 'dark' : 'light',
        discordWebhook: elements.discordWebhookInput ? elements.discordWebhookInput.value : '',
        logScaleEnabled: elements.logScaleToggle ? elements.logScaleToggle.checked : true,
        tradingMode: isPaperTrading ? 'paper' : 'live',
    };

    localStorage.setItem(SETTINGS_STORAGE, JSON.stringify(settings));
    showAlert('Settings saved successfully.', 'success');
    logMessage('Settings saved successfully.', 'info');
}

// Load bot settings from localStorage
function loadSettings() {
    console.log('Loading bot settings...');

    const savedSettings = localStorage.getItem(SETTINGS_STORAGE);
    if (!savedSettings) {
        console.log('No saved settings found.');
        return;
    }

    const settings = JSON.parse(savedSettings);

    // Apply settings to UI
    if (elements.symbolSelect) {
        elements.symbolSelect.value = settings.symbol || 'BTCUSDT';
    }
    if (elements.timeframeSelect) {
        elements.timeframeSelect.value = settings.timeframe || '1h';
    }
    if (elements.atrLength) {
        elements.atrLength.value = settings.atrLength || 5;
        if (elements.atrLengthValue) {
            elements.atrLengthValue.textContent = settings.atrLength || 5;
        }
    }
    if (elements.atrMult) {
        elements.atrMult.value = settings.atrMult || 0.75;
        if (elements.atrMultValue) {
            elements.atrMultValue.textContent = settings.atrMult || 0.75;
        }
    }
    if (elements.positionSize) {
        elements.positionSize.value = settings.positionSize || 5;
        if (elements.positionSizeValue) {
            elements.positionSizeValue.textContent = `${settings.positionSize || 5}%`;
        }
    }
    if (settings.theme) {
        document.body.className = `${settings.theme}-theme`;
    }
    if (elements.discordWebhookInput) {
        elements.discordWebhookInput.value = settings.discordWebhook || '';
    }
    if (elements.logScaleToggle) {
        elements.logScaleToggle.checked = settings.logScaleEnabled !== undefined ? settings.logScaleEnabled : true;
    }
    isPaperTrading = settings.tradingMode === 'paper';

    logMessage('Settings loaded successfully.', 'info');
}

// Format number with commas
function formatNumber(number) {
    return parseFloat(number).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Start live clock display in the UI
function startLiveClock() {
    console.log('Starting live clock...');

    function updateClock() {
        const now = new Date();
        const formattedTime = now.toISOString().split('T').join(' ').slice(0, -5) + ' UTC'; // Format as YYYY-MM-DD HH:MM:SS UTC
        if (elements.clockDisplay) {
            elements.clockDisplay.textContent = formattedTime;
        }
    }

    // Update clock every second
    setInterval(updateClock, 1000);
    updateClock(); // Initial update
}

// Initialize empty charts for trading data
function initializeEmptyCharts() {
    console.log('Initializing empty charts...');

    // Initialize trading view chart
    if (elements.tradingViewChart) {
        elements.tradingViewChart.innerHTML = '<p>Chart will appear here once trading starts.</p>';
    }

    // Initialize equity chart
    if (elements.equityChart) {
        const layout = {
            title: 'Equity Curve',
            xaxis: { title: 'Time', type: 'date' },
            yaxis: { title: 'Equity', type: 'linear', autorange: true },
            margin: { l: 50, r: 50, b: 50, t: 50 },
        };

        const trace = {
            x: [],
            y: [],
            mode: 'lines',
            name: 'Equity',
        };

        Plotly.newPlot(elements.equityChart, [trace], layout);
    }


    
    // Initialize depth chart
    if (elements.depthChart) {
        const layout = {
            title: 'Market Depth',
            xaxis: { title: 'Price', autorange: true },
            yaxis: { title: 'Volume', autorange: true },
            margin: { l: 50, r: 50, b: 50, t: 50 },
        };

        const trace = {
            x: [],
            y: [],
            type: 'bar',
            name: 'Market Depth',
        };

        Plotly.newPlot(elements.depthChart, [trace], layout);
    }

    console.log('Empty charts initialized.');
}

// Check if the user is using a mobile device and update the UI accordingly
function checkMobileDevice() {
    console.log('Checking if the user is on a mobile device...');

    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

    if (isMobile) {
        console.log('Mobile device detected.');
        if (elements.mobileInfo) {
            elements.mobileInfo.style.display = 'block'; // Show mobile warning
        }
    } else {
        console.log('Desktop device detected.');
        if (elements.mobileInfo) {
            elements.mobileInfo.style.display = 'none'; // Hide mobile warning
        }
    }
}

// Check for stored API keys and load them if available
function checkStoredApiKeys() {
    console.log('Checking for stored API keys...');

    // Retrieve API keys from localStorage
    const storedApiKey = localStorage.getItem(API_KEY_STORAGE);
    const storedApiSecret = localStorage.getItem(API_SECRET_STORAGE);

    if (storedApiKey && storedApiSecret) {
        console.log('Stored API keys found.');

        // Set the API keys to global variables
        apiKey = storedApiKey;
        apiSecret = storedApiSecret;

        // Update the UI to reflect that the API keys are set
        if (elements.apiKeyStatus) {
            elements.apiKeyStatus.textContent = 'API Keys Loaded';
            elements.apiKeyStatus.className = 'status-indicator success';
        }

        logMessage('Stored API keys loaded successfully.', 'success');
    } else {
        console.log('No stored API keys found.');

        // Update the UI to reflect that the API keys are missing
        if (elements.apiKeyStatus) {
            elements.apiKeyStatus.textContent = 'API Keys Missing';
            elements.apiKeyStatus.className = 'status-indicator warning';
        }

        logMessage('No API keys found in localStorage.', 'warning');
    }
}

// Stop trading
function stopTrading() {
    if (!isTrading) {
        showAlert('Trading is already stopped.', 'info');
        return;
    }

    console.log('Stopping trading...');

    // Disconnect WebSocket with proper cleanup
    if (websocket) {
        isTrading = false; // Prevent reconnection attempts
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

    logMessage('Trading stopped.', 'warning');
    showAlert('Trading has been stopped.', 'warning');
}


// Load saved trading sessions
function loadSavedSessions() {
    const sessions = Object.keys(localStorage)
        .filter(key => key.startsWith(SESSION_STORAGE_PREFIX))
        .map(key => {
            const data = JSON.parse(localStorage.getItem(key));
            return {
                key,
                timestamp: data.timestamp,
                tradeCount: data.tradeHistory.length,
            };
        });

    if (sessions.length === 0) {
        elements.savedSessions.style.display = 'none';
        return;
    }

    elements.savedSessions.style.display = 'block';
    elements.sessionsList.innerHTML = sessions
        .map(session => `
            <div class="session-file" data-key="${session.key}">
                <span>Session saved on ${new Date(session.timestamp).toLocaleString()}</span>
                <span class="session-file-date">Trades: ${session.tradeCount}</span>
            </div>
        `)
        .join('');

    document.querySelectorAll('.session-file').forEach(file => {
        file.addEventListener('click', () => {
            const sessionKey = file.getAttribute('data-key');
            loadSession(sessionKey);
        });
    });
}

// Load a specific session from localStorage
function loadSession(sessionKey) {
    const sessionData = JSON.parse(localStorage.getItem(sessionKey));
    if (!sessionData) {
        showAlert('Failed to load the session.', 'danger');
        return;
    }

    tradeHistory = sessionData.tradeHistory || [];
    equityHistory = sessionData.equityHistory || [];
    currentPosition = sessionData.currentPosition || null;
    candleData = sessionData.candleData || [];
    elements.symbolSelect.value = sessionData.settings.symbol;
    elements.timeframeSelect.value = sessionData.settings.timeframe;
    elements.atrLength.value = sessionData.settings.atrLength;
    elements.atrMult.value = sessionData.settings.atrMult;
    elements.positionSize.value = sessionData.settings.positionSize;
    elements.accountBalance.value = sessionData.settings.accountBalance;

    updateTradeHistory();
    updateStatistics();
    updateEquityChart(equityHistory);
    updatePositionCard();

    showAlert('Trading session restored successfully.', 'success');
}

// Update equity chart with logarithmic scaling
function updateEquityChart(data) {
    if (!equityChartInstance || !data || data.length === 0) return;

    const times = data.map(point => new Date(point.time * 1000));
    const values = data.map(point => point.value);

    const layout = {
        title: 'Equity Curve',
        xaxis: { title: 'Time', type: 'date' },
        yaxis: {
            title: 'Equity',
            type: logScaleEnabled ? 'log' : 'linear',
            autorange: true,
        },
        margin: { l: 50, r: 50, b: 50, t: 50 },
    };

    const trace = {
        x: times,
        y: values,
        mode: 'lines',
        name: 'Equity',
    };

    Plotly.newPlot(elements.equityChart, [trace], layout);
}

// Send enhanced Discord notifications
function sendDiscordNotification(message) {
    const webhookUrl = elements.discordWebhookInput.value.trim();
    if (!webhookUrl) {
        console.warn('Discord webhook URL is not set.');
        return;
    }

    const payload = {
        username: 'Trading Bot',
        avatar_url: 'https://example.com/avatar.png',
        embeds: [
            {
                title: message.title,
                description: message.content,
                color: message.type === 'success' ? 3066993 : message.type === 'error' ? 15158332 : 3447003,
                timestamp: new Date().toISOString(),
            },
        ],
    };

    axios.post(webhookUrl, payload)
        .then(() => {
            console.log('Discord notification sent successfully.');
        })
        .catch(error => {
            console.error('Failed to send Discord notification:', error);
        });
}

// Enhanced alert system to send notifications across multiple channels
function sendAlerts(message) {
    if (elements.discordAlertToggle.checked) {
        sendDiscordNotification(message);
    }

    if (elements.telegramAlertToggle.checked) {
        sendTelegramNotification(message);
    }

    if (elements.emailAlertToggle.checked) {
        sendEmailNotification(message);
    }

    if (elements.browserAlertToggle.checked) {
        showBrowserNotification(message);
    }

    if (elements.soundAlertToggle.checked) {
        playSoundAlert();
    }
}

// Example Telegram notification function
function sendTelegramNotification(message) {
    const token = elements.telegramTokenInput.value.trim();
    const chatId = elements.telegramChatIdInput.value.trim();
    if (!token || !chatId) {
        console.warn('Telegram bot token or chat ID is not set.');
        return;
    }

    const payload = {
        chat_id: chatId,
        text: `${message.title}\n\n${message.content}`,
        parse_mode: 'Markdown',
    };

    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;

    axios.post(apiUrl, payload)
        .then(() => {
            console.log('Telegram notification sent successfully.');
        })
        .catch(error => {
            console.error('Failed to send Telegram notification:', error);
        });
}

// Play sound alert
function playSoundAlert() {
    const audio = new Audio('https://example.com/alert.mp3');
    audio.volume = parseFloat(elements.soundVolumeInput.value);
    audio.play();
}

// Show browser notification
function showBrowserNotification(message) {
    if (!('Notification' in window)) {
        console.warn('Browser notifications are not supported.');
        return;
    }

    if (Notification.permission === 'granted') {
        const notification = new Notification(message.title, {
            body: message.content,
            icon: 'https://example.com/icon.png',
        });
    } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                const notification = new Notification(message.title, {
                    body: message.content,
                    icon: 'https://example.com/icon.png',
                });
            }
        });
    }
}

// Ensure charts render correctly after tab changes
function ensureChartsRendered() {
    if (plotlyChart) {
        updatePlotlyChart(candleData);
    }
    if (equityChartInstance) {
        updateEquityChart(equityHistory);
    }
}

// Finalize initialization
function finalizeInitialization() {
    console.log('Trading bot initialized successfully.');
    logMessage('Bot is ready to start trading.', 'success');
}

// Call this to finalize initialization after setup
finalizeInitialization();