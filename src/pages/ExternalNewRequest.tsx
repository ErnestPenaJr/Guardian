import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { FaClipboardList, FaPaperclip, FaCheck } from 'react-icons/fa';
import { useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';

interface FormField {
  FIELD_ID: number;
  FIELD_NAME: string;
  FIELD_TYPE_ID: number;
  IS_REQUIRED: boolean;
  HAS_LOOKUP: boolean;
  DISPLAY_FORMAT?: string;
  lookupValues?: { LOOKUP_CODE: string; LOOKUP_DESCRIPTION: string }[];
}

interface ExternalForm {
  FORM_ID: number;
  FORM_NAME: string;
  FORM_DESCRIPTION: string;
  fields: FormField[];
}

const ExternalNewRequest: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [externalForms, setExternalForms] = useState<ExternalForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [requestName, setRequestName] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  // Parse query parameters for pre-selected form
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const formId = params.get('formId');
    if (formId) {
      setSelectedFormId(parseInt(formId));
    }
  }, [location]);

  // Load external forms
  useEffect(() => {
    const fetchExternalForms = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.get('/external/forms');
        setExternalForms(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching external forms:', err);
        setError('Failed to load available forms. Please try again.');
        setLoading(false);
      }
    };

    fetchExternalForms();
  }, []);

  // Load form fields when form is selected
  useEffect(() => {
    const fetchFormFields = async () => {
      if (!selectedFormId) {
        setFormFields([]);
        return;
      }

      try {
        setLoading(true);
        const response = await api.get(`/external/forms/${selectedFormId}/fields`);
        
        // For fields with lookups, fetch lookup values
        const fieldsWithLookups = await Promise.all(
          response.data.map(async (field: FormField) => {
            if (field.HAS_LOOKUP) {
              const lookupRes = await api.get(`/fields/${field.FIELD_ID}/lookup`);
              return { ...field, lookupValues: lookupRes.data };
            }
            return field;
          })
        );
        
        setFormFields(fieldsWithLookups);
        
        // Initialize form values
        const initialValues: Record<string, any> = {};
        fieldsWithLookups.forEach((field: FormField) => {
          initialValues[`field_${field.FIELD_ID}`] = '';
        });
        setFormValues(initialValues);
        
        // Set request name based on form name
        const selectedForm = externalForms.find(form => form.FORM_ID === selectedFormId);
        if (selectedForm) {
          setRequestName(`External Request - ${selectedForm.FORM_NAME}`);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching form fields:', err);
        setError('Failed to load form fields. Please try again.');
        setLoading(false);
      }
    };

    fetchFormFields();
  }, [selectedFormId, externalForms]);

  // Handle form input changes
  const handleInputChange = (fieldId: number, value: any) => {
    setFormValues({
      ...formValues,
      [`field_${fieldId}`]: value
    });
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileList = Array.from(e.target.files);
      setFiles([...files, ...fileList]);
    }
  };

  // Remove a file from the list
  const handleRemoveFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  // Submit the request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!requestName.trim()) {
      setError('Request name is required');
      return;
    }
    
    if (!selectedFormId) {
      setError('Please select a form');
      return;
    }
    
    // Validate required fields
    const missingFields = formFields
      .filter(field => field.IS_REQUIRED && !formValues[`field_${field.FIELD_ID}`])
      .map(field => field.FIELD_NAME);
    
    if (missingFields.length > 0) {
      setError(`Please fill in the following required fields: ${missingFields.join(', ')}`);
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      
      // Create the external request
      const requestData = {
        requestName,
        formId: selectedFormId,
        externalUser: 'Y', // Mark as external user request
        fieldValues: Object.entries(formValues).map(([key, value]) => ({
          fieldId: parseInt(key.replace('field_', '')),
          value
        }))
      };
      
      const response = await api.post('/external/requests', requestData);
      const requestId = response.data.REQUEST_ID;
      
      // Upload files if any
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });
        
        await api.post(`/external/requests/${requestId}/attachments`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      }
      
      setSuccess('Request submitted successfully!');
      setSubmitting(false);
      
      // Show success message and redirect
      await Swal.fire({
        title: 'Success!',
        text: 'Your request has been submitted successfully.',
        icon: 'success',
        confirmButtonText: 'View My Requests'
      });
      
      navigate('/external/requests');
    } catch (err) {
      console.error('Error submitting request:', err);
      setError('Failed to submit request. Please try again.');
      setSubmitting(false);
    }
  };

  // Check if user is authorized to access this page
  if (user && !user.roles?.includes(6) && !user.roles?.includes(1)) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          <h4>Access Denied</h4>
          <p>You do not have permission to access this page. This page is restricted to external users only.</p>
          <Button variant="primary" onClick={() => navigate('/')}>Return to Dashboard</Button>
        </Alert>
      </Container>
    );
  }

  if (loading && !formFields.length) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '70vh' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <h2 className="mb-4">
        <FaClipboardList className="me-2" />
        Submit External Request
      </h2>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Alert variant="info" className="mb-4">
        <h5>External User Form Submission</h5>
        <p className="mb-0">
          As an external user, you have access to submit specific requests to the organization.
          Please complete the form below and attach any necessary documents.
        </p>
      </Alert>

      <Form onSubmit={handleSubmit}>
        <Card className="shadow-sm mb-4">
          <Card.Header className="bg-white">
            <h5 className="mb-0">Request Details</h5>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Request Name</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter a name for your request"
                    value={requestName}
                    onChange={(e) => setRequestName(e.target.value)}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Form Type</Form.Label>
                  <Form.Select
                    value={selectedFormId || ''}
                    onChange={(e) => setSelectedFormId(e.target.value ? parseInt(e.target.value) : null)}
                    required
                    disabled={!!selectedFormId && !!formFields.length}
                  >
                    <option value="">Select a form type</option>
                    {externalForms.map(form => (
                      <option key={form.FORM_ID} value={form.FORM_ID}>
                        {form.FORM_NAME}
                      </option>
                    ))}
                  </Form.Select>
                  {selectedFormId && formFields.length > 0 && (
                    <Button 
                      variant="link" 
                      className="p-0 mt-1" 
                      onClick={() => {
                        setSelectedFormId(null);
                        setFormFields([]);
                        setFormValues({});
                      }}
                    >
                      Change form type
                    </Button>
                  )}
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {selectedFormId && formFields.length > 0 && (
          <Card className="shadow-sm mb-4">
            <Card.Header className="bg-white">
              <h5 className="mb-0">Form Fields</h5>
            </Card.Header>
            <Card.Body>
              {formFields.map(field => (
                <Form.Group key={field.FIELD_ID} className="mb-3">
                  <Form.Label>
                    {field.FIELD_NAME}
                    {field.IS_REQUIRED && <span className="text-danger">*</span>}
                  </Form.Label>
                  
                  {field.FIELD_TYPE_ID === 1 && (
                    // Text field
                    <Form.Control
                      type="text"
                      placeholder={`Enter ${field.FIELD_NAME}`}
                      value={formValues[`field_${field.FIELD_ID}`] || ''}
                      onChange={(e) => handleInputChange(field.FIELD_ID, e.target.value)}
                      required={field.IS_REQUIRED}
                    />
                  )}
                  
                  {field.FIELD_TYPE_ID === 2 && (
                    // Number field
                    <Form.Control
                      type="number"
                      placeholder={`Enter ${field.FIELD_NAME}`}
                      value={formValues[`field_${field.FIELD_ID}`] || ''}
                      onChange={(e) => handleInputChange(field.FIELD_ID, e.target.value)}
                      required={field.IS_REQUIRED}
                    />
                  )}
                  
                  {field.FIELD_TYPE_ID === 3 && (
                    // Date field
                    <Form.Control
                      type="date"
                      value={formValues[`field_${field.FIELD_ID}`] || ''}
                      onChange={(e) => handleInputChange(field.FIELD_ID, e.target.value)}
                      required={field.IS_REQUIRED}
                    />
                  )}
                  
                  {field.FIELD_TYPE_ID === 4 && (
                    // Textarea
                    <Form.Control
                      as="textarea"
                      rows={3}
                      placeholder={`Enter ${field.FIELD_NAME}`}
                      value={formValues[`field_${field.FIELD_ID}`] || ''}
                      onChange={(e) => handleInputChange(field.FIELD_ID, e.target.value)}
                      required={field.IS_REQUIRED}
                    />
                  )}
                  
                  {field.FIELD_TYPE_ID === 5 && field.HAS_LOOKUP && field.lookupValues && (
                    // Select/dropdown
                    <Form.Select
                      value={formValues[`field_${field.FIELD_ID}`] || ''}
                      onChange={(e) => handleInputChange(field.FIELD_ID, e.target.value)}
                      required={field.IS_REQUIRED}
                    >
                      <option value="">Select an option</option>
                      {field.lookupValues.map(lookup => (
                        <option key={lookup.LOOKUP_CODE} value={lookup.LOOKUP_CODE}>
                          {lookup.LOOKUP_DESCRIPTION}
                        </option>
                      ))}
                    </Form.Select>
                  )}
                  
                  {field.FIELD_TYPE_ID === 6 && (
                    // Checkbox
                    <Form.Check
                      type="checkbox"
                      label={field.FIELD_NAME}
                      checked={formValues[`field_${field.FIELD_ID}`] || false}
                      onChange={(e) => handleInputChange(field.FIELD_ID, e.target.checked)}
                      required={field.IS_REQUIRED}
                    />
                  )}
                  
                  {field.FIELD_TYPE_ID === 7 && field.HAS_LOOKUP && field.lookupValues && (
                    // Radio buttons
                    <div>
                      {field.lookupValues.map(lookup => (
                        <Form.Check
                          key={lookup.LOOKUP_CODE}
                          type="radio"
                          label={lookup.LOOKUP_DESCRIPTION}
                          name={`field_${field.FIELD_ID}`}
                          value={lookup.LOOKUP_CODE}
                          checked={formValues[`field_${field.FIELD_ID}`] === lookup.LOOKUP_CODE}
                          onChange={(e) => handleInputChange(field.FIELD_ID, e.target.value)}
                          required={field.IS_REQUIRED}
                        />
                      ))}
                    </div>
                  )}
                </Form.Group>
              ))}
            </Card.Body>
          </Card>
        )}

        <Card className="shadow-sm mb-4">
          <Card.Header className="bg-white">
            <h5 className="mb-0">
              <FaPaperclip className="me-2" />
              Attachments
            </h5>
          </Card.Header>
          <Card.Body>
            <Form.Group className="mb-3">
              <Form.Label>Upload Files (Optional)</Form.Label>
              <Form.Control
                type="file"
                multiple
                onChange={handleFileChange}
              />
              <Form.Text className="text-muted">
                You can upload multiple files. Maximum file size: 10MB per file.
              </Form.Text>
            </Form.Group>
            
            {files.length > 0 && (
              <div className="mt-3">
                <h6>Selected Files:</h6>
                <ul className="list-group">
                  {files.map((file, index) => (
                    <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                      {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleRemoveFile(index)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card.Body>
        </Card>

        <div className="d-flex justify-content-end mb-5">
          <Button
            variant="secondary"
            className="me-2"
            onClick={() => navigate('/external/dashboard')}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={submitting || !selectedFormId || formFields.length === 0}
          >
            {submitting ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                Submitting...
              </>
            ) : (
              <>
                <FaCheck className="me-2" />
                Submit Request
              </>
            )}
          </Button>
        </div>
      </Form>
    </Container>
  );
};

export default ExternalNewRequest;
