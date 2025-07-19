import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
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
  
  // Load users for assignment
  useEffect(() => {
    if (show && !userLoading && currentUser) {
      fetchUsers();
    }
  }, [show, userLoading, currentUser]);
  
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
      const response = await api.get(`/api/users/assignable`);
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
    <Modal show={show} onHide={onHide} size="lg" centered dialogClassName="request-modal">
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="me-2">📋</span>
          Request Details - {request.TRACKINGID || `REQ-${request.REQUEST_ID}`}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-2">
        {error && (
          <Alert variant="danger" className="mb-2">
            <span className="me-2">⚠️</span>
            {error}
          </Alert>
        )}
        
        <div className="container-fluid px-0">
          <div className="row mx-0 g-1">
            <div className="col-lg-6 mb-2">
              <div className="card shadow-sm request-card">
                <div className="card-header bg-light py-1">
                  <span className="me-2">📄</span>
                  <strong>Request Information</strong>
                </div>
                <div className="card-body p-2">
                  <div className="mb-2">
                    <div className="fw-bold">Request ID</div>
                    <div>{request.REQUEST_ID}</div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="fw-bold">Tracking ID</div>
                    <div>{request.TRACKINGID || `REQ-${request.REQUEST_ID}`}</div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="fw-bold">Request Name</div>
                    <div>{request.REQUEST_NAME}</div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="fw-bold">Status</div>
                    <div>{getStatusDisplay(request.STATUS)}</div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="fw-bold">Created</div>
                    <div>{request.CREATE_DATE ? new Date(request.CREATE_DATE).toLocaleString() : 'N/A'}</div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="fw-bold">Updated</div>
                    <div>{request.UPDATE_DATE ? new Date(request.UPDATE_DATE).toLocaleString() : 'N/A'}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="col-lg-5 mb-3">
              <div className="card shadow-sm request-card">
                <div className="card-header bg-light py-2">
                  <span className="me-2">👤</span>
                  <strong>User Information</strong>
                </div>
                <div className="card-body">
                  <div className="mb-2">
                    <div className="fw-bold">Requestor</div>
                    <div>{request.requestorName || 'N/A'}</div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="fw-bold">Assigned To</div>
                    <div className={request.assignedName ? '' : 'text-warning'}>
                      {request.assignedName || 'Unassigned'}
                    </div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="fw-bold">External User</div>
                    <div>N</div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="fw-bold mb-2">Assign to User</div>
                    <div className="dropdown">
                      <Form.Select 
                        value={selectedUser} 
                        onChange={(e) => setSelectedUser(e.target.value)}
                        disabled={loading || userLoading}
                        className="form-select"
                      >
                        <option value="">
                          {userLoading ? 'Loading user data...' : 
                           loading ? 'Loading users...' : 
                           'Select a user'}
                        </option>
                        {Array.isArray(users) && users.map((user, index) => (
                          <option key={user.USER_ID || `user-${index}`} value={user.USER_ID}>
                            {user.FULL_NAME} ({user.ROLE_NAMES})
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="row mx-0">
            <div className="col-12">
              <div className="card shadow-sm request-card">
                <div className="card-header bg-light py-2">
                  <span className="me-2">📝</span>
                  <strong>Request Description</strong>
                </div>
                <div className="card-body">
                  <p>{request.DESCRIPTION || 'No description available.'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
        <Button 
          variant="primary" 
          onClick={handleAssignUser}
          disabled={!selectedUser || loading}
        >
          Assign User
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RequestModal;
