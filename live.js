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
            // Live trading - execute real order
            if (!botState.connection) {
                throw new Error('Not connected to Binance API');
            }
            
            // Prepare order
            const order = {
                symbol: botState.settings.symbol,
                side: signal.action,
                type: 'MARKET',
                quantity: quantity
            };
            
            // Execute order
            result = await botState.connection.createOrder(order);
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
        
        // In paper trading mode, generate mock data
        if (botState.isPaperTrading || !botState.connection) {
            return generateMockHistoricalData(symbol, timeframe, startTime, endTime);
        }
        
        // In live mode, use Binance API
        const data = await botState.connection.getHistoricalKlines({
            symbol,
            interval: timeframe,
            startTime,
            endTime
        });
        
        return data;
    } catch (error) {
        console.error('Error fetching historical data:', error);
        throw error;
    }
}

// Generate mock historical data for backtesting in paper mode
function generateMockHistoricalData(symbol, timeframe, startTime, endTime) {
    const intervalMs = getIntervalInMs(timeframe);
    const numCandles = Math.floor((endTime - startTime) / intervalMs) + 1;
    
    let basePrice = symbol.includes('BTC') ? 40000 : symbol.includes('ETH') ? 2800 : 300;
    const data = [];
    let time = startTime;
    
    for (let i = 0; i < numCandles; i++) {
        // Add some random price movement
        const change = (Math.random() - 0.5) * basePrice * 0.02;
        basePrice += change;
        
        // Create candlestick with OHLCV data
        const open = basePrice;
        const high = open + (Math.random() * open * 0.01);
        const low = open - (Math.random() * open * 0.01);
        const close = low + (Math.random() * (high - low));
        const volume = Math.random() * 100 + 50;
        
        // Format as candle object
        data.push({
            time: time,
            open: open.toFixed(2),
            high: high.toFixed(2),
            low: low.toFixed(2),
            close: close.toFixed(2),
            volume: volume.toFixed(2)
        });
        
        time += intervalMs;
    }
    
    return data;
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
        const signal = executeStrategy(strategy, strategyParams, dataSubset);
        
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

// Convert timeframe to milliseconds
function getIntervalInMs(timeframe) {
    const intervals = {
        '1m': 60 * 1000,
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000
    };
    
    return intervals[timeframe] || 60 * 60 * 1000; // Default to 1h
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
    const selectedLevel = elements.logLevelSelect.value;
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
    elements.logContainer.appendChild(logElement);
    
    // Scroll to bottom
    elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
    
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
});
