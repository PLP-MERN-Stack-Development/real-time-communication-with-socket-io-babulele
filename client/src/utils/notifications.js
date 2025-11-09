// Notification utilities for the chat application

// Play notification sound
export const playNotificationSound = () => {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
};

// Show browser notification
export const showBrowserNotification = (title, body, icon = '') => {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        tag: 'chat-notification',
      });
      
      // Close notification after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
      
      return notification;
    } catch (error) {
      console.error('Failed to show browser notification:', error);
    }
  }
  return null;
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return Notification.permission === 'granted';
};

