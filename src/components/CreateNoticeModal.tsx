import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { Save, X, Users, FileText, Bell } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import noticeService from '../services/noticeService';

interface CreateNoticeModalProps {
  show: boolean;
  onHide: () => void;
  onNoticeCreated?: () => void;
}

interface User {
  USER_ID: number;
  FIRST_NAME: string;
  LAST_NAME: string;
  EMAIL: string;
}

const CreateNoticeModal: React.FC<CreateNoticeModalProps> = ({
  show,
  onHide,
  onNoticeCreated
}) => {
  const { user } = useAuth();
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    noticeType: 'GENERAL',
    recipients: [] as number[],
    publishImmediately: false
  });
  
  // Modal state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Notice types
  const noticeTypes = [
    { value: 'GENERAL', label: 'General Announcement', icon: <Bell size={16} /> },
    { value: 'URGENT', label: 'Urgent Notice', icon: <Bell size={16} /> },
    { value: 'POLICY', label: 'Policy Update', icon: <FileText size={16} /> },
    { value: 'MAINTENANCE', label: 'Maintenance Notice', icon: <FileText size={16} /> },
    { value: 'TRAINING', label: 'Training Announcement', icon: <Users size={16} /> }
  ];

  // Load users when modal opens
  useEffect(() => {
    if (show) {
      loadUsers();
    }
  }, [show]);

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      // Use the existing users endpoint
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const usersData = await response.json();
        setUsers(usersData);
      } else {
        console.error('Failed to load users');
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const handleRecipientToggle = (userId: number) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.includes(userId)
        ? prev.recipients.filter(id => id !== userId)
        : [...prev.recipients, userId]
    }));
  };

  const selectAllUsers = () => {
    setFormData(prev => ({
      ...prev,
      recipients: users.map(u => u.USER_ID)
    }));
  };

  const clearAllUsers = () => {
    setFormData(prev => ({
      ...prev,
      recipients: []
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.title.trim()) {
      return 'Notice title is required';
    }
    
    if (formData.title.trim().length > 255) {
      return 'Notice title cannot exceed 255 characters';
    }
    
    if (!formData.content.trim()) {
      return 'Notice content is required';
    }
    
    if (formData.content.trim().length > 4000) {
      return 'Notice content cannot exceed 4000 characters';
    }
    
    if (formData.recipients.length === 0) {
      return 'At least one recipient must be selected';
    }
    
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const noticeData = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        noticeType: formData.noticeType,
        recipients: formData.recipients,
        status: formData.publishImmediately ? 'PUBLISHED' : 'DRAFT'
      };

      await noticeService.createNotice(noticeData);

      toast.success(
        formData.publishImmediately 
          ? 'Notice published successfully!' 
          : 'Notice saved as draft successfully!'
      );

      // Reset form
      setFormData({
        title: '',
        content: '',
        noticeType: 'GENERAL',
        recipients: [],
        publishImmediately: false
      });

      // Close modal and refresh parent
      onHide();
      if (onNoticeCreated) {
        onNoticeCreated();
      }

    } catch (error: any) {
      console.error('Error creating notice:', error);
      setError(error.response?.data?.error || error.message || 'Failed to create notice');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      // Reset form when closing
      setFormData({
        title: '',
        content: '',
        noticeType: 'GENERAL',
        recipients: [],
        publishImmediately: false
      });
      setError(null);
      onHide();
    }
  };

  return (
    <Modal 
      show={show} 
      onHide={handleClose}
      centered
      size="lg"
      backdrop={loading ? 'static' : true}
      keyboard={!loading}
    >
      <Modal.Header closeButton={!loading}>
        <Modal.Title className="d-flex align-items-center">
          <FileText size={20} className="me-2 text-primary" />
          Create New Notice
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <Alert variant="danger" className="mb-3">
            <strong>Error:</strong> {error}
          </Alert>
        )}

        <Form>
          {/* Notice Title */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-medium">
              Notice Title <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter notice title..."
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              maxLength={255}
              disabled={loading}
              className="form-control-lg"
            />
            <Form.Text className="text-muted">
              {formData.title.length}/255 characters
            </Form.Text>
          </Form.Group>

          {/* Notice Type */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-medium">Notice Type</Form.Label>
            <Form.Select
              value={formData.noticeType}
              onChange={(e) => handleInputChange('noticeType', e.target.value)}
              disabled={loading}
            >
              {noticeTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* Notice Content */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-medium">
              Notice Content <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={6}
              placeholder="Enter notice content..."
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              maxLength={4000}
              disabled={loading}
            />
            <Form.Text className="text-muted">
              {formData.content.length}/4000 characters
            </Form.Text>
          </Form.Group>

          {/* Recipients Selection */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-medium d-flex align-items-center justify-content-between">
              <span>
                Recipients <span className="text-danger">*</span>
              </span>
              <div>
                <Button
                  variant="link"
                  size="sm"
                  onClick={selectAllUsers}
                  disabled={loading || loadingUsers}
                  className="p-0 me-2"
                >
                  Select All
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  onClick={clearAllUsers}
                  disabled={loading || loadingUsers}
                  className="p-0"
                >
                  Clear All
                </Button>
              </div>
            </Form.Label>

            <div 
              className="border rounded p-3"
              style={{ maxHeight: '200px', overflowY: 'auto' }}
            >
              {loadingUsers ? (
                <div className="text-center py-3">
                  <div className="spinner-border spinner-border-sm me-2" />
                  Loading users...
                </div>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <Form.Check
                    key={user.USER_ID}
                    type="checkbox"
                    id={`user-${user.USER_ID}`}
                    label={`${user.FIRST_NAME} ${user.LAST_NAME} (${user.EMAIL})`}
                    checked={formData.recipients.includes(user.USER_ID)}
                    onChange={() => handleRecipientToggle(user.USER_ID)}
                    disabled={loading}
                    className="mb-2"
                  />
                ))
              ) : (
                <div className="text-muted text-center py-3">
                  No users available
                </div>
              )}
            </div>

            <Form.Text className="text-muted">
              {formData.recipients.length} recipient{formData.recipients.length !== 1 ? 's' : ''} selected
            </Form.Text>
          </Form.Group>

          {/* Publish Options */}
          <Form.Group className="mb-0">
            <Form.Check
              type="checkbox"
              id="publishImmediately"
              label="Publish immediately (otherwise save as draft)"
              checked={formData.publishImmediately}
              onChange={(e) => handleInputChange('publishImmediately', e.target.checked)}
              disabled={loading}
            />
          </Form.Group>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button 
          variant="secondary" 
          onClick={handleClose}
          disabled={loading}
          className="d-flex align-items-center"
        >
          <X size={16} className="me-1" />
          Cancel
        </Button>
        
        <Button 
          variant={formData.publishImmediately ? "success" : "primary"}
          onClick={handleSubmit}
          disabled={loading}
          className="d-flex align-items-center"
        >
          {loading ? (
            <>
              <div className="spinner-border spinner-border-sm me-2" />
              {formData.publishImmediately ? 'Publishing...' : 'Saving...'}
            </>
          ) : (
            <>
              <Save size={16} className="me-1" />
              {formData.publishImmediately ? 'Publish Notice' : 'Save as Draft'}
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CreateNoticeModal;