import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { FaClipboardList, FaUsers, FaCheck, FaPaperclip } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

interface User {
  USER_ID: number;
  FIRST_NAME: string;
  LAST_NAME: string;
  EMAIL: string;
}

interface FormField {
  FIELD_ID: number;
  FIELD_NAME: string;
  FIELD_TYPE_ID: number;
  IS_REQUIRED: boolean;
  HAS_LOOKUP: boolean;
  DISPLAY_FORMAT?: string;
  lookupValues?: { LOOKUP_CODE: string; LOOKUP_DESCRIPTION: string }[];
}

interface FormTemplate {
  FORM_ID: number;
  FORM_NAME: string;
  FORM_DESCRIPTION: string;
  fields: FormField[];
}

const NewRequest: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [groupUsers, setGroupUsers] = useState<User[]>([]);
  const [assignedUser, setAssignedUser] = useState<number | null>(null);
  const [requestName, setRequestName] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  // Load form templates and group users
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch data in parallel
        const [templatesRes, usersRes] = await Promise.all([
          api.get('/forms/templates'),
          api.get('/users/group')
        ]);

        setFormTemplates(templatesRes.data);
        setGroupUsers(usersRes.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load form templates and users. Please try again.');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Load form fields when template is selected
  useEffect(() => {
    const fetchFormFields = async () => {
      if (!selectedTemplate) {
        setFormFields([]);
        return;
      }

      try {
        setLoading(true);
        const response = await api.get(`/forms/${selectedTemplate}/fields`);
        
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
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching form fields:', err);
        setError('Failed to load form fields. Please try again.');
        setLoading(false);
      }
    };

    fetchFormFields();
  }, [selectedTemplate]);

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
    
    if (!selectedTemplate) {
      setError('Please select a form template');
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
      
      // Create the request
      const requestData = {
        requestName,
        formId: selectedTemplate,
        assignedId: assignedUser,
        fieldValues: Object.entries(formValues).map(([key, value]) => ({
          fieldId: parseInt(key.replace('field_', '')),
          value
        }))
      };
      
      const response = await api.post('/requests', requestData);
      const requestId = response.data.REQUEST_ID;
      
      // Upload files if any
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });
        
        await api.post(`/requests/${requestId}/attachments`, formData, {
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
      
      navigate('/requests/my');
    } catch (err) {
      console.error('Error submitting request:', err);
      setError('Failed to submit request. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
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
        Submit New Request
      </h2>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

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
                  <Form.Label>Form Template</Form.Label>
                  <Form.Select
                    value={selectedTemplate || ''}
                    onChange={(e) => setSelectedTemplate(e.target.value ? parseInt(e.target.value) : null)}
                    required
                  >
                    <option value="">Select a template</option>
                    {formTemplates.map(template => (
                      <option key={template.FORM_ID} value={template.FORM_ID}>
                        {template.FORM_NAME}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>
                <FaUsers className="me-1" /> Assign To (Optional)
              </Form.Label>
              <Form.Select
                value={assignedUser || ''}
                onChange={(e) => setAssignedUser(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">Select a user</option>
                {groupUsers.map(user => (
                  <option key={user.USER_ID} value={user.USER_ID}>
                    {user.FIRST_NAME} {user.LAST_NAME} ({user.EMAIL})
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                If you don't assign the request, a manager or processor will assign it later.
              </Form.Text>
            </Form.Group>
          </Card.Body>
        </Card>

        {selectedTemplate && formFields.length > 0 && (
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
            onClick={() => navigate('/requests/my')}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={submitting}
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

export default NewRequest;
