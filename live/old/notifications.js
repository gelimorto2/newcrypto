/**
 * Notifications Module for Binance Trading Bot
 * Handles sending notifications to Discord and other services
 */

// Send notification to Discord webhook
async function sendDiscordNotification(options) {
    try {
        // Get Discord webhook URL from settings
        const webhookUrl = document.getElementById('discordWebhookUrl').value;
        
        // If no webhook URL is set, skip sending notification
        if (!webhookUrl) {
            console.log('Discord webhook URL not set. Skipping notification.');
            return false;
        }
        
        // Default options
        const defaultOptions = {
            username: 'Binance Trading Bot',
            avatar_url: 'https://public.bnbstatic.com/image/cms/blog/20190611/eb1ee1af-4077-4d35-b45f-6b7b1e7c1744.png',
            content: '',
            embeds: [{
                title: 'Trading Bot Notification',
                description: 'Something happened',
                color: 0x3498db,
                footer: {
                    text: `${new Date().toISOString()} | Binance Trading Bot`
                }
            }]
        };
        
        // Merge default options with provided options
        const payload = {
            ...defaultOptions,
            embeds: [{
                ...defaultOptions.embeds[0],
                title: options.title || defaultOptions.embeds[0].title,
                description: options.description || defaultOptions.embeds[0].description,
                color: options.color || defaultOptions.embeds[0].color
            }]
        };
        
        // Add fields if provided
        if (options.fields) {
            payload.embeds[0].fields = options.fields;
        }
        
        // Simulate sending the notification
        console.log('Sending Discord notification:', payload);
        
        // In a real application, we would make a fetch request to the Discord webhook URL
        // Since this is a client-side application, we would typically use a proxy server
        // to handle the actual API call to Discord to avoid exposing our webhook URL
        
        // For demo purposes, we'll simulate a successful response
        await simulateDiscordNotification(webhookUrl, payload);
        return true;
    } catch (error) {
        console.error('Failed to send Discord notification:', error);
        return false;
    }
}

// Simulate sending a Discord notification
async function simulateDiscordNotification(webhookUrl, payload) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Log the notification in the UI
    logMessage('info', `Discord notification sent: ${payload.embeds[0].title}`);
    
    // In a real application, we would make a fetch request like this:
    /*
    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
    }
    
    return response;
    */
    
    // Return a simulated response
    return {
        ok: true,
        status: 204,
        statusText: 'No Content'
    };
}

// Format trade notification for Discord
function formatTradeNotification(trade) {
    const isProfitable = trade.pnl > 0;
    
    return {
        title: `Trade Executed: ${trade.symbol}`,
        description: `A ${trade.side.toLowerCase()} order has been executed.`,
        color: isProfitable ? 0x00FF00 : 0xFF0000,
        fields: [
            {
                name: 'Symbol',
                value: trade.symbol,
                inline: true
            },
            {
                name: 'Side',
                value: trade.side,
                inline: true
            },
            {
                name: 'Price',
                value: trade.price.toFixed(2),
                inline: true
            },
            {
                name: 'Quantity',
                value: trade.quantity,
                inline: true
            },
            {
                name: 'PnL',
                value: `${trade.pnl.toFixed(2)} USDT`,
                inline: true
            },
            {
                name: 'Time',
                value: new Date().toISOString(),
                inline: true
            }
        ]
    };
}

// Format signal notification for Discord
function formatSignalNotification(signal, symbol) {
    return {
        title: `Trading Signal: ${signal.action} ${symbol}`,
        description: signal.reason,
        color: signal.action === 'BUY' ? 0x00FF00 : 0xFF0000,
        fields: [
            {
                name: 'Symbol',
                value: symbol,
                inline: true
            },
            {
                name: 'Action',
                value: signal.action,
                inline: true
            },
            {
                name: 'Price',
                value: signal.price.toFixed(2),
                inline: true
            },
            {
                name: 'Time',
                value: new Date().toISOString(),
                inline: true
            }
        ]
    };
}

// Format error notification for Discord
function formatErrorNotification(error) {
    return {
        title: 'Error',
        description: error.message || 'An error occurred',
        color: 0xFF0000,
        fields: [
            {
                name: 'Stack Trace',
                value: error.stack ? error.stack.substring(0, 1000) : 'No stack trace available'
            }
        ]
    };
}
