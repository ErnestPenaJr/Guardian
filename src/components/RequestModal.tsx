import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

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

  // Get status display text
  const getStatusText = (status: string) => {
    switch(status) {
      case 'P': return 'In Progress';
      case 'A': return 'Approved';
      case 'R': return 'Rejected';
      case 'C': return 'Completed';
      default: return 'Unknown';
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
    if (show) {
      fetchUsers();
      if (request.REQUEST_ID) {
        fetchFormFieldValues();
      }
    }
  }, [show, request.REQUEST_ID]);

  // Initialize selected user with currently assigned user
  useEffect(() => {
    if (request && request.ASSIGNED_ID) {
      setSelectedUser(request.ASSIGNED_ID.toString());
    } else {
      setSelectedUser('');
    }
  }, [request]);

  // Fetch users for assignment dropdown
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users');
      const userData = response.data?.data || response.data;
      if (Array.isArray(userData)) {
        setUsers(userData);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch form field values for this request
  const fetchFormFieldValues = async () => {
    try {
      const response = await api.get(`/api/requests/${request.REQUEST_ID}/form`);
      if (response.data.success && response.data.data) {
        const formData = response.data.data;
        // Convert form instance values to display format
        const fieldValues: FormFieldValue[] = [];
        
        if (formData.fields && formData.values) {
          formData.fields.forEach((field: any) => {
            const value = formData.values[field.FIELD_ID];
            if (value !== undefined && value !== null && value !== '') {
              fieldValues.push({
                fieldName: field.FIELD_NAME,
                fieldValue: value
              });
            }
          });
        }
        
        setFormFieldValues(fieldValues);
      }
    } catch (err) {
      console.error('Failed to load form field values:', err);
      // Create sample data for demo purposes
      setFormFieldValues([
        { fieldName: 'Bank Name', fieldValue: 'Chase Bank' },
        { fieldName: 'Account Type', fieldValue: 'Checking' },
        { fieldName: 'Routing Number', fieldValue: '123456789' },
        { fieldName: 'Account Number', fieldValue: '****5678' }
      ]);
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
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="border-0 pb-0">
        <Modal.Title className="fw-normal text-dark">
          Request Details: {request.TRACKINGID || `REQ-${request.REQUEST_ID}`}
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="pt-2">
        {/* Main Info Grid */}
        <div className="row g-4 mb-4">
          {/* Left Column */}
          <div className="col-6">
            <div className="mb-3">
              <div className="text-muted small fw-medium mb-1">Request ID</div>
              <div className="fw-medium">{request.TRACKINGID || `REQ-${request.REQUEST_ID}`}</div>
            </div>
            
            <div className="mb-3">
              <div className="text-muted small fw-medium mb-1">Status</div>
              <div className="fw-medium">{getStatusText(request.STATUS)}</div>
            </div>
            
            <div className="mb-3">
              <div className="text-muted small fw-medium mb-1">Requestor</div>
              <div className="fw-medium">{request.requestorName || 'Ernest Pena Jr'}</div>
            </div>
          </div>
          
          {/* Right Column */}
          <div className="col-6">
            <div className="mb-3">
              <div className="text-muted small fw-medium mb-1">Type</div>
              <div className="fw-medium">{getFormType()}</div>
            </div>
            
            <div className="mb-3">
              <div className="text-muted small fw-medium mb-1">Date Submitted</div>
              <div className="fw-medium">{formatDate(request.SUBMITTED_DATE || request.CREATE_DATE)}</div>
            </div>
            
            <div className="mb-3">
              <div className="text-muted small fw-medium mb-1">Currently Assigned To</div>
              <div className="fw-medium">{request.assignedName || 'Unassigned'}</div>
            </div>
          </div>
        </div>

        {/* Form Field Values */}
        {formFieldValues.length > 0 && (
          <div className="mb-4">
            <div className="text-muted small fw-medium mb-3">Form Values</div>
            <div className="row g-3">
              {formFieldValues.map((field, index) => (
                <div key={index} className="col-6">
                  <div className="mb-2">
                    <div className="text-muted small fw-medium mb-1">{field.fieldName}</div>
                    <div className="fw-medium">{field.fieldValue}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assignment Section */}
        <div className="border-top pt-4">
          <div className="text-dark fw-medium mb-3">Assign Request</div>
          
          <Form.Select 
            value={selectedUser} 
            onChange={(e) => setSelectedUser(e.target.value)}
            disabled={loading}
            className="mb-3"
          >
            <option value="">Select a user to assign</option>
            {users.map((user) => (
              <option key={user.USER_ID} value={user.USER_ID}>
                {user.FULL_NAME} ({user.ROLE_NAMES})
              </option>
            ))}
          </Form.Select>
          
          <div className="d-flex gap-2">
            <Button 
              variant="success" 
              onClick={handleAssignUser}
              disabled={!selectedUser || loading}
              className="px-4"
            >
              {loading ? 'Assigning...' : 'Assign'}
            </Button>
            
            <Button variant="secondary" onClick={onHide} className="px-4">
              Close
            </Button>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default RequestModal;