/**
 * Configuration Module for Binance Trading Bot
 * Manages global configuration settings and communication parameters
 */

// API Configuration
const API_CONFIG = {
    // Base URLs
    REST_API_URL: 'https://api.binance.com',
    WEBSOCKET_API_URL: 'wss://stream.binance.com:9443/ws',
    TEST_API_URL: 'https://testnet.binance.vision/api',
    TEST_WEBSOCKET_URL: 'wss://testnet.binance.vision/ws',
    
    // API Rate Limits
    RATE_LIMIT_PER_MINUTE: 1200,
    RATE_LIMIT_PER_SECOND: 10,
    
    // Request Timeout
    REQUEST_TIMEOUT_MS: 30000
};

// Trading Bot Default Settings
const DEFAULT_SETTINGS = {
    // Trading Parameters
    symbol: 'BTCUSDT',
    timeframe: '1h',
    strategy: 'original',
    
    // Risk Management
    amount: 100,
    maxPositions: 3,
    stopLoss: 2,
    takeProfit: 5,
    
    // Paper Trading
    initialBalance: 10000,
    
    // Notifications
    notifications: {
        discordWebhookUrl: '',
        notifyTrades: true,
        notifySignals: true,
        notifyErrors: true
    },
    
    // Strategy Parameters
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
            signalPeriod: 9
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

// DOM elements mapping
const DOM_ELEMENTS = {
    // Dashboard elements
    balanceDisplay: 'balance-display',
    positionsCount: 'positions-count',
    pnlToday: 'pnl-today',
    startBotButton: 'start-bot',
    stopBotButton: 'stop-bot',
    positionsContainer: 'positions-container',
    tradesTable: 'trades-table',
    priceChart: 'price-chart',
    
    // Settings elements
    apiKeyDisplay: 'api-key-display',
    apiSecretDisplay: 'api-secret-display',
    updateApiKeysButton: 'update-api-keys',
    symbolSelect: 'symbol',
    timeframeSelect: 'timeframe',
    strategySelect: 'strategy',
    
    // Connection status
    connectionStatus: 'connection-status',
    connectionDetails: 'connection-details',
    wsIndicator: 'ws-indicator'
};

// WebSocket channels mapping
const WEBSOCKET_CHANNELS = {
    kline: {
        format: '{symbol}@kline_{interval}',
        description: 'Candlestick updates for a symbol and interval'
    },
    trade: {
        format: '{symbol}@trade',
        description: 'Real-time trade updates'
    },
    ticker: {
        format: '{symbol}@ticker',
        description: '24hr rolling window ticker statistics'
    },
    depth: {
        format: '{symbol}@depth',
        description: 'Order book updates'
    },
    miniTicker: {
        format: '{symbol}@miniTicker',
        description: 'Simplified ticker information'
    }
};

// Event types
const EVENT_TYPES = {
    TRADE_EXECUTED: 'trade_executed',
    POSITION_UPDATED: 'position_updated',
    SIGNAL_GENERATED: 'signal_generated',
    PRICE_UPDATED: 'price_updated',
    CONNECTION_CHANGED: 'connection_changed',
    ERROR_OCCURRED: 'error_occurred'
};

// For communication with the DOM
document.addEventListener('DOMContentLoaded', () => {
    // Expose configuration to window for testing
    window.BOT_CONFIG = {
        API_CONFIG,
        DEFAULT_SETTINGS,
        DOM_ELEMENTS,
        WEBSOCKET_CHANNELS,
        EVENT_TYPES
    };
    
    // Dispatch event to notify that config is loaded
    document.dispatchEvent(new CustomEvent('bot-config-loaded'));
});
