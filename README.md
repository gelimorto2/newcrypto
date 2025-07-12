# Crypto Trading Bot

A comprehensive multi-platform cryptocurrency trading bot with paper trading, live trading, and backtesting capabilities.

## Features

### 🚀 Trading Modes
- **Paper Trading**: Risk-free simulation with virtual funds
- **Live Trading**: Real trading with Binance API integration
- **Backtesting**: Historical performance analysis

### 🎯 Strategy Support
- Bollinger Bands with Volume analysis
- ATR-based Volty strategy
- Custom strategy builder
- Multiple indicator support (RSI, MACD, SMA, EMA)

### 📊 Analytics & Visualization
- Real-time price charts
- Performance metrics (Win rate, Profit factor, Sharpe ratio)
- Trade history analysis
- Equity curve visualization
- Risk management tools

### 🔧 Advanced Features
- Grayscale UI theme for professional appearance
- Responsive web interface
- Secure API credential storage
- Real-time notifications (Discord, Telegram, Email, Browser)
- Position management with stop-loss and take-profit
- Trailing stop functionality

## Project Structure

```
newcrypto/
├── index.html              # Main landing page
├── live/                   # Live trading interface
│   ├── live.html          # Live trading dashboard
│   ├── login.html         # Authentication page
│   ├── css/styles.css     # Styling
│   └── js/                # JavaScript modules
│       ├── main.js        # Main application logic
│       ├── api-client.js  # API communication
│       ├── position-manager.js
│       ├── trading-strategies.js
│       ├── ui-manager.js
│       └── secure-storage.js
├── paper/                  # Paper trading interface
│   ├── paper.html         # Paper trading dashboard
│   └── paper.js           # Paper trading logic
├── backtest/              # Backtesting module
│   ├── backtest.py        # Streamlit backtesting app
│   ├── requirements.txt   # Python dependencies
│   └── README.md          # Backtesting documentation
└── README.md              # This file
```

## Getting Started

### 1. Web Interface
Open `index.html` in your browser to access the main interface with links to:
- Live Trading Dashboard
- Paper Trading Simulator

### 2. Paper Trading
1. Navigate to `paper/paper.html`
2. Configure strategy parameters
3. Start trading with virtual funds
4. Analyze performance and refine strategies

### 3. Live Trading
1. Navigate to `live/live.html`
2. Configure API credentials (Binance)
3. Set up risk management parameters
4. Start live trading (use testnet first)

### 4. Backtesting
1. Navigate to `backtest/` directory
2. Install Python dependencies: `pip install -r requirements.txt`
3. Run: `streamlit run backtest.py`
4. Configure parameters and run historical analysis

## Configuration

### API Setup (Live Trading)
1. Create Binance account and generate API keys
2. Enable spot trading permissions
3. Use testnet for initial testing
4. Configure in the API Configuration modal

### Risk Management
- Set position size limits (1-100% of capital)
- Configure stop-loss and take-profit levels
- Enable trailing stops for dynamic exits
- Set maximum drawdown limits

## Strategy Builder

The integrated strategy builder allows you to:
- Define custom entry/exit conditions
- Select from multiple technical indicators
- Set risk/reward ratios
- Save strategies for backtesting

## Safety Features

- **Testnet Support**: Test strategies without real funds
- **Paper Trading**: Full simulation environment
- **Risk Limits**: Automatic position sizing and loss limits
- **Secure Storage**: Encrypted API credential storage
- **Real-time Monitoring**: Continuous position tracking

## Browser Compatibility

- Chrome/Chromium (Recommended)
- Firefox
- Safari
- Edge

## Disclaimer

⚠️ **Important**: This software is for educational and research purposes only. Cryptocurrency trading involves substantial risk of loss. Never trade with funds you cannot afford to lose. Always test strategies thoroughly in paper trading mode before using real funds.

## License

All rights reserved. This project is proprietary software.

## Support

For questions and support, please refer to the documentation in each module's directory.
