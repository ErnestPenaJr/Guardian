import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';
import { Upload, MessageSquare, Play, CheckCircle, FileText, Send } from 'lucide-react';
import './RequestModal.css';

interface User {
  USER_ID: number;
  EMAIL: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  FULL_NAME: string;
  COMPANY_ID: number;
  ROLE_NAMES: string;
}

interface Request {
  REQUEST_ID: number;
  REQUEST_NAME: string;
  STATUS: string;
  FORM_ID: number | null;
  REQUESTOR_ID: number | null;
  ASSIGNED_ID: number | null;
  SUBMITTED_DATE: string | null;
  CREATE_DATE: string | null;
  UPDATE_DATE: string | null;
  TRACKINGID: string | null;
  EXTERNAL_USER?: string | null;
  requestor?: {
    FIRST_NAME: string;
    LAST_NAME: string;
  };
  assigned?: {
    FIRST_NAME: string;
    LAST_NAME: string;
  };
  requestorName?: string;
  assignedName?: string;
}

interface FormFieldValue {
  fieldName: string;
  fieldValue: any;
}

interface Props {
  request: Request;
  show: boolean;
  onHide: () => void;
  onUpdate: () => void;
}

const RequestModal: React.FC<Props> = ({ request, show, onHide, onUpdate }) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [formFieldValues, setFormFieldValues] = useState<FormFieldValue[]>([]);
  const [formTemplate, setFormTemplate] = useState<any>(null);
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [isSavingForm, setIsSavingForm] = useState<boolean>(false);
  const [formHasChanges, setFormHasChanges] = useState<boolean>(false);
  
  // Work management state
  const [workActionLoading, setWorkActionLoading] = useState<boolean>(false);
  const [showWorkSection, setShowWorkSection] = useState<boolean>(false);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [feedbackFiles, setFeedbackFiles] = useState<File[]>([]);
  const [feedbackType, setFeedbackType] = useState<string>('update');
  const [activeWorkTab, setActiveWorkTab] = useState<'feedback' | 'files' | 'status'>('feedback');
  
  // Check if current user can assign requests (processor and above)
  const canAssignRequests = () => {
    if (!currentUser) {
      console.log('❌ canAssignRequests: No current user');
      return false;
    }
    
    console.log('🔍 canAssignRequests: Current user:', currentUser);
    console.log('🔍 canAssignRequests: User properties:', Object.keys(currentUser));
    
    // Role IDs that can assign requests: Admin(1), User(2), Manager(3), Super Admin(6)
    const assignmentRoles = [1, 2, 3, 6];
    
    // Check if user has roles array (from login API response)
    if (currentUser.roles && Array.isArray(currentUser.roles)) {
      console.log('🔍 canAssignRequests: Checking roles array:', currentUser.roles);
      const hasPermission = currentUser.roles.some((role: any) => {
        const roleId = role.id;
        console.log(`🔍 canAssignRequests: Checking role ID ${roleId} against assignment roles:`, assignmentRoles);
        return assignmentRoles.includes(roleId);
      });
      console.log('🔍 canAssignRequests: Has permission from roles array:', hasPermission);
      return hasPermission;
    }
    
    // Check roleIds array (from login API response)
    if (currentUser.roleIds && Array.isArray(currentUser.roleIds)) {
      console.log('🔍 canAssignRequests: Checking roleIds array:', currentUser.roleIds);
      const hasPermission = currentUser.roleIds.some((roleId: number) => 
        assignmentRoles.includes(roleId)
      );
      console.log('🔍 canAssignRequests: Has permission from roleIds array:', hasPermission);
      return hasPermission;
    }
    
    // Check single role (fallback)
    if (currentUser.role) {
      console.log('🔍 canAssignRequests: Checking single role:', currentUser.role);
      const roleId = parseInt(currentUser.role, 10);
      const hasPermission = assignmentRoles.includes(roleId);
      console.log('🔍 canAssignRequests: Has permission from single role:', hasPermission);
      return hasPermission;
    }
    
    // Check if user has an ID property (assume user with ID 1111 is admin for now)
    if (currentUser.id || currentUser.userId) {
      const userId = currentUser.id || currentUser.userId;
      console.log('🔍 canAssignRequests: Found user ID:', userId);
      // For now, allow all logged-in users to assign (temporary fix)
      console.log('⚠️ canAssignRequests: No role info found, allowing all logged-in users (temporary)');
      return true;
    }
    
    console.log('❌ canAssignRequests: No valid role or user information found');
    return false;
  };

  // Memoized permission check to prevent dropdown from disappearing
  const hasAssignPermission = useMemo(() => {
    const permission = canAssignRequests();
    console.log('🔒 Memoized permission check result:', permission);
    return permission;
  }, [currentUser]);
  
  // Check if current user is assigned to this request
  const isAssignedToCurrentUser = useMemo(() => {
    return currentUser && request.ASSIGNED_ID === (currentUser.userId || currentUser.id);
  }, [currentUser, request.ASSIGNED_ID]);
  
  // Check if current user is the requestor
  const isRequestorUser = useMemo(() => {
    return currentUser && request.REQUESTOR_ID === (currentUser.userId || currentUser.id);
  }, [currentUser, request.REQUESTOR_ID]);
  
  // Check if user can work on this request (assigned user or admin)
  const canWorkOnRequest = useMemo(() => {
    if (!currentUser) return false;
    
    // If user is assigned to the request
    if (isAssignedToCurrentUser) return true;
    
    // If user is admin/manager (roles 1, 3, 6)
    const workRoles = [1, 3, 6];
    if (currentUser.roles && Array.isArray(currentUser.roles)) {
      return currentUser.roles.some((role: any) => workRoles.includes(role.id));
    }
    if (currentUser.roleIds && Array.isArray(currentUser.roleIds)) {
      return currentUser.roleIds.some((roleId: number) => workRoles.includes(roleId));
    }
    
    return false;
  }, [currentUser, isAssignedToCurrentUser]);
  
  // Get status display text
  const getStatusText = (status: string) => {
    switch(status) {
      case 'P': return 'Pending';
      case 'A': return 'Active';
      case 'C': return 'Completed';
      default: return 'Unknown';
    }
  };
  
  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch(status) {
      case 'P': return 'badge bg-warning text-dark';
      case 'A': return 'badge bg-primary text-white';
      case 'C': return 'badge bg-success text-white';
      default: return 'badge bg-secondary text-white';
    }
  };

  // Get form type from form ID or request name
  const getFormType = () => {
    if (request.FORM_ID) {
      // Map specific form IDs to types
      const formTypeMap: Record<number, string> = {
        1: 'subject verification',
        2: 'financial verification', 
        3: 'address verification',
        4: 'employment verification',
        5: 'bank test',
        6: 'identity verification'
      };
      return formTypeMap[request.FORM_ID] || 'verification';
    }
    return request.REQUEST_NAME?.toLowerCase() || 'general';
  };

  // Load users and form data when modal opens
  useEffect(() => {
    console.log('🔄 useEffect triggered - show:', show, 'request.REQUEST_ID:', request.REQUEST_ID);
    if (show) {
      console.log('🔄 Modal opened, checking permissions...');
      console.log('🔄 Current user in useEffect:', currentUser);
      console.log('🔄 Has assignment permission:', hasAssignPermission);
      
      // Reset form change tracking
      setFormHasChanges(false);
      
      // Only fetch users if current user can assign requests
      if (hasAssignPermission) {
        console.log('✅ User has assignment permission, fetching users...');
        fetchUsers();
      } else {
        console.log('❌ User does not have assignment permission, skipping user fetch');
        console.log('❌ Current user details:', currentUser);
        console.log('❌ This means the assignment dropdown will be empty!');
      }
      // Always try to fetch form data
      fetchFormFieldValues();
    } else {
      console.log('🔄 Modal is not shown, skipping data fetch');
    }
  }, [show, request.REQUEST_ID, hasAssignPermission]);

  // Initialize selected user with currently assigned user
  useEffect(() => {
    if (request && request.ASSIGNED_ID) {
      setSelectedUser(request.ASSIGNED_ID.toString());
    } else {
      setSelectedUser('');
    }
  }, [request]);

  // Fetch users for assignment dropdown (only processors)
  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching users from /api/users...');
      const response = await api.get('/api/users');
      console.log('🔄 Raw API response:', response);
      const userData = response.data?.data || response.data;
      console.log('🔄 Extracted user data:', userData);
      
      if (Array.isArray(userData)) {
        console.log(`🔄 Processing ${userData.length} users for filtering...`);
        
        // Log first few users to see their structure
        if (userData.length > 0) {
          console.log('🔄 Sample user structure:', userData.slice(0, 2));
        }
        
        // Show all users for assignment (minimal filtering for debugging)
        // Users with role IDs 1,2,3,6 can assign to any user
        const allUsers = userData.filter((user: User) => {
          // Very basic validation - just check if user has an ID
          const hasId = user.USER_ID;
          const firstName = user.FIRST_NAME || 'No First Name';
          const lastName = user.LAST_NAME || 'No Last Name';
          console.log(`🔄 User ID: ${user.USER_ID}, Name: "${firstName} ${lastName}", Role: "${user.ROLE_NAMES}", Has ID: ${hasId}`);
          return hasId; // Only require USER_ID to exist
        });
        
        console.log(`🔄 Showing ${allUsers.length} users for assignment:`, allUsers.map(u => `${u.FIRST_NAME} ${u.LAST_NAME} (${u.ROLE_NAMES})`));
        
        // If no users after filtering, show all users as fallback for debugging
        if (allUsers.length === 0) {
          console.log('⚠️ No users passed filtering! Using all users as fallback...');
          setUsers(userData);
        } else {
          setUsers(allUsers);
        }
        
        console.log(`✅ Final user count in dropdown: ${allUsers.length > 0 ? allUsers.length : userData.length}`);
        console.log(`✅ Users set in state:`, allUsers.length > 0 ? allUsers : userData);
      } else {
        console.error('❌ User data is not an array:', userData);
      }
    } catch (err) {
      console.error('❌ Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch form field values for this request
  const fetchFormFieldValues = async () => {
    try {
      setFormLoading(true);
      console.log(`Fetching form data for request ${request.REQUEST_ID}, FORM_ID: ${request.FORM_ID}`);
      
      const response = await api.get(`/api/requests/${request.REQUEST_ID}/form`);
      console.log('=== FULL API RESPONSE ===');
      console.log('Status:', response.status);
      console.log('Success:', response.data?.success);
      console.log('Data exists:', !!response.data?.data);
      console.log('Full response:', JSON.stringify(response.data, null, 2));
      
      if (response.data && response.status === 200) {
        const formData = response.data;
        console.log('=== FORM DATA BREAKDOWN ===');
        console.log('Form info:', formData.form);
        console.log('Fields count:', formData.fields?.length || 0);
        console.log('Values object:', formData.values);
        console.log('Has existing data:', formData.hasExistingData);
        
        // Set form template information
        if (formData.form) {
          setFormTemplate({
            name: formData.form.FORM_NAME,
            description: formData.form.FORM_DESCRIPTION,
            id: formData.form.FORM_ID
          });
          console.log('✅ Set form template:', formData.form.FORM_NAME);
        } else {
          console.log('❌ No form template found in response');
          setFormTemplate(null);
        }
        
        // Convert form instance values to display format - ONLY show real database data
        const fieldValues: FormFieldValue[] = [];
        
        if (formData.fields && Array.isArray(formData.fields)) {
          console.log('=== PROCESSING FIELDS ===');
          formData.fields.forEach((field: any) => {
            // Get the actual value - try both field ID and field name as keys
            const valueByName = formData.values?.[field.FIELD_NAME];
            const valueById = formData.values?.[field.FIELD_ID];
            const value = valueByName || valueById;
            
            fieldValues.push({
              fieldName: field.FIELD_NAME,
              fieldValue: value && value.toString().trim() !== '' 
                ? value // Real database value from FORMS_INSTANCE_VALUES
                : '' // Empty string for unfilled fields
            });
            
            console.log(`Field: ${field.FIELD_NAME} (ID: ${field.FIELD_ID})`);
            console.log(`  Value by name: "${valueByName || 'EMPTY'}"`);
            console.log(`  Value by ID: "${valueById || 'EMPTY'}"`);
            console.log(`  Final value: "${value || 'EMPTY'}"`);
            console.log(`  Has Value: ${!!(value && value.toString().trim())}`);
          });
        } else {
          console.log('❌ No fields found in response');
        }
        
        setFormFieldValues(fieldValues);
        console.log('✅ Final processed field values:', fieldValues);
      } else {
        console.log('❌ API response not successful or no data');
        console.log('Response status:', response.status);
        console.log('Response data exists:', !!response.data);
        setFormTemplate(null);
        setFormFieldValues([]);
      }
    } catch (err) {
      console.error('Failed to load form field values:', err);
      // NO fallback data - only show real database data
      setFormTemplate(null);
      setFormFieldValues([]);
    } finally {
      setFormLoading(false);
    }
  };


  // Handle form field value changes
  const handleFieldValueChange = (fieldName: string, newValue: string) => {
    setFormFieldValues(prevValues => {
      const updatedValues = prevValues.map(field => 
        field.fieldName === fieldName 
          ? { ...field, fieldValue: newValue }
          : field
      );
      
      // Check if there are any changes from original values
      setFormHasChanges(true);
      
      return updatedValues;
    });
  };

  // Save form data to the server
  const handleSaveFormData = async () => {
    try {
      setIsSavingForm(true);
      
      // Prepare form data in the format the server expects
      const fieldValues = formFieldValues.reduce((acc, field) => {
        if (field.fieldValue && field.fieldValue.toString().trim() !== '') {
          acc[field.fieldName] = field.fieldValue;
        }
        return acc;
      }, {} as Record<string, string>);
      
      const submissionData = {
        fieldValues,
        isComplete: false, // Mark as draft/auto-save
        isDraft: true
      };
      
      console.log('Saving form data for request:', request.REQUEST_ID);
      console.log('Field values:', fieldValues);
      
      // Submit form data to the correct endpoint
      const response = await api.post(`/api/requests/${request.REQUEST_ID}/form/submit`, submissionData);
      
      if (response.status === 200 || response.status === 201) {
        console.log('✅ Form data saved successfully');
        setFormHasChanges(false);
        // Refresh the form data
        await fetchFormFieldValues();
      } else {
        console.error('❌ Failed to save form data:', response.status);
      }
    } catch (error) {
      console.error('❌ Error saving form data:', error);
    } finally {
      setIsSavingForm(false);
    }
  };

  // Handle user assignment
  const handleAssignUser = async () => {
    if (!selectedUser) return;
    
    try {
      setLoading(true);
      await api.put(`/api/requests/${request.REQUEST_ID}/assign`, { 
        assignedUserId: selectedUser
      });
      
      // Refresh and close
      setTimeout(() => {
        onUpdate();
        onHide();
      }, 100);
    } catch (err) {
      console.error('Failed to assign user:', err);
    } finally {
      setLoading(false);
    }
  };

  // Work action handlers
  const handleStartWork = async () => {
    try {
      setWorkActionLoading(true);
      console.log('🚀 Starting work on request:', request.REQUEST_ID);
      
      const response = await api.post(`/api/requests/${request.REQUEST_ID}/start`);
      
      if (response.data.success) {
        toast.success(`Started work on ${request.REQUEST_NAME}`);
        setShowWorkSection(true); // Show work management section
        onUpdate(); // Refresh parent component
      } else {
        toast.error('Failed to start work on request');
      }
    } catch (error: any) {
      console.error('Error starting work:', error);
      toast.error(error.response?.data?.error || 'Failed to start work');
    } finally {
      setWorkActionLoading(false);
    }
  };

  const handleCompleteWork = async () => {
    try {
      setWorkActionLoading(true);
      console.log('✅ Completing request:', request.REQUEST_ID);
      
      const response = await api.post(`/api/requests/${request.REQUEST_ID}/complete`, {
        completionNotes: feedbackText || 'Request completed'
      });
      
      if (response.data.success) {
        toast.success(`Completed ${request.REQUEST_NAME}`);
        onUpdate(); // Refresh parent component
        onHide(); // Close modal
      } else {
        toast.error('Failed to complete request');
      }
    } catch (error: any) {
      console.error('Error completing work:', error);
      toast.error(error.response?.data?.error || 'Failed to complete request');
    } finally {
      setWorkActionLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim() && feedbackFiles.length === 0) {
      toast.error('Please provide feedback text or upload files');
      return;
    }

    try {
      setWorkActionLoading(true);
      
      // Create form data for file uploads
      const formData = new FormData();
      formData.append('progressType', 'communication');
      formData.append('title', `${feedbackType.charAt(0).toUpperCase() + feedbackType.slice(1)} - Feedback`);
      formData.append('description', feedbackText);
      formData.append('isVisibleToRequestor', 'true');
      formData.append('hoursWorked', '0');
      
      // Add first file if any
      if (feedbackFiles.length > 0) {
        formData.append('attachment', feedbackFiles[0]);
      }
      
      const response = await api.post(`/api/requests/${request.REQUEST_ID}/progress`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data.success) {
        toast.success('Feedback submitted successfully!');
        setFeedbackText('');
        setFeedbackFiles([]);
        onUpdate(); // Refresh parent component
      } else {
        toast.error('Failed to submit feedback');
      }
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      toast.error(error.response?.data?.error || 'Failed to submit feedback');
    } finally {
      setWorkActionLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate file types and sizes
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/', 'application/pdf', 'text/', 'application/msword', 'application/vnd.openxmlformats'];
    
    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        toast.error(`File ${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      
      if (!allowedTypes.some(type => file.type.startsWith(type))) {
        toast.error(`File ${file.name} type is not allowed.`);
        return false;
      }
      
      return true;
    });
    
    setFeedbackFiles(prev => [...prev, ...validFiles]);
  };

  const removeFeedbackFile = (index: number) => {
    setFeedbackFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered className="request-modal-improved">
      <Modal.Header closeButton className="border-0 pb-2">
        <Modal.Title className="fw-semibold text-dark" style={{ fontSize: '1.1rem' }}>
          Request Details: {request.TRACKINGID || `REQ-${request.REQUEST_ID}`}
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="pt-3">
        {/* Main Info Grid - Compact Layout */}
        <div className="row mb-3">
          {/* Left Column */}
          <div className="col-6">
            <div className="mb-2">
              <div className="text-muted small fw-medium mb-1" style={{ fontSize: '0.75rem' }}>Request ID</div>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{request.TRACKINGID || `REQ-${request.REQUEST_ID}`}</div>
            </div>
            
            
            <div className="mb-2">
              <div className="text-muted small fw-medium mb-1" style={{ fontSize: '0.75rem' }}>Requestor</div>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{request.requestorName || 'Ernest Pena Jr'}</div>
            </div>
          </div>
          
          {/* Right Column */}
          <div className="col-6">
            
            <div className="mb-2">
              <div className="text-muted small fw-medium mb-1" style={{ fontSize: '0.75rem' }}>Date Submitted</div>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{formatDate(request.SUBMITTED_DATE || request.CREATE_DATE)}</div>
            </div>
            
            <div className="mb-2">
              <div className="text-muted small fw-medium mb-1" style={{ fontSize: '0.75rem' }}>Currently Assigned To</div>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{request.assignedName || 'Unassigned'}</div>
            </div>
            
            <div className="mb-2">
              <div className="text-muted small fw-medium mb-1" style={{ fontSize: '0.75rem' }}>Status</div>
              <div>
                <span className={getStatusBadgeClass(request.STATUS)} style={{ fontSize: '0.75rem' }}>
                  {getStatusText(request.STATUS)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Form Template Section - Compact */}
        {formTemplate && (
          <div className="border-top pt-3 mb-3">
            <div className="text-primary fw-semibold mb-1" style={{ fontSize: '1rem' }}>
              {formTemplate.name}
            </div>
            <div className="text-muted mb-2" style={{ fontSize: '0.85rem' }}>
              {formTemplate.description}
            </div>
          </div>
        )}

        {/* Form Field Values - Compact Layout */}
        {formLoading ? (
          <div className="text-center py-3">
            <div className="spinner-border spinner-border-sm text-primary" role="status">
              <span className="visually-hidden">Loading form data...</span>
            </div>
            <div className="mt-2 text-muted small">Loading form data...</div>
          </div>
        ) : formFieldValues.length > 0 ? (
          <div className="mb-3">
            {formFieldValues.map((field, index) => {
              const hasValue = field.fieldValue && field.fieldValue.toString().trim() !== '';
              const isRequired = field.fieldName.includes('*') || field.fieldName.includes('#');
              
              return (
                <div key={index} className="mb-2">
                  <label className="form-label fw-medium text-dark mb-1" style={{ fontSize: '0.85rem' }}>
                    {field.fieldName}
                    {isRequired && <span className="text-danger ms-1">*</span>}
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={field.fieldValue || ''}
                    placeholder={`Enter ${field.fieldName}`}
                    onChange={(e) => handleFieldValueChange(field.fieldName, e.target.value)}
                    style={{ 
                      backgroundColor: 'white',
                      color: '#212529',
                      fontSize: '0.85rem'
                    }}
                  />
                  {/* Compact status indicators */}
                  {hasValue && (
                    <div className="form-text text-success" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                      ✓ Value from database
                    </div>
                  )}
                  {!hasValue && (
                    <div className="form-text text-muted" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                      No value submitted yet
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : formTemplate ? (
          <div className="alert alert-info">
            <h6 className="alert-heading">Form Template Found</h6>
            <p className="mb-0">Template: <strong>{formTemplate.name}</strong></p>
            <p className="mb-0">Description: {formTemplate.description}</p>
            <hr className="my-2" />
            <small className="text-muted">No form fields found for this template. The form may not have been configured with fields yet.</small>
          </div>
        ) : (
          <div className="alert alert-warning">
            <h6 className="alert-heading">No Form Data Available</h6>
            <p className="mb-1">This request does not have an associated form template.</p>
            <hr className="my-2" />
            <small className="text-muted">
              Request ID: {request.REQUEST_ID}<br />
              Form ID: {request.FORM_ID || 'None'}<br />
              Check the browser console for detailed API response information.
            </small>
          </div>
        )}

        {/* Form Data Save Section */}
        {formFieldValues.length > 0 && (
          <div className="border-top pt-3 mt-3">
            <div className="d-flex gap-2 justify-content-between align-items-center mb-3">
              <div className="text-dark fw-semibold" style={{ fontSize: '0.9rem' }}>Form Data</div>
              <Button 
                variant="success" 
                onClick={handleSaveFormData}
                disabled={isSavingForm || !formHasChanges}
                size="sm"
                className="px-3"
                style={{ fontSize: '0.85rem' }}
              >
                {isSavingForm ? 'Saving...' : 'Save Form Data'}
              </Button>
            </div>
            {formHasChanges && (
              <div className="alert alert-warning py-2 mb-3" style={{ fontSize: '0.8rem' }}>
                <small>⚠️ You have unsaved changes to the form data.</small>
              </div>
            )}
          </div>
        )}

        {/* Work Management Section - Only show if user is assigned or can work on request */}
        {canWorkOnRequest && isAssignedToCurrentUser && (
          <div className="border-top pt-3 mt-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="text-dark fw-semibold" style={{ fontSize: '1rem' }}>
                Work Management
              </div>
              <div className="d-flex gap-2">
                {request.STATUS === 'P' && (
                  <Button 
                    variant="success" 
                    onClick={handleStartWork}
                    disabled={workActionLoading}
                    size="sm"
                    className="d-flex align-items-center"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <Play size={14} className="me-1" />
                    {workActionLoading ? 'Starting...' : 'Start Work'}
                  </Button>
                )}
                {request.STATUS === 'A' && (
                  <>
                    <Button 
                      variant="primary" 
                      onClick={() => setShowWorkSection(!showWorkSection)}
                      size="sm"
                      className="d-flex align-items-center"
                      style={{ fontSize: '0.85rem' }}
                    >
                      <MessageSquare size={14} className="me-1" />
                      {showWorkSection ? 'Hide' : 'Manage'} Work
                    </Button>
                    <Button 
                      variant="success" 
                      onClick={handleCompleteWork}
                      disabled={workActionLoading}
                      size="sm"
                      className="d-flex align-items-center"
                      style={{ fontSize: '0.85rem' }}
                    >
                      <CheckCircle size={14} className="me-1" />
                      {workActionLoading ? 'Completing...' : 'Complete Work'}
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            {/* Work Section Content */}
            {(showWorkSection || request.STATUS === 'P') && (
              <div className="bg-light rounded p-3">
                {/* Work Tabs */}
                <div className="d-flex mb-3 border-bottom">
                  <button
                    className={`btn btn-sm border-0 px-2 py-1 ${
                      activeWorkTab === 'feedback' ? 'text-primary border-bottom border-primary' : 'text-muted'
                    }`}
                    onClick={() => setActiveWorkTab('feedback')}
                  >
                    <MessageSquare size={14} className="me-1" />
                    Feedback
                  </button>
                  <button
                    className={`btn btn-sm border-0 px-2 py-1 ms-2 ${
                      activeWorkTab === 'files' ? 'text-primary border-bottom border-primary' : 'text-muted'
                    }`}
                    onClick={() => setActiveWorkTab('files')}
                  >
                    <FileText size={14} className="me-1" />
                    Files
                  </button>
                  <button
                    className={`btn btn-sm border-0 px-2 py-1 ms-2 ${
                      activeWorkTab === 'status' ? 'text-primary border-bottom border-primary' : 'text-muted'
                    }`}
                    onClick={() => setActiveWorkTab('status')}
                  >
                    <CheckCircle size={14} className="me-1" />
                    Status
                  </button>
                </div>
                
                {/* Feedback Tab */}
                {activeWorkTab === 'feedback' && (
                  <div>
                    <div className="mb-3">
                      <label className="form-label fw-medium" style={{ fontSize: '0.85rem' }}>
                        Feedback Type
                      </label>
                      <div className="d-flex gap-2 mb-3">
                        {[
                          { type: 'update', label: 'Update', color: 'primary', desc: 'Progress updates' },
                          { type: 'question', label: 'Question', color: 'warning', desc: 'Will notify requestor' },
                          { type: 'issue', label: 'Issue', color: 'danger', desc: 'Report problems' }
                        ].map(({ type, label, color, desc }) => (
                          <button
                            key={type}
                            className={`btn btn-sm ${
                              feedbackType === type ? `btn-${color}` : `btn-outline-${color}`
                            }`}
                            onClick={() => setFeedbackType(type)}
                            style={{ fontSize: '0.75rem' }}
                            title={desc}
                          >
                            {label}
                            {type === 'question' && feedbackType === type && (
                              <span className="d-block" style={{ fontSize: '0.6rem', opacity: 0.8 }}>
                                📧 Notifies requestor
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <label className="form-label fw-medium" style={{ fontSize: '0.85rem' }}>
                        Feedback Message
                      </label>
                      <textarea
                        className="form-control"
                        rows={4}
                        placeholder="Provide feedback, updates, or ask questions..."
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>
                    
                    {/* Question notification info */}
                    {feedbackType === 'question' && (
                      <div className="alert alert-info py-2 mb-3" style={{ fontSize: '0.8rem' }}>
                        📧 <strong>Question Mode:</strong> The requestor ({request.requestorName || 'Unknown'}) will receive an email notification and in-app alert that you have a question about their request.
                      </div>
                    )}
                    
                    <div className="d-flex justify-content-end">
                      <Button
                        variant={feedbackType === 'question' ? 'warning' : 'primary'}
                        onClick={handleSubmitFeedback}
                        disabled={workActionLoading || (!feedbackText.trim() && feedbackFiles.length === 0)}
                        size="sm"
                        className="d-flex align-items-center"
                        style={{ fontSize: '0.85rem' }}
                      >
                        <Send size={14} className="me-1" />
                        {workActionLoading ? 'Submitting...' : 
                         feedbackType === 'question' ? 'Send Question' : 'Submit Feedback'}
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Files Tab */}
                {activeWorkTab === 'files' && (
                  <div>
                    <div className="mb-3">
                      <label className="form-label fw-medium" style={{ fontSize: '0.85rem' }}>
                        Upload Supporting Files
                      </label>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="form-control"
                        accept="image/*,.pdf,.doc,.docx,.txt"
                        style={{ fontSize: '0.85rem' }}
                      />
                      <div className="form-text" style={{ fontSize: '0.75rem' }}>
                        Accepted: Images, PDF, Word, Text files (Max 10MB each)
                      </div>
                    </div>
                    
                    {feedbackFiles.length > 0 && (
                      <div>
                        <div className="fw-medium mb-2" style={{ fontSize: '0.85rem' }}>
                          Selected Files ({feedbackFiles.length})
                        </div>
                        {feedbackFiles.map((file, index) => (
                          <div key={index} className="d-flex justify-content-between align-items-center p-2 bg-white rounded border mb-2">
                            <div style={{ fontSize: '0.8rem' }}>
                              <div className="fw-medium">{file.name}</div>
                              <div className="text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                            </div>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeFeedbackFile(index)}
                              style={{ fontSize: '0.75rem' }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Status Tab */}
                {activeWorkTab === 'status' && (
                  <div>
                    <div className="mb-3">
                      <div className="fw-medium mb-2" style={{ fontSize: '0.85rem' }}>
                        Current Status: <span className={getStatusBadgeClass(request.STATUS)}>
                          {getStatusText(request.STATUS)}
                        </span>
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                        {request.STATUS === 'P' && 'Click "Start Work" to begin working on this request.'}
                        {request.STATUS === 'A' && 'You are currently working on this request. You can provide feedback or mark it as complete.'}
                        {request.STATUS === 'C' && 'This request has been completed.'}
                      </div>
                    </div>
                    
                    {request.STATUS === 'A' && (
                      <div className="d-flex justify-content-end">
                        <Button
                          variant="success"
                          onClick={handleCompleteWork}
                          disabled={workActionLoading}
                          size="sm"
                          className="d-flex align-items-center"
                          style={{ fontSize: '0.85rem' }}
                        >
                          <CheckCircle size={14} className="me-1" />
                          {workActionLoading ? 'Completing...' : 'Mark as Complete'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Requestor Response Section - Only show if user is the requestor */}
        {isRequestorUser && !isAssignedToCurrentUser && (
          <div className="border-top pt-3 mt-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="text-dark fw-semibold" style={{ fontSize: '1rem' }}>
                📝 Respond to Processor
              </div>
              <span className="badge bg-info" style={{ fontSize: '0.75rem' }}>
                Your Request
              </span>
            </div>
            
            <div className="bg-light rounded p-3">
              <div className="mb-3">
                <label className="form-label fw-medium" style={{ fontSize: '0.85rem' }}>
                  Response to Processor
                </label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Provide additional information, answer questions, or clarify details..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                />
                <div className="form-text" style={{ fontSize: '0.75rem' }}>
                  Your response will be sent to the assigned processor and may help speed up your request.
                </div>
              </div>
              
              {/* File upload for requestors */}
              <div className="mb-3">
                <label className="form-label fw-medium" style={{ fontSize: '0.85rem' }}>
                  Additional Documents
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="form-control"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  style={{ fontSize: '0.85rem' }}
                />
                <div className="form-text" style={{ fontSize: '0.75rem' }}>
                  Upload additional documents that may help with your request
                </div>
              </div>
              
              {/* Show selected files */}
              {feedbackFiles.length > 0 && (
                <div className="mb-3">
                  <div className="fw-medium mb-2" style={{ fontSize: '0.85rem' }}>
                    Selected Files ({feedbackFiles.length})
                  </div>
                  {feedbackFiles.map((file, index) => (
                    <div key={index} className="d-flex justify-content-between align-items-center p-2 bg-white rounded border mb-2">
                      <div style={{ fontSize: '0.8rem' }}>
                        <div className="fw-medium">{file.name}</div>
                        <div className="text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                      </div>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => removeFeedbackFile(index)}
                        style={{ fontSize: '0.75rem' }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="d-flex justify-content-end">
                <Button
                  variant="primary"
                  onClick={async () => {
                    // Use same feedback mechanism but with requestor context
                    const originalType = feedbackType;
                    setFeedbackType('update'); // Set as update from requestor
                    await handleSubmitFeedback();
                    setFeedbackType(originalType);
                  }}
                  disabled={workActionLoading || (!feedbackText.trim() && feedbackFiles.length === 0)}
                  size="sm"
                  className="d-flex align-items-center"
                  style={{ fontSize: '0.85rem' }}
                >
                  <Send size={14} className="me-1" />
                  {workActionLoading ? 'Sending...' : 'Send Response'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Assignment Section - Only show if user has permission */}
        {hasAssignPermission ? (
          <div className="border-top pt-3 mt-3">
            <div className="text-dark fw-semibold mb-2" style={{ fontSize: '0.9rem' }}>Assign Request</div>
            
            <Form.Select 
              value={selectedUser} 
              onChange={(e) => setSelectedUser(e.target.value)}
              disabled={loading}
              className="mb-3 form-select-sm"
              style={{ fontSize: '0.85rem' }}
            >
              <option value="">Select a processor to assign</option>
              {users.map((user) => (
                <option key={user.USER_ID} value={user.USER_ID}>
                  {user.FULL_NAME} ({user.ROLE_NAMES})
                </option>
              ))}
            </Form.Select>
            
            <div className="d-flex gap-2 justify-content-end">
              <Button 
                variant="outline-secondary" 
                onClick={onHide} 
                size="sm"
                className="px-3"
                style={{ fontSize: '0.85rem' }}
              >
                Close
              </Button>
              <Button 
                variant="primary" 
                onClick={handleAssignUser}
                disabled={!selectedUser || loading}
                size="sm"
                className="px-3"
                style={{ fontSize: '0.85rem' }}
              >
                {loading ? 'Assigning...' : 'Assign'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-top pt-3 mt-3">
            <div className="d-flex justify-content-end">
              <Button 
                variant="outline-secondary" 
                onClick={onHide} 
                size="sm"
                className="px-3"
                style={{ fontSize: '0.85rem' }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default RequestModal;