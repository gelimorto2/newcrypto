"""
AI Trading Bot Backend API
Flask-based API for AI model management and predictions
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta
import os
import sys

# Add the parent directory to path to import ai_models and crypto service
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ai_models import model_manager, AIModelManager

# Import enhanced crypto data service
try:
    from crypto_data_service import enhanced_crypto_service, EnhancedCryptoDataService
    crypto_service_available = True
except ImportError:
    crypto_service_available = False
    print("⚠️ Enhanced crypto data service not available, using mock data")

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global state
app_state = {
    'models': {},
    'market_data': {},
    'predictions': {},
    'trading_sessions': {}
}

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '3.0.0'
    })

@app.route('/api/models', methods=['GET'])
def get_models():
    """Get list of available AI models"""
    try:
        models = model_manager.get_model_list()
        return jsonify({
            'success': True,
            'models': models
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/create', methods=['POST'])
def create_model():
    """Create a new AI model"""
    try:
        data = request.get_json()
        model_type = data.get('model_type')
        name = data.get('name')
        timeframe = data.get('timeframe')
        
        if not all([model_type, name, timeframe]):
            return jsonify({
                'success': False,
                'error': 'Missing required parameters'
            }), 400
        
        success = model_manager.create_model(
            model_type, name, timeframe,
            lookback_period=data.get('lookback_period', 50),
            n_estimators=data.get('n_estimators', 100)
        )
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to create model'
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/<model_id>/train', methods=['POST'])
def train_model(model_id):
    """Train a specific AI model"""
    try:
        data = request.get_json()
        market_data = data.get('market_data')
        
        if not market_data:
            return jsonify({
                'success': False,
                'error': 'Market data required for training'
            }), 400
        
        # Convert market data to DataFrame
        df = pd.DataFrame(market_data)
        df['datetime'] = pd.to_datetime(df['datetime'])
        
        # Train the model
        result = model_manager.train_model(model_id, df)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/<model_id>/predict', methods=['POST'])
def predict_with_model(model_id):
    """Make a prediction with a specific model"""
    try:
        data = request.get_json()
        market_data = data.get('market_data')
        
        if not market_data:
            return jsonify({
                'error': 'Market data required for prediction'
            }), 400
        
        # Convert market data to DataFrame
        df = pd.DataFrame(market_data)
        df['datetime'] = pd.to_datetime(df['datetime'])
        
        # Make prediction
        prediction = model_manager.predict_with_model(model_id, df)
        return jsonify(prediction)
        
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/api/models/compare', methods=['POST'])
def compare_models():
    """Compare multiple AI models"""
    try:
        data = request.get_json()
        model_ids = data.get('model_ids', [])
        market_data = data.get('market_data')
        
        if not model_ids:
            return jsonify({
                'error': 'Model IDs required'
            }), 400
            
        if not market_data:
            return jsonify({
                'error': 'Market data required for comparison'
            }), 400
        
        # Convert market data to DataFrame
        df = pd.DataFrame(market_data)
        df['datetime'] = pd.to_datetime(df['datetime'])
        
        # Compare models
        results = model_manager.compare_models(model_ids, df)
        return jsonify(results)
        
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/api/models/<model_id>/evaluate', methods=['POST'])
def evaluate_model(model_id):
    """Evaluate model performance"""
    try:
        data = request.get_json()
        market_data = data.get('market_data')
        
        if not market_data:
            return jsonify({
                'error': 'Market data required for evaluation'
            }), 400
        
        # Convert market data to DataFrame
        df = pd.DataFrame(market_data)
        df['datetime'] = pd.to_datetime(df['datetime'])
        
        # Get model and evaluate
        if model_id not in model_manager.models:
            return jsonify({
                'error': 'Model not found'
            }), 404
        
        evaluation = model_manager.models[model_id].evaluate(df)
        return jsonify(evaluation)
        
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/api/crypto/price/<symbol>', methods=['GET'])
def get_crypto_price(symbol):
    """Get current price for a cryptocurrency symbol using enhanced service"""
    try:
        if crypto_service_available:
            # Use enhanced crypto data service
            price_data = enhanced_crypto_service.get_current_price(symbol)
            
            return jsonify({
                'success': True,
                'data': {
                    'symbol': price_data.symbol,
                    'price': price_data.price,
                    'change_24h': price_data.change_24h,
                    'volume_24h': price_data.volume_24h,
                    'high_24h': price_data.high_24h,
                    'low_24h': price_data.low_24h,
                    'timestamp': price_data.timestamp.isoformat(),
                    'source': price_data.source
                }
            })
        else:
            # Fallback to mock data
            mock_price = np.random.uniform(40000, 70000) if symbol.upper().startswith('BTC') else np.random.uniform(2000, 4000)
            return jsonify({
                'success': True,
                'data': {
                    'symbol': symbol,
                    'price': round(mock_price, 2),
                    'change_24h': round(np.random.uniform(-5, 5), 2),
                    'volume_24h': round(np.random.uniform(1000000, 10000000), 2),
                    'timestamp': datetime.now().isoformat(),
                    'source': 'mock'
                }
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/crypto/ohlc/<symbol>', methods=['GET'])
def get_crypto_ohlc(symbol):
    """Get OHLC data for a cryptocurrency symbol"""
    try:
        timeframe = request.args.get('timeframe', '1d')
        limit = int(request.args.get('limit', 100))
        
        if crypto_service_available:
            # Use enhanced crypto data service
            ohlc_data = enhanced_crypto_service.get_ohlc_data(symbol, timeframe, limit)
            
            formatted_data = []
            for candle in ohlc_data:
                formatted_data.append({
                    'timestamp': candle.timestamp.isoformat(),
                    'open': candle.open,
                    'high': candle.high,
                    'low': candle.low,
                    'close': candle.close,
                    'volume': candle.volume,
                    'timeframe': candle.timeframe,
                    'source': candle.source
                })
            
            return jsonify({
                'success': True,
                'symbol': symbol,
                'timeframe': timeframe,
                'data': formatted_data
            })
        else:
            # Generate mock OHLC data
            data = generate_mock_market_data(symbol, timeframe, limit)
            return jsonify({
                'success': True,
                'symbol': symbol,
                'timeframe': timeframe,
                'data': data,
                'source': 'mock'
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/crypto/status', methods=['GET'])
def get_crypto_service_status():
    """Get status of crypto data service"""
    try:
        if crypto_service_available:
            status = enhanced_crypto_service.get_exchange_status()
            return jsonify({
                'success': True,
                'service_available': True,
                'status': status
            })
        else:
            return jsonify({
                'success': True,
                'service_available': False,
                'status': {
                    'message': 'Enhanced crypto service not available, using mock data',
                    'fallback_mode': True
                }
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/crypto/multiple-prices', methods=['POST'])
def get_multiple_crypto_prices():
    """Get prices for multiple cryptocurrency symbols"""
    try:
        data = request.get_json()
        symbols = data.get('symbols', [])
        
        if not symbols:
            return jsonify({
                'success': False,
                'error': 'No symbols provided'
            }), 400
        
        if crypto_service_available:
            # Use enhanced crypto data service
            results = enhanced_crypto_service.get_multiple_prices(symbols)
            
            formatted_results = {}
            for symbol, price_data in results.items():
                formatted_results[symbol] = {
                    'symbol': price_data.symbol,
                    'price': price_data.price,
                    'change_24h': price_data.change_24h,
                    'volume_24h': price_data.volume_24h,
                    'timestamp': price_data.timestamp.isoformat(),
                    'source': price_data.source
                }
            
            return jsonify({
                'success': True,
                'data': formatted_results
            })
        else:
            # Generate mock data for all symbols
            results = {}
            for symbol in symbols:
                mock_price = np.random.uniform(40000, 70000) if symbol.upper().startswith('BTC') else np.random.uniform(1000, 5000)
                results[symbol] = {
                    'symbol': symbol,
                    'price': round(mock_price, 2),
                    'change_24h': round(np.random.uniform(-5, 5), 2),
                    'volume_24h': round(np.random.uniform(1000000, 10000000), 2),
                    'timestamp': datetime.now().isoformat(),
                    'source': 'mock'
                }
            
            return jsonify({
                'success': True,
                'data': results
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/market-data/<symbol>', methods=['GET'])
def get_market_data(symbol):
    """Get market data for a symbol"""
    try:
        timeframe = request.args.get('timeframe', '1h')
        limit = int(request.args.get('limit', 100))
        
        # Generate mock data for now - replace with real API call
        data = generate_mock_market_data(symbol, timeframe, limit)
        
        return jsonify({
            'success': True,
            'symbol': symbol,
            'timeframe': timeframe,
            'data': data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/trading/session/start', methods=['POST'])
def start_trading_session():
    """Start a new trading session"""
    try:
        data = request.get_json()
        session_id = data.get('session_id', f"session_{datetime.now().timestamp()}")
        
        app_state['trading_sessions'][session_id] = {
            'start_time': datetime.now().isoformat(),
            'active': True,
            'trades': [],
            'balance': data.get('initial_balance', 10000),
            'settings': data.get('settings', {})
        }
        
        return jsonify({
            'success': True,
            'session_id': session_id
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/trading/session/<session_id>/stop', methods=['POST'])
def stop_trading_session(session_id):
    """Stop a trading session"""
    try:
        if session_id in app_state['trading_sessions']:
            app_state['trading_sessions'][session_id]['active'] = False
            app_state['trading_sessions'][session_id]['end_time'] = datetime.now().isoformat()
            
            return jsonify({'success': True})
        else:
            return jsonify({
                'success': False,
                'error': 'Session not found'
            }), 404
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/trading/session/<session_id>/status', methods=['GET'])
def get_session_status(session_id):
    """Get trading session status"""
    try:
        if session_id in app_state['trading_sessions']:
            return jsonify({
                'success': True,
                'session': app_state['trading_sessions'][session_id]
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Session not found'
            }), 404
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def generate_mock_market_data(symbol, timeframe, limit):
    """Generate mock market data for testing"""
    data = []
    base_price = 50000 if 'BTC' in symbol else 3000 if 'ETH' in symbol else 100
    current_price = base_price
    
    # Calculate time delta based on timeframe
    time_deltas = {
        '1m': timedelta(minutes=1),
        '5m': timedelta(minutes=5),
        '15m': timedelta(minutes=15),
        '30m': timedelta(minutes=30),
        '1h': timedelta(hours=1),
        '4h': timedelta(hours=4),
        '1d': timedelta(days=1)
    }
    
    delta = time_deltas.get(timeframe, timedelta(hours=1))
    start_time = datetime.now() - (delta * limit)
    
    for i in range(limit):
        timestamp = start_time + (delta * i)
        
        # Generate OHLCV data
        open_price = current_price
        change = (np.random.random() - 0.5) * current_price * 0.02  # 2% max change
        close_price = open_price + change
        
        high_price = max(open_price, close_price) + abs(change) * np.random.random()
        low_price = min(open_price, close_price) - abs(change) * np.random.random()
        
        volume = np.random.randint(1000000, 10000000)
        
        data.append({
            'datetime': timestamp.isoformat(),
            'open': round(open_price, 2),
            'high': round(high_price, 2),
            'low': round(low_price, 2),
            'close': round(close_price, 2),
            'volume': volume
        })
        
        current_price = close_price
    
    return data

@app.route('/api/predictions/<model_id>/history', methods=['GET'])
def get_prediction_history(model_id):
    """Get prediction history for a model"""
    try:
        history = app_state['predictions'].get(model_id, [])
        return jsonify({
            'success': True,
            'model_id': model_id,
            'predictions': history
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/<model_id>/save', methods=['POST'])
def save_model(model_id):
    """Save a trained model to disk"""
    try:
        data = request.get_json()
        filepath = data.get('filepath', f'models/{model_id}.joblib')
        
        # Ensure models directory exists
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        success = model_manager.save_model(model_id, filepath)
        
        if success:
            return jsonify({'success': True, 'filepath': filepath})
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to save model'
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/<model_id>/load', methods=['POST'])
def load_model(model_id):
    """Load a saved model from disk"""
    try:
        data = request.get_json()
        filepath = data.get('filepath', f'models/{model_id}.joblib')
        
        if not os.path.exists(filepath):
            return jsonify({
                'success': False,
                'error': 'Model file not found'
            }), 404
        
        success = model_manager.load_model(model_id, filepath)
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to load model'
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Create models directory if it doesn't exist
    os.makedirs('models', exist_ok=True)
    
    # Initialize default models
    print("Initializing AI Trading Bot API...")
    print(f"Available models: {len(model_manager.get_model_list())}")
    
    # Run the Flask app
    app.run(debug=True, host='0.0.0.0', port=5000)