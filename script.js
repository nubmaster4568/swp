let ws; // WebSocket connection
let currentChatId = ''; // Store the currently selected chat ID

// Function to fetch chat names
async function fetchChatNames() {
    try {
        const response = await fetch('https://swp-r0lp.onrender.com/chats');
        const chatData = await response.json();

        // Remove the loading text
        document.getElementById('loading').style.display = 'none';

        // Display the chat names
        const chatList = document.getElementById('chatList');
        chatData.forEach(chat => {
            const listItem = document.createElement('li');
            listItem.textContent = chat.name;
            listItem.dataset.chatId = chat.serialized; // Set the serialized chat ID as a data attribute
            listItem.onclick = () => handleChatClick(chat.serialized, listItem); // Handle click event
            chatList.appendChild(listItem);
        });
    } catch (error) {
        console.error('Error fetching chats:', error);
        document.getElementById('loading').textContent = 'Error loading chats.';
    }
}

// Function to handle chat click and fetch messages
async function handleChatClick(chatId, listItem) {
    // Fetch messages for the selected chat
    await fetchMessages(chatId);
    console.log(chatId)
    // Populate the h1 element with class "messageto" with the clicked element's data-chat-id
    const messageToElement = document.getElementById('messageTo');
    if (messageToElement) {
        messageToElement.textContent = listItem.dataset.chatId;
    }
}

// Function to fetch messages for a specific chat
async function fetchMessages(chatId) {
    currentChatId = chatId; // Set the current chat ID
    try {
        const response = await fetch(`https://swp-r0lp.onrender.com/messages?chatId=${chatId}`);
        const messages = await response.json();
        displayMessages(messages);
        setupWebSocket(); // Reconnect WebSocket for real-time updates
    } catch (error) {
        console.error('Error fetching messages:', error);
    }
}

// Function to display messages
function displayMessages(messages) {
    const messagesContainer = document.getElementById('messagesContainer');
    const messagesList = document.getElementById('messagesList');

    // Clear previous messages
    messagesList.innerHTML = '';

    // Check if there are messages
    if (messages.length === 0) {
        messagesList.innerHTML = '<p>No messages found.</p>';
    } else {
        // Display each message
        messages.forEach(message => {
            addMessageToList(message);
        });
    }

    // Hide chat list and show messages
    document.getElementById('chatListContainer').style.display = 'none';
    messagesContainer.style.display = 'block';

    // Optionally scroll to the bottom of the messages list if needed
    // messagesList.scrollTop = messagesList.scrollHeight; // Uncomment this if you want to scroll down to the latest message
}

// Function to add a single message to the list
function addMessageToList(message) {
    const messagesList = document.getElementById('messagesList');
    const messageElement = document.createElement('div');
    const messageBody = document.createElement('span');
    const messageTimestamp = document.createElement('span');

    // Set message body and timestamp
    messageBody.textContent = message.body;

    // Format the timestamp as time (HH:MM)
    const date = new Date(message.timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    messageTimestamp.textContent = `${hours}:${minutes}`;

    // Add classes for styling
    messageBody.className = 'message-body';
    messageTimestamp.className = 'message-timestamp';

    // Determine if the message is from the user or the other person
    if (message.sender) {
        messageElement.className = 'message me';
    } else {
        messageElement.className = 'message other';
    }

    // Append body and timestamp to message element
    messageElement.appendChild(messageBody);
    messageElement.appendChild(messageTimestamp);

    // Append message element to the messages list
    messagesList.appendChild(messageElement);
}

// Back button functionality
document.getElementById('backButton').onclick = function() {
    document.getElementById('messagesContainer').style.display = 'none';
    document.getElementById('chatListContainer').style.display = 'block';
};

// Send message functionality
document.getElementById('sendButton').onclick = async function() {
    const messageInput = document.getElementById('messageInput');
    const messageBody = messageInput.value.trim();

    if (messageBody === '') {
        return; // Do not send empty messages
    }

    try {
        const chatIdElement = document.getElementById('messageTo'); // Get the element
        const chatId = chatIdElement.textContent; // Extract the text content

        const response = await fetch(`https://swp-r0lp.onrender.com/send-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chatId: chatId,
                body: messageBody,
            }),
        });

        if (response.ok) {
            // Clear input and fetch messages again to update the list
            messageInput.value = '';
            setTimeout(async () => {
                await fetchMessages(chatId);
            }, 500);
        } else {
            console.error('Error sending message:', response.statusText);
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
};

// Setup WebSocket for real-time updates
function setupWebSocket() {
    if (ws) {
        ws.close(); // Close previous WebSocket connection if it exists
    }

    ws = new WebSocket('wss://swp-r0lp.onrender.com');
    ws.onopen = () => {
        console.log('Connected to WebSocket');
    };

ws.onmessage = async (event) => {
    try {
        const messageData = JSON.parse(event.data);

        // Check if the message is from the current chat
        if (messageData.from && messageData.from === currentChatId) {
            // Get the current scroll position
            const messagesContainer = document.getElementById('messagesList');
            const currentScrollPosition = messagesContainer.scrollTop;

            // Fetch new messages
            await fetchMessages(currentChatId);

            // Restore the previous scroll position
            messagesContainer.scrollTop = currentScrollPosition;
        }
    } catch (error) {
        console.log('Non-message WebSocket event:', event.data);
    }
};


    ws.onclose = () => {
        console.log('WebSocket connection closed');
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Fetch chat names on page load
window.onload = fetchChatNames;
