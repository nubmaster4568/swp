const express = require('express');
const cors = require('cors'); // Import the cors package
const { Client, LocalAuth } = require('whatsapp-web.js');
const WebSocket = require('ws');
const qrcode = require('qrcode');

const wss = new WebSocket.Server({ noServer: true });

const app = express();
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // For parsing JSON requests

// Create WhatsApp client using LocalAuth
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

let isAuthenticated = false;
let qrCodeUrl = null;

client.on('message', (msg) => {
    if (msg.body === '!ping') {
        msg.reply('pong');
    }

    // Broadcast message to all WebSocket clients
    const messageData = {
        body: msg.body,
        from: msg.from,
        timestamp: msg.timestamp,
        sender: msg.fromMe ? 'Me' : 'Other'
    };

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(messageData));
        }
    });
});


// Set up client events
client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.toDataURL(qr, (err, url) => {
        qrCodeUrl = url;
    });
});

client.on('ready', () => {
    console.log('WhatsApp client is ready!');
    isAuthenticated = true;
});

client.on('authenticated', () => {
    console.log('Authenticated with WhatsApp!');
});

client.on('auth_failure', (msg) => {
    console.error('Authentication failed:', msg);
    isAuthenticated = false;
});

client.on('disconnected', (reason) => {
    console.log('WhatsApp client disconnected:', reason);
    isAuthenticated = false;
    qrCodeUrl = null;
});

// Initialize the WhatsApp client
client.initialize();

app.get('/chats', async (req, res) => {
    try {
        const chats = await client.getChats();
        // Fetch the chats
        const chatData = chats.map(chat => ({
            name: chat.name || chat.id.user,
            serialized: chat.id._serialized
        }));

        res.json(chatData); // Send the chat data (name and serialized value)
    } catch (error) {
        console.error('Error fetching chats:', error);
        res.status(500).send('Error fetching chats.');
    }
});

// Endpoint to fetch messages for a specific chat
app.get('/messages', async (req, res) => {
    const chatId = req.query.chatId;

    try {
        const chat = await client.getChatById(chatId);

        const messages = await chat.fetchMessages();

        // Map messages to a simpler format if needed
        const formattedMessages = messages.map(message => ({
            body: message.body,
            sender: message.fromMe, // true if the message is from the current user
            timestamp: message.timestamp,
            from: message.id.remote
            // Add timestamp if needed
        }));

        res.json(formattedMessages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).send('Error fetching messages.');
    }
});

// Endpoint to check WhatsApp status or retrieve the QR code
app.get('/data', (req, res) => {
    if (isAuthenticated) {
        res.send('WhatsApp client is authenticated and ready.');
    } else if (qrCodeUrl) {
        res.send(`<img src="${qrCodeUrl}" alt="Scan QR code to authenticate WhatsApp Web">`);
    } else {
        res.send('WhatsApp client is not ready. Try again later.');
    }
});

// New endpoint to send a message to a WhatsApp number
app.post('/send-message', (req, res) => {
    const { chatId, body } = req.body;

    if (isAuthenticated) {
        // Send a message to the specified number
        client.sendMessage(chatId, body)
            .then(response => {
                res.status(200).send('Message sent successfully!');
            })
            .catch(err => {
                console.error('Error sending message:', err);
                res.status(500).send('Error sending message.');
            });
    } else {
        res.status(400).send('WhatsApp client is not authenticated.');
    }
});
wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    ws.send('Connected to WebSocket');
});

const server = app.listen(2000, () => {
    console.log('Server is listening on port 2000');
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});
// Start the Express server on port 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
