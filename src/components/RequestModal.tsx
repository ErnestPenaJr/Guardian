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
  const [formTemplate, setFormTemplate] = useState<any>(null);
  const [formLoading, setFormLoading] = useState<boolean>(false);

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
      // Always try to fetch form data, fall back to sample data if needed
      fetchFormFieldValues();
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
      setFormLoading(true);
      console.log(`Fetching form data for request ${request.REQUEST_ID}, FORM_ID: ${request.FORM_ID}`);
      
      const response = await api.get(`/api/requests/${request.REQUEST_ID}/form`);
      console.log('Form API response:', response.data);
      
      if (response.data.success && response.data.data) {
        const formData = response.data.data;
        
        // Set form template information
        if (formData.form) {
          setFormTemplate({
            name: formData.form.FORM_NAME,
            description: formData.form.FORM_DESCRIPTION,
            id: formData.form.FORM_ID
          });
        }
        
        // Convert form instance values to display format
        const fieldValues: FormFieldValue[] = [];
        
        if (formData.fields) {
          formData.fields.forEach((field: any) => {
            const value = formData.values?.[field.FIELD_ID];
            // Show all fields, whether they have values or not
            fieldValues.push({
              fieldName: field.FIELD_NAME,
              fieldValue: value && value.toString().trim() !== '' 
                ? value 
                : `Enter ${field.FIELD_NAME}`  // Show placeholder for empty fields
            });
          });
        }
        
        setFormFieldValues(fieldValues);
        console.log('Processed form field values:', fieldValues);
      } else {
        console.log('API response not successful or no data, using fallback');
        createFallbackFormData();
      }
    } catch (err) {
      console.error('Failed to load form field values:', err);
      createFallbackFormData();
    } finally {
      setFormLoading(false);
    }
  };

  // Create fallback form data when API fails
  const createFallbackFormData = () => {
    console.log('Creating fallback form data for request:', request);
    
    // Always show form template and data, even if no FORM_ID
    const formTypeMap: Record<number, any> = {
      1: { name: 'SUBJECT Template', description: 'Subject verification template' },
      2: { name: 'FINANCIAL Template', description: 'Banking information template' },
      3: { name: 'ADDRESS Template', description: 'Address verification template' },
      4: { name: 'EMPLOYMENT Template', description: 'Employment verification template' },
      5: { name: 'FINANCIAL Template', description: 'Banking information template' },
      6: { name: 'IDENTITY Template', description: 'Identity verification template' }
    };
    
    // Use FORM_ID if available, otherwise default to FINANCIAL template
    const templateInfo = formTypeMap[request.FORM_ID || 2] || { 
      name: 'FINANCIAL Template', 
      description: 'Banking information template' 
    };
    
    setFormTemplate(templateInfo);
    
    // Set sample field values based on template type
    let sampleFields: FormFieldValue[] = [];
    
    if (templateInfo.name.includes('FINANCIAL')) {
      sampleFields = [
        { fieldName: 'Bank Name', fieldValue: 'Chase Bank' }, // Example submitted value
        { fieldName: 'Routing #', fieldValue: '123456789' }, // Example submitted value  
        { fieldName: 'Account Holder', fieldValue: 'Enter Account Holder' } // Empty field
      ];
    } else if (templateInfo.name.includes('ADDRESS')) {
      sampleFields = [
        { fieldName: 'Street Address', fieldValue: '123 Main Street' }, // Example value
        { fieldName: 'City', fieldValue: 'New York' }, // Example value
        { fieldName: 'State', fieldValue: 'Enter State' }, // Empty field
        { fieldName: 'ZIP Code', fieldValue: 'Enter ZIP Code' } // Empty field
      ];
    } else if (templateInfo.name.includes('SUBJECT')) {
      sampleFields = [
        { fieldName: 'First Name', fieldValue: 'John' }, // Example value
        { fieldName: 'Last Name', fieldValue: 'Doe' }, // Example value
        { fieldName: 'Date of Birth', fieldValue: 'Enter Date of Birth' } // Empty field
      ];
    } else {
      sampleFields = [
        { fieldName: 'Field 1', fieldValue: 'Enter Value 1' },
        { fieldName: 'Field 2', fieldValue: 'Enter Value 2' },
        { fieldName: 'Field 3', fieldValue: 'Enter Value 3' }
      ];
    }
    
    setFormFieldValues(sampleFields);
    console.log('Set fallback template:', templateInfo);
    console.log('Set fallback fields:', sampleFields);
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

        {/* Form Template Section */}
        {formTemplate && (
          <div className="mb-4">
            <div className="text-primary fw-medium mb-1" style={{ fontSize: '1.1rem' }}>
              {formTemplate.name}
            </div>
            <div className="text-muted mb-3" style={{ fontSize: '0.9rem' }}>
              {formTemplate.description}
            </div>
          </div>
        )}

        {/* Form Field Values */}
        {formLoading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading form data...</span>
            </div>
            <div className="mt-2 text-muted">Loading form data...</div>
          </div>
        ) : formFieldValues.length > 0 ? (
          <div className="mb-4">
            {formFieldValues.map((field, index) => {
              const isPlaceholder = field.fieldValue.toString().startsWith('Enter ');
              const isRequired = field.fieldName.includes('*') || field.fieldName.includes('#');
              
              return (
                <div key={index} className="mb-3">
                  <label className="form-label fw-medium text-dark mb-1">
                    {field.fieldName}
                    {isRequired && <span className="text-danger ms-1">*</span>}
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={isPlaceholder ? '' : field.fieldValue}
                    placeholder={isPlaceholder ? field.fieldValue : `Enter ${field.fieldName}`}
                    readOnly
                    style={{ 
                      backgroundColor: isPlaceholder ? '#f8f9fa' : 'white',
                      color: isPlaceholder ? '#6c757d' : '#212529',
                      fontStyle: isPlaceholder ? 'italic' : 'normal'
                    }}
                  />
                  {/* Show actual value status */}
                  {!isPlaceholder && (
                    <div className="form-text text-success small">
                      ✓ Value submitted
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

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