"""
AI Models for Crypto Trading Prediction
Centralized AI functionality for the trading bot
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, r2_score
import joblib
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import warnings
warnings.filterwarnings('ignore')

class AIModel:
    """Base class for AI prediction models"""
    
    def __init__(self, name: str, timeframe: str, lookback_period: int = 50):
        self.name = name
        self.timeframe = timeframe
        self.lookback_period = lookback_period
        self.model = None
        self.scaler = StandardScaler()
        self.is_trained = False
        self.performance_metrics = {}
        
    def prepare_features(self, data: pd.DataFrame) -> np.ndarray:
        """Prepare features for the model"""
        # Technical indicators
        data = data.copy()
        
        # Price-based features
        data['returns'] = data['close'].pct_change()
        data['volatility'] = data['returns'].rolling(window=20).std()
        data['price_change'] = data['close'].diff()
        data['high_low_pct'] = (data['high'] - data['low']) / data['close']
        
        # Moving averages
        for period in [5, 10, 20, 50]:
            data[f'sma_{period}'] = data['close'].rolling(window=period).mean()
            data[f'price_to_sma_{period}'] = data['close'] / data[f'sma_{period}']
        
        # RSI
        delta = data['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        data['rsi'] = 100 - (100 / (1 + rs))
        
        # MACD
        exp1 = data['close'].ewm(span=12).mean()
        exp2 = data['close'].ewm(span=26).mean()
        data['macd'] = exp1 - exp2
        data['macd_signal'] = data['macd'].ewm(span=9).mean()
        data['macd_histogram'] = data['macd'] - data['macd_signal']
        
        # Volume indicators
        data['volume_sma'] = data['volume'].rolling(window=20).mean()
        data['volume_ratio'] = data['volume'] / data['volume_sma']
        
        # Bollinger Bands
        bb_period = 20
        bb_std = 2
        bb_middle = data['close'].rolling(window=bb_period).mean()
        bb_std_dev = data['close'].rolling(window=bb_period).std()
        data['bb_upper'] = bb_middle + (bb_std_dev * bb_std)
        data['bb_lower'] = bb_middle - (bb_std_dev * bb_std)
        data['bb_position'] = (data['close'] - data['bb_lower']) / (data['bb_upper'] - data['bb_lower'])
        
        # Select features for training
        feature_columns = [
            'returns', 'volatility', 'price_change', 'high_low_pct',
            'price_to_sma_5', 'price_to_sma_10', 'price_to_sma_20', 'price_to_sma_50',
            'rsi', 'macd', 'macd_signal', 'macd_histogram',
            'volume_ratio', 'bb_position'
        ]
        
        features = data[feature_columns].dropna()
        return features.values
    
    def create_sequences(self, features: np.ndarray, prices: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Create sequences for time series prediction"""
        X, y = [], []
        for i in range(self.lookback_period, len(features)):
            X.append(features[i-self.lookback_period:i].flatten())
            y.append(prices[i])
        return np.array(X), np.array(y)
    
    def train(self, data: pd.DataFrame) -> Dict:
        """Train the model"""
        raise NotImplementedError("Subclasses must implement train method")
    
    def predict(self, data: pd.DataFrame) -> Dict:
        """Make prediction"""
        raise NotImplementedError("Subclasses must implement predict method")
    
    def evaluate(self, data: pd.DataFrame) -> Dict:
        """Evaluate model performance"""
        if not self.is_trained:
            return {"error": "Model not trained"}
        
        features = self.prepare_features(data)
        if len(features) < self.lookback_period + 10:
            return {"error": "Insufficient data for evaluation"}
        
        prices = data['close'].values[-len(features):]
        X, y = self.create_sequences(features, prices)
        
        if len(X) == 0:
            return {"error": "No sequences created"}
        
        X_scaled = self.scaler.transform(X)
        predictions = self.model.predict(X_scaled)
        
        mse = mean_squared_error(y, predictions)
        r2 = r2_score(y, predictions)
        
        return {
            "mse": mse,
            "rmse": np.sqrt(mse),
            "r2": r2,
            "predictions": predictions.tolist(),
            "actual": y.tolist()
        }

class RandomForestModel(AIModel):
    """Random Forest based prediction model"""
    
    def __init__(self, name: str, timeframe: str, lookback_period: int = 50, n_estimators: int = 100):
        super().__init__(name, timeframe, lookback_period)
        self.n_estimators = n_estimators
        self.model = RandomForestRegressor(n_estimators=n_estimators, random_state=42)
    
    def train(self, data: pd.DataFrame) -> Dict:
        """Train the Random Forest model"""
        try:
            features = self.prepare_features(data)
            if len(features) < self.lookback_period + 10:
                return {"success": False, "error": "Insufficient data for training"}
            
            prices = data['close'].values[-len(features):]
            X, y = self.create_sequences(features, prices)
            
            if len(X) == 0:
                return {"success": False, "error": "No sequences created"}
            
            # Split data for training and validation
            split_idx = int(0.8 * len(X))
            X_train, X_val = X[:split_idx], X[split_idx:]
            y_train, y_val = y[:split_idx], y[split_idx:]
            
            # Scale features
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_val_scaled = self.scaler.transform(X_val)
            
            # Train model
            self.model.fit(X_train_scaled, y_train)
            self.is_trained = True
            
            # Evaluate
            train_pred = self.model.predict(X_train_scaled)
            val_pred = self.model.predict(X_val_scaled)
            
            train_r2 = r2_score(y_train, train_pred)
            val_r2 = r2_score(y_val, val_pred)
            
            self.performance_metrics = {
                "train_r2": train_r2,
                "val_r2": val_r2,
                "train_rmse": np.sqrt(mean_squared_error(y_train, train_pred)),
                "val_rmse": np.sqrt(mean_squared_error(y_val, val_pred))
            }
            
            return {
                "success": True,
                "metrics": self.performance_metrics,
                "feature_importance": self.model.feature_importances_.tolist()
            }
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def predict(self, data: pd.DataFrame) -> Dict:
        """Make prediction with Random Forest"""
        if not self.is_trained:
            return {"error": "Model not trained"}
        
        try:
            features = self.prepare_features(data)
            if len(features) < self.lookback_period:
                return {"error": "Insufficient data for prediction"}
            
            # Use last sequence for prediction
            last_sequence = features[-self.lookback_period:].flatten().reshape(1, -1)
            last_sequence_scaled = self.scaler.transform(last_sequence)
            
            # Make prediction
            prediction = self.model.predict(last_sequence_scaled)[0]
            current_price = data['close'].iloc[-1]
            
            # Calculate prediction confidence (using prediction variance from trees)
            predictions_from_trees = np.array([tree.predict(last_sequence_scaled)[0] for tree in self.model.estimators_])
            confidence = 1.0 - (np.std(predictions_from_trees) / np.mean(predictions_from_trees))
            
            return {
                "prediction": prediction,
                "current_price": current_price,
                "price_change": prediction - current_price,
                "price_change_pct": ((prediction - current_price) / current_price) * 100,
                "confidence": confidence,
                "signal": "BUY" if prediction > current_price else "SELL",
                "strength": abs((prediction - current_price) / current_price) * 100
            }
        
        except Exception as e:
            return {"error": str(e)}

class GradientBoostingModel(AIModel):
    """Gradient Boosting based prediction model"""
    
    def __init__(self, name: str, timeframe: str, lookback_period: int = 50, n_estimators: int = 100):
        super().__init__(name, timeframe, lookback_period)
        self.n_estimators = n_estimators
        self.model = GradientBoostingRegressor(n_estimators=n_estimators, random_state=42)
    
    def train(self, data: pd.DataFrame) -> Dict:
        """Train the Gradient Boosting model"""
        try:
            features = self.prepare_features(data)
            if len(features) < self.lookback_period + 10:
                return {"success": False, "error": "Insufficient data for training"}
            
            prices = data['close'].values[-len(features):]
            X, y = self.create_sequences(features, prices)
            
            if len(X) == 0:
                return {"success": False, "error": "No sequences created"}
            
            # Split data
            split_idx = int(0.8 * len(X))
            X_train, X_val = X[:split_idx], X[split_idx:]
            y_train, y_val = y[:split_idx], y[split_idx:]
            
            # Scale features
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_val_scaled = self.scaler.transform(X_val)
            
            # Train model
            self.model.fit(X_train_scaled, y_train)
            self.is_trained = True
            
            # Evaluate
            train_pred = self.model.predict(X_train_scaled)
            val_pred = self.model.predict(X_val_scaled)
            
            train_r2 = r2_score(y_train, train_pred)
            val_r2 = r2_score(y_val, val_pred)
            
            self.performance_metrics = {
                "train_r2": train_r2,
                "val_r2": val_r2,
                "train_rmse": np.sqrt(mean_squared_error(y_train, train_pred)),
                "val_rmse": np.sqrt(mean_squared_error(y_val, val_pred))
            }
            
            return {
                "success": True,
                "metrics": self.performance_metrics,
                "feature_importance": self.model.feature_importances_.tolist()
            }
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def predict(self, data: pd.DataFrame) -> Dict:
        """Make prediction with Gradient Boosting"""
        if not self.is_trained:
            return {"error": "Model not trained"}
        
        try:
            features = self.prepare_features(data)
            if len(features) < self.lookback_period:
                return {"error": "Insufficient data for prediction"}
            
            # Use last sequence for prediction
            last_sequence = features[-self.lookback_period:].flatten().reshape(1, -1)
            last_sequence_scaled = self.scaler.transform(last_sequence)
            
            # Make prediction
            prediction = self.model.predict(last_sequence_scaled)[0]
            current_price = data['close'].iloc[-1]
            
            # Calculate confidence based on staged prediction variance
            staged_predictions = list(self.model.staged_predict(last_sequence_scaled))
            recent_predictions = staged_predictions[-10:]  # Last 10 stages
            confidence = 1.0 - (np.std(recent_predictions) / np.mean(recent_predictions))
            
            return {
                "prediction": prediction,
                "current_price": current_price,
                "price_change": prediction - current_price,
                "price_change_pct": ((prediction - current_price) / current_price) * 100,
                "confidence": confidence,
                "signal": "BUY" if prediction > current_price else "SELL",
                "strength": abs((prediction - current_price) / current_price) * 100
            }
        
        except Exception as e:
            return {"error": str(e)}

class AIModelManager:
    """Central manager for AI models"""
    
    def __init__(self):
        self.models = {}
        self.timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']
        self.model_types = {
            'random_forest': RandomForestModel,
            'gradient_boosting': GradientBoostingModel
        }
        
    def create_model(self, model_type: str, name: str, timeframe: str, **kwargs) -> bool:
        """Create a new AI model"""
        if model_type not in self.model_types:
            return False
        
        model_class = self.model_types[model_type]
        model = model_class(name, timeframe, **kwargs)
        
        model_id = f"{name}_{timeframe}_{model_type}"
        self.models[model_id] = model
        return True
    
    def train_model(self, model_id: str, data: pd.DataFrame) -> Dict:
        """Train a specific model"""
        if model_id not in self.models:
            return {"success": False, "error": "Model not found"}
        
        return self.models[model_id].train(data)
    
    def predict_with_model(self, model_id: str, data: pd.DataFrame) -> Dict:
        """Make prediction with a specific model"""
        if model_id not in self.models:
            return {"error": "Model not found"}
        
        return self.models[model_id].predict(data)
    
    def compare_models(self, model_ids: List[str], data: pd.DataFrame) -> Dict:
        """Compare multiple models"""
        results = {}
        
        for model_id in model_ids:
            if model_id in self.models:
                evaluation = self.models[model_id].evaluate(data)
                prediction = self.models[model_id].predict(data)
                
                results[model_id] = {
                    "evaluation": evaluation,
                    "prediction": prediction,
                    "model_info": {
                        "name": self.models[model_id].name,
                        "timeframe": self.models[model_id].timeframe,
                        "is_trained": self.models[model_id].is_trained
                    }
                }
        
        return results
    
    def get_model_list(self) -> List[Dict]:
        """Get list of all models"""
        model_list = []
        for model_id, model in self.models.items():
            model_list.append({
                "id": model_id,
                "name": model.name,
                "timeframe": model.timeframe,
                "type": type(model).__name__,
                "is_trained": model.is_trained,
                "performance": model.performance_metrics
            })
        return model_list
    
    def save_model(self, model_id: str, filepath: str) -> bool:
        """Save a trained model"""
        if model_id not in self.models or not self.models[model_id].is_trained:
            return False
        
        try:
            model_data = {
                "model": self.models[model_id].model,
                "scaler": self.models[model_id].scaler,
                "metadata": {
                    "name": self.models[model_id].name,
                    "timeframe": self.models[model_id].timeframe,
                    "lookback_period": self.models[model_id].lookback_period,
                    "performance_metrics": self.models[model_id].performance_metrics
                }
            }
            joblib.dump(model_data, filepath)
            return True
        except Exception:
            return False
    
    def load_model(self, model_id: str, filepath: str) -> bool:
        """Load a saved model"""
        try:
            model_data = joblib.load(filepath)
            metadata = model_data["metadata"]
            
            # Create appropriate model type based on the saved model
            if model_id.endswith('random_forest'):
                model = RandomForestModel(metadata["name"], metadata["timeframe"], metadata["lookback_period"])
            elif model_id.endswith('gradient_boosting'):
                model = GradientBoostingModel(metadata["name"], metadata["timeframe"], metadata["lookback_period"])
            else:
                return False
            
            model.model = model_data["model"]
            model.scaler = model_data["scaler"]
            model.is_trained = True
            model.performance_metrics = metadata["performance_metrics"]
            
            self.models[model_id] = model
            return True
        except Exception:
            return False

# Global model manager instance
model_manager = AIModelManager()

def initialize_default_models():
    """Initialize default models for different timeframes"""
    timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']
    
    for timeframe in timeframes:
        # Create Random Forest models
        model_manager.create_model(
            'random_forest', 
            f'RF_{timeframe}', 
            timeframe, 
            lookback_period=50, 
            n_estimators=100
        )
        
        # Create Gradient Boosting models
        model_manager.create_model(
            'gradient_boosting', 
            f'GB_{timeframe}', 
            timeframe, 
            lookback_period=50, 
            n_estimators=100
        )

# Initialize default models on import
initialize_default_models()