/**
 * Volty Trading Bot v2.0.0
 * Main Application Module
 * 
 * Copyright (c) 2025 Volty Trading
 * All rights reserved.
 * 
 * Last updated: 2025-06-15
 */

import { ExchangeAPIClient } from './api-client.js';
import { cryptoDataService } from './crypto-data-service.js';
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
 * Helper function to safely add event listeners to DOM elements
 * @param {string} id - Element ID
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @returns {boolean} - Whether the event listener was added successfully
 */
function safeAddEventListener(id, event, handler) {
  const element = document.getElementById(id);
  if (element) {
    element.addEventListener(event, handler);
    return true;
  }
  console.warn(`Element with ID "${id}" not found for event "${event}"`);
  return false;
}

/**
 * Initialize application
 */
async function initialize() {
  try {
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
    await initializeTradingViewChart();
    
    // Hide loading indicator after chart is loaded
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    
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
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    
    uiManager.addLogMessage(`Initialization error: ${error.message}`, false, true);
    uiManager.showStatusBar(`Initialization error: ${error.message}`, 'error');
    console.error('Initialization error:', error);
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
      console.error('Error loading settings:', error);
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
    console.error('Error saving settings:', error);
  }
}

/**
 * Update UI elements from current settings
 */
function updateUIFromSettings() {
  try {
    // Update strategy parameters
    const bbLength = document.getElementById('bb-length');
    const bbLengthValue = document.getElementById('bb-length-value');
    const bbDev = document.getElementById('bb-dev');
    const bbDevValue = document.getElementById('bb-dev-value');
    const volumeCandles = document.getElementById('volume-candles');
    const volumeCandlesValue = document.getElementById('volume-candles-value');
    const volumeIncrease = document.getElementById('volume-increase');
    const volumeIncreaseValue = document.getElementById('volume-increase-value');
    
    if (bbLength) bbLength.value = activeStrategy.parameters.bbLength;
    if (bbLengthValue) bbLengthValue.textContent = activeStrategy.parameters.bbLength;
    if (bbDev) bbDev.value = activeStrategy.parameters.bbDeviation;
    if (bbDevValue) bbDevValue.textContent = activeStrategy.parameters.bbDeviation;
    if (volumeCandles) volumeCandles.value = activeStrategy.parameters.volumeCandles;
    if (volumeCandlesValue) volumeCandlesValue.textContent = activeStrategy.parameters.volumeCandles;
    if (volumeIncrease) volumeIncrease.value = activeStrategy.parameters.volumeIncrease;
    if (volumeIncreaseValue) volumeIncreaseValue.textContent = activeStrategy.parameters.volumeIncrease;
    
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
    const initialCapital = document.getElementById('initial-capital');
    const positionSize = document.getElementById('position-size');
    const positionSizeValue = document.getElementById('position-size-value');
    
    if (initialCapital) initialCapital.value = state.initialCapital;
    if (positionSize) positionSize.value = state.settings.positionSize;
    if (positionSizeValue) positionSizeValue.textContent = state.settings.positionSize + '%';
    
    // Update risk management settings
    const takeProfitToggle = document.getElementById('take-profit-toggle');
    const takeProfitValue = document.getElementById('take-profit-value');
    const stopLossToggle = document.getElementById('stop-loss-toggle');
    const stopLossValue = document.getElementById('stop-loss-value');
    const trailingStopToggle = document.getElementById('trailing-stop-toggle');
    const trailingStopValue = document.getElementById('trailing-stop-value');
    const autoTradeToggle = document.getElementById('auto-trade-toggle');
    const showPositionLinesToggle = document.getElementById('show-position-lines-toggle');
    
    if (takeProfitToggle) takeProfitToggle.checked = state.settings.useTakeProfit;
    if (takeProfitValue) {
      takeProfitValue.value = state.settings.takeProfitPct;
      takeProfitValue.disabled = !state.settings.useTakeProfit;
    }
    
    if (stopLossToggle) stopLossToggle.checked = state.settings.useStopLoss;
    if (stopLossValue) {
      stopLossValue.value = state.settings.stopLossPct;
      stopLossValue.disabled = !state.settings.useStopLoss;
    }
    
    if (trailingStopToggle) trailingStopToggle.checked = state.settings.useTrailingStop;
    if (trailingStopValue) {
      trailingStopValue.value = state.settings.trailingStopPct;
      trailingStopValue.disabled = !state.settings.useTrailingStop;
    }
    
    if (autoTradeToggle) autoTradeToggle.checked = state.settings.autoTrade;
    if (showPositionLinesToggle) showPositionLinesToggle.checked = state.settings.showPositionLines;
    
    // Update API settings
    const apiKey = document.getElementById('api-key');
    const apiSecret = document.getElementById('api-secret');
    const useTestnetToggle = document.getElementById('use-testnet-toggle');
    
    if (apiKey) apiKey.value = state.settings.apiKey ? '********' : '';
    if (apiSecret) apiSecret.value = state.settings.apiSecret ? '********' : '';
    if (useTestnetToggle) useTestnetToggle.checked = state.settings.useTestnet;
    
    // Update notification settings
    const browserNotificationsToggle = document.getElementById('browser-notifications-toggle');
    const soundNotificationsToggle = document.getElementById('sound-notifications-toggle');
    const discordNotificationsToggle = document.getElementById('discord-notifications-toggle');
    const discordWebhook = document.getElementById('discord-webhook');
    
    if (browserNotificationsToggle) browserNotificationsToggle.checked = state.settings.browserNotifications;
    if (soundNotificationsToggle) soundNotificationsToggle.checked = state.settings.soundNotifications;
    if (discordNotificationsToggle) discordNotificationsToggle.checked = state.settings.discordNotifications;
    if (discordWebhook) {
      discordWebhook.value = state.settings.discordWebhook;
      discordWebhook.disabled = !state.settings.discordNotifications;
    }
    
    // Update market info
    const marketSymbolBadge = document.getElementById('market-symbol-badge');
    const marketSymbol = document.getElementById('market-symbol');
    
    if (marketSymbolBadge) marketSymbolBadge.textContent = state.symbol.replace('USDT', '/USDT');
    if (marketSymbol) marketSymbol.textContent = state.symbol.replace('USDT', '/USDT');
    
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
  } catch (error) {
    console.error('Error updating UI from settings:', error);
    uiManager.addLogMessage('Error updating UI: ' + error.message, false, true);
  }
}

/**
 * Set up event listeners for UI elements
 */
function setupEventListeners() {
  try {
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
    safeAddEventListener('symbol', 'change', function() {
      state.symbol = this.value;
      
      const symbolBadge = document.getElementById('market-symbol-badge');
      const marketSymbol = document.getElementById('market-symbol');
      
      if (symbolBadge) symbolBadge.textContent = state.symbol.replace('USDT', '/USDT');
      if (marketSymbol) marketSymbol.textContent = state.symbol.replace('USDT', '/USDT');
      
      if (state.isRunning) {
        resetTrading();
        startTrading();
      } else {
        initializeTradingViewChart();
      }
    });
    
    // Timeframe change
    safeAddEventListener('timeframe', 'change', function() {
      state.timeframe = this.value;
      
      if (state.isRunning) {
        resetTrading();
        startTrading();
      } else {
        initializeTradingViewChart();
      }
    });
    
    // Strategy parameter changes
    safeAddEventListener('bb-length', 'input', function() {
      const value = parseInt(this.value);
      activeStrategy.setParameters({ bbLength: value });
      
      const valueDisplay = document.getElementById('bb-length-value');
      if (valueDisplay) valueDisplay.textContent = value;
    });
    
    safeAddEventListener('bb-dev', 'input', function() {
      const value = parseFloat(this.value);
      activeStrategy.setParameters({ bbDeviation: value });
      
      const valueDisplay = document.getElementById('bb-dev-value');
      if (valueDisplay) valueDisplay.textContent = value;
    });
    
    safeAddEventListener('volume-candles', 'input', function() {
      const value = parseInt(this.value);
      activeStrategy.setParameters({ volumeCandles: value });
      
      const valueDisplay = document.getElementById('volume-candles-value');
      if (valueDisplay) valueDisplay.textContent = value;
    });
    
    safeAddEventListener('volume-increase', 'input', function() {
      const value = parseInt(this.value);
      activeStrategy.setParameters({ volumeIncrease: value });
      
      const valueDisplay = document.getElementById('volume-increase-value');
      if (valueDisplay) valueDisplay.textContent = value;
    });
    
    // Account settings changes
    safeAddEventListener('initial-capital', 'change', function() {
      state.initialCapital = parseFloat(this.value);
      if (!state.isRunning) {
        state.balance = state.initialCapital;
        updatePerformanceMetrics();
      }
    });
    
    safeAddEventListener('position-size', 'input', function() {
      const value = parseInt(this.value);
      state.settings.positionSize = value;
      positionManager.setSettings({ positionSize: value });
      
      const valueDisplay = document.getElementById('position-size-value');
      if (valueDisplay) valueDisplay.textContent = value + '%';
    });
    
    // Risk management toggles
    safeAddEventListener('take-profit-toggle', 'change', function() {
      state.settings.useTakeProfit = this.checked;
      
      const takeProfitValue = document.getElementById('take-profit-value');
      if (takeProfitValue) takeProfitValue.disabled = !this.checked;
      
      positionManager.setSettings({ useTakeProfit: this.checked });
    });
    
    safeAddEventListener('take-profit-value', 'change', function() {
      const value = parseFloat(this.value);
      state.settings.takeProfitPct = value;
      positionManager.setSettings({ takeProfitPct: value });
    });
    
    safeAddEventListener('stop-loss-toggle', 'change', function() {
      state.settings.useStopLoss = this.checked;
      
      const stopLossValue = document.getElementById('stop-loss-value');
      if (stopLossValue) stopLossValue.disabled = !this.checked;
      
      positionManager.setSettings({ useStopLoss: this.checked });
    });
    
    safeAddEventListener('stop-loss-value', 'change', function() {
      const value = parseFloat(this.value);
      state.settings.stopLossPct = value;
      positionManager.setSettings({ stopLossPct: value });
    });
    
    safeAddEventListener('trailing-stop-toggle', 'change', function() {
      state.settings.useTrailingStop = this.checked;
      
      const trailingStopValue = document.getElementById('trailing-stop-value');
      if (trailingStopValue) trailingStopValue.disabled = !this.checked;
      
      positionManager.setSettings({ useTrailingStop: this.checked });
    });
    
    safeAddEventListener('trailing-stop-value', 'change', function() {
      const value = parseFloat(this.value);
      state.settings.trailingStopPct = value;
      positionManager.setSettings({ trailingStopPct: value });
    });
    
    safeAddEventListener('auto-trade-toggle', 'change', function() {
      state.settings.autoTrade = this.checked;
    });
    
    safeAddEventListener('show-position-lines-toggle', 'change', function() {
      state.settings.showPositionLines = this.checked;
      
      const floatingPositionIndicator = document.getElementById('floating-position-indicator');
      if (!this.checked && floatingPositionIndicator) {
        floatingPositionIndicator.style.display = 'none';
      } else if (this.checked && positionManager.currentPosition) {
        uiManager.updatePositionInfo(positionManager.currentPosition);
      }
    });
    
    // API settings
    safeAddEventListener('save-api-btn', 'click', function() {
      const apiKeyInput = document.getElementById('api-key');
      const apiSecretInput = document.getElementById('api-secret');
      const useTestnetToggle = document.getElementById('use-testnet-toggle');
      
      if (apiKeyInput && apiSecretInput) {
        const apiKey = apiKeyInput.value;
        const apiSecret = apiSecretInput.value;
        
        if (apiKey && apiKey !== '********') {
          state.settings.apiKey = apiKey;
        }
        
        if (apiSecret && apiSecret !== '********') {
          state.settings.apiSecret = apiSecret;
        }
        
        if (useTestnetToggle) {
          state.settings.useTestnet = useTestnetToggle.checked;
          apiClient.setEnvironment(state.settings.useTestnet);
        }
        
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
      }
    });
    
    safeAddEventListener('test-api-btn', 'click', function() {
      testApiConnection();
    });
    
    // Notification settings
    safeAddEventListener('browser-notifications-toggle', 'change', function() {
      state.settings.browserNotifications = this.checked;
      uiManager.setNotificationSettings({ browserNotifications: this.checked });
    });
    
    safeAddEventListener('sound-notifications-toggle', 'change', function() {
      state.settings.soundNotifications = this.checked;
      uiManager.setNotificationSettings({ soundNotifications: this.checked });
    });
    
    safeAddEventListener('discord-notifications-toggle', 'change', function() {
      state.settings.discordNotifications = this.checked;
      
      const discordWebhook = document.getElementById('discord-webhook');
      if (discordWebhook) discordWebhook.disabled = !this.checked;
      
      uiManager.setNotificationSettings({ discordNotifications: this.checked });
    });
    
    safeAddEventListener('discord-webhook', 'change', function() {
      state.settings.discordWebhook = this.value;
      uiManager.setNotificationSettings({ discordWebhook: this.value });
    });
    
    safeAddEventListener('test-discord-btn', 'click', function() {
      testDiscordWebhook();
    });
    
    // Save all settings
    safeAddEventListener('save-settings-btn', 'click', function() {
      saveSettings();
    });
    
    // Trading mode buttons
    safeAddEventListener('paper-trading-btn', 'click', function() {
      if (state.isLiveTrading) {
        uiManager.showStatusBar('Please stop live trading first', 'warning');
        return;
      }
      
      this.classList.add('active');
      
      const liveTrading = document.getElementById('live-trading-btn');
      if (liveTrading) liveTrading.classList.remove('active');
      
      state.isLiveTrading = false;
      
      const practiceMode = document.getElementById('practice-mode-indicator');
      const liveMode = document.getElementById('live-mode-indicator');
      const paperButtons = document.getElementById('paper-trading-buttons');
      const liveButtons = document.getElementById('live-trading-buttons');
      
      if (practiceMode) practiceMode.style.display = 'flex';
      if (liveMode) liveMode.style.display = 'none';
      if (paperButtons) paperButtons.style.display = 'flex';
      if (liveButtons) liveButtons.style.display = 'none';
      
      uiManager.addLogMessage('Switched to paper trading mode');
    });
    
    safeAddEventListener('live-trading-btn', 'click', function() {
      if (!checkApiConfiguration(true)) {
        return;
      }
      
      this.classList.add('active');
      
      const paperTrading = document.getElementById('paper-trading-btn');
      if (paperTrading) paperTrading.classList.remove('active');
      
      state.isLiveTrading = true;
      
      const practiceMode = document.getElementById('practice-mode-indicator');
      const liveMode = document.getElementById('live-mode-indicator');
      const paperButtons = document.getElementById('paper-trading-buttons');
      const liveButtons = document.getElementById('live-trading-buttons');
      
      if (practiceMode) practiceMode.style.display = 'none';
      if (liveMode) liveMode.style.display = 'flex';
      if (paperButtons) paperButtons.style.display = 'none';
      if (liveButtons) liveButtons.style.display = 'flex';
      
      uiManager.addLogMessage('Switched to live trading mode', false, true);
    });
    
    // Trading buttons
    safeAddEventListener('start-trading-btn', 'click', function() {
      startTrading();
    });
    
    safeAddEventListener('stop-trading-btn', 'click', function() {
      stopTrading();
    });
    
    safeAddEventListener('reset-trading-btn', 'click', function() {
      resetTrading();
    });
    
    safeAddEventListener('start-live-trading-btn', 'click', function() {
      if (!checkApiConfiguration(true)) {
        return;
      }
      
      startTrading(true);
    });
    
    safeAddEventListener('stop-live-trading-btn', 'click', function() {
      stopTrading();
    });
    
    // Position close button
    safeAddEventListener('position-close-btn', 'click', function() {
      if (positionManager.currentPosition) {
        closePosition('Manual close');
        uiManager.addLogMessage(`Position manually closed at $${state.currentPrice.toFixed(2)}`);
      }
    });
    
    // Widget panel toggle
    safeAddEventListener('widget-panel-toggle', 'click', function() {
      const widgetPanel = document.getElementById('widget-panel');
      if (widgetPanel) widgetPanel.classList.toggle('open');
    });
    
    // Sidebar toggle
    safeAddEventListener('sidebar-toggle', 'click', function() {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        sidebar.classList.toggle('sidebar-collapsed');
        this.classList.toggle('collapsed');
        
        if (sidebar.classList.contains('sidebar-collapsed')) {
          this.innerHTML = '<i class="fas fa-chevron-right"></i>';
        } else {
          this.innerHTML = '<i class="fas fa-chevron-left"></i>';
        }
      }
    });
    
    // Refresh widgets button
    safeAddEventListener('refresh-widgets-btn', 'click', function() {
      updateMarketInfo();
      updatePerformanceMetrics();
    });
    
    // API Configuration Modal handlers
    safeAddEventListener('closeApiConfigModal', 'click', function() {
      const modal = document.getElementById('apiConfigModal');
      if (modal) modal.style.display = 'none';
    });

    safeAddEventListener('cancelApiConfig', 'click', function() {
      const modal = document.getElementById('apiConfigModal');
      if (modal) modal.style.display = 'none';
    });

    safeAddEventListener('saveApiConfig', 'click', function() {
      const apiKeyInput = document.getElementById('modal-api-key');
      const apiSecretInput = document.getElementById('modal-api-secret');
      const useTestnetToggle = document.getElementById('modal-use-testnet-toggle');
      
      if (apiKeyInput && apiSecretInput && useTestnetToggle) {
        const apiKey = apiKeyInput.value;
        const apiSecret = apiSecretInput.value;
        const useTestnet = useTestnetToggle.checked;
        
        if (apiKey && apiSecret) {
          state.settings.apiKey = apiKey;
          state.settings.apiSecret = apiSecret;
          state.settings.useTestnet = useTestnet;
          
          // Update API client
          apiClient.setEnvironment(useTestnet);
          
          // Store credentials securely
          secureStorage.storeCredentials(apiKey, apiSecret);
          
          // Update sidebar inputs
          const sidebarApiKey = document.getElementById('api-key');
          const sidebarApiSecret = document.getElementById('api-secret');
          const sidebarUseTestnet = document.getElementById('use-testnet-toggle');
          
          if (sidebarApiKey) sidebarApiKey.value = '********';
          if (sidebarApiSecret) sidebarApiSecret.value = '********';
          if (sidebarUseTestnet) sidebarUseTestnet.checked = useTestnet;
          
          saveSettings();
          
          const modal = document.getElementById('apiConfigModal');
          if (modal) modal.style.display = 'none';
          
          uiManager.showStatusBar('API configuration saved', 'success');
        } else {
          uiManager.showStatusBar('Please enter API Key and Secret', 'error');
        }
      }
    });

    // Log toggle
    safeAddEventListener('log-toggle-btn', 'click', function() {
      const logContainer = document.getElementById('log-container');
      if (logContainer) logContainer.classList.toggle('open');
    });
    
    // Export data button
    safeAddEventListener('export-data-btn', 'click', function() {
      const csvData = positionManager.exportHistoryToCSV();
      uiManager.exportToFile(csvData, `volty-trading-history-${new Date().toISOString().slice(0, 10)}.csv`);
      uiManager.showStatusBar('Trading history exported to CSV', 'success');
    });
    
    // Strategy settings modal handlers
    safeAddEventListener('closeStrategyModal', 'click', function() {
      const modal = document.getElementById('strategyModal');
      if (modal) modal.style.display = 'none';
    });
    
    safeAddEventListener('cancelStrategySettings', 'click', function() {
      const modal = document.getElementById('strategyModal');
      if (modal) modal.style.display = 'none';
    });
    
    safeAddEventListener('saveStrategySettings', 'click', function() {
      saveSettings();
      
      const modal = document.getElementById('strategyModal');
      if (modal) modal.style.display = 'none';
      
      uiManager.showStatusBar('Strategy settings saved', 'success');
    });
    
    // Risk management modal handlers
    safeAddEventListener('closeRiskManagementModal', 'click', function() {
      const modal = document.getElementById('riskManagementModal');
      if (modal) modal.style.display = 'none';
    });
    
    safeAddEventListener('cancelRiskSettings', 'click', function() {
      const modal = document.getElementById('riskManagementModal');
      if (modal) modal.style.display = 'none';
    });
    
    safeAddEventListener('saveRiskSettings', 'click', function() {
      saveSettings();
      
      const modal = document.getElementById('riskManagementModal');
      if (modal) modal.style.display = 'none';
      
      uiManager.showStatusBar('Risk management settings saved', 'success');
    });
    
    // Notification settings modal handlers
    safeAddEventListener('closeNotificationsModal', 'click', function() {
      const modal = document.getElementById('notificationsModal');
      if (modal) modal.style.display = 'none';
    });
    
    safeAddEventListener('cancelNotificationSettings', 'click', function() {
      const modal = document.getElementById('notificationsModal');
      if (modal) modal.style.display = 'none';
    });
    
    safeAddEventListener('saveNotificationSettings', 'click', function() {
      saveSettings();
      
      const modal = document.getElementById('notificationsModal');
      if (modal) modal.style.display = 'none';
      
      uiManager.showStatusBar('Notification settings saved', 'success');
    });
  } catch (error) {
    console.error('Error setting up event listeners:', error);
    uiManager.addLogMessage(`Error setting up UI: ${error.message}`, false, true);
  }
}

/**
 * Check API configuration
 * @param {boolean} showAlert - Whether to show alert if configuration is missing
 * @returns {boolean} - Whether API is configured
 */
function checkApiConfiguration(showAlert = false) {
  const hasCredentials = secureStorage.hasCredentials();
  const hasApiKeys = state.settings.apiKey && 
                     state.settings.apiSecret && 
                     state.settings.apiKey.length > 0 && 
                     state.settings.apiSecret.length > 0;
  
  if (hasCredentials || hasApiKeys) {
    return true;
  }
  
  if (showAlert) {
    uiManager.showStatusBar('Please configure API keys first', 'warning');
    const apiConfigModal = document.getElementById('apiConfigModal');
    if (apiConfigModal) apiConfigModal.style.display = 'flex';
  }
  
  return false;
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
    console.error('API connection failed:', error);
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
    await uiManager.sendDiscordNotification('Volty Trading Bot - Test Message from gelimorto2');
    uiManager.addLogMessage('Discord webhook test message sent', true);
    uiManager.showStatusBar('Discord test message sent', 'success');
  } catch (error) {
    uiManager.addLogMessage(`Discord webhook test failed: ${error.message}`, false, true);
    uiManager.showStatusBar('Discord webhook test failed', 'error');
    console.error('Discord webhook test failed:', error);
  }
}

/**
 * Update clock display
 */
function updateClock() {
  const now = new Date();
  const utcString = now.toISOString().replace('T', ' ').substring(0, 19);
  
  const clockDisplay = document.getElementById('clock-display');
  if (clockDisplay) {
    clockDisplay.textContent = utcString + ' UTC';
  }
  
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
    console.error('Error starting trading:', error);
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
    console.error('Error closing position:', error);
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
    console.error('Error opening position:', error);
  }
}

/**
 * Fetch market data using enhanced CoinGecko API
 */
async function fetchMarketData() {
  try {
    console.log(`🔄 [${new Date().toISOString()}] Starting market data fetch for ${state.symbol} (${state.timeframe})`);
    
    uiManager.updateStatus({
      isRunning: state.isRunning,
      isLiveTrading: state.isLiveTrading,
      statusText: 'Fetching market data...',
      activityType: state.isRunning ? 'scanning' : 'waiting'
    });
    
    const startTime = performance.now();
    
    // Try to get klines data using new CoinGecko service first
    let klines;
    try {
      console.log(`📊 Using CoinGecko API for ${state.symbol} data`);
      klines = await cryptoDataService.getKlines(state.symbol, state.timeframe, 100);
      console.log(`✅ CoinGecko API returned ${klines.length} candles`);
    } catch (coinGeckoError) {
      console.warn(`⚠️ CoinGecko API failed, falling back to original API: ${coinGeckoError.message}`);
      uiManager.addLogMessage(`CoinGecko API unavailable, using fallback: ${coinGeckoError.message}`, false, false);
      
      // Fallback to original API client
      klines = await apiClient.getKlines(state.symbol, state.timeframe);
      console.log(`✅ Fallback API returned ${klines.length} candles`);
    }
    
    // Process klines data with verbose logging
    console.log(`🔍 Processing ${klines.length} candles for ${state.symbol}`);
    state.priceData = [];
    state.volumeData = [];
    
    let processedCandles = 0;
    klines.forEach((candle, index) => {
      // Klines data format: [open time, open, high, low, close, volume, ...]
      const closePrice = parseFloat(candle[4]);
      const volume = parseFloat(candle[5]);
      
      if (!isNaN(closePrice) && !isNaN(volume)) {
        state.priceData.push(closePrice);
        state.volumeData.push(volume);
        processedCandles++;
      } else {
        console.warn(`⚠️ Invalid candle data at index ${index}:`, candle);
      }
    });
    
    console.log(`📈 Processed ${processedCandles}/${klines.length} valid candles`);
    
    // Update current price (last candle) with validation
    if (state.priceData.length > 0) {
      const previousPrice = state.currentPrice;
      state.currentPrice = state.priceData[state.priceData.length - 1];
      
      const priceChange = previousPrice > 0 ? 
        ((state.currentPrice - previousPrice) / previousPrice * 100).toFixed(4) : 0;
      
      console.log(`💰 Price update: $${state.currentPrice} (${priceChange > 0 ? '+' : ''}${priceChange}%)`);
    } else {
      console.error('❌ No valid price data received');
      throw new Error('No valid price data received from API');
    }
    
    // Get additional market data for enhanced info
    try {
      console.log(`📊 Fetching additional market data for ${state.symbol}`);
      const marketData = await cryptoDataService.getMarketData(state.symbol);
      
      // Store additional market metrics
      state.marketData = {
        ...marketData,
        dataSource: 'CoinGecko',
        fetchTime: new Date().toISOString()
      };
      
      console.log(`📈 Market data updated:`, {
        price: marketData.currentPrice,
        volume24h: marketData.volume24h,
        change24h: marketData.change24h?.toFixed(2) + '%'
      });
      
    } catch (marketDataError) {
      console.warn(`⚠️ Additional market data fetch failed: ${marketDataError.message}`);
      // Don't fail the whole operation for this
    }
    
    // Update market info display
    updateMarketInfo();
    
    // Update position info if exists
    if (positionManager.currentPosition) {
      console.log(`🔄 Updating position with new price: $${state.currentPrice}`);
      positionManager.updatePosition(state.currentPrice);
    }
    
    const endTime = performance.now();
    const fetchDuration = Math.round(endTime - startTime);
    
    console.log(`✅ Market data fetch completed in ${fetchDuration}ms`);
    uiManager.addLogMessage(`Market data updated: $${state.currentPrice} (${fetchDuration}ms)`, false, false);
    
    uiManager.updateStatus({
      isRunning: state.isRunning,
      isLiveTrading: state.isLiveTrading,
      statusText: `Market data updated (${fetchDuration}ms)`,
      activityType: state.isRunning ? 'scanning' : 'waiting'
    });
    
    return true;
    
  } catch (error) {
    const errorMessage = `Error fetching market data: ${error.message}`;
    console.error(`❌ ${errorMessage}`, error);
    
    uiManager.addLogMessage(errorMessage, false, true);
    uiManager.updateStatus({
      isRunning: state.isRunning,
      isLiveTrading: state.isLiveTrading,
      statusText: 'Error fetching market data',
      activityType: 'waiting'
    });
    
    // Add detailed error logging
    if (error.name === 'CryptoDataError') {
      console.error(`🔍 CryptoDataError details:`, {
        code: error.code,
        isRetryable: error.isRetryable,
        timestamp: error.timestamp
      });
    }
    
    throw error;
  }
}

/**
 * Update market info display with enhanced data
 */
function updateMarketInfo() {
  if (state.priceData.length > 0) {
    const currentPrice = state.currentPrice;
    const previousPrice = state.priceData[state.priceData.length - 2] || currentPrice;
    const volume = state.volumeData[state.volumeData.length - 1] || 0;
    const lastUpdate = new Date().toLocaleTimeString();
    
    // Calculate price change
    const priceChange = previousPrice > 0 ? 
      ((currentPrice - previousPrice) / previousPrice * 100) : 0;
    
    const marketInfo = {
      currentPrice,
      previousPrice,
      volume,
      lastUpdate,
      priceChange: priceChange.toFixed(4),
      dataPoints: state.priceData.length
    };
    
    // Add enhanced market data if available
    if (state.marketData) {
      marketInfo.volume24h = state.marketData.volume24h;
      marketInfo.change24h = state.marketData.change24h;
      marketInfo.high24h = state.marketData.high24h;
      marketInfo.low24h = state.marketData.low24h;
      marketInfo.marketCap = state.marketData.marketCap;
      marketInfo.dataSource = state.marketData.dataSource;
    }
    
    console.log(`📊 Market info updated:`, marketInfo);
    
    uiManager.updateMarketInfo(marketInfo);
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
    
    console.error('Error in trading loop:', error);
    
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
    console.error('Error initializing chart:', error);
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
  uiManager,
  version: '2.0.0',
  currentUser: 'gelimorto2',
  lastUpdated: '2025-06-15 21:23:59'
};
