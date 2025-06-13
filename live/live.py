import streamlit as st
import pandas as pd
import numpy as np
import ccxt
import datetime
import time
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import json
import os
import hmac
import hashlib
import requests
from urllib.parse import urlencode
import uuid
import base64
from PIL import Image
import io

# Set page configuration
st.set_page_config(
    page_title="Volty Trading Bot",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
def local_css():
    st.markdown("""
    <style>
        :root {
            --primary-color: #4f46e5;
            --primary-hover: #4338ca;
            --secondary-color: #1f2937;
            --success-color: #22c55e;
            --warning-color: #f59e0b;
            --danger-color: #ef4444;
            --info-color: #3b82f6;
            --text-light: #f3f4f6;
            --text-muted: #9ca3af;
            --border-color: #374151;
            --bg-dark: #111827;
        }
        
        .stApp {
            background-color: var(--bg-dark);
            color: var(--text-light);
        }
        
        .stSidebar {
            background-color: var(--secondary-color);
            border-right: 1px solid var(--border-color);
        }
        
        h1, h2, h3, h4, h5, h6 {
            color: var(--text-light);
        }
        
        .stTabs [data-baseweb="tab-list"] {
            gap: 1px;
            background-color: var(--secondary-color);
            border-radius: 4px;
            padding: 0px 5px;
        }
        
        .stTabs [data-baseweb="tab"] {
            height: 40px;
            white-space: pre-wrap;
            background-color: transparent;
            color: var(--text-light);
            border-radius: 4px;
            margin-left: 1px;
            margin-right: 1px;
        }
        
        .stTabs [aria-selected="true"] {
            background-color: var(--primary-color) !important;
            color: white !important;
        }
        
        div[data-testid="stForm"] {
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            padding: 1rem;
            background-color: var(--secondary-color);
        }
        
        button[kind="primary"] {
            background-color: var(--primary-color);
            color: white;
        }
        
        button[kind="primary"]:hover {
            background-color: var(--primary-hover);
            color: white;
        }
        
        button[kind="secondary"] {
            border: 1px solid var(--border-color);
            background-color: var(--secondary-color);
            color: var(--text-light);
        }
        
        .stProgress > div > div {
            background-color: var(--primary-color);
        }
        
        div[data-testid="stMetric"] {
            background-color: var(--secondary-color);
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            padding: 1rem;
        }
        
        div[data-testid="stMetric"] > div:first-child {
            color: var(--text-muted);
        }
        
        div[data-testid="stMetric"] > div:nth-child(2) {
            color: var(--text-light);
            font-size: 1.5rem;
        }
        
        div[data-testid="stDataFrame"] {
            background-color: var(--secondary-color);
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            padding: 0.5rem;
        }
        
        div.Widget > div {
            background-color: var(--secondary-color);
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            padding: 1rem;
        }
        
        div.status-box {
            background-color: var(--secondary-color);
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            padding: 1rem;
            margin-bottom: 1rem;
        }
        
        div.position-box {
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 1rem;
        }
        
        div.position-box.long {
            border-left: 4px solid var(--success-color);
            background-color: rgba(34, 197, 94, 0.1);
        }
        
        div.position-box.short {
            border-left: 4px solid var(--danger-color);
            background-color: rgba(239, 68, 68, 0.1);
        }
        
        div.log-box {
            background-color: var(--secondary-color);
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            padding: 1rem;
            height: 300px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 0.8rem;
        }
        
        span.badge {
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            font-weight: 600;
        }
        
        span.badge-success {
            background-color: var(--success-color);
            color: white;
        }
        
        span.badge-danger {
            background-color: var(--danger-color);
            color: white;
        }
        
        span.badge-warning {
            background-color: var(--warning-color);
            color: white;
        }
        
        span.badge-info {
            background-color: var(--info-color);
            color: white;
        }
        
        span.badge-secondary {
            background-color: var(--secondary-color);
            color: var(--text-light);
            border: 1px solid var(--border-color);
        }
        
        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 5px;
        }
        
        .status-indicator.idle {
            background-color: var(--text-muted);
        }
        
        .status-indicator.active {
            background-color: var(--success-color);
            animation: pulse 1.5s infinite;
        }
        
        .status-indicator.scanning {
            background-color: var(--primary-color);
            animation: pulse 1.5s infinite;
        }
        
        .status-indicator.trading {
            background-color: var(--warning-color);
            animation: pulse 0.7s infinite;
        }
        
        @keyframes pulse {
            0% {
                transform: scale(0.95);
                box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.7);
            }
            
            70% {
                transform: scale(1);
                box-shadow: 0 0 0 5px rgba(79, 70, 229, 0);
            }
            
            100% {
                transform: scale(0.95);
                box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
            }
        }
    </style>
    """, unsafe_allow_html=True)

local_css()

# Initialize session state
if 'initialized' not in st.session_state:
    st.session_state.initialized = False
    
if 'logs' not in st.session_state:
    st.session_state.logs = []
    
if 'current_price' not in st.session_state:
    st.session_state.current_price = 0
    
if 'is_running' not in st.session_state:
    st.session_state.is_running = False
    
if 'is_live_trading' not in st.session_state:
    st.session_state.is_live_trading = False
    
if 'bot_status' not in st.session_state:
    st.session_state.bot_status = 'idle'
    
if 'last_update' not in st.session_state:
    st.session_state.last_update = None
    
if 'trades' not in st.session_state:
    st.session_state.trades = []
    
if 'current_position' not in st.session_state:
    st.session_state.current_position = None
    
if 'klines_data' not in st.session_state:
    st.session_state.klines_data = None

# Constants
AVAILABLE_TIMEFRAMES = {
    '1m': '1 Minute', 
    '5m': '5 Minutes', 
    '15m': '15 Minutes', 
    '30m': '30 Minutes', 
    '1h': '1 Hour', 
    '4h': '4 Hours', 
    '1d': '1 Day'
}

AVAILABLE_SYMBOLS = {
    'BTCUSDT': 'BTC/USDT',
    'ETHUSDT': 'ETH/USDT',
    'BNBUSDT': 'BNB/USDT',
    'SOLUSDT': 'SOL/USDT',
    'ADAUSDT': 'ADA/USDT',
    'DOGEUSDT': 'DOGE/USDT',
    'XRPUSDT': 'XRP/USDT',
    'DOTUSDT': 'DOT/USDT'
}

VERSION = "2.0.0"
BUILD_DATE = "2025-06-13"

# Position class for managing trades
class Position:
    def __init__(self, type, entry_price, size, timestamp=None):
        self.type = type  # 'LONG' or 'SHORT'
        self.entry_price = entry_price
        self.size = size
        self.entry_time = timestamp if timestamp else datetime.datetime.now()
        self.exit_price = None
        self.exit_time = None
        self.take_profit_price = self.calculate_take_profit()
        self.stop_loss_price = self.calculate_stop_loss()
        self.trailing_stop_price = None
        self.highest_price = entry_price if type == 'LONG' else None
        self.lowest_price = entry_price if type == 'SHORT' else None
        self.pnl = 0
        self.pnl_pct = 0
        self.status = 'OPEN'
        self.exit_reason = None
        
    def calculate_take_profit(self):
        if not st.session_state.settings['use_take_profit']:
            return None
            
        tp = self.entry_price * (1 + st.session_state.settings['take_profit_pct'] / 100) if self.type == 'LONG' else \
             self.entry_price * (1 - st.session_state.settings['take_profit_pct'] / 100)
             
        return round(tp, 2)
        
    def calculate_stop_loss(self):
        if not st.session_state.settings['use_stop_loss']:
            return None
            
        sl = self.entry_price * (1 - st.session_state.settings['stop_loss_pct'] / 100) if self.type == 'LONG' else \
             self.entry_price * (1 + st.session_state.settings['stop_loss_pct'] / 100)
             
        return round(sl, 2)
        
    def update_trailing_stop(self, current_price):
        if not st.session_state.settings['use_trailing_stop']:
            return
            
        if self.type == 'LONG' and current_price > self.highest_price:
            self.highest_price = current_price
            self.trailing_stop_price = current_price * (1 - st.session_state.settings['trailing_stop_pct'] / 100)
        elif self.type == 'SHORT' and (self.lowest_price is None or current_price < self.lowest_price):
            self.lowest_price = current_price
            self.trailing_stop_price = current_price * (1 + st.session_state.settings['trailing_stop_pct'] / 100)
    
    def get_unrealized_pnl(self, current_price):
        if self.type == 'LONG':
            return (current_price - self.entry_price) * self.size
        else:
            return (self.entry_price - current_price) * self.size
    
    def get_unrealized_pnl_pct(self, current_price):
        if self.type == 'LONG':
            return (current_price - self.entry_price) / self.entry_price
        else:
            return (self.entry_price - current_price) / self.entry_price
    
    def close(self, exit_price, timestamp=None, reason=None):
        self.exit_price = exit_price
        self.exit_time = timestamp if timestamp else datetime.datetime.now()
        self.status = 'CLOSED'
        self.exit_reason = reason
        
        if self.type == 'LONG':
            self.pnl = (self.exit_price - self.entry_price) * self.size
            self.pnl_pct = (self.exit_price - self.entry_price) / self.entry_price
        else:
            self.pnl = (self.entry_price - self.exit_price) * self.size
            self.pnl_pct = (self.entry_price - self.exit_price) / self.entry_price
            
        return self.pnl

# Exchange API Client
class ExchangeAPIClient:
    def __init__(self, api_key, api_secret, testnet=True):
        self.api_key = api_key
        self.api_secret = api_secret
        self.testnet = testnet
        
        # Base URLs
        self.base_url = 'https://testnet.binance.vision/api' if testnet else 'https://api.binance.com/api'
        self.base_url_v3 = f"{self.base_url}/v3"
        
    def _generate_signature(self, query_string):
        """Generate HMAC SHA256 signature for authentication"""
        signature = hmac.new(
            self.api_secret.encode('utf-8'),
            query_string.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return signature
    
    async def make_request(self, endpoint, method='GET', params=None, signed=False):
        """Make request to Binance API"""
        url = f"{self.base_url_v3}{endpoint}"
        headers = {'X-MBX-APIKEY': self.api_key}
        
        if params is None:
            params = {}
            
        if signed:
            # Add timestamp for signed requests
            params['timestamp'] = int(time.time() * 1000)
            query_string = urlencode(params)
            signature = self._generate_signature(query_string)
            params['signature'] = signature
        
        # Convert params to query string
        query_string = urlencode(params)
        
        # Make request
        try:
            if method == 'GET':
                response = requests.get(f"{url}?{query_string}", headers=headers if signed else {})
            elif method == 'POST':
                response = requests.post(url, params=params, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(f"{url}?{query_string}", headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            add_log(f"API Request Error: {str(e)}", is_error=True)
            raise
    
    async def get_klines(self, symbol, interval, limit=500):
        """Get candlestick data"""
        params = {
            'symbol': symbol,
            'interval': interval,
            'limit': limit
        }
        return await self.make_request('/klines', params=params)
    
    async def get_ticker(self, symbol):
        """Get 24hr ticker price change statistics"""
        params = {'symbol': symbol}
        return await self.make_request('/ticker/24hr', params=params)
    
    async def get_account(self):
        """Get account information (requires signed request)"""
        return await self.make_request('/account', signed=True)
    
    async def place_order(self, symbol, side, type, quantity, price=None):
        """Place a new order (requires signed request)"""
        params = {
            'symbol': symbol,
            'side': side,  # 'BUY' or 'SELL'
            'type': type,  # 'LIMIT', 'MARKET', etc.
            'quantity': quantity
        }
        
        if type == 'LIMIT':
            params['price'] = price
            params['timeInForce'] = 'GTC'
            
        return await self.make_request('/order', method='POST', params=params, signed=True)
    
    async def cancel_order(self, symbol, order_id):
        """Cancel an order (requires signed request)"""
        params = {
            'symbol': symbol,
            'orderId': order_id
        }
        return await self.make_request('/order', method='DELETE', params=params, signed=True)
    
    async def get_open_orders(self, symbol):
        """Get open orders (requires signed request)"""
        params = {'symbol': symbol}
        return await self.make_request('/openOrders', params=params, signed=True)
    
    async def ping(self):
        """Test connectivity to the API"""
        return await self.make_request('/ping')

# Helper functions
def add_log(message, is_positive=False, is_error=False):
    """Add a message to the log with timestamp"""
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    log_type = "positive" if is_positive else "error" if is_error else "normal"
    st.session_state.logs.append({"time": timestamp, "message": message, "type": log_type})
    
    # Keep only the last 100 logs
    if len(st.session_state.logs) > 100:
        st.session_state.logs = st.session_state.logs[-100:]

def load_settings():
    """Load settings from session state or initialize defaults"""
    if 'settings' not in st.session_state:
        st.session_state.settings = {
            # Strategy parameters
            'bb_length': 20,
            'bb_deviation': 2.0,
            'volume_candles': 3,
            'volume_increase': 20,
            
            # Account settings
            'initial_capital': 10000,
            'balance': 10000,
            'position_size': 10,
            
            # Risk management
            'use_take_profit': True,
            'take_profit_pct': 3.0,
            'use_stop_loss': True,
            'stop_loss_pct': 2.0,
            'use_trailing_stop': False,
            'trailing_stop_pct': 1.5,
            
            # Trading settings
            'auto_trade': True,
            'show_position_lines': True,
            
            # API settings
            'api_key': '',
            'api_secret': '',
            'use_testnet': True,
            
            # Notification settings
            'browser_notifications': True,
            'sound_notifications': True,
            'discord_notifications': False,
            'discord_webhook': '',
            
            # Market settings
            'symbol': 'BTCUSDT',
            'timeframe': '1h'
        }
        
    # Initialize balance to initial capital if they're the same
    if st.session_state.settings['balance'] == st.session_state.settings['initial_capital']:
        st.session_state.settings['balance'] = st.session_state.settings['initial_capital']

def save_settings():
    """Save current settings to session state"""
    # Settings are already in session_state.settings
    add_log("Settings saved")

async def fetch_market_data():
    """Fetch market data from the exchange"""
    try:
        # Create exchange client instance
        exchange = ExchangeAPIClient(
            st.session_state.settings['api_key'],
            st.session_state.settings['api_secret'],
            st.session_state.settings['use_testnet']
        )
        
        # Fetch klines data
        klines = await exchange.get_klines(
            st.session_state.settings['symbol'],
            st.session_state.settings['timeframe']
        )
        
        # Process klines data
        prices = []
        volumes = []
        timestamps = []
        
        for candle in klines:
            # Klines format: [open_time, open, high, low, close, volume, ...]
            timestamps.append(datetime.datetime.fromtimestamp(candle[0] / 1000))
            prices.append(float(candle[4]))  # Close price
            volumes.append(float(candle[5]))  # Volume
        
        # Update session state
        st.session_state.klines_data = {
            'timestamps': timestamps,
            'prices': prices,
            'volumes': volumes
        }
        
        # Update current price
        if prices:
            st.session_state.current_price = prices[-1]
            
        st.session_state.last_update = datetime.datetime.now()
        
        add_log(f"Market data updated for {st.session_state.settings['symbol']}")
        return True
        
    except Exception as e:
        add_log(f"Error fetching market data: {str(e)}", is_error=True)
        return False

def calculate_sma(data, period):
    """Calculate Simple Moving Average"""
    if len(data) < period:
        return 0
    return sum(data[-period:]) / period

def calculate_std_dev(data, average, period):
    """Calculate Standard Deviation"""
    if len(data) < period:
        return 0
    
    variance = sum([(x - average) ** 2 for x in data[-period:]]) / period
    return variance ** 0.5

def calculate_bollinger_bands(prices, length=20, deviation=2.0):
    """Calculate Bollinger Bands"""
    sma = calculate_sma(prices, length)
    std_dev = calculate_std_dev(prices, sma, length)
    
    upper_band = sma + (std_dev * deviation)
    lower_band = sma - (std_dev * deviation)
    
    return sma, upper_band, lower_band

async def open_position(position_type):
    """Open a new trading position"""
    try:
        # Close any existing position first
        if st.session_state.current_position:
            await close_position("New signal")
        
        # Calculate position size
        position_size = (st.session_state.settings['balance'] * st.session_state.settings['position_size'] / 100) / st.session_state.current_price
        
        # If live trading, place an actual order
        if st.session_state.is_live_trading and st.session_state.settings['api_key'] and st.session_state.settings['api_secret']:
            exchange = ExchangeAPIClient(
                st.session_state.settings['api_key'],
                st.session_state.settings['api_secret'],
                st.session_state.settings['use_testnet']
            )
            
            side = "BUY" if position_type == "LONG" else "SELL"
            
            order = await exchange.place_order(
                st.session_state.settings['symbol'],
                side,
                "MARKET",
                position_size
            )
            
            # Use actual execution price if available
            if 'price' in order:
                st.session_state.current_price = float(order['price'])
        
        # Create the position object
        st.session_state.current_position = Position(
            position_type,
            st.session_state.current_price,
            position_size
        )
        
        # Log the position opening
        add_log(f"{position_type} position opened at ${st.session_state.current_price:.2f} with size: {position_size:.6f}", is_positive=True)
        
        return True
    except Exception as e:
        add_log(f"Error opening position: {str(e)}", is_error=True)
        return False

async def close_position(reason):
    """Close the current trading position"""
    if not st.session_state.current_position:
        return False
    
    try:
        # If live trading, place an actual order
        if st.session_state.is_live_trading and st.session_state.settings['api_key'] and st.session_state.settings['api_secret']:
            exchange = ExchangeAPIClient(
                st.session_state.settings['api_key'],
                st.session_state.settings['api_secret'],
                st.session_state.settings['use_testnet']
            )
            
            side = "SELL" if st.session_state.current_position.type == "LONG" else "BUY"
            
            order = await exchange.place_order(
                st.session_state.settings['symbol'],
                side,
                "MARKET",
                st.session_state.current_position.size
            )
            
            # Use actual execution price if available
            if 'price' in order:
                st.session_state.current_price = float(order['price'])
        
        # Close the position and calculate PnL
        pnl = st.session_state.current_position.close(
            st.session_state.current_price,
            datetime.datetime.now(),
            reason
        )
        
        # Update balance
        st.session_state.settings['balance'] += pnl
        
        # Add to trade history
        st.session_state.trades.append(st.session_state.current_position)
        
        # Log the position closing
        pnl_pct = st.session_state.current_position.pnl_pct * 100
        pnl_str = f"+${pnl:.2f} (+{pnl_pct:.2f}%)" if pnl >= 0 else f"-${abs(pnl):.2f} ({pnl_pct:.2f}%)"
        
        if pnl >= 0:
            add_log(f"{st.session_state.current_position.type} position closed with profit: {pnl_str}. Reason: {reason}", is_positive=True)
        else:
            add_log(f"{st.session_state.current_position.type} position closed with loss: {pnl_str}. Reason: {reason}", is_error=True)
        
        # Clear the current position
        st.session_state.current_position = None
        
        return True
    except Exception as e:
        add_log(f"Error closing position: {str(e)}", is_error=True)
        return False

def check_position_status():
    """Check if the current position needs to be closed based on stop loss/take profit"""
    if not st.session_state.current_position:
        return
    
    position = st.session_state.current_position
    current_price = st.session_state.current_price
    
    # Update trailing stop if enabled
    if st.session_state.settings['use_trailing_stop']:
        position.update_trailing_stop(current_price)
    
    # Check take profit
    if position.take_profit_price is not None:
        if (position.type == 'LONG' and current_price >= position.take_profit_price) or \
           (position.type == 'SHORT' and current_price <= position.take_profit_price):
            asyncio.run(close_position("Take Profit"))
            return
    
    # Check stop loss
    if position.stop_loss_price is not None:
        if (position.type == 'LONG' and current_price <= position.stop_loss_price) or \
           (position.type == 'SHORT' and current_price >= position.stop_loss_price):
            asyncio.run(close_position("Stop Loss"))
            return
    
    # Check trailing stop
    if position.trailing_stop_price is not None:
        if (position.type == 'LONG' and current_price <= position.trailing_stop_price) or \
           (position.type == 'SHORT' and current_price >= position.trailing_stop_price):
            asyncio.run(close_position("Trailing Stop"))
            return

def generate_trading_signals():
    """Generate trading signals based on the strategy"""
    if not st.session_state.klines_data:
        return
    
    prices = st.session_state.klines_data['prices']
    volumes = st.session_state.klines_data['volumes']
    
    if len(prices) < max(20, st.session_state.settings['bb_length']):
        add_log("Not enough data for generating signals")
        return
    
    # Calculate Bollinger Bands
    sma, upper_band, lower_band = calculate_bollinger_bands(
        prices, 
        st.session_state.settings['bb_length'],
        st.session_state.settings['bb_deviation']
    )
    
    # Check volume increase
    volume_candles = st.session_state.settings['volume_candles']
    recent_volumes = volumes[-volume_candles:]
    avg_volume = sum(volumes[-30:]) / 30  # Average of last 30 candles
    current_volume = recent_volumes[-1]
    volume_increase = (current_volume / avg_volume) * 100
    
    # Current price
    current_price = st.session_state.current_price
    
    # Generate signals
    if current_price <= lower_band and volume_increase >= st.session_state.settings['volume_increase']:
        # Buy signal
        if not st.session_state.current_position:
            asyncio.run(open_position("LONG"))
        elif st.session_state.current_position.type == "SHORT":
            asyncio.run(close_position("Reversal Signal"))
            asyncio.run(open_position("LONG"))
    elif current_price >= upper_band and volume_increase >= st.session_state.settings['volume_increase']:
        # Sell signal
        if not st.session_state.current_position:
            asyncio.run(open_position("SHORT"))
        elif st.session_state.current_position.type == "LONG":
            asyncio.run(close_position("Reversal Signal"))
            asyncio.run(open_position("SHORT"))

def calculate_performance_metrics():
    """Calculate trading performance metrics"""
    trades = st.session_state.trades
    initial_capital = st.session_state.settings['initial_capital']
    current_balance = st.session_state.settings['balance']
    
    # Default metrics
    metrics = {
        'total_trades': len(trades),
        'winning_trades': 0,
        'losing_trades': 0,
        'win_rate': 0,
        'total_profit': 0,
        'total_loss': 0,
        'profit_factor': 0,
        'return_pct': ((current_balance - initial_capital) / initial_capital) * 100 if initial_capital > 0 else 0,
        'max_drawdown': 0,
        'today_trades': 0,
        'today_pnl': 0
    }
    
    if not trades:
        return metrics
    
    # Calculate trade statistics
    winning_trades = [t for t in trades if t.pnl > 0]
    losing_trades = [t for t in trades if t.pnl <= 0]
    
    metrics['winning_trades'] = len(winning_trades)
    metrics['losing_trades'] = len(losing_trades)
    
    if metrics['total_trades'] > 0:
        metrics['win_rate'] = (metrics['winning_trades'] / metrics['total_trades']) * 100
    
    metrics['total_profit'] = sum(t.pnl for t in winning_trades)
    metrics['total_loss'] = abs(sum(t.pnl for t in losing_trades))
    
    if metrics['total_loss'] > 0:
        metrics['profit_factor'] = metrics['total_profit'] / metrics['total_loss']
    elif metrics['total_profit'] > 0:
        metrics['profit_factor'] = 999  # Arbitrary high number if no losses
    
    # Calculate max drawdown
    peak = initial_capital
    balance = initial_capital
    max_drawdown = 0
    
    for trade in trades:
        balance += trade.pnl
        if balance > peak:
            peak = balance
        else:
            drawdown = ((peak - balance) / peak) * 100
            if drawdown > max_drawdown:
                max_drawdown = drawdown
    
    metrics['max_drawdown'] = max_drawdown
    
    # Calculate today's stats
    today = datetime.datetime.now().date()
    today_trades = [t for t in trades if t.exit_time.date() == today]
    
    metrics['today_trades'] = len(today_trades)
    metrics['today_pnl'] = sum(t.pnl for t in today_trades)
    
    return metrics

def create_chart():
    """Create a candlestick chart with indicators"""
    if not st.session_state.klines_data:
        return None
    
    # Extract data
    timestamps = st.session_state.klines_data['timestamps']
    prices = st.session_state.klines_data['prices']
    volumes = st.session_state.klines_data['volumes']
    
    # Create subplots: price and volume
    fig = make_subplots(
        rows=2, 
        cols=1, 
        shared_xaxes=True,
        vertical_spacing=0.03,
        row_heights=[0.7, 0.3],
        subplot_titles=("Price", "Volume")
    )
    
    # Add candlestick trace
    # In a real implementation, we would use OHLC data
    # Here we're simplifying with just close prices
    fig.add_trace(
        go.Scatter(
            x=timestamps,
            y=prices,
            mode='lines',
            name='Price',
            line=dict(color='#4f46e5')
        ),
        row=1, col=1
    )
    
    # Add volume bars
    fig.add_trace(
        go.Bar(
            x=timestamps,
            y=volumes,
            name='Volume',
            marker=dict(color='rgba(79, 70, 229, 0.5)')
        ),
        row=2, col=1
    )
    
    # Calculate and add Bollinger Bands if we have enough data
    if len(prices) >= st.session_state.settings['bb_length']:
        sma, upper, lower = calculate_bollinger_bands(
            prices,
            st.session_state.settings['bb_length'],
            st.session_state.settings['bb_deviation']
        )
        
        # Add SMA
        fig.add_trace(
            go.Scatter(
                x=timestamps[-1:],
                y=[sma],
                mode='lines',
                line=dict(color='rgba(255, 255, 255, 0.5)'),
                name=f"SMA({st.session_state.settings['bb_length']})"
            ),
            row=1, col=1
        )
        
        # Add Upper Band
        fig.add_trace(
            go.Scatter(
                x=timestamps[-1:],
                y=[upper],
                mode='lines',
                line=dict(color='rgba(239, 68, 68, 0.5)'),
                name=f"Upper Band ({st.session_state.settings['bb_deviation']}σ)"
            ),
            row=1, col=1
        )
        
        # Add Lower Band
        fig.add_trace(
            go.Scatter(
                x=timestamps[-1:],
                y=[lower],
                mode='lines',
                line=dict(color='rgba(34, 197, 94, 0.5)'),
                name=f"Lower Band ({st.session_state.settings['bb_deviation']}σ)"
            ),
            row=1, col=1
        )
    
    # Add position markers if we have an open position and position lines are enabled
    if st.session_state.current_position and st.session_state.settings['show_position_lines']:
        position = st.session_state.current_position
        
        # Entry price line
        fig.add_shape(
            type="line",
            x0=timestamps[0],
            y0=position.entry_price,
            x1=timestamps[-1],
            y1=position.entry_price,
            line=dict(
                color="white",
                width=1,
                dash="dash",
            ),
            row=1, col=1
        )
        
        # Take profit line
        if position.take_profit_price:
            fig.add_shape(
                type="line",
                x0=timestamps[0],
                y0=position.take_profit_price,
                x1=timestamps[-1],
                y1=position.take_profit_price,
                line=dict(
                    color="#22c55e",
                    width=1,
                    dash="dash",
                ),
                row=1, col=1
            )
        
        # Stop loss line
        if position.stop_loss_price:
            fig.add_shape(
                type="line",
                x0=timestamps[0],
                y0=position.stop_loss_price,
                x1=timestamps[-1],
                y1=position.stop_loss_price,
                line=dict(
                    color="#ef4444",
                    width=1,
                    dash="dash",
                ),
                row=1, col=1
            )
        
        # Trailing stop line
        if position.trailing_stop_price:
            fig.add_shape(
                type="line",
                x0=timestamps[0],
                y0=position.trailing_stop_price,
                x1=timestamps[-1],
                y1=position.trailing_stop_price,
                line=dict(
                    color="#f59e0b",
                    width=1,
                    dash="dash",
                ),
                row=1, col=1
            )
    
    # Update layout
    fig.update_layout(
        height=600,
        template="plotly_dark",
        xaxis_rangeslider_visible=False,
        margin=dict(l=0, r=0, t=30, b=0),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        ),
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
    )
    
    fig.update_xaxes(
        gridcolor="rgba(255,255,255,0.1)",
        zerolinecolor="rgba(255,255,255,0.1)",
        row=1, col=1
    )
    
    fig.update_yaxes(
        gridcolor="rgba(255,255,255,0.1)",
        zerolinecolor="rgba(255,255,255,0.1)",
        row=1, col=1
    )
    
    fig.update_xaxes(
        gridcolor="rgba(255,255,255,0.1)",
        zerolinecolor="rgba(255,255,255,0.1)",
        row=2, col=1
    )
    
    fig.update_yaxes(
        gridcolor="rgba(255,255,255,0.1)",
        zerolinecolor="rgba(255,255,255,0.1)",
        row=2, col=1
    )
    
    return fig

async def start_trading(live_mode=False):
    """Start the trading bot"""
    if st.session_state.is_running:
        add_log("Trading is already running")
        return
    
    # Check API keys if in live mode
    if live_mode:
        if not st.session_state.settings['api_key'] or not st.session_state.settings['api_secret']:
            add_log("API keys are required for live trading", is_error=True)
            return
    
    # Update state
    st.session_state.is_running = True
    st.session_state.is_live_trading = live_mode
    st.session_state.bot_status = 'running'
    
    # Log the start
    mode_str = "Live" if live_mode else "Paper"
    add_log(f"{mode_str} trading started on {st.session_state.settings['symbol']} ({st.session_state.settings['timeframe']})", is_positive=True)
    
    # Fetch initial market data
    success = await fetch_market_data()
    if not success:
        add_log("Failed to fetch market data. Stopping trading.", is_error=True)
        st.session_state.is_running = False
        st.session_state.bot_status = 'idle'
        return

def stop_trading():
    """Stop the trading bot"""
    if not st.session_state.is_running:
        return
    
    # Update state
    st.session_state.is_running = False
    st.session_state.bot_status = 'idle'
    
    # Log the stop
    mode_str = "Live" if st.session_state.is_live_trading else "Paper"
    add_log(f"{mode_str} trading stopped")
    
    # Reset live trading flag
    st.session_state.is_live_trading = False

def reset_trading():
    """Reset trading state"""
    if st.session_state.is_running:
        stop_trading()
    
    # Reset state
    st.session_state.settings['balance'] = st.session_state.settings['initial_capital']
    st.session_state.current_position = None
    st.session_state.trades = []
    st.session_state.klines_data = None
    
    # Log the reset
    add_log("Trading state reset")

async def update_trading_loop():
    """Update the trading state and perform trading operations"""
    if not st.session_state.is_running:
        return
    
    try:
        # Fetch fresh market data
        success = await fetch_market_data()
        if not success:
            add_log("Failed to update market data", is_error=True)
            return
        
        # Update current position if exists
        if st.session_state.current_position:
            check_position_status()
        
        # Generate trading signals if auto trading is enabled
        if st.session_state.settings['auto_trade']:
            generate_trading_signals()
    
    except Exception as e:
        add_log(f"Error in trading loop: {str(e)}", is_error=True)

# UI Components
def render_sidebar():
    """Render the sidebar with settings"""
    with st.sidebar:
        st.image("https://cdn-icons-png.flaticon.com/512/6295/6295417.png", width=50)
        st.title("Volty Trading Bot")
        
        st.markdown("---")
        
        # Trading pair and timeframe selection
        st.subheader("Market Settings")
        
        symbol = st.selectbox(
            "Trading Pair",
            options=list(AVAILABLE_SYMBOLS.keys()),
            format_func=lambda x: AVAILABLE_SYMBOLS[x],
            index=list(AVAILABLE_SYMBOLS.keys()).index(st.session_state.settings['symbol'])
        )
        
        timeframe = st.selectbox(
            "Timeframe",
            options=list(AVAILABLE_TIMEFRAMES.keys()),
            format_func=lambda x: AVAILABLE_TIMEFRAMES[x],
            index=list(AVAILABLE_TIMEFRAMES.keys()).index(st.session_state.settings['timeframe'])
        )
        
        # Update settings if changed
        if symbol != st.session_state.settings['symbol'] or timeframe != st.session_state.settings['timeframe']:
            if st.session_state.is_running:
                stop_trading()
                
            st.session_state.settings['symbol'] = symbol
            st.session_state.settings['timeframe'] = timeframe
            st.session_state.klines_data = None  # Reset data to trigger refresh
            add_log(f"Changed to {symbol} ({timeframe})")
        
        st.markdown("---")
        
        # Trading mode selection
        st.subheader("Trading Mode")
        col1, col2 = st.columns(2)
        
        with col1:
            if st.button("📝 Paper Trading", 
                       use_container_width=True, 
                       disabled=st.session_state.is_running,
                       type="primary" if not st.session_state.is_live_trading else "secondary"):
                st.session_state.is_live_trading = False
                add_log("Switched to paper trading mode")
                
        with col2:
            if st.button("🔴 Live Trading", 
                       use_container_width=True,
                       disabled=st.session_state.is_running,
                       type="secondary" if not st.session_state.is_live_trading else "primary"):
                
                if not st.session_state.settings['api_key'] or not st.session_state.settings['api_secret']:
                    st.error("API keys are required for live trading")
                else:
                    st.session_state.is_live_trading = True
                    add_log("Switched to live trading mode", is_positive=True)
        
        # Current mode indicator
        mode_text = "🔴 LIVE TRADING" if st.session_state.is_live_trading else "📝 PAPER TRADING"
        st.info(mode_text, icon="ℹ️")
        
        st.markdown("---")
        
        # Settings tabs
        tabs = st.tabs(["Strategy", "Risk", "Account", "API"])
        
        # Strategy tab
        with tabs[0]:
            st.subheader("Strategy Parameters")
            
            bb_length = st.slider(
                "Bollinger Bands Length",
                min_value=10,
                max_value=50,
                value=st.session_state.settings['bb_length'],
                step=1
            )
            
            bb_deviation = st.slider(
                "Bollinger Bands Deviation",
                min_value=1.0,
                max_value=4.0,
                value=st.session_state.settings['bb_deviation'],
                step=0.1
            )
            
            volume_candles = st.slider(
                "Volume Candles",
                min_value=1,
                max_value=10,
                value=st.session_state.settings['volume_candles'],
                step=1
            )
            
            volume_increase = st.slider(
                "Volume Increase (%)",
                min_value=5,
                max_value=50,
                value=st.session_state.settings['volume_increase'],
                step=1
            )
            
            # Update settings
            st.session_state.settings['bb_length'] = bb_length
            st.session_state.settings['bb_deviation'] = bb_deviation
            st.session_state.settings['volume_candles'] = volume_candles
            st.session_state.settings['volume_increase'] = volume_increase
            
            st.markdown("---")
            
            auto_trade = st.checkbox("Auto Trading", value=st.session_state.settings['auto_trade'])
            show_position_lines = st.checkbox("Show Position Lines", value=st.session_state.settings['show_position_lines'])
            
            # Update settings
            st.session_state.settings['auto_trade'] = auto_trade
            st.session_state.settings['show_position_lines'] = show_position_lines
        
        # Risk tab
        with tabs[1]:
            st.subheader("Risk Management")
            
            col1, col2 = st.columns(2)
            
            with col1:
                use_tp = st.checkbox("Take Profit", value=st.session_state.settings['use_take_profit'])
            
            with col2:
                tp_pct = st.number_input(
                    "TP %",
                    min_value=0.1,
                    max_value=100.0,
                    value=st.session_state.settings['take_profit_pct'],
                    step=0.1,
                    disabled=not use_tp
                )
            
            col1, col2 = st.columns(2)
            
            with col1:
                use_sl = st.checkbox("Stop Loss", value=st.session_state.settings['use_stop_loss'])
            
            with col2:
                sl_pct = st.number_input(
                    "SL %",
                    min_value=0.1,
                    max_value=100.0,
                    value=st.session_state.settings['stop_loss_pct'],
                    step=0.1,
                    disabled=not use_sl
                )
            
            col1, col2 = st.columns(2)
            
            with col1:
                use_ts = st.checkbox("Trailing Stop", value=st.session_state.settings['use_trailing_stop'])
            
            with col2:
                ts_pct = st.number_input(
                    "TS %",
                    min_value=0.1,
                    max_value=100.0,
                    value=st.session_state.settings['trailing_stop_pct'],
                    step=0.1,
                    disabled=not use_ts
                )
            
            # Update settings
            st.session_state.settings['use_take_profit'] = use_tp
            st.session_state.settings['take_profit_pct'] = tp_pct
            st.session_state.settings['use_stop_loss'] = use_sl
            st.session_state.settings['stop_loss_pct'] = sl_pct
            st.session_state.settings['use_trailing_stop'] = use_ts
            st.session_state.settings['trailing_stop_pct'] = ts_pct
            
            # Update current position if it exists
            if st.session_state.current_position:
                st.session_state.current_position.take_profit_price = st.session_state.current_position.calculate_take_profit()
                st.session_state.current_position.stop_loss_price = st.session_state.current_position.calculate_stop_loss()
        
        # Account tab
        with tabs[2]:
            st.subheader("Account Settings")
            
            initial_capital = st.number_input(
                "Initial Capital (USDT)",
                min_value=10.0,
                max_value=1000000.0,
                value=st.session_state.settings['initial_capital'],
                step=100.0,
                disabled=st.session_state.is_running
            )
            
            position_size = st.slider(
                "Position Size (%)",
                min_value=1,
                max_value=100,
                value=st.session_state.settings['position_size'],
                step=1
            )
            
            # Update settings
            if not st.session_state.is_running:
                st.session_state.settings['initial_capital'] = initial_capital
                st.session_state.settings['balance'] = initial_capital
            
            st.session_state.settings['position_size'] = position_size
        
        # API tab
        with tabs[3]:
            st.subheader("API Settings")
            
            api_key = st.text_input(
                "API Key",
                value=st.session_state.settings['api_key'],
                type="password" if st.session_state.settings['api_key'] else "default"
            )
            
            api_secret = st.text_input(
                "API Secret",
                value=st.session_state.settings['api_secret'],
                type="password" if st.session_state.settings['api_secret'] else "default"
            )
            
            use_testnet = st.checkbox("Use Testnet", value=st.session_state.settings['use_testnet'])
            
            # Update settings
            st.session_state.settings['api_key'] = api_key
            st.session_state.settings['api_secret'] = api_secret
            st.session_state.settings['use_testnet'] = use_testnet
            
            if st.button("Test API Connection", use_container_width=True):
                with st.spinner("Testing API connection..."):
                    try:
                        exchange = ExchangeAPIClient(api_key, api_secret, use_testnet)
                        result = asyncio.run(exchange.ping())
                        st.success("API connection successful!")
                        add_log("API connection test successful", is_positive=True)
                    except Exception as e:
                        st.error(f"API connection failed: {str(e)}")
                        add_log(f"API connection test failed: {str(e)}", is_error=True)
        
        st.markdown("---")
        
        # Save settings button
        if st.button("💾 Save Settings", use_container_width=True):
            save_settings()
            st.success("Settings saved!")

def render_main_content():
    """Render the main content area with trading interface"""
    # Header with current market info
    col1, col2, col3 = st.columns([2, 3, 2])
    
    with col1:
        st.subheader(f"{AVAILABLE_SYMBOLS.get(st.session_state.settings['symbol'], st.session_state.settings['symbol'])}")
        st.caption(f"Timeframe: {AVAILABLE_TIMEFRAMES.get(st.session_state.settings['timeframe'], st.session_state.settings['timeframe'])}")
    
    with col2:
        # Market price and change
        if st.session_state.klines_data and len(st.session_state.klines_data['prices']) > 1:
            current_price = st.session_state.klines_data['prices'][-1]
            previous_price = st.session_state.klines_data['prices'][-2]
            price_change = ((current_price - previous_price) / previous_price) * 100
            
            price_color = "green" if price_change >= 0 else "red"
            change_symbol = "+" if price_change >= 0 else ""
            
            st.markdown(f"""
            <div style="text-align: center;">
                <h2 style="margin-bottom: 0;">${current_price:.2f}</h2>
                <p style="color: {price_color}; margin-top: 0;">{change_symbol}{price_change:.2f}%</p>
            </div>
            """, unsafe_allow_html=True)
    
    with col3:
        # Bot status and controls
        status_color = {
            'idle': 'gray',
            'running': 'green',
            'scanning': 'blue',
            'trading': 'orange'
        }.get(st.session_state.bot_status, 'gray')
        
        st.markdown(f"""
        <div style="text-align: right;">
            <p style="margin-bottom: 5px;">Bot Status</p>
            <p style="margin-top: 0;"><span class="status-indicator {st.session_state.bot_status}"></span>{st.session_state.bot_status.upper()}</p>
        </div>
        """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Trading controls
    col1, col2, col3 = st.columns(3)
    
    with col1:
        start_button_label = "▶️ Start Live Trading" if st.session_state.is_live_trading else "▶️ Start Paper Trading"
        if st.button(start_button_label, use_container_width=True, disabled=st.session_state.is_running, type="primary"):
            asyncio.run(start_trading(st.session_state.is_live_trading))
    
    with col2:
        if st.button("⏹️ Stop Trading", use_container_width=True, disabled=not st.session_state.is_running, type="secondary"):
            stop_trading()
    
    with col3:
        if st.button("🔄 Reset", use_container_width=True, disabled=st.session_state.is_running, type="secondary"):
            reset_trading()
    
    st.markdown("---")
    
    # Trading chart and information
    col1, col2 = st.columns([3, 1])
    
    with col1:
        # Price chart
        if st.session_state.klines_data:
            fig = create_chart()
            st.plotly_chart(fig, use_container_width=True, config={'displayModeBar': False})
        else:
            st.info("No market data available. Start trading to fetch data.")
    
    with col2:
        # Current position
        st.subheader("Current Position")
        
        if st.session_state.current_position:
            position = st.session_state.current_position
            position_type = position.type
            entry_price = position.entry_price
            current_price = st.session_state.current_price
            
            pnl = position.get_unrealized_pnl(current_price)
            pnl_pct = position.get_unrealized_pnl_pct(current_price) * 100
            
            position_color = "green" if position_type == "LONG" else "red"
            pnl_color = "green" if pnl >= 0 else "red"
            pnl_sign = "+" if pnl >= 0 else ""
            
            st.markdown(f"""
            <div class="position-box {position_type.lower()}">
                <h3 style="color: {position_color};">{position_type} Position</h3>
                <p><strong>Entry Price:</strong> ${entry_price:.2f}</p>
                <p><strong>Current Price:</strong> ${current_price:.2f}</p>
                <p><strong>P&L:</strong> <span style="color: {pnl_color}">{pnl_sign}${pnl:.2f} ({pnl_sign}{pnl_pct:.2f}%)</span></p>
                <p><strong>Size:</strong> {position.size:.6f}</p>
                <p><strong>Take Profit:</strong> ${position.take_profit_price:.2f if position.take_profit_price else 'N/A'}</p>
                <p><strong>Stop Loss:</strong> ${position.stop_loss_price:.2f if position.stop_loss_price else 'N/A'}</p>
            </div>
            """, unsafe_allow_html=True)
            
            if st.button("Close Position", use_container_width=True, type="primary"):
                asyncio.run(close_position("Manual close"))
        else:
            st.info("No open position")
        
        # Performance metrics
        st.subheader("Performance")
        
        metrics = calculate_performance_metrics()
        
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Balance", f"${st.session_state.settings['balance']:.2f}")
        with col2:
            return_sign = "+" if metrics['return_pct'] >= 0 else ""
            st.metric("Return", f"{return_sign}{metrics['return_pct']:.2f}%")
        
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Win Rate", f"{metrics['win_rate']:.1f}%")
        with col2:
            st.metric("Profit Factor", f"{metrics['profit_factor']:.2f}")
        
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Total Trades", metrics['total_trades'])
        with col2:
            st.metric("Max Drawdown", f"{metrics['max_drawdown']:.2f}%")
    
    st.markdown("---")
    
    # Trade history and logs
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Trade History")
        
        if st.session_state.trades:
            # Create a DataFrame from trades
            trade_data = []
            for trade in st.session_state.trades:
                trade_data.append({
                    "Type": trade.type,
                    "Entry Price": f"${trade.entry_price:.2f}",
                    "Exit Price": f"${trade.exit_price:.2f}",
                    "P&L": f"${trade.pnl:.2f}",
                    "P&L %": f"{trade.pnl_pct * 100:.2f}%",
                    "Entry Time": trade.entry_time.strftime("%Y-%m-%d %H:%M"),
                    "Exit Time": trade.exit_time.strftime("%Y-%m-%d %H:%M"),
                    "Reason": trade.exit_reason
                })
            
            df = pd.DataFrame(trade_data)
            st.dataframe(df, use_container_width=True)
        else:
            st.info("No trades yet")
    
    with col2:
        st.subheader("Activity Log")
        
        log_html = ""
        for log in reversed(st.session_state.logs):
            time_str = log["time"]
            message = log["message"]
            log_type = log["type"]
            
            color = {
                "positive": "green",
                "error": "red",
                "normal": "white"
            }.get(log_type, "white")
            
            log_html += f'<div style="margin-bottom: 5px;"><span style="color: gray;">{time_str}</span> <span style="color: {color};">{message}</span></div>'
        
        st.markdown(f"""
        <div class="log-box">
            {log_html}
        </div>
        """, unsafe_allow_html=True)
    
    # Status footer
    st.markdown("---")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        if st.session_state.last_update:
            st.caption(f"Last update: {st.session_state.last_update.strftime('%Y-%m-%d %H:%M:%S')}")
    
    with col2:
        st.caption(f"UTC: {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}")
    
    with col3:
        st.caption(f"Version: {VERSION} | {BUILD_DATE}")

# Main app function
def main():
    """Main application function"""
    # Load settings
    load_settings()
    
    # Set up the layout
    render_sidebar()
    render_main_content()
    
    # Run trading updates if bot is running
    if st.session_state.is_running:
        asyncio.run(update_trading_loop())
    
    # Schedule the next update using Streamlit's rerun mechanism
    if st.session_state.is_running:
        time.sleep(1)  # Small delay to prevent too frequent reruns
        st.rerun()

# Initialization code
if not st.session_state.initialized:
    # Set the current date and time
    st.session_state.current_time = datetime.datetime.strptime("2025-06-13 07:26:21", "%Y-%m-%d %H:%M:%S")
    
    # Initialize with a welcome message
    add_log(f"Volty Trading Bot v{VERSION} initialized by user: gelimorto2")
    add_log(f"System ready at {st.session_state.current_time.strftime('%Y-%m-%d %H:%M:%S')} UTC")
    
    # Mark as initialized
    st.session_state.initialized = True

# Run the app
if __name__ == "__main__":
    import asyncio
    main()
