import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import formService, { DbForm } from '../services/formService';
import './RequestModal.css';

interface User {
  USER_ID: number;
  EMAIL: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  FULL_NAME: string;
  COMPANY_ID: number;
  ROLE_NAMES: string;
  value: number;
  label: string;
  subtitle: string;
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
  CREATE_USER_ID: number | null;
  UPDATE_USER_ID: number | null;
  TRACKINGID: string | null;
  EXTERNAL_USER?: string | null;
  FIRST_NAME?: string;
  LAST_NAME?: string;
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
  DESCRIPTION?: string;
  REQUEST_DESCRIPTION?: string;
  // Form information
  formName?: string;
  formDescription?: string;
}

interface Props {
  request: Request;
  show: boolean;
  onHide: () => void;
  onUpdate: () => void;
}

const RequestModal: React.FC<Props> = ({ request, show, onHide, onUpdate }) => {
  const { user: currentUser, loading: userLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [formInfo, setFormInfo] = useState<DbForm | null>(null);
  const [formLoading, setFormLoading] = useState<boolean>(false);
  
  // Format the status display
  const getStatusDisplay = (status: string) => {
    switch(status) {
      case 'P': return <div className="badge bg-primary">In Progress</div>;
      case 'A': return <div className="badge bg-success">Approved</div>;
      case 'R': return <div className="badge bg-danger">Rejected</div>;
      case 'C': return <div className="badge bg-secondary">Completed</div>;
      default: return <div className="badge bg-warning">Unknown</div>;
    }
  };
  
  // Load users for assignment and form information
  useEffect(() => {
    if (show && !userLoading && currentUser) {
      fetchUsers();
      if (request.FORM_ID) {
        fetchFormInfo(request.FORM_ID);
      }
    }
  }, [show, userLoading, currentUser, request.FORM_ID]);

  // Initialize selectedUser with currently assigned user when request changes
  useEffect(() => {
    if (request && request.ASSIGNED_ID) {
      console.log('[RequestModal] Setting selected user to:', request.ASSIGNED_ID);
      setSelectedUser(request.ASSIGNED_ID.toString());
    } else {
      console.log('[RequestModal] No assigned user found, clearing selection');
      setSelectedUser('');
    }
  }, [request]);
  
  // Get form name fallback based on common form IDs
  const getFormNameFallback = (formId: number): string => {
    const commonForms: Record<number, string> = {
      1: 'SUBJECT',
      2: 'FINANCIAL', 
      3: 'ADDRESS',
      4: 'EMPLOYMENT',
      5: 'MEDICAL',
      6: 'EDUCATION'
    };
    return commonForms[formId] || `Form #${formId}`;
  };
  
  // Fetch form information
  const fetchFormInfo = async (formId: number) => {
    try {
      setFormLoading(true);
      const response = await formService.getFormById(formId);
      setFormInfo(response.form);
    } catch (err) {
      console.error('Failed to load form information:', err);
      // Use fallback form name if API fails
      setFormInfo({
        FORM_ID: formId,
        FORM_NAME: getFormNameFallback(formId),
        FORM_DESCRIPTION: null,
        IS_PUBLIC: true,
        IS_ACTIVE: true,
        IS_DELETED: false
      });
    } finally {
      setFormLoading(false);
    }
  };
  
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Debug current user data
      console.log('RequestModal - Current user object:', currentUser);
      console.log('RequestModal - Current user companyId:', currentUser?.companyId);
      console.log('RequestModal - Current user company:', currentUser?.company);
      
      // Get current user's company ID - try both companyId and company fields
      const companyId = currentUser?.companyId || currentUser?.company;
      if (!companyId) {
        console.warn('No company ID found for current user, currentUser:', currentUser);
        setError('Unable to load users: Current user company not found');
        setUsers([]);
        return;
      }

      console.log(`Fetching users for company ID: ${companyId}`);
      
      // Fetch assignable users from the same company
      const response = await api.get(`/api/users`);
      console.log('Users response:', response.data);
      
      // Ensure we always set an array
      const userData = response.data;
      if (Array.isArray(userData)) {
        setUsers(userData);
      } else {
        console.warn('API response is not an array:', userData);
        setUsers([]);
      }
      
    } catch (err: any) {
      console.error('Failed to load company users:', err);
      setError('Failed to load users. Please try again.');
      setUsers([]); // Ensure users is always an array
    } finally {
      setLoading(false);
    }
  };
  
  const handleAssignUser = async () => {
    if (!selectedUser) {
      console.log('No user selected, cannot assign');
      return;
    }
    
    console.log('handleAssignUser called with selectedUser:', selectedUser);
    console.log('Current request state:', request);
    
    try {
      setLoading(true);
      setError(null);
      
      try {
        // Make the API call to assign the user
        console.log('Making API call to assign user:', selectedUser, 'to request:', request.REQUEST_ID);
        const response = await api.put(`/api/requests/${request.REQUEST_ID}/assign`, { 
          assignedUserId: selectedUser
        });
        console.log('User assignment API response:', response.data);
        
        // Find the assigned user (for logging purposes)
        const assignedUser = users.find(u => u.USER_ID === parseInt(selectedUser));
        console.log('Assigned user:', assignedUser ? 
          `${assignedUser.FIRST_NAME} ${assignedUser.LAST_NAME}` : 
          'Unknown user');
          
        // Refresh the requests list and close the modal
        console.log('Calling onUpdate callback to refresh request list');
        console.log('onUpdate type:', typeof onUpdate);
        
        // Call onUpdate with a small delay to ensure state updates are processed
        setTimeout(() => {
          console.log('Executing onUpdate callback after timeout');
          onUpdate();
          
          // Close the modal after the update
          console.log('Calling onHide to close the modal');
          onHide();
        }, 100);
      } catch (apiErr: any) {
        console.error('API error when assigning user:', apiErr);
        setError(apiErr.response?.data?.error || 'Failed to assign user. Please try again.');
      }
    } catch (err: any) {
      console.error('Failed to assign user:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Modal show={show} onHide={onHide} size="lg" centered dialogClassName="request-modal-improved">
      <Modal.Header closeButton className="border-bottom">
        <Modal.Title className="d-flex align-items-center w-100">
          <div className="d-flex align-items-center flex-grow-1">
            <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" 
                 style={{ width: '40px', height: '40px', fontSize: '18px' }}>
              📋
            </div>
            <div>
              <h5 className="mb-1 fw-bold">{request.REQUEST_NAME}</h5>
              <small className="text-muted">{request.TRACKINGID || `REQ-${request.REQUEST_ID}`}</small>
            </div>
          </div>
          <div className="ms-auto">
            {getStatusDisplay(request.STATUS)}
          </div>
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="p-3">
        {error && (
          <Alert variant="danger" className="mb-3">
            <span className="me-2">⚠️</span>
            {error}
          </Alert>
        )}
        
        {/* Request Details Section */}
        <div className="mb-4">
          <h6 className="mb-3 d-flex align-items-center text-primary">
            <span className="me-2">ℹ️</span>
            Request Details
          </h6>
          
          {/* Compact Information Cards */}
          <div className="row g-2 mb-3">
            {/* Form Type Card - Featured */}
            <div className="col-12 mb-2">
              <div className="card border-0 bg-light h-100">
                <div className="card-body p-3">
                  {formLoading ? (
                    <div className="d-flex align-items-center">
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      <span className="text-muted">Loading form information...</span>
                    </div>
                  ) : formInfo && formInfo.FORM_NAME ? (
                    <>
                      <div className="fw-bold text-dark h6 mb-2">{formInfo.FORM_NAME} Template</div>
                      {formInfo.FORM_DESCRIPTION && (
                        <div className="text-primary fw-medium">
                          {formInfo.FORM_DESCRIPTION}
                        </div>
                      )}
                    </>
                  ) : request.FORM_ID ? (
                    <>
                      <div className="fw-bold text-dark h6 mb-2">Form #{request.FORM_ID} Template</div>
                      <div className="text-muted">Form details not available</div>
                    </>
                  ) : (
                    <>
                      <div className="fw-bold text-muted h6 mb-2">No Form Template</div>
                      <div className="text-muted">No form assigned to this request</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Secondary Information Cards */}
          <div className="row g-2 mb-3">
            {/* Request ID Card */}
            <div className="col-6 col-md-3">
              <div className="card border-0 bg-light h-100">
                <div className="card-body p-2">
                  <div className="d-flex align-items-center">
                    <div className="bg-primary text-white rounded-circle me-2 d-flex align-items-center justify-content-center" 
                         style={{ width: '24px', height: '24px', fontSize: '12px' }}>📋</div>
                    <div className="flex-fill">
                      <div className="text-muted small fw-bold mb-1">ID</div>
                      <div className="fw-bold text-dark">{request.REQUEST_ID}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Status Card */}
            <div className="col-6 col-md-3">
              <div className="card border-0 bg-light h-100">
                <div className="card-body p-2">
                  <div className="d-flex align-items-center">
                    <div className="bg-info text-white rounded-circle me-2 d-flex align-items-center justify-content-center" 
                         style={{ width: '24px', height: '24px', fontSize: '12px' }}>📊</div>
                    <div className="flex-fill">
                      <div className="text-muted small fw-bold mb-1">STATUS</div>
                      <div>{getStatusDisplay(request.STATUS)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Created Date Card */}
            <div className="col-6 col-md-3">
              <div className="card border-0 bg-light h-100">
                <div className="card-body p-2">
                  <div className="d-flex align-items-center">
                    <div className="bg-success text-white rounded-circle me-2 d-flex align-items-center justify-content-center" 
                         style={{ width: '24px', height: '24px', fontSize: '12px' }}>📅</div>
                    <div className="flex-fill">
                      <div className="text-muted small fw-bold mb-1">CREATED</div>
                      <div className="fw-bold text-dark small">
                        {request.CREATE_DATE ? (
                          <>
                            <div>{new Date(request.CREATE_DATE).toLocaleDateString('en-US', {
                              month: 'short', 
                              day: 'numeric'
                            })}</div>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                              {new Date(request.CREATE_DATE).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </>
                        ) : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Last Updated Card */}
            <div className="col-6 col-md-3">
              <div className="card border-0 bg-light h-100">
                <div className="card-body p-2">
                  <div className="d-flex align-items-center">
                    <div className="bg-warning text-white rounded-circle me-2 d-flex align-items-center justify-content-center" 
                         style={{ width: '24px', height: '24px', fontSize: '12px' }}>🔄</div>
                    <div className="flex-fill">
                      <div className="text-muted small fw-bold mb-1">UPDATED</div>
                      <div className="fw-bold text-dark small">
                        {request.UPDATE_DATE ? (
                          <>
                            <div>{new Date(request.UPDATE_DATE).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}</div>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                              {new Date(request.UPDATE_DATE).toLocaleTimeString('en-US', {
                                hour: '2-digit', 
                                minute: '2-digit'
                              })}
                            </div>
                          </>
                        ) : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Requestor Information */}
          <div className="mb-3">
            <div className="card border-0 bg-light">
              <div className="card-body p-3">
                <div className="d-flex align-items-center">
                  <div className="bg-primary text-white rounded-circle me-3 d-flex align-items-center justify-content-center" 
                       style={{ width: '40px', height: '40px', fontSize: '16px' }}>👤</div>
                  <div className="flex-fill">
                    <div className="text-muted small fw-bold mb-1">REQUESTOR</div>
                    <div className="fw-bold text-dark h6 mb-0">{request.requestorName || 'N/A'}</div>
                    {request.EXTERNAL_USER && (
                      <div className="text-muted small">External User: {request.EXTERNAL_USER}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Description */}
          <div className="mb-3">
            <div className="card border-0 bg-light">
              <div className="card-body p-3">
                <div className="d-flex align-items-start">
                  <div className="bg-secondary text-white rounded-circle me-3 d-flex align-items-center justify-content-center flex-shrink-0" 
                       style={{ width: '32px', height: '32px', fontSize: '14px' }}>📝</div>
                  <div className="flex-fill">
                    <div className="text-muted small fw-bold mb-2">DESCRIPTION</div>
                    <div className="text-dark">
                      {request.DESCRIPTION || request.REQUEST_DESCRIPTION || (
                        <span className="text-muted fst-italic">No description provided for this request.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Assignment Section */}
        <div>
          <h6 className="mb-3 d-flex align-items-center text-success">
            <span className="me-2">👥</span>
            Assignment
          </h6>
          
          {/* Current Assignment */}
          <div className="mb-3">
            <div className="card border-0 bg-light">
              <div className="card-body p-3">
                <div className="d-flex align-items-center">
                  {request.assignedName ? (
                    <>
                      <div className="bg-success text-white rounded-circle d-flex align-items-center justify-content-center me-3" 
                           style={{ width: '40px', height: '40px', fontSize: '14px' }}>
                        {request.assignedName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-fill">
                        <div className="text-muted small fw-bold mb-1">CURRENTLY ASSIGNED TO</div>
                        <div className="fw-bold text-dark h6 mb-0">{request.assignedName}</div>
                        <small className="text-muted">Assigned User</small>
                      </div>
                      <div className="badge bg-success ms-2">
                        <span className="me-1">✓</span>Assigned
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-warning text-white rounded-circle d-flex align-items-center justify-content-center me-3" 
                           style={{ width: '40px', height: '40px', fontSize: '16px' }}>⚠️</div>
                      <div className="flex-fill">
                        <div className="text-muted small fw-bold mb-1">ASSIGNMENT STATUS</div>
                        <div className="fw-bold text-warning h6 mb-0">Unassigned</div>
                        <small className="text-muted">No user currently assigned</small>
                      </div>
                      <div className="badge bg-warning text-dark ms-2">
                        <span className="me-1">⚠️</span>Pending
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Assignment Form */}
          <div className="card border-0 bg-light">
            <div className="card-body p-3">
              <div className="d-flex align-items-center mb-3">
                <div className="bg-primary text-white rounded-circle me-3 d-flex align-items-center justify-content-center" 
                     style={{ width: '32px', height: '32px', fontSize: '14px' }}>🔄</div>
                <div>
                  <div className="text-muted small fw-bold mb-1">REASSIGN REQUEST</div>
                  <div className="text-dark fw-semibold">Select a new assignee</div>
                </div>
              </div>
              
              <Form.Select 
                value={selectedUser} 
                onChange={(e) => setSelectedUser(e.target.value)}
                disabled={loading || userLoading}
                className="form-select mb-3"
                size="sm"
              >
                <option value="">
                  {userLoading ? 'Loading user data...' : 
                   loading ? 'Loading users...' : 
                   'Select a user to assign'}
                </option>
                {Array.isArray(users) && users.map((user, index) => (
                  <option key={user.USER_ID || `user-${index}`} value={user.USER_ID}>
                    {user.FULL_NAME} ({user.ROLE_NAMES})
                  </option>
                ))}
              </Form.Select>
              
              <Button 
                variant="success" 
                onClick={handleAssignUser}
                disabled={!selectedUser || loading}
                className="w-100"
                size="sm"
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Assigning Request...
                  </>
                ) : (
                  <>
                    <span className="me-2">✅</span>
                    Assign to Selected User
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Modal.Body>
      
      <Modal.Footer className="border-top">
        <Button variant="outline-secondary" onClick={onHide}>
          <span className="me-2">✖️</span>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RequestModal;
