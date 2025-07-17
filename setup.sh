#!/bin/bash

# AI Crypto Trading Bot Setup Script
# Enhanced with CoinGecko API integration and verbose logging

echo "🚀 AI Crypto Trading Bot Setup"
echo "==============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Python is installed
check_python() {
    print_status "Checking Python installation..."
    
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
        print_success "Python 3 found: $PYTHON_VERSION"
        
        # Check if version is 3.8+
        PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
        PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
        
        if [[ $PYTHON_MAJOR -eq 3 && $PYTHON_MINOR -ge 8 ]]; then
            print_success "Python version is compatible (3.8+)"
        else
            print_warning "Python version might be too old. Recommended: 3.8+"
        fi
        
        return 0
    else
        print_error "Python 3 not found. Please install Python 3.8 or later."
        return 1
    fi
}

# Check if pip is installed
check_pip() {
    print_status "Checking pip installation..."
    
    if command -v pip3 &> /dev/null; then
        PIP_VERSION=$(pip3 --version 2>&1 | awk '{print $2}')
        print_success "pip3 found: $PIP_VERSION"
        return 0
    elif command -v pip &> /dev/null; then
        PIP_VERSION=$(pip --version 2>&1 | awk '{print $2}')
        print_success "pip found: $PIP_VERSION"
        return 0
    else
        print_error "pip not found. Please install pip."
        return 1
    fi
}

# Install Python dependencies
install_dependencies() {
    print_status "Installing Python dependencies..."
    
    if [[ -f "ai_requirements.txt" ]]; then
        print_status "Installing AI requirements..."
        
        if pip3 install -r ai_requirements.txt; then
            print_success "AI dependencies installed successfully"
        else
            print_error "Failed to install AI dependencies"
            return 1
        fi
    else
        print_error "ai_requirements.txt not found!"
        return 1
    fi
    
    # Optional: Install backtest requirements
    if [[ -f "backtest/requirements.txt" ]]; then
        print_status "Installing backtest requirements..."
        
        if pip3 install -r backtest/requirements.txt; then
            print_success "Backtest dependencies installed successfully"
        else
            print_warning "Failed to install backtest dependencies (optional)"
        fi
    fi
    
    return 0
}

# Test installations
test_installation() {
    print_status "Testing installation..."
    
    # Test Python imports
    print_status "Testing Python imports..."
    
    IMPORTS_TO_TEST=(
        "sklearn"
        "numpy"
        "pandas"
        "flask"
        "requests"
        "plotly"
    )
    
    for import in "${IMPORTS_TO_TEST[@]}"; do
        if python3 -c "import $import" 2>/dev/null; then
            print_success "$import ✓"
        else
            print_error "$import ✗"
        fi
    done
    
    # Test AI API
    print_status "Testing AI API server..."
    
    if [[ -f "ai_api.py" ]]; then
        print_status "Starting AI API server test..."
        
        # Start server in background
        python3 ai_api.py &
        SERVER_PID=$!
        
        # Wait a moment for server to start
        sleep 3
        
        # Test if server is responding
        if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
            print_success "AI API server is working"
        else
            print_warning "AI API server test failed (this is optional)"
        fi
        
        # Stop the server
        kill $SERVER_PID 2>/dev/null
        
    else
        print_warning "ai_api.py not found - skipping API test"
    fi
}

# Create launch script
create_launch_script() {
    print_status "Creating launch script..."
    
    cat > launch.sh << 'EOF'
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
EOF

    chmod +x launch.sh
    print_success "Launch script created: ./launch.sh"
}

# Display final information
show_final_info() {
    echo ""
    echo "🎉 Installation Complete!"
    echo "========================"
    echo ""
    echo "📋 What was installed:"
    echo "   • Python AI dependencies (scikit-learn, pandas, flask, etc.)"
    echo "   • Enhanced crypto data service with CoinGecko API"
    echo "   • Verbose logging system for debugging"
    echo "   • Automatic fallback to Binance API"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Run: ./launch.sh (or python3 -m http.server 8000)"
    echo "   2. Open: http://localhost:8000 in your browser"
    echo "   3. Test: http://localhost:8000/test-crypto-service.html"
    echo ""
    echo "📊 Features:"
    echo "   • No API key required for basic functionality"
    echo "   • Automatic data source switching"
    echo "   • Comprehensive error logging"
    echo "   • Real-time performance monitoring"
    echo ""
    echo "🔍 Debugging:"
    echo "   • Open browser Developer Tools (F12)"
    echo "   • Check Console tab for detailed logs"
    echo "   • All API calls and errors are logged verbosely"
    echo ""
    echo "📖 Documentation:"
    echo "   • README.md - Complete installation and usage guide"
    echo "   • AI_DOCUMENTATION.md - AI features guide"
    echo ""
    print_warning "Remember: Always test with paper trading before using real funds!"
}

# Main installation flow
main() {
    echo ""
    
    # Check prerequisites
    if ! check_python; then
        exit 1
    fi
    
    if ! check_pip; then
        exit 1
    fi
    
    # Install dependencies
    if ! install_dependencies; then
        exit 1
    fi
    
    # Test installation
    test_installation
    
    # Create launch script
    create_launch_script
    
    # Show final information
    show_final_info
    
    echo ""
    print_success "Setup completed successfully! 🎉"
    echo ""
}

# Run main function
main "$@"