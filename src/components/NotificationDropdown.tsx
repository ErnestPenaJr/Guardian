import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import notificationService, { Notification } from '../services/notificationService';
import { toast } from 'react-toastify';

// Add CSS animation for bell juggling
const style = document.createElement('style');
style.textContent = `
  @keyframes juggle {
    0%, 100% { transform: rotate(0deg); }
    10% { transform: rotate(-10deg) scale(1.1); }
    20% { transform: rotate(10deg) scale(1.1); }
    30% { transform: rotate(-8deg) scale(1.05); }
    40% { transform: rotate(8deg) scale(1.05); }
    50% { transform: rotate(-5deg) scale(1.02); }
    60% { transform: rotate(5deg) scale(1.02); }
    70% { transform: rotate(-3deg) scale(1.01); }
    80% { transform: rotate(3deg) scale(1.01); }
    90% { transform: rotate(-1deg) scale(1.005); }
  }
`;
if (!document.head.querySelector('style[data-notification-bell]')) {
  style.setAttribute('data-notification-bell', 'true');
  document.head.appendChild(style);
}

interface NotificationDropdownProps {
  className?: string;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isJuggling, setIsJuggling] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only fetch notifications if user is authenticated
    const token = localStorage.getItem('token');
    if (token) {
      fetchNotificationCount();
      // Poll for notifications every 30 seconds
      const interval = setInterval(fetchNotificationCount, 30000);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    // Juggle bell animation every 15 seconds only if there are unread notifications
    const juggleInterval = setInterval(() => {
      if (unreadCount > 0) {
        setIsJuggling(true);
        setTimeout(() => setIsJuggling(false), 1000); // Animation lasts 1 second
      }
    }, 15000);
    return () => clearInterval(juggleInterval);
  }, [unreadCount]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotificationCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // No token available, skip API call
        return;
      }
      
      const response = await notificationService.getNotificationCount();
      setUnreadCount(response.unreadCount);
    } catch (error) {
      // Only log error if it's not an authentication issue
      if (error?.response?.status !== 401) {
        console.error('Error fetching notification count:', error);
      }
    }
  };

  const fetchNotifications = async () => {
    if (loading) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // No token available, skip API call
        return;
      }
      
      setLoading(true);
      const response = await notificationService.getNotifications({ limit: 20 });
      setNotifications(response.data);
    } catch (error) {
      // Only show error toast and log if it's not an authentication issue
      if (error?.response?.status !== 401) {
        console.error('Error fetching notifications:', error);
        toast.error('Failed to load notifications');
      }
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.NOTIFICATION_ID === notificationId ? { ...n, IS_READ: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, IS_READ: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  };

  const handleToggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifications();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'assignment':
        return '📋';
      case 'completion':
        return '✅';
      case 'update':
        return '📝';
      default:
        return '🔔';
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={handleToggleDropdown}
        className="relative p-2 text-gray-600 hover:text-gray-900 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        style={{ backgroundColor: 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        aria-label="Notifications"
      >
        <Bell className={`w-6 h-6 ${isJuggling ? 'animate-bounce' : ''}`} style={{
          animation: isJuggling ? 'juggle 1s ease-in-out' : undefined
        }} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center min-w-5">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.NOTIFICATION_ID}
                    className={`p-4 transition-colors ${
                      !notification.IS_READ ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    style={{ backgroundColor: !notification.IS_READ ? '#e3f2fd' : 'transparent' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = !notification.IS_READ ? '#e3f2fd' : 'transparent'}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <span className="text-lg">
                          {getNotificationIcon(notification.TYPE)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h4 className={`font-medium text-sm ${
                              !notification.IS_READ ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.TITLE}
                            </h4>
                            <p className={`text-sm mt-1 ${
                              !notification.IS_READ ? 'text-gray-700' : 'text-gray-600'
                            }`}>
                              {notification.MESSAGE}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              {formatDate(notification.CREATED_DATE)}
                            </p>
                          </div>
                          {!notification.IS_READ && (
                            <button
                              onClick={() => markAsRead(notification.NOTIFICATION_ID)}
                              className="flex-shrink-0 p-1 text-blue-600 hover:text-blue-800 rounded"
                              style={{ backgroundColor: 'transparent' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Could navigate to a full notifications page here
                }}
                className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium text-center"
              >
                View All Notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;