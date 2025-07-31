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
              const hasValue = field.fieldValue && field.fieldValue.toString().trim() !== '';
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
                    value={hasValue ? field.fieldValue : ''}
                    placeholder={hasValue ? '' : `Enter ${field.fieldName}`}
                    readOnly
                    style={{ 
                      backgroundColor: hasValue ? 'white' : '#f8f9fa',
                      color: hasValue ? '#212529' : '#6c757d',
                      fontStyle: hasValue ? 'normal' : 'italic'
                    }}
                  />
                  {/* Show database value status */}
                  {hasValue && (
                    <div className="form-text text-success small">
                      ✓ Value from database
                    </div>
                  )}
                  {!hasValue && (
                    <div className="form-text text-muted small">
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