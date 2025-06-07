/**
 * Trading Strategies for Binance Trading Bot
 * This module contains various trading strategies
 */

class TradingStrategies {
    /**
     * Calculate MACD (Moving Average Convergence Divergence)
     * @param {Array} candles - Candlestick data
     * @param {Object} params - MACD parameters
     * @returns {Object} - MACD values and signal
     */
    static macd(candles, params = {}) {
        const { fastPeriod = 12, slowPeriod = 26, signalPeriod = 9 } = params;
        
        if (candles.length < slowPeriod + signalPeriod) {
            return { values: [], signal: null };
        }
        
        // Extract closing prices
        const prices = candles.map(candle => parseFloat(candle.close));
        
        // Calculate EMAs
        const fastEMA = this.calculateEMA(prices, fastPeriod);
        const slowEMA = this.calculateEMA(prices, slowPeriod);
        
        // Calculate MACD line
        const macdLine = [];
        for (let i = 0; i < prices.length; i++) {
            if (i < slowPeriod - 1) {
                macdLine.push(null);
            } else {
                macdLine.push(fastEMA[i] - slowEMA[i]);
            }
        }
        
        // Calculate signal line (EMA of MACD line)
        const signalLine = this.calculateEMA(
            macdLine.slice(slowPeriod - 1), 
            signalPeriod
        );
        
        // Add null values to match array lengths
        const paddedSignalLine = Array(slowPeriod + signalPeriod - 2).fill(null).concat(signalLine);
        
        // Calculate histogram (MACD line - Signal line)
        const histogram = [];
        for (let i = 0; i < macdLine.length; i++) {
            if (macdLine[i] === null || paddedSignalLine[i] === null) {
                histogram.push(null);
            } else {
                histogram.push(macdLine[i] - paddedSignalLine[i]);
            }
        }
        
        // Generate trading signal
        let signal = null;
        const last = histogram.length - 1;
        const secondLast = histogram.length - 2;
        
        if (histogram[last] !== null && histogram[secondLast] !== null) {
            // Bullish crossover
            if (histogram[secondLast] < 0 && histogram[last] > 0) {
                signal = 'BUY';
            }
            // Bearish crossover
            else if (histogram[secondLast] > 0 && histogram[last] < 0) {
                signal = 'SELL';
            }
        }
        
        return {
            values: {
                macdLine,
                signalLine: paddedSignalLine,
                histogram
            },
            signal
        };
    }
    
    /**
     * Calculate RSI (Relative Strength Index)
     * @param {Array} candles - Candlestick data
     * @param {Object} params - RSI parameters
     * @returns {Object} - RSI values and signal
     */
    static rsi(candles, params = {}) {
        const { period = 14, overbought = 70, oversold = 30 } = params;
        
        if (candles.length < period + 1) {
            return { values: [], signal: null };
        }
        
        // Extract closing prices
        const prices = candles.map(candle => parseFloat(candle.close));
        
        // Calculate price changes
        const changes = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i - 1]);
        }
        
        // Calculate gains and losses
        const gains = changes.map(change => change > 0 ? change : 0);
        const losses = changes.map(change => change < 0 ? -change : 0);
        
        // Calculate average gains and losses
        const avgGain = this.calculateSMA(gains, period);
        const avgLoss = this.calculateSMA(losses, period);
        
        // Calculate RS and RSI
        const rs = [];
        const rsi = [];
        
        for (let i = 0; i < avgGain.length; i++) {
            if (avgLoss[i] === 0) {
                rs.push(100);
                rsi.push(100);
            } else {
                rs.push(avgGain[i] / avgLoss[i]);
                rsi.push(100 - (100 / (1 + rs[i])));
            }
        }
        
        // Add null values for the beginning periods
        const paddedRSI = Array(period).fill(null).concat(rsi);
        
        // Generate trading signal
        let signal = null;
        const lastRSI = paddedRSI[paddedRSI.length - 1];
        const prevRSI = paddedRSI[paddedRSI.length - 2];
        
        if (lastRSI !== null && prevRSI !== null) {
            // Oversold to normal (buy signal)
            if (prevRSI < oversold && lastRSI > oversold) {
                signal = 'BUY';
            }
            // Overbought to normal (sell signal)
            else if (prevRSI > overbought && lastRSI < overbought) {
                signal = 'SELL';
            }
        }
        
        return {
            values: paddedRSI,
            signal
        };
    }
    
    /**
     * Calculate Bollinger Bands
     * @param {Array} candles - Candlestick data
     * @param {Object} params - Bollinger Bands parameters
     * @returns {Object} - Bollinger Bands values and signal
     */
    static bollingerBands(candles, params = {}) {
        const { period = 20, stdDev = 2 } = params;
        
        if (candles.length < period) {
            return { values: [], signal: null };
        }
        
        // Extract closing prices
        const prices = candles.map(candle => parseFloat(candle.close));
        
        // Calculate middle band (SMA)
        const middleBand = this.calculateSMA(prices, period);
        
        // Calculate standard deviation and bands
        const upperBand = [];
        const lowerBand = [];
        const bandwidth = [];
        
        for (let i = period - 1; i < prices.length; i++) {
            const windowPrices = prices.slice(i - period + 1, i + 1);
            const sma = middleBand[i - period + 1];
            
            // Calculate standard deviation
            const squaredDiffs = windowPrices.map(price => Math.pow(price - sma, 2));
            const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / period;
            const sd = Math.sqrt(variance);
            
            // Calculate bands
            upperBand.push(sma + (stdDev * sd));
            lowerBand.push(sma - (stdDev * sd));
            
            // Calculate bandwidth
            bandwidth.push((upperBand[i - period + 1] - lowerBand[i - period + 1]) / sma);
        }
        
        // Add null values for the beginning periods
        const paddedMiddleBand = Array(period - 1).fill(null).concat(middleBand);
        const paddedUpperBand = Array(period - 1).fill(null).concat(upperBand);
        const paddedLowerBand = Array(period - 1).fill(null).concat(lowerBand);
        const paddedBandwidth = Array(period - 1).fill(null).concat(bandwidth);
        
        // Generate trading signal
        let signal = null;
        const lastPrice = prices[prices.length - 1];
        const lastUpper = paddedUpperBand[paddedUpperBand.length - 1];
        const lastLower = paddedLowerBand[paddedLowerBand.length - 1];
        const prevPrice = prices[prices.length - 2];
        
        if (lastPrice !== null && prevPrice !== null) {
            // Price crosses below lower band (buy signal)
            if (prevPrice < lastLower && lastPrice >= lastLower) {
                signal = 'BUY';
            }
            // Price crosses above upper band (sell signal)
            else if (prevPrice > lastUpper && lastPrice <= lastUpper) {
                signal = 'SELL';
            }
        }
        
        return {
            values: {
                middle: paddedMiddleBand,
                upper: paddedUpperBand,
                lower: paddedLowerBand,
                bandwidth: paddedBandwidth
            },
            signal
        };
    }
    
    /**
     * Calculate Simple Moving Average (SMA)
     * @param {Array} values - Input values
     * @param {number} period - Period
     * @returns {Array} - SMA values
     */
    static calculateSMA(values, period) {
        const sma = [];
        
        for (let i = period - 1; i < values.length; i++) {
            const windowValues = values.slice(i - period + 1, i + 1);
            const sum = windowValues.reduce((total, value) => total + value, 0);
            sma.push(sum / period);
        }
        
        return sma;
    }
    
    /**
     * Calculate Exponential Moving Average (EMA)
     * @param {Array} values - Input values
     * @param {number} period - Period
     * @returns {Array} - EMA values
     */
    static calculateEMA(values, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        
        // Start with SMA for the first period
        const firstSMA = values.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
        ema.push(firstSMA);
        
        // Calculate EMA for the rest
        for (let i = period; i < values.length; i++) {
            const prevEMA = ema[ema.length - 1];
            const newEMA = (values[i] - prevEMA) * multiplier + prevEMA;
            ema.push(newEMA);
        }
        
        // Add null values for the beginning periods
        return Array(period - 1).fill(null).concat(ema);
    }
    
    /**
     * Execute trading strategy based on type and parameters
     * @param {string} strategy - Strategy type
     * @param {Object} params - Strategy parameters
     * @param {Array} candles - Candlestick data
     * @returns {Object|null} - Trading signal or null
     */
    static executeStrategy(strategy, params, candles) {
        if (!candles || candles.length === 0) {
            return null;
        }
        
        let result;
        
        switch (strategy) {
            case 'macd':
                result = this.macd(candles, params);
                break;
            case 'rsi':
                result = this.rsi(candles, params);
                break;
            case 'bb':
                result = this.bollingerBands(candles, params);
                break;
            default:
                // Original/custom strategy
                result = this.customStrategy(candles, params);
                break;
        }
        
        if (result && result.signal) {
            const currentPrice = parseFloat(candles[candles.length - 1].close);
            
            return {
                action: result.signal,
                price: currentPrice,
                reason: `${strategy.toUpperCase()}_SIGNAL`
            };
        }
        
        return null;
    }
    
    /**
     * Custom combined strategy
     * @param {Array} candles - Candlestick data
     * @param {Object} params - Strategy parameters
     * @returns {Object} - Signal
     */
    static customStrategy(candles, params) {
        const { shortPeriod = 12, longPeriod = 26, signalPeriod = 9, overbought = 0.5, oversold = -0.5 } = params;
        
        // Combine MACD and RSI for more reliable signals
        const macdResult = this.macd(candles, { fastPeriod: shortPeriod, slowPeriod: longPeriod, signalPeriod });
        const rsiResult = this.rsi(candles, { period: 14, overbought: 70, oversold: 30 });
        
        let signal = null;
        
        // Get the latest MACD histogram value
        const histogram = macdResult.values.histogram;
        const lastHistogram = histogram[histogram.length - 1];
        const prevHistogram = histogram[histogram.length - 2];
        
        // Get the latest RSI value
        const rsi = rsiResult.values;
        const lastRSI = rsi[rsi.length - 1];
        
        // Generate signals based on combined indicators
        if (lastHistogram !== null && prevHistogram !== null && lastRSI !== null) {
            // Bullish signal: MACD crosses above 0 and RSI is not overbought
            if (prevHistogram < oversold && lastHistogram > oversold && lastRSI < 70) {
                signal = 'BUY';
            }
            // Bearish signal: MACD crosses below 0 and RSI is not oversold
            else if (prevHistogram > overbought && lastHistogram < overbought && lastRSI > 30) {
                signal = 'SELL';
            }
        }
        
        return { values: {}, signal };
    }
}
