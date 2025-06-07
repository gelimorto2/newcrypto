import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import plotly.express as px
import requests
import datetime
from dataclasses import dataclass
from typing import List, Dict, Optional
import warnings
warnings.filterwarnings('ignore')

# Page configuration
st.set_page_config(
    page_title="Volty Strategy Backtester",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for TradingView-like styling
st.markdown("""
<style>
    .main {
        background: linear-gradient(135deg, #0c1426 0%, #1a1a2e 50%, #16213e 100%);
    }
    
    .stMetric {
        background-color: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 1rem;
        border-radius: 10px;
        backdrop-filter: blur(10px);
    }
    
    .metric-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 1rem;
        margin: 0.5rem 0;
        backdrop-filter: blur(10px);
    }
    
    .trade-long {
        background-color: rgba(34, 197, 94, 0.1);
        border-left: 4px solid #22c55e;
    }
    
    .trade-short {
        background-color: rgba(239, 68, 68, 0.1);
        border-left: 4px solid #ef4444;
    }
    
    .status-backtest {
        background-color: #059669;
        color: white;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.875rem;
        font-weight: 600;
    }

    .sidebar .stSelectbox > div > div {
        background-color: rgba(255, 255, 255, 0.1);
    }
</style>
""", unsafe_allow_html=True)

@dataclass
class Trade:
    entry_time: datetime.datetime
    exit_time: datetime.datetime
    type: str  # 'LONG' or 'SHORT'
    entry_price: float
    exit_price: float
    size: float
    pnl: float
    pnl_pct: float

@dataclass
class BacktestResults:
    trades: List[Trade]
    total_return: float
    win_rate: float
    profit_factor: float
    max_drawdown: float
    sharpe_ratio: float
    total_trades: int
    avg_trade: float
    max_win: float
    max_loss: float

class VoltyStrategy:
    def __init__(self, length: int = 5, atr_mult: float = 0.75):
        self.length = length
        self.atr_mult = atr_mult
        
    def calculate_atr(self, data: pd.DataFrame) -> pd.Series:
        """Calculate Average True Range"""
        high = data['high']
        low = data['low']
        close = data['close']
        
        tr1 = high - low
        tr2 = np.abs(high - close.shift(1))
        tr3 = np.abs(low - close.shift(1))
        
        tr = np.maximum(tr1, np.maximum(tr2, tr3))
        atr = tr.rolling(window=self.length).mean()
        
        return atr
    
    def generate_signals(self, data: pd.DataFrame) -> pd.DataFrame:
        """Generate trading signals"""
        df = data.copy()
        
        # Calculate ATR
        df['atr'] = self.calculate_atr(df)
        df['atrs'] = df['atr'] * self.atr_mult
        
        # Calculate signal levels
        df['long_signal'] = df['close'] + df['atrs']
        df['short_signal'] = df['close'] - df['atrs']
        
        # Generate entry signals
        df['long_entry'] = (df['high'] >= df['long_signal'].shift(1)) & (df['high'].shift(1) < df['long_signal'].shift(2))
        df['short_entry'] = (df['low'] <= df['short_signal'].shift(1)) & (df['low'].shift(1) > df['short_signal'].shift(2))
        
        return df

class Backtester:
    def __init__(self, initial_capital: float = 10000, position_size: float = 0.1):
        self.initial_capital = initial_capital
        self.position_size = position_size
        
    def run_backtest(self, data: pd.DataFrame, strategy: VoltyStrategy) -> BacktestResults:
        """Run the backtest"""
        df = strategy.generate_signals(data)
        
        trades = []
        position = None
        equity_curve = [self.initial_capital]
        current_capital = self.initial_capital
        
        for i in range(1, len(df)):
            current_row = df.iloc[i]
            
            # Close existing position on opposite signal
            if position is not None:
                exit_condition = False
                
                if position['type'] == 'LONG' and current_row['short_entry']:
                    exit_condition = True
                elif position['type'] == 'SHORT' and current_row['long_entry']:
                    exit_condition = True
                
                if exit_condition:
                    # Close position
                    exit_price = current_row['open']  # Assume exit at next candle open
                    
                    if position['type'] == 'LONG':
                        pnl = (exit_price - position['entry_price']) * position['size']
                        pnl_pct = (exit_price - position['entry_price']) / position['entry_price']
                    else:  # SHORT
                        pnl = (position['entry_price'] - exit_price) * position['size']
                        pnl_pct = (position['entry_price'] - exit_price) / position['entry_price']
                    
                    current_capital += pnl
                    
                    trade = Trade(
                        entry_time=position['entry_time'],
                        exit_time=current_row['datetime'],
                        type=position['type'],
                        entry_price=position['entry_price'],
                        exit_price=exit_price,
                        size=position['size'],
                        pnl=pnl,
                        pnl_pct=pnl_pct
                    )
                    trades.append(trade)
                    position = None
            
            # Open new position
            if position is None:
                entry_price = None
                trade_type = None
                
                if current_row['long_entry']:
                    entry_price = current_row['open']  # Enter at next candle open
                    trade_type = 'LONG'
                elif current_row['short_entry']:
                    entry_price = current_row['open']
                    trade_type = 'SHORT'
                
                if entry_price is not None:
                    trade_size = current_capital * self.position_size / entry_price
                    position = {
                        'type': trade_type,
                        'entry_price': entry_price,
                        'entry_time': current_row['datetime'],
                        'size': trade_size
                    }
            
            # Update equity curve
            if position is not None:
                current_price = current_row['close']
                if position['type'] == 'LONG':
                    unrealized_pnl = (current_price - position['entry_price']) * position['size']
                else:
                    unrealized_pnl = (position['entry_price'] - current_price) * position['size']
                equity_curve.append(current_capital + unrealized_pnl)
            else:
                equity_curve.append(current_capital)
        
        # Calculate performance metrics
        results = self._calculate_metrics(trades, equity_curve)
        return results
    
    def _calculate_metrics(self, trades: List[Trade], equity_curve: List[float]) -> BacktestResults:
        """Calculate backtest performance metrics"""
        if not trades:
            return BacktestResults(
                trades=[], total_return=0, win_rate=0, profit_factor=0,
                max_drawdown=0, sharpe_ratio=0, total_trades=0, avg_trade=0,
                max_win=0, max_loss=0
            )
        
        # Basic metrics
        total_return = (equity_curve[-1] - equity_curve[0]) / equity_curve[0]
        
        winning_trades = [t for t in trades if t.pnl > 0]
        losing_trades = [t for t in trades if t.pnl < 0]
        
        win_rate = len(winning_trades) / len(trades) if trades else 0
        
        gross_profit = sum(t.pnl for t in winning_trades)
        gross_loss = abs(sum(t.pnl for t in losing_trades))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')
        
        avg_trade = sum(t.pnl for t in trades) / len(trades)
        max_win = max((t.pnl for t in trades), default=0)
        max_loss = min((t.pnl for t in trades), default=0)
        
        # Max drawdown
        peak = equity_curve[0]
        max_dd = 0
        for value in equity_curve:
            if value > peak:
                peak = value
            dd = (peak - value) / peak
            if dd > max_dd:
                max_dd = dd
        
        # Sharpe ratio (simplified)
        returns = np.diff(equity_curve) / np.array(equity_curve[:-1])
        sharpe_ratio = np.mean(returns) / np.std(returns) * np.sqrt(252) if np.std(returns) > 0 else 0
        
        return BacktestResults(
            trades=trades,
            total_return=total_return,
            win_rate=win_rate,
            profit_factor=profit_factor,
            max_drawdown=max_dd,
            sharpe_ratio=sharpe_ratio,
            total_trades=len(trades),
            avg_trade=avg_trade,
            max_win=max_win,
            max_loss=max_loss
        )

def get_binance_data(symbol: str, interval: str, limit: int = 1000) -> pd.DataFrame:
    """Fetch historical data from Binance API"""
    try:
        url = "https://api.binance.com/api/v3/klines"
        params = {
            'symbol': symbol,
            'interval': interval,
            'limit': limit
        }
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        data = response.json()
        
        df = pd.DataFrame(data, columns=[
            'timestamp', 'open', 'high', 'low', 'close', 'volume',
            'close_time', 'quote_volume', 'trades', 'taker_buy_base',
            'taker_buy_quote', 'ignore'
        ])
        
        # Convert to proper data types
        df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms')
        for col in ['open', 'high', 'low', 'close', 'volume']:
            df[col] = pd.to_numeric(df[col])
        
        df = df[['datetime', 'open', 'high', 'low', 'close', 'volume']]
        df = df.sort_values('datetime').reset_index(drop=True)
        
        return df
        
    except Exception as e:
        st.error(f"Error fetching data: {str(e)}")
        return pd.DataFrame()

def create_candlestick_chart(data: pd.DataFrame, signals_df: pd.DataFrame = None, trades: List[Trade] = None):
    """Create TradingView-style candlestick chart"""
    fig = make_subplots(
        rows=3, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.02,
        subplot_titles=('Price Chart', 'ATR', 'Volume'),
        row_heights=[0.6, 0.2, 0.2]
    )
    
    # Candlestick chart
    fig.add_trace(
        go.Candlestick(
            x=data['datetime'],
            open=data['open'],
            high=data['high'],
            low=data['low'],
            close=data['close'],
            name='Price',
            increasing_line_color='#00ff88',
            decreasing_line_color='#ff4444',
            increasing_fillcolor='rgba(0, 255, 136, 0.3)',
            decreasing_fillcolor='rgba(255, 68, 68, 0.3)'
        ),
        row=1, col=1
    )
    
    # Add signal lines if available
    if signals_df is not None and not signals_df.empty:
        fig.add_trace(
            go.Scatter(
                x=signals_df['datetime'],
                y=signals_df['long_signal'],
                mode='lines',
                line=dict(color='#00ff88', width=1, dash='dash'),
                name='Long Signal',
                opacity=0.7
            ),
            row=1, col=1
        )
        
        fig.add_trace(
            go.Scatter(
                x=signals_df['datetime'],
                y=signals_df['short_signal'],
                mode='lines',
                line=dict(color='#ff4444', width=1, dash='dash'),
                name='Short Signal',
                opacity=0.7
            ),
            row=1, col=1
        )
    
    # Add trade markers
    if trades:
        long_entries = [t for t in trades if t.type == 'LONG']
        short_entries = [t for t in trades if t.type == 'SHORT']
        
        if long_entries:
            fig.add_trace(
                go.Scatter(
                    x=[t.entry_time for t in long_entries],
                    y=[t.entry_price for t in long_entries],
                    mode='markers',
                    marker=dict(color='#00ff88', size=8, symbol='triangle-up'),
                    name='Long Entry'
                ),
                row=1, col=1
            )
            
            fig.add_trace(
                go.Scatter(
                    x=[t.exit_time for t in long_entries],
                    y=[t.exit_price for t in long_entries],
                    mode='markers',
                    marker=dict(color='#00ff88', size=8, symbol='triangle-down'),
                    name='Long Exit'
                ),
                row=1, col=1
            )
        
        if short_entries:
            fig.add_trace(
                go.Scatter(
                    x=[t.entry_time for t in short_entries],
                    y=[t.entry_price for t in short_entries],
                    mode='markers',
                    marker=dict(color='#ff4444', size=8, symbol='triangle-down'),
                    name='Short Entry'
                ),
                row=1, col=1
            )
            
            fig.add_trace(
                go.Scatter(
                    x=[t.exit_time for t in short_entries],
                    y=[t.exit_price for t in short_entries],
                    mode='markers',
                    marker=dict(color='#ff4444', size=8, symbol='triangle-up'),
                    name='Short Exit'
                ),
                row=1, col=1
            )
    
    # ATR indicator
    if signals_df is not None and 'atr' in signals_df.columns:
        fig.add_trace(
            go.Scatter(
                x=signals_df['datetime'],
                y=signals_df['atr'],
                mode='lines',
                line=dict(color='#fbbf24', width=2),
                name='ATR'
            ),
            row=2, col=1
        )
    
    # Volume bars
    colors = ['#00ff88' if data['close'].iloc[i] >= data['open'].iloc[i] else '#ff4444' 
              for i in range(len(data))]
    
    fig.add_trace(
        go.Bar(
            x=data['datetime'],
            y=data['volume'],
            name='Volume',
            marker_color=colors,
            opacity=0.7
        ),
        row=3, col=1
    )
    
    # Update layout for dark theme
    fig.update_layout(
        template='plotly_dark',
        height=800,
        showlegend=True,
        xaxis_rangeslider_visible=False,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font=dict(color='white'),
        margin=dict(l=0, r=0, t=50, b=0),
        legend=dict(
            yanchor="top",
            y=0.99,
            xanchor="left",
            x=0.01
        )
    )
    
    fig.update_xaxes(showgrid=True, gridwidth=1, gridcolor='rgba(255,255,255,0.1)')
    fig.update_yaxes(showgrid=True, gridwidth=1, gridcolor='rgba(255,255,255,0.1)')
    
    return fig

def create_equity_curve(results: BacktestResults, initial_capital: float):
    """Create equity curve chart"""
    if not results.trades:
        return go.Figure()
    
    # Calculate equity curve from trades
    equity = [initial_capital]
    dates = [results.trades[0].entry_time]
    current_equity = initial_capital
    
    for trade in results.trades:
        current_equity += trade.pnl
        equity.append(current_equity)
        dates.append(trade.exit_time)
    
    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=dates,
            y=equity,
            mode='lines',
            line=dict(color='#00ff88', width=3),
            name='Equity',
            fill='tonexty',
            fillcolor='rgba(0, 255, 136, 0.1)'
        )
    )
    
    fig.update_layout(
        template='plotly_dark',
        height=400,
        showlegend=False,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font=dict(color='white'),
        margin=dict(l=0, r=0, t=30, b=0),
        xaxis=dict(showgrid=True, gridwidth=1, gridcolor='rgba(255,255,255,0.1)'),
        yaxis=dict(showgrid=True, gridwidth=1, gridcolor='rgba(255,255,255,0.1)')
    )
    
    return fig

# Initialize session state
def init_session_state():
    if 'backtest_results' not in st.session_state:
        st.session_state.backtest_results = None
    if 'price_data' not in st.session_state:
        st.session_state.price_data = pd.DataFrame()
    if 'signals_data' not in st.session_state:
        st.session_state.signals_data = pd.DataFrame()

def main():
    init_session_state()
    
    # Header
    st.markdown("""
    <h1 style='text-align: center; background: linear-gradient(90deg, #3b82f6, #8b5cf6); 
               -webkit-background-clip: text; -webkit-text-fill-color: transparent; 
               font-size: 3rem; margin-bottom: 2rem;'>
        📈 Volty Strategy Backtester
    </h1>
    """, unsafe_allow_html=True)
    
    # Sidebar - Strategy Settings
    with st.sidebar:
        st.markdown("## ⚙️ Strategy Configuration")
        
        # Mode indicator
        st.markdown("""
        <div class="status-backtest">
            📊 BACKTEST MODE
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("---")
        
        # Data Settings
        st.markdown("### 📊 Data Settings")
        
        symbol = st.selectbox(
            "Symbol",
            ["BTCUSDT", "ETHUSDT", "ADAUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"],
            key="symbol"
        )
        
        timeframe_map = {
            "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
            "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w"
        }
        
        timeframe = st.selectbox(
            "Timeframe",
            list(timeframe_map.keys()),
            index=4,
            key="timeframe"
        )
        
        data_points = st.slider(
            "Data Points",
            min_value=100,
            max_value=1000,
            value=500,
            step=50,
            help="Number of candles to fetch"
        )
        
        # Strategy Parameters
        st.markdown("### ⚙️ Strategy Parameters")
        
        strategy_length = st.slider(
            "ATR Length",
            min_value=1,
            max_value=50,
            value=5,
            help="Period for ATR calculation"
        )
        
        atr_mult = st.slider(
            "ATR Multiplier",
            min_value=0.1,
            max_value=5.0,
            value=0.75,
            step=0.05,
            help="Multiplier for ATR-based signals"
        )
        
        # Backtest Settings
        st.markdown("### 💰 Backtest Settings")
        
        initial_capital = st.number_input(
            "Initial Capital ($)",
            min_value=1000,
            max_value=1000000,
            value=10000,
            step=1000
        )
        
        position_size = st.slider(
            "Position Size (%)",
            min_value=1,
            max_value=100,
            value=10,
            help="Percentage of capital per trade"
        ) / 100
        
        st.markdown("---")
        
        # Controls
        if st.button("🚀 Run Backtest", use_container_width=True):
            with st.spinner("Fetching data and running backtest..."):
                # Fetch data
                data = get_binance_data(symbol, timeframe_map[timeframe], data_points)
                
                if not data.empty:
                    st.session_state.price_data = data
                    
                    # Initialize strategy
                    strategy = VoltyStrategy(length=strategy_length, atr_mult=atr_mult)
                    
                    # Generate signals
                    signals_df = strategy.generate_signals(data)
                    st.session_state.signals_data = signals_df
                    
                    # Run backtest
                    backtester = Backtester(initial_capital=initial_capital, position_size=position_size)
                    results = backtester.run_backtest(data, strategy)
                    st.session_state.backtest_results = results
                    
                    st.success("Backtest completed successfully!")
                else:
                    st.error("Failed to fetch data. Please try again.")
    
    # Main content
    if st.session_state.backtest_results is not None:
        results = st.session_state.backtest_results
        
        # Performance Metrics
        st.markdown("## 📊 Performance Overview")
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric(
                "💰 Total Return",
                f"{results.total_return:.2%}",
                delta=f"${results.total_return * initial_capital:,.2f}"
            )
        
        with col2:
            st.metric(
                "🎯 Win Rate",
                f"{results.win_rate:.1%}",
                delta=f"{results.total_trades} trades"
            )
        
        with col3:
            st.metric(
                "📈 Profit Factor",
                f"{results.profit_factor:.2f}",
                delta=f"Avg: ${results.avg_trade:.2f}"
            )
        
        with col4:
            st.metric(
                "📉 Max Drawdown",
                f"{results.max_drawdown:.2%}",
                delta=f"Sharpe: {results.sharpe_ratio:.2f}"
            )
        
        # Additional metrics
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("🏆 Max Win", f"${results.max_win:.2f}")
        with col2:
            st.metric("💸 Max Loss", f"${results.max_loss:.2f}")
        with col3:
            final_capital = initial_capital + sum(t.pnl for t in results.trades)
            st.metric("💼 Final Capital", f"${final_capital:,.2f}")
        with col4:
            st.metric("⚡ Total Trades", f"{results.total_trades}")
        
        # Charts
        chart_tab1, chart_tab2 = st.tabs(["📊 Price Chart & Signals", "💹 Equity Curve"])
        
        with chart_tab1:
            if not st.session_state.price_data.empty:
                chart_fig = create_candlestick_chart(
                    st.session_state.price_data,
                    st.session_state.signals_data,
                    results.trades
                )
                st.plotly_chart(chart_fig, use_container_width=True)
        
        with chart_tab2:
            equity_fig = create_equity_curve(results, initial_capital)
            st.plotly_chart(equity_fig, use_container_width=True)
        
        # Trade History
        st.markdown("## 📋 Trade History")
        
        if results.trades:
            trades_data = []
            for i, trade in enumerate(results.trades):
                trades_data.append({
                    '#': i + 1,
                    'Entry Time': trade.entry_time.strftime('%Y-%m-%d %H:%M'),
                    'Exit Time': trade.exit_time.strftime('%Y-%m-%d %H:%M'),
                    'Type': trade.type,
                    'Entry Price': f"${trade.entry_price:,.4f}",
                    'Exit Price': f"${trade.exit_price:,.4f}",
                    'Size': f"{trade.size:.6f}",
                    'P&L': f"${trade.pnl:.2f}",
                    'P&L %': f"{trade.pnl_pct:.2%}"
                })
            
            trades_df = pd.DataFrame(trades_data)
            
            # Color-code the dataframe
            def highlight_trades(row):
                colors = []
                for col in row.index:
                    if col == 'Type':
                        if row[col] == 'LONG':
                            colors.append('background-color: rgba(34, 197, 94, 0.2)')
                        else:
                            colors.append('background-color: rgba(239, 68, 68, 0.2)')
                    elif col in ['P&L', 'P&L %']:
                        value = float(row[col].replace('$', '').replace('%', '').replace(',', ''))
                        if value > 0:
                            colors.append('background-color: rgba(34, 197, 94, 0.2)')
                        else:
                            colors.append('background-color: rgba(239, 68, 68, 0.2)')
                    else:
                        colors.append('')
                return colors
            
            styled_df = trades_df.style.apply(highlight_trades, axis=1)
            st.dataframe(styled_df, use_container_width=True, hide_index=True)
        
        else:
            st.info("No trades generated with current parameters.")
    
    else:
        st.info("👈 Configure your strategy parameters and click 'Run Backtest' to get started!")
        
        # Show sample chart with current symbol
        st.markdown("## 📊 Live Data Preview")
        if st.button("📡 Fetch Live Data"):
            with st.spinner("Fetching live data..."):
                sample_data = get_binance_data("BTCUSDT", "1h", 100)
                if not sample_data.empty:
                    sample_fig = create_candlestick_chart(sample_data)
                    st.plotly_chart(sample_fig, use_container_width=True)

if __name__ == "__main__":
    main()
