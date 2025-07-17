/**
 * AI Trading Bot v3.0.0
 * Main AI-powered Application Module
 * 
 * Copyright (c) 2025 AI Trading
 * All rights reserved.
 * 
 * Last updated: 2025-01-13
 */

import { ExchangeAPIClient } from './api-client.js';
import { cryptoDataService } from './crypto-data-service.js';
import { secureStorage } from './secure-storage.js';
import { PositionManager } from './position-manager.js';
import { uiManager } from './ui-manager.js';

// AI Application state
const aiState = {
  // Market data
  symbol: 'BTCUSDT',
  timeframe: '1h',
  currentPrice: 0,
  priceData: [],
  
  // AI Models
  activeModel: null,
  models: new Map(),
  predictions: [],
  modelComparison: null,
  
  // Account and positions
  initialCapital: 10000,
  balance: 10000,
  
  // Settings
  settings: {
    autoTrade: true,
    useAIPredictions: true,
    minConfidence: 0.7,
    predictionTimeframe: '1h',
    modelType: 'random_forest',
    lookbackPeriod: 50,
    selectedFeatures: {
      priceAction: true,
      volume: true,
      rsi: true,
      macd: true,
      bollingerBands: true
    },
    
    // Risk management
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
  isConnected: false,
  isTrading: false,
  lastUpdate: null,
  marketData: {},
  
  // UI elements
  chart: null,
  aiInterface: null,
  modelComparison: null
};

// AI Trading Bot class
class AITradingBot {
  constructor() {
    this.apiClient = new ExchangeAPIClient();
    this.positionManager = new PositionManager();
    this.updateInterval = null;
    this.predictionInterval = null;
    
    this.init();
  }
  
  async init() {
    try {
      await this.initializeUI();
      await this.initializeAI();
      await this.loadSettings();
      await this.setupEventListeners();
      
      console.log('AI Trading Bot initialized successfully');
      this.logMessage('AI Trading Bot v3.0.0 initialized', 'success');
      
    } catch (error) {
      console.error('Failed to initialize AI Trading Bot:', error);
      this.logMessage(`Initialization failed: ${error.message}`, 'error');
    }
  }
  
  async initializeUI() {
    // Initialize custom chart
    if (window.CustomChart) {
      aiState.chart = new window.CustomChart('main-chart');
    }
    
    // Initialize AI interface
    if (window.AIModelInterface) {
      aiState.aiInterface = new window.AIModelInterface();
      await aiState.aiInterface.initializeModels();
      this.populateModelSelector();
    }
    
    // Initialize model comparison
    if (window.ModelComparison) {
      aiState.modelComparison = new window.ModelComparison('model-comparison-content');
      await aiState.modelComparison.initialize();
    }
    
    // Update UI elements
    this.updateSymbolDisplay();
    this.updateTimeframeDisplay();
    this.updateModelStatus();
  }
  
  async initializeAI() {
    // Load default AI models if not already loaded
    const savedModels = localStorage.getItem('aiModels');
    if (!savedModels) {
      await this.createDefaultModels();
    }
    
    // Set default active model
    const defaultModelId = `${aiState.settings.modelType}_${aiState.settings.predictionTimeframe}`;
    if (aiState.aiInterface && aiState.aiInterface.setActiveModel(defaultModelId)) {
      aiState.activeModel = defaultModelId;
      this.updateActiveModelDisplay();
    }
  }
  
  async createDefaultModels() {
    if (!aiState.aiInterface) return;
    
    const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
    const modelTypes = ['random_forest', 'gradient_boosting'];
    
    const models = [];
    for (const timeframe of timeframes) {
      for (const modelType of modelTypes) {
        const modelId = `${modelType}_${timeframe}`;
        models.push({
          id: modelId,
          type: modelType,
          timeframe: timeframe,
          trained: false
        });
      }
    }
    
    localStorage.setItem('aiModels', JSON.stringify(models));
  }
  
  populateModelSelector() {
    const selector = document.getElementById('ai-model-select');
    if (!selector || !aiState.aiInterface) return;
    
    const models = aiState.aiInterface.getModelList();
    selector.innerHTML = '<option value="">Select AI Model</option>';
    
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = `${model.type} (${model.timeframe}) ${model.trained ? '✅' : '❌'}`;
      selector.appendChild(option);
    });
    
    // Set active model
    if (aiState.activeModel) {
      selector.value = aiState.activeModel;
    }
  }
  
  async setupEventListeners() {
    // Symbol and timeframe changes
    const symbolSelect = document.getElementById('symbol');
    const timeframeSelect = document.getElementById('timeframe');
    
    if (symbolSelect) {
      symbolSelect.addEventListener('change', (e) => {
        aiState.symbol = e.target.value;
        this.updateSymbolDisplay();
        this.fetchMarketData();
      });
    }
    
    if (timeframeSelect) {
      timeframeSelect.addEventListener('change', (e) => {
        aiState.timeframe = e.target.value;
        this.updateTimeframeDisplay();
        this.fetchMarketData();
      });
    }
    
    // AI Model controls
    const modelSelect = document.getElementById('ai-model-select');
    const trainBtn = document.getElementById('train-model-btn');
    const predictBtn = document.getElementById('predict-btn');
    const compareBtn = document.getElementById('compare-models-btn');
    
    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        aiState.activeModel = e.target.value;
        this.updateActiveModelDisplay();
      });
    }
    
    if (trainBtn) {
      trainBtn.addEventListener('click', () => this.trainActiveModel());
    }
    
    if (predictBtn) {
      predictBtn.addEventListener('click', () => this.makePrediction());
    }
    
    if (compareBtn) {
      compareBtn.addEventListener('click', () => this.openModelComparison());
    }
    
    // Trading controls
    const startBtn = document.getElementById('start-trading-btn');
    const stopBtn = document.getElementById('stop-trading-btn');
    const resetBtn = document.getElementById('reset-trading-btn');
    
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startTrading());
    }
    
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stopTrading());
    }
    
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetTrading());
    }
    
    // Chart tabs
    const chartTabs = document.querySelectorAll('.chart-tab');
    chartTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchChartTab(e.target.dataset.chart);
      });
    });
    
    // Modal controls
    this.setupModalControls();
  }
  
  setupModalControls() {
    // AI Model Settings Modal
    const strategyModal = document.getElementById('strategyModal');
    const closeStrategyModal = document.getElementById('closeStrategyModal');
    const cancelStrategySettings = document.getElementById('cancelStrategySettings');
    const saveStrategySettings = document.getElementById('saveStrategySettings');
    
    if (closeStrategyModal) {
      closeStrategyModal.addEventListener('click', () => {
        strategyModal.style.display = 'none';
      });
    }
    
    if (cancelStrategySettings) {
      cancelStrategySettings.addEventListener('click', () => {
        strategyModal.style.display = 'none';
      });
    }
    
    if (saveStrategySettings) {
      saveStrategySettings.addEventListener('click', () => this.saveAISettings());
    }
    
    // Model Comparison Modal
    const comparisonModal = document.getElementById('modelComparisonModal');
    const closeComparisonModal = document.getElementById('closeModelComparisonModal');
    const cancelComparison = document.getElementById('cancelModelComparison');
    
    if (closeComparisonModal) {
      closeComparisonModal.addEventListener('click', () => {
        comparisonModal.style.display = 'none';
      });
    }
    
    if (cancelComparison) {
      cancelComparison.addEventListener('click', () => {
        comparisonModal.style.display = 'none';
      });
    }
    
    // Range input updates
    this.setupRangeInputs();
  }
  
  setupRangeInputs() {
    const ranges = [
      { input: 'lookback-period', display: 'lookback-period-value' },
      { input: 'prediction-confidence', display: 'prediction-confidence-value', format: (v) => Math.round(v * 100) + '%' }
    ];
    
    ranges.forEach(({input, display, format}) => {
      const inputEl = document.getElementById(input);
      const displayEl = document.getElementById(display);
      
      if (inputEl && displayEl) {
        inputEl.addEventListener('input', (e) => {
          const value = e.target.value;
          displayEl.textContent = format ? format(value) : value;
        });
      }
    });
  }
  
  async fetchMarketData() {
    try {
      console.log(`🤖 [AI] Starting market data fetch for ${aiState.symbol} (${aiState.timeframe})`);
      this.updateStatus('Fetching market data...');
      
      const startTime = performance.now();
      
      // Use enhanced CoinGecko API for market data
      let klines;
      try {
        console.log(`🤖 [AI] Using CoinGecko API for ${aiState.symbol} data`);
        klines = await cryptoDataService.getKlines(aiState.symbol, aiState.timeframe, 100);
        console.log(`🤖 [AI] CoinGecko API returned ${klines.length} candles`);
      } catch (coinGeckoError) {
        console.warn(`🤖 [AI] CoinGecko API failed, falling back to mock data: ${coinGeckoError.message}`);
        this.logMessage(`CoinGecko API unavailable, using mock data: ${coinGeckoError.message}`, 'warning');
        
        // Use mock data as fallback
        const mockData = this.generateMockData();
        aiState.priceData = mockData;
        
        // Update chart
        if (aiState.chart) {
          aiState.chart.updateCandlestickChart(mockData);
        }
        
        this.updateMarketInfo(mockData);
        this.updateStatus('Market data updated (mock)');
        aiState.lastUpdate = new Date();
        return;
      }
      
      // Convert klines to our format
      console.log(`🤖 [AI] Processing ${klines.length} candles`);
      const formattedData = klines.map(candle => ({
        timestamp: new Date(parseInt(candle[0])),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]) || 0
      }));
      
      // Update AI state
      aiState.priceData = formattedData;
      aiState.currentPrice = formattedData[formattedData.length - 1]?.close || 0;
      
      console.log(`🤖 [AI] Current price: $${aiState.currentPrice}`);
      
      // Get additional market data for AI analysis
      try {
        const marketData = await cryptoDataService.getMarketData(aiState.symbol);
        aiState.marketData = {
          ...marketData,
          dataSource: 'CoinGecko',
          fetchTime: new Date().toISOString()
        };
        
        console.log(`🤖 [AI] Enhanced market data:`, {
          price: marketData.currentPrice,
          volume24h: marketData.volume24h,
          change24h: marketData.change24h?.toFixed(2) + '%'
        });
        
      } catch (marketDataError) {
        console.warn(`🤖 [AI] Enhanced market data fetch failed: ${marketDataError.message}`);
      }
      
      // Update chart
      if (aiState.chart) {
        aiState.chart.updateCandlestickChart(formattedData);
      }
      
      // Update market info
      this.updateMarketInfo(formattedData);
      
      const endTime = performance.now();
      const fetchDuration = Math.round(endTime - startTime);
      
      console.log(`🤖 [AI] Market data fetch completed in ${fetchDuration}ms`);
      this.logMessage(`Market data updated: $${aiState.currentPrice} (${fetchDuration}ms)`, 'success');
      
      this.updateStatus(`Market data updated (${fetchDuration}ms)`);
      aiState.lastUpdate = new Date();
      
    } catch (error) {
      console.error('🤖 [AI] Failed to fetch market data:', error);
      this.logMessage(`Failed to fetch market data: ${error.message}`, 'error');
      
      // Add detailed error logging for AI context
      if (error.name === 'CryptoDataError') {
        console.error(`🤖 [AI] CryptoDataError details:`, {
          code: error.code,
          isRetryable: error.isRetryable,
          timestamp: error.timestamp
        });
      }
    }
  }
  
  generateMockData() {
    const data = [];
    let price = 50000;
    const now = Date.now();
    
    for (let i = 0; i < 100; i++) {
      const timestamp = new Date(now - (100 - i) * 60000); // 1 minute intervals
      const change = (Math.random() - 0.5) * 1000;
      
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * 500;
      const low = Math.min(open, close) - Math.random() * 500;
      const volume = 1000000 + Math.random() * 5000000;
      
      data.push({
        timestamp: timestamp,
        open: open,
        high: high,
        low: low,
        close: close,
        volume: volume
      });
      
      price = close;
    }
    
    aiState.currentPrice = price;
    return data;
  }
  
  async trainActiveModel() {
    if (!aiState.activeModel || !aiState.aiInterface) {
      this.logMessage('No active model selected', 'warning');
      return;
    }
    
    try {
      this.updateStatus('Training AI model...');
      this.logMessage(`Training model: ${aiState.activeModel}`, 'info');
      
      const trainBtn = document.getElementById('train-model-btn');
      if (trainBtn) {
        trainBtn.disabled = true;
        trainBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Training...';
      }
      
      // Get training data
      if (aiState.priceData.length === 0) {
        await this.fetchMarketData();
      }
      
      const result = await aiState.aiInterface.trainModel(aiState.activeModel, aiState.priceData);
      
      if (result.success) {
        this.logMessage(`Model trained successfully. R²: ${result.metrics.val_r2.toFixed(3)}`, 'success');
        this.updateModelStatus();
        this.populateModelSelector(); // Refresh selector with updated status
      } else {
        this.logMessage(`Training failed: ${result.error}`, 'error');
      }
      
    } catch (error) {
      console.error('Training failed:', error);
      this.logMessage(`Training error: ${error.message}`, 'error');
    } finally {
      const trainBtn = document.getElementById('train-model-btn');
      if (trainBtn) {
        trainBtn.disabled = false;
        trainBtn.innerHTML = '<i class="fas fa-brain"></i> Train Model';
      }
      this.updateStatus('Ready');
    }
  }
  
  async makePrediction() {
    if (!aiState.activeModel || !aiState.aiInterface) {
      this.logMessage('No active model selected', 'warning');
      return;
    }
    
    try {
      this.updateStatus('Making AI prediction...');
      this.logMessage('Generating AI prediction...', 'info');
      
      const predictBtn = document.getElementById('predict-btn');
      if (predictBtn) {
        predictBtn.disabled = true;
        predictBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Predicting...';
      }
      
      // Get current data
      if (aiState.priceData.length === 0) {
        await this.fetchMarketData();
      }
      
      const prediction = await aiState.aiInterface.predict(aiState.activeModel, aiState.priceData);
      
      if (prediction.error) {
        this.logMessage(`Prediction failed: ${prediction.error}`, 'error');
      } else {
        this.displayPrediction(prediction);
        this.logMessage(`AI Prediction: ${prediction.signal} at $${prediction.prediction.toFixed(2)} (${prediction.confidence * 100:.1f}% confidence)`, 'success');
        
        // Update chart with prediction
        if (aiState.chart) {
          const predictionData = [{
            timestamp: new Date(),
            predicted_price: prediction.prediction,
            confidence_upper: prediction.prediction * 1.02,
            confidence_lower: prediction.prediction * 0.98
          }];
          
          aiState.chart.updateCandlestickChart(aiState.priceData, predictionData);
        }
      }
      
    } catch (error) {
      console.error('Prediction failed:', error);
      this.logMessage(`Prediction error: ${error.message}`, 'error');
    } finally {
      const predictBtn = document.getElementById('predict-btn');
      if (predictBtn) {
        predictBtn.disabled = false;
        predictBtn.innerHTML = '<i class="fas fa-crystal-ball"></i> Get Prediction';
      }
      this.updateStatus('Ready');
    }
  }
  
  displayPrediction(prediction) {
    const display = document.getElementById('ai-prediction-display');
    if (!display) return;
    
    // Update prediction values
    const elements = {
      'predicted-price': `$${prediction.prediction.toFixed(2)}`,
      'price-change': `${prediction.price_change_pct.toFixed(2)}%`,
      'ai-signal': prediction.signal,
      'prediction-confidence': `${(prediction.confidence * 100).toFixed(1)}%`,
      'prediction-timestamp': new Date().toLocaleString()
    };
    
    Object.entries(elements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
    
    // Update signal badge color
    const signalBadge = document.getElementById('ai-signal');
    if (signalBadge) {
      signalBadge.className = `value signal-badge ${prediction.signal === 'BUY' ? 'signal-buy' : 'signal-sell'}`;
    }
    
    // Update confidence bar
    const confidenceFill = document.getElementById('confidence-fill');
    if (confidenceFill) {
      confidenceFill.style.width = `${prediction.confidence * 100}%`;
    }
    
    // Show prediction display
    display.style.display = 'block';
  }
  
  openModelComparison() {
    const modal = document.getElementById('modelComparisonModal');
    if (modal) {
      modal.style.display = 'flex';
    }
  }
  
  saveAISettings() {
    // Get form values
    const settings = {
      modelType: document.getElementById('model-type-select')?.value || aiState.settings.modelType,
      predictionTimeframe: document.getElementById('prediction-timeframe')?.value || aiState.settings.predictionTimeframe,
      lookbackPeriod: parseInt(document.getElementById('lookback-period')?.value) || aiState.settings.lookbackPeriod,
      minConfidence: parseFloat(document.getElementById('prediction-confidence')?.value) || aiState.settings.minConfidence,
      selectedFeatures: {
        priceAction: document.getElementById('feature-price')?.checked ?? true,
        volume: document.getElementById('feature-volume')?.checked ?? true,
        rsi: document.getElementById('feature-rsi')?.checked ?? true,
        macd: document.getElementById('feature-macd')?.checked ?? true,
        bollingerBands: document.getElementById('feature-bb')?.checked ?? true
      }
    };
    
    // Update state
    Object.assign(aiState.settings, settings);
    
    // Save to localStorage
    localStorage.setItem('aiTradingSettings', JSON.stringify(aiState.settings));
    
    // Update active model
    const newActiveModel = `${settings.modelType}_${settings.predictionTimeframe}`;
    if (aiState.aiInterface?.setActiveModel(newActiveModel)) {
      aiState.activeModel = newActiveModel;
      this.updateActiveModelDisplay();
    }
    
    // Close modal
    document.getElementById('strategyModal').style.display = 'none';
    
    this.logMessage('AI settings saved', 'success');
  }
  
  async loadSettings() {
    const saved = localStorage.getItem('aiTradingSettings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        Object.assign(aiState.settings, settings);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    }
  }
  
  switchChartTab(chartType) {
    // Update tab appearance
    document.querySelectorAll('.chart-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-chart="${chartType}"]`).classList.add('active');
    
    // Update chart based on type
    if (!aiState.chart || !aiState.priceData.length) return;
    
    switch (chartType) {
      case 'price':
        aiState.chart.updateCandlestickChart(aiState.priceData, aiState.predictions);
        break;
      case 'volume':
        aiState.chart.updateVolumeChart(aiState.priceData);
        break;
      case 'indicators':
        // Add technical indicators
        if (aiState.priceData.length > 0) {
          aiState.chart.addIndicator('RSI', this.calculateRSI(aiState.priceData), '#ff6b6b');
          aiState.chart.addIndicator('MACD', this.calculateMACD(aiState.priceData), '#4ecdc4');
        }
        break;
    }
  }
  
  calculateRSI(data, period = 14) {
    // Simplified RSI calculation for demo
    return data.map((d, i) => ({
      timestamp: d.timestamp,
      value: 50 + Math.sin(i * 0.1) * 20 // Mock RSI
    }));
  }
  
  calculateMACD(data) {
    // Simplified MACD calculation for demo
    return data.map((d, i) => ({
      timestamp: d.timestamp,
      value: Math.sin(i * 0.05) * 1000 // Mock MACD
    }));
  }
  
  startTrading() {
    if (aiState.isTrading) return;
    
    aiState.isTrading = true;
    this.updateTradingStatus();
    
    // Start prediction interval
    this.predictionInterval = setInterval(() => {
      if (aiState.settings.useAIPredictions && aiState.activeModel) {
        this.makePrediction();
      }
    }, 60000); // Every minute
    
    // Start market data updates
    this.updateInterval = setInterval(() => {
      this.fetchMarketData();
    }, 30000); // Every 30 seconds
    
    this.logMessage('AI Trading started', 'success');
  }
  
  stopTrading() {
    if (!aiState.isTrading) return;
    
    aiState.isTrading = false;
    this.updateTradingStatus();
    
    if (this.predictionInterval) {
      clearInterval(this.predictionInterval);
      this.predictionInterval = null;
    }
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.logMessage('AI Trading stopped', 'info');
  }
  
  resetTrading() {
    this.stopTrading();
    
    // Reset balance
    aiState.balance = aiState.initialCapital;
    
    // Clear positions
    this.positionManager.reset();
    
    // Clear predictions
    aiState.predictions = [];
    
    // Update UI
    this.updateAccountInfo();
    this.clearLog();
    
    this.logMessage('Trading session reset', 'info');
  }
  
  updateTradingStatus() {
    const startBtn = document.getElementById('start-trading-btn');
    const stopBtn = document.getElementById('stop-trading-btn');
    const status = document.getElementById('bot-status');
    
    if (startBtn) startBtn.disabled = aiState.isTrading;
    if (stopBtn) stopBtn.disabled = !aiState.isTrading;
    
    if (status) {
      const span = status.querySelector('span');
      if (span) {
        span.textContent = aiState.isTrading ? 'AI BOT ACTIVE' : 'AI BOT READY';
      }
      status.className = `status-indicator ${aiState.isTrading ? 'active' : 'idle'}`;
    }
  }
  
  updateSymbolDisplay() {
    const elements = document.querySelectorAll('[id*="symbol"], [id*="market-symbol"]');
    elements.forEach(el => {
      if (el.tagName === 'SELECT') {
        el.value = aiState.symbol;
      } else {
        el.textContent = aiState.symbol.replace('USDT', '/USDT');
      }
    });
  }
  
  updateTimeframeDisplay() {
    const timeframeSelect = document.getElementById('timeframe');
    if (timeframeSelect) {
      timeframeSelect.value = aiState.timeframe;
    }
  }
  
  updateActiveModelDisplay() {
    const activeModelEl = document.getElementById('active-model');
    if (activeModelEl) {
      activeModelEl.textContent = aiState.activeModel || 'None';
    }
    
    // Update model accuracy if available
    if (aiState.activeModel && aiState.aiInterface) {
      const model = aiState.aiInterface.getActiveModel();
      const accuracyEl = document.getElementById('model-accuracy');
      if (accuracyEl && model?.performance) {
        accuracyEl.textContent = `${(model.performance.val_r2 * 100).toFixed(1)}%`;
      }
    }
  }
  
  updateModelStatus() {
    this.updateActiveModelDisplay();
    this.populateModelSelector();
  }
  
  updateMarketInfo(data) {
    if (!data || data.length === 0) return;
    
    const latest = data[data.length - 1];
    const previous = data[data.length - 2];
    
    // Update price
    const priceEl = document.getElementById('market-price');
    if (priceEl) {
      priceEl.textContent = `$${latest.close.toFixed(2)}`;
    }
    
    // Update change
    if (previous) {
      const change = ((latest.close - previous.close) / previous.close) * 100;
      const changeEl = document.getElementById('market-change');
      if (changeEl) {
        changeEl.textContent = `${change.toFixed(2)}%`;
        changeEl.className = `metric-value ${change >= 0 ? 'positive' : 'negative'}`;
      }
    }
    
    // Update volume
    const volumeEl = document.getElementById('market-volume');
    if (volumeEl) {
      const volumeM = latest.volume / 1000000;
      volumeEl.textContent = `$${volumeM.toFixed(1)}M`;
    }
    
    // Update last update time
    const lastTickEl = document.getElementById('last-tick-info');
    if (lastTickEl) {
      lastTickEl.textContent = new Date().toLocaleTimeString();
    }
  }
  
  updateAccountInfo() {
    const finalCapitalEl = document.getElementById('final-capital');
    if (finalCapitalEl) {
      finalCapitalEl.textContent = `$${aiState.balance.toLocaleString()}`;
    }
  }
  
  updateStatus(message) {
    const statusEl = document.getElementById('activity-status');
    if (statusEl) {
      statusEl.textContent = message;
    }
  }
  
  logMessage(message, type = 'info') {
    const logContainer = document.getElementById('logMessages');
    if (!logContainer) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.innerHTML = `<span class="timestamp">${timestamp}</span> ${message}`;
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // Keep only last 100 messages
    while (logContainer.children.length > 100) {
      logContainer.removeChild(logContainer.firstChild);
    }
  }
  
  clearLog() {
    const logContainer = document.getElementById('logMessages');
    if (logContainer) {
      logContainer.innerHTML = '';
    }
  }
}

// Initialize the AI Trading Bot when the page loads
document.addEventListener('DOMContentLoaded', () => {
  window.aiTradingBot = new AITradingBot();
});