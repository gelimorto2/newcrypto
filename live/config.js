/**
 * Configuration for Binance Trading Bot
 * Contains default settings and configuration values
 */

// Default bot settings
const DEFAULT_SETTINGS = {
    // Trading parameters
    symbol: 'BTCUSDT',
    timeframe: '1h',
    strategy: 'original',  // Default to original strategy
    amount: 100,
    maxPositions: 3,
    stopLoss: 2,
    takeProfit: 5,
    
    // Notification settings
    notifications: {
        discordWebhook: '',
        notifyTrades: true,
        notifySignals: true,
        notifyErrors: true
    },
    
    // Strategy parameters
    strategyParams: {
        original: {
            shortPeriod: 12,
            longPeriod: 26,
            signalPeriod: 9,
            overbought: 0.5,
            oversold: -0.5
        },
        macd: {
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            overbought: 0.5,
            oversold: -0.5
        },
        rsi: {
            period: 14,
            overbought: 70,
            oversold: 30
        },
        bb: {
            period: 20,
            stdDev: 2
        }
    }
};

// Supported trading pairs
const SUPPORTED_PAIRS = [
    'BTCUSDT',
    'ETHUSDT',
    'BNBUSDT',
    'ADAUSDT',
    'DOGEUSDT',
    'SOLUSDT',
    'XRPUSDT',
    'DOTUSDT',
    'MATICUSDT',
    'LINKUSDT'
];

// Supported timeframes
const SUPPORTED_TIMEFRAMES = [
    { value: '1m', label: '1 minute' },
    { value: '5m', label: '5 minutes' },
    { value: '15m', label: '15 minutes' },
    { value: '30m', label: '30 minutes' },
    { value: '1h', label: '1 hour' },
    { value: '4h', label: '4 hours' },
    { value: '1d', label: '1 day' },
    { value: '1w', label: '1 week' }
];

// Supported trading strategies
const SUPPORTED_STRATEGIES = [
    { value: 'original', label: 'Original Strategy' },
    { value: 'macd', label: 'MACD (Moving Average Convergence Divergence)' },
    { value: 'rsi', label: 'RSI (Relative Strength Index)' },
    { value: 'bb', label: 'Bollinger Bands' }
];

// Trading fee rate (percentage)
const TRADING_FEE_RATE = 0.1;

// Auto-save settings interval (milliseconds)
const AUTO_SAVE_INTERVAL = 60000; // 1 minute

// Chart update interval (milliseconds)
const CHART_UPDATE_INTERVAL = 5000; // 5 seconds

// Position check interval (milliseconds)
