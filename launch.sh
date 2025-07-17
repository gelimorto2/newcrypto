#!/bin/bash

echo "🚀 Starting AI Crypto Trading Bot..."

# Check if AI API should be started
read -p "Start AI API server? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting AI API server..."
    python3 ai_api.py &
    API_PID=$!
    echo "AI API server started (PID: $API_PID)"
    echo "API available at: http://localhost:5000"
fi

# Check if web server should be started
read -p "Start web server? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting web server..."
    python3 -m http.server 8000 &
    WEB_PID=$!
    echo "Web server started (PID: $WEB_PID)"
    echo "Web interface available at: http://localhost:8000"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🔗 Available interfaces:"
echo "   • Main Interface: http://localhost:8000"
echo "   • Paper Trading: http://localhost:8000/paper/paper.html"
echo "   • Live Trading: http://localhost:8000/live/live.html"
echo "   • Test Interface: http://localhost:8000/test-crypto-service.html"
echo ""
echo "📊 Data Sources:"
echo "   • Primary: CoinGecko API (no API key required)"
echo "   • Fallback: Binance API (automatic)"
echo ""
echo "🔍 Debugging:"
echo "   • Open browser Developer Tools (F12)"
echo "   • Check Console tab for verbose logging"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user to stop
trap 'echo "Stopping services..."; kill $API_PID $WEB_PID 2>/dev/null; exit' INT
wait
