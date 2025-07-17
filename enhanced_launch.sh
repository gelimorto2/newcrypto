#!/bin/bash

# Enhanced AI Crypto Trading Bot Launcher v2.0.0
# One-command startup with enhanced data sources

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🚀 Starting Enhanced AI Crypto Trading Bot v2.0.0${NC}"
echo -e "${BLUE}Enhanced with multiple data sources and verbose logging${NC}"
echo

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $1 is already in use${NC}"
        return 1
    fi
    return 0
}

# Start AI API server
start_api_server() {
    if check_port 5000; then
        echo -e "${BLUE}🤖 Starting AI API server...${NC}"
        python3 ai_api.py &
        API_PID=$!
        sleep 2
        
        if curl -s http://localhost:5000/api/health >/dev/null 2>&1; then
            echo -e "${GREEN}✅ AI API server running (PID: $API_PID)${NC}"
            echo -e "${BLUE}   📡 API available at: http://localhost:5000${NC}"
        else
            echo -e "${YELLOW}⚠️  AI API server may have issues${NC}"
        fi
    else
        echo -e "${YELLOW}ℹ️  AI API server already running on port 5000${NC}"
    fi
}

# Start web server
start_web_server() {
    if check_port 8000; then
        echo -e "${BLUE}🌐 Starting web server...${NC}"
        python3 -m http.server 8000 &
        WEB_PID=$!
        sleep 1
        echo -e "${GREEN}✅ Web server running (PID: $WEB_PID)${NC}"
        echo -e "${BLUE}   🌍 Web interface: http://localhost:8000${NC}"
    else
        echo -e "${YELLOW}ℹ️  Web server already running on port 8000${NC}"
    fi
}

# Display available interfaces
show_interfaces() {
    echo
    echo -e "${CYAN}🎯 Available Interfaces:${NC}"
    echo -e "${GREEN}   📊 Main Dashboard:    http://localhost:8000${NC}"
    echo -e "${GREEN}   📈 Paper Trading:     http://localhost:8000/paper/paper.html${NC}"
    echo -e "${GREEN}   💰 Live Trading:      http://localhost:8000/live/live.html${NC}"
    echo -e "${GREEN}   🧪 Data Test:         http://localhost:8000/test-crypto-service.html${NC}"
    echo -e "${GREEN}   📊 Backtest:          streamlit run backtest/backtest.py${NC}"
    echo
    echo -e "${CYAN}🔧 Data Sources:${NC}"
    echo -e "${GREEN}   🥇 Primary: Enhanced Python Service (ccxt library)${NC}"
    echo -e "${GREEN}   🥈 Backup: CoinGecko API (no API key required)${NC}"
    echo -e "${GREEN}   📡 Enhanced: Multiple exchange support${NC}"
    echo
    echo -e "${CYAN}🛠️  Debugging:${NC}"
    echo -e "${GREEN}   📱 Open browser Developer Tools (F12)${NC}"
    echo -e "${GREEN}   📊 Check Console tab for verbose logging${NC}"
    echo -e "${GREEN}   🔍 API Status: http://localhost:5000/api/crypto/status${NC}"
    echo
}

# Main execution
main() {
    # Quick startup mode
    if [[ "$1" == "--quick" || "$1" == "-q" ]]; then
        echo -e "${CYAN}⚡ Quick startup mode${NC}"
        start_api_server
        start_web_server
        show_interfaces
        echo -e "${GREEN}✅ All services started! Press Ctrl+C to stop${NC}"
        
        # Wait for interrupt
        trap 'echo "Stopping services..."; kill $API_PID $WEB_PID 2>/dev/null; exit' INT
        wait
        return
    fi
    
    # Interactive mode
    echo -e "${BLUE}🤖 Enhanced AI Crypto Trading Bot${NC}"
    echo -e "${BLUE}   Multiple data sources • Verbose logging • Auto-fallback${NC}"
    echo
    
    # Ask user preferences
    read -p "Start AI API server? (y/n) [y]: " -n 1 -r
    API_CHOICE=${REPLY:-y}
    echo
    
    read -p "Start web server? (y/n) [y]: " -n 1 -r  
    WEB_CHOICE=${REPLY:-y}
    echo
    echo
    
    # Start services based on user choice
    if [[ $API_CHOICE =~ ^[Yy]$ ]]; then
        start_api_server
    fi
    
    if [[ $WEB_CHOICE =~ ^[Yy]$ ]]; then
        start_web_server
    fi
    
    show_interfaces
    
    echo -e "${GREEN}✅ Setup complete! Press Ctrl+C to stop all services${NC}"
    echo
    
    # Wait for user interrupt
    trap 'echo "Stopping services..."; kill $API_PID $WEB_PID 2>/dev/null; exit' INT
    wait
}

# Run main function with all arguments
main "$@"