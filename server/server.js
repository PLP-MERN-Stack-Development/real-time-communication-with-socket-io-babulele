// server.js - Main server file for Socket.io chat application

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket'],
  pingInterval: 20000,
  pingTimeout: 20000,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users and messages
const users = {};
const messages = {}; // Room messages: { [roomName]: [messages] }
const privateMessages = {}; // Private messages: { [messageId]: messageData }
const typingUsers = {};
const rooms = ['general', 'random', 'tech', 'gaming']; // Default rooms
const readReceipts = {}; // Track read receipts: { messageId: { [userId]: timestamp } }

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining
  socket.on('user_join', (username) => {
    console.log(`[user_join] Socket ${socket.id} attempting to join with username: "${username}"`);
    
    // Validate username
    if (!username || typeof username !== 'string') {
      console.log(`[user_join] Invalid username for socket ${socket.id}`);
      socket.emit('username_taken', { message: 'Username is required.' });
      return;
    }
    
    // Trim and validate username length (3-20 characters)
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      console.log(`[user_join] Username length invalid for socket ${socket.id}: ${trimmedUsername.length}`);
      socket.emit('username_taken', { message: 'Username must be between 3 and 20 characters.' });
      return;
    }
    
    // If this socket.id already has a user entry, remove it first (handles reconnection/username change cases)
    if (users[socket.id]) {
      const oldUsername = users[socket.id].username;
      const oldRoom = users[socket.id].currentRoom;
      console.log(`[user_join] Removing old user entry for socket ${socket.id}: ${oldUsername} from room ${oldRoom}`);
      socket.leave(oldRoom);
      delete users[socket.id];
      delete typingUsers[socket.id];
      // Update user list for other clients
      io.emit('user_list', Object.values(users));
    }
    
    // Check if username is already taken by OTHER users (case-insensitive)
    // Exclude current socket.id from the check since we just removed it
    const existingUsers = Object.entries(users).filter(([socketId]) => socketId !== socket.id);
    const usernameExists = existingUsers.some(
      ([, user]) => user.username.toLowerCase() === trimmedUsername.toLowerCase()
    );
    
    if (usernameExists) {
      const takenBy = existingUsers.find(([, user]) => user.username.toLowerCase() === trimmedUsername.toLowerCase());
      console.log(`[user_join] Username "${trimmedUsername}" already taken by socket ${takenBy[0]} for socket ${socket.id}`);
      socket.emit('username_taken', { message: 'Username already taken. Please choose another.' });
      return;
    }
    
    // Add user with new username
    users[socket.id] = { username: trimmedUsername, id: socket.id, currentRoom: 'general' };
    console.log(`[user_join] Successfully added user "${trimmedUsername}" for socket ${socket.id}`);
    
    // Join default room
    socket.join('general');
    if (!messages['general']) {
      messages['general'] = [];
    }
    
    io.emit('user_list', Object.values(users));
    io.emit('user_joined', { username: trimmedUsername, id: socket.id });
    io.emit('available_rooms', rooms);
    console.log(`${trimmedUsername} joined the chat`);
  });
  
  // Handle joining a room
  socket.on('join_room', (roomName) => {
    if (users[socket.id]) {
      const oldRoom = users[socket.id].currentRoom;
      socket.leave(oldRoom);
      socket.join(roomName);
      users[socket.id].currentRoom = roomName;
      
      // Initialize room messages if it doesn't exist
      if (!messages[roomName]) {
        messages[roomName] = [];
      }
      
      // Mark all messages in the room as read when user joins
      const userId = socket.id;
      const username = users[socket.id].username;
      const roomMessages = messages[roomName];
      
      roomMessages.forEach((message) => {
        // Skip messages sent by this user
        if (message.senderId === userId) return;
        
        if (!readReceipts[message.id]) {
          readReceipts[message.id] = {};
        }
        
        if (!readReceipts[message.id][userId]) {
          readReceipts[message.id][userId] = {
            username,
            timestamp: new Date().toISOString(),
          };
          
          // Notify the sender
          if (message.senderId) {
            io.to(message.senderId).emit('message_read', {
              messageId: message.id,
              readBy: { username, userId },
              timestamp: readReceipts[message.id][userId].timestamp,
            });
          }
        }
      });
      
      // Notify user of room change
      socket.emit('room_changed', { 
        room: roomName, 
        previousRoom: oldRoom,
        messages: messages[roomName] 
      });
      
      // Notify others in the new room
      io.to(roomName).emit('user_joined_room', { 
        username: users[socket.id].username,
        room: roomName 
      });
    }
  });
  
  // Handle leaving a room
  socket.on('leave_room', (roomName) => {
    if (users[socket.id]) {
      socket.leave(roomName);
      users[socket.id].currentRoom = 'general'; // Default to general
      socket.join('general');
      
      io.to(roomName).emit('user_left_room', { 
        username: users[socket.id].username,
        room: roomName 
      });
    }
  });

  // Handle chat messages (to specific room)
  socket.on('send_message', (messageData) => {
    if (!users[socket.id]) return;
    
    const currentRoom = users[socket.id].currentRoom || 'general';
    const message = {
      ...messageData,
      id: Date.now(),
      sender: users[socket.id]?.username || 'Anonymous',
      senderId: socket.id,
      timestamp: new Date().toISOString(),
      room: currentRoom,
      type: messageData.type || 'text', // text, image, file
    };
    
    // Store message in room
    if (!messages[currentRoom]) {
      messages[currentRoom] = [];
    }
    messages[currentRoom].push(message);
    
    // Limit stored messages to prevent memory issues
    if (messages[currentRoom].length > 100) {
      messages[currentRoom].shift();
    }
    
    // Send to all users in the room
    io.to(currentRoom).emit('receive_message', message);
    // Acknowledge to sender for delivery tracking
    if (messageData.tempId) {
      socket.emit('message_ack', { tempId: messageData.tempId, id: message.id, room: currentRoom });
    }
  });

  // Handle typing indicator (in specific room)
  socket.on('typing', (isTyping) => {
    if (users[socket.id]) {
      const username = users[socket.id].username;
      const currentRoom = users[socket.id].currentRoom || 'general';
      
      if (isTyping) {
        typingUsers[socket.id] = { username, room: currentRoom };
      } else {
        delete typingUsers[socket.id];
      }
      
      // Send typing users in the current room
      const roomTypingUsers = Object.values(typingUsers)
        .filter(u => u.room === currentRoom)
        .map(u => u.username);
      
      io.to(currentRoom).emit('typing_users', roomTypingUsers);
    }
  });

  // Handle private messages
  socket.on('private_message', ({ to, message, type, data }) => {
    if (!users[socket.id]) return;
    
    const messageId = Date.now();
    const senderUsername = users[socket.id]?.username || 'Anonymous';
    
    // Create message for sender (with recipientId = to)
    const senderMessage = {
      id: messageId,
      sender: senderUsername,
      senderId: socket.id,
      message,
      timestamp: new Date().toISOString(),
      isPrivate: true,
      type: type || 'text',
      data: data || null,
      recipientId: to, // Recipient's socket.id for sender's view
    };
    
    // Create message for recipient (with recipientId = their own id for consistency)
    const recipientMessage = {
      id: messageId,
      sender: senderUsername,
      senderId: socket.id,
      message,
      timestamp: new Date().toISOString(),
      isPrivate: true,
      type: type || 'text',
      data: data || null,
      recipientId: to, // Keep recipientId for filtering on recipient side
    };
    
    // Store private message for read receipt tracking (use sender's version)
    privateMessages[messageId] = senderMessage;
    
    // Initialize read receipts for this message
    if (!readReceipts[messageId]) {
      readReceipts[messageId] = {};
    }
    
    // Send to recipient
    socket.to(to).emit('private_message', recipientMessage);
    // Send to sender (with recipientId so they can filter)
    socket.emit('private_message', senderMessage);
  });

  // Handle read receipts for messages
  socket.on('mark_message_read', ({ messageId, room, isPrivate }) => {
    if (!users[socket.id]) return;
    
    const userId = socket.id;
    const username = users[socket.id].username;
    
    // Initialize read receipts if needed
    if (!readReceipts[messageId]) {
      readReceipts[messageId] = {};
    }
    
    // Mark as read by this user
    if (!readReceipts[messageId][userId]) {
      readReceipts[messageId][userId] = {
        username,
        timestamp: new Date().toISOString(),
      };
      
      // Find the message sender and notify them
      let senderId = null;
      
      if (isPrivate) {
        // For private messages, get sender from stored private message
        const privateMsg = privateMessages[messageId];
        if (privateMsg && privateMsg.senderId) {
          senderId = privateMsg.senderId;
        }
      } else if (room && messages[room]) {
        // For room messages, find the message sender
        const message = messages[room].find(m => m.id === messageId);
        if (message && message.senderId) {
          senderId = message.senderId;
        }
      }
      
      // Notify the sender that their message was read
      if (senderId && senderId !== userId) {
        io.to(senderId).emit('message_read', {
          messageId,
          readBy: { username, userId },
          timestamp: readReceipts[messageId][userId].timestamp,
        });
      }
    }
  });

  // Handle marking all messages in a room as read
  socket.on('mark_room_read', ({ room }) => {
    if (!users[socket.id] || !messages[room]) return;
    
    const userId = socket.id;
    const username = users[socket.id].username;
    const roomMessages = messages[room];
    
    // Mark all unread messages in the room as read by this user
    roomMessages.forEach((message) => {
      // Skip messages sent by this user (you don't read your own messages)
      if (message.senderId === userId) return;
      
      if (!readReceipts[message.id]) {
        readReceipts[message.id] = {};
      }
      
      if (!readReceipts[message.id][userId]) {
        readReceipts[message.id][userId] = {
          username,
          timestamp: new Date().toISOString(),
        };
        
        // Notify the sender
        if (message.senderId) {
          io.to(message.senderId).emit('message_read', {
            messageId: message.id,
            readBy: { username, userId },
            timestamp: readReceipts[message.id][userId].timestamp,
          });
        }
      }
    });
  });

  // Handle message reactions
  socket.on('add_reaction', ({ messageId, room, reaction }) => {
    if (!messages[room]) return;
    
    const messageIndex = messages[room].findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    
    const message = messages[room][messageIndex];
    if (!message.reactions) {
      message.reactions = {};
    }
    
    const username = users[socket.id]?.username;
    if (!message.reactions[reaction]) {
      message.reactions[reaction] = [];
    }
    
    // Toggle reaction - if user already reacted, remove it
    const userIndex = message.reactions[reaction].indexOf(username);
    if (userIndex > -1) {
      message.reactions[reaction].splice(userIndex, 1);
      if (message.reactions[reaction].length === 0) {
        delete message.reactions[reaction];
      }
    } else {
      message.reactions[reaction].push(username);
    }
    
    io.to(room).emit('message_reaction_updated', { messageId, reactions: message.reactions });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (users[socket.id]) {
      const { username } = users[socket.id];
      io.emit('user_left', { username, id: socket.id });
      console.log(`${username} left the chat`);
    }
    
    delete users[socket.id];
    delete typingUsers[socket.id];
    
    io.emit('user_list', Object.values(users));
    io.emit('typing_users', Object.values(typingUsers));
  });
});

// API routes
app.get('/api/messages/:room', (req, res) => {
  const room = req.params.room;
  const before = req.query.before ? new Date(req.query.before).getTime() : Date.now() + 1;
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
  const roomMessages = messages[room] || [];
  const filtered = roomMessages
    .filter(m => new Date(m.timestamp).getTime() < before)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const hasMore = roomMessages.some(m => new Date(m.timestamp).getTime() < (filtered[0] ? new Date(filtered[0].timestamp).getTime() : before));
  res.json({ messages: filtered, hasMore });
});

// Search messages in a room
app.get('/api/messages/:room/search', (req, res) => {
  const room = req.params.room;
  const q = (req.query.q || '').toString().toLowerCase();
  if (!q) return res.json([]);
  const roomMessages = messages[room] || [];
  const results = roomMessages.filter(m => (m.message || '').toLowerCase().includes(q)).slice(-100);
  res.json(results);
});

app.get('/api/users', (req, res) => {
  res.json(Object.values(users));
});

app.get('/api/rooms', (req, res) => {
  res.json(rooms);
});

// Root route
app.get('/', (req, res) => {
  res.send('Socket.io Chat Server is running');
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io }; 