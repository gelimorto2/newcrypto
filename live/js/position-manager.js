/**
 * Position Manager Module
 * 
 * Handles position creation, tracking, and risk management
 */

/**
 * Position class for managing trading positions
 */
export class Position {
  /**
   * Create a new position
   * @param {string} type - Position type ('LONG' or 'SHORT')
   * @param {number} entryPrice - Entry price
   * @param {number} size - Position size
   * @param {Date} timestamp - Entry timestamp
   */
  constructor(type, entryPrice, size, timestamp) {
    this.id = generateUniqueId();
    this.type = type;
    this.entryPrice = entryPrice;
    this.size = size;
    this.entryTime = timestamp || new Date();
    this.exitPrice = null;
    this.exitTime = null;
    
    this.riskManagement = {
      takeProfitPrice: null,
      stopLossPrice: null,
      trailingStopPrice: null,
      highestPrice: type === 'LONG' ? entryPrice : null,
      lowestPrice: type === 'SHORT' ? entryPrice : null
    };
    
    this.pnl = {
      realized: 0,
      unrealized: 0,
      realizedPct: 0,
      unrealizedPct: 0
    };
    
    this.status = 'OPEN';
    this.exitReason = null;
    
    // Order tracking
    this.orders = {
      entry: null,
      exit: null
    };
  }

  /**
   * Set entry order details
   * @param {Object} orderDetails - Order details from exchange
   */
  setEntryOrder(orderDetails) {
    this.orders.entry = orderDetails;
  }

  /**
   * Set exit order details
   * @param {Object} orderDetails - Order details from exchange
   */
  setExitOrder(orderDetails) {
    this.orders.exit = orderDetails;
  }

  /**
   * Calculate take profit price
   * @param {number} takeProfitPct - Take profit percentage
   * @returns {number|null} - Take profit price
   */
  calculateTakeProfit(takeProfitPct) {
    if (!takeProfitPct) return null;
    
    const tp = this.type === 'LONG' 
      ? this.entryPrice * (1 + takeProfitPct / 100)
      : this.entryPrice * (1 - takeProfitPct / 100);
    
    return parseFloat(tp.toFixed(2));
  }

  /**
   * Calculate stop loss price
   * @param {number} stopLossPct - Stop loss percentage
   * @returns {number|null} - Stop loss price
   */
  calculateStopLoss(stopLossPct) {
    if (!stopLossPct) return null;
    
    const sl = this.type === 'LONG'
      ? this.entryPrice * (1 - stopLossPct / 100)
      : this.entryPrice * (1 + stopLossPct / 100);
    
    return parseFloat(sl.toFixed(2));
  }

  /**
   * Update risk management settings
   * @param {Object} settings - Risk management settings
   */
  updateRiskManagement(settings) {
    if (settings.useTakeProfit) {
      this.riskManagement.takeProfitPrice = this.calculateTakeProfit(settings.takeProfitPct);
    } else {
      this.riskManagement.takeProfitPrice = null;
    }
    
    if (settings.useStopLoss) {
      this.riskManagement.stopLossPrice = this.calculateStopLoss(settings.stopLossPct);
    } else {
      this.riskManagement.stopLossPrice = null;
    }
  }

  /**
   * Update trailing stop price
   * @param {number} currentPrice - Current market price
   * @param {number} trailingStopPct - Trailing stop percentage
   * @param {boolean} useTrailingStop - Whether to use trailing stop
   */
  updateTrailingStop(currentPrice, trailingStopPct, useTrailingStop) {
    if (!useTrailingStop) return;
    
    if (this.type === 'LONG') {
      if (currentPrice > (this.riskManagement.highestPrice || this.entryPrice)) {
        this.riskManagement.highestPrice = currentPrice;
        this.riskManagement.trailingStopPrice = currentPrice * (1 - trailingStopPct / 100);
      }
    } else if (this.type === 'SHORT') {
      if (this.riskManagement.lowestPrice === null || currentPrice < this.riskManagement.lowestPrice) {
        this.riskManagement.lowestPrice = currentPrice;
        this.riskManagement.trailingStopPrice = currentPrice * (1 + trailingStopPct / 100);
      }
    }
  }

  /**
   * Calculate unrealized P&L
   * @param {number} currentPrice - Current market price
   */
  calculateUnrealizedPnl(currentPrice) {
    if (this.type === 'LONG') {
      this.pnl.unrealized = (currentPrice - this.entryPrice) * this.size;
      this.pnl.unrealizedPct = (currentPrice - this.entryPrice) / this.entryPrice;
    } else {
      this.pnl.unrealized = (this.entryPrice - currentPrice) * this.size;
      this.pnl.unrealizedPct = (this.entryPrice - currentPrice) / this.entryPrice;
    }
  }

  /**
   * Close the position
   * @param {number} exitPrice - Exit price
   * @param {Date} timestamp - Exit timestamp
   * @param {string} reason - Exit reason
   * @returns {number} - Realized P&L
   */
  close(exitPrice, timestamp, reason) {
    this.exitPrice = exitPrice;
    this.exitTime = timestamp || new Date();
    this.status = 'CLOSED';
    this.exitReason = reason;
    
    if (this.type === 'LONG') {
      this.pnl.realized = (this.exitPrice - this.entryPrice) * this.size;
      this.pnl.realizedPct = (this.exitPrice - this.entryPrice) / this.entryPrice;
    } else {
      this.pnl.realized = (this.entryPrice - this.exitPrice) * this.size;
      this.pnl.realizedPct = (this.entryPrice - this.exitPrice) / this.entryPrice;
    }
    
    return this.pnl.realized;
  }

  /**
   * Check if position should be closed based on current price
   * @param {number} currentPrice - Current market price
   * @returns {Object|null} - Close signal or null
   */
  checkCloseSignals(currentPrice) {
    // Take profit
    if (this.riskManagement.takeProfitPrice !== null) {
      if ((this.type === 'LONG' && currentPrice >= this.riskManagement.takeProfitPrice) ||
          (this.type === 'SHORT' && currentPrice <= this.riskManagement.takeProfitPrice)) {
        return {
          should: true,
          reason: 'Take Profit'
        };
      }
    }
    
    // Stop loss
    if (this.riskManagement.stopLossPrice !== null) {
      if ((this.type === 'LONG' && currentPrice <= this.riskManagement.stopLossPrice) ||
          (this.type === 'SHORT' && currentPrice >= this.riskManagement.stopLossPrice)) {
        return {
          should: true,
          reason: 'Stop Loss'
        };
      }
    }
    
    // Trailing stop
    if (this.riskManagement.trailingStopPrice !== null) {
      if ((this.type === 'LONG' && currentPrice <= this.riskManagement.trailingStopPrice) ||
          (this.type === 'SHORT' && currentPrice >= this.riskManagement.trailingStopPrice)) {
        return {
          should: true,
          reason: 'Trailing Stop'
        };
      }
    }
    
    return {
      should: false
    };
  }

  /**
   * Get position summary
   * @returns {Object} - Position summary
   */
  getSummary() {
    return {
      id: this.id,
      type: this.type,
      entryPrice: this.entryPrice,
      exitPrice: this.exitPrice,
      size: this.size,
      status: this.status,
      entryTime: this.entryTime,
      exitTime: this.exitTime,
      pnl: this.pnl,
      exitReason: this.exitReason,
      riskManagement: { ...this.riskManagement }
    };
  }
}

/**
 * Generate a unique ID for positions
 * @returns {string} - Unique ID
 */
function generateUniqueId() {
  return 'pos_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Position Manager class
 */
export class PositionManager {
  constructor() {
    this.currentPosition = null;
    this.positionHistory = [];
    this.settings = {
      useTakeProfit: true,
      useStopLoss: true,
      useTrailingStop: false,
      takeProfitPct: 3,
      stopLossPct: 2,
      trailingStopPct: 1.5,
      positionSize: 10 // Percentage of balance
    };
    
    // Listeners for position events
    this.listeners = {
      onOpen: [],
      onClose: [],
      onUpdate: []
    };
  }

  /**
   * Set risk management settings
   * @param {Object} settings - Risk management settings
   */
  setSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    
    // Update current position if exists
    if (this.currentPosition) {
      this.currentPosition.updateRiskManagement(this.settings);
      this._notifyListeners('onUpdate', this.currentPosition);
    }
  }

  /**
   * Open a new position
   * @param {string} type - Position type ('LONG' or 'SHORT')
   * @param {number} entryPrice - Entry price
   * @param {number} size - Position size
   * @param {Object} orderDetails - Order details from exchange
   * @returns {Position} - The new position
   */
  openPosition(type, entryPrice, size, orderDetails = null) {
    // Close existing position if any
    if (this.currentPosition) {
      throw new Error('Cannot open position: Another position is already open');
    }
    
    // Create new position
    const position = new Position(type, entryPrice, size, new Date());
    
    // Set entry order details if provided
    if (orderDetails) {
      position.setEntryOrder(orderDetails);
    }
    
    // Apply risk management settings
    position.updateRiskManagement(this.settings);
    
    // Set as current position
    this.currentPosition = position;
    
    // Notify listeners
    this._notifyListeners('onOpen', position);
    
    return position;
  }

  /**
   * Close the current position
   * @param {number} exitPrice - Exit price
   * @param {string} reason - Exit reason
   * @param {Object} orderDetails - Order details from exchange
   * @returns {Position|null} - The closed position or null if no position
   */
  closePosition(exitPrice, reason, orderDetails = null) {
    if (!this.currentPosition) {
      return null;
    }
    
    // Close the position
    const pnl = this.currentPosition.close(exitPrice, new Date(), reason);
    
    // Set exit order details if provided
    if (orderDetails) {
      this.currentPosition.setExitOrder(orderDetails);
    }
    
    // Add to history and clear current position
    this.positionHistory.push(this.currentPosition);
    
    // Store closed position before clearing
    const closedPosition = this.currentPosition;
    
    // Clear current position
    this.currentPosition = null;
    
    // Notify listeners
    this._notifyListeners('onClose', closedPosition);
    
    // Limit history length to prevent memory issues
    if (this.positionHistory.length > 100) {
      this.positionHistory = this.positionHistory.slice(-100);
    }
    
    return closedPosition;
  }

  /**
   * Update the current position with latest market data
   * @param {number} currentPrice - Current market price
   * @returns {Object|null} - Close signal if position should be closed
   */
  updatePosition(currentPrice) {
    if (!this.currentPosition) {
      return null;
    }
    
    // Update trailing stop
    this.currentPosition.updateTrailingStop(
      currentPrice,
      this.settings.trailingStopPct,
      this.settings.useTrailingStop
    );
    
    // Calculate unrealized P&L
    this.currentPosition.calculateUnrealizedPnl(currentPrice);
    
    // Check if position should be closed
    const closeSignal = this.currentPosition.checkCloseSignals(currentPrice);
    
    // Notify listeners
    this._notifyListeners('onUpdate', this.currentPosition);
    
    return closeSignal;
  }

  /**
   * Add an event listener
   * @param {string} event - Event name ('onOpen', 'onClose', 'onUpdate')
   * @param {Function} callback - Callback function
   */
  addEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  removeEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Notify all listeners of an event
   * @param {string} event - Event name
   * @param {Position} position - Position object
   * @private
   */
  _notifyListeners(event, position) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(position);
        } catch (error) {
          console.error(`Error in position ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Get trading performance metrics
   * @param {number} initialCapital - Initial capital
   * @returns {Object} - Performance metrics
   */
  getPerformanceMetrics(initialCapital) {
    const closedPositions = this.positionHistory;
    const totalTrades = closedPositions.length;
    
    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        profitFactor: 0,
        totalProfit: 0,
        totalLoss: 0,
        netProfit: 0,
        returnPct: 0,
        maxDrawdown: 0,
        averageTrade: 0,
        averageWin: 0,
        averageLoss: 0
      };
    }
    
    // Calculate basic metrics
    const winningTrades = closedPositions.filter(p => p.pnl.realized > 0);
    const losingTrades = closedPositions.filter(p => p.pnl.realized <= 0);
    
    const totalProfit = winningTrades.reduce((sum, p) => sum + p.pnl.realized, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, p) => sum + p.pnl.realized, 0));
    const netProfit = totalProfit - totalLoss;
    
    // Calculate win rate and profit factor
    const winRate = (winningTrades.length / totalTrades) * 100;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
    
    // Calculate return percentage
    const returnPct = (netProfit / initialCapital) * 100;
    
    // Calculate drawdown
    let maxDrawdown = 0;
    let peak = initialCapital;
    let balance = initialCapital;
    
    for (const position of closedPositions) {
      balance += position.pnl.realized;
      
      if (balance > peak) {
        peak = balance;
      } else {
        const drawdown = ((peak - balance) / peak) * 100;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
    }
    
    // Calculate averages
    const averageTrade = netProfit / totalTrades;
    const averageWin = winningTrades.length > 0 
      ? totalProfit / winningTrades.length 
      : 0;
    const averageLoss = losingTrades.length > 0 
      ? totalLoss / losingTrades.length 
      : 0;
    
    return {
      totalTrades,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      profitFactor,
      totalProfit,
      totalLoss,
      netProfit,
      returnPct,
      maxDrawdown,
      averageTrade,
      averageWin,
      averageLoss
    };
  }

  /**
   * Export trading history to CSV
   * @returns {string} - CSV data
   */
  exportHistoryToCSV() {
    if (this.positionHistory.length === 0) {
      return 'No trading history available';
    }
    
    const headers = [
      'ID',
      'Type',
      'Entry Price',
      'Exit Price',
      'Size',
      'Entry Time',
      'Exit Time',
      'P&L',
      'P&L %',
      'Exit Reason'
    ].join(',');
    
    const rows = this.positionHistory.map(position => {
      return [
        position.id,
        position.type,
        position.entryPrice.toFixed(2),
        position.exitPrice ? position.exitPrice.toFixed(2) : '',
        position.size.toFixed(6),
        position.entryTime.toISOString(),
        position.exitTime ? position.exitTime.toISOString() : '',
        position.pnl.realized.toFixed(2),
        (position.pnl.realizedPct * 100).toFixed(2) + '%',
        position.exitReason || ''
      ].join(',');
    });
    
    return [headers, ...rows].join('\n');
  }
}
