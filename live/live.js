// Define constants for localStorage keys and API settings
const API_KEY_STORAGE = 'trading_bot_api_key';
const API_SECRET_STORAGE = 'trading_bot_api_secret';
const SETTINGS_STORAGE = 'trading_bot_settings';
const API_URL = 'https://api.binance.com'; // Binance API base URL

console.log('Constants initialized:', { API_KEY_STORAGE, API_SECRET_STORAGE, SETTINGS_STORAGE, API_URL });
const SESSION_STORAGE_PREFIX = 'trading_session_';
const VERSION = '1.3.0'; // Version tracking for compatibility

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
        navigator.serviceWorker.register('./sw.js').catch(err => {
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
    
    // Email alert element
    elements.emailAlertToggle = document.getElementById('email-alert-toggle');
    elements.emailAddressInput = document.getElementById('email-address-input');
    
    // Telegram elements
    elements.telegramAlertToggle = document.getElementById('telegram-alert-toggle');
    elements.telegramTokenInput = document.getElementById('telegram-token-input');
    elements.telegramChatIdInput = document.getElementById('telegram-chatid-input');
    
    // Sound alert elements
    elements.soundAlertToggle = document.getElementById('sound-alert-toggle');
    elements.soundVolumeInput = document.getElementById('sound-volume-input');
    
    // Browser alert element
    elements.browserAlertToggle = document.getElementById('browser-alert-toggle');
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
    if (elements.discordAlertToggle && elements.discordAlertToggle.checked) {
        sendDiscordNotification(message);
    }

    if (elements.telegramAlertToggle && elements.telegramAlertToggle.checked) {
        sendTelegramNotification(message);
    }

    if (elements.emailAlertToggle && elements.emailAlertToggle.checked) {
        sendEmailNotification(message);
    }

    if (elements.browserAlertToggle && elements.browserAlertToggle.checked) {
        showBrowserNotification(message);
    }

    if (elements.soundAlertToggle && elements.soundAlertToggle.checked) {
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
    audio.play().catch(e => console.error('Failed to play sound alert:', e));
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

// Send email notification
function sendEmailNotification(message) {
    const email = elements.emailAddressInput.value.trim();
    if (!email) {
        console.warn('Email address is not set.');
        return;
    }
    
    // In a real implementation, this would connect to an email service
    console.log(`Would send email to ${email} with title: ${message.title}`);
    
    // Since we can't actually send emails from client-side JavaScript directly,
    // this is just a placeholder. In a real app, you would send a request to your server
    // which would then use an email service to send the notification.
    logMessage(`Email notification would be sent to ${email}`, 'info');
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

// Update plotly chart theme based on current theme
function updatePlotlyChartTheme() {
    const isDarkTheme = document.body.classList.contains('dark-theme');
    
    if (!plotlyChart) return;
    
    const layout = {
        paper_bgcolor: isDarkTheme ? '#212529' : '#ffffff',
        plot_bgcolor: isDarkTheme ? '#2a2e32' : '#f8f9fa',
        font: {
            color: isDarkTheme ? '#e9ecef' : '#212529'
        }
    };
    
    Plotly.relayout(elements.equityChart, layout);
    if (elements.depthChart) {
        Plotly.relayout(elements.depthChart, layout);
    }
}

// Update the plotly chart with new candle data
function updatePlotlyChart(data) {
    if (!data || data.length === 0) return;
    
    // Implement chart update logic here
    // This is a placeholder - the actual implementation would depend on your specific requirements
    console.log('Updating plotly chart with', data.length, 'candles');
}

// Connect to Binance API with provided keys
function connectToApi(key, secret, remember) {
    console.log('Connecting to Binance API...');
    
    // Set API keys
    apiKey = key;
    apiSecret = secret;
    
    // Save API keys if remember is checked
    if (remember) {
        localStorage.setItem(API_KEY_STORAGE, key);
        localStorage.setItem(API_SECRET_STORAGE, secret);
    }
    
    // Test API connection
    testApiConnection()
        .then(isValid => {
            if (isValid) {
                elements.loginModal.hide();
                updateApiStatus(true);
                fetchInitialData();
                logMessage('Connected to Binance API successfully.', 'success');
                showAlert('Connected to Binance API successfully.', 'success');
            } else {
                updateApiStatus(false);
                logMessage('Failed to connect to Binance API. Invalid API keys.', 'error');
                showAlert('Failed to connect to Binance API. Please check your API keys.', 'danger');
            }
        })
        .catch(error => {
            console.error('Error connecting to Binance API:', error);
            updateApiStatus(false);
            logMessage(`Failed to connect to Binance API: ${error.message}`, 'error');
            showAlert('Failed to connect to Binance API. Please check your connection.', 'danger');
        });
}

// Test if API connection is valid
async function testApiConnection() {
    try {
        // Ping Binance API
        const response = await fetch(`${API_URL}/api/v3/ping`);
        return response.ok;
    } catch (error) {
        console.error('Error testing API connection:', error);
        return false;
    }
}

// Handle username/password login
function handleLogin(username, password) {
    console.log(`Attempting login for user: ${username}`);
    
    // For demo purposes, accept "demo" / "demo" for paper trading
    if (username === 'demo' && password === 'demo') {
        elements.loginModal.hide();
        initializePaperTrading(username);
        return;
    }
    
    // For regular login, you would connect to your authentication service here
    // This is just a placeholder
    if (username === 'gelimorto2' && password === 'password') {
        elements.loginModal.hide();
        
        // If paper trading is selected, initialize paper trading
        if (elements.tradingModeSwitch.checked) {
            initializePaperTrading(username);
        } else {
            // Otherwise, prompt for API keys
            elements.apiKeyInputs.style.display = 'block';
            elements.standardLoginForm.style.display = 'none';
            document.getElementById('manualKeyText').textContent = 'Use Standard Login';
            showAlert('Please enter your Binance API keys to continue.', 'info');
        }
    } else {
        showAlert('Invalid username or password.', 'danger');
    }
}

// Update API status indicators
function updateApiStatus(isConnected, isPaper = false) {
    if (elements.apiStatusBadge) {
        if (isConnected) {
            elements.apiStatusBadge.className = 'badge bg-success me-2';
            elements.apiStatusBadge.textContent = isPaper ? 'Paper Trading' : 'Connected';
        } else {
            elements.apiStatusBadge.className = 'badge bg-danger me-2';
            elements.apiStatusBadge.textContent = 'Disconnected';
        }
    }
    
    if (elements.apiKeyMasked) {
        if (isPaper) {
            elements.apiKeyMasked.textContent = 'Paper Trading (No API Key needed)';
        } else if (apiKey) {
            const maskedKey = apiKey.substring(0, 4) + '••••••••' + apiKey.substring(apiKey.length - 4);
            elements.apiKeyMasked.textContent = maskedKey;
        } else {
            elements.apiKeyMasked.textContent = 'No API Key';
        }
    }
}

// Fetch initial market data
async function fetchInitialData() {
    console.log('Fetching initial market data...');
    
    // Show loading indicator
    if (elements.loadingIndicator) {
        elements.loadingIndicator.style.display = 'flex';
    }
    
    const symbol = elements.symbolSelect.value;
    const timeframe = elements.timeframeSelect.value;
    
    try {
        // Fetch candle data from Binance API
        const response = await fetch(`${API_URL}/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=100`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch candle data: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Parse candle data
        candleData = data.map(candle => ({
            time: candle[0] / 1000,
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5]),
        }));
        
        // Set current price from latest candle
        currentPrice = candleData[candleData.length - 1].close;
        
        // Update market data display
        updateMarketData(symbol, currentPrice);
        
        // Initialize chart with fetched data
        initializeChart(candleData);
        
        logMessage(`Fetched ${candleData.length} candles for ${symbol} ${timeframe}`, 'success');
    } catch (error) {
        console.error('Error fetching initial data:', error);
        logMessage(`Failed to fetch initial data: ${error.message}`, 'error');
        showAlert('Failed to fetch market data. Please try again.', 'danger');
    } finally {
        // Hide loading indicator
        if (elements.loadingIndicator) {
            elements.loadingIndicator.style.display = 'none';
        }
    }
}

// Update market data display
function updateMarketData(symbol, price) {
    if (!elements.marketPrice) return;
    
    // Format price based on symbol
    const formattedPrice = formatPrice(price, symbol);
    elements.marketPrice.textContent = formattedPrice;
    
    // You would fetch 24h change and volume from an API call in a real implementation
    // This is a placeholder
    elements.marketChange.textContent = '0.00%';
    elements.marketVolume.textContent = '$0';
    
    // Update document title with current price
    document.title = `${formattedPrice} | ${symbol} | Trading Bot`;
}

// Format price based on symbol (add appropriate decimal places)
function formatPrice(price, symbol) {
    // More decimal places for lower value assets
    if (symbol.includes('BTC')) {
        return `$${price.toFixed(2)}`;
    } else if (symbol.includes('ETH')) {
        return `$${price.toFixed(2)}`;
    } else {
        return `$${price.toFixed(4)}`;
    }
}

// Initialize trading chart with data
function initializeChart(data) {
    if (!elements.tradingViewChart) return;
    
    // Clear previous chart
    elements.tradingViewChart.innerHTML = '';
    
    // Create a new chart
    const chart = LightweightCharts.createChart(elements.tradingViewChart, {
        width: elements.tradingViewChart.clientWidth,
        height: 500,
        layout: {
            backgroundColor: '#1e222d',
            textColor: '#d1d4dc',
        },
        grid: {
            vertLines: {
                color: 'rgba(42, 46, 57, 0.5)',
            },
            horzLines: {
                color: 'rgba(42, 46, 57, 0.5)',
            },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: 'rgba(197, 203, 206, 0.8)',
        },
        timeScale: {
            borderColor: 'rgba(197, 203, 206, 0.8)',
        },
    });
    
    // Create a candlestick series
    const candleSeries = chart.addCandlestickSeries({
        upColor: '#4CAF50',
        downColor: '#F44336',
        borderDownColor: '#F44336',
        borderUpColor: '#4CAF50',
        wickDownColor: '#F44336',
        wickUpColor: '#4CAF50',
    });
    
    // Set data
    candleSeries.setData(data);
    
    // Save chart instance for later updates
    chartInstance = chart;
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (chartInstance) {
            chartInstance.resize(elements.tradingViewChart.clientWidth, 500);
        }
    });
}

// Start trading
function startTrading() {
    if (isTrading) {
        showAlert('Trading is already active.', 'info');
        return;
    }
    
    console.log('Starting trading...');
    
    // Confirm if in live trading mode
    if (!isPaperTrading) {
        if (!confirm('⚠️ WARNING: You are about to start LIVE trading with real funds. Are you sure you want to continue?')) {
            return;
        }
    }
    
    // Initialize trading variables
    isTrading = true;
    updateBotStatus(true);
    
    // Enable/disable buttons
    if (elements.startTradingBtn) elements.startTradingBtn.disabled = true;
    if (elements.stopTradingBtn) elements.stopTradingBtn.disabled = false;
    if (elements.emergencySellBtn) elements.emergencySellBtn.disabled = false;
    
    // Disable strategy parameters during trading
    if (elements.symbolSelect) elements.symbolSelect.disabled = true;
    if (elements.timeframeSelect) elements.timeframeSelect.disabled = true;
    if (elements.atrLength) elements.atrLength.disabled = true;
    if (elements.atrMult) elements.atrMult.disabled = true;
    
    // Connect to WebSocket for real-time data
    connectToWebSocket();
    
    // Start periodic session saves
    startSessionSaves();
    
    logMessage('Trading started.', 'success');
    showAlert(`Trading started on ${elements.symbolSelect.value} ${elements.timeframeSelect.value}`, 'success');
}

// Connect to WebSocket for real-time data
function connectToWebSocket() {
    const symbol = elements.symbolSelect.value.toLowerCase();
    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@kline_${elements.timeframeSelect.value}`;
    
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    
    // Close existing connection if any
    if (websocket) {
        websocket.close();
    }
    
    // Create new WebSocket connection
    websocket = new WebSocket(wsUrl);
    
    // Set up event handlers
    websocket.onopen = () => {
        console.log('WebSocket connected');
        logMessage('WebSocket connected.', 'success');
        
        // Start ping interval to keep connection alive
        pingInterval = setInterval(() => {
            if (websocket && websocket.readyState === WebSocket.OPEN) {
                const startTime = Date.now();
                fetch(`${API_URL}/api/v3/ping`)
                    .then(() => {
                        apiPingLatency = Date.now() - startTime;
                        if (elements.statPing) {
                            elements.statPing.textContent = `${apiPingLatency}ms`;
                        }
                    })
                    .catch(err => console.error('Ping error:', err));
            }
        }, 10000);
    };
    
    websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Update last tick info
        if (elements.lastTickInfo) {
            elements.lastTickInfo.textContent = `Last check: ${formatTime(new Date())}`;
        }
        
        // Process kline data
        if (data.k) {
            const candle = {
                time: data.k.t / 1000,
                open: parseFloat(data.k.o),
                high: parseFloat(data.k.h),
                low: parseFloat(data.k.l),
                close: parseFloat(data.k.c),
                volume: parseFloat(data.k.v)
            };
            
            // Update current price
            currentPrice = candle.close;
            
            // Update UI with new price
            updatePrice(currentPrice);
            
            // Update chart
            updateChart(candle);
            
            // Check for trade signals
            checkSignals(candle);
            
            // Update position if exists
            updatePosition();
        }
    };
    
    websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        logMessage('WebSocket error occurred.', 'error');
    };
    
    websocket.onclose = () => {
        console.log('WebSocket closed');
        logMessage('WebSocket connection closed.', 'warning');
        
        // Clear ping interval
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }
        
        // Reconnect if trading is still active
        if (isTrading) {
            logMessage('Attempting to reconnect WebSocket...', 'info');
            setTimeout(connectToWebSocket, 1000);
        }
    };
}

// ... [previous code remains the same]

// Update price in UI
function updatePrice(price) {
    const symbol = elements.symbolSelect.value;
    const formattedPrice = formatPrice(price, symbol);
    
    if (elements.marketPrice) {
        elements.marketPrice.textContent = formattedPrice;
    }
    
    // Update document title
    document.title = `${formattedPrice} | ${symbol} | Trading Bot`;
    
    // Update position card if we have an open position
    if (currentPosition) {
        updatePositionCard();
    }
}

// Update chart with new candle data
function updateChart(candle) {
    if (!chartInstance) return;
    
    // Add new candle to chart
    chartInstance.update({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
    });
}

// Check for trading signals
function checkSignals(candle) {
    // Don't check signals if auto-trade is disabled
    const autoTradeToggle = document.getElementById('auto-trade-toggle');
    if (autoTradeToggle && !autoTradeToggle.checked) {
        return;
    }
    
    // Get strategy parameters
    const atrLength = parseInt(elements.atrLength.value, 10);
    const atrMult = parseFloat(elements.atrMult.value);
    
    // Calculate ATR-based volatility
    const atr = calculateATR(atrLength);
    
    // Buy signal (uptrend detection)
    if (!currentPosition && candleData.length > atrLength + 5) {
        const signal = detectBuySignal(candle, atr, atrMult);
        
        if (signal) {
            openLongPosition(candle.close, atr);
        }
    }
    
    // Sell signal (downtrend detection)
    if (currentPosition && currentPosition.type === 'long') {
        const exitSignal = detectSellSignal(candle, atr, atrMult);
        
        if (exitSignal) {
            closePosition();
        }
    }
}

// Calculate Average True Range (ATR)
function calculateATR(length) {
    if (candleData.length < length + 1) {
        return 0;
    }
    
    let sum = 0;
    
    for (let i = candleData.length - length; i < candleData.length; i++) {
        const high = candleData[i].high;
        const low = candleData[i].low;
        const prevClose = i > 0 ? candleData[i - 1].close : candleData[i].open;
        
        // True Range is the greatest of:
        // 1. Current High - Current Low
        // 2. |Current High - Previous Close|
        // 3. |Current Low - Previous Close|
        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        
        sum += tr;
    }
    
    return sum / length;
}

// Detect buy signal based on Volatility strategy
function detectBuySignal(candle, atr, atrMult) {
    if (candleData.length < 10) return false;
    
    // Simple moving average
    const sma5 = calculateSMA(5);
    const sma10 = calculateSMA(10);
    
    // Trend condition: 5-period SMA above 10-period SMA
    const uptrend = sma5 > sma10;
    
    // Volatility condition: Current candle range > ATR * multiplier
    const volatilityBreakout = (candle.high - candle.low) > (atr * atrMult);
    
    // Volume condition: Current volume > average volume
    const avgVolume = calculateAverageVolume(10);
    const volumeIncrease = candle.volume > (avgVolume * 1.5);
    
    // Return buy signal if all conditions are met
    return uptrend && volatilityBreakout && volumeIncrease;
}

// Detect sell signal based on Volatility strategy
function detectSellSignal(candle, atr, atrMult) {
    if (!currentPosition || candleData.length < 10) return false;
    
    // Simple moving average
    const sma5 = calculateSMA(5);
    const sma10 = calculateSMA(10);
    
    // Trend condition: 5-period SMA below 10-period SMA
    const downtrend = sma5 < sma10;
    
    // Take profit condition
    const takeProfitPercent = document.getElementById('take-profit-value') ? 
        parseFloat(document.getElementById('take-profit-value').value) / 100 : 0.03;
    const takeProfitPrice = currentPosition.entryPrice * (1 + takeProfitPercent);
    const takeProfitHit = candle.high >= takeProfitPrice;
    
    // Stop loss condition
    const stopLossPercent = document.getElementById('stop-loss-value') ? 
        parseFloat(document.getElementById('stop-loss-value').value) / 100 : 0.02;
    const stopLossPrice = currentPosition.entryPrice * (1 - stopLossPercent);
    const stopLossHit = candle.low <= stopLossPrice;
    
    // Return sell signal if downtrend or take profit/stop loss hit
    return downtrend || takeProfitHit || stopLossHit;
}

// Calculate Simple Moving Average (SMA)
function calculateSMA(length) {
    if (candleData.length < length) {
        return 0;
    }
    
    let sum = 0;
    
    for (let i = candleData.length - length; i < candleData.length; i++) {
        sum += candleData[i].close;
    }
    
    return sum / length;
}

// Calculate Average Volume
function calculateAverageVolume(length) {
    if (candleData.length < length) {
        return 0;
    }
    
    let sum = 0;
    
    for (let i = candleData.length - length; i < candleData.length; i++) {
        sum += candleData[i].volume;
    }
    
    return sum / length;
}

// Open a long position
function openLongPosition(price, atr) {
    console.log('Opening long position at', price);
    
    // Calculate position size
    const accountBalanceValue = parseFloat(elements.accountBalance.value);
    const positionSizePercent = parseFloat(elements.positionSize.value) / 100;
    const positionValue = accountBalanceValue * positionSizePercent;
    const positionSize = positionValue / price;
    
    // Calculate take profit and stop loss
    const takeProfitPercent = document.getElementById('take-profit-value') ? 
        parseFloat(document.getElementById('take-profit-value').value) / 100 : 0.03;
    const stopLossPercent = document.getElementById('stop-loss-value') ? 
        parseFloat(document.getElementById('stop-loss-value').value) / 100 : 0.02;
    
    const takeProfitPrice = price * (1 + takeProfitPercent);
    const stopLossPrice = price * (1 - stopLossPercent);
    
    // Create position object
    currentPosition = {
        type: 'long',
        entryPrice: price,
        size: positionSize,
        value: positionValue,
        entryTime: new Date(),
        takeProfitPrice,
        stopLossPrice,
    };
    
    // Update position card
    updatePositionCard();
    
    // Show position card
    if (elements.positionCard) {
        elements.positionCard.style.display = 'block';
    }
    
    // Log the trade
    logMessage(`OPENED LONG position: ${positionSize.toFixed(8)} ${elements.symbolSelect.value} at $${price.toFixed(2)}`, 'success');
    
    // Send notification
    const message = {
        title: "New Trade: Long Position Opened",
        content: `Opened LONG position: ${positionSize.toFixed(8)} ${elements.symbolSelect.value} at $${price.toFixed(2)}`,
        type: "success"
    };
    
    sendAlerts(message);
}

// Close the current position
function closePosition() {
    if (!currentPosition) return;
    
    console.log('Closing position');
    
    const exitPrice = currentPrice;
    const profitLoss = currentPosition.type === 'long' 
        ? (exitPrice - currentPosition.entryPrice) * currentPosition.size
        : (currentPosition.entryPrice - exitPrice) * currentPosition.size;
    
    const profitLossPercent = (profitLoss / currentPosition.value) * 100;
    
    // Create trade history entry
    const trade = {
        entryTime: currentPosition.entryTime,
        exitTime: new Date(),
        type: currentPosition.type,
        entryPrice: currentPosition.entryPrice,
        exitPrice: exitPrice,
        size: currentPosition.size,
        profitLoss: profitLoss,
        profitLossPercent: profitLossPercent,
    };
    
    // Add to trade history
    tradeHistory.push(trade);
    
    // Update trade history table
    updateTradeHistory();
    
    // Update equity history
    const balance = parseFloat(elements.accountBalance.value) + profitLoss;
    elements.accountBalance.value = balance.toFixed(2);
    
    if (elements.currentBalance) {
        elements.currentBalance.textContent = `$${formatNumber(balance)}`;
    }
    
    equityHistory.push({
        time: Math.floor(Date.now() / 1000),
        value: balance,
    });
    
    // Update equity chart
    updateEquityChart(equityHistory);
    
    // Update statistics
    updateStatistics();
    
    // Hide position card
    if (elements.positionCard) {
        elements.positionCard.style.display = 'none';
    }
    
    // Reset current position
    currentPosition = null;
    
    // Log the trade
    const profitLossStr = profitLoss >= 0 
        ? `+$${profitLoss.toFixed(2)} (+${profitLossPercent.toFixed(2)}%)`
        : `-$${Math.abs(profitLoss).toFixed(2)} (${profitLossPercent.toFixed(2)}%)`;
    
    logMessage(`CLOSED ${trade.type.toUpperCase()} position: ${profitLossStr}`, profitLoss >= 0 ? 'success' : 'error');
    
    // Send notification
    const message = {
        title: `Trade Closed: ${profitLoss >= 0 ? 'Profit' : 'Loss'}`,
        content: `Closed ${trade.type.toUpperCase()} position: ${profitLossStr}`,
        type: profitLoss >= 0 ? 'success' : 'warning'
    };
    
    sendAlerts(message);
}

// Update position card with current position details
function updatePositionCard() {
    if (!currentPosition || !elements.positionCard) return;
    
    // Calculate unrealized P&L
    const unrealizedPL = currentPosition.type === 'long'
        ? (currentPrice - currentPosition.entryPrice) * currentPosition.size
        : (currentPosition.entryPrice - currentPrice) * currentPosition.size;
    
    const unrealizedPLPercent = (unrealizedPL / currentPosition.value) * 100;
    
    // Update UI elements
    elements.positionType.textContent = currentPosition.type.toUpperCase();
    elements.positionType.className = currentPosition.type === 'long' ? 'metric-value positive' : 'metric-value negative';
    
    elements.positionEntryPrice.textContent = `$${currentPosition.entryPrice.toFixed(2)}`;
    elements.positionCurrentPrice.textContent = `$${currentPrice.toFixed(2)}`;
    
    const plClass = unrealizedPL >= 0 ? 'metric-value positive' : 'metric-value negative';
    elements.positionPnl.className = plClass;
    elements.positionPnl.textContent = `${unrealizedPL >= 0 ? '+' : ''}$${unrealizedPL.toFixed(2)} (${unrealizedPLPercent.toFixed(2)}%)`;
    
    elements.positionEntryTime.textContent = currentPosition.entryTime.toLocaleString();
    elements.positionSizeInfo.textContent = currentPosition.size.toFixed(8);
    elements.positionTp.textContent = `$${currentPosition.takeProfitPrice.toFixed(2)}`;
    elements.positionSl.textContent = `$${currentPosition.stopLossPrice.toFixed(2)}`;
}

// Update position with current price data
function updatePosition() {
    if (!currentPosition) return;
    
    // Update position card with current price
    updatePositionCard();
    
    // Check if we hit take profit or stop loss
    if (currentPosition.type === 'long') {
        // Check take profit
        if (currentPrice >= currentPosition.takeProfitPrice) {
            logMessage('Take profit level reached.', 'success');
            closePosition();
            return;
        }
        
        // Check stop loss
        if (currentPrice <= currentPosition.stopLossPrice) {
            logMessage('Stop loss level reached.', 'warning');
            closePosition();
            return;
        }
    } else if (currentPosition.type === 'short') {
        // Check take profit
        if (currentPrice <= currentPosition.takeProfitPrice) {
            logMessage('Take profit level reached.', 'success');
            closePosition();
            return;
        }
        
        // Check stop loss
        if (currentPrice >= currentPosition.stopLossPrice) {
            logMessage('Stop loss level reached.', 'warning');
            closePosition();
            return;
        }
    }
}

// Update trade history table
function updateTradeHistory() {
    if (!elements.tradeHistory) return;
    
    // Clear existing rows
    elements.tradeHistory.innerHTML = '';
    
    // Add rows for each trade
    tradeHistory.forEach((trade, index) => {
        const row = document.createElement('tr');
        
        // Format dates
        const entryDate = new Date(trade.entryTime);
        const exitDate = new Date(trade.exitTime);
        
        // Determine profit/loss class
        const plClass = trade.profitLoss >= 0 ? 'positive' : 'negative';
        
        row.innerHTML = `
            <td>${tradeHistory.length - index}</td>
            <td>${entryDate.toLocaleString()}</td>
            <td>${exitDate.toLocaleString()}</td>
            <td class="${trade.type === 'long' ? 'positive' : 'negative'}">${trade.type.toUpperCase()}</td>
            <td>$${trade.entryPrice.toFixed(2)}</td>
            <td>$${trade.exitPrice.toFixed(2)}</td>
            <td>${trade.size.toFixed(8)}</td>
            <td class="${plClass}">${trade.profitLoss >= 0 ? '+' : ''}$${trade.profitLoss.toFixed(2)}</td>
            <td class="${plClass}">${trade.profitLoss >= 0 ? '+' : ''}${trade.profitLossPercent.toFixed(2)}%</td>
        `;
        
        elements.tradeHistory.appendChild(row);
    });
    
    // Update daily trades count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayTrades = tradeHistory.filter(trade => new Date(trade.exitTime) >= today);
    
    if (elements.statDailyTrades) {
        elements.statDailyTrades.textContent = todayTrades.length;
    }
    
    // Update daily P&L
    const dailyPL = todayTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);
    
    if (elements.statDailyPnl) {
        elements.statDailyPnl.textContent = dailyPL >= 0 
            ? `+$${dailyPL.toFixed(2)}`
            : `-$${Math.abs(dailyPL).toFixed(2)}`;
        
        elements.statDailyPnl.className = dailyPL >= 0 ? 'stat-value positive' : 'stat-value negative';
    }
}

// Update statistics display
function updateStatistics() {
    if (tradeHistory.length === 0) return;
    
    // Calculate statistics
    const initialBalance = 10000; // Assuming initial balance of $10,000
    const currentBalanceValue = parseFloat(elements.accountBalance.value);
    
    // Total return
    const totalReturn = ((currentBalanceValue - initialBalance) / initialBalance) * 100;
    const totalReturnDelta = currentBalanceValue - initialBalance;
    
    // Win rate
    const winningTrades = tradeHistory.filter(trade => trade.profitLoss > 0);
    const winRate = (winningTrades.length / tradeHistory.length) * 100;
    
    // Profit factor
    const grossProfit = tradeHistory.reduce((sum, trade) => trade.profitLoss > 0 ? sum + trade.profitLoss : sum, 0);
    const grossLoss = Math.abs(tradeHistory.reduce((sum, trade) => trade.profitLoss < 0 ? sum + trade.profitLoss : sum, 0));
    const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
    
    // Average trade
    const averageTrade = tradeHistory.reduce((sum, trade) => sum + trade.profitLoss, 0) / tradeHistory.length;
    
    // Max drawdown (simplified calculation)
    let maxDrawdown = 0;
    let peak = initialBalance;
    
    for (let i = 0; i < equityHistory.length; i++) {
        const equity = equityHistory[i].value;
        
        if (equity > peak) {
            peak = equity;
        }
        
        const drawdown = ((peak - equity) / peak) * 100;
        
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    }
    
    // Max win and loss
    const maxWin = Math.max(...tradeHistory.map(trade => trade.profitLoss));
    const maxLoss = Math.min(...tradeHistory.map(trade => trade.profitLoss));
    
    // Update UI
    if (elements.totalReturn) {
        elements.totalReturn.textContent = `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`;
        elements.totalReturn.className = totalReturn >= 0 ? 'metric-value positive' : 'metric-value negative';
    }
    
    if (elements.totalReturnDelta) {
        elements.totalReturnDelta.textContent = totalReturnDelta >= 0 
            ? `+$${totalReturnDelta.toFixed(2)}`
            : `-$${Math.abs(totalReturnDelta).toFixed(2)}`;
    }
    
    if (elements.winRate) {
        elements.winRate.textContent = `${winRate.toFixed(1)}%`;
    }
    
    if (elements.winRateDelta) {
        elements.winRateDelta.textContent = `${winningTrades.length}/${tradeHistory.length} trades`;
    }
    
    if (elements.profitFactor) {
        elements.profitFactor.textContent = profitFactor.toFixed(2);
    }
    
    if (elements.profitFactorDelta) {
        elements.profitFactorDelta.textContent = `Avg: ${averageTrade >= 0 ? '+' : ''}$${averageTrade.toFixed(2)}`;
    }
    
    if (elements.maxDrawdown) {
        elements.maxDrawdown.textContent = `${maxDrawdown.toFixed(2)}%`;
    }
    
    if (elements.maxWin) {
        elements.maxWin.textContent = `$${maxWin.toFixed(2)}`;
    }
    
    if (elements.maxLoss) {
        elements.maxLoss.textContent = `$${Math.abs(maxLoss).toFixed(2)}`;
    }
    
    if (elements.totalTrades) {
        elements.totalTrades.textContent = tradeHistory.length;
    }
}

// Start periodic session saves
function startSessionSaves() {
    // Clear any existing interval
    if (sessionSaveInterval) {
        clearInterval(sessionSaveInterval);
    }
    
    // Save session every 5 minutes
    sessionSaveInterval = setInterval(() => {
        if (tradeHistory.length > 0 || equityHistory.length > 0) {
            saveCurrentSession();
        }
    }, 5 * 60 * 1000);
}

// Load saved session files for modal
function loadSavedSessionFiles() {
    if (!elements.sessionFilesList) return;
    
    // Clear existing files
    elements.sessionFilesList.innerHTML = '';
    
    // Get all session files from localStorage
    const sessions = Object.keys(localStorage)
        .filter(key => key.startsWith(SESSION_STORAGE_PREFIX))
        .map(key => {
            const data = JSON.parse(localStorage.getItem(key));
            return {
                key,
                timestamp: data.timestamp,
                tradeCount: data.tradeHistory.length,
                symbol: data.settings.symbol,
            };
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Add files to modal
    sessions.forEach(session => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'session-file';
        fileDiv.setAttribute('data-key', session.key);
        
        fileDiv.innerHTML = `
            <div>
                <strong>${session.symbol}</strong> - ${new Date(session.timestamp).toLocaleString()}
                <div class="small text-muted">Trades: ${session.tradeCount}</div>
            </div>
            <button class="btn btn-sm btn-outline-danger delete-session">
                <i class="bi bi-trash"></i>
            </button>
        `;
        
        elements.sessionFilesList.appendChild(fileDiv);
        
        // Add click handler to load session
        fileDiv.addEventListener('click', (e) => {
            if (e.target.closest('.delete-session')) {
                // Delete session
                if (confirm('Are you sure you want to delete this session?')) {
                    localStorage.removeItem(session.key);
                    loadSavedSessionFiles();
                }
                return;
            }
            
            // Load session
            loadSession(session.key);
            elements.loadSessionModal.hide();
        });
    });
    
    // Show message if no sessions found
    if (sessions.length === 0) {
        elements.sessionFilesList.innerHTML = '<div class="text-center p-3">No saved sessions found.</div>';
    }
}

// Finalize initialization
function finalizeInitialization() {
    console.log('Trading bot initialized successfully.');
    logMessage('Bot is ready to start trading.', 'success');
}

// Service worker for offline support
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
}

// Call this to finalize initialization after setup
finalizeInitialization();