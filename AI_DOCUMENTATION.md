# AI Trading Bot Documentation

## Overview

The AI Trading Bot v3.0.0 is an advanced cryptocurrency trading platform that leverages machine learning models for price prediction and automated trading decisions. This version completely replaces the traditional TradingView charts and strategy-based approaches with AI-powered predictions.

## Key Features

### 🤖 AI-Powered Predictions
- **Multiple ML Models**: Random Forest, Gradient Boosting, and Neural Networks
- **Multi-Timeframe Analysis**: Support for 1m, 5m, 15m, 30m, 1h, 4h, and 1d timeframes
- **Confidence Scoring**: Each prediction includes a confidence level (0-100%)
- **Feature Engineering**: Technical indicators, price action, and volume analysis

### 📊 Advanced Charting
- **Custom Chart Engine**: Plotly-based charts replacing TradingView
- **AI Prediction Overlay**: Visual representation of model predictions
- **Confidence Bands**: Upper and lower bounds for prediction uncertainty
- **Signal Visualization**: Buy/sell signals with strength indicators

### 🔬 Model Management
- **Model Comparison**: Side-by-side performance analysis
- **Training Interface**: Train models on historical data
- **Performance Metrics**: R², RMSE, accuracy tracking
- **Model Persistence**: Save and load trained models

### 🎯 Trading Modes
- **Live Trading**: Real-time trading with AI predictions
- **Paper Trading**: Risk-free simulation environment
- **Backtesting**: Historical performance analysis

## Architecture

### Frontend Components

1. **AI Chart Interface** (`ai-chart.js`)
   - Custom charting engine
   - Prediction visualization
   - Interactive model selection

2. **AI Main Application** (`ai-main.js`)
   - Core application logic
   - Model management
   - Trading orchestration

3. **Model Comparison** (`ModelComparison` class)
   - Performance comparison tools
   - Visual metrics display

### Backend Components

1. **AI Models** (`ai_models.py`)
   - Machine learning model implementations
   - Feature engineering pipeline
   - Model training and prediction logic

2. **API Server** (`ai_api.py`)
   - Flask-based REST API
   - Model management endpoints
   - Real-time prediction service

## Installation

### Prerequisites
```bash
# Install Python dependencies
pip install -r ai_requirements.txt

# For development
pip install -r requirements.txt  # If you have additional dev dependencies
```

### Running the Application

1. **Start the AI API Server**:
   ```bash
   python ai_api.py
   ```
   This starts the Flask server on `http://localhost:5000`

2. **Open the Web Interface**:
   - Open `index.html` in your browser
   - Choose between Live Trading or Paper Trading
   - The interface will automatically connect to the API

## Usage Guide

### Getting Started

1. **Select Trading Mode**:
   - Click "AI Live Trading" for real trading
   - Click "AI Paper Trading" for simulation

2. **Configure AI Model**:
   - Choose model type (Random Forest, Gradient Boosting)
   - Select prediction timeframe
   - Set confidence threshold
   - Configure features (price action, volume, indicators)

3. **Train Model**:
   - Click "Train Model" to train on historical data
   - Wait for training completion
   - Review performance metrics

4. **Start Trading**:
   - Click "Start Trading" to begin AI-powered trading
   - Monitor predictions and signals
   - Adjust settings as needed

### AI Model Configuration

#### Model Types

1. **Random Forest**
   - Ensemble of decision trees
   - Good for non-linear patterns
   - Resistant to overfitting
   - Provides feature importance

2. **Gradient Boosting**
   - Sequential learning approach
   - Excellent predictive accuracy
   - Handles complex relationships
   - Confidence intervals

#### Features

- **Price Action**: OHLC data, returns, volatility
- **Volume**: Trading volume patterns and ratios
- **RSI**: Relative Strength Index (14-period)
- **MACD**: Moving Average Convergence Divergence
- **Bollinger Bands**: Price position within bands

#### Timeframes

Each model can be trained for specific timeframes:
- **1m-15m**: Short-term scalping strategies
- **30m-1h**: Intraday trading
- **4h-1d**: Swing trading and position holding

### Model Comparison

1. **Access Comparison Tool**:
   - Click "Compare Models" in the widget panel
   - Select multiple models to compare
   - Review performance metrics side-by-side

2. **Metrics Analyzed**:
   - **Prediction Accuracy**: R² score
   - **Signal Quality**: Buy/sell signal performance
   - **Confidence**: Average prediction confidence
   - **Consistency**: Prediction stability over time

### Risk Management

#### Built-in Safety Features

1. **Confidence Thresholds**: Only act on high-confidence predictions
2. **Position Sizing**: Configurable position size limits
3. **Stop Loss/Take Profit**: Automated risk management
4. **Daily Loss Limits**: Maximum daily loss protection

#### Best Practices

1. **Start with Paper Trading**: Test strategies risk-free
2. **Use Conservative Settings**: Lower position sizes initially
3. **Monitor Performance**: Regular model retraining
4. **Diversify Timeframes**: Use multiple models for different horizons

## API Reference

### Model Endpoints

- `GET /api/models` - List all available models
- `POST /api/models/create` - Create new model
- `POST /api/models/{id}/train` - Train specific model
- `POST /api/models/{id}/predict` - Get prediction
- `POST /api/models/compare` - Compare multiple models

### Trading Endpoints

- `POST /api/trading/session/start` - Start trading session
- `POST /api/trading/session/{id}/stop` - Stop trading session
- `GET /api/trading/session/{id}/status` - Get session status

### Data Endpoints

- `GET /api/market-data/{symbol}` - Get market data
- `GET /api/predictions/{model_id}/history` - Prediction history

## Troubleshooting

### Common Issues

1. **Model Training Fails**
   - Check data quality and quantity
   - Ensure sufficient historical data (100+ candles)
   - Verify feature selection

2. **Poor Prediction Accuracy**
   - Retrain on more recent data
   - Adjust feature selection
   - Try different model types

3. **API Connection Issues**
   - Ensure Flask server is running
   - Check CORS settings
   - Verify endpoint URLs

### Performance Optimization

1. **Model Performance**:
   - Regular retraining (weekly/monthly)
   - Feature engineering improvements
   - Hyperparameter tuning

2. **System Performance**:
   - Limit historical data size
   - Use efficient data structures
   - Implement caching for predictions

## Development

### Adding New Models

1. **Extend AIModel Class**:
   ```python
   class CustomModel(AIModel):
       def train(self, data):
           # Implementation
           pass
       
       def predict(self, data):
           # Implementation
           pass
   ```

2. **Register in ModelManager**:
   ```python
   model_manager.model_types['custom'] = CustomModel
   ```

3. **Update Frontend**:
   - Add model option to selectors
   - Update model comparison interface

### Testing

1. **Unit Tests**:
   ```bash
   pytest tests/test_ai_models.py
   ```

2. **Integration Tests**:
   ```bash
   pytest tests/test_api.py
   ```

3. **Manual Testing**:
   - Paper trading with various models
   - Performance comparison
   - UI functionality verification

## Support

For technical support or questions:
- Review this documentation
- Check the troubleshooting section
- Submit issues via the project repository

## License

All rights reserved. This project is proprietary software.

---

**Version**: 3.0.0  
**Last Updated**: 2025-01-13  
**Compatibility**: Chrome, Firefox, Safari, Edge