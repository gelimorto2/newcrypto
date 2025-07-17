# AI Crypto Trading Bot

An advanced AI-powered cryptocurrency trading bot with machine learning predictions, custom charting, and intelligent trading strategies. Now featuring enhanced data sources and verbose logging for better reliability and debugging.

## Features

### 🤖 AI-Powered Trading
- **Machine Learning Models**: Random Forest, Gradient Boosting algorithms
- **Multi-Timeframe Predictions**: 1m to 1d timeframe analysis
- **Confidence Scoring**: Each prediction includes confidence levels
- **Feature Engineering**: Advanced technical indicator analysis
- **Model Comparison**: Side-by-side performance analysis

### 📊 Advanced Analytics & Visualization
- **Custom Chart Engine**: Plotly-based charts with AI prediction overlays
- **Real-time Predictions**: Live AI model predictions with confidence bands
- **Performance Metrics**: R², RMSE, accuracy tracking
- **Signal Visualization**: Buy/sell signals with strength indicators

### 🎯 Trading Modes
- **AI Paper Trading**: Risk-free simulation with AI predictions
- **AI Live Trading**: Real trading with machine learning insights
- **Model Training**: Train custom AI models on historical data
- **Backtesting**: Historical performance analysis with AI models

### 🔧 Advanced Features
- **Enhanced Data Sources**: CoinGecko API integration (primary) with Binance fallback
- **Verbose Logging**: Detailed console output for debugging and monitoring
- **No API Key Required**: Primary data source (CoinGecko) requires no authentication
- **Automatic Fallback**: Seamless switching between data sources for reliability
- **Centralized AI System**: Unified AI model management
- **Model Persistence**: Save and load trained models
- **API Backend**: Flask-based REST API for AI operations
- **Responsive Interface**: Modern web UI optimized for AI workflows

## Enhanced Data Sources

### Primary: CoinGecko API
- **Advantages**: No API key required, reliable, comprehensive market data
- **Rate Limits**: 50 calls/minute (free tier)
- **Data Available**: Real-time prices, OHLC data, market metrics, 24h changes
- **Supported Pairs**: All major cryptocurrencies vs USD

### Fallback: Binance API
- **Usage**: Automatic fallback when CoinGecko is unavailable
- **Data Available**: Klines (OHLC), real-time prices, volume data
- **Advantages**: High-frequency data, detailed volume information

### Verbose Logging
- **Real-time Monitoring**: Detailed console logs for all API calls
- **Performance Metrics**: Response times, data quality, source tracking
- **Error Handling**: Comprehensive error logging with retry information
- **Debug Information**: Data validation, processing steps, fallback triggers

## Project Structure

```
newcrypto/
├── index.html              # Main landing page (AI-enabled)
├── live/                   # AI Live trading interface
│   ├── live.html          # AI trading dashboard
│   ├── login.html         # Authentication page
│   ├── css/styles.css     # Styling with AI components
│   └── js/                # JavaScript modules
│       ├── ai-main.js     # AI application logic
│       ├── ai-chart.js    # Custom AI chart engine
│       ├── api-client.js  # API communication
│       ├── position-manager.js
│       ├── ui-manager.js
│       └── secure-storage.js
├── paper/                  # AI Paper trading interface
│   ├── paper.html         # AI paper trading dashboard
│   └── paper.js           # Paper trading with AI logic
├── backtest/              # Backtesting module
│   ├── backtest.py        # Streamlit backtesting app
│   ├── requirements.txt   # Python dependencies
│   └── README.md          # Backtesting documentation
├── ai_models.py           # AI model implementations
├── ai_api.py              # Flask API server for AI operations
├── ai_requirements.txt    # AI-specific dependencies
├── AI_DOCUMENTATION.md    # Comprehensive AI guide
└── README.md              # This file
```

## Getting Started

### 1. Install AI Dependencies
```bash
# Install Python AI dependencies
pip install -r ai_requirements.txt

# Start the AI API server
python ai_api.py
```

**Note**: The enhanced crypto data service uses CoinGecko API as the primary data source, which requires no API key and provides reliable market data. Binance API is used as an automatic fallback.

### 2. Web Interface
Open `index.html` in your browser to access the main interface with links to:
- AI Live Trading Dashboard
- AI Paper Trading Simulator

**Enhanced Features**:
- Real-time verbose logging in browser console
- Automatic data source switching for reliability
- Enhanced market data with 24h changes, volume, and market cap
- Performance monitoring with response times

### 3. AI Paper Trading
1. Navigate to `paper/paper.html`
2. Select AI model type and timeframe
3. Train the model on historical data
4. Start trading with AI predictions
5. Analyze performance and model accuracy

**Data Source Features**:
- Automatic CoinGecko integration for reliable data
- Fallback to Binance API if needed
- Verbose console logging for debugging
- Real-time performance metrics

### 4. AI Live Trading
1. Navigate to `live/live.html`
2. Configure API credentials (Binance) if using live trading features
3. Set up AI model preferences
4. Configure risk management parameters
5. Start AI-powered live trading (use testnet first)

**Enhanced Monitoring**:
- Detailed API call logging
- Data source status indicators
- Response time monitoring
- Error tracking and retry information

### 5. Model Management
1. Train multiple AI models for different timeframes
2. Compare model performance side-by-side
3. Save and load trained models
4. Monitor prediction accuracy and confidence

### 6. Monitoring and Debugging
- **Console Logging**: All API calls, response times, and data processing are logged
- **Data Source Status**: Monitor which data source is being used
- **Error Tracking**: Detailed error information with retry status
- **Performance Metrics**: Response times and data quality indicators

## AI Model Configuration

### Available Models
- **Random Forest**: Ensemble learning with decision trees
- **Gradient Boosting**: Sequential learning for high accuracy
- **Neural Networks**: Deep learning for complex patterns (coming soon)

### Timeframe Support
- **Short-term**: 1m, 5m, 15m (scalping strategies)
- **Medium-term**: 30m, 1h, 4h (intraday trading)
- **Long-term**: 1d (swing trading)

### Feature Engineering
- Price action indicators (OHLC, returns, volatility)
- Volume analysis (ratios, patterns)
- Technical indicators (RSI, MACD, Bollinger Bands)
- Custom feature selection and weighting

## Risk Management

### AI-Enhanced Safety
- **Confidence Thresholds**: Only act on high-confidence predictions
- **Model Validation**: Continuous performance monitoring
- **Prediction Intervals**: Upper and lower confidence bounds
- **Multi-Model Consensus**: Combine predictions from multiple models

### Traditional Risk Controls
- **Position Sizing**: Automated position size calculation
- **Stop Loss/Take Profit**: Configurable risk management
- **Daily Loss Limits**: Maximum drawdown protection
- **Paper Trading**: Risk-free model testing

## Safety Features

- **AI Model Validation**: Continuous accuracy monitoring
- **Testnet Support**: Test AI strategies without real funds
- **Paper Trading**: Full AI simulation environment
- **Confidence Scoring**: Prediction reliability indicators
- **Risk Limits**: Automated position sizing and loss limits
- **Secure Storage**: Encrypted API credential storage
- **Real-time Monitoring**: Continuous AI model performance tracking

## Browser Compatibility

- Chrome/Chromium (Recommended)
- Firefox
- Safari
- Edge

## Disclaimer

⚠️ **Important**: This software uses artificial intelligence for trading decisions. AI models may not predict market movements accurately and past performance does not guarantee future results. Cryptocurrency trading involves substantial risk of loss. Never trade with funds you cannot afford to lose. Always test AI strategies thoroughly in paper trading mode before using real funds.

## Documentation

- **[AI_DOCUMENTATION.md](AI_DOCUMENTATION.md)**: Comprehensive AI features guide
- **API Reference**: See AI API endpoints in `ai_api.py`
- **Model Training**: Detailed guide in AI documentation

## License

All rights reserved. This project is proprietary software.

## Support

For questions about AI features and model configuration, please refer to:
- [AI_DOCUMENTATION.md](AI_DOCUMENTATION.md) for comprehensive AI guide
- Model training tutorials and best practices
- API reference and troubleshooting guides
