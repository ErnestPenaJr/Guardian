import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { FormField } from '../types/formBuilder';
import SimpleFormBuilder from '../components/SimpleFormBuilder';
import '../styles/FormCreationFlow.css';

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

const NewRequestModal: React.FC<NewRequestModalProps> = ({ isOpen, onClose, onSave, initialFormData }) => {
  // If initialFormData is from a template, we want to show the form to fill out, not the form builder
  const isTemplateForm = !!initialFormData;
  const [step, setStep] = useState(initialFormData ? 2 : 0); // Skip to form builder if initialFormData is provided
  const [saving, setSaving] = useState(false);
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  
  // Clear form values when a new form is opened
  useEffect(() => {
    if (isOpen) {
      console.log('NewRequestModal opened, clearing previous field values');
      console.log('Initial form data:', initialFormData);
      setFieldValues([]);
      setAttachments([]);
      
      // Reset form data to ensure it's using the latest initialFormData
      if (initialFormData) {
        console.log(`Setting form data with type: ${initialFormData.formType}`);
        setFormData(initialFormData);
      }
    }
  }, [isOpen, initialFormData]);
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
    if (step === 0 && !formData.formType) {
      alert('Please select a form type');
      return;
    }
    
    if (step === 1 && !formData.name.trim()) {
      alert('Please enter a form title');
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
      
      // Validate required fields for template forms
      if (isTemplateForm) {
        // Check for empty required fields
        const missingFields = formData.formFields
          .filter(field => field.required && !getFieldValue(field.id))
          .map(field => field.fieldName);
          
        if (missingFields.length > 0) {
          alert(`Please fill out the following required fields: ${missingFields.join(', ')}`);
          setSaving(false);
          return;
        }
      }
      
      // Prepare request data based on REQUEST table structure
      const requestData = {
        REQUEST_ID: null, // Will be assigned by the database
        REQUEST_NAME: formData.name,
        EXTERNAL_USER: null, // Will be set by the server based on current user
        SUBMITTED_DATE: new Date().toISOString(),
        REQUESTOR_ID: null, // Will be set by the server based on current user
        ASSIGNED_ID: null, // Will be assigned later in the workflow
        STATUS: 'N', // New request
        CREATE_DATE: new Date().toISOString(),
        UPDATE_DATE: new Date().toISOString(),
        CREATE_USER_ID: null, // Will be set by the server
        UPDATE_USER_ID: null, // Will be set by the server
        TRACKINGID: generateTrackingId(), // Generate a unique tracking ID
        ABBREVIATION: formData.formType?.substring(0, 5)?.toUpperCase() || null,
        COMPANY_ID: null // Will be set by the server based on current user's company
      };
      
      // Prepare form instance values for storage in FORMS_INSTANCE_VALUES table
      const formInstanceValues = fieldValues.map(fv => {
        const field = formData.formFields.find(field => field.id === fv.id);
        return {
          FORM_INSTANCE_ID: null, // Will be assigned by the server after form instance creation
          FIELD_ID: field?.dbFieldId || null, // Database field ID if available
          FIELD_VALUE: fv.value,
          FIELD_NAME: field?.fieldName || ''
        };
      });
      
      // Submit the form with the properly structured data
      await onSave({
        ...formData, 
        requestData,
        formInstanceValues // Add form instance values for proper storage
      });
      
      // Show success message with request ID
      alert(`Request submitted successfully! Your request ID is: ${requestData.TRACKINGID}`);
      
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
      alert('Failed to submit request. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  // Handle field value changes
  const handleFieldValueChange = (fieldId: string, value: string) => {
    // Check if we already have a value for this field
    const existingIndex = fieldValues.findIndex(fv => fv.id === fieldId);
    
    if (existingIndex >= 0) {
      // Update existing value
      const updatedValues = [...fieldValues];
      updatedValues[existingIndex].value = value;
      setFieldValues(updatedValues);
    } else {
      // Add new value
      setFieldValues([...fieldValues, { id: fieldId, value }]);
    }
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
          width: '800px',
          maxWidth: '90%',
          margin: '0',
          borderRadius: '8px',
          padding: '20px',
          maxHeight: '90vh',
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
              {step === 0 && 'Configure your first form!'}
              {step === 1 && `Set up your: ${formData.formType} Form`}
              {step === 2 && 'Design your form'}
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
            <div className="step-label">Select form type</div>
            <div className="step-label">Create a title</div>
            <div className="step-label">Design your form</div>
          </div>
        </>
      )}
      
      {/* Step 1: Form Type Selection */}
      {step === 0 && (
        <div>
          <h2 className="mb-4">Choose One</h2>
          <div className="form-type-selection">
            <div className="form-check form-check-inline form-type-option">
              <input
                type="radio"
                className="form-check-input"
                id="formTypeRequests"
                name="formType"
                value="Request"
                checked={formData.formType === 'Request'}
                onChange={(e) => setFormData(f => ({ ...f, formType: e.target.value }))}
              />
              <label className="form-check-label" htmlFor="formTypeRequests">
                Requests
              </label>
            </div>
            <div className="form-check form-check-inline form-type-option">
              <input
                type="radio"
                className="form-check-input"
                id="formTypeSelfService"
                name="formType"
                value="Self-Service"
                checked={formData.formType === 'Self-Service'}
                onChange={(e) => setFormData(f => ({ ...f, formType: e.target.value }))}
                disabled
              />
              <label className="form-check-label" htmlFor="formTypeSelfService">
                Self-Service
              </label>
            </div>
            <div className="form-check form-check-inline form-type-option">
              <input
                type="radio"
                className="form-check-input"
                id="formTypeNotice"
                name="formType"
                value="Notice"
                checked={formData.formType === 'Notice'}
                onChange={(e) => setFormData(f => ({ ...f, formType: e.target.value }))}
                disabled
              />
              <label className="form-check-label" htmlFor="formTypeNotice">
                Notice
              </label>
            </div>
          </div>
        </div>
      )}
      
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
    
      {/* Step 1: Form Type Selection */}
      {step === 0 && (
        <div>
          <h2 className="mb-4">Choose One</h2>
          <div className="form-type-selection">
          <div className="form-check form-check-inline form-type-option">
            <input
              type="radio"
              className="form-check-input"
              id="formTypeRequests"
              name="formType"
              value="Request"
              checked={formData.formType === 'Request'}
              onChange={(e) => setFormData(f => ({ ...f, formType: e.target.value }))}
            />
            <label className="form-check-label" htmlFor="formTypeRequests">
              Requests
            </label>
          </div>
          <div className="form-check form-check-inline form-type-option">
            <input
              type="radio"
              className="form-check-input"
              id="formTypeSelfService"
              name="formType"
              value="Self-Service"
              checked={formData.formType === 'Self-Service'}
              onChange={(e) => setFormData(f => ({ ...f, formType: e.target.value }))}
              disabled
            />
            <label className="form-check-label" htmlFor="formTypeSelfService">
              Self-Service
            </label>
          </div>
          <div className="form-check form-check-inline form-type-option">
            <input
              type="radio"
              className="form-check-input"
              id="formTypeNotice"
              name="formType"
              value="Notice"
              checked={formData.formType === 'Notice'}
              onChange={(e) => setFormData(f => ({ ...f, formType: e.target.value }))}
              disabled
            />
            <label className="form-check-label" htmlFor="formTypeNotice">
              Notice
            </label>
          </div>
        </div>
      </div>
    )}
    
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
            {/* Display template description */}
            <div className="alert alert-info mb-4">
              {formData.formType && TEMPLATE_DESCRIPTIONS[formData.formType as keyof typeof TEMPLATE_DESCRIPTIONS]}
            </div>
            <form className="form-fill">
              {formData.formFields.map((field, index) => (
                <div key={field.id || index} className="mb-4 form-field-container">
                  <label className="form-label">
                    {field.fieldName} {field.required && <span className="text-danger">*</span>}
                  </label>
                   {field.fieldType === 'text' && (
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder={`Enter ${field.fieldName}`}
                      onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
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
                  {field.fieldType === 'date' && (
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
