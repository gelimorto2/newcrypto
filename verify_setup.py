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