/**
 * Trading Strategies for Binance Trading Bot
 * This module contains the Volatility Expansion Close trading strategy
 */

class TradingStrategies {
    /**
     * Execute Volatility Expansion Close strategy
     * @param {Array} candles - Candlestick data
     * @param {Object} params - Strategy parameters
     * @returns {Object|null} - Trading signal or null
     */
    static executeStrategy(strategy, params, candles) {
        if (!candles || candles.length === 0) {
            return null;
        }
        
        // We only support the Volatility Expansion Close strategy
        return this.volatilityExpansionClose(candles, params);
    }
    
    /**
     * Volatility Expansion Close strategy
     * Based on the PineScript:
     * 
     * //@version=6
     * strategy("Volty Expan Close Strategy", overlay=true)
     * length = input(5, "Length")
     * numATRs = input(0.75, "ATR Mult")
     * atrs = ta.sma(ta.tr, length)*numATRs
     * if (not na(close[length]))
     *   strategy.entry("VltClsLE", strategy.long, stop=close+atrs, comment = "VltClsLE")
     *   strategy.entry("VltClsSE", strategy.short, stop=close-atrs, comment = "VltClsSE")
     * 
     * @param {Array} candles - Candlestick data
     * @param {Object} params - Strategy parameters (length, atrMult)
     * @returns {Object} - Signal and values
     */
    static volatilityExpansionClose(candles, params = {}) {
        // Default parameters if not provided
        const length = params.length || 5;
        const numATRs = params.atrMult || 0.75;
        
        // Need enough candles for calculation
        if (candles.length < length + 1) {
            return { values: {}, signal: null };
        }
        
        // Calculate True Range (TR) for each candle
        const trueRanges = [];
        for (let i = 1; i < candles.length; i++) {
            const high = parseFloat(candles[i].high);
            const low = parseFloat(candles[i].low);
            const prevClose = parseFloat(candles[i-1].close);
            
            // True Range = max(high - low, abs(high - prevClose), abs(low - prevClose))
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            trueRanges.push(tr);
        }
        
        // Calculate Simple Moving Average (SMA) of True Range
        const smaValues = [];
        for (let i = length - 1; i < trueRanges.length; i++) {
            const trSlice = trueRanges.slice(i - length + 1, i + 1);
            const sum = trSlice.reduce((total, val) => total + val, 0);
            const sma = sum / length;
            smaValues.push(sma);
        }
        
        // Get the current SMA of TR
        const currentSMA = smaValues[smaValues.length - 1];
        
        // Calculate ATR band value
        const atrs = currentSMA * numATRs;
        
        // Get current close price
        const currentClose = parseFloat(candles[candles.length - 1].close);
        
        // Calculate long and short entry prices
        const longEntry = currentClose + atrs;
        const shortEntry = currentClose - atrs;
        
        // Check for signals
        let signal = null;
        const previousCandle = candles[candles.length - 2];
        const previousClose = parseFloat(previousCandle.close);
        const previousHigh = parseFloat(previousCandle.high);
        const previousLow = parseFloat(previousCandle.low);
        
        // Check if current price breaks above or below the bands
        if (currentClose > previousClose + atrs) {
            // Long signal
            signal = {
                action: 'BUY',
                price: currentClose,
                reason: 'VOLTY_EXPAN_CLOSE_LONG'
            };
        } else if (currentClose < previousClose - atrs) {
            // Short signal
            signal = {
                action: 'SELL',
                price: currentClose,
                reason: 'VOLTY_EXPAN_CLOSE_SHORT'
            };
        }
        
        return {
            values: {
                length: length,
                atrMult: numATRs,
                atr: currentSMA,
                atrs: atrs,
                longEntry: longEntry,
                shortEntry: shortEntry
            },
            signal: signal
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
}
