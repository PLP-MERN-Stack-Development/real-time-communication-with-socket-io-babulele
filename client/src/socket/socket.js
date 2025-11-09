// socket.js - Socket.io client setup

import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

// Socket.io connection URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Create socket instance
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  transports: ['websocket'],
});

// Custom hook for using socket.io
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [lastMessage, setLastMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [currentUsername, setCurrentUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [currentRoom, setCurrentRoom] = useState('general');
  const [availableRooms, setAvailableRooms] = useState(['general']);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Connect to socket server
  const connect = (username) => {
    setUsernameError('');
    const trimmedUsername = username ? username.trim() : '';
    
    if (!trimmedUsername) {
      return;
    }
    
    // Clear current username to prevent auto-rejoin issues
    setCurrentUsername('');
    
    // If already connected, emit user_join immediately
    if (socket.connected) {
      setCurrentUsername(trimmedUsername);
      socket.emit('user_join', trimmedUsername);
      return;
    }
    
    // Otherwise, connect and wait for connection
    socket.connect();
    
    // Wait for connection, then emit user_join (only once)
    const handleConnectOnce = () => {
      setCurrentUsername(trimmedUsername);
      socket.emit('user_join', trimmedUsername);
    };
    
    socket.once('connect', handleConnectOnce);
  };

  // Disconnect from socket server
  const disconnect = () => {
    socket.disconnect();
    setCurrentUsername('');
    setMessages([]);
    setUsers([]);
    setTypingUsers([]);
    setCurrentRoom('general');
    setAvailableRooms(['general']);
  };

  // Send a message with optimistic update and tempId
  const sendMessage = (message, type = 'text', data = null) => {
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimistic = {
      id: tempId,
      tempId,
      message,
      type,
      data,
      sender: currentUsername || 'You',
      senderId: socket.id,
      timestamp: new Date().toISOString(),
      room: currentRoom,
      status: 'sending',
    };
    setMessages((prev) => [...prev, optimistic]);
    socket.emit('send_message', { message, type, data, tempId });
  };

  // Send a private message with optional file/image
  const sendPrivateMessage = (to, message, type = 'text', data = null) => {
    // Create optimistic message for immediate UI update
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimistic = {
      id: tempId,
      tempId,
      message,
      type,
      data,
      sender: currentUsername || 'You',
      senderId: socket.id,
      recipientId: to, // Store recipient ID for filtering
      timestamp: new Date().toISOString(),
      isPrivate: true,
      status: 'sending',
    };
    setMessages((prev) => [...prev, optimistic]);
    socket.emit('private_message', { to, message, type, data });
  };

  // Set typing status
  const setTyping = (isTyping) => {
    socket.emit('typing', isTyping);
  };

  // Join a room
  const joinRoom = (roomName) => {
    socket.emit('join_room', roomName);
  };

  // Leave a room
  const leaveRoom = (roomName) => {
    socket.emit('leave_room', roomName);
  };

  // Add reaction to a message
  const addReaction = (messageId, room, reaction) => {
    socket.emit('add_reaction', { messageId, room, reaction });
  };

  // Mark room as read
  const markRoomAsRead = (roomName) => {
    setUnreadCounts(prev => ({ ...prev, [roomName]: 0 }));
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === 'granted');
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  };

  // Pagination: fetch older messages for current room
  const fetchOlderMessages = async (limit = 20) => {
    try {
      const first = messages[0];
      const before = first ? first.timestamp : new Date().toISOString();
      const res = await fetch(`${SOCKET_URL.replace(/\/$/, '')}/api/messages/${currentRoom}?before=${encodeURIComponent(before)}&limit=${limit}`);
      const data = await res.json();
      if (data && Array.isArray(data.messages)) {
        const currentIds = new Set(messages.map(m => m.id));
        const older = data.messages.filter(m => !currentIds.has(m.id));
        if (older.length > 0) {
          setMessages((prev) => [...older, ...prev]);
        }
        setHasMore(Boolean(data.hasMore));
      }
    } catch (_e) {}
  };

  // Search messages in current room
  const searchMessages = async (q) => {
    try {
      const res = await fetch(`${SOCKET_URL.replace(/\/$/, '')}/api/messages/${currentRoom}/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (_e) {
      return [];
    }
  };

  // Socket event listeners
  useEffect(() => {
    // Connection events
    const onConnect = () => {
      setIsConnected(true);
      // Only re-authenticate if we have a valid username and no error
      // Don't auto-rejoin on reconnect to prevent conflicts
      // User should manually join again after disconnect
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    // Message events
    const onReceiveMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => [...prev, message]);
      
      // Update unread count if message is from another room
      if (message.room && message.room !== currentRoom) {
        setUnreadCounts(prev => ({
          ...prev,
          [message.room]: (prev[message.room] || 0) + 1
        }));
      } else if (message.room && message.room === currentRoom) {
        // If message is in current room and user is viewing, mark as read
        // (Server already handles this when user joins room, but we can mark new messages)
        if (message.senderId !== socket.id && !message.isPrivate) {
          // Mark individual message as read after a short delay (user is viewing)
          setTimeout(() => {
            socket.emit('mark_message_read', { messageId: message.id, room: message.room, isPrivate: false });
          }, 500);
        }
      }
    };

    const onPrivateMessage = (message) => {
      setLastMessage(message);
      // Ensure message has isPrivate flag and recipientId
      const privateMsg = {
        ...message,
        isPrivate: true,
        recipientId: message.recipientId || (message.senderId === socket.id ? message.recipientId : socket.id),
      };
      
      // Update existing optimistic message if it exists (by tempId or by matching sender/recipient)
      setMessages((prev) => {
        // Check if there's an optimistic message to replace
        const existingIndex = prev.findIndex(
          m => m.tempId && m.senderId === socket.id && m.isPrivate
        );
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...privateMsg, status: 'delivered' };
          return updated;
        }
        return [...prev, privateMsg];
      });
      
      // Mark private message as read when received (user is viewing)
      if (message.senderId !== socket.id) {
        // Mark as read after a short delay (simulating user viewing the message)
        setTimeout(() => {
          socket.emit('mark_message_read', { messageId: message.id, room: null, isPrivate: true });
        }, 500);
      }
    };

    // User events
    const onUserList = (userList) => {
      setUsers(userList);
    };

    const onUserJoined = (user) => {
      // You could add a system message here
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} joined the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    const onUserLeft = (user) => {
      // You could add a system message here
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} left the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    // Typing events
    const onTypingUsers = (users) => {
      setTypingUsers(users);
    };

    // Username error event
    const onUsernameTaken = (error) => {
      console.log('[Client] Username error:', error.message);
      setUsernameError(error.message);
      setCurrentUsername(''); // Clear username on error to prevent auto-rejoin
      setIsConnected(false);
      // Disconnect to ensure clean state
      socket.disconnect();
    };

    // Room events
    const onRoomChanged = (data) => {
      setCurrentRoom(data.room);
      setMessages(data.messages || []);
      // Mark the room as read when user joins it
      setUnreadCounts(prev => ({ ...prev, [data.room]: 0 }));
      
      // Mark all messages in the room as read when user joins
      // Server already handles this, but we can also mark client-side for immediate feedback
      const roomMessages = data.messages || [];
      roomMessages.forEach((message) => {
        if (message.senderId !== socket.id && !message.isPrivate && message.id) {
          // Mark as read after a short delay
          setTimeout(() => {
            socket.emit('mark_message_read', { messageId: message.id, room: data.room, isPrivate: false });
          }, 100);
        }
      });
    };

    const onUserJoinedRoom = (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${data.username} joined ${data.room}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    const onUserLeftRoom = (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${data.username} left ${data.room}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    const onAvailableRooms = (rooms) => {
      setAvailableRooms(rooms);
    };

    // Reaction events
    const onMessageReactionUpdated = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, reactions } : msg
        )
      );
    };

    // Delivery ack
    const onMessageAck = ({ tempId, id, room }) => {
      setMessages((prev) => prev.map(m => (m.tempId === tempId ? { ...m, id, status: 'delivered' } : m)));
    };

    // Read receipt event
    const onMessageRead = ({ messageId, readBy }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            // Initialize readBy array if it doesn't exist
            const readByList = msg.readBy || [];
            // Check if this user already marked it as read
            if (!readByList.some((r) => r.userId === readBy.userId)) {
              return {
                ...msg,
                readBy: [...readByList, readBy],
                status: 'read', // Update status to read
              };
            }
          }
          return msg;
        })
      );
    };

    // Register event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('receive_message', onReceiveMessage);
    socket.on('private_message', onPrivateMessage);
    socket.on('user_list', onUserList);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('typing_users', onTypingUsers);
    socket.on('username_taken', onUsernameTaken);
    socket.on('room_changed', onRoomChanged);
    socket.on('user_joined_room', onUserJoinedRoom);
    socket.on('user_left_room', onUserLeftRoom);
    socket.on('available_rooms', onAvailableRooms);
    socket.on('message_reaction_updated', onMessageReactionUpdated);
    socket.on('message_ack', onMessageAck);
    socket.on('message_read', onMessageRead);

    // Clean up event listeners
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('receive_message', onReceiveMessage);
      socket.off('private_message', onPrivateMessage);
      socket.off('user_list', onUserList);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('typing_users', onTypingUsers);
      socket.off('username_taken', onUsernameTaken);
      socket.off('room_changed', onRoomChanged);
      socket.off('user_joined_room', onUserJoinedRoom);
      socket.off('user_left_room', onUserLeftRoom);
      socket.off('available_rooms', onAvailableRooms);
      socket.off('message_reaction_updated', onMessageReactionUpdated);
      socket.off('message_ack', onMessageAck);
      socket.off('message_read', onMessageRead);
    };
  }, [currentUsername, currentRoom]);

  return {
    socket,
    isConnected,
    lastMessage,
    messages,
    users,
    typingUsers,
    currentUsername,
    usernameError,
    currentRoom,
    availableRooms,
    unreadCounts,
    notificationsEnabled,
    hasMore,
    connect,
    disconnect,
    sendMessage,
    sendPrivateMessage,
    setTyping,
    joinRoom,
    leaveRoom,
    addReaction,
    markRoomAsRead,
    requestNotificationPermission,
    fetchOlderMessages,
    searchMessages,
  };
};

export default socket; 