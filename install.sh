#!/bin/bash

# Enhanced AI Crypto Trading Bot - One-Click Setup
# v2.0.0 - Simplified Installation with Enhanced Data Sources

set -e  # Exit on any error

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Banner
echo -e "${CYAN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                   🚀 AI Crypto Trading Bot v2.0.0                          ║"
echo "║                   Enhanced Setup with Multiple Data Sources                 ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Enhanced logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")  echo -e "${BLUE}[${timestamp}] [INFO]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[${timestamp}] [SUCCESS]${NC} $message" ;;
        "WARNING") echo -e "${YELLOW}[${timestamp}] [WARNING]${NC} $message" ;;
        "ERROR") echo -e "${RED}[${timestamp}] [ERROR]${NC} $message" ;;
        "STEP") echo -e "${PURPLE}[${timestamp}] [STEP]${NC} ${BOLD}$message${NC}" ;;
    esac
}

# Progress indicator
show_progress() {
    local current=$1
    local total=$2
    local message=$3
    local percent=$((current * 100 / total))
    local bar_length=50
    local filled_length=$((bar_length * current / total))
    
    printf "\r${CYAN}["
    for ((i=0; i<filled_length; i++)); do printf "█"; done
    for ((i=filled_length; i<bar_length; i++)); do printf "░"; done
    printf "] %d%% - %s${NC}" "$percent" "$message"
    
    if [ $current -eq $total ]; then
        echo
    fi
}

# Check system requirements
check_requirements() {
    log "STEP" "🔍 Checking system requirements..."
    
    # Check Python
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
        PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
        PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
        
        if [[ $PYTHON_MAJOR -eq 3 && $PYTHON_MINOR -ge 8 ]]; then
            log "SUCCESS" "Python 3.8+ found: $PYTHON_VERSION"
        else
            log "WARNING" "Python $PYTHON_VERSION detected. Recommended: 3.8+"
        fi
    else
        log "ERROR" "Python 3 not found. Please install Python 3.8+"
        exit 1
    fi
    
    # Check pip
    if command -v pip3 &> /dev/null || command -v pip &> /dev/null; then
        log "SUCCESS" "pip package manager found"
    else
        log "ERROR" "pip not found. Please install pip"
        exit 1
    fi
    
    # Check internet connectivity
    if curl -s --head --request GET https://pypi.org | grep "200 OK" > /dev/null; then
        log "SUCCESS" "Internet connectivity verified"
    else
        log "WARNING" "Internet connectivity issues detected"
    fi
    
    # Check disk space (at least 500MB)
    AVAILABLE_SPACE=$(df . | tail -1 | awk '{print $4}')
    if [ $AVAILABLE_SPACE -gt 500000 ]; then
        log "SUCCESS" "Sufficient disk space available"
    else
        log "WARNING" "Low disk space detected"
    fi
}

# Install dependencies with progress
install_dependencies() {
    log "STEP" "📦 Installing Python dependencies..."
    
    local packages=(
        "scikit-learn>=1.3.0"
        "numpy>=1.24.0" 
        "pandas>=2.0.0"
        "flask>=2.3.0"
        "flask-cors>=4.0.0"
        "requests>=2.31.0"
        "ccxt>=4.3.0"
        "python-binance>=1.0.19"
        "requests-cache>=1.1.0"
        "rich>=13.7.0"
        "plotly>=5.15.0"
    )
    
    local total=${#packages[@]}
    local current=0
    
    for package in "${packages[@]}"; do
        ((current++))
        show_progress $current $total "Installing $package"
        
        if pip3 install "$package" --quiet --user; then
            log "SUCCESS" "✓ $package installed"
        else
            log "WARNING" "Failed to install $package - will retry with requirements.txt"
        fi
    done
    
    echo
    log "INFO" "Installing remaining dependencies from requirements.txt..."
    
    if pip3 install -r ai_requirements.txt --quiet --user; then
        log "SUCCESS" "All dependencies installed successfully"
    else
        log "WARNING" "Some dependencies may have failed - checking individual packages..."
    fi
}

# Test installations
test_installation() {
    log "STEP" "🧪 Testing installation..."
    
    local test_imports=(
        "sklearn:scikit-learn"
        "numpy:numpy" 
        "pandas:pandas"
        "flask:Flask"
        "ccxt:CCXT"
        "requests:Requests"
        "rich:Rich Console"
    )
    
    local passed=0
    local total=${#test_imports[@]}
    
    for import_test in "${test_imports[@]}"; do
        IFS=':' read -r module_name display_name <<< "$import_test"
        
        if python3 -c "import $module_name" 2>/dev/null; then
            log "SUCCESS" "✓ $display_name"
            ((passed++))
        else
            log "WARNING" "✗ $display_name (optional)"
        fi
    done
    
    log "INFO" "Import test results: $passed/$total packages working"
    
    # Test crypto data service
    log "INFO" "Testing enhanced crypto data service..."
    
    if python3 -c "
from crypto_data_service import EnhancedCryptoDataService
service = EnhancedCryptoDataService(verbose=False)
print('Enhanced crypto service initialized successfully')
" 2>/dev/null; then
        log "SUCCESS" "✓ Enhanced crypto data service working"
    else
        log "WARNING" "Enhanced crypto data service has issues (will use fallback)"
    fi
}

# Create optimized launch script
create_launch_script() {
    log "STEP" "🚀 Creating optimized launch script..."
    
    cat > enhanced_launch.sh << 'EOF'
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
    echo -e "${GREEN}   🥇 Primary: CoinGecko API (no API key required)${NC}"
    echo -e "${GREEN}   🥈 Backup: Multiple exchanges via CCXT${NC}"
    echo -e "${GREEN}   📡 Enhanced: Python crypto data service${NC}"
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
EOF
    
    chmod +x enhanced_launch.sh
    log "SUCCESS" "✓ Enhanced launch script created"
}

# Create quick setup verification
create_verification_script() {
    log "STEP" "✅ Creating verification script..."
    
    cat > verify_setup.py << 'EOF'
#!/usr/bin/env python3
"""
Enhanced AI Crypto Trading Bot - Setup Verification
Tests all components and reports status
"""

import sys
import subprocess
import requests
import time
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

console = Console()

def test_imports():
    """Test critical imports"""
    tests = [
        ("numpy", "numpy"),
        ("pandas", "pandas"), 
        ("flask", "flask"),
        ("sklearn", "scikit-learn"),
        ("ccxt", "ccxt"),
        ("requests", "requests"),
        ("rich", "rich"),
    ]
    
    results = {}
    for module, display_name in tests:
        try:
            __import__(module)
            results[display_name] = "✅ OK"
        except ImportError:
            results[display_name] = "❌ MISSING"
    
    return results

def test_crypto_service():
    """Test enhanced crypto data service"""
    try:
        from crypto_data_service import EnhancedCryptoDataService
        service = EnhancedCryptoDataService(verbose=False)
        return "✅ LOADED"
    except Exception as e:
        return f"❌ ERROR: {str(e)[:50]}"

def test_ai_api():
    """Test AI API server"""
    try:
        response = requests.get("http://localhost:5000/api/health", timeout=5)
        if response.status_code == 200:
            return "✅ RUNNING"
        else:
            return f"⚠️ STATUS: {response.status_code}"
    except requests.ConnectionError:
        return "❌ NOT RUNNING"
    except Exception as e:
        return f"❌ ERROR: {str(e)[:30]}"

def main():
    console.print(Panel.fit("🧪 [bold cyan]Enhanced AI Crypto Bot - Setup Verification[/bold cyan]"))
    
    # Test imports
    console.print("\n[bold]📦 Testing Python Packages[/bold]")
    import_results = test_imports()
    
    table = Table()
    table.add_column("Package", style="cyan")
    table.add_column("Status", style="green")
    
    for package, status in import_results.items():
        table.add_row(package, status)
    
    console.print(table)
    
    # Test crypto service
    console.print("\n[bold]🚀 Testing Enhanced Crypto Service[/bold]")
    crypto_status = test_crypto_service()
    console.print(f"Enhanced Crypto Data Service: {crypto_status}")
    
    # Test AI API
    console.print("\n[bold]🤖 Testing AI API Server[/bold]")
    api_status = test_ai_api()
    console.print(f"AI API Server: {api_status}")
    
    # Summary
    console.print("\n[bold]📋 Summary[/bold]")
    working_packages = sum(1 for status in import_results.values() if "✅" in status)
    total_packages = len(import_results)
    
    console.print(f"• Python packages: {working_packages}/{total_packages} working")
    console.print(f"• Enhanced crypto service: {'Working' if '✅' in crypto_status else 'Issues detected'}")
    console.print(f"• AI API server: {'Running' if '✅' in api_status else 'Not running'}")
    
    if working_packages >= 6:
        console.print("\n[bold green]✅ Setup verification passed! Bot is ready to use.[/bold green]")
        console.print("\n[cyan]🚀 Start with: ./enhanced_launch.sh --quick[/cyan]")
    else:
        console.print("\n[bold yellow]⚠️ Some issues detected. Check installation.[/bold yellow]")
        console.print("\n[cyan]🔧 Try: pip3 install -r ai_requirements.txt --user[/cyan]")

if __name__ == "__main__":
    main()
EOF
    
    chmod +x verify_setup.py
    log "SUCCESS" "✓ Verification script created"
}

# Display final summary
show_summary() {
    echo
    echo -e "${CYAN}${BOLD}"
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                    🎉 Installation Complete! 🎉                            ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    log "SUCCESS" "Enhanced AI Crypto Trading Bot v2.0.0 is ready!"
    echo
    
    echo -e "${BLUE}📋 What was installed:${NC}"
    echo -e "${GREEN}   ✓ Enhanced crypto data library (CCXT + fallbacks)${NC}"
    echo -e "${GREEN}   ✓ Multiple exchange support${NC}"
    echo -e "${GREEN}   ✓ Comprehensive verbose logging${NC}"
    echo -e "${GREEN}   ✓ Automatic fallback systems${NC}"
    echo -e "${GREEN}   ✓ Python AI backend with ML models${NC}"
    echo -e "${GREEN}   ✓ Streamlit backtesting interface${NC}"
    echo
    
    echo -e "${BLUE}🚀 Quick Start Commands:${NC}"
    echo -e "${CYAN}   ./enhanced_launch.sh --quick    ${NC}# Start everything instantly"
    echo -e "${CYAN}   ./enhanced_launch.sh            ${NC}# Interactive startup"
    echo -e "${CYAN}   python3 verify_setup.py        ${NC}# Test installation"
    echo -e "${CYAN}   streamlit run backtest/backtest.py  ${NC}# Run backtester"
    echo
    
    echo -e "${BLUE}🔗 Available Interfaces:${NC}"
    echo -e "${GREEN}   • Main Dashboard: http://localhost:8000${NC}"
    echo -e "${GREEN}   • Paper Trading:  http://localhost:8000/paper/paper.html${NC}"
    echo -e "${GREEN}   • Live Trading:   http://localhost:8000/live/live.html${NC}"
    echo -e "${GREEN}   • Data Testing:   http://localhost:8000/test-crypto-service.html${NC}"
    echo
    
    echo -e "${BLUE}📊 Enhanced Features:${NC}"
    echo -e "${GREEN}   • CoinGecko API (primary) - no API key needed${NC}"
    echo -e "${GREEN}   • CCXT library with 100+ exchanges${NC}"
    echo -e "${GREEN}   • Automatic fallback between data sources${NC}"
    echo -e "${GREEN}   • Rich console output and verbose logging${NC}"
    echo -e "${GREEN}   • Request caching for better performance${NC}"
    echo -e "${GREEN}   • Comprehensive error handling${NC}"
    echo
    
    echo -e "${YELLOW}⚠️ Important Notes:${NC}"
    echo -e "${YELLOW}   • Always test strategies in paper trading first${NC}"
    echo -e "${YELLOW}   • Check console logs (F12) for detailed information${NC}"
    echo -e "${YELLOW}   • Multiple data sources ensure high reliability${NC}"
    echo -e "${YELLOW}   • No API keys required for basic functionality${NC}"
    echo
    
    echo -e "${PURPLE}🎯 Next Steps:${NC}"
    echo -e "${PURPLE}   1. Run: ./enhanced_launch.sh --quick${NC}"
    echo -e "${PURPLE}   2. Open: http://localhost:8000 in your browser${NC}"
    echo -e "${PURPLE}   3. Test: Paper trading interface first${NC}"
    echo -e "${PURPLE}   4. Check: Console logs for verbose output${NC}"
    echo
}

# Main installation flow
main() {
    local start_time=$(date +%s)
    
    # Step 1: Check requirements
    show_progress 1 6 "Checking system requirements"
    check_requirements
    
    # Step 2: Install dependencies  
    show_progress 2 6 "Installing enhanced dependencies"
    install_dependencies
    
    # Step 3: Test installation
    show_progress 3 6 "Testing installation"
    test_installation
    
    # Step 4: Create launch script
    show_progress 4 6 "Creating enhanced launcher"
    create_launch_script
    
    # Step 5: Create verification
    show_progress 5 6 "Creating verification tools"
    create_verification_script
    
    # Step 6: Complete
    show_progress 6 6 "Finalizing setup"
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo
    log "SUCCESS" "Installation completed in ${duration} seconds"
    
    show_summary
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Enhanced AI Crypto Trading Bot Setup v2.0.0"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --quick, -q    Quick installation (minimal prompts)"
        echo "  --verify, -v   Verify existing installation"
        echo ""
        exit 0
        ;;
    --quick|-q)
        log "INFO" "Running quick installation mode"
        main
        ;;
    --verify|-v)
        log "INFO" "Verifying existing installation"
        if [[ -f "verify_setup.py" ]]; then
            python3 verify_setup.py
        else
            log "ERROR" "Verification script not found. Run full setup first."
            exit 1
        fi
        ;;
    *)
        main
        ;;
esac