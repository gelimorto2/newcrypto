/**
 * UI Manager Module
 * 
 * Handles UI updates, notifications, and DOM interactions
 */

export class UIManager {
  constructor() {
    this.elements = {};
    this.notificationSounds = {
      alert: new Audio('assets/sounds/alert.mp3'),
      open: new Audio('assets/sounds/open.mp3'),
      profit: new Audio('assets/sounds/profit.mp3'),
      loss: new Audio('assets/sounds/loss.mp3'),
      start: new Audio('assets/sounds/start.mp3')
    };
    
    this.settings = {
      browserNotifications: true,
      soundNotifications: true,
      discordNotifications: false,
      discordWebhook: ''
    };
    
    this.lastUIUpdate = null;
    this.pendingUpdates = {};
    this.updateInterval = null;
  }

  /**
   * Initialize UI elements and event listeners
   */
  initialize() {
    // Cache DOM elements for better performance
    this.cacheElements();
    
    // Start batched UI updates
    this.startBatchedUpdates();
    
    // Check notification permissions
    this.checkNotificationPermissions();
  }

  /**
   * Cache DOM elements for faster access
   */
  cacheElements() {
    // Main elements
    this.elements.chart = document.querySelector('.tradingview-widget-container__widget');
    this.elements.logMessages = document.getElementById('logMessages');
    this.elements.statusBar = document.getElementById('status-bar');
    this.elements.statusMessage = document.getElementById('status-message');
    this.elements.statusProgress = document.getElementById('status-progress');
    this.elements.activityStatus = document.getElementById('activity-status');
    
    // Botón Status
    this.elements.botStatus = document.getElementById('bot-status');
    this.elements.botActivity = document.getElementById('bot-activity');
    
    // Position info elements
    this.elements.positionInfo = document.getElementById('position-info');
    this.elements.noPositionInfo = document.getElementById('no-position-info');
    this.elements.floatingPositionIndicator = document.getElementById('floating-position-indicator');
    this.elements.positionType = document.getElementById('position-type');
    this.elements.positionEntryPrice = document.getElementById('position-entry-price');
    this.elements.positionCurrentPrice = document.getElementById('position-current-price');
    this.elements.positionPnl = document.getElementById('position-pnl');
    this.elements.positionTp = document.getElementById('position-tp');
    this.elements.positionSl = document.getElementById('position-sl');
    
    // Market info elements
    this.elements.marketPrice = document.getElementById('market-price');
    this.elements.marketChange = document.getElementById('market-change');
    this.elements.marketVolume = document.getElementById('market-volume');
    this.elements.lastTickInfo = document.getElementById('last-tick-info');
    
    // Performance metrics elements
    this.elements.totalReturn = document.getElementById('total-return');
    this.elements.winRate = document.getElementById('win-rate');
    this.elements.profitFactor = document.getElementById('profit-factor');
    this.elements.maxDrawdown = document.getElementById('max-drawdown');
    this.elements.dailyTrades = document.getElementById('stat-daily-trades');
    this.elements.dailyPnl = document.getElementById('stat-daily-pnl');
    
    // Mode indicators
    this.elements.practiceModeIndicator = document.getElementById('practice-mode-indicator');
    this.elements.liveModeIndicator = document.getElementById('live-mode-indicator');
    
    // Control buttons
    this.elements.startTradingBtn = document.getElementById('start-trading-btn');
    this.elements.stopTradingBtn = document.getElementById('stop-trading-btn');
    this.elements.resetTradingBtn = document.getElementById('reset-trading-btn');
    this.elements.startLiveTradingBtn = document.getElementById('start-live-trading-btn');
    this.elements.stopLiveTradingBtn = document.getElementById('stop-live-trading-btn');
    this.elements.positionCloseBtn = document.getElementById('position-close-btn');
    
    // Clock display
    this.elements.clockDisplay = document.getElementById('clock-display');
  }

  /**
   * Start batched UI updates for better performance
   */
  startBatchedUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Update UI at most 5 times per second
    this.updateInterval = setInterval(() => {
      this.processBatchedUpdates();
    }, 200);
  }

  /**
   * Stop batched UI updates
   */
  stopBatchedUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Process all pending UI updates
   */
  processBatchedUpdates() {
    const updates = { ...this.pendingUpdates };
    this.pendingUpdates = {};
    
    // Only perform DOM updates if there are changes
    Object.entries(updates).forEach(([key, value]) => {
      switch (key) {
        case 'position':
          this.updatePositionInfoDOM(value);
          break;
        case 'market':
          this.updateMarketInfoDOM(value);
          break;
        case 'performance':
          this.updatePerformanceMetricsDOM(value);
          break;
        case 'status':
          this.updateStatusDOM(value);
          break;
        case 'clock':
          this.updateClockDOM();
          break;
      }
    });
    
    this.lastUIUpdate = new Date();
  }

  /**
   * Queue a UI update
   * @param {string} type - Update type
   * @param {any} data - Update data
   */
  queueUpdate(type, data) {
    this.pendingUpdates[type] = data;
  }

  /**
   * Update position information
   * @param {Position|null} position - Current position or null
   */
  updatePositionInfo(position) {
    this.queueUpdate('position', position);
  }

  /**
   * Update position information in DOM
   * @param {Position|null} position - Current position or null
   * @private
   */
  updatePositionInfoDOM(position) {
    if (!position) {
      if (this.elements.positionInfo) this.elements.positionInfo.style.display = 'none';
      if (this.elements.noPositionInfo) this.elements.noPositionInfo.style.display = 'block';
      if (this.elements.floatingPositionIndicator) this.elements.floatingPositionIndicator.style.display = 'none';
      return;
    }
    
    // Update position info in widget panel
    if (this.elements.positionInfo) this.elements.positionInfo.style.display = 'block';
    if (this.elements.noPositionInfo) this.elements.noPositionInfo.style.display = 'none';
    
    if (this.elements.positionType) {
      this.elements.positionType.textContent = position.type;
      this.elements.positionType.style.color = position.type === 'LONG' ? 'var(--success-color)' : 'var(--danger-color)';
    }
    
    if (this.elements.positionEntryPrice) {
      this.elements.positionEntryPrice.textContent = `$${position.entryPrice.toFixed(2)}`;
    }
    
    if (this.elements.positionCurrentPrice && position.pnl.unrealizedPct !== undefined) {
      const currentPrice = position.entryPrice + (position.entryPrice * position.pnl.unrealizedPct);
      this.elements.positionCurrentPrice.textContent = `$${currentPrice.toFixed(2)}`;
    }
    
    if (this.elements.positionPnl) {
      const pnl = position.pnl.unrealized;
      const pnlPct = position.pnl.unrealizedPct * 100;
      
      if (pnl >= 0) {
        this.elements.positionPnl.textContent = `+$${pnl.toFixed(2)} (+${pnlPct.toFixed(2)}%)`;
        this.elements.positionPnl.style.color = 'var(--success-color)';
      } else {
        this.elements.positionPnl.textContent = `-$${Math.abs(pnl).toFixed(2)} (${pnlPct.toFixed(2)}%)`;
        this.elements.positionPnl.style.color = 'var(--danger-color)';
      }
    }
    
    if (this.elements.positionTp) {
      this.elements.positionTp.textContent = position.riskManagement.takeProfitPrice ? 
        `$${position.riskManagement.takeProfitPrice.toFixed(2)}` : 'N/A';
    }
    
    if (this.elements.positionSl) {
      this.elements.positionSl.textContent = position.riskManagement.stopLossPrice ? 
        `$${position.riskManagement.stopLossPrice.toFixed(2)}` : 'N/A';
    }
    
    // Update floating position indicator
    this.updateFloatingPositionIndicator(position);
  }

  /**
   * Update floating position indicator
   * @param {Position} position - Current position
   * @private
   */
  updateFloatingPositionIndicator(position) {
    if (!this.elements.floatingPositionIndicator) return;
    
    const currentPrice = position.entryPrice + (position.entryPrice * position.pnl.unrealizedPct);
    const pnl = position.pnl.unrealized;
    const pnlPct = position.pnl.unrealizedPct * 100;
    
    this.elements.floatingPositionIndicator.style.display = 'block';
    this.elements.floatingPositionIndicator.className = `floating-position-indicator ${position.type.toLowerCase()}`;
    
    let content = `
      <div style="margin-bottom: 0.5rem; font-weight: 600;">
        ${position.type} Position
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
        <span>Entry Price:</span>
        <span>$${position.entryPrice.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
        <span>Current Price:</span>
        <span>$${currentPrice.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
        <span>Size:</span>
        <span>${position.size.toFixed(6)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span>P&L:</span>
        <span style="color: ${pnl >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
          ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)
        </span>
      </div>
    `;
    
    if (position.riskManagement.takeProfitPrice) {
      content += `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
          <span>Take Profit:</span>
          <span style="color: var(--success-color)">$${position.riskManagement.takeProfitPrice.toFixed(2)}</span>
        </div>
      `;
    }
    
    if (position.riskManagement.stopLossPrice) {
      content += `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
          <span>Stop Loss:</span>
          <span style="color: var(--danger-color)">$${position.riskManagement.stopLossPrice.toFixed(2)}</span>
        </div>
      `;
    }
    
    if (position.riskManagement.trailingStopPrice) {
      content += `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
          <span>Trailing Stop:</span>
          <span style="color: var(--warning-color)">$${position.riskManagement.trailingStopPrice.toFixed(2)}</span>
        </div>
      `;
    }
    
    this.elements.floatingPositionIndicator.innerHTML = content;
  }

  /**
   * Update market information
   * @param {Object} marketInfo - Market information
   */
  updateMarketInfo(marketInfo) {
    this.queueUpdate('market', marketInfo);
  }

  /**
   * Update market information in DOM
   * @param {Object} marketInfo - Market information
   * @private
   */
  updateMarketInfoDOM(marketInfo) {
    const { currentPrice, previousPrice, volume, lastUpdate } = marketInfo;
    
    if (this.elements.marketPrice) {
      this.elements.marketPrice.textContent = `$${currentPrice.toFixed(2)}`;
    }
    
    if (this.elements.marketChange && previousPrice) {
      const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;
      
      if (priceChange >= 0) {
        this.elements.marketChange.textContent = `+${priceChange.toFixed(2)}%`;
        this.elements.marketChange.style.color = 'var(--success-color)';
      } else {
        this.elements.marketChange.textContent = `${priceChange.toFixed(2)}%`;
        this.elements.marketChange.style.color = 'var(--danger-color)';
      }
    }
    
    if (this.elements.marketVolume && volume) {
      // Format volume as K, M, B
      let formattedVolume;
      if (volume >= 1e9) {
        formattedVolume = `$${(volume / 1e9).toFixed(2)}B`;
      } else if (volume >= 1e6) {
        formattedVolume = `$${(volume / 1e6).toFixed(2)}M`;
      } else if (volume >= 1e3) {
        formattedVolume = `$${(volume / 1e3).toFixed(2)}K`;
      } else {
        formattedVolume = `$${volume.toFixed(2)}`;
      }
      
      this.elements.marketVolume.textContent = formattedVolume;
    }
    
    if (this.elements.lastTickInfo && lastUpdate) {
      this.elements.lastTickInfo.textContent = typeof lastUpdate === 'string' 
        ? lastUpdate 
        : lastUpdate.toLocaleTimeString();
    }
  }

  /**
   * Update performance metrics
   * @param {Object} metrics - Performance metrics
   */
  updatePerformanceMetrics(metrics) {
    this.queueUpdate('performance', metrics);
  }

  /**
   * Update performance metrics in DOM
   * @param {Object} metrics - Performance metrics
   * @private
   */
  updatePerformanceMetricsDOM(metrics) {
    const { 
      returnPct, 
      winRate, 
      profitFactor, 
      maxDrawdown,
      todayTrades,
      todayPnl
    } = metrics;
    
    if (this.elements.totalReturn) {
      if (returnPct >= 0) {
        this.elements.totalReturn.textContent = `+${returnPct.toFixed(2)}%`;
        this.elements.totalReturn.style.color = 'var(--success-color)';
      } else {
        this.elements.totalReturn.textContent = `${returnPct.toFixed(2)}%`;
        this.elements.totalReturn.style.color = 'var(--danger-color)';
      }
    }
    
    if (this.elements.winRate) {
      this.elements.winRate.textContent = `${winRate.toFixed(1)}%`;
    }
    
    if (this.elements.profitFactor) {
      this.elements.profitFactor.textContent = profitFactor === Infinity 
        ? '∞' 
        : profitFactor.toFixed(2);
    }
    
    if (this.elements.maxDrawdown) {
      this.elements.maxDrawdown.textContent = `${maxDrawdown.toFixed(2)}%`;
    }
    
    // Daily stats
    if (this.elements.dailyTrades && todayTrades !== undefined) {
      this.elements.dailyTrades.textContent = todayTrades;
    }
    
    if (this.elements.dailyPnl && todayPnl !== undefined) {
      if (todayPnl >= 0) {
        this.elements.dailyPnl.textContent = `+$${todayPnl.toFixed(2)}`;
        this.elements.dailyPnl.style.color = 'var(--success-color)';
      } else {
        this.elements.dailyPnl.textContent = `-$${Math.abs(todayPnl).toFixed(2)}`;
        this.elements.dailyPnl.style.color = 'var(--danger-color)';
      }
    }
  }

  /**
   * Update bot status
   * @param {Object} status - Bot status
   */
  updateStatus(status) {
    this.queueUpdate('status', status);
  }

  /**
   * Update bot status in DOM
   * @param {Object} status - Bot status
   * @private
   */
  updateStatusDOM(status) {
    const { isRunning, isLiveTrading, statusText, activityType } = status;
    
    // Update bot status indicator
    if (this.elements.botStatus) {
      if (isRunning) {
        this.elements.botStatus.classList.remove('idle');
        this.elements.botStatus.classList.add('active');
        
        if (this.elements.botActivity) {
          this.elements.botActivity.classList.remove('waiting');
          this.elements.botActivity.classList.add(activityType || 'scanning');
        }
        
        this.elements.botStatus.innerHTML = `
          <div class="bot-activity ${activityType || 'scanning'}" id="bot-activity"></div>
          <span>BOT ACTIVE</span>
        `;
      } else {
        this.elements.botStatus.classList.remove('active');
        this.elements.botStatus.classList.add('idle');
        
        if (this.elements.botActivity) {
          this.elements.botActivity.classList.remove('scanning', 'trading');
          this.elements.botActivity.classList.add('waiting');
        }
        
        this.elements.botStatus.innerHTML = `
          <div class="bot-activity waiting" id="bot-activity"></div>
          <span>BOT IDLE</span>
        `;
      }
    }
    
    // Update mode indicators
    if (this.elements.practiceModeIndicator && this.elements.liveModeIndicator) {
      this.elements.practiceModeIndicator.style.display = isLiveTrading ? 'none' : 'flex';
      this.elements.liveModeIndicator.style.display = isLiveTrading ? 'flex' : 'none';
    }
    
    // Update activity status text
    if (this.elements.activityStatus && statusText) {
      this.elements.activityStatus.textContent = statusText;
    }
    
    // Update control buttons
    if (isRunning) {
      if (this.elements.startTradingBtn) this.elements.startTradingBtn.disabled = true;
      if (this.elements.stopTradingBtn) this.elements.stopTradingBtn.disabled = false;
      if (this.elements.startLiveTradingBtn) this.elements.startLiveTradingBtn.disabled = true;
      if (this.elements.stopLiveTradingBtn) this.elements.stopLiveTradingBtn.disabled = false;
    } else {
      if (this.elements.startTradingBtn) this.elements.startTradingBtn.disabled = false;
      if (this.elements.stopTradingBtn) this.elements.stopTradingBtn.disabled = true;
      if (this.elements.startLiveTradingBtn) this.elements.startLiveTradingBtn.disabled = false;
      if (this.elements.stopLiveTradingBtn) this.elements.stopLiveTradingBtn.disabled = true;
    }
  }

  /**
   * Update clock display
   */
  updateClock() {
    this.queueUpdate('clock', null);
  }

  /**
   * Update clock display in DOM
   * @private
   */
  updateClockDOM() {
    if (!this.elements.clockDisplay) return;
    
    const now = new Date();
    const utcString = now.toISOString().replace('T', ' ').substring(0, 19);
    this.elements.clockDisplay.textContent = utcString + ' UTC';
  }

  /**
   * Add a message to the log
   * @param {string} message - Log message
   * @param {boolean} isPositive - Whether it's a positive message
   * @param {boolean} isImportant - Whether it's an important message
   */
  addLogMessage(message, isPositive = false, isImportant = false) {
    if (!this.elements.logMessages) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logItem = document.createElement('div');
    logItem.className = 'log-message';
    
    if (isPositive) {
      logItem.classList.add('positive');
    } else if (isImportant) {
      logItem.classList.add('negative');
    }
    
    logItem.innerHTML = `<strong>${timestamp}</strong>: ${message}`;
    this.elements.logMessages.appendChild(logItem);
    this.elements.logMessages.scrollTop = this.elements.logMessages.scrollHeight;
    
    // Also update the activity status
    if (this.elements.activityStatus) {
      this.elements.activityStatus.textContent = message;
    }
    
    // Send notifications for important messages
    if (isImportant) {
      if (isPositive) {
        this.sendNotification('Volty Trading Bot', message, 'profit');
      } else {
        this.sendNotification('Volty Trading Bot', message, 'alert');
      }
    }
  }

  /**
   * Show status bar with message
   * @param {string} message - Status message
   * @param {string} type - Status type ('info', 'success', 'warning', 'error')
   */
  showStatusBar(message, type = 'info') {
    if (!this.elements.statusBar) return;
    
    this.elements.statusBar.className = 'status-bar';
    this.elements.statusBar.classList.add(`status-${type}`);
    
    if (this.elements.statusMessage) {
      this.elements.statusMessage.textContent = message;
    }
    
    this.elements.statusBar.style.display = 'block';
    
    // Animate progress
    if (this.elements.statusProgress) {
      this.elements.statusProgress.style.width = '0%';
      setTimeout(() => {
        this.elements.statusProgress.style.width = '100%';
        this.elements.statusProgress.style.transition = 'width 3s linear';
      }, 50);
    }
    
    // Hide after 3 seconds
    setTimeout(() => {
      this.elements.statusBar.style.display = 'none';
      if (this.elements.statusProgress) {
        this.elements.statusProgress.style.transition = 'none';
        this.elements.statusProgress.style.width = '0%';
      }
    }, 3000);
  }

  /**
   * Check notification permissions
   */
  checkNotificationPermissions() {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      this.settings.browserNotifications = false;
      return;
    }
    
    if (Notification.permission === 'granted') {
      return;
    }
    
    if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission !== 'granted') {
          this.settings.browserNotifications = false;
        }
      });
    }
  }

  /**
   * Send a notification
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {string} soundType - Sound type
   */
  sendNotification(title, message, soundType = 'alert') {
    // Browser notification
    if (this.settings.browserNotifications && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: message,
        icon: 'https://cdn-icons-png.flaticon.com/512/6295/6295417.png'
      });
      
      notification.onclick = function() {
        window.focus();
        this.close();
      };
    }
    
    // Sound notification
    this.playNotificationSound(soundType);
    
    // Discord notification (if configured)
    this.sendDiscordNotification(message);
  }

  /**
   * Play notification sound
   * @param {string} type - Sound type
   */
  playNotificationSound(type = 'alert') {
    if (!this.settings.soundNotifications) return;
    
    const sound = this.notificationSounds[type];
    if (sound) {
      sound.play().catch(error => {
        // Silently handle autoplay restrictions
      });
    }
  }

  /**
   * Send Discord notification
   * @param {string} message - Notification message
   */
  async sendDiscordNotification(message) {
    if (!this.settings.discordNotifications || !this.settings.discordWebhook) return;
    
    try {
      await fetch(this.settings.discordWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: message
        })
      });
    } catch (error) {
      console.error('Failed to send Discord notification:', error);
    }
  }

  /**
   * Export data to file
   * @param {string} content - File content
   * @param {string} fileName - File name
   * @param {string} contentType - Content type
   */
  exportToFile(content, fileName, contentType = 'text/csv') {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Fix UI overlays after chart loads
   */
  fixUIOverlays() {
    // Ensure overlays are visible above the chart
    const overlays = [
      '.overlay-controls',
      '.mode-indicator',
      '.bot-controls',
      '.clock-container',
      '.floating-position-indicator',
      '.widget-panel-toggle'
    ];
    
    overlays.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        element.style.zIndex = '5';
      }
    });
  }

  /**
   * Set notification settings
   * @param {Object} settings - Notification settings
   */
  setNotificationSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    
    if (this.settings.browserNotifications) {
      this.checkNotificationPermissions();
    }
  }
}

// Export singleton instance
export const uiManager = new UIManager();
