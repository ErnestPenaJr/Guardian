import api from '../utils/api';

export interface Notification {
  NOTIFICATION_ID: number;
  TYPE: string;
  TITLE: string;
  MESSAGE: string;
  RELATED_ID: number | null;
  IS_READ: boolean;
  CREATED_DATE: string;
}

export interface NotificationResponse {
  success: boolean;
  data: Notification[];
  count: number;
}

export interface NotificationCountResponse {
  success: boolean;
  unreadCount: number;
}

class NotificationService {
  async getNotifications(options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  } = {}): Promise<NotificationResponse> {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.unreadOnly) params.append('unreadOnly', 'true');

    const queryString = params.toString();
    const url = `/api/notifications${queryString ? '?' + queryString : ''}`;
    
    const response = await api.get(url);
    return response.data;
  }

  async getNotificationCount(): Promise<NotificationCountResponse> {
    const response = await api.get('/api/notifications/count');
    return response.data;
  }

  async markAsRead(notificationId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.put(`/api/notifications/${notificationId}/read`);
    return response.data;
  }

  async markAllAsRead(): Promise<{ success: boolean; message: string; updatedCount: number }> {
    const response = await api.put('/api/notifications/read-all');
    return response.data;
  }
}

export default new NotificationService();