import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { FormField } from '../types/formBuilder';
import SimpleFormBuilder from '../components/SimpleFormBuilder';
import '../styles/FormCreationFlow.css';
import Swal from 'sweetalert2';
import userService, { User } from '../services/userService';

// Template descriptions for user guidance
const TEMPLATE_DESCRIPTIONS = {
  SUBJECT: 'Use this template to submit information about a data subject. Includes fields for personal information and contact details.',
  FINANCIAL: 'Use this template to submit financial account information. Includes fields for bank details and account numbers.',
  ADDRESS: 'Use this template to submit address information. Includes fields for full address details and location information.'
};

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: any) => Promise<void>;
  initialFormData?: {
    name: string;
    description: string;
    formType: string;
    formFields: FormField[];
  };
}

interface FieldValue {
  id: string;
  value: string;
}

interface Attachment {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

interface RequestMetadata {
  requestName: string;
  requestDescription: string;
  assignedUserId: number | null;
}

const NewRequestModal: React.FC<NewRequestModalProps> = ({ isOpen, onClose, onSave, initialFormData }) => {
  // If initialFormData is from a template, we want to show the form to fill out, not the form builder
  const isTemplateForm = !!initialFormData;
  const [step, setStep] = useState(initialFormData ? 2 : 0); // Skip to form builder if initialFormData is provided
  const [saving, setSaving] = useState(false);
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [requestMetadata, setRequestMetadata] = useState<RequestMetadata>({
    requestName: '',
    requestDescription: '',
    assignedUserId: null
  });
  
  // Clear form values when a new form is opened
  useEffect(() => {
    if (isOpen) {
      console.log('NewRequestModal opened, clearing previous field values');
      console.log('Initial form data:', initialFormData);
      setFieldValues([]);
      setAttachments([]);
      setRequestMetadata({
        requestName: '',
        requestDescription: '',
        assignedUserId: null
      });
      
      // Reset form data to ensure it's using the latest initialFormData
      if (initialFormData) {
        console.log(`Setting form data with type: ${initialFormData.formType}`);
        setFormData(initialFormData);
      }
      
      // Fetch users for the assignment dropdown
      fetchUsers();
    }
  }, [isOpen, initialFormData]);
  
  // Fetch users for the assignment dropdown
  const fetchUsers = async () => {
    try {
      // Try to get the current user first as a fallback
      const currentUser = await userService.getCurrentUser();
      
      // Then try to get all users (requires admin/JAFAR permissions)
      const usersList = await userService.getUsers();
      
      if (usersList && usersList.length > 0) {
        setUsers(usersList);
      } else if (currentUser) {
        // If we couldn't get all users but have the current user, use that as fallback
        setUsers([currentUser]);
        
        // Auto-select the current user
        setRequestMetadata(prev => ({
          ...prev,
          assignedUserId: currentUser.id
        }));
      } else {
        // If we couldn't get any users, show a warning
        console.warn('Could not fetch users for assignment');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      // Don't show an error toast as this might confuse users
      // Just log the error and continue with empty users list
    }
  };
  const [formData, setFormData] = useState(() => {
    if (initialFormData) {
      // If we have initialFormData from a template, use it
      return initialFormData;
    } else {
      // Otherwise use default empty form
      return {
        formType: '',
        name: '',
        description: '',
        formFields: [] as FormField[]
      };
    }
  });

  // Reset form when modal closes
  const handleClose = () => {
    setStep(initialFormData ? 2 : 0);
    setFormData(() => {
      if (initialFormData) {
        // If we have initialFormData from a template, use it
        return initialFormData;
      } else {
        // Otherwise use default empty form
        return {
          formType: '',
          name: '',
          description: '',
          formFields: []
        };
      }
    });
    onClose();
  };

  // Move to next step
  const nextStep = () => {
    // Validate current step before proceeding
    if (!validateForm()) {
      return;
    }
    
    setStep(step + 1);
  };

  // Move to previous step
  const prevStep = () => {
    setStep(step - 1);
  };

  // Handle form fields update from the FormBuilder component
  const handleFormFieldsChange = (fields: FormField[]) => {
    setFormData({ ...formData, formFields: fields });
  };

  // Submit the form
  const handleSave = async () => {
    try {
      setSaving(true);
      
      console.log(`🚀 [NewRequestModal] HandleSave called - Current fieldValues:`, fieldValues);
      console.log(`🚀 [NewRequestModal] HandleSave called - Field values count:`, fieldValues.length);
      
      // Validate all form fields before submission
      if (!validateForm()) {
        setSaving(false);
        return;
      }
      
      // Prepare request data based on REQUEST table structure
      const requestData = {
        REQUEST_ID: null, // Will be assigned by the database
        REQUEST_NAME: requestMetadata.requestName || formData.name,
        REQUEST_DESCRIPTION: requestMetadata.requestDescription,
        EXTERNAL_USER: null, // Will be set by the server based on current user
        SUBMITTED_DATE: new Date().toISOString(),
        REQUESTOR_ID: null, // Will be set by the server based on current user
        ASSIGNED_ID: requestMetadata.assignedUserId, // User assigned to process this request
        STATUS: 'A', // Active request
        CREATE_DATE: new Date().toISOString(),
        UPDATE_DATE: new Date().toISOString(),
        CREATE_USER_ID: null, // Will be set by the server
        UPDATE_USER_ID: null, // Will be set by the server
        TRACKINGID: generateTrackingId(), // Generate a unique tracking ID
        ABBREVIATION: formData.formType?.substring(0, 5)?.toUpperCase() || null,
        COMPANY_ID: null // Will be set by the server based on current user's company
      };
      
      // Prepare form instance values for storage in FORMS_INSTANCE_VALUES table
      console.log('🔍 Processing field values for submission...');
      console.log('📋 Current fieldValues state:', fieldValues);
      console.log('📋 FormData.formFields:', formData.formFields);
      
      const formInstanceValues = fieldValues.map(fv => {
        const field = formData.formFields.find(field => field.id === fv.id);
        console.log(`🔍 Mapping field: UI ID=${fv.id} -> DB Field ID=${field?.dbFieldId || fv.id} (${field?.fieldName})`);
        
        const instanceValue = {
          FORM_INSTANCE_ID: null, // Will be assigned by the server after form instance creation
          FIELD_ID: field?.dbFieldId || parseInt(fv.id), // Use field ID directly if dbFieldId not available
          FIELD_VALUE: fv.value,
          FIELD_NAME: field?.fieldName || ''
        };
        console.log(`📝 Form instance value: ${field?.fieldName} (DB Field ID: ${field?.dbFieldId || fv.id}) = "${fv.value}"`);
        return instanceValue;
      });
      
      console.log('📊 Total form instance values prepared:', formInstanceValues.length);
      console.log('📋 Form instance values:', formInstanceValues);
      
      // Submit the form with the properly structured data
      await onSave({
        ...formData, 
        requestData,
        formInstanceValues, // Add form instance values for proper storage
        templateId: formData.templateId || formData.FORM_ID || null // Include template ID
      });
      
      // Show success message
      Swal.fire({
        title: 'Success!',
        text: 'Your request has been submitted successfully!',
        icon: 'success',
        confirmButtonText: 'OK',
        confirmButtonColor: '#1a5b87'
      });
      
      // Record milestone for the submission
      const milestone = {
        event: 'Submitted',
        dateTime: new Date().toLocaleString(),
        by: 'Current User', // This would be replaced with actual user name from context
        status: 'Pending'
      };
      
      console.log('Request milestone recorded:', milestone);
      handleClose();
    } catch (error) {
      console.error('Error submitting request:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to submit request. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: '#1a5b87'
      });
    } finally {
      setSaving(false);
    }
  };
  
  // Handle field value changes
  const handleFieldValueChange = (fieldId: string, value: string) => {
    console.log(`🔧 [NewRequestModal] Field value changed: Field ID=${fieldId}, Value="${value}"`);
    console.log(`🔧 [NewRequestModal] Current fieldValues before update:`, fieldValues);
    
    // Check if we already have a value for this field
    const existingIndex = fieldValues.findIndex(fv => fv.id === fieldId);
    
    if (existingIndex >= 0) {
      // Update existing value
      const updatedValues = [...fieldValues];
      updatedValues[existingIndex].value = value;
      setFieldValues(updatedValues);
      console.log(`✅ [NewRequestModal] Updated existing field value for Field ID=${fieldId}`);
      console.log(`✅ [NewRequestModal] Updated field values:`, updatedValues);
    } else {
      // Add new value
      const newFieldValues = [...fieldValues, { id: fieldId, value }];
      setFieldValues(newFieldValues);
      console.log(`✅ [NewRequestModal] Added new field value for Field ID=${fieldId}`);
      console.log(`✅ [NewRequestModal] New field values:`, newFieldValues);
    }
    
    console.log(`📊 [NewRequestModal] Current field values count: ${fieldValues.length + (existingIndex < 0 ? 1 : 0)}`);
  };
  
  // Handle file attachment changes
  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      }));
      
      setAttachments([...attachments, ...newFiles]);
    }
  };
  
  // Handle removing an attachment
  const handleRemoveAttachment = (index: number) => {
    const updatedAttachments = [...attachments];
    updatedAttachments.splice(index, 1);
    setAttachments(updatedAttachments);
  };
  
  // Get the value of a field by its ID
  const getFieldValue = (fieldId: string): string => {
    const field = fieldValues.find(fv => fv.id === fieldId);
    return field ? field.value : '';
  };
  
  // Validate form fields
  const validateForm = () => {
    // Validate form type selection in step 0
    if (step === 0 && !formData.formType) {
      Swal.fire({
        title: 'Form Type Required',
        text: 'Please select a form type to continue.',
        icon: 'warning',
        confirmButtonText: 'OK',
        confirmButtonColor: '#1a5b87'
      });
      return false;
    }
    
    // Validate form title and description in step 1
    if (step === 1) {
      if (!formData.name.trim()) {
        Swal.fire({
          title: 'Form Title Required',
          text: 'Please enter a title for your form.',
          icon: 'warning',
          confirmButtonText: 'OK',
          confirmButtonColor: '#1a5b87'
        });
        return false;
      }
      
      if (!formData.description.trim()) {
        Swal.fire({
          title: 'Form Description Required',
          text: 'Please enter a description for your form.',
          icon: 'warning',
          confirmButtonText: 'OK',
          confirmButtonColor: '#1a5b87'
        });
        return false;
      }
    }
    
    // Validate template form fields in step 2
    if (step === 2 && isTemplateForm) {
      // Validate request name
      if (!requestMetadata.requestName.trim()) {
        Swal.fire({
          title: 'Request Name Required',
          text: 'Please enter a name for this request.',
          icon: 'warning',
          confirmButtonText: 'OK',
          confirmButtonColor: '#1a5b87'
        });
        return false;
      }
      
      // Validate request description
      if (!requestMetadata.requestDescription.trim()) {
        Swal.fire({
          title: 'Request Description Required',
          text: 'Please enter a description for this request.',
          icon: 'warning',
          confirmButtonText: 'OK',
          confirmButtonColor: '#1a5b87'
        });
        return false;
      }
      
      // Validate assigned user if we have users to assign to
      if (users.length > 0 && !requestMetadata.assignedUserId) {
        Swal.fire({
          title: 'User Assignment Required',
          text: 'Please assign this request to a user for processing.',
          icon: 'warning',
          confirmButtonText: 'OK',
          confirmButtonColor: '#1a5b87'
        });
        return false;
      }
      
      // Validate required form fields
      const missingFields = formData.formFields
        .filter(field => field.required && !getFieldValue(field.id))
        .map(field => field.fieldName);
        
      if (missingFields.length > 0) {
        Swal.fire({
          title: 'Required Fields Missing',
          text: `Please fill out the following required fields: ${missingFields.join(', ')}`,
          icon: 'warning',
          confirmButtonText: 'OK',
          confirmButtonColor: '#1a5b87'
        });
        return false;
      }
    }
    
    return true;
  };
  
  // Generate a unique tracking ID
  const generateTrackingId = () => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `REQ-${timestamp}-${random}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleClose}
      contentLabel="Create Form"
      className="modal-content"
      overlayClassName="modal-overlay"
      style={{
        content: {
          width: step === 2 ? '1200px' : '800px', // Wider for form builder step
          maxWidth: '95%',
          margin: '0',
          borderRadius: '8px',
          padding: step === 2 ? '15px' : '20px', // Less padding for form builder to maximize space
          maxHeight: '95vh', // Slightly taller for form builder
          overflow: 'auto',
          position: 'absolute',
          top: '50%',
          left: '50%',
          right: 'auto',
          bottom: 'auto',
          transform: 'translate(-50%, -50%)',
          border: '1px solid #ccc',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }
      }}
      ariaHideApp={false}
    >
      <div className="modal-header d-flex justify-content-between align-items-center mb-4">
        <h3 className="modal-title m-0">
          {isTemplateForm ? `Fill out ${formData.name}` : (
            <>
              {step === 0 && 'Step 1: SELECT Workflow Type'}
              {step === 1 && 'Step 2: Create your Workflow'}
              {step === 2 && 'Step 3: Select Workflow Fields'}
            </>
          )}
        </h3>
        <button type="button" className="btn-close" onClick={handleClose}></button>
      </div>
      
      {/* Only show step indicator if not a template form */}
      {!isTemplateForm && (
        <>
          <div className="step-indicator mb-4">
            <div className={`step-circle ${step >= 0 ? 'active' : ''}`}>1</div>
            <div className="step-line"></div>
            <div className={`step-circle ${step >= 1 ? 'active' : ''}`}>2</div>
            <div className="step-line"></div>
            <div className={`step-circle ${step >= 2 ? 'active' : ''}`}>3</div>
          </div>
          
          <div className="step-labels mb-4">
            <div className="step-label">Step 1: SELECT Workflow Type</div>
            <div className="step-label">Step 2: Create your Workflow</div>
            <div className="step-label">Step 3: Select Workflow Fields</div>
          </div>
        </>
      )}
      
      {/* Step 1: Form Type Selection */}
      {step === 0 && (
        <div>
          <h2 className="mb-4">Choose One</h2>
          <div className="form-type-selection">
            <div className="form-check form-check-inline form-type-option">
              <div style={{ textAlign: 'center', paddingLeft: '15px' }}>
                <input
                  type="radio"
                  className="form-check-input"
                  id="formTypeRequests"
                  name="formType"
                  value="Request"
                  checked={formData.formType === 'Request'}
                  onChange={(e) => setFormData(f => ({ ...f, formType: e.target.value }))}
                  style={{ marginRight: '10px' }}
                />
                <label className="form-check-label" htmlFor="formTypeRequests">
                  Requests
                </label>
              </div>
            </div>
            <div className="form-check form-check-inline form-type-option">
              <div style={{ textAlign: 'center', paddingLeft: '15px' }}>
                <input
                  type="radio"
                  className="form-check-input"
                  id="formTypeSelfService"
                  name="formType"
                  value="Self-Service"
                  checked={formData.formType === 'Self-Service'}
                  onChange={(e) => setFormData(f => ({ ...f, formType: e.target.value }))}
                  disabled
                  style={{ marginRight: '10px' }}
                />
                <label className="form-check-label" htmlFor="formTypeSelfService">
                  Self-Service
                </label>
              </div>
            </div>
            <div className="form-check form-check-inline form-type-option">
              <div style={{ textAlign: 'center', paddingLeft: '15px' }}>
                <input
                  type="radio"
                  className="form-check-input"
                  id="formTypeNotice"
                  name="formType"
                  value="Notice"
                  checked={formData.formType === 'Notice'}
                  onChange={(e) => setFormData(f => ({ ...f, formType: e.target.value }))}
                  disabled
                  style={{ marginRight: '10px' }}
                />
                <label className="form-check-label" htmlFor="formTypeNotice">
                  Notice
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* First form title section removed to fix duplicate issue */}
    
      {/* Second form type selection removed to fix duplicate issue */}
    
    {/* Step 2: Form Title and Description */}
    {step === 1 && (
      <div>
        <div className="form-group mb-3">
          <label htmlFor="formName">Title</label>
          <input
            type="text"
            className="form-control"
            id="formName"
            value={formData.name}
            onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
            placeholder="Enter form title"
            required
          />
        </div>
        <div className="form-group mb-3">
          <label htmlFor="formDescription">Description</label>
          <textarea
            className="form-control"
            id="formDescription"
            value={formData.description}
            onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
            placeholder="Enter form description"
            rows={3}
          />
        </div>
      </div>
    )}
    
    {/* Step 3: Form Builder or Form Fill */}
    {step === 2 && (
      <div>
        {isTemplateForm ? (
          <div className="form-fill-container">
            <h4 className="form-preview-title mb-4">Form Preview</h4>
            {/* Template description removed */}
            <form className="form-fill">
              {/* Request metadata fields */}
              <div className="mb-4 form-field-container">
                <label className="form-label">
                  Request Name <span className="text-danger">*</span>
                </label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Enter Request Name"
                  value={requestMetadata.requestName}
                  onChange={(e) => setRequestMetadata({...requestMetadata, requestName: e.target.value})}
                  required
                />
              </div>
              
              <div className="mb-4 form-field-container">
                <label className="form-label">
                  Request Description <span className="text-danger">*</span>
                </label>
                <textarea 
                  className="form-control" 
                  placeholder="Enter Request Description"
                  value={requestMetadata.requestDescription}
                  onChange={(e) => setRequestMetadata({...requestMetadata, requestDescription: e.target.value})}
                  required
                  rows={3}
                ></textarea>
              </div>
              
              {users.length > 0 && (
                <div className="mb-4 form-field-container">
                  <label className="form-label">
                    Assign To <span className="text-danger">*</span>
                  </label>
                  <select 
                    className="form-select"
                    value={requestMetadata.assignedUserId || ''}
                    onChange={(e) => setRequestMetadata({...requestMetadata, assignedUserId: e.target.value ? Number(e.target.value) : null})}
                    required
                  >
                    <option value="">Select User</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </option>
                    ))}
                  </select>
                  <small className="form-text text-muted">This user will be responsible for processing this request</small>
                </div>
              )}
              {users.length === 0 && (
                <div className="alert alert-warning mb-4">
                  <strong>Note:</strong> User assignment is not available. The request will be assigned to the system administrator.
                </div>
              )}
              
              <hr className="my-4" />
              <h5 className="mb-3">Form Fields</h5>
              
              {formData.formFields.map((field, index) => (
                <div key={field.id || index} className="mb-4 form-field-container">
                  <label className="form-label">
                    {field.fieldName} {field.required && <span className="text-danger">*</span>}
                  </label>
                   {/* Handle field types with special cases for ZIP code and state */}
                   {(field.fieldType === 'text' || field.fieldType === 'zip_code' || field.fieldType === 'state' ||
                     field.fieldType === 'first_name' || field.fieldType === 'last_name' || field.fieldType === 'city' ||
                     field.fieldType === 'address_line_1' || field.fieldType === 'address_line_2') && (
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder={
                        field.fieldType === 'zip_code' || field.fieldName?.toLowerCase().includes('zip')
                          ? 'Enter ZIP code (e.g., 12345)'
                          : field.fieldType === 'state' || field.fieldName?.toLowerCase() === 'state'
                          ? 'Enter state (e.g., CA, NY, TX)'
                          : `Enter ${field.fieldName}`
                      }
                      maxLength={
                        field.fieldType === 'zip_code' || field.fieldName?.toLowerCase().includes('zip')
                          ? 10  // ZIP+4 format
                          : field.fieldType === 'state' || field.fieldName?.toLowerCase() === 'state'
                          ? 2   // State abbreviation
                          : undefined
                      }
                      pattern={
                        field.fieldType === 'zip_code' || field.fieldName?.toLowerCase().includes('zip')
                          ? '[0-9]{5}(-[0-9]{4})?'
                          : undefined
                      }
                      onChange={(e) => {
                        let value = e.target.value;
                        
                        // Auto-uppercase state field
                        if (field.fieldType === 'state' || field.fieldName?.toLowerCase() === 'state') {
                          value = value.toUpperCase();
                        }
                        
                        handleFieldValueChange(field.id, value);
                      }}
                      required={field.required}
                    />
                  )}
                  {field.fieldType === 'textarea' && (
                    <textarea 
                      className="form-control" 
                      placeholder={`Enter ${field.fieldName}`}
                      onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                      required={field.required}
                    ></textarea>
                  )}
                  {field.fieldType === 'number' && (
                    <input 
                      type="number" 
                      className="form-control" 
                      placeholder={`Enter ${field.fieldName}`}
                      onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                      required={field.required}
                    />
                  )}
                  {(field.fieldType === 'date' || field.fieldType === 'dob') && (
                    <input 
                      type="date" 
                      className="form-control"
                      onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                      required={field.required}
                    />
                  )}
                  {field.fieldType === 'select' && field.options && (
                    <select 
                      className="form-select"
                      onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                      required={field.required}
                    >
                      <option value="">Select {field.fieldName}</option>
                      {field.options.split(',').map((option, i) => (
                        <option key={i} value={option.trim()}>{option.trim()}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
              
              {/* Attachment section */}
              <div className="mb-4 form-field-container">
                <label className="form-label">Attachments</label>
                <div className="input-group">
                  <input 
                    type="file" 
                    className="form-control" 
                    id="attachmentInput"
                    onChange={handleAttachmentChange}
                    multiple
                  />
                  <button 
                    className="btn btn-outline-secondary" 
                    type="button"
                    onClick={() => document.getElementById('attachmentInput')?.click()}
                  >
                    Browse Files
                  </button>
                </div>
                <small className="form-text text-muted">Upload supporting documents (optional)</small>
                
                {/* Display attached files */}
                {attachments.length > 0 && (
                  <div className="mt-2">
                    <p>Attached files:</p>
                    <ul className="list-group">
                      {attachments.map((file, index) => (
                        <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                          <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                          <button 
                            type="button" 
                            className="btn btn-sm btn-danger"
                            onClick={() => handleRemoveAttachment(index)}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="d-flex justify-content-between mt-4">
                <button type="button" className="btn btn-outline-primary" onClick={handleClose}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <SimpleFormBuilder 
              formFields={formData.formFields} 
              onChange={handleFormFieldsChange} 
              formId={undefined}
            />
            <div className="d-flex justify-content-between mt-4">
              <button 
                className="btn btn-outline-primary" 
                onClick={prevStep}
                disabled={saving}
              >
                Back
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    )}
    
    {/* Navigation Buttons - Only show if not in template form mode and not on step 2 */}
    {(!isTemplateForm && step !== 2) && (
      <div className="modal-footer d-flex justify-content-between mt-3">
        <button 
          className="btn btn-secondary" 
          onClick={step === 0 ? handleClose : prevStep}
          disabled={saving}
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        <button 
          className="btn btn-primary" 
          onClick={nextStep}
          disabled={saving}
        >
          Next
        </button>
      </div>
    )}
  </Modal>
);
};

export default NewRequestModal;
