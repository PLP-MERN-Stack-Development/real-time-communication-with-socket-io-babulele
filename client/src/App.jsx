import { useState, useEffect, useMemo } from 'react';
import './App.css';
import { useSocket } from './socket/socket.js';
import { playNotificationSound, showBrowserNotification, requestNotificationPermission } from './utils/notifications.js';

function App() {
  const [username, setUsername] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPrivateChat, setShowPrivateChat] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const {
    socket,
    isConnected,
    messages,
    users,
    typingUsers,
    currentUsername,
    usernameError,
    currentRoom,
    availableRooms,
    unreadCounts,
    hasMore,
    connect,
    disconnect,
    sendMessage,
    sendPrivateMessage,
    setTyping,
    joinRoom,
    addReaction,
    fetchOlderMessages,
    searchMessages,
  } = useSocket();
  
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
  
  // Filter messages based on current view (room or private chat)
  const displayMessages = useMemo(() => {
    if (showPrivateChat && selectedUser) {
      // Filter to show only private messages between current user and selected user
      return messages.filter(message => {
        // Must be a private message
        if (!message.isPrivate) {
          return false;
        }
        
        // Case 1: Message from selected user to current user (we received it)
        // Check if senderId matches selectedUser.id
        if (message.senderId === selectedUser.id) {
          return true;
        }
        
        // Case 2: Message from current user to selected user (we sent it)
        // Check if we're the sender and recipientId matches selectedUser.id
        if (message.senderId === socket.id && message.recipientId === selectedUser.id) {
          return true;
        }
        
        return false;
      });
    } else {
      // Show room messages (not private) when in room view
      return messages.filter(message => {
        // Don't show private messages in room view
        if (message.isPrivate) {
          return false;
        }
        // Show system messages
        if (message.system) {
          return true;
        }
        // Show messages for current room
        return message.room === currentRoom;
      });
    }
  }, [messages, showPrivateChat, selectedUser, socket.id, currentRoom]);
  
  // Request notification permission on mount
  useEffect(() => {
    if (showChat) {
      requestNotificationPermission().then(setNotificationsEnabled);
    }
  }, [showChat]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }, [displayMessages, messages]); // Also scroll when displayMessages changes
  
  // Mark messages as read when user is viewing the room
  useEffect(() => {
    if (!showPrivateChat && currentRoom && isConnected && displayMessages.length > 0) {
      // Mark all unread messages in current room as read when user is viewing
      // This ensures messages are marked as read when user is actively in the room
      const unreadMessages = displayMessages.filter(
        msg => msg.senderId !== socket.id && 
                !msg.isPrivate && 
                msg.room === currentRoom &&
                msg.status !== 'read' &&
                !msg.readBy?.some(r => r.userId === socket.id)
      );
      
      if (unreadMessages.length > 0) {
        // Mark messages as read after a short delay (user is viewing)
        const timeout = setTimeout(() => {
          unreadMessages.forEach((message) => {
            if (message.id) {
              socket.emit('mark_message_read', { 
                messageId: message.id, 
                room: currentRoom, 
                isPrivate: false 
              });
            }
          });
        }, 1000); // 1 second delay to ensure user is actually viewing
        
        return () => clearTimeout(timeout);
      }
    }
  }, [displayMessages, currentRoom, isConnected, showPrivateChat, socket.id]);
  
  // Debug: Log when private chat state changes
  useEffect(() => {
    if (showPrivateChat && selectedUser) {
      console.log('Private chat activated with:', selectedUser);
      console.log('Filtered messages count:', displayMessages.length);
    }
  }, [showPrivateChat, selectedUser, displayMessages]);
  
  // Handle new message notifications
  useEffect(() => {
    if (messages.length > 0 && !showPrivateChat) {
      const lastMessage = messages[messages.length - 1];
      
      // Only notify if:
      // 1. Message is not from current user
      // 2. Message is not a system message
      // 3. Message is from a different room (not current room)
      // 4. Message is not a private message
      if (lastMessage.sender !== currentUsername && 
          !lastMessage.system &&
          lastMessage.room && 
          lastMessage.room !== currentRoom &&
          !lastMessage.isPrivate) {
        // Play sound notification
        playNotificationSound();
        
        // Show browser notification
        if (notificationsEnabled && 'Notification' in window) {
          const messagePreview = lastMessage.message 
            ? lastMessage.message.substring(0, 50) + (lastMessage.message.length > 50 ? '...' : '')
            : 'New message';
          showBrowserNotification(
            `New message in #${lastMessage.room}`,
            `${lastMessage.sender}: ${messagePreview}`
          );
        }
      }
      
      // Also notify for private messages when not in private chat view
      if (lastMessage.isPrivate && 
          lastMessage.sender !== currentUsername &&
          !showPrivateChat) {
        // Play sound for private message
        playNotificationSound();
        
        // Show browser notification for private message
        if (notificationsEnabled && 'Notification' in window) {
          const messagePreview = lastMessage.message 
            ? lastMessage.message.substring(0, 50) + (lastMessage.message.length > 50 ? '...' : '')
            : 'New message';
          showBrowserNotification(
            `Private message from ${lastMessage.sender}`,
            messagePreview
          );
        }
      }
    }
  }, [messages, currentUsername, currentRoom, notificationsEnabled, showPrivateChat]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      connect(username);
      setShowChat(true);
    }
  };

  // Handle username error and show error message
  useEffect(() => {
    if (usernameError) {
      setShowChat(false);
      alert(usernameError);
    }
  }, [usernameError]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim() && isConnected) {
      if (showPrivateChat && selectedUser) {
        sendPrivateMessage(selectedUser.id, inputMessage);
      } else {
        sendMessage(inputMessage);
      }
      setInputMessage('');
      setTyping(false);
    }
  };

  const handleRoomChange = (roomName) => {
    if (roomName !== currentRoom) {
      joinRoom(roomName);
    }
  };

  const handleUserClick = (user) => {
    if (user && user.id && user.id !== socket.id) {
      console.log('Starting private chat with:', user);
      console.log('User object:', { id: user.id, username: user.username });
      setSelectedUser(user);
      setShowPrivateChat(true);
      console.log('Private chat state updated - showPrivateChat:', true, 'selectedUser:', user);
    } else {
      console.error('Invalid user object:', user);
    }
  };

  const handleReactionClick = (messageId, reaction) => {
    addReaction(messageId, currentRoom, reaction);
    setShowEmojiPicker(null);
  };

  // Debounce typing indicator
  useEffect(() => {
    const timer = setTimeout(() => {
      setTyping(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [inputMessage, setTyping]);

  const handleTyping = (e) => {
    setInputMessage(e.target.value);
    if (e.target.value.trim() && isConnected) {
      setTyping(true);
    } else {
      setTyping(false);
    }
  };

  const handleLeave = () => {
    disconnect();
    setShowChat(false);
    setUsername('');
  };


  return (
    <div className="app">
      {!showChat ? (
        <div className="join-container">
          <h1>Join Chat</h1>
          <form onSubmit={handleJoin}>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="username-input"
              required
              minLength={3}
              maxLength={20}
            />
            <button type="submit" className="join-button">
              Join
            </button>
          </form>
          {usernameError && <p className="error-message">{usernameError}</p>}
        </div>
      ) : (
        <div className="chat-container">
          <div className="chat-header">
            <div className="chat-header-left">
              <h2>
                {showPrivateChat && selectedUser && selectedUser.username
                  ? `Private: ${selectedUser.username}` 
                  : `Socket.io Chat - #${currentRoom}`}
              </h2>
              {currentUsername && <span className="welcome-message">Welcome, {currentUsername}!</span>}
            </div>
            <div className="status">
              <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
                {isConnected ? '●' : '○'}
              </span>
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <button onClick={handleLeave} className="leave-button">
              Leave Chat
            </button>
          </div>

          <div className="chat-body">
            <div className="messages-container">
              {!showPrivateChat && hasMore && (
                <button className="load-more" onClick={() => fetchOlderMessages(20)}>
                  Load older
                </button>
              )}
              {displayMessages.map((message) => (
                <div
                  key={message.id}
                  data-message-id={message.id}
                  className={`message ${message.system ? 'system-message' : ''}`}
                >
                  {!message.system && (
                    <div className="message-header">
                      <span 
                        className="message-sender"
                        onClick={() => handleUserClick({ id: message.senderId, username: message.sender })}
                        style={{ cursor: 'pointer' }}
                      >
                        {message.sender}
                      </span>
                      <span className="message-time">
                        {new Date(message.timestamp).toLocaleTimeString()}
                        {message.senderId === socket.id && (
                          <span 
                            title={
                              message.status === 'sending' 
                                ? 'Sending…' 
                                : message.status === 'read' || (message.readBy && message.readBy.length > 0)
                                ? 'Read' 
                                : 'Delivered'
                            } 
                            style={{ marginLeft: '6px', opacity: 0.8 }}
                          >
                            {message.status === 'sending' ? '⏳' : message.status === 'read' || (message.readBy && message.readBy.length > 0) ? '✓✓' : '✓'}
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                <div className="message-text">
                  {message.type === 'image' && message.data ? (
                    <img src={message.data} alt={message.message} className="message-image" />
                  ) : message.type === 'file' && message.data ? (
                    <a href={message.data} download>{message.message}</a>
                  ) : (
                    message.message
                  )}
                </div>
                {!message.system && message.reactions && (
                  <div className="message-reactions">
                    {Object.entries(message.reactions).map(([emoji, users]) => (
                      <button
                        key={emoji}
                        className="reaction-button"
                        onClick={() => handleReactionClick(message.id, emoji)}
                        title={users.join(', ')}
                      >
                        {emoji} {users.length}
                      </button>
                    ))}
                    <button
                      className="add-reaction-button"
                      onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                    >
                      +
                    </button>
                    {showEmojiPicker === message.id && (
                      <div className="emoji-picker">
                        {emojis.map(emoji => (
                          <button
                            key={emoji}
                            className="emoji-option"
                            onClick={() => handleReactionClick(message.id, emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {displayMessages.length === 0 && (
              <div className="empty-messages">
                <p>
                  {showPrivateChat && selectedUser 
                    ? `No messages yet. Start the conversation with ${selectedUser.username}!`
                    : 'No messages yet. Start the conversation!'}
                </p>
              </div>
            )}
            </div>

            <div className="typing-indicator">
              {typingUsers.length > 0 && (
                <span>
                  {typingUsers.length === 1
                    ? `${typingUsers[0]} is typing...`
                    : typingUsers.length === 2
                    ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
                    : `${typingUsers.length} people are typing...`}
                </span>
              )}
            </div>

            {/* Chat Rooms */}
            <div className="chat-rooms">
              {!showPrivateChat && availableRooms.map(room => (
                <button
                  key={room}
                  className={`room-button ${currentRoom === room ? 'active' : ''}`}
                  onClick={() => handleRoomChange(room)}
                >
                  #{room}
                  {unreadCounts[room] > 0 && (
                    <span className="unread-badge">{unreadCounts[room]}</span>
                  )}
                </button>
              ))}
              {showPrivateChat && (
                <button
                  className="back-button"
                  onClick={() => {
                    setShowPrivateChat(false);
                    setSelectedUser(null);
                  }}
                >
                  ← Back to {currentRoom}
                </button>
              )}
              <input
                type="search"
                className="search-input"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={async (e) => {
                  const q = e.target.value;
                  setSearchQuery(q);
                  if (q.trim().length >= 2) {
                    // Optional: preview search results in console or future dropdown
                    await searchMessages(q);
                  }
                }}
              />
              <button
                className="notification-toggle"
                onClick={async () => {
                  const enabled = await requestNotificationPermission();
                  setNotificationsEnabled(enabled);
                }}
                title={notificationsEnabled ? 'Notifications enabled' : 'Enable notifications'}
              >
                🔔{notificationsEnabled ? ' ✓' : ''}
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="message-form">
              <input
                type="text"
                placeholder="Type a message..."
                value={inputMessage}
                onChange={handleTyping}
                className="message-input"
                disabled={!isConnected}
              />
              <button type="submit" className="send-button" disabled={!isConnected}>
                Send
              </button>
            </form>
          </div>

          <div className="online-users">
            <h3>Online Users ({users.length})</h3>
            {showPrivateChat && selectedUser ? (
              <div className="private-chat-header">
                <h4>Private Chat with {selectedUser.username}</h4>
                <button
                  className="close-private-chat"
                  onClick={() => {
                    setShowPrivateChat(false);
                    setSelectedUser(null);
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <ul>
                {users.map((user) => (
                  <li 
                    key={user.id}
                    className={user.id === socket.id ? 'current-user' : ''}
                    onClick={() => user.id !== socket.id && handleUserClick(user)}
                    style={{ cursor: user.id === socket.id ? 'default' : 'pointer' }}
                  >
                    {user.username} {user.id === socket.id && '(You)'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

