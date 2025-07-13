/**
 * Custom Chart Implementation for Crypto Trading Bot
 * Replaces TradingView charts with AI-powered predictions
 */

class CustomChart {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.chart = null;
        this.layout = {
            title: '',
            xaxis: { 
                title: 'Time',
                gridcolor: 'rgba(255,255,255,0.1)',
                type: 'date'
            },
            yaxis: { 
                title: 'Price',
                gridcolor: 'rgba(255,255,255,0.1)'
            },
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)',
            font: { color: 'white' },
            showlegend: true,
            legend: {
                x: 0,
                y: 1,
                bgcolor: 'rgba(0,0,0,0.5)'
            }
        };
        this.config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            displaylogo: false
        };
        
        this.initChart();
    }
    
    initChart() {
        if (!this.container) return;
        
        // Initial empty chart
        const initialData = [{
            x: [],
            y: [],
            type: 'scatter',
            mode: 'lines',
            name: 'Price',
            line: { color: '#888888' }
        }];
        
        Plotly.newPlot(this.container, initialData, this.layout, this.config);
        this.chart = this.container;
    }
    
    updateCandlestickChart(data, predictions = null, signals = null) {
        if (!data || data.length === 0) return;
        
        const traces = [];
        
        // Candlestick trace
        const candlestick = {
            x: data.map(d => d.timestamp),
            open: data.map(d => d.open),
            high: data.map(d => d.high),
            low: data.map(d => d.low),
            close: data.map(d => d.close),
            type: 'candlestick',
            name: 'Price',
            increasing: { 
                line: { color: '#888888', width: 1 }, 
                fillcolor: 'rgba(136,136,136,0.3)' 
            },
            decreasing: { 
                line: { color: '#555555', width: 1 }, 
                fillcolor: 'rgba(85,85,85,0.3)' 
            }
        };
        traces.push(candlestick);
        
        // AI Predictions
        if (predictions && predictions.length > 0) {
            const predictionTrace = {
                x: predictions.map(p => p.timestamp),
                y: predictions.map(p => p.predicted_price),
                type: 'scatter',
                mode: 'lines+markers',
                name: 'AI Prediction',
                line: { 
                    color: '#00ff88', 
                    width: 2, 
                    dash: 'dot' 
                },
                marker: { 
                    color: '#00ff88', 
                    size: 4 
                }
            };
            traces.push(predictionTrace);
            
            // Confidence bands
            if (predictions[0].confidence_upper && predictions[0].confidence_lower) {
                const confidenceUpper = {
                    x: predictions.map(p => p.timestamp),
                    y: predictions.map(p => p.confidence_upper),
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Upper Confidence',
                    line: { color: 'rgba(0,255,136,0.3)', width: 1 },
                    showlegend: false
                };
                
                const confidenceLower = {
                    x: predictions.map(p => p.timestamp),
                    y: predictions.map(p => p.confidence_lower),
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Confidence Band',
                    line: { color: 'rgba(0,255,136,0.3)', width: 1 },
                    fill: 'tonexty',
                    fillcolor: 'rgba(0,255,136,0.1)'
                };
                
                traces.push(confidenceUpper, confidenceLower);
            }
        }
        
        // Buy/Sell signals
        if (signals && signals.length > 0) {
            const buySignals = signals.filter(s => s.type === 'BUY');
            const sellSignals = signals.filter(s => s.type === 'SELL');
            
            if (buySignals.length > 0) {
                const buyTrace = {
                    x: buySignals.map(s => s.timestamp),
                    y: buySignals.map(s => s.price),
                    type: 'scatter',
                    mode: 'markers',
                    name: 'Buy Signal',
                    marker: {
                        color: '#00ff00',
                        size: 10,
                        symbol: 'triangle-up'
                    }
                };
                traces.push(buyTrace);
            }
            
            if (sellSignals.length > 0) {
                const sellTrace = {
                    x: sellSignals.map(s => s.timestamp),
                    y: sellSignals.map(s => s.price),
                    type: 'scatter',
                    mode: 'markers',
                    name: 'Sell Signal',
                    marker: {
                        color: '#ff0000',
                        size: 10,
                        symbol: 'triangle-down'
                    }
                };
                traces.push(sellTrace);
            }
        }
        
        Plotly.react(this.container, traces, this.layout, this.config);
    }
    
    updateVolumeChart(data) {
        if (!data || data.length === 0) return;
        
        const colors = data.map(d => d.close >= d.open ? '#888888' : '#555555');
        
        const volumeTrace = {
            x: data.map(d => d.timestamp),
            y: data.map(d => d.volume),
            type: 'bar',
            name: 'Volume',
            marker: { 
                color: colors,
                opacity: 0.7
            }
        };
        
        const volumeLayout = {
            ...this.layout,
            title: 'Volume',
            yaxis: { 
                title: 'Volume',
                gridcolor: 'rgba(255,255,255,0.1)'
            }
        };
        
        Plotly.react(this.container, [volumeTrace], volumeLayout, this.config);
    }
    
    addIndicator(name, data, color = '#ffffff') {
        if (!data || data.length === 0) return;
        
        const indicatorTrace = {
            x: data.map(d => d.timestamp),
            y: data.map(d => d.value),
            type: 'scatter',
            mode: 'lines',
            name: name,
            line: { color: color, width: 2 }
        };
        
        Plotly.addTraces(this.container, indicatorTrace);
    }
    
    clearChart() {
        if (this.chart) {
            Plotly.purge(this.container);
            this.initChart();
        }
    }
    
    resize() {
        if (this.chart) {
            Plotly.Plots.resize(this.container);
        }
    }
}

class AIModelInterface {
    constructor() {
        this.models = new Map();
        this.activeModel = null;
        this.predictions = [];
        this.trainingData = [];
    }
    
    async initializeModels() {
        // Initialize AI models for different timeframes
        const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
        const modelTypes = ['random_forest', 'gradient_boosting'];
        
        for (const timeframe of timeframes) {
            for (const modelType of modelTypes) {
                const modelId = `${modelType}_${timeframe}`;
                this.models.set(modelId, {
                    id: modelId,
                    type: modelType,
                    timeframe: timeframe,
                    trained: false,
                    performance: null,
                    lastPrediction: null
                });
            }
        }
    }
    
    async trainModel(modelId, data) {
        if (!this.models.has(modelId)) {
            throw new Error(`Model ${modelId} not found`);
        }
        
        try {
            // Simulate AI training (in real implementation, this would call Python backend)
            const response = await this.simulateTraining(modelId, data);
            
            const model = this.models.get(modelId);
            model.trained = response.success;
            model.performance = response.metrics;
            
            return response;
        } catch (error) {
            console.error('Training failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    async predict(modelId, data) {
        if (!this.models.has(modelId)) {
            throw new Error(`Model ${modelId} not found`);
        }
        
        const model = this.models.get(modelId);
        if (!model.trained) {
            throw new Error(`Model ${modelId} is not trained`);
        }
        
        try {
            // Simulate prediction (in real implementation, this would call Python backend)
            const prediction = await this.simulatePrediction(modelId, data);
            model.lastPrediction = prediction;
            
            return prediction;
        } catch (error) {
            console.error('Prediction failed:', error);
            return { error: error.message };
        }
    }
    
    async compareModels(modelIds, data) {
        const results = {};
        
        for (const modelId of modelIds) {
            try {
                const prediction = await this.predict(modelId, data);
                const model = this.models.get(modelId);
                
                results[modelId] = {
                    prediction: prediction,
                    performance: model.performance,
                    timeframe: model.timeframe,
                    type: model.type
                };
            } catch (error) {
                results[modelId] = { error: error.message };
            }
        }
        
        return results;
    }
    
    getModelList() {
        return Array.from(this.models.values());
    }
    
    setActiveModel(modelId) {
        if (this.models.has(modelId)) {
            this.activeModel = modelId;
            return true;
        }
        return false;
    }
    
    getActiveModel() {
        return this.activeModel ? this.models.get(this.activeModel) : null;
    }
    
    // Simulation methods (replace with real API calls)
    async simulateTraining(modelId, data) {
        // Simulate training delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Simulate training metrics
        return {
            success: true,
            metrics: {
                train_r2: 0.75 + Math.random() * 0.2,
                val_r2: 0.65 + Math.random() * 0.2,
                train_rmse: 50 + Math.random() * 20,
                val_rmse: 60 + Math.random() * 25
            }
        };
    }
    
    async simulatePrediction(modelId, data) {
        // Simulate prediction delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const currentPrice = data[data.length - 1].close;
        const priceChange = (Math.random() - 0.5) * currentPrice * 0.1; // ±10% change
        const prediction = currentPrice + priceChange;
        
        return {
            prediction: prediction,
            current_price: currentPrice,
            price_change: priceChange,
            price_change_pct: (priceChange / currentPrice) * 100,
            confidence: 0.6 + Math.random() * 0.3,
            signal: prediction > currentPrice ? "BUY" : "SELL",
            strength: Math.abs(priceChange / currentPrice) * 100
        };
    }
}

class ModelComparison {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.aiInterface = new AIModelInterface();
    }
    
    async initialize() {
        await this.aiInterface.initializeModels();
        this.createComparisonInterface();
    }
    
    createComparisonInterface() {
        if (!this.container) return;
        
        const html = `
            <div class="model-comparison">
                <h4>AI Model Comparison</h4>
                <div class="model-selector">
                    <label>Select Models to Compare:</label>
                    <div class="model-list" id="modelList">
                        <!-- Models will be populated here -->
                    </div>
                </div>
                <button id="compareModelsBtn" class="btn btn-primary">Compare Models</button>
                <div class="comparison-results" id="comparisonResults">
                    <!-- Results will be displayed here -->
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        this.populateModelList();
        this.bindEvents();
    }
    
    populateModelList() {
        const modelList = document.getElementById('modelList');
        if (!modelList) return;
        
        const models = this.aiInterface.getModelList();
        modelList.innerHTML = '';
        
        models.forEach(model => {
            const checkbox = document.createElement('div');
            checkbox.className = 'form-check';
            checkbox.innerHTML = `
                <input class="form-check-input" type="checkbox" value="${model.id}" id="model_${model.id}">
                <label class="form-check-label" for="model_${model.id}">
                    ${model.type} (${model.timeframe}) ${model.trained ? '✅' : '❌'}
                </label>
            `;
            modelList.appendChild(checkbox);
        });
    }
    
    bindEvents() {
        const compareBtn = document.getElementById('compareModelsBtn');
        if (compareBtn) {
            compareBtn.addEventListener('click', () => this.compareSelectedModels());
        }
    }
    
    async compareSelectedModels() {
        const checkboxes = document.querySelectorAll('#modelList input[type="checkbox"]:checked');
        const selectedModels = Array.from(checkboxes).map(cb => cb.value);
        
        if (selectedModels.length === 0) {
            alert('Please select at least one model to compare');
            return;
        }
        
        const resultsContainer = document.getElementById('comparisonResults');
        resultsContainer.innerHTML = '<div class="loading">Comparing models...</div>';
        
        try {
            // Get sample data for comparison (in real implementation, use actual market data)
            const sampleData = this.generateSampleData();
            const results = await this.aiInterface.compareModels(selectedModels, sampleData);
            
            this.displayComparisonResults(results);
        } catch (error) {
            resultsContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
        }
    }
    
    displayComparisonResults(results) {
        const resultsContainer = document.getElementById('comparisonResults');
        
        let html = '<div class="comparison-table">';
        html += '<table class="table table-striped">';
        html += '<thead><tr><th>Model</th><th>Prediction</th><th>Signal</th><th>Confidence</th><th>Performance</th></tr></thead>';
        html += '<tbody>';
        
        Object.entries(results).forEach(([modelId, result]) => {
            if (result.error) {
                html += `<tr><td>${modelId}</td><td colspan="4" class="text-danger">${result.error}</td></tr>`;
            } else {
                const pred = result.prediction;
                const perf = result.performance;
                
                html += `<tr>
                    <td>${modelId}</td>
                    <td>$${pred.prediction ? pred.prediction.toFixed(2) : 'N/A'}</td>
                    <td><span class="badge ${pred.signal === 'BUY' ? 'bg-success' : 'bg-danger'}">${pred.signal}</span></td>
                    <td>${pred.confidence ? (pred.confidence * 100).toFixed(1) + '%' : 'N/A'}</td>
                    <td>${perf ? `R²: ${perf.val_r2.toFixed(3)}` : 'N/A'}</td>
                </tr>`;
            }
        });
        
        html += '</tbody></table></div>';
        resultsContainer.innerHTML = html;
    }
    
    generateSampleData() {
        // Generate sample OHLCV data for testing
        const data = [];
        let price = 50000;
        const now = Date.now();
        
        for (let i = 0; i < 100; i++) {
            const timestamp = new Date(now - (100 - i) * 60000); // 1 minute intervals
            const change = (Math.random() - 0.5) * 1000;
            
            const open = price;
            const close = price + change;
            const high = Math.max(open, close) + Math.random() * 500;
            const low = Math.min(open, close) - Math.random() * 500;
            const volume = 1000000 + Math.random() * 5000000;
            
            data.push({
                timestamp: timestamp,
                open: open,
                high: high,
                low: low,
                close: close,
                volume: volume
            });
            
            price = close;
        }
        
        return data;
    }
}

// Export classes for use in other modules
window.CustomChart = CustomChart;
window.AIModelInterface = AIModelInterface;
window.ModelComparison = ModelComparison;