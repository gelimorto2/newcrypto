"""
Enhanced Crypto Data Service v2.0.0
Multi-exchange crypto data fetching using ccxt library

Features:
- Multiple exchange support (Binance, CoinGecko, Kraken, etc.)
- Automatic fallback between exchanges
- Comprehensive error handling and retry logic
- Rich console output for verbose logging
- Caching for improved performance
- Unified data format across exchanges

Copyright (c) 2025 AI Trading
All rights reserved.
"""

import ccxt
import time
import json
import requests
import requests_cache
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union, Any
from dataclasses import dataclass, asdict
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.live import Live
import logging
import warnings
warnings.filterwarnings('ignore')

# Setup rich console for enhanced output
console = Console()

# Setup requests cache for better performance
requests_cache.install_cache('crypto_cache', expire_after=300)

@dataclass
class PriceData:
    """Standardized price data structure"""
    symbol: str
    price: float
    change_24h: float
    volume_24h: float
    timestamp: datetime
    source: str
    high_24h: Optional[float] = None
    low_24h: Optional[float] = None
    market_cap: Optional[float] = None

@dataclass
class OHLCData:
    """Standardized OHLC candle data"""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    symbol: str
    timeframe: str
    source: str

class CryptoDataError(Exception):
    """Custom exception for crypto data operations"""
    def __init__(self, message: str, source: str = "Unknown", code: str = "GENERAL_ERROR"):
        self.message = message
        self.source = source
        self.code = code
        self.timestamp = datetime.now()
        super().__init__(self.message)

class EnhancedCryptoDataService:
    """Enhanced crypto data service with multiple exchange support"""
    
    def __init__(self, verbose: bool = True, enable_cache: bool = True):
        self.verbose = verbose
        self.enable_cache = enable_cache
        self.console = Console() if verbose else None
        
        # Initialize exchanges in order of preference
        self.exchanges = self._initialize_exchanges()
        self.primary_exchange = None
        self.fallback_exchanges = []
        
        # Performance tracking
        self.request_count = 0
        self.error_count = 0
        self.cache_hits = 0
        
        # Setup logging
        self._setup_logging()
        
        if self.verbose:
            self._display_startup_info()
    
    def _setup_logging(self):
        """Setup comprehensive logging"""
        logging.basicConfig(
            level=logging.INFO if self.verbose else logging.WARNING,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger('CryptoDataService')
    
    def _initialize_exchanges(self) -> Dict[str, Any]:
        """Initialize and test available exchanges with fallback strategy"""
        exchanges = {}
        
        # Primary: CoinGecko API (direct REST calls - no API key needed)
        try:
            coingecko_config = {
                'base_url': 'https://api.coingecko.com/api/v3',
                'rate_limit': 1200,  # 50 calls per minute
                'timeout': 30,
                'symbol_mapping': {
                    'BTC/USDT': {'id': 'bitcoin', 'vs_currency': 'usd'},
                    'ETH/USDT': {'id': 'ethereum', 'vs_currency': 'usd'},
                    'BNB/USDT': {'id': 'binancecoin', 'vs_currency': 'usd'},
                    'ADA/USDT': {'id': 'cardano', 'vs_currency': 'usd'},
                    'DOT/USDT': {'id': 'polkadot', 'vs_currency': 'usd'},
                    'XRP/USDT': {'id': 'ripple', 'vs_currency': 'usd'},
                    'LTC/USDT': {'id': 'litecoin', 'vs_currency': 'usd'},
                    'LINK/USDT': {'id': 'chainlink', 'vs_currency': 'usd'},
                }
            }
            
            # Test CoinGecko connectivity
            response = requests.get(f"{coingecko_config['base_url']}/ping", timeout=10)
            if response.status_code == 200:
                exchanges['coingecko'] = coingecko_config
                self.primary_exchange = 'coingecko'
                if self.verbose:
                    console.print("✅ [green]CoinGecko API initialized successfully[/green]")
        except Exception as e:
            if self.verbose:
                console.print(f"❌ [red]Failed to initialize CoinGecko: {str(e)}[/red]")
        
        # Secondary: ccxt exchanges (with sandbox mode disabled)
        exchange_configs = [
            ('binance', ccxt.binance, {'sandbox': False, 'enableRateLimit': True, 'timeout': 10000}),
            ('coinbase', ccxt.coinbase, {'sandbox': False, 'enableRateLimit': True, 'timeout': 10000}),
            ('kraken', ccxt.kraken, {'sandbox': False, 'enableRateLimit': True, 'timeout': 10000}),
        ]
        
        for name, exchange_class, config in exchange_configs:
            try:
                exchange = exchange_class(config)
                # Quick test - don't load full markets to avoid timeout
                test_ticker = exchange.fetch_ticker('BTC/USDT')
                if test_ticker:
                    exchanges[name] = exchange
                    if self.primary_exchange is None:
                        self.primary_exchange = name
                    else:
                        self.fallback_exchanges.append(name)
                    
                    if self.verbose:
                        console.print(f"✅ [green]{name.title()} exchange initialized successfully[/green]")
                        
            except Exception as e:
                if self.verbose:
                    console.print(f"⚠️ [yellow]{name} exchange unavailable (will use as backup): {str(e)[:100]}[/yellow]")
                # Still add exchange for potential use, but mark as untested
                try:
                    exchange = exchange_class(config)
                    exchanges[f"{name}_backup"] = exchange
                    self.fallback_exchanges.append(f"{name}_backup")
                except:
                    pass
        
        return exchanges
    
    def _display_startup_info(self):
        """Display startup information with rich formatting"""
        table = Table(title="🚀 Enhanced Crypto Data Service v2.0.0")
        table.add_column("Feature", style="cyan")
        table.add_column("Status", style="green")
        
        table.add_row("Primary Exchange", self.primary_exchange or "None")
        table.add_row("Fallback Exchanges", f"{len(self.fallback_exchanges)} available")
        table.add_row("Cache Enabled", "Yes" if self.enable_cache else "No")
        table.add_row("Verbose Logging", "Yes" if self.verbose else "No")
        table.add_row("Supported Exchanges", f"{len(self.exchanges)} connected")
        
        console.print(table)
        console.print()
    
    def _log_operation(self, operation: str, symbol: str = "", exchange: str = "", 
                      success: bool = True, duration: float = 0, data_size: int = 0):
        """Log operation with detailed information"""
        self.request_count += 1
        if not success:
            self.error_count += 1
        
        if self.verbose:
            status = "✅" if success else "❌"
            status_color = "green" if success else "red"
            
            log_msg = f"{status} [{status_color}]{operation}[/{status_color}]"
            if symbol:
                log_msg += f" | Symbol: {symbol}"
            if exchange:
                log_msg += f" | Exchange: {exchange}"
            if duration > 0:
                log_msg += f" | Duration: {duration:.2f}s"
            if data_size > 0:
                log_msg += f" | Data: {data_size} bytes"
            
            console.print(log_msg)
    
    def _fetch_coingecko_price(self, symbol: str) -> PriceData:
        """Fetch price data from CoinGecko API directly"""
        if 'coingecko' not in self.exchanges:
            raise CryptoDataError("CoinGecko not available", "coingecko")
        
        config = self.exchanges['coingecko']
        symbol_map = config['symbol_mapping'].get(symbol)
        
        if not symbol_map:
            raise CryptoDataError(f"Symbol {symbol} not supported by CoinGecko", "coingecko")
        
        url = f"{config['base_url']}/simple/price"
        params = {
            'ids': symbol_map['id'],
            'vs_currencies': symbol_map['vs_currency'],
            'include_24hr_change': 'true',
            'include_24hr_vol': 'true',
            'include_last_updated_at': 'true'
        }
        
        response = requests.get(url, params=params, timeout=config['timeout'])
        response.raise_for_status()
        
        data = response.json()
        coin_data = data[symbol_map['id']]
        vs_currency = symbol_map['vs_currency']
        
        return PriceData(
            symbol=symbol,
            price=coin_data[vs_currency],
            change_24h=coin_data.get(f'{vs_currency}_24h_change', 0),
            volume_24h=coin_data.get(f'{vs_currency}_24h_vol', 0),
            timestamp=datetime.now(),
            source='coingecko'
        )
    
    def _fetch_coingecko_ohlc(self, symbol: str, days: int = 30) -> List[OHLCData]:
        """Fetch OHLC data from CoinGecko API directly"""
        if 'coingecko' not in self.exchanges:
            raise CryptoDataError("CoinGecko not available", "coingecko")
        
        config = self.exchanges['coingecko']
        symbol_map = config['symbol_mapping'].get(symbol)
        
        if not symbol_map:
            raise CryptoDataError(f"Symbol {symbol} not supported by CoinGecko", "coingecko")
        
        url = f"{config['base_url']}/coins/{symbol_map['id']}/ohlc"
        params = {
            'vs_currency': symbol_map['vs_currency'],
            'days': days
        }
        
        response = requests.get(url, params=params, timeout=config['timeout'])
        response.raise_for_status()
        
        data = response.json()
        
        ohlc_data = []
        for candle in data:
            timestamp, open_price, high, low, close = candle
            ohlc_data.append(OHLCData(
                timestamp=datetime.fromtimestamp(timestamp / 1000),
                open=open_price,
                high=high,
                low=low,
                close=close,
                volume=0,  # CoinGecko OHLC doesn't include volume
                symbol=symbol,
                timeframe='1d',  # CoinGecko OHLC is daily
                source='coingecko'
            ))
        
        return ohlc_data
    def get_current_price(self, symbol: str) -> PriceData:
        """Get current price for a symbol with fallback support"""
        symbol = symbol.upper()
        
        if self.verbose:
            console.print(f"🔍 [cyan]Fetching current price for {symbol}[/cyan]")
        
        # Try CoinGecko first (most reliable)
        if self.primary_exchange == 'coingecko':
            try:
                start_time = time.time()
                price_data = self._fetch_coingecko_price(symbol)
                duration = time.time() - start_time
                
                self._log_operation(
                    "Price Fetch", symbol, "coingecko", True, duration,
                    len(json.dumps(asdict(price_data)))
                )
                
                return price_data
                
            except Exception as e:
                self._log_operation("Price Fetch", symbol, "coingecko", False)
                if self.verbose:
                    console.print(f"⚠️ [yellow]CoinGecko failed, trying exchanges: {str(e)[:100]}[/yellow]")
        
        # Fallback to ccxt exchanges
        exchange_list = [ex for ex in [self.primary_exchange] + self.fallback_exchanges if ex != 'coingecko']
        
        for exchange_name in exchange_list:
            if exchange_name not in self.exchanges:
                continue
                
            try:
                start_time = time.time()
                exchange = self.exchanges[exchange_name]
                
                # Get ticker data
                ticker = exchange.fetch_ticker(symbol)
                duration = time.time() - start_time
                
                price_data = PriceData(
                    symbol=symbol,
                    price=ticker['last'] or ticker['close'],
                    change_24h=ticker['percentage'] or 0,
                    volume_24h=ticker['quoteVolume'] or ticker['baseVolume'] or 0,
                    high_24h=ticker['high'],
                    low_24h=ticker['low'],
                    timestamp=datetime.now(),
                    source=exchange_name
                )
                
                self._log_operation(
                    "Price Fetch", symbol, exchange_name, True, duration,
                    len(json.dumps(asdict(price_data)))
                )
                
                return price_data
                
            except Exception as e:
                self._log_operation("Price Fetch", symbol, exchange_name, False)
                if self.verbose:
                    console.print(f"⚠️ [yellow]Fallback to next exchange due to: {str(e)[:100]}[/yellow]")
                continue
        
        raise CryptoDataError(f"Failed to fetch price for {symbol} from all exchanges")
    
    def get_ohlc_data(self, symbol: str, timeframe: str = '1d', limit: int = 100) -> List[OHLCData]:
        """Get OHLC data with enhanced error handling"""
        symbol = symbol.upper()
        
        if self.verbose:
            console.print(f"📊 [cyan]Fetching OHLC data for {symbol} ({timeframe}, {limit} candles)[/cyan]")
        
        # Try CoinGecko first for daily data
        if self.primary_exchange == 'coingecko' and timeframe in ['1d', '1D']:
            try:
                start_time = time.time()
                ohlc_data = self._fetch_coingecko_ohlc(symbol, limit)
                duration = time.time() - start_time
                
                self._log_operation(
                    "OHLC Fetch", symbol, "coingecko", True, duration,
                    len(ohlc_data)
                )
                
                return ohlc_data[-limit:]  # Return latest data up to limit
                
            except Exception as e:
                self._log_operation("OHLC Fetch", symbol, "coingecko", False)
                if self.verbose:
                    console.print(f"⚠️ [yellow]CoinGecko OHLC failed, trying exchanges: {str(e)[:100]}[/yellow]")
        
        # Fallback to ccxt exchanges
        exchange_list = [ex for ex in [self.primary_exchange] + self.fallback_exchanges if ex != 'coingecko']
        
        for exchange_name in exchange_list:
            if exchange_name not in self.exchanges:
                continue
                
            try:
                start_time = time.time()
                exchange = self.exchanges[exchange_name]
                
                # Fetch OHLC data
                ohlc = exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
                duration = time.time() - start_time
                
                # Convert to standardized format
                ohlc_data = []
                for candle in ohlc:
                    timestamp, open_price, high, low, close, volume = candle
                    ohlc_data.append(OHLCData(
                        timestamp=datetime.fromtimestamp(timestamp / 1000),
                        open=open_price,
                        high=high,
                        low=low,
                        close=close,
                        volume=volume,
                        symbol=symbol,
                        timeframe=timeframe,
                        source=exchange_name
                    ))
                
                self._log_operation(
                    "OHLC Fetch", symbol, exchange_name, True, duration,
                    len(ohlc_data)
                )
                
                return ohlc_data
                
            except Exception as e:
                self._log_operation("OHLC Fetch", symbol, exchange_name, False)
                if self.verbose:
                    console.print(f"⚠️ [yellow]Fallback to next exchange due to: {str(e)[:100]}[/yellow]")
                continue
        
        raise CryptoDataError(f"Failed to fetch OHLC data for {symbol} from all exchanges")
    
    def get_multiple_prices(self, symbols: List[str]) -> Dict[str, PriceData]:
        """Get prices for multiple symbols efficiently"""
        if self.verbose:
            console.print(f"🔍 [cyan]Fetching prices for {len(symbols)} symbols[/cyan]")
        
        results = {}
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console if self.verbose else None,
            disable=not self.verbose
        ) as progress:
            
            task = progress.add_task("Fetching prices...", total=len(symbols))
            
            for symbol in symbols:
                try:
                    results[symbol] = self.get_current_price(symbol)
                    progress.advance(task)
                except Exception as e:
                    if self.verbose:
                        console.print(f"❌ [red]Failed to fetch {symbol}: {str(e)}[/red]")
                    progress.advance(task)
        
        return results
    
    def get_exchange_status(self) -> Dict[str, Any]:
        """Get status of all exchanges"""
        status = {
            'total_exchanges': len(self.exchanges),
            'primary_exchange': self.primary_exchange,
            'fallback_exchanges': self.fallback_exchanges,
            'request_count': self.request_count,
            'error_count': self.error_count,
            'error_rate': self.error_count / max(self.request_count, 1) * 100,
            'exchanges': {}
        }
        
        for name, exchange in self.exchanges.items():
            try:
                # Test exchange connectivity
                start_time = time.time()
                exchange.fetch_markets()
                response_time = time.time() - start_time
                
                status['exchanges'][name] = {
                    'status': 'online',
                    'response_time': response_time,
                    'rate_limit': exchange.rateLimit,
                    'markets': len(exchange.markets)
                }
                
            except Exception as e:
                status['exchanges'][name] = {
                    'status': 'offline',
                    'error': str(e)
                }
        
        return status
    
    def display_status(self):
        """Display comprehensive status information"""
        if not self.verbose:
            return
        
        status = self.get_exchange_status()
        
        # Create status table
        table = Table(title="📊 Crypto Data Service Status")
        table.add_column("Exchange", style="cyan")
        table.add_column("Status", style="green")
        table.add_column("Response Time", style="yellow")
        table.add_column("Markets", style="blue")
        
        for name, info in status['exchanges'].items():
            status_icon = "🟢" if info['status'] == 'online' else "🔴"
            response_time = f"{info.get('response_time', 0):.2f}s" if info['status'] == 'online' else "N/A"
            markets = str(info.get('markets', 0)) if info['status'] == 'online' else "N/A"
            
            table.add_row(
                f"{status_icon} {name.title()}",
                info['status'].title(),
                response_time,
                markets
            )
        
        console.print(table)
        
        # Display performance metrics
        perf_panel = Panel(
            f"📈 Requests: {status['request_count']} | "
            f"❌ Errors: {status['error_count']} | "
            f"📊 Error Rate: {status['error_rate']:.1f}%",
            title="Performance Metrics"
        )
        console.print(perf_panel)
    
    # Legacy compatibility methods
    def getKlines(self, symbol: str, interval: str = '1d', limit: int = 100) -> List[List]:
        """Legacy compatibility method for existing code"""
        ohlc_data = self.get_ohlc_data(symbol, interval, limit)
        
        # Convert to Binance klines format for compatibility
        klines = []
        for candle in ohlc_data:
            timestamp_ms = int(candle.timestamp.timestamp() * 1000)
            klines.append([
                timestamp_ms,                    # Open time
                str(candle.open),               # Open
                str(candle.high),               # High
                str(candle.low),                # Low
                str(candle.close),              # Close
                str(candle.volume),             # Volume
                timestamp_ms + 60000,           # Close time (approximate)
                '0',                            # Quote asset volume
                0,                              # Number of trades
                '0',                            # Taker buy base asset volume
                '0',                            # Taker buy quote asset volume
                '0'                             # Unused field
            ])
        
        return klines
    
    def getCurrentPrice(self, symbol: str) -> Dict[str, Any]:
        """Legacy compatibility method"""
        price_data = self.get_current_price(symbol)
        
        return {
            'symbol': price_data.symbol,
            'price': price_data.price,
            'change24h': price_data.change_24h,
            'volume24h': price_data.volume_24h,
            'timestamp': price_data.timestamp.isoformat(),
            'source': price_data.source
        }

# Global service instance
enhanced_crypto_service = EnhancedCryptoDataService()

# Backward compatibility
def get_binance_data(symbol: str, interval: str, limit: int = 1000) -> List[List]:
    """Backward compatibility function for existing code"""
    return enhanced_crypto_service.getKlines(symbol, interval, limit)

if __name__ == "__main__":
    # Test the service
    service = EnhancedCryptoDataService(verbose=True)
    
    try:
        # Test current price
        console.print("\n🧪 [bold]Testing Current Price Fetch[/bold]")
        btc_price = service.get_current_price("BTC/USDT")
        console.print(f"BTC Price: ${btc_price.price:,.2f} (24h: {btc_price.change_24h:+.2f}%)")
        
        # Test OHLC data
        console.print("\n🧪 [bold]Testing OHLC Data Fetch[/bold]")
        ohlc_data = service.get_ohlc_data("BTC/USDT", "1h", 5)
        console.print(f"Retrieved {len(ohlc_data)} OHLC candles")
        
        # Display status
        console.print("\n📊 [bold]Service Status[/bold]")
        service.display_status()
        
    except Exception as e:
        console.print(f"❌ [red]Error during testing: {str(e)}[/red]")