# Volty Strategy Backtester

## Overview
This module provides comprehensive backtesting capabilities for the Volty trading strategy using Streamlit.

## Features
- Real-time data fetching from Binance API
- Interactive parameter tuning
- Advanced performance metrics
- Visual charts and equity curves
- Trade history analysis

## Running the Backtester

### Requirements
Install required packages:
```bash
pip install streamlit pandas numpy plotly requests
```

### Usage
1. Navigate to the backtest directory
2. Run the Streamlit app:
```bash
streamlit run backtest.py
```
3. Open your browser to the provided URL (usually http://localhost:8501)
4. Configure strategy parameters in the sidebar
5. Click "Run Backtest" to analyze performance

## Strategy Parameters
- **ATR Length**: Period for Average True Range calculation (1-50)
- **ATR Multiplier**: Multiplier for signal generation (0.1-5.0)
- **Initial Capital**: Starting capital for backtest ($1,000-$1,000,000)
- **Position Size**: Percentage of capital per trade (1-100%)

## Performance Metrics
- Total Return %
- Win Rate
- Profit Factor
- Maximum Drawdown
- Sharpe Ratio
- Trade Statistics

## Data Sources
- Binance API for historical price data
- Supports multiple timeframes (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w)
- Multiple cryptocurrency pairs (BTC, ETH, ADA, SOL, BNB, XRP)