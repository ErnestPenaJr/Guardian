import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Modal, Button } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Users, 
  FileText, 
  Eye, 
  Edit, 
  X, 
  Send, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import noticeService, { Notice, NoticeRecipient, NoticeReadStatus } from '../services/noticeService';
import Layout from '../components/Layout';
import NoticeAnalyticsDashboard from '../components/NoticeAnalyticsDashboard';
import '../styles/RequestDashboard.css';

interface NoticeDetailsPageProps {}

const NoticeDetailsPage: React.FC<NoticeDetailsPageProps> = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // State management
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAsRead, setMarkingAsRead] = useState<boolean>(false);
  const [recipients, setRecipients] = useState<NoticeRecipient[]>([]);
  const [readStatus, setReadStatus] = useState<NoticeReadStatus[]>([]);
  const [formData, setFormData] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  
  // Analytics tracking state and refs
  const viewStartTimeRef = useRef<Date | null>(null);
  const lastScrollPercentageRef = useRef<number>(0);
  const interactionCountRef = useRef<number>(0);
  const isViewingRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const noticeContentRef = useRef<HTMLDivElement | null>(null);
  const analyticsSessionIdRef = useRef<string | null>(null);
  
  // Device detection
  const deviceType = useMemo(() => {
    if (typeof window === 'undefined') return 'DESKTOP';
    
    const userAgent = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad|phone/i.test(userAgent)) {
      return /ipad|tablet/i.test(userAgent) ? 'TABLET' : 'MOBILE';
    }
    return 'DESKTOP';
  }, []);
  
  // Referrer source detection
  const referrerSource = useMemo(() => {
    if (location.state?.from) {
      switch (location.state.from) {
        case 'my-notices': return 'MY_NOTICES';
        case 'all-notices': return 'ALL_NOTICES';
        case 'notification': return 'NOTIFICATION';
        case 'email': return 'EMAIL';
        default: return 'DIRECT_LINK';
      }
    }
    return 'DIRECT_LINK';
  }, [location.state]);
  
  // Modal states for actions
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showRecipientsModal, setShowRecipientsModal] = useState<boolean>(false);
  const [showReadStatusModal, setShowReadStatusModal] = useState<boolean>(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState<boolean>(false);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Analytics tracking functions
  const startViewTracking = useCallback(async () => {
    if (!notice || !user || isViewingRef.current) return;
    
    try {
      viewStartTimeRef.current = new Date();
      isViewingRef.current = true;
      analyticsSessionIdRef.current = `${user.USER_ID || user.userId}-${notice.NOTICE_ID}-${Date.now()}`;
      
      // Call API to start view tracking
      await noticeService.startViewTracking(notice.NOTICE_ID, {
        deviceType,
        referrerSource,
        viewStartTime: viewStartTimeRef.current.toISOString()
      });
    } catch (error) {
      console.error('Error starting view tracking:', error);
    }
  }, [notice, user, deviceType, referrerSource]);

  const updateScrollTracking = useCallback(() => {
    if (!noticeContentRef.current || !isViewingRef.current) return;
    
    const element = noticeContentRef.current;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight - element.clientHeight;
    const scrollPercentage = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 100;
    
    // Only update if scroll percentage increased significantly
    if (scrollPercentage > lastScrollPercentageRef.current + 5) {
      lastScrollPercentageRef.current = scrollPercentage;
      
      // Debounce scroll updates
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        if (notice && user) {
          noticeService.updateScrollTracking(notice.NOTICE_ID, scrollPercentage).catch(console.error);
        }
      }, 1000);
    }
  }, [notice, user]);

  const trackInteraction = useCallback(async (interactionType: string) => {
    if (!notice || !user || !isViewingRef.current) return;
    
    try {
      interactionCountRef.current += 1;
      await noticeService.trackInteraction(notice.NOTICE_ID, interactionType);
    } catch (error) {
      console.error('Error tracking interaction:', error);
    }
  }, [notice, user]);

  const endViewTracking = useCallback(async () => {
    if (!notice || !user || !isViewingRef.current || !viewStartTimeRef.current) return;
    
    try {
      const viewEndTime = new Date();
      const viewDurationSeconds = Math.round((viewEndTime.getTime() - viewStartTimeRef.current.getTime()) / 1000);
      const isCompletedView = lastScrollPercentageRef.current >= 80; // Consider 80%+ as completed view
      
      await noticeService.endViewTracking(notice.NOTICE_ID, {
        viewEndTime: viewEndTime.toISOString(),
        viewDurationSeconds,
        scrollPercentage: lastScrollPercentageRef.current,
        interactionCount: interactionCountRef.current,
        isCompletedView
      });
      
      isViewingRef.current = false;
    } catch (error) {
      console.error('Error ending view tracking:', error);
    }
  }, [notice, user]);

  // Window/page visibility and unload handlers for analytics
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        endViewTracking();
      } else if (notice && user) {
        startViewTracking();
      }
    };

    const handleBeforeUnload = () => {
      endViewTracking();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      endViewTracking();
    };
  }, [notice, user, endViewTracking, startViewTracking]);

  // Role-based access control
  const hasEditAccess = useMemo(() => {
    if (!user || !notice) return false;
    
    // Allow editing for Processor(3), Manager(4), Admin(1), Super Admin(6)
    const allowedRoles = [1, 3, 4, 6];
    
    // Check if user is the one who issued the notice or has admin role
    const isIssuer = notice.ISSUED_BY_USER_ID === (user.USER_ID || user.userId || user.id);
    
    if (user.roles && Array.isArray(user.roles)) {
      const hasRole = user.roles.some((role: any) => 
        typeof role === 'object' && role !== null && 
        allowedRoles.includes(role.id || role.role_id)
      );
      return isIssuer || hasRole;
    }
    
    if (user.role) {
      const roleId = parseInt(user.role, 10);
      return isIssuer || allowedRoles.includes(roleId);
    }
    
    return isIssuer;
  }, [user, notice]);

  const hasAdminAccess = useMemo(() => {
    if (!user) return false;
    
    // Admin access for Manager(4), Admin(1), Super Admin(6)
    const adminRoles = [1, 4, 6];
    
    if (user.roles && Array.isArray(user.roles)) {
      return user.roles.some((role: any) => 
        typeof role === 'object' && role !== null && 
        adminRoles.includes(role.id || role.role_id)
      );
    }
    
    if (user.role) {
      const roleId = parseInt(user.role, 10);
      return adminRoles.includes(roleId);
    }
    
    return false;
  }, [user]);

  // Load notice details on component mount
  useEffect(() => {
    if (id) {
      loadNoticeDetails();
    } else {
      setError('No notice ID provided');
      setLoading(false);
    }
  }, [id]);

  // Auto-mark as read when notice is loaded and start analytics tracking
  useEffect(() => {
    if (notice && user) {
      if (!notice._isRead && !markingAsRead) {
        markNoticeAsRead();
      }
      
      // Start view tracking
      startViewTracking();
    }
  }, [notice, user, markNoticeAsRead, startViewTracking]);

  const loadNoticeDetails = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const noticeData = await noticeService.getNoticeById(parseInt(id));
      setNotice(noticeData);
      
      // Load additional data if user has admin access
      if (hasAdminAccess) {
        const [recipientsData, readStatusData] = await Promise.all([
          noticeService.getNoticeRecipients(parseInt(id)).catch(() => []),
          noticeService.getNoticeReadStatus(parseInt(id)).catch(() => [])
        ]);
        
        setRecipients(recipientsData);
        setReadStatus(readStatusData);
      }
      
      // Load form data if notice has a form template
      if (noticeData.FORM_TEMPLATE_ID) {
        // TODO: Load form instance data when form service is integrated
        // const formInstanceData = await formService.getFormInstance(noticeData.FORM_TEMPLATE_ID);
        // setFormData(formInstanceData);
      }
      
    } catch (err: any) {
      console.error('Error loading notice details:', err);
      
      if (err.response?.status === 404) {
        setError('Notice not found or you do not have permission to view it.');
      } else if (err.response?.status === 403) {
        setError('You do not have permission to view this notice.');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to load notice details');
      }
      
      toast.error('Failed to load notice details');
    } finally {
      setLoading(false);
    }
  };

  const markNoticeAsRead = async () => {
    if (!notice || !user || markingAsRead) return;
    
    try {
      setMarkingAsRead(true);
      await noticeService.markNoticeAsRead(notice.NOTICE_ID);
      
      // Update local state
      setNotice(prev => prev ? { ...prev, _isRead: true } : null);
    } catch (error) {
      console.error('Error marking notice as read:', error);
      // Don't show toast for this as it's automatic
    } finally {
      setMarkingAsRead(false);
    }
  };

  const handleEditNotice = () => {
    if (!notice) return;
    // TODO: Implement edit functionality or navigate to edit page
    toast.info('Edit functionality coming soon');
  };

  const handleCancelNotice = async () => {
    if (!notice || !cancellationReason.trim()) return;
    
    try {
      setActionLoading(true);
      await noticeService.cancelNotice(notice.NOTICE_ID, cancellationReason.trim());
      
      toast.success('Notice cancelled successfully');
      setShowCancelModal(false);
      setCancellationReason('');
      
      // Reload notice to reflect changes
      await loadNoticeDetails();
    } catch (error: any) {
      console.error('Error cancelling notice:', error);
      toast.error(error.response?.data?.error || 'Failed to cancel notice');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishNotice = async () => {
    if (!notice || notice.STATUS !== 'DRAFT') return;
    
    try {
      setActionLoading(true);
      await noticeService.publishNotice(notice.NOTICE_ID);
      
      toast.success('Notice published successfully');
      
      // Reload notice to reflect changes
      await loadNoticeDetails();
    } catch (error: any) {
      console.error('Error publishing notice:', error);
      toast.error(error.response?.data?.error || 'Failed to publish notice');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBack = () => {
    // Navigate back to home and set notices section as active via state
    navigate('/home', { state: { activeSection: 'notices' } });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Clock size={16} className="text-warning" />;
      case 'PUBLISHED':
        return <CheckCircle size={16} className="text-success" />;
      case 'CANCELLED':
        return <X size={16} className="text-danger" />;
      default:
        return <FileText size={16} className="text-secondary" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'badge bg-warning text-dark';
      case 'PUBLISHED':
        return 'badge bg-success';
      case 'CANCELLED':
        return 'badge bg-danger';
      default:
        return 'badge bg-secondary';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
            <div className="text-center">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading notice...</span>
              </div>
              <p className="mt-3 text-muted">Loading notice details...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !notice) {
    return (
      <Layout>
        <div className="container">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
            <div className="text-center">
              <AlertTriangle size={48} className="text-danger mb-3" />
              <h4 className="text-danger mb-3">Notice Not Available</h4>
              <p className="text-muted mb-4">{error || 'Notice could not be loaded'}</p>
              <Button 
                variant="primary" 
                onClick={handleBack}
                className="px-4"
              >
                <ArrowLeft size={16} className="me-2" />
                Back to Notices
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container">
        {/* Header with navigation */}
        <div className="d-flex align-items-center mb-4">
          <Button 
            variant="outline-secondary" 
            onClick={handleBack}
            className="me-3"
          >
            <ArrowLeft size={16} className="me-1" />
            Back
          </Button>
          <div>
            <h1 className="mb-1" style={{ fontSize: '1.75rem', fontWeight: '600', color: '#2c3e50' }}>
              Notice Details
            </h1>
            <p className="mb-0 text-muted" style={{ fontSize: '14px' }}>
              Notice #{notice.NOTICE_ID} • {notice.NOTICE_TYPE}
            </p>
          </div>
        </div>

        {/* Notice Metadata Card */}
        <div className="card mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0 d-flex align-items-center">
              <FileText size={20} className="me-2 text-primary" />
              Notice Information
            </h5>
            <div className="d-flex gap-2">
              {/* Role-based action buttons */}
              {hasEditAccess && notice.STATUS === 'DRAFT' && (
                <Button 
                  variant="outline-primary" 
                  size="sm"
                  onClick={() => {
                    trackInteraction('publish_button');
                    handlePublishNotice();
                  }}
                  disabled={actionLoading}
                >
                  <Send size={14} className="me-1" />
                  Publish
                </Button>
              )}
              
              {hasAdminAccess && (
                <Button 
                  variant="outline-info" 
                  size="sm"
                  onClick={() => {
                    trackInteraction('analytics_button');
                    setShowAnalyticsModal(true);
                  }}
                >
                  <BarChart3 size={14} className="me-1" />
                  Analytics
                </Button>
              )}
              
              {hasEditAccess && notice.STATUS !== 'CANCELLED' && (
                <>
                  <Button 
                    variant="outline-secondary" 
                    size="sm"
                    onClick={() => {
                      trackInteraction('edit_button');
                      handleEditNotice();
                    }}
                  >
                    <Edit size={14} className="me-1" />
                    Edit
                  </Button>
                  
                  <Button 
                    variant="outline-danger" 
                    size="sm"
                    onClick={() => {
                      trackInteraction('cancel_button');
                      setShowCancelModal(true);
                    }}
                  >
                    <X size={14} className="me-1" />
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
          
          <div className="card-body">
            <div className="row">
              <div className="col-md-8">
                {/* Notice Title */}
                <div className="mb-3">
                  <h3 className={`mb-2 ${notice.STATUS === 'CANCELLED' ? 'text-decoration-line-through text-muted' : ''}`}>
                    {notice.TITLE}
                  </h3>
                  <div className="d-flex align-items-center gap-3 flex-wrap">
                    <span className={getStatusBadgeClass(notice.STATUS)}>
                      {getStatusIcon(notice.STATUS)}
                      <span className="ms-1">{notice.STATUS}</span>
                    </span>
                    <span className="badge bg-secondary">{notice.NOTICE_TYPE}</span>
                    {notice._isRead && (
                      <span className="badge bg-info">
                        <Eye size={12} className="me-1" />
                        Read
                      </span>
                    )}
                  </div>
                </div>

                {/* Cancellation reason if cancelled */}
                {notice.STATUS === 'CANCELLED' && notice.CANCELLATION_REASON && (
                  <div className="alert alert-danger mb-3">
                    <strong>Cancelled:</strong> {notice.CANCELLATION_REASON}
                  </div>
                )}
              </div>
              
              <div className="col-md-4">
                {/* Notice metadata */}
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex align-items-center text-muted">
                    <User size={16} className="me-2" />
                    <span className="fw-medium">Issued By:</span>
                    <span className="ms-2">
                      {notice.ISSUED_BY_USER ? 
                        `${notice.ISSUED_BY_USER.FIRST_NAME} ${notice.ISSUED_BY_USER.LAST_NAME}` : 
                        'Unknown'
                      }
                    </span>
                  </div>
                  
                  <div className="d-flex align-items-center text-muted">
                    <Calendar size={16} className="me-2" />
                    <span className="fw-medium">Issued Date:</span>
                    <span className="ms-2">{formatDate(notice.ISSUE_DATE)}</span>
                  </div>
                  
                  {hasAdminAccess && (
                    <div className="d-flex align-items-center text-muted">
                      <Users size={16} className="me-2" />
                      <span className="fw-medium">Recipients:</span>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 ms-2"
                        onClick={() => setShowRecipientsModal(true)}
                      >
                        {recipients.length} users
                      </Button>
                    </div>
                  )}
                  
                  {hasAdminAccess && readStatus.length > 0 && (
                    <div className="d-flex align-items-center text-muted">
                      <Eye size={16} className="me-2" />
                      <span className="fw-medium">Read Status:</span>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 ms-2"
                        onClick={() => setShowReadStatusModal(true)}
                      >
                        {readStatus.length} read
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notice Content */}
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">Notice Content</h5>
          </div>
          <div className="card-body">
            <div 
              ref={noticeContentRef}
              className="notice-content"
              style={{ 
                whiteSpace: 'pre-wrap', 
                lineHeight: '1.6',
                fontSize: '15px',
                maxHeight: '600px',
                overflowY: 'auto'
              }}
              onScroll={updateScrollTracking}
              onClick={() => trackInteraction('content_click')}
            >
              {notice.CONTENT}
            </div>
          </div>
        </div>

        {/* Form Content (if applicable) */}
        {notice.FORM_TEMPLATE_ID && (
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">Form Information</h5>
            </div>
            <div className="card-body">
              {formData ? (
                <div>
                  {/* TODO: Render form fields when form service is integrated */}
                  <p className="text-muted">Form data will be displayed here when form integration is complete.</p>
                </div>
              ) : (
                <div className="text-center text-muted py-3">
                  <FileText size={24} className="mb-2" />
                  <p className="mb-0">This notice includes form data (Template ID: {notice.FORM_TEMPLATE_ID})</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attachments (if applicable) */}
        {attachments.length > 0 && (
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">Attachments</h5>
            </div>
            <div className="card-body">
              <div className="list-group list-group-flush">
                {attachments.map((attachment, index) => (
                  <div key={index} className="list-group-item d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                      <FileText size={16} className="me-2 text-muted" />
                      <span>{attachment.name}</span>
                    </div>
                    <Button variant="outline-primary" size="sm">
                      <Download size={14} className="me-1" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Cancel Notice Modal */}
        <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>Cancel Notice</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>Are you sure you want to cancel this notice?</p>
            <div className="mb-3">
              <label className="form-label">Cancellation Reason <span className="text-danger">*</span></label>
              <textarea
                className="form-control"
                rows={3}
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Please provide a reason for cancelling this notice..."
                required
              />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
              Close
            </Button>
            <Button 
              variant="danger" 
              onClick={handleCancelNotice}
              disabled={!cancellationReason.trim() || actionLoading}
            >
              {actionLoading ? 'Cancelling...' : 'Cancel Notice'}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Recipients Modal */}
        <Modal show={showRecipientsModal} onHide={() => setShowRecipientsModal(false)} centered size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Notice Recipients</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {recipients.length > 0 ? (
              <div className="list-group">
                {recipients.map((recipient) => (
                  <div key={recipient.NOTICE_RECIPIENT_ID} className="list-group-item">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="mb-1">
                          {recipient.USER ? 
                            `${recipient.USER.FIRST_NAME} ${recipient.USER.LAST_NAME}` : 
                            'Unknown User'
                          }
                        </h6>
                        <p className="mb-1 text-muted small">
                          {recipient.USER?.EMAIL || 'No email'}
                        </p>
                        <small className="text-muted">Type: {recipient.RECIPIENT_TYPE}</small>
                      </div>
                      <span className="badge bg-primary">{recipient.RECIPIENT_TYPE}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-center">No recipients found.</p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowRecipientsModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Read Status Modal */}
        <Modal show={showReadStatusModal} onHide={() => setShowReadStatusModal(false)} centered size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Read Status</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {readStatus.length > 0 ? (
              <div className="list-group">
                {readStatus.map((status) => (
                  <div key={status.NOTICE_READ_STATUS_ID} className="list-group-item">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="mb-1">User ID: {status.USER_ID}</h6>
                        <small className="text-muted">Read on: {formatDate(status.READ_date)}</small>
                      </div>
                      <span className="badge bg-success">
                        <Eye size={14} className="me-1" />
                        Read
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-center">No read status available.</p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowReadStatusModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Analytics Modal */}
        <Modal show={showAnalyticsModal} onHide={() => setShowAnalyticsModal(false)} centered size="xl">
          <Modal.Header closeButton>
            <Modal.Title>
              <BarChart3 size={20} className="me-2" />
              Notice Analytics - {notice.TITLE}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <NoticeAnalyticsDashboard noticeId={notice.NOTICE_ID} />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAnalyticsModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </Layout>
  );
};

export default NoticeDetailsPage;