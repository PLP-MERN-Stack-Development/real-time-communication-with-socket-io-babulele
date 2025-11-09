# Real-Time Chat Application with Socket.io

This assignment focuses on building a real-time chat application using Socket.io, implementing bidirectional communication between clients and server.

## Assignment Overview

You will build a chat application with the following features:
1. Real-time messaging using Socket.io
2. User authentication and presence
3. Multiple chat rooms or private messaging
4. Real-time notifications
5. Advanced features like typing indicators and read receipts

## Project Structure

```
socketio-chat/
├── client/                 # React front-end
│   ├── public/             # Static files
│   ├── src/                # React source code
│   │   ├── components/     # UI components
│   │   ├── context/        # React context providers
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Page components
│   │   ├── socket/         # Socket.io client setup
│   │   └── App.jsx         # Main application component
│   └── package.json        # Client dependencies
├── server/                 # Node.js back-end
│   ├── config/             # Configuration files
│   ├── controllers/        # Socket event handlers
│   ├── models/             # Data models
│   ├── socket/             # Socket.io server setup
│   ├── utils/              # Utility functions
│   ├── server.js           # Main server file
│   └── package.json        # Server dependencies
└── README.md               # Project documentation
```

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd real-time-communication-with-socket-io-babulele
   ```

2. Install server dependencies:
   ```bash
   cd server
   npm install
   ```

3. Install client dependencies:
   ```bash
   cd ../client
   npm install
   ```

### Running the Application

1. Start the server (in the `server` directory):
   ```bash
   npm run dev
   ```
   The server will run on `http://localhost:5000`

2. Start the client (in the `client` directory):
   ```bash
   npm run dev
   ```
   The client will run on `http://localhost:5173`

3. Open your browser and navigate to `http://localhost:5173`

4. Enter a username to join the chat!

## Features Implemented

### ✅ Task 1: Project Setup (Completed)
- Node.js/Express server configured
- Socket.io set up on both server and client
- React front-end application created
- Basic connection established between client and server

### ✅ Task 2: Core Chat Functionality (Completed)
- User authentication with username validation (case-insensitive, 3-20 characters)
- Duplicate username prevention
- Global chat room where all users can send and receive messages
- Real-time messaging with sender name and timestamp display
- Typing indicators with automatic timeout
- Online/offline status for all users
- Auto-scroll to latest messages
- User join/leave system notifications
- Welcome message in chat header

### ✅ Task 3: Advanced Chat Features (Completed)
- **Multiple chat rooms/channels**: Users can switch between different rooms (general, random, tech, gaming)
- **Private messaging**: Click on any user to start a private conversation
- **Message reactions**: Add emoji reactions (👍, ❤️, 😂, 😮, 😢, 🔥) to messages with toggle functionality
- **File/image sharing**: Support for sending images and files in messages (type: image/file)
- Typing indicators working per room
- Room-specific message storage and history

### ✅ Task 4: Real-Time Notifications (Completed)
- **New message alerts**: Sound and browser notifications when receiving new messages in other rooms
- **Join/leave room alerts**: System messages when users join or leave rooms
- **Unread count**: Badge displays on room buttons showing unread message count
- **Sound notifications**: Web Audio API beep sound for new messages
- **Browser notifications**: Web Notifications API with permission request and icon
- Notification toggle button with enabled/disabled states
- Notifications only trigger for messages from other users in different rooms

### ✅ Task 5: Performance & UX Optimization (Completed)
- Message pagination API and UI (Load older), efficient batch prepend
- Reconnection logic with auto rejoin and WebSocket transport
- Socket optimizations: WebSocket-only transport, tuned ping
- Message delivery acknowledgment with optimistic UI and ack updates
- Message search per-room endpoint and client search input
- Mobile-friendly layout and controls

## Screenshots

### Main Chat Interface
![Main Chat Interface](./screenshots/chat%20interface.PNG)
*Main chat room showing messages, online users, and room selector*


**Note:** To add screenshots:
1. Take screenshots of your application while running
2. Save them in the `screenshots/` directory with the names above
3. Supported formats: PNG, JPG, or GIF
4. Recommended size: 1280x720 or higher for desktop screenshots
5. For mobile screenshots: Use actual mobile device or browser dev tools

## Files Included

- `Week5-Assignment.md`: Detailed assignment instructions
- `server/server.js`: Express server with Socket.io configuration
- `client/src/App.jsx`: Main React application component
- `client/src/socket/socket.js`: Socket.io client setup and custom hook

## Requirements

- Node.js (v18 or higher)
- npm or yarn
- Modern web browser
- Basic understanding of React and Express

## Submission

Your work will be automatically submitted when you push to your GitHub Classroom repository. Make sure to:

1. Complete both the client and server portions of the application
2. Implement the core chat functionality
3. Add at least 3 advanced features
4. Document your setup process and features in the README.md
5. Include screenshots or GIFs of your working application
6. Optional: Deploy your application and add the URLs to your README.md

## Resources

- [Socket.io Documentation](https://socket.io/docs/v4/)
- [React Documentation](https://react.dev/)
- [Express.js Documentation](https://expressjs.com/)
- [Building a Chat Application with Socket.io](https://socket.io/get-started/chat) 