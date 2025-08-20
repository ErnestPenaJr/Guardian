import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { Save, X, Users, FileText, Bell, AlertTriangle, Clock, Settings } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import noticeService from '../services/noticeService';
import ContactGroupsManager from './ContactGroupsManager';

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

interface ContactGroup {
  CONTACT_GROUP_ID: number;
  GROUP_NAME: string;
  GROUP_DESCRIPTION: string | null;
  GROUP_TYPE: string;
  MEMBER_COUNT: number;
  GROUP_COLOR: string | null;
  GROUP_ICON: string | null;
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
    priorityLevel: 'MEDIUM',
    dueDate: '',
    recipients: [] as number[],
    contactGroups: [] as number[],
    publishImmediately: false
  });
  
  // Recipient selection mode
  const [recipientMode, setRecipientMode] = useState<'individual' | 'groups'>('individual');
  
  // Modal state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [showGroupsManager, setShowGroupsManager] = useState(false);
  
  // Notice types
  const noticeTypes = [
    { value: 'GENERAL', label: 'General Announcement', icon: <Bell size={16} /> },
    { value: 'URGENT', label: 'Urgent Notice', icon: <AlertTriangle size={16} /> },
    { value: 'POLICY', label: 'Policy Update', icon: <FileText size={16} /> },
    { value: 'MAINTENANCE', label: 'Maintenance Notice', icon: <FileText size={16} /> },
    { value: 'TRAINING', label: 'Training Announcement', icon: <Users size={16} /> }
  ];

  // Priority levels
  const priorityLevels = [
    { value: 'HIGH', label: 'High Priority', icon: <AlertTriangle size={16} className="text-danger" />, color: 'text-danger' },
    { value: 'MEDIUM', label: 'Medium Priority', icon: <Bell size={16} className="text-warning" />, color: 'text-warning' },
    { value: 'LOW', label: 'Low Priority', icon: <Clock size={16} className="text-info" />, color: 'text-info' }
  ];

  // Load users and contact groups when modal opens
  useEffect(() => {
    if (show) {
      loadUsers();
      loadContactGroups();
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

  const loadContactGroups = async () => {
    try {
      setLoadingGroups(true);
      const response = await fetch('/api/contact-groups', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const groupsData = await response.json();
        setContactGroups(groupsData.filter((group: ContactGroup) => group.GROUP_STATUS === 'ACTIVE'));
      } else {
        console.error('Failed to load contact groups');
      }
    } catch (error) {
      console.error('Error loading contact groups:', error);
    } finally {
      setLoadingGroups(false);
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

  const handleContactGroupToggle = (groupId: number) => {
    setFormData(prev => ({
      ...prev,
      contactGroups: prev.contactGroups.includes(groupId)
        ? prev.contactGroups.filter(id => id !== groupId)
        : [...prev.contactGroups, groupId]
    }));
  };

  const selectAllGroups = () => {
    setFormData(prev => ({
      ...prev,
      contactGroups: contactGroups.map(g => g.CONTACT_GROUP_ID)
    }));
  };

  const clearAllGroups = () => {
    setFormData(prev => ({
      ...prev,
      contactGroups: []
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
    
    if (recipientMode === 'individual' && formData.recipients.length === 0) {
      return 'At least one recipient must be selected';
    }
    
    if (recipientMode === 'groups' && formData.contactGroups.length === 0) {
      return 'At least one contact group must be selected';
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
        priorityLevel: formData.priorityLevel,
        dueDate: formData.dueDate || null,
        recipients: recipientMode === 'individual' ? formData.recipients : [],
        contactGroups: recipientMode === 'groups' ? formData.contactGroups : [],
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
        priorityLevel: 'MEDIUM',
        dueDate: '',
        recipients: [],
        contactGroups: [],
        publishImmediately: false
      });
      setRecipientMode('individual');

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
        priorityLevel: 'MEDIUM',
        dueDate: '',
        recipients: [],
        contactGroups: [],
        publishImmediately: false
      });
      setRecipientMode('individual');
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

          {/* Priority Level and Due Date Row */}
          <div className="row mb-3">
            <div className="col-md-6">
              <Form.Group>
                <Form.Label className="fw-medium">Priority Level</Form.Label>
                <Form.Select
                  value={formData.priorityLevel}
                  onChange={(e) => handleInputChange('priorityLevel', e.target.value)}
                  disabled={loading}
                >
                  {priorityLevels.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group>
                <Form.Label className="fw-medium">Due Date (Optional)</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  disabled={loading}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <Form.Text className="text-muted">
                  Leave empty for notices without deadlines
                </Form.Text>
              </Form.Group>
            </div>
          </div>

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
              <div className="d-flex align-items-center gap-2">
                {/* Recipient Mode Toggle */}
                <div className="btn-group" role="group">
                  <input 
                    type="radio" 
                    className="btn-check" 
                    name="recipientMode" 
                    id="individual" 
                    value="individual"
                    checked={recipientMode === 'individual'}
                    onChange={(e) => setRecipientMode('individual')}
                    disabled={loading}
                  />
                  <label className="btn btn-outline-primary btn-sm" htmlFor="individual">
                    <Users size={14} className="me-1" />
                    Individual
                  </label>
                  
                  <input 
                    type="radio" 
                    className="btn-check" 
                    name="recipientMode" 
                    id="groups" 
                    value="groups"
                    checked={recipientMode === 'groups'}
                    onChange={(e) => setRecipientMode('groups')}
                    disabled={loading}
                  />
                  <label className="btn btn-outline-primary btn-sm" htmlFor="groups">
                    <Users size={14} className="me-1" />
                    Groups
                  </label>
                </div>
              </div>
            </Form.Label>

            {recipientMode === 'individual' ? (
              <>
                <div className="d-flex justify-content-end mb-2">
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
              </>
            ) : (
              <>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={selectAllGroups}
                      disabled={loading || loadingGroups}
                      className="p-0 me-2"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={clearAllGroups}
                      disabled={loading || loadingGroups}
                      className="p-0"
                    >
                      Clear All
                    </Button>
                  </div>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => setShowGroupsManager(true)}
                    disabled={loading}
                    className="d-flex align-items-center"
                  >
                    <Settings size={14} className="me-1" />
                    Manage Groups
                  </Button>
                </div>
                
                <div 
                  className="border rounded p-3"
                  style={{ maxHeight: '200px', overflowY: 'auto' }}
                >
                  {loadingGroups ? (
                    <div className="text-center py-3">
                      <div className="spinner-border spinner-border-sm me-2" />
                      Loading contact groups...
                    </div>
                  ) : contactGroups.length > 0 ? (
                    contactGroups.map((group) => (
                      <Form.Check
                        key={group.CONTACT_GROUP_ID}
                        type="checkbox"
                        id={`group-${group.CONTACT_GROUP_ID}`}
                        label={
                          <div className="d-flex align-items-center">
                            <div 
                              className="me-2 rounded-circle d-flex align-items-center justify-content-center"
                              style={{ 
                                width: '20px', 
                                height: '20px', 
                                backgroundColor: group.GROUP_COLOR || '#007bff',
                                color: 'white',
                                fontSize: '10px'
                              }}
                            >
                              <Users size={10} />
                            </div>
                            <div>
                              <span className="fw-medium">{group.GROUP_NAME}</span>
                              <span className="text-muted ms-2">({group.MEMBER_COUNT} members)</span>
                              {group.GROUP_DESCRIPTION && (
                                <div className="small text-muted">{group.GROUP_DESCRIPTION}</div>
                              )}
                            </div>
                          </div>
                        }
                        checked={formData.contactGroups.includes(group.CONTACT_GROUP_ID)}
                        onChange={() => handleContactGroupToggle(group.CONTACT_GROUP_ID)}
                        disabled={loading}
                        className="mb-2"
                      />
                    ))
                  ) : (
                    <div className="text-muted text-center py-3">
                      <Users size={24} className="mb-2" />
                      <div>No contact groups available</div>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => setShowGroupsManager(true)}
                        className="mt-2 d-flex align-items-center mx-auto"
                      >
                        <Settings size={14} className="me-1" />
                        Create Contact Groups
                      </Button>
                    </div>
                  )}
                </div>

                <Form.Text className="text-muted">
                  {formData.contactGroups.length} group{formData.contactGroups.length !== 1 ? 's' : ''} selected
                  {formData.contactGroups.length > 0 && (
                    <span className="ms-2">
                      ({contactGroups
                        .filter(g => formData.contactGroups.includes(g.CONTACT_GROUP_ID))
                        .reduce((total, group) => total + group.MEMBER_COUNT, 0)} total recipients)
                    </span>
                  )}
                </Form.Text>
              </>
            )}
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
      
      {/* Contact Groups Manager Modal */}
      <ContactGroupsManager
        show={showGroupsManager}
        onHide={() => {
          setShowGroupsManager(false);
          // Reload contact groups when manager is closed
          loadContactGroups();
        }}
      />
    </Modal>
  );
};

export default CreateNoticeModal;