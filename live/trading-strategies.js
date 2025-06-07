/**
 * Trading Strategies for Binance Trading Bot
 * This module contains implementations of different trading strategies
 * including the original strategy from the paper trading bot
 */

// Original Strategy Implementation
function executeOriginalStrategy(params, data) {
    if (!params || !data || data.length < params.longPeriod + params.signalPeriod) {
        return null;
    }
    
    // Extract closing prices
    const closes = data.map(candle => parseFloat(candle.close));
    
    // Calculate EMAs for MACD
    const shortEMA = calculateEMA(closes, params.shortPeriod);
    const longEMA = calculateEMA(closes, params.longPeriod);
    
    // Calculate MACD line
    const macdLine = [];
    for (let i = 0; i < closes.length; i++) {
        if (i >= params.longPeriod - 1) {
            const macdValue = shortEMA[i - (params.longPeriod - params.shortPeriod)] - longEMA[i];
            macdLine.push(macdValue);
        } else {
            macdLine.push(null);
        }
    }
    
    // Calculate signal line (EMA of MACD line)
    const validMacdValues = macdLine.filter(val => val !== null);
    const signalLine = calculateEMA(validMacdValues, params.signalPeriod);
    
    // Check for signals
    const currentCandle = data[data.length - 1];
    const currentPrice = parseFloat(currentCandle.close);
    
    // Get the last two MACD and signal values for comparison
    const macdHistoryLength = macdLine.filter(val => val !== null).length;
    const signalHistoryLength = signalLine.length;
    
    if (macdHistoryLength < 2 || signalHistoryLength < 2) {
        return null;
    }
    
    const currentMACD = validMacdValues[macdHistoryLength - 1];
    const previousMACD = validMacdValues[macdHistoryLength - 2];
    const currentSignal = signalLine[signalHistoryLength - 1];
    const previousSignal = signalLine[signalHistoryLength - 2];
    
    // MACD crosses above signal line (bullish)
    if (previousMACD <= previousSignal && currentMACD > currentSignal) {
        return {
            action: 'BUY',
            price: currentPrice,
            reason: 'MACD crossed above signal line'
        };
    }
    
    // MACD crosses below signal line (bearish)
    if (previousMACD >= previousSignal && currentMACD < currentSignal) {
        return {
            action: 'SELL',
            price: currentPrice,
            reason: 'MACD crossed below signal line'
        };
    }
    
    // Check for overbought/oversold conditions
    const histogram = currentMACD - currentSignal;
    
    // Oversold and turning up
    if (histogram < params.oversold && histogram > (previousMACD - previousSignal)) {
        return {
            action: 'BUY',
            price: currentPrice,
            reason: 'MACD histogram oversold and turning up'
        };
    }
    
    // Overbought and turning down
    if (histogram > params.overbought && histogram < (previousMACD - previousSignal)) {
        return {
            action: 'SELL',
            price: currentPrice,
            reason: 'MACD histogram overbought and turning down'
        };
    }
    
    // No signal
    return null;
}

// MACD Strategy Implementation
function executeMACDStrategy(params, data) {
    if (!params || !data || data.length < params.slowPeriod + params.signalPeriod) {
        return null;
    }
    
    // Calculate MACD indicator
    const macdData = calculateMACD(data, params.fastPeriod, params.slowPeriod, params.signalPeriod);
    
    // Check for signals
    const currentCandle = data[data.length - 1];
    const currentPrice = parseFloat(currentCandle.close);
    const currentMACD = macdData[macdData.length - 1];
    const previousMACD = macdData[macdData.length - 2];
    
    // No signal if we don't have enough data
    if (!currentMACD || !previousMACD) {
        return null;
    }
    
    // MACD crosses above signal line (bullish)
    if (previousMACD.macd <= previousMACD.signal && currentMACD.macd > currentMACD.signal) {
        return {
            action: 'BUY',
            price: currentPrice,
            reason: 'MACD crossed above signal line'
        };
    }
    
    // MACD crosses below signal line (bearish)
    if (previousMACD.macd >= previousMACD.signal && currentMACD.macd < currentMACD.signal) {
        return {
            action: 'SELL',
            price: currentPrice,
            reason: 'MACD crossed below signal line'
        };
    }
    
    // No signal
    return null;
}

// RSI Strategy Implementation
function executeRSIStrategy(params, data) {
    if (!params || !data || data.length < params.period + 1) {
        return null;
    }
    
    // Calculate RSI indicator
    const rsiData = calculateRSI(data, params.period);
    
    // Check for signals
    const currentCandle = data[data.length - 1];
    const currentPrice = parseFloat(currentCandle.close);
    const currentRSI = rsiData[rsiData.length - 1];
    const previousRSI = rsiData[rsiData.length - 2];
    
    // No signal if we don't have enough data
    if (!currentRSI || !previousRSI) {
        return null;
    }
    
    // RSI crosses above oversold level (bullish)
    if (previousRSI < params.oversold && currentRSI >= params.oversold) {
        return {
            action: 'BUY',
            price: currentPrice,
            reason: `RSI crossed above oversold level (${params.oversold})`
        };
    }
    
    // RSI crosses below overbought level (bearish)
    if (previousRSI > params.overbought && currentRSI <= params.overbought) {
        return {
            action: 'SELL',
            price: currentPrice,
            reason: `RSI crossed below overbought level (${params.overbought})`
        };
    }
    
    // No signal
    return null;
}

// Bollinger Bands Strategy Implementation
function executeBollingerBandsStrategy(params, data) {
    if (!params || !data || data.length < params.period) {
        return null;
    }
    
    // Calculate Bollinger Bands indicator
    const bbData = calculateBollingerBands(data, params.period, params.stdDev);
    
    // Check for signals
    const currentCandle = data[data.length - 1];
    const previousCandle = data[data.length - 2];
    const currentPrice = parseFloat(currentCandle.close);
    const previousPrice = parseFloat(previousCandle.close);
    const currentBB = bbData[bbData.length - 1];
    
    // No signal if we don't have enough data
    if (!currentBB) {
        return null;
    }
    
    // Price crosses above lower band (bullish)
    if (previousPrice < bbData[bbData.length - 2].lower && currentPrice >= currentBB.lower) {
        return {
            action: 'BUY',
            price: currentPrice,
            reason: 'Price crossed above lower Bollinger Band'
        };
    }
    
    // Price crosses below upper band (bearish)
    if (previousPrice > bbData[bbData.length - 2].upper && currentPrice <= currentBB.upper) {
        return {
            action: 'SELL',
            price: currentPrice,
            reason: 'Price crossed below upper Bollinger Band'
        };
    }
    
    // No signal
    return null;
}

// Strategy router function
function executeStrategy(strategy, params, data) {
    switch (strategy) {
        case 'original':
            return executeOriginalStrategy(params, data);
        case 'macd':
            return executeMACDStrategy(params, data);
        case 'rsi':
            return executeRSIStrategy(params, data);
        case 'bb':
            return executeBollingerBandsStrategy(params, data);
        default:
            return executeOriginalStrategy(params, data); // Default to original strategy
    }
}

// Technical Indicator Calculations

// Calculate MACD (Moving Average Convergence Divergence)
function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    // Extract closing prices
    const closes = data.map(candle => parseFloat(candle.close));
    
    // Calculate EMAs
    const fastEMA = calculateEMA(closes, fastPeriod);
    const slowEMA = calculateEMA(closes, slowPeriod);
    
    // Calculate MACD line
    const macdLine = [];
    for (let i = 0; i < closes.length; i++) {
        if (i >= slowPeriod - 1) {
            macdLine.push(fastEMA[i - (slowPeriod - fastPeriod)] - slowEMA[i]);
        } else {
            macdLine.push(null);
        }
    }
    
    // Calculate signal line (EMA of MACD line)
    const signalLine = calculateEMA(
        macdLine.filter(val => val !== null), 
        signalPeriod
    );
    
    // Calculate histogram
    const histogram = [];
    let signalIdx = 0;
    
    // Combine results
    const result = [];
    for (let i = 0; i < macdLine.length; i++) {
        if (macdLine[i] !== null && i >= slowPeriod + signalPeriod - 2) {
            const hist = macdLine[i] - signalLine[signalIdx];
            histogram.push(hist);
            
            result.push({
                time: data[i].time,
                macd: macdLine[i],
                signal: signalLine[signalIdx],
                histogram: hist
            });
            
            signalIdx++;
        } else {
            result.push({
                time: data[i].time,
                macd: null,
                signal: null,
                histogram: null
            });
        }
    }
    
    return result;
}

// Calculate RSI (Relative Strength Index)
function calculateRSI(data, period = 14) {
    // Extract closing prices
    const closes = data.map(candle => parseFloat(candle.close));
    
    // Calculate price changes
    const changes = [];
    for (let i = 1; i < closes.length; i++) {
        changes.push(closes[i] - closes[i - 1]);
    }
    
    // Initialize arrays for gains and losses
    const gains = [];
    const losses = [];
    
    // Separate gains and losses
    for (let i = 0; i < changes.length; i++) {
        if (changes[i] >= 0) {
            gains.push(changes[i]);
            losses.push(0);
        } else {
            gains.push(0);
            losses.push(Math.abs(changes[i]));
        }
    }
    
    // Calculate average gains and losses
    let avgGain = 0;
    let avgLoss = 0;
    
    // First average gain and loss
    for (let i = 0; i < period; i++) {
        avgGain += gains[i];
        avgLoss += losses[i];
    }
    
    avgGain /= period;
    avgLoss /= period;
    
    // Calculate RS and RSI
    const rsiData = [];
    
    // Add null values for the first period
    for (let i = 0; i < period; i++) {
        rsiData.push(null);
    }
    
    // Calculate first RSI
    let rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss); // Avoid division by zero
    let rsi = 100 - (100 / (1 + rs));
    rsiData.push(rsi);
    
    // Calculate remaining RSI values
    for (let i = period; i < changes.length; i++) {
        // Smooth averages
        avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
        avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
        
        // Calculate RS and RSI
        rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss);
        rsi = 100 - (100 / (1 + rs));
        
        rsiData.push(rsi);
    }
    
    // Combine with timestamps
    const result = [];
    for (let i = 0; i < rsiData.length; i++) {
        result.push({
            time: data[i].time,
            rsi: rsiData[i]
        });
    }
    
    return result;
}

// Calculate Bollinger Bands
function calculateBollingerBands(data, period = 20, stdDevMultiplier = 2) {
    // Extract closing prices
    const closes = data.map(candle => parseFloat(candle.close));
    
    // Calculate SMA
    const sma = calculateSMA(closes, period);
    
    // Calculate Bollinger Bands
    const bbData = [];
    
    // Add null values for the first period - 1
    for (let i = 0; i < period - 1; i++) {
        bbData.push({
            time: data[i].time,
            middle: null,
            upper: null,
            lower: null
        });
    }
    
    // Calculate bands for the rest of the data
    for (let i = period - 1; i < closes.length; i++) {
        // Get the subset of prices for this period
        const periodPrices = closes.slice(i - period + 1, i + 1);
        
        // Calculate standard deviation
        const mean = sma[i - period + 1];
        let sumSquaredDiff = 0;
        
        for (let j = 0; j < periodPrices.length; j++) {
            sumSquaredDiff += Math.pow(periodPrices[j] - mean, 2);
        }
        
        const stdDev = Math.sqrt(sumSquaredDiff / period);
        
        // Calculate bands
        bbData.push({
            time: data[i].time,
            middle: mean,
            upper: mean + (stdDevMultiplier * stdDev),
            lower: mean - (stdDevMultiplier * stdDev)
        });
    }
    
    return bbData;
}

// Calculate Simple Moving Average (SMA)
function calculateSMA(data, period) {
    const result = [];
    
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j];
            }
            result.push(sum / period);
        }
    }
    
    return result;
}

// Calculate Exponential Moving Average (EMA)
function calculateEMA(data, period) {
    const result = [];
    const multiplier = 2 / (period + 1);
    
    // First value is SMA
    let smaFirst = 0;
    for (let i = 0; i < period; i++) {
        smaFirst += data[i];
    }
    smaFirst /= period;
    
    result.push(smaFirst);
    
    // Calculate EMA for the rest
    for (let i = 1; i < data.length - period + 1; i++) {
        const ema = (data[i + period - 1] - result[i - 1]) * multiplier + result[i - 1];
        result.push(ema);
    }
    
    return result;
}
