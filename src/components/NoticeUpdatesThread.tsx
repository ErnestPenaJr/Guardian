import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Alert, Badge, Dropdown, Modal } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  MessageSquare, 
  Reply, 
  Edit3, 
  Pin, 
  MoreHorizontal,
  AlertTriangle,
  User,
  Calendar,
  Eye,
  ThumbsUp,
  Send,
  AtSign,
  Hash,
  ChevronRight,
  ChevronDown,
  Trash2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface NoticeUpdate {
  NOTICE_UPDATE_ID: number;
  NOTICE_ID: number;
  PARENT_UPDATE_ID: number | null;
  THREAD_LEVEL: number;
  UPDATE_TYPE: string;
  UPDATE_TITLE: string | null;
  UPDATE_CONTENT: string;
  AUTHOR_USER_ID: number;
  UPDATE_STATUS: string;
  IS_PINNED: boolean;
  REQUIRES_ACKNOWLEDGMENT: boolean;
  PRIORITY_LEVEL: string;
  VISIBILITY_SCOPE: string;
  TAGGED_USERS: string | null;
  MENTIONED_USERS: string | null;
  UPDATE_DATE: string;
  EDIT_DATE: string | null;
  EDITED_BY_USER_ID: number | null;
  EDIT_REASON: string | null;
  VIEW_COUNT: number;
  REACTION_COUNT: number;
  REPLY_COUNT: number;
  AUTHOR?: {
    FIRST_NAME: string;
    LAST_NAME: string;
    EMAIL: string;
  };
  _userAcknowledged?: boolean;
  _replies?: NoticeUpdate[];
}

interface NoticeUpdatesThreadProps {
  noticeId: number;
  noticeTitle: string;
  isAdmin: boolean;
  canAddUpdates: boolean;
}

const UPDATE_TYPES = [
  { value: 'UPDATE', label: 'Update', color: 'primary', icon: <MessageSquare size={14} /> },
  { value: 'CLARIFICATION', label: 'Clarification', color: 'info', icon: <Eye size={14} /> },
  { value: 'AMENDMENT', label: 'Amendment', color: 'warning', icon: <Edit3 size={14} /> },
  { value: 'ANNOUNCEMENT', label: 'Announcement', color: 'success', icon: <AlertTriangle size={14} /> },
  { value: 'REMINDER', label: 'Reminder', color: 'warning', icon: <Calendar size={14} /> },
  { value: 'QUESTION', label: 'Question', color: 'info', icon: <MessageSquare size={14} /> },
  { value: 'REPLY', label: 'Reply', color: 'secondary', icon: <Reply size={14} /> },
];

const PRIORITY_LEVELS = [
  { value: 'NORMAL', label: 'Normal', color: 'secondary' },
  { value: 'HIGH', label: 'High', color: 'warning' },
  { value: 'URGENT', label: 'Urgent', color: 'danger' },
];

const NoticeUpdatesThread: React.FC<NoticeUpdatesThreadProps> = ({
  noticeId,
  noticeTitle,
  isAdmin,
  canAddUpdates
}) => {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<NoticeUpdate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [editingUpdate, setEditingUpdate] = useState<NoticeUpdate | null>(null);
  const [formData, setFormData] = useState({
    updateType: 'UPDATE',
    updateTitle: '',
    updateContent: '',
    priorityLevel: 'NORMAL',
    requiresAcknowledgment: false,
    isPinned: false,
    visibilityScope: 'ALL_RECIPIENTS',
    taggedUsers: [] as number[]
  });
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<number>>(new Set());

  // Load updates on component mount
  useEffect(() => {
    loadUpdates();
  }, [noticeId]);

  const loadUpdates = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/notices/${noticeId}/updates`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load notice updates');
      }

      const data = await response.json();
      setUpdates(data);
      
      // Auto-expand threads with recent activity
      const recentThreads = new Set<number>();
      data.forEach((update: NoticeUpdate) => {
        if (update.REPLY_COUNT > 0) {
          recentThreads.add(update.NOTICE_UPDATE_ID);
        }
      });
      setExpandedThreads(recentThreads);

    } catch (err: any) {
      console.error('Error loading updates:', err);
      setError(err.message || 'Failed to load updates');
      toast.error('Failed to load notice updates');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.updateContent.trim()) {
      toast.error('Please enter update content');
      return;
    }

    try {
      setSubmitting(true);

      const updateData = {
        ...formData,
        parentUpdateId: replyingTo,
        noticeId: noticeId
      };

      let endpoint = `/api/notices/${noticeId}/updates`;
      let method = 'POST';

      if (editingUpdate) {
        endpoint = `/api/notices/${noticeId}/updates/${editingUpdate.NOTICE_UPDATE_ID}`;
        method = 'PUT';
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit update');
      }

      toast.success(editingUpdate ? 'Update modified successfully' : 'Update posted successfully');
      
      // Reset form
      setFormData({
        updateType: 'UPDATE',
        updateTitle: '',
        updateContent: '',
        priorityLevel: 'NORMAL',
        requiresAcknowledgment: false,
        isPinned: false,
        visibilityScope: 'ALL_RECIPIENTS',
        taggedUsers: []
      });
      setShowAddForm(false);
      setReplyingTo(null);
      setEditingUpdate(null);
      
      // Reload updates
      loadUpdates();

    } catch (err: any) {
      console.error('Error submitting update:', err);
      toast.error(err.message || 'Failed to submit update');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcknowledgeUpdate = async (updateId: number) => {
    try {
      const response = await fetch(`/api/notices/${noticeId}/updates/${updateId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ acknowledgmentType: 'read' })
      });

      if (!response.ok) {
        throw new Error('Failed to acknowledge update');
      }

      toast.success('Update acknowledged');
      loadUpdates();

    } catch (err: any) {
      console.error('Error acknowledging update:', err);
      toast.error('Failed to acknowledge update');
    }
  };

  const toggleThread = (updateId: number) => {
    const newExpanded = new Set(expandedThreads);
    if (newExpanded.has(updateId)) {
      newExpanded.delete(updateId);
    } else {
      newExpanded.add(updateId);
    }
    setExpandedThreads(newExpanded);
  };

  const getUpdateTypeInfo = (type: string) => {
    return UPDATE_TYPES.find(t => t.value === type) || UPDATE_TYPES[0];
  };

  const getPriorityInfo = (priority: string) => {
    return PRIORITY_LEVELS.find(p => p.value === priority) || PRIORITY_LEVELS[0];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const renderUpdateForm = () => (
    <Card className="mb-3">
      <Card.Header>
        <h6 className="mb-0">
          {editingUpdate ? 'Edit Update' : replyingTo ? 'Post Reply' : 'Add Update'}
        </h6>
      </Card.Header>
      <Card.Body>
        <Form onSubmit={handleSubmitUpdate}>
          {/* Update Type */}
          <Form.Group className="mb-3">
            <Form.Label>Update Type</Form.Label>
            <Form.Select
              value={formData.updateType}
              onChange={(e) => setFormData({ ...formData, updateType: e.target.value })}
              disabled={submitting || !!replyingTo}
            >
              {UPDATE_TYPES.filter(type => replyingTo ? type.value === 'REPLY' : type.value !== 'REPLY').map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* Title (optional) */}
          {!replyingTo && (
            <Form.Group className="mb-3">
              <Form.Label>Title (Optional)</Form.Label>
              <Form.Control
                type="text"
                value={formData.updateTitle}
                onChange={(e) => setFormData({ ...formData, updateTitle: e.target.value })}
                placeholder="Optional title for this update..."
                disabled={submitting}
              />
            </Form.Group>
          )}

          {/* Content */}
          <Form.Group className="mb-3">
            <Form.Label>Content <span className="text-danger">*</span></Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={formData.updateContent}
              onChange={(e) => setFormData({ ...formData, updateContent: e.target.value })}
              placeholder="Enter your update content..."
              disabled={submitting}
              required
              maxLength={4000}
            />
            <Form.Text className="text-muted">
              {formData.updateContent.length}/4000 characters
            </Form.Text>
          </Form.Group>

          {/* Priority Level */}
          {!replyingTo && (
            <Form.Group className="mb-3">
              <Form.Label>Priority Level</Form.Label>
              <Form.Select
                value={formData.priorityLevel}
                onChange={(e) => setFormData({ ...formData, priorityLevel: e.target.value })}
                disabled={submitting}
              >
                {PRIORITY_LEVELS.map(priority => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          )}

          {/* Options */}
          {isAdmin && !replyingTo && (
            <div className="row mb-3">
              <div className="col-md-6">
                <Form.Check
                  type="checkbox"
                  id="requiresAcknowledgment"
                  checked={formData.requiresAcknowledgment}
                  onChange={(e) => setFormData({ ...formData, requiresAcknowledgment: e.target.checked })}
                  label="Requires Acknowledgment"
                  disabled={submitting}
                />
              </div>
              <div className="col-md-6">
                <Form.Check
                  type="checkbox"
                  id="isPinned"
                  checked={formData.isPinned}
                  onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                  label="Pin to Top"
                  disabled={submitting}
                />
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="d-flex justify-content-between">
            <Button 
              variant="secondary" 
              onClick={() => {
                setShowAddForm(false);
                setReplyingTo(null);
                setEditingUpdate(null);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              type="submit"
              disabled={submitting || !formData.updateContent.trim()}
              className="d-flex align-items-center"
            >
              {submitting ? (
                <>
                  <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
                  Posting...
                </>
              ) : (
                <>
                  <Send size={14} className="me-1" />
                  {editingUpdate ? 'Update' : 'Post'}
                </>
              )}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );

  const renderUpdate = (update: NoticeUpdate) => {
    const typeInfo = getUpdateTypeInfo(update.UPDATE_TYPE);
    const priorityInfo = getPriorityInfo(update.PRIORITY_LEVEL);
    const isExpanded = expandedThreads.has(update.NOTICE_UPDATE_ID);
    const hasReplies = update.REPLY_COUNT > 0;
    const indentLevel = Math.min(update.THREAD_LEVEL, 3); // Max 3 levels of visual indentation

    return (
      <div key={update.NOTICE_UPDATE_ID} className={`mb-3 ${indentLevel > 0 ? 'ms-4' : ''}`}>
        <Card className={`${update.IS_PINNED ? 'border-warning' : ''} ${update.REQUIRES_ACKNOWLEDGMENT && !update._userAcknowledged ? 'border-info' : ''}`}>
          {update.IS_PINNED && (
            <div className="bg-warning bg-opacity-10 px-3 py-1">
              <small className="text-warning fw-bold">
                <Pin size={12} className="me-1" />
                Pinned Update
              </small>
            </div>
          )}
          
          <Card.Body>
            <div className="d-flex justify-content-between align-items-start mb-2">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <Badge bg={typeInfo.color} className="d-flex align-items-center">
                  {typeInfo.icon}
                  <span className="ms-1">{typeInfo.label}</span>
                </Badge>
                
                {update.PRIORITY_LEVEL !== 'NORMAL' && (
                  <Badge bg={priorityInfo.color}>
                    {priorityInfo.label} Priority
                  </Badge>
                )}
                
                {update.REQUIRES_ACKNOWLEDGMENT && !update._userAcknowledged && (
                  <Badge bg="info">
                    Requires Acknowledgment
                  </Badge>
                )}
              </div>
              
              <Dropdown>
                <Dropdown.Toggle variant="link" size="sm" className="text-muted">
                  <MoreHorizontal size={16} />
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {update.REQUIRES_ACKNOWLEDGMENT && !update._userAcknowledged && (
                    <Dropdown.Item onClick={() => handleAcknowledgeUpdate(update.NOTICE_UPDATE_ID)}>
                      <Eye size={14} className="me-2" />
                      Acknowledge
                    </Dropdown.Item>
                  )}
                  <Dropdown.Item onClick={() => setReplyingTo(update.NOTICE_UPDATE_ID)}>
                    <Reply size={14} className="me-2" />
                    Reply
                  </Dropdown.Item>
                  {(isAdmin || update.AUTHOR_USER_ID === (user?.USER_ID || user?.userId)) && (
                    <Dropdown.Item onClick={() => setEditingUpdate(update)}>
                      <Edit3 size={14} className="me-2" />
                      Edit
                    </Dropdown.Item>
                  )}
                </Dropdown.Menu>
              </Dropdown>
            </div>

            {/* Update Title */}
            {update.UPDATE_TITLE && (
              <h6 className="mb-2">{update.UPDATE_TITLE}</h6>
            )}

            {/* Update Content */}
            <div className="mb-3" style={{ whiteSpace: 'pre-wrap' }}>
              {update.UPDATE_CONTENT}
            </div>

            {/* Update Metadata */}
            <div className="d-flex justify-content-between align-items-center text-muted small">
              <div className="d-flex align-items-center gap-3">
                <span>
                  <User size={12} className="me-1" />
                  {update.AUTHOR ? `${update.AUTHOR.FIRST_NAME} ${update.AUTHOR.LAST_NAME}` : 'Unknown'}
                </span>
                <span>
                  <Calendar size={12} className="me-1" />
                  {formatDate(update.UPDATE_DATE)}
                </span>
                {update.EDIT_DATE && (
                  <span>
                    <Edit3 size={12} className="me-1" />
                    Edited {formatDate(update.EDIT_DATE)}
                  </span>
                )}
              </div>
              
              <div className="d-flex align-items-center gap-2">
                {update.VIEW_COUNT > 0 && (
                  <span>
                    <Eye size={12} className="me-1" />
                    {update.VIEW_COUNT}
                  </span>
                )}
                {hasReplies && (
                  <Button
                    variant="link"
                    size="sm"
                    className="text-muted p-0"
                    onClick={() => toggleThread(update.NOTICE_UPDATE_ID)}
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {update.REPLY_COUNT} {update.REPLY_COUNT === 1 ? 'reply' : 'replies'}
                  </Button>
                )}
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Replies */}
        {hasReplies && isExpanded && update._replies && (
          <div className="mt-2">
            {update._replies.map(reply => renderUpdate(reply))}
          </div>
        )}

        {/* Reply Form */}
        {replyingTo === update.NOTICE_UPDATE_ID && renderUpdateForm()}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading updates...</span>
        </div>
        <p className="mt-2 text-muted">Loading notice updates...</p>
      </div>
    );
  }

  return (
    <div className="notice-updates-thread">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <MessageSquare size={20} className="me-2" />
          Discussion & Updates
        </h5>
        
        {canAddUpdates && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddForm(true)}
            className="d-flex align-items-center"
          >
            <MessageSquare size={14} className="me-1" />
            Add Update
          </Button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="danger" className="mb-3">
          <AlertTriangle size={16} className="me-2" />
          {error}
        </Alert>
      )}

      {/* Add Update Form */}
      {showAddForm && renderUpdateForm()}

      {/* Edit Update Form */}
      {editingUpdate && renderUpdateForm()}

      {/* Updates List */}
      {updates.length === 0 ? (
        <Card className="text-center text-muted py-4">
          <Card.Body>
            <MessageSquare size={48} className="mb-3" />
            <p className="mb-0">No updates or discussions yet.</p>
            {canAddUpdates && (
              <p className="text-muted">Be the first to add an update!</p>
            )}
          </Card.Body>
        </Card>
      ) : (
        <div className="updates-list">
          {updates
            .filter(update => update.THREAD_LEVEL === 0) // Show only top-level updates
            .sort((a, b) => {
              // Pinned updates first, then by date (newest first)
              if (a.IS_PINNED && !b.IS_PINNED) return -1;
              if (!a.IS_PINNED && b.IS_PINNED) return 1;
              return new Date(b.UPDATE_DATE).getTime() - new Date(a.UPDATE_DATE).getTime();
            })
            .map(update => renderUpdate(update))
          }
        </div>
      )}
    </div>
  );
};

export default NoticeUpdatesThread;