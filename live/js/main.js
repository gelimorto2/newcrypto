/**
 * Volty Trading Bot v2.0.0
 * Main Application Module
 * 
 * Copyright (c) 2025 Volty Trading
 * All rights reserved.
 */

import { ExchangeAPIClient } from './api-client.js';
import { secureStorage } from './secure-storage.js';
import { PositionManager } from './position-manager.js';
import { strategies } from './trading-strategies.js';
import { uiManager } from './ui-manager.js';

// Application state
const state = {
  // Market data
  symbol: 'BTCUSDT',
  timeframe: '1h',
  currentPrice: 0,
  priceData: [],
  volumeData: [],
  
  // Account and positions
  initialCapital: 10000,
  balance: 10000,
  
  // Settings
  settings: {
    autoTrade: true,
    showPositionLines: true,
    useTakeProfit: true,
    useStopLoss: true,
    useTrailingStop: false,
    takeProfitPct: 3,
    stopLossPct: 2,
    trailingStopPct: 1.5,
    positionSize: 10,
    useTestnet: true,
    
    // Notifications
    browserNotifications: true,
    soundNotifications: true,
    discordNotifications: false,
    discordWebhook: '',
  },
  
  // Application state
  isRunning: false,
  isLiveTrading: false,
  lastUpdate: null,
  status: 'idle',
};

// Create instances
const apiClient = new ExchangeAPIClient(state.settings.useTestnet);
const positionManager = new PositionManager();
const activeStrategy = strategies.bollingerBandsVolume;

/**
 * Initialize application
 */
async function initialize() {
  uiManager.addLogMessage('Volty Trading Bot v2.0.0 initializing...', false);
  
  // Initialize UI
  uiManager.initialize();
  
  // Load saved settings
  loadSettings();
  
  // Setup UI event listeners
  setupEventListeners();
  
  // Update UI with loaded settings
  updateUIFromSettings();
  
  // Initialize clock
  updateClock();
  setInterval(updateClock, 1000);
  
  // Check if API keys are set for live trading
  checkApiConfiguration();
  
  // Initialize TradingView chart
  try {
    await initializeTradingViewChart();
    
    // Hide loading indicator after chart is loaded
    document.getElementById('loadingIndicator').style.display = 'none';
    uiManager.addLogMessage('System initialized and ready', false);
    uiManager.updateStatus({
      isRunning: false,
      isLiveTrading: false,
      statusText: 'Ready to start trading',
      activityType: 'waiting'
    });
    
    // Fetch initial market data
    await fetchMarketData();
  } catch (error) {
    document.getElementById('loadingIndicator').style.display = 'none';
    uiManager.addLogMessage(`Initialization error: ${error.message}`, false, true);
    uiManager.showStatusBar(`Initialization error: ${error.message}`, 'error');
  }
}

/**
 * Load settings from localStorage
 */
function loadSettings() {
  const savedSettings = localStorage.getItem('voltySettings');
  if (savedSettings) {
    try {
      const parsedSettings = JSON.parse(savedSettings);
      state.settings = { ...state.settings, ...parsedSettings };
      
      // Load strategy parameters
      if (parsedSettings.bbLength || parsedSettings.bbDeviation || 
          parsedSettings.volumeCandles || parsedSettings.volumeIncrease) {
        
        activeStrategy.setParameters({
          bbLength: parsedSettings.bbLength || 20,
          bbDeviation: parsedSettings.bbDeviation || 2,
          volumeCandles: parsedSettings.volumeCandles || 3,
          volumeIncrease: parsedSettings.volumeIncrease || 20
        });
      }
      
      if (parsedSettings.initialCapital) {
        state.initialCapital = parsedSettings.initialCapital;
        state.balance = parsedSettings.initialCapital;
      }
      
      if (parsedSettings.symbol) state.symbol = parsedSettings.symbol;
      if (parsedSettings.timeframe) state.timeframe = parsedSettings.timeframe;
      
      uiManager.addLogMessage('Settings loaded from local storage');
    } catch (error) {
      uiManager.addLogMessage('Error loading settings: ' + error.message, false, true);
    }
  }
}

/**
 * Save settings to localStorage
 */
function saveSettings() {
  try {
    // Combine all settings into one object
    const settingsToSave = {
      ...state.settings,
      ...activeStrategy.parameters,
      initialCapital: state.initialCapital,
      symbol: state.symbol,
      timeframe: state.timeframe
    };
    
    localStorage.setItem('voltySettings', JSON.stringify(settingsToSave));
    uiManager.addLogMessage('Settings saved to local storage');
    uiManager.showStatusBar('Settings saved successfully', 'success');
  } catch (error) {
    uiManager.addLogMessage('Error saving settings: ' + error.message, false, true);
    uiManager.showStatusBar('Error saving settings', 'error');
  }
}

/**
 * Update UI elements from current settings
 */
function updateUIFromSettings() {
  // Update strategy parameters
  document.getElementById('bb-length').value = activeStrategy.parameters.bbLength;
  document.getElementById('bb-length-value').textContent = activeStrategy.parameters.bbLength;
  
  document.getElementById('bb-dev').value = activeStrategy.parameters.bbDeviation;
  document.getElementById('bb-dev-value').textContent = activeStrategy.parameters.bbDeviation;
  
  document.getElementById('volume-candles').value = activeStrategy.parameters.volumeCandles;
  document.getElementById('volume-candles-value').textContent = activeStrategy.parameters.volumeCandles;
  
  document.getElementById('volume-increase').value = activeStrategy.parameters.volumeIncrease;
  document.getElementById('volume-increase-value').textContent = activeStrategy.parameters.volumeIncrease;
  
  // Update position manager settings
  positionManager.setSettings({
    useTakeProfit: state.settings.useTakeProfit,
    useStopLoss: state.settings.useStopLoss,
    useTrailingStop: state.settings.useTrailingStop,
    takeProfitPct: state.settings.takeProfitPct,
    stopLossPct: state.settings.stopLossPct,
    trailingStopPct: state.settings.trailingStopPct,
    positionSize: state.settings.positionSize
  });
  
  // Update UI Manager settings
  uiManager.setNotificationSettings({
    browserNotifications: state.settings.browserNotifications,
    soundNotifications: state.settings.soundNotifications,
    discordNotifications: state.settings.discordNotifications,
    discordWebhook: state.settings.discordWebhook
  });
  
  // Update account settings
  document.getElementById('initial-capital').value = state.initialCapital;
  
  document.getElementById('position-size').value = state.settings.positionSize;
  document.getElementById('position-size-value').textContent = state.settings.positionSize + '%';
  
  // Update risk management settings
  document.getElementById('take-profit-toggle').checked = state.settings.useTakeProfit;
  document.getElementById('take-profit-value').value = state.settings.takeProfitPct;
  document.getElementById('take-profit-value').disabled = !state.settings.useTakeProfit;
  
  document.getElementById('stop-loss-toggle').checked = state.settings.useStopLoss;
  document.getElementById('stop-loss-value').value = state.settings.stopLossPct;
  document.getElementById('stop-loss-value').disabled = !state.settings.useStopLoss;
  
  document.getElementById('trailing-stop-toggle').checked = state.settings.useTrailingStop;
  document.getElementById('trailing-stop-value').value = state.settings.trailingStopPct;
  document.getElementById('trailing-stop-value').disabled = !state.settings.useTrailingStop;
  
  document.getElementById('auto-trade-toggle').checked = state.settings.autoTrade;
  document.getElementById('show-position-lines-toggle').checked = state.settings.showPositionLines;
  
  // Update API settings
  document.getElementById('api-key').value = state.settings.apiKey ? '********' : '';
  document.getElementById('api-secret').value = state.settings.apiSecret ? '********' : '';
  document.getElementById('use-testnet-toggle').checked = state.settings.useTestnet;
  
  // Update notification settings
  document.getElementById('browser-notifications-toggle').checked = state.settings.browserNotifications;
  document.getElementById('sound-notifications-toggle').checked = state.settings.soundNotifications;
  document.getElementById('discord-notifications-toggle').checked = state.settings.discordNotifications;
  document.getElementById('discord-webhook').value = state.settings.discordWebhook;
  document.getElementById('discord-webhook').disabled = !state.settings.discordNotifications;
  
  // Update market info
  document.getElementById('market-symbol-badge').textContent = state.symbol.replace('USDT', '/USDT');
  document.getElementById('market-symbol').textContent = state.symbol.replace('USDT', '/USDT');
  
  // Update symbol selection
  const symbolSelect = document.getElementById('symbol');
  if (symbolSelect) {
    for (let i = 0; i < symbolSelect.options.length; i++) {
      if (symbolSelect.options[i].value === state.symbol) {
        symbolSelect.selectedIndex = i;
        break;
      }
    }
  }
  
  // Update timeframe selection
  const timeframeSelect = document.getElementById('timeframe');
  if (timeframeSelect) {
    for (let i = 0; i < timeframeSelect.options.length; i++) {
      if (timeframeSelect.options[i].value === state.timeframe) {
        timeframeSelect.selectedIndex = i;
        break;
      }
    }
  }
}

/**
 * Setup event listeners for UI elements
 */
function setupEventListeners() {
  // Add position manager event listeners
  positionManager.addEventListener('onOpen', position => {
    uiManager.updatePositionInfo(position);
    uiManager.addLogMessage(
      `${position.type} position opened at $${position.entryPrice.toFixed(2)} with size: ${position.size.toFixed(6)}`,
      true
    );
  });
  
  positionManager.addEventListener('onClose', position => {
    uiManager.updatePositionInfo(null);
    
    const pnl = position.pnl.realized;
    const pnlPct = position.pnl.realizedPct * 100;
    const pnlStr = pnl >= 0 
      ? `+$${pnl.toFixed(2)} (+${pnlPct.toFixed(2)}%)` 
      : `-$${Math.abs(pnl).toFixed(2)} (${pnlPct.toFixed(2)}%)`;
    
    if (pnl >= 0) {
      uiManager.addLogMessage(
        `${position.type} position closed with profit: ${pnlStr}. Reason: ${position.exitReason}`,
        true
      );
    } else {
      uiManager.addLogMessage(
        `${position.type} position closed with loss: ${pnlStr}. Reason: ${position.exitReason}`,
        false,
        true
      );
    }
    
    // Update performance metrics
    updatePerformanceMetrics();
  });
  
  positionManager.addEventListener('onUpdate', position => {
    uiManager.updatePositionInfo(position);
  });
  
  // Symbol change
  document.getElementById('symbol').addEventListener('change', function() {
    state.symbol = this.value;
    document.getElementById('market-symbol-badge').textContent = state.symbol.replace('USDT', '/USDT');
    document.getElementById('market-symbol').textContent = state.symbol.replace('USDT', '/USDT');
    
    if (state.isRunning) {
      resetTrading();
      startTrading();
    } else {
      initializeTradingViewChart();
    }
  });
  
  // Timeframe change
  document.getElementById('timeframe').addEventListener('change', function() {
    state.timeframe = this.value;
    
    if (state.isRunning) {
      resetTrading();
      startTrading();
    } else {
      initializeTradingViewChart();
    }
  });
  
  // Strategy parameter changes
  document.getElementById('bb-length').addEventListener('input', function() {
    const value = parseInt(this.value);
    activeStrategy.setParameters({ bbLength: value });
    document.getElementById('bb-length-value').textContent = value;
  });
  
  document.getElementById('bb-dev').addEventListener('input', function() {
    const value = parseFloat(this.value);
    activeStrategy.setParameters({ bbDeviation: value });
    document.getElementById('bb-dev-value').textContent = value;
  });
  
  document.getElementById('volume-candles').addEventListener('input', function() {
    const value = parseInt(this.value);
    activeStrategy.setParameters({ volumeCandles: value });
    document.getElementById('volume-candles-value').textContent = value;
  });
  
  document.getElementById('volume-increase').addEventListener('input', function() {
    const value = parseInt(this.value);
    activeStrategy.setParameters({ volumeIncrease: value });
    document.getElementById('volume-increase-value').textContent = value;
  });
  
  // Account settings changes
  document.getElementById('initial-capital').addEventListener('change', function() {
    state.initialCapital = parseFloat(this.value);
    if (!state.isRunning) {
      state.balance = state.initialCapital;
      updatePerformanceMetrics();
    }
  });
  
  document.getElementById('position-size').addEventListener('input', function() {
    const value = parseInt(this.value);
    state.settings.positionSize = value;
    positionManager.setSettings({ positionSize: value });
    document.getElementById('position-size-value').textContent = value + '%';
  });
  
  // Risk management toggles
  document.getElementById('take-profit-toggle').addEventListener('change', function() {
    state.settings.useTakeProfit = this.checked;
    document.getElementById('take-profit-value').disabled = !this.checked;
    positionManager.setSettings({ useTakeProfit: this.checked });
  });
  
  document.getElementById('take-profit-value').addEventListener('change', function() {
    const value = parseFloat(this.value);
    state.settings.takeProfitPct = value;
    positionManager.setSettings({ takeProfitPct: value });
  });
  
  document.getElementById('stop-loss-toggle').addEventListener('change', function() {
    state.settings.useStopLoss = this.checked;
    document.getElementById('stop-loss-value').disabled = !this.checked;
    positionManager.setSettings({ useStopLoss: this.checked });
  });
  
  document.getElementById('stop-loss-value').addEventListener('change', function() {
    const value = parseFloat(this.value);
    state.settings.stopLossPct = value;
    positionManager.setSettings({ stopLossPct: value });
  });
  
  document.getElementById('trailing-stop-toggle').addEventListener('change', function() {
    state.settings.useTrailingStop = this.checked;
    document.getElementById('trailing-stop-value').disabled = !this.checked;
    positionManager.setSettings({ useTrailingStop: this.checked });
  });
  
  document.getElementById('trailing-stop-value').addEventListener('change', function() {
    const value = parseFloat(this.value);
    state.settings.trailingStopPct = value;
    positionManager.setSettings({ trailingStopPct: value });
  });
  
  document.getElementById('auto-trade-toggle').addEventListener('change', function() {
    state.settings.autoTrade = this.checked;
  });
  
  document.getElementById('show-position-lines-toggle').addEventListener('change', function() {
    state.settings.showPositionLines = this.checked;
    
    if (!this.checked && document.getElementById('floating-position-indicator')) {
      document.getElementById('floating-position-indicator').style.display = 'none';
    } else if (this.checked && positionManager.currentPosition) {
      uiManager.updatePositionInfo(positionManager.currentPosition);
    }
  });
  
  // API settings
  document.getElementById('save-api-btn').addEventListener('click', function() {
    const apiKey = document.getElementById('api-key').value;
    const apiSecret = document.getElementById('api-secret').value;
    
    if (apiKey && apiKey !== '********') {
      state.settings.apiKey = apiKey;
    }
    
    if (apiSecret && apiSecret !== '********') {
      state.settings.apiSecret = apiSecret;
    }
    
    state.settings.useTestnet = document.getElementById('use-testnet-toggle').checked;
    apiClient.setEnvironment(state.settings.useTestnet);
    
    // Store credentials in secure storage
    if (state.settings.apiKey && state.settings.apiSecret) {
      secureStorage.storeCredentials(state.settings.apiKey, state.settings.apiSecret)
        .then(() => {
          uiManager.addLogMessage('API credentials stored securely');
        })
        .catch(error => {
          uiManager.addLogMessage(`Error storing API credentials: ${error.message}`, false, true);
        });
    }
    
    saveSettings();
    checkApiConfiguration();
  });
  
  document.getElementById('test-api-btn').addEventListener('click', function() {
    testApiConnection();
  });
  
  // Notification settings
  document.getElementById('browser-notifications-toggle').addEventListener('change', function() {
    state.settings.browserNotifications = this.checked;
    uiManager.setNotificationSettings({ browserNotifications: this.checked });
  });
  
  document.getElementById('sound-notifications-toggle').addEventListener('change', function() {
    state.settings.soundNotifications = this.checked;
    uiManager.setNotificationSettings({ soundNotifications: this.checked });
  });
  
  document.getElementById('discord-notifications-toggle').addEventListener('change', function() {
    state.settings.discordNotifications = this.checked;
    document.getElementById('discord-webhook').disabled = !this.checked;
    uiManager.setNotificationSettings({ discordNotifications: this.checked });
  });
  
  document.getElementById('discord-webhook').addEventListener('change', function() {
    state.settings.discordWebhook = this.value;
    uiManager.setNotificationSettings({ discordWebhook: this.value });
  });
  
  document.getElementById('test-discord-btn').addEventListener('click', function() {
    testDiscordWebhook();
  });
  
  // Save all settings
  document.getElementById('save-settings-btn').addEventListener('click', function() {
    saveSettings();
  });
  
  // Trading mode buttons
  document.getElementById('paper-trading-btn').addEventListener('click', function() {
    if (state.isLiveTrading) {
      uiManager.showStatusBar('Please stop live trading first', 'warning');
      return;
    }
    
    this.classList.add('active');
    document.getElementById('live-trading-btn').classList.remove('active');
    state.isLiveTrading = false;
    
    document.getElementById('practice-mode-indicator').style.display = 'flex';
    document.getElementById('live-mode-indicator').style.display = 'none';
    
    document.getElementById('paper-trading-buttons').style.display = 'flex';
    document.getElementById('live-trading-buttons').style.display = 'none';
    
    uiManager.addLogMessage('Switched to paper trading mode');
  });
  
  document.getElementById('live-trading-btn').addEventListener('click', function() {
    if (!checkApiConfiguration(true)) {
      return;
    }
    
    this.classList.add('active');
    document.getElementById('paper-trading-btn').classList.remove('active');
    state.isLiveTrading = true;
    
    document.getElementById('practice-mode-indicator').style.display = 'none';
    document.getElementById('live-mode-indicator').style.display = 'flex';
    
    document.getElementById('paper-trading-buttons').style.display = 'none';
    document.getElementById('live-trading-buttons').style.display = 'flex';
    
    uiManager.addLogMessage('Switched to live trading mode', false, true);
  });
  
  // Trading buttons
  document.getElementById('start-trading-btn').addEventListener('click', function() {
    startTrading();
  });
  
  document.getElementById('stop-trading-btn').addEventListener('click', function() {
    stopTrading();
  });
  
  document.getElementById('reset-trading-btn').addEventListener('click', function() {
    resetTrading();
  });
  
  document.getElementById('start-live-trading-btn').addEventListener('click', function() {
    if (!checkApiConfiguration(true)) {
      return;
    }
    
    startTrading(true);
  });
  
  document.getElementById('stop-live-trading-btn').addEventListener('click', function() {
    stopTrading();
  });
  
  // Position close button
  document.getElementById('position-close-btn').addEventListener('click', function() {
    if (positionManager.currentPosition) {
      closePosition('Manual close');
      uiManager.addLogMessage(`Position manually closed at $${state.currentPrice.toFixed(2)}`);
    }
  });
  
  // Widget panel toggle
  document.getElementById('widget-panel-toggle').addEventListener('click', function() {
    document.getElementById('widget-panel').classList.toggle('open');
  });
  
  // Sidebar toggle
  document.getElementById('sidebar-toggle').addEventListener('click', function() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('sidebar-collapsed');
    this.classList.toggle('collapsed');
    
    if (sidebar.classList.contains('sidebar-collapsed')) {
      this.innerHTML = '<i class="fas fa-chevron-right"></i>';
    } else {
      this.innerHTML = '<i class="fas fa-chevron-left"></i>';
    }
  });
  
  // Refresh widgets button
  document.getElementById('refresh-widgets-btn').addEventListener('click', function() {
    updateMarketInfo();
    updatePerformanceMetrics();
  });
  
  // API Configuration Modal handlers
  document.getElementById('closeApiConfigModal').addEventListener('click', function() {
    document.getElementById('apiConfigModal').style.display = 'none';
  });

  document.getElementById('cancelApiConfig').addEventListener('click', function() {
    document.getElementById('apiConfigModal').style.display = 'none';
  });

  document.getElementById('saveApiConfig').addEventListener('click', function() {
    const apiKey = document.getElementById('modal-api-key').value;
    const apiSecret = document.getElementById('modal-api-secret').value;
    const useTestnet = document.getElementById('modal-use-testnet-toggle').checked;
    
    if (apiKey && apiSecret) {
      state.settings.apiKey = apiKey;
      state.settings.apiSecret = apiSecret;
      state.settings.useTestnet = useTestnet;
      
      // Update API client
      apiClient.setEnvironment(useTestnet);
      
      // Store credentials securely
      secureStorage.storeCredentials(apiKey, apiSecret);
      
      // Update sidebar inputs
      document.getElementById('api-key').value = '********';
      document.getElementById('api-secret').value = '********';
      document.getElementById('use-testnet-toggle').checked = useTestnet;
      
      saveSettings();
      document.getElementById('apiConfigModal').style.display = 'none';
      uiManager.showStatusBar('API configuration saved', 'success');
    } else {
      uiManager.showStatusBar('Please enter API Key and Secret', 'error');
    }
  });

  // Log toggle
  document.getElementById('log-toggle-btn').addEventListener('click', function() {
    document.getElementById('log-container').classList.toggle('open');
  });
  
  // Export data button
  document.getElementById('export-data-btn').addEventListener('click', function() {
    const csvData = positionManager.exportHistoryToCSV();
    uiManager.exportToFile(csvData, `volty-trading-history-${new Date().toISOString().slice(0, 10)}.csv`);
    uiManager.showStatusBar('Trading history exported to CSV', 'success');
  });
}

/**
 * Check API configuration
 * @param {boolean} showAlert - Whether to show alert if configuration is missing
 * @returns {boolean} - Whether API is configured
 */
function checkApiConfiguration(showAlert = false) {
  return secureStorage.hasCredentials() || (
    state.settings.apiKey && 
    state.settings.apiSecret && 
    state.settings.apiKey.length > 0 && 
    state.settings.apiSecret.length > 0
  ) || (() => {
    if (showAlert) {
      uiManager.showStatusBar('Please configure API keys first', 'warning');
      document.getElementById('apiConfigModal').style.display = 'flex';
    }
    return false;
  })();
}

/**
 * Test API connection
 */
async function testApiConnection() {
  if (!checkApiConfiguration(true)) {
    return;
  }
  
  uiManager.addLogMessage('Testing API connection...');
  uiManager.showStatusBar('Testing API connection...', 'info');
  
  try {
    await apiClient.ping();
    uiManager.addLogMessage('API connection successful', true);
    uiManager.showStatusBar('API connection successful', 'success');
  } catch (error) {
    uiManager.addLogMessage(`API connection failed: ${error.message}`, false, true);
    uiManager.showStatusBar('API connection failed', 'error');
  }
}

/**
 * Test Discord webhook
 */
async function testDiscordWebhook() {
  if (!state.settings.discordNotifications) {
    uiManager.showStatusBar('Discord notifications are disabled', 'warning');
    return;
  }
  
  if (!state.settings.discordWebhook) {
    uiManager.showStatusBar('Please enter Discord webhook URL', 'warning');
    return;
  }
  
  uiManager.addLogMessage('Testing Discord webhook...');
  uiManager.showStatusBar('Sending test message to Discord...', 'info');
  
  try {
    await uiManager.sendDiscordNotification('Volty Trading Bot - Test Message');
    uiManager.addLogMessage('Discord webhook test message sent', true);
    uiManager.showStatusBar('Discord test message sent', 'success');
  } catch (error) {
    uiManager.addLogMessage(`Discord webhook test failed: ${error.message}`, false, true);
    uiManager.showStatusBar('Discord webhook test failed', 'error');
  }
}

/**
 * Update clock display
 */
function updateClock() {
  uiManager.updateClock();
}

/**
 * Start the trading bot
 * @param {boolean} isLive - Whether to use live trading
 */
async function startTrading(isLive = false) {
  if (state.isRunning) {
    uiManager.showStatusBar('Trading is already running', 'info');
    return;
  }
  
  if (isLive && !checkApiConfiguration(true)) {
    return;
  }
  
  state.isRunning = true;
  state.isLiveTrading = isLive;
  state.status = 'running';
  
  // Update UI
  uiManager.updateStatus({
    isRunning: true,
    isLiveTrading: isLive,
    statusText: `${isLive ? 'Live' : 'Paper'} trading started on ${state.symbol} (${state.timeframe})`,
    activityType: 'scanning'
  });
  
  // Log the start
  if (isLive) {
    uiManager.addLogMessage(`Live trading started on ${state.symbol} (${state.timeframe})`, false, true);
    uiManager.sendNotification('Volty Trading Bot', 'Live trading started', 'start');
  } else {
    uiManager.addLogMessage(`Paper trading started on ${state.symbol} (${state.timeframe})`);
  }
  
  // Fetch initial data
  try {
    await fetchMarketData();
    
    // Start the trading loop
    runTradingLoop();
  } catch (error) {
    uiManager.addLogMessage(`Error starting trading: ${error.message}`, false, true);
    stopTrading();
    uiManager.showStatusBar(`Error starting trading: ${error.message}`, 'error');
  }
}

/**
 * Stop the trading bot
 */
function stopTrading() {
  if (!state.isRunning) {
    return;
  }
  
  state.isRunning = false;
  state.status = 'idle';
  
  // Update UI
  uiManager.updateStatus({
    isRunning: false,
    isLiveTrading: state.isLiveTrading,
    statusText: 'Trading stopped',
    activityType: 'waiting'
  });
  
  // Log the stop
  if (state.isLiveTrading) {
    uiManager.addLogMessage('Live trading stopped', false, true);
    uiManager.sendNotification('Volty Trading Bot', 'Live trading stopped');
  } else {
    uiManager.addLogMessage('Paper trading stopped');
  }
}

/**
 * Reset trading state
 */
function resetTrading() {
  if (state.isRunning) {
    stopTrading();
  }
  
  // Reset state
  state.balance = state.initialCapital;
  state.priceData = [];
  state.volumeData = [];
  
  // Close any open position
  if (positionManager.currentPosition) {
    positionManager.closePosition(state.currentPrice, 'Reset');
  }
  
  // Update UI
  updatePerformanceMetrics();
  
  // Log the reset
  uiManager.addLogMessage('Trading state reset');
  uiManager.updateStatus({
    isRunning: false,
    isLiveTrading: state.isLiveTrading,
    statusText: 'Trading state reset. Ready to start.',
    activityType: 'waiting'
  });
  
  uiManager.showStatusBar('Trading state reset', 'info');
}

/**
 * Close current position
 * @param {string} reason - Reason for closing
 */
async function closePosition(reason) {
  if (!positionManager.currentPosition) return;
  
  try {
    // If in live trading mode, place an actual order
    if (state.isLiveTrading) {
      const position = positionManager.currentPosition;
      const side = position.type === 'LONG' ? 'SELL' : 'BUY';
      
      uiManager.addLogMessage(`Placing ${side} order to close position...`);
      
      const order = await apiClient.placeOrder(
        state.symbol,
        side,
        'MARKET',
        position.size
      );
      
      // Use the actual execution price from the order if available
      if (order.price) {
        state.currentPrice = parseFloat(order.price);
      }
      
      // Close the position with order details
      positionManager.closePosition(state.currentPrice, reason, order);
    } else {
      // Close position with current price for paper trading
      positionManager.closePosition(state.currentPrice, reason);
    }
    
    // Update balance
    state.balance = state.initialCapital + 
      positionManager.positionHistory.reduce((sum, pos) => sum + pos.pnl.realized, 0);
    
  } catch (error) {
    uiManager.addLogMessage(`Error closing position: ${error.message}`, false, true);
    uiManager.showStatusBar(`Error closing position: ${error.message}`, 'error');
  }
}

/**
 * Open a new position
 * @param {string} type - Position type ('LONG' or 'SHORT')
 */
async function openPosition(type) {
  try {
    // Close existing position if any
    if (positionManager.currentPosition) {
      await closePosition('New signal');
    }
    
    // Calculate position size
    const positionValue = state.balance * positionManager.settings.positionSize / 100;
    const positionSize = positionValue / state.currentPrice;
    
    // If in live trading mode, place an actual order
    if (state.isLiveTrading) {
      const side = type === 'LONG' ? 'BUY' : 'SELL';
      
      uiManager.addLogMessage(`Placing ${side} order to open ${type} position...`);
      
      const order = await apiClient.placeOrder(
        state.symbol,
        side,
        'MARKET',
        positionSize
      );
      
      // Use the actual execution price from the order if available
      if (order.price) {
        state.currentPrice = parseFloat(order.price);
      }
      
      // Create position with order details
      positionManager.openPosition(type, state.currentPrice, positionSize, order);
    } else {
      // Create position for paper trading
      positionManager.openPosition(type, state.currentPrice, positionSize);
    }
    
    // Notify
    if (state.isLiveTrading) {
      uiManager.sendNotification(
        'Position Opened',
        `${type} opened at $${state.currentPrice.toFixed(2)}`,
        'open'
      );
    }
  } catch (error) {
    uiManager.addLogMessage(`Error opening position: ${error.message}`, false, true);
    uiManager.showStatusBar(`Error opening position: ${error.message}`, 'error');
  }
}

/**
 * Fetch market data from the exchange
 */
async function fetchMarketData() {
  try {
    uiManager.updateStatus({
      isRunning: state.isRunning,
      isLiveTrading: state.isLiveTrading,
      statusText: 'Fetching market data...',
      activityType: state.isRunning ? 'scanning' : 'waiting'
    });
    
    // Get klines data from the exchange
    const klines = await apiClient.getKlines(state.symbol, state.timeframe);
    
    // Process klines data
    state.priceData = [];
    state.volumeData = [];
    
    klines.forEach(candle => {
      // Klines data format: [open time, open, high, low, close, volume, ...]
      const closePrice = parseFloat(candle[4]);
      const volume = parseFloat(candle[5]);
      
      state.priceData.push(closePrice);
      state.volumeData.push(volume);
    });
    
    // Update current price (last candle)
    if (state.priceData.length > 0) {
      state.currentPrice = state.priceData[state.priceData.length - 1];
    }
    
    // Update market info
    updateMarketInfo();
    
    // Update position info if exists
    if (positionManager.currentPosition) {
      positionManager.updatePosition(state.currentPrice);
    }
    
    uiManager.updateStatus({
      isRunning: state.isRunning,
      isLiveTrading: state.isLiveTrading,
      statusText: 'Market data updated',
      activityType: state.isRunning ? 'scanning' : 'waiting'
    });
    
    return true;
  } catch (error) {
    uiManager.addLogMessage(`Error fetching market data: ${error.message}`, false, true);
    uiManager.updateStatus({
      isRunning: state.isRunning,
      isLiveTrading: state.isLiveTrading,
      statusText: 'Error fetching market data',
      activityType: 'waiting'
    });
    
    throw error;
  }
}

/**
 * Update market info display
 */
function updateMarketInfo() {
  if (state.priceData.length > 0) {
    const currentPrice = state.currentPrice;
    const previousPrice = state.priceData[state.priceData.length - 2] || currentPrice;
    const volume = state.volumeData[state.volumeData.length - 1];
    const lastUpdate = new Date().toLocaleTimeString();
    
    uiManager.updateMarketInfo({
      currentPrice,
      previousPrice,
      volume,
      lastUpdate
    });
  }
}

/**
 * Update performance metrics
 */
function updatePerformanceMetrics() {
  const metrics = positionManager.getPerformanceMetrics(state.initialCapital);
  
  // Calculate daily stats
  const today = new Date().toDateString();
  const todayTrades = positionManager.positionHistory.filter(
    p => p.exitTime && new Date(p.exitTime).toDateString() === today
  );
  const todayPnl = todayTrades.reduce((sum, p) => sum + p.pnl.realized, 0);
  
  // Add daily stats to metrics
  metrics.todayTrades = todayTrades.length;
  metrics.todayPnl = todayPnl;
  
  uiManager.updatePerformanceMetrics(metrics);
}

/**
 * Main trading loop
 */
async function runTradingLoop() {
  if (!state.isRunning) return;
  
  try {
    // Update the last check time
    state.lastUpdate = new Date();
    
    // Fetch fresh market data
    await fetchMarketData();
    
    // Check position status if exists
    if (positionManager.currentPosition) {
      const closeSignal = positionManager.updatePosition(state.currentPrice);
      
      if (closeSignal && closeSignal.should) {
        await closePosition(closeSignal.reason);
      }
    }
    
    // Generate trading signals
    if (state.settings.autoTrade) {
      generateTradingSignals();
    }
    
    // Update UI
    updatePerformanceMetrics();
    
    // Continue the loop
    const timeframe = state.timeframe;
    let interval = 5000; // Default 5 seconds
    
    if (timeframe === '1m') interval = 5000;
    else if (timeframe === '5m') interval = 10000;
    else if (timeframe === '15m') interval = 15000;
    else if (timeframe === '30m') interval = 20000;
    else if (timeframe === '1h') interval = 25000;
    else if (timeframe === '4h') interval = 30000;
    else if (timeframe === '1d') interval = 35000;
    
    // Schedule next update
    uiManager.updateStatus({
      isRunning: state.isRunning,
      isLiveTrading: state.isLiveTrading,
      statusText: `Analyzing market data... Next update in ${interval/1000}s`,
      activityType: 'scanning'
    });
    
    setTimeout(runTradingLoop, interval);
  } catch (error) {
    uiManager.addLogMessage(`Error in trading loop: ${error.message}`, false, true);
    uiManager.updateStatus({
      isRunning: state.isRunning,
      isLiveTrading: state.isLiveTrading,
      statusText: 'Trading error occurred',
      activityType: 'waiting'
    });
    
    // Try to continue after a delay
    setTimeout(() => {
      if (state.isRunning) {
        uiManager.addLogMessage('Attempting to resume trading loop...', false, true);
        runTradingLoop();
      }
    }, 30000); // Wait 30 seconds before retry
  }
}

/**
 * Generate trading signals based on strategy
 */
function generateTradingSignals() {
  const signal = activeStrategy.generateSignal(state.priceData, state.volumeData);
  
  if (signal) {
    uiManager.updateStatus({
      isRunning: state.isRunning,
      isLiveTrading: state.isLiveTrading,
      statusText: `${signal.type} signal detected: ${signal.reason}`,
      activityType: 'trading'
    });
    
    uiManager.addLogMessage(`Trading signal: ${signal.type} at $${signal.price.toFixed(2)} (Confidence: ${signal.confidence}%)`, true);
    
    if (positionManager.currentPosition) {
      if (positionManager.currentPosition.type !== signal.type) {
        // Reversal signal
        openPosition(signal.type);
      }
    } else {
      // New position
      openPosition(signal.type);
    }
  }
}

/**
 * Initialize TradingView chart
 */
async function initializeTradingViewChart() {
  try {
    // Find container
    const container = document.querySelector('.tradingview-widget-container__widget');
    if (!container) {
      throw new Error('Chart container not found');
    }
    
    // Reset the container to ensure no residual elements
    container.innerHTML = '';
    
    // Set up TradingView chart with iframe approach
    const symbol = state.symbol || 'BTCUSDT';
    const interval = state.timeframe || '1h';
    
    // Create iframe element
    const iframe = document.createElement('iframe');
    iframe.id = 'tradingview_chart_frame';
    iframe.src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart_frame&symbol=BINANCE:${symbol}&interval=${interval}&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=1&timezone=Etc%2FUTC&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en&utm_source=voltybot&utm_medium=widget&utm_campaign=chart`;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.margin = '0';
    iframe.style.padding = '0';
    iframe.frameBorder = '0';
    iframe.allowTransparency = 'true';
    iframe.scrolling = 'no';
    iframe.allowFullscreen = true;
    
    // Append iframe to container
    container.appendChild(iframe);
    
    // Set up event listener to detect when chart is loaded
    return new Promise((resolve, reject) => {
      iframe.onload = () => {
        uiManager.addLogMessage(`Chart initialized for ${symbol} (${interval})`);
        
        // Fix UI overlays after chart loads
        setTimeout(uiManager.fixUIOverlays, 500);
        resolve();
      };
      
      iframe.onerror = () => {
        reject(new Error('Failed to load TradingView chart'));
      };
      
      // Set a timeout in case the iframe never loads
      setTimeout(() => {
        if (!iframe.contentWindow || !iframe.contentWindow.document.body) {
          reject(new Error('TradingView chart loading timeout'));
        }
      }, 10000);
    });
  } catch (error) {
    uiManager.addLogMessage('Error initializing chart: ' + error.message, false, true);
    throw error;
  }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);

// Export key objects for debugging
window.voltyBot = {
  state,
  apiClient,
  positionManager,
  strategies,
  activeStrategy,
  uiManager
};
