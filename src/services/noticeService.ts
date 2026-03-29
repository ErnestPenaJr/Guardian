import api from '../utils/api';

// Notice interfaces
export interface Notice {
  NOTICE_ID: number;
  TITLE: string;
  CONTENT: string;
  NOTICE_TYPE: string;
  STATUS: string;
  PRIORITY_LEVEL: string;
  DUE_DATE: string | null;
  ISSUED_BY_USER_ID: number;
  ISSUE_DATE: string | null;
  COMPANY_ID: number;
  FORM_TEMPLATE_ID: number | null;
  CANCELLATION_REASON: string | null;
  IS_ACTIVE: boolean;
  IS_DELETED: boolean;
  CREATE_DATE: string;
  UPDATE_DATE: string;
  CREATE_USER_ID: number | null;
  UPDATE_USER_ID: number | null;
  ISSUED_BY_USER?: {
    FIRST_NAME: string;
    LAST_NAME: string;
    EMAIL: string;
  };
  NOTICE_RECIPIENTS?: NoticeRecipient[];
  NOTICE_READ_STATUS?: NoticeReadStatus[];
  _recipientCount?: number;
  _unreadCount?: number;
  _isRead?: boolean;
}

export interface NoticeRecipient {
  NOTICE_RECIPIENT_ID: number;
  NOTICE_ID: number;
  RECIPIENT_USER_ID: number;
  RECIPIENT_TYPE: string;
  COMPANY_ID: number;
  CREATE_DATE: string;
  CREATE_USER_ID: number | null;
  USER?: {
    FIRST_NAME: string;
    LAST_NAME: string;
    EMAIL: string;
  };
}

export interface NoticeReadStatus {
  NOTICE_READ_STATUS_ID: number;
  NOTICE_ID: number;
  USER_ID: number;
  READ_date: string;
  COMPANY_ID: number;
  CREATE_DATE: string;
}

export interface CreateNoticeRequest {
  TITLE: string;
  CONTENT: string;
  NOTICE_TYPE: string;
  FORM_TEMPLATE_ID?: number;
  recipientUserIds: number[];
}

export interface UpdateNoticeRequest {
  TITLE?: string;
  CONTENT?: string;
  NOTICE_TYPE?: string;
  FORM_TEMPLATE_ID?: number;
  STATUS?: string;
  CANCELLATION_REASON?: string;
  recipientUserIds?: number[];
}

export interface NoticeFilters {
  status?: string;
  noticeType?: string;
  unreadOnly?: boolean;
  issuedByMe?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

class NoticeService {
  /**
   * Get all notices for the current user (notices issued to them)
   */
  async getMyNotices(filters?: NoticeFilters): Promise<Notice[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.noticeType) params.append('noticeType', filters.noticeType);
      if (filters?.unreadOnly) params.append('unreadOnly', 'true');
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.append('dateTo', filters.dateTo);

      const queryString = params.toString();
      const url = `/api/notices/my${queryString ? `?${queryString}` : ''}`;
      
      const response = await api.get(url);
      const payload = response.data;
      return Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
    } catch (error) {
      console.error('Error fetching my notices:', error);
      throw error;
    }
  }

  /**
   * Get all notices (role-based - only for authorized users)
   */
  async getAllNotices(filters?: NoticeFilters): Promise<Notice[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.noticeType) params.append('noticeType', filters.noticeType);
      if (filters?.unreadOnly) params.append('unreadOnly', 'true');
      if (filters?.issuedByMe) params.append('issuedByMe', 'true');
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.append('dateTo', filters.dateTo);

      const queryString = params.toString();
      const url = `/api/notices${queryString ? `?${queryString}` : ''}`;
      
      const response = await api.get(url);
      const payload = response.data;
      return Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
    } catch (error) {
      console.error('Error fetching all notices:', error);
      throw error;
    }
  }

  /**
   * Get a specific notice by ID
   */
  async getNoticeById(noticeId: number): Promise<Notice> {
    try {
      const response = await api.get(`/api/notices/${noticeId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching notice ${noticeId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new notice
   */
  async createNotice(noticeData: CreateNoticeRequest): Promise<Notice> {
    try {
      const response = await api.post('/api/notices', noticeData);
      return response.data;
    } catch (error) {
      console.error('Error creating notice:', error);
      throw error;
    }
  }

  /**
   * Update an existing notice
   */
  async updateNotice(noticeId: number, noticeData: UpdateNoticeRequest): Promise<Notice> {
    try {
      const response = await api.put(`/api/notices/${noticeId}`, noticeData);
      return response.data;
    } catch (error) {
      console.error(`Error updating notice ${noticeId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a notice (soft delete with reason)
   */
  async cancelNotice(noticeId: number, cancellationReason: string): Promise<Notice> {
    try {
      const response = await api.put(`/api/notices/${noticeId}/cancel`, {
        CANCELLATION_REASON: cancellationReason
      });
      return response.data;
    } catch (error) {
      console.error(`Error cancelling notice ${noticeId}:`, error);
      throw error;
    }
  }

  /**
   * Mark a notice as read for the current user
   */
  async markNoticeAsRead(noticeId: number): Promise<void> {
    try {
      await api.post(`/api/notices/${noticeId}/read`);
    } catch (error) {
      console.error(`Error marking notice ${noticeId} as read:`, error);
      throw error;
    }
  }

  /**
   * Get notice templates (forms with NOTICE type)
   */
  async getNoticeTemplates(): Promise<any[]> {
    try {
      const response = await api.get('/api/notices/templates');
      return response.data;
    } catch (error) {
      console.error('Error fetching notice templates:', error);
      throw error;
    }
  }

  /**
   * Get notice statistics for dashboard
   */
  async getNoticeStats(): Promise<{
    totalNotices: number;
    unreadNotices: number;
    issuedByMe: number;
    activeNotices: number;
  }> {
    try {
      const response = await api.get('/api/notices/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching notice statistics:', error);
      throw error;
    }
  }

  /**
   * Search notices by title or content
   */
  async searchNotices(searchTerm: string, filters?: NoticeFilters): Promise<Notice[]> {
    try {
      const params = new URLSearchParams();
      params.append('q', searchTerm);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.noticeType) params.append('noticeType', filters.noticeType);
      if (filters?.unreadOnly) params.append('unreadOnly', 'true');

      const response = await api.get(`/api/notices/search?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error searching notices:', error);
      throw error;
    }
  }

  /**
   * Get notice recipients for a specific notice
   */
  async getNoticeRecipients(noticeId: number): Promise<NoticeRecipient[]> {
    try {
      const response = await api.get(`/api/notices/${noticeId}/recipients`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching recipients for notice ${noticeId}:`, error);
      throw error;
    }
  }

  /**
   * Get notice read status for a specific notice
   */
  async getNoticeReadStatus(noticeId: number): Promise<NoticeReadStatus[]> {
    try {
      const response = await api.get(`/api/notices/${noticeId}/read-status`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching read status for notice ${noticeId}:`, error);
      throw error;
    }
  }


  /**
   * Publish a draft notice (change status from DRAFT to PUBLISHED)
   */
  async publishNotice(noticeId: number): Promise<Notice> {
    try {
      const response = await api.post(`/api/notices/${noticeId}/publish`);
      return response.data;
    } catch (error) {
      console.error(`Error publishing notice ${noticeId}:`, error);
      throw error;
    }
  }

  /**
   * Get users eligible to receive notices (within same company)
   */
  async getEligibleRecipients(): Promise<Array<{
    USER_ID: number;
    FIRST_NAME: string;
    LAST_NAME: string;
    EMAIL: string;
    ROLE_NAME?: string;
  }>> {
    try {
      const response = await api.get('/api/notices/eligible-recipients');
      return response.data;
    } catch (error) {
      console.error('Error fetching eligible recipients:', error);
      throw error;
    }
  }

  /**
   * Get status badge color for notice status
   */
  getStatusBadgeColor(status: string): string {
    switch (status) {
      case 'DRAFT':
        return 'warning';
      case 'PUBLISHED':
        return 'success';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  /**
   * Utility method to check if user has read a notice
   */
  hasUserReadNotice(notice: Notice, userId: number): boolean {
    return notice.NOTICE_READ_STATUS?.some(status => status.USER_ID === userId) || false;
  }

  /**
   * Utility method to format notice display name
   */
  getNoticeDisplayName(notice: Notice): string {
    const issuerName = notice.ISSUED_BY_USER ? 
      `${notice.ISSUED_BY_USER.FIRST_NAME} ${notice.ISSUED_BY_USER.LAST_NAME}` : 
      'Unknown';
    return `${notice.TITLE} (by ${issuerName})`;
  }


  /**
   * Start view tracking for analytics
   */
  async startViewTracking(noticeId: number, trackingData: {
    deviceType: string;
    referrerSource: string;
    viewStartTime: string;
  }): Promise<void> {
    try {
      await api.post(`/api/notices/${noticeId}/analytics/start`, trackingData);
    } catch (error) {
      console.error(`Error starting view tracking for notice ${noticeId}:`, error);
      throw error;
    }
  }

  /**
   * Update scroll tracking for analytics
   */
  async updateScrollTracking(noticeId: number, scrollPercentage: number): Promise<void> {
    try {
      await api.put(`/api/notices/${noticeId}/analytics/scroll`, {
        scrollPercentage
      });
    } catch (error) {
      console.error(`Error updating scroll tracking for notice ${noticeId}:`, error);
      // Don't throw error for scroll tracking to avoid disrupting user experience
    }
  }

  /**
   * Track user interaction for analytics
   */
  async trackInteraction(noticeId: number, interactionType: string): Promise<void> {
    try {
      await api.post(`/api/notices/${noticeId}/analytics/interaction`, {
        interactionType
      });
    } catch (error) {
      console.error(`Error tracking interaction for notice ${noticeId}:`, error);
      // Don't throw error for interaction tracking to avoid disrupting user experience
    }
  }

  /**
   * End view tracking for analytics
   */
  async endViewTracking(noticeId: number, trackingData: {
    viewEndTime: string;
    viewDurationSeconds: number;
    scrollPercentage: number;
    interactionCount: number;
    isCompletedView: boolean;
  }): Promise<void> {
    try {
      await api.put(`/api/notices/${noticeId}/analytics/end`, trackingData);
    } catch (error) {
      console.error(`Error ending view tracking for notice ${noticeId}:`, error);
      // Don't throw error for end tracking to avoid disrupting user experience
    }
  }

  /**
   * Get notice analytics data (admin only)
   */
  async getNoticeAnalytics(noticeId: number): Promise<{
    totalViews: number;
    uniqueViewers: number;
    averageViewDuration: number;
    completionRate: number;
    averageScrollPercentage: number;
    totalInteractions: number;
    deviceBreakdown: { [key: string]: number };
    referrerBreakdown: { [key: string]: number };
    viewTrends: Array<{ date: string; views: number; }>;
  }> {
    try {
      const response = await api.get(`/api/notices/${noticeId}/analytics`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching analytics for notice ${noticeId}:`, error);
      throw error;
    }
  }

  /**
   * Get company-wide notice analytics summary (admin only)
   */
  async getCompanyNoticeAnalytics(dateFrom?: string, dateTo?: string): Promise<{
    totalNotices: number;
    totalViews: number;
    averageEngagement: number;
    topNotices: Array<{
      noticeId: number;
      title: string;
      views: number;
      completionRate: number;
    }>;
    engagementTrends: Array<{ date: string; views: number; completions: number; }>;
  }> {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      
      const queryString = params.toString();
      const url = `/api/notices/analytics/company${queryString ? `?${queryString}` : ''}`;
      
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching company notice analytics:', error);
      throw error;
    }
  }
}

export default new NoticeService();