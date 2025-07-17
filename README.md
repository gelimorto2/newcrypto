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

## Installation Guide

### Prerequisites
- **Python 3.8+**: Required for AI backend and backtesting
- **Modern Web Browser**: Chrome, Firefox, Safari, or Edge
- **Internet Connection**: For crypto data APIs (CoinGecko, Binance fallback)

### Step-by-Step Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/gelimorto2/newcrypto.git
cd newcrypto
```

#### 2. Install Python Dependencies
```bash
# Install all AI and backend dependencies
pip install -r ai_requirements.txt

# Optional: Install backtest-specific dependencies
pip install -r backtest/requirements.txt
```

**Dependencies Installed**:
- **Core ML**: scikit-learn, numpy, pandas, joblib
- **Web Framework**: flask, flask-cors
- **Visualization**: plotly, matplotlib, seaborn
- **Data Fetching**: requests (for API calls)
- **Development**: pytest, black, flake8

#### 3. Start the AI Backend (Optional)
```bash
# Start the Flask API server for AI features
python ai_api.py
```
The server will start on `http://localhost:5000` with verbose logging enabled.

#### 4. Open the Web Interface
```bash
# Navigate to the project directory and open in browser
# Option 1: Direct file access
open index.html

# Option 2: Simple HTTP server (recommended)
python -m http.server 8000
# Then open http://localhost:8000 in your browser
```

#### 5. Configure Data Sources (Automatic)
The application automatically uses:
- **Primary**: CoinGecko API (no setup required)
- **Fallback**: Binance API (automatic fallback)

**No API keys required** for basic functionality!

### Configuration Options

#### Verbose Logging
Verbose logging is enabled by default. To see detailed logs:
1. Open browser Developer Tools (F12)
2. Navigate to Console tab
3. Start trading or fetch data to see logs

Example log output:
```
[2025-01-13T10:30:45.123Z] [CryptoDataService] 🚀 CryptoDataService initialized with CoinGecko API
[2025-01-13T10:30:46.234Z] [CryptoDataService] 📡 Making API request to: /simple/price
[2025-01-13T10:30:46.567Z] [CryptoDataService] ✅ API request successful (333ms)
```

#### Custom API Configuration (Advanced)
For advanced users who want to use CoinGecko Pro API:

1. Get a CoinGecko Pro API key from https://www.coingecko.com/en/api
2. Edit `live/js/crypto-data-service.js`:
   ```javascript
   const cryptoDataService = new CryptoDataService({
     apiKey: 'your-api-key-here',
     useProApi: true
   });
   ```

### Verification Steps

#### 1. Test Backend API
```bash
# Test if AI backend is running
curl http://localhost:5000/api/health
# Expected response: {"status": "healthy", "models": 14}
```

#### 2. Test Data Sources
1. Open `test-crypto-service.html` in your browser
2. Open Developer Tools Console
3. Click "Test CoinGecko Price" button
4. Verify successful API calls in console

#### 3. Test Trading Interface
1. Open `paper/paper.html` for paper trading
2. Open `live/live.html` for live trading interface
3. Check console for verbose logging output
4. Verify data is loading successfully

### Troubleshooting

#### Common Issues

**1. "Axios library not loaded" Error**
- **Solution**: Refresh the page to ensure all scripts load properly
- **Cause**: Network issues or script loading order

**2. CoinGecko API Rate Limiting**
- **Symptoms**: "Rate limit exceeded" in console
- **Solution**: Wait 60 seconds or upgrade to CoinGecko Pro
- **Automatic**: System will retry automatically

**3. No Data Loading**
- **Check**: Browser console for error messages
- **Verify**: Internet connection is active
- **Fallback**: System automatically tries Binance API if CoinGecko fails

**4. Python Dependencies Issues**
```bash
# Update pip and try again
pip install --upgrade pip
pip install -r ai_requirements.txt --force-reinstall
```

#### Enable Debug Mode
For maximum verbosity, edit the crypto data service:
```javascript
// In crypto-data-service.js, change:
this.verbose = true;  // Force verbose mode

// Or create with explicit options:
const service = new CryptoDataService({ verbose: true });
```

### Performance Optimization

#### Rate Limiting
- **CoinGecko Free**: 50 calls/minute (automatic rate limiting)
- **CoinGecko Pro**: Higher limits with API key
- **Binance**: Used as fallback, higher rate limits

#### Caching
The system includes smart caching:
- Market data cached for 60 seconds
- Price data cached for 30 seconds
- Automatic cache invalidation on errors

### Security Notes

#### API Keys
- **Not Required**: CoinGecko free tier needs no authentication
- **Optional**: CoinGecko Pro API key for higher limits
- **Secure Storage**: Any API keys stored in browser's secure storage

#### CORS and Proxies
- **No Proxy Needed**: CoinGecko API supports CORS directly
- **Fallback Proxy**: Binance API may require CORS proxy in some browsers
- **Local Development**: Use `python -m http.server` to avoid file:// protocol issues

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

### Enhanced Data Reliability
- **Dual Data Sources**: Primary CoinGecko API with Binance fallback for maximum uptime
- **No API Key Required**: Reduced security risk with CoinGecko's free tier
- **Rate Limiting**: Built-in protection against API abuse
- **Data Validation**: Comprehensive data quality checks before processing
- **Automatic Fallback**: Seamless switching when primary source is unavailable

### AI Model Validation
- **Continuous accuracy monitoring**: Real-time model performance tracking
- **Confidence Scoring**: Prediction reliability indicators
- **Multi-Model Consensus**: Combine predictions from multiple models
- **Model Validation**: Cross-validation and backtesting capabilities

### Trading Safety
- **Testnet Support**: Test AI strategies without real funds
- **Paper Trading**: Full AI simulation environment with real data
- **Risk Limits**: Automated position sizing and loss limits
- **Secure Storage**: Encrypted API credential storage
- **Real-time Monitoring**: Continuous AI model performance tracking

### Debugging and Monitoring
- **Verbose Logging**: Comprehensive error tracking and performance metrics
- **Response Time Monitoring**: API call performance tracking
- **Data Source Status**: Real-time monitoring of data source health
- **Error Recovery**: Automatic retry logic with exponential backoff
- **Debug Mode**: Enhanced logging for troubleshooting

## Browser Compatibility

- Chrome/Chromium (Recommended)
- Firefox
- Safari
- Edge

## Disclaimer

⚠️ **Important**: This software uses artificial intelligence for trading decisions and enhanced crypto data sources for market analysis. AI models may not predict market movements accurately and past performance does not guarantee future results. 

**Data Source Disclaimer**: This application uses CoinGecko API as the primary data source and Binance API as a fallback. Data accuracy and availability depend on these third-party services. Always verify critical trading decisions with multiple sources.

**Trading Risk**: Cryptocurrency trading involves substantial risk of loss. Never trade with funds you cannot afford to lose. Always test AI strategies thoroughly in paper trading mode before using real funds.

**Technical Disclaimer**: While the enhanced data sources and verbose logging improve reliability and debugging capabilities, no software can guarantee 100% uptime or data accuracy. Always monitor your trading activities and have contingency plans.

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
