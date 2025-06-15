/**
 * Trading Strategies Module
 * 
 * Contains implementations of various trading strategies
 * with optimized calculation methods
 */

/**
 * Base Strategy class
 */
class Strategy {
  constructor(name, description) {
    this.name = name;
    this.description = description;
    this.parameters = {};
  }

  /**
   * Set strategy parameters
   * @param {Object} params - Strategy parameters
   */
  setParameters(params) {
    this.parameters = { ...this.parameters, ...params };
  }

  /**
   * Generate trading signal based on market data
   * @param {Array<number>} prices - Price data
   * @param {Array<number>} volumes - Volume data
   * @returns {Object|null} - Trading signal or null if no signal
   */
  generateSignal(prices, volumes) {
    throw new Error('Method not implemented');
  }

  /**
   * Validate that there's enough data to run the strategy
   * @param {Array<number>} prices - Price data
   * @param {number} minLength - Minimum required data points
   * @returns {boolean} - Whether there's enough data
   */
  validateDataLength(prices, minLength) {
    return Array.isArray(prices) && prices.length >= minLength;
  }
}

/**
 * Bollinger Bands with Volume Strategy
 * Optimized implementation with incremental calculations
 */
export class BollingerBandsVolumeStrategy extends Strategy {
  constructor() {
    super(
      'Bollinger Bands with Volume',
      'Signals based on price breaking Bollinger Bands with volume confirmation'
    );
    
    this.parameters = {
      bbLength: 20,
      bbDeviation: 2,
      volumeCandles: 3,
      volumeIncrease: 20
    };
    
    // Cache for optimized calculations
    this.smaCache = {
      lastValue: null,
      lastPrices: null
    };
    
    this.stdDevCache = {
      lastValue: null,
      lastPrices: null,
      lastSma: null
    };
  }

  /**
   * Calculate Simple Moving Average with optimization
   * Uses previous calculation when possible
   * @param {Array<number>} prices - Price data
   * @param {number} period - Period for SMA
   * @returns {number} - SMA value
   */
  calculateSMA(prices, period) {
    if (!this.validateDataLength(prices, period)) {
      return 0;
    }
    
    const pricesSlice = prices.slice(-period);
    
    // Check if we can use the cached value
    if (
      this.smaCache.lastValue !== null &&
      this.smaCache.lastPrices !== null &&
      prices.length > period
    ) {
      const oldestPrice = prices[prices.length - period - 1];
      const newestPrice = prices[prices.length - 1];
      
      // If only the newest price has changed, we can do an incremental update
      if (arraysEqual(
        this.smaCache.lastPrices.slice(0, -1),
        pricesSlice.slice(0, -1)
      )) {
        const oldestPriceInLastCalc = this.smaCache.lastPrices[0];
        const sma = this.smaCache.lastValue + 
                    (newestPrice - oldestPriceInLastCalc) / period;
        
        // Update cache
        this.smaCache.lastValue = sma;
        this.smaCache.lastPrices = pricesSlice;
        
        return sma;
      }
    }
    
    // Calculate from scratch if needed
    const sum = pricesSlice.reduce((acc, price) => acc + price, 0);
    const sma = sum / period;
    
    // Update cache
    this.smaCache.lastValue = sma;
    this.smaCache.lastPrices = pricesSlice;
    
    return sma;
  }

  /**
   * Calculate Standard Deviation with optimization
   * @param {Array<number>} prices - Price data
   * @param {number} sma - Simple Moving Average
   * @param {number} period - Period
   * @returns {number} - Standard deviation
   */
  calculateStdDev(prices, sma, period) {
    if (!this.validateDataLength(prices, period)) {
      return 0;
    }
    
    const pricesSlice = prices.slice(-period);
    
    // Check if we can use the cached value
    if (
      this.stdDevCache.lastValue !== null &&
      this.stdDevCache.lastPrices !== null &&
      this.stdDevCache.lastSma === sma &&
      arraysEqual(this.stdDevCache.lastPrices, pricesSlice)
    ) {
      return this.stdDevCache.lastValue;
    }
    
    // Calculate from scratch
    const squaredDiffs = pricesSlice.map(price => {
      const diff = price - sma;
      return diff * diff;
    });
    
    const avgSquareDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / period;
    const stdDev = Math.sqrt(avgSquareDiff);
    
    // Update cache
    this.stdDevCache.lastValue = stdDev;
    this.stdDevCache.lastPrices = pricesSlice;
    this.stdDevCache.lastSma = sma;
    
    return stdDev;
  }

  /**
   * Calculate average volume over a period
   * @param {Array<number>} volumes - Volume data
   * @param {number} period - Period for average
   * @returns {number} - Average volume
   */
  calculateAverageVolume(volumes, period) {
    if (!this.validateDataLength(volumes, period)) {
      return 0;
    }
    
    const volumesSlice = volumes.slice(-period);
    const sum = volumesSlice.reduce((acc, volume) => acc + volume, 0);
    return sum / period;
  }

  /**
   * Generate trading signal based on strategy
   * @param {Array<number>} prices - Price data
   * @param {Array<number>} volumes - Volume data
   * @returns {Object|null} - Trading signal or null
   */
  generateSignal(prices, volumes) {
    const { bbLength, bbDeviation, volumeCandles, volumeIncrease } = this.parameters;
    
    // Ensure we have enough data
    if (!this.validateDataLength(prices, Math.max(30, bbLength)) || 
        !this.validateDataLength(volumes, Math.max(30, bbLength))) {
      return null;
    }
    
    // Get current price and calculate indicators
    const currentPrice = prices[prices.length - 1];
    const sma = this.calculateSMA(prices, bbLength);
    const stdDev = this.calculateStdDev(prices, sma, bbLength);
    
    // Calculate Bollinger Bands
    const upperBand = sma + (stdDev * bbDeviation);
    const lowerBand = sma - (stdDev * bbDeviation);
    
    // Check volume condition
    const recentVolumes = volumes.slice(-volumeCandles);
    const avgVolume = this.calculateAverageVolume(volumes, 30); // 30-period volume average
    const currentVolume = recentVolumes[recentVolumes.length - 1];
    const volumeIncreasePercent = (currentVolume / avgVolume) * 100 - 100;
    
    // Generate signals
    if (currentPrice <= lowerBand && volumeIncreasePercent >= volumeIncrease) {
      return {
        type: 'LONG',
        price: currentPrice,
        confidence: calculateConfidence(
          currentPrice, lowerBand, volumeIncreasePercent, volumeIncrease
        ),
        reason: 'Price below lower Bollinger Band with volume confirmation'
      };
    } else if (currentPrice >= upperBand && volumeIncreasePercent >= volumeIncrease) {
      return {
        type: 'SHORT',
        price: currentPrice,
        confidence: calculateConfidence(
          currentPrice, upperBand, volumeIncreasePercent, volumeIncrease
        ),
        reason: 'Price above upper Bollinger Band with volume confirmation'
      };
    }
    
    return null;
  }
}

/**
 * Calculate signal confidence (0-100%)
 * @param {number} price - Current price
 * @param {number} band - Bollinger band value
 * @param {number} volumeIncrease - Actual volume increase percentage
 * @param {number} minVolumeIncrease - Minimum required volume increase
 * @returns {number} - Confidence value (0-100)
 */
function calculateConfidence(price, band, volumeIncrease, minVolumeIncrease) {
  // Price deviation factor (how far price is from the band)
  const priceFactor = Math.min(Math.abs(price - band) / band * 100, 5) / 5;
  
  // Volume factor (how much volume exceeds the minimum required)
  const volumeFactor = Math.min((volumeIncrease - minVolumeIncrease) / 50, 1);
  
  // Combined confidence
  return Math.round((priceFactor * 0.6 + volumeFactor * 0.4) * 100);
}

/**
 * Compare two arrays for equality
 * @param {Array} a - First array
 * @param {Array} b - Second array
 * @returns {boolean} - Whether arrays are equal
 */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Export available strategies
export const strategies = {
  bollingerBandsVolume: new BollingerBandsVolumeStrategy()
};
