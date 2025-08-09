import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import '../styles/Modal.css';
import { toast } from 'react-toastify';
import { FaUser, FaMoneyBill, FaHome, FaSpinner } from 'react-icons/fa';
import formService from '../services/formService';
import requestService from '../services/requestService';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

// Set the app element for accessibility
Modal.setAppElement('#root');

// Initialize SweetAlert2
const MySwal = withReactContent(Swal);

interface AddRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (requestData: any) => void;
}

const AddRequestModal: React.FC<AddRequestModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [step, setStep] = useState(1);
  const [requestName, setRequestName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [formTemplates, setFormTemplates] = useState<Array<{
    id: string;
    name: string;
    description: string;
    icon: JSX.Element;
    fields: string;
  }>>([]);
  const [templateFields, setTemplateFields] = useState<any[]>([]);
  const [fieldValues, setFieldValues] = useState<{[key: string]: string}>({});
  const [loadingFields, setLoadingFields] = useState(false);
  
  // Get icon based on template name
  const getIconForTemplate = (templateName: string) => {
    switch(templateName.toUpperCase()) {
      case 'SUBJECT':
        return <FaUser />;
      case 'FINANCIAL':
        return <FaMoneyBill />;
      case 'ADDRESS':
        return <FaHome />;
      default:
        return <FaUser />;
    }
  };
  
  // Default templates to use as fallback if API fails
  const defaultTemplates = [
    {
      id: 'default-subject',
      name: 'SUBJECT',
      description: 'Personal information template',
      icon: <FaUser />,
      fields: 'First Name, Middle Name, Last Name, DOB, SSN'
    },
    {
      id: 'default-financial',
      name: 'FINANCIAL',
      description: 'Banking information template',
      icon: <FaMoneyBill />,
      fields: 'Bank Name, Account #, Routing #'
    },
    {
      id: 'default-address',
      name: 'ADDRESS',
      description: 'Address information template',
      icon: <FaHome />,
      fields: 'Address Line 1, Address Line 2, City, State, ZIP Code'
    }
  ];

  // Fetch form templates from database
  const fetchFormTemplates = async () => {
    setIsLoading(true);
    try {
      // Fetch forms from the database
      const forms = await formService.getAllForms();
      
      if (forms && forms.length > 0) {
        // Filter for public and active forms (global forms with null COMPANY_ID or forms for user's company)
        const activeTemplates = forms.filter(form => 
          form.IS_ACTIVE && 
          form.IS_PUBLIC && 
          !form.IS_DELETED
        );
        
        // Create templates with basic info
        const templatesWithBasicInfo = activeTemplates.map(form => ({
          id: form.FORM_ID?.toString() || `default-${form.FORM_NAME.toLowerCase()}`,
          name: form.FORM_NAME,
          description: form.FORM_DESCRIPTION || '',
          icon: getIconForTemplate(form.FORM_NAME),
          fields: getDefaultFieldsForTemplate(form.FORM_NAME)
        }));
        
        if (templatesWithBasicInfo.length > 0) {
          console.log('Successfully loaded templates from database:', templatesWithBasicInfo.length);
          setFormTemplates(templatesWithBasicInfo);
          setSelectedTemplate(templatesWithBasicInfo[0].id);
        } else {
          console.log('No active templates found in database, using defaults');
          setFormTemplates(defaultTemplates);
          setSelectedTemplate(defaultTemplates[0].id);
        }
      } else {
        console.log('No templates found in database, using defaults');
        setFormTemplates(defaultTemplates);
        setSelectedTemplate(defaultTemplates[0].id);
      }
    } catch (error) {
      console.error('Error fetching templates from database:', error);
      toast.error('Error loading templates from database, using defaults');
      
      // Use default templates as fallback
      setFormTemplates(defaultTemplates);
      setSelectedTemplate(defaultTemplates[0].id);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Get default fields description based on template name
  const getDefaultFieldsForTemplate = (templateName: string): string => {
    switch(templateName.toUpperCase()) {
      case 'SUBJECT':
        return 'First Name, Middle Name, Last Name, DOB, SSN';
      case 'FINANCIAL':
        return 'Bank Name, Account #, Routing #';
      case 'ADDRESS':
        return 'Address Line 1, Address Line 2, City, State, ZIP Code';
      default:
        return 'Custom template';
    }
  };

  // Fetch templates and reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // Fetch templates from database
      fetchFormTemplates();
      
      // Reset form fields when modal opens
      setStep(1);
      setRequestName('');
      setAbbreviation('');
      setDescription('');
      setTemplateFields([]);
      setFieldValues({});
    }
  }, [isOpen]);
  
  // Handle template selection
  const handleTemplateSelect = async (templateId: string) => {
    setSelectedTemplate(templateId);
    
    // Find the selected template
    const template = formTemplates.find(t => t.id === templateId);
    if (template) {
      if (template.id.startsWith('default-')) {
        toast.info(`Selected default template: ${template.name}`);
      } else {
        toast.info(`Selected template: ${template.name}`);
      }
    }
  };

  // Handle next step (from step 1 to step 2)
  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (abbreviation.length > 5) {
      toast.error('Abbreviation must be 5 characters or less');
      return;
    }
    
    if (!requestName.trim()) {
      toast.error('Request name is required');
      return;
    }
    
    if (!selectedTemplate) {
      toast.error('Please select a form template');
      return;
    }
    
    // Load template fields for step 2
    await loadTemplateFields(selectedTemplate);
    setStep(2);
  };
  
  // Load template fields
  const loadTemplateFields = async (templateId: string) => {
    setLoadingFields(true);
    try {
      const selectedTemplateObj = formTemplates.find(t => t.id === templateId);
      let formId: number;
      
      if (selectedTemplateObj?.id.startsWith('default-')) {
        const forms = await formService.getAllForms();
        const matchingForm = forms.find(f => 
          f.FORM_NAME.toUpperCase() === selectedTemplateObj.name.toUpperCase() && 
          f.IS_ACTIVE && 
          f.IS_PUBLIC
        );
        formId = matchingForm?.FORM_ID || 0;
      } else {
        formId = parseInt(selectedTemplateObj?.id || '0');
      }
      
      if (formId) {
        // Get form with fields
        const formWithFields = await formService.getFormById(formId);
        setTemplateFields(formWithFields.fields || []);
      } else {
        // Use default fields for the template
        const defaultFields = getDefaultFieldsForTemplateObj(selectedTemplateObj?.name || '');
        setTemplateFields(defaultFields);
      }
    } catch (error) {
      console.error('Error loading template fields:', error);
      // Use default fields as fallback
      const selectedTemplateObj = formTemplates.find(t => t.id === templateId);
      setTemplateFields(getDefaultFieldsForTemplateObj(selectedTemplateObj?.name || ''));
    } finally {
      setLoadingFields(false);
    }
  };
  
  // Get default fields as objects for template
  const getDefaultFieldsForTemplateObj = (templateName: string) => {
    switch(templateName.toUpperCase()) {
      case 'FINANCIAL':
        return [
          { FIELD_ID: 'bank_name', FIELD_NAME: 'Bank Name', FIELD_TYPE_DESC: 'text', IS_REQUIRED: true },
          { FIELD_ID: 'routing_number', FIELD_NAME: 'Routing #', FIELD_TYPE_DESC: 'text', IS_REQUIRED: true },
          { FIELD_ID: 'account_holder', FIELD_NAME: 'Account Holder', FIELD_TYPE_DESC: 'text', IS_REQUIRED: true }
        ];
      case 'ADDRESS':
        return [
          { FIELD_ID: 'address_line_1', FIELD_NAME: 'Address Line 1', FIELD_TYPE_DESC: 'text', IS_REQUIRED: true },
          { FIELD_ID: 'address_line_2', FIELD_NAME: 'Address Line 2', FIELD_TYPE_DESC: 'text', IS_REQUIRED: false },
          { FIELD_ID: 'city', FIELD_NAME: 'City', FIELD_TYPE_DESC: 'text', IS_REQUIRED: true },
          { FIELD_ID: 'state', FIELD_NAME: 'State', FIELD_TYPE_DESC: 'text', IS_REQUIRED: true },
          { FIELD_ID: 'zip_code', FIELD_NAME: 'ZIP Code', FIELD_TYPE_DESC: 'text', IS_REQUIRED: true }
        ];
      case 'SUBJECT':
        return [
          { FIELD_ID: 'first_name', FIELD_NAME: 'First Name', FIELD_TYPE_DESC: 'text', IS_REQUIRED: true },
          { FIELD_ID: 'middle_name', FIELD_NAME: 'Middle Name', FIELD_TYPE_DESC: 'text', IS_REQUIRED: false },
          { FIELD_ID: 'last_name', FIELD_NAME: 'Last Name', FIELD_TYPE_DESC: 'text', IS_REQUIRED: true },
          { FIELD_ID: 'dob', FIELD_NAME: 'Date of Birth', FIELD_TYPE_DESC: 'date', IS_REQUIRED: true },
          { FIELD_ID: 'ssn', FIELD_NAME: 'SSN', FIELD_TYPE_DESC: 'text', IS_REQUIRED: true }
        ];
      default:
        return [];
    }
  };
  
  // Handle form field value changes
  const handleFieldValueChange = (fieldId: string, value: string) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };
  
  // Check if form is complete (all required fields filled)
  const isFormComplete = () => {
    // For now, consider all fields as required since IS_REQUIRED property is not in the database response
    const requiredFields = templateFields.filter(field => field.FIELD_NAME !== 'Request Status');
    
    const missingFields = requiredFields.filter(field => {
      const fieldId = String(field.FIELD_ID || '');
      const value = fieldValues[fieldId];
      return !value || value.trim() === '';
    });
    
    return missingFields.length === 0;
  };
  
  // Show incomplete form warning
  const showIncompleteFormWarning = async () => {
    const result = await MySwal.fire({
      icon: 'warning',
      title: 'Incomplete Form',
      text: 'Any unsaved forms will not be saved and all incomplete data will be lost.',
      showCancelButton: true,
      confirmButtonText: 'Continue Anyway',
      cancelButtonText: 'Go Back',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    });
    
    return result.isConfirmed;
  };

  // Handle start button (saves form data with conditional status based on form data)
  const handleStart = async () => {
    // Check if form is complete first
    if (!isFormComplete()) {
      const shouldContinue = await showIncompleteFormWarning();
      if (!shouldContinue) {
        return; // User chose to go back
      }
      // If user chooses to continue, don't save form instance, just close modal
      resetForm();
      onClose();
      return;
    }
    
    // Check if form has any data (excluding request_status field)
    const formFieldsWithData = Object.entries(fieldValues).filter(([key, value]) => 
      key !== 'request_status' && value && value.trim() !== ''
    );
    
    // Determine status based on whether form has data
    const status = formFieldsWithData.length > 0 ? 'In Progress' : 'Pending';
    
    console.log(`Form has ${formFieldsWithData.length} fields with data, setting status to: ${status}`);
    
    // Set the request status and submit
    const updatedFieldValues = {
      ...fieldValues,
      request_status: status
    };
    setFieldValues(updatedFieldValues);
    
    // Submit with the determined status
    await submitFormWithStatus(status);
  };
  
  // Handle complete button (saves form data with status 'Completed')
  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if form is complete first
    if (!isFormComplete()) {
      const shouldContinue = await showIncompleteFormWarning();
      if (!shouldContinue) {
        return; // User chose to go back
      }
      // If user chooses to continue, don't save form instance, just close modal
      resetForm();
      onClose();
      return;
    }
    
    await submitFormWithStatus('Completed');
  };
  
  // Handle cancel button (saves form data with status 'Cancelled')
  const handleCancel = async () => {
    // Check if form is complete first
    if (!isFormComplete()) {
      const shouldContinue = await showIncompleteFormWarning();
      if (!shouldContinue) {
        return; // User chose to go back
      }
      // If user chooses to continue, don't save form instance, just close modal
      resetForm();
      onClose();
      return;
    }
    
    await submitFormWithStatus('Cancelled');
  };
  
  // Submit form with specific status
  const submitFormWithStatus = async (status: string) => {
    const updatedFieldValues = {
      ...fieldValues,
      request_status: status
    };
    setFieldValues(updatedFieldValues);
    
    // Perform the actual submission with the specific status
    try {
      setIsSubmitting(true);
      
      // Get the selected template's form ID
      const selectedTemplateObj = formTemplates.find(t => t.id === selectedTemplate);
      let formId: number;
      
      if (selectedTemplateObj?.id.startsWith('default-')) {
        const forms = await formService.getAllForms();
        const matchingForm = forms.find(f => 
          f.FORM_NAME.toUpperCase() === selectedTemplateObj.name.toUpperCase() && 
          f.IS_ACTIVE && 
          f.IS_PUBLIC
        );
        
        if (matchingForm && matchingForm.FORM_ID) {
          formId = matchingForm.FORM_ID;
        } else {
          toast.error('Selected template not found in database');
          setIsSubmitting(false);
          return;
        }
      } else {
        formId = parseInt(selectedTemplateObj?.id || '0');
      }
      
      if (!formId || isNaN(formId)) {
        toast.error('Invalid template selected');
        setIsSubmitting(false);
        return;
      }
      
      // Get authenticated user info
      const authUser = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Prepare request data with the specific status
      const requestData = {
        name: requestName,
        abbreviation,
        description,
        templateId: formId,
        companyId: authUser?.company?.id || 14,
        userId: authUser?.id || 1036,
        formFieldValues: updatedFieldValues, // Use the updated field values with status
        requestStatus: status // Explicitly set the request status
      };
      
      console.log(`Creating request with status: ${status}`);
      console.log('Request data being sent:', requestData);
      
      // Submit the form
      await onSubmit(requestData);
      
      // Reset form and close modal
      resetForm();
      onClose();
      
      // Show success message
      MySwal.fire({
        icon: 'success',
        title: 'Success!',
        text: `Request ${status.toLowerCase()} successfully!`,
        confirmButtonText: 'OK',
        timer: 3000,
        timerProgressBar: true
      });
      
    } catch (error: any) {
      console.error(`Error ${status.toLowerCase()} request:`, error);
      const errorDetails = error.response?.data?.error || error.message || 'Unknown error';
      
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: `Error ${status.toLowerCase()} request: ${errorDetails}. Please try again.`,
        confirmButtonText: 'OK'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle final form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Get the selected template's form ID (convert from string to number)
      const selectedTemplateObj = formTemplates.find(t => t.id === selectedTemplate);
      let formId: number;
      
      if (selectedTemplateObj?.id.startsWith('default-')) {
        // For default templates, we need to find the corresponding form ID in the database
        // or create a new form if it doesn't exist
        const forms = await formService.getAllForms();
        const matchingForm = forms.find(f => 
          f.FORM_NAME.toUpperCase() === selectedTemplateObj.name.toUpperCase() && 
          f.IS_ACTIVE && 
          f.IS_PUBLIC
        );
        
        if (matchingForm && matchingForm.FORM_ID) {
          formId = matchingForm.FORM_ID;
        } else {
          toast.error('Selected template not found in database');
          setIsSubmitting(false);
          return;
        }
      } else {
        // For database templates, the ID is already a string representation of a number
        formId = parseInt(selectedTemplateObj?.id || '0');
      }
      
      if (!formId || isNaN(formId)) {
        toast.error('Invalid template selected');
        setIsSubmitting(false);
        return;
      }
      
      // Get authenticated user info
      const authUser = JSON.parse(localStorage.getItem('user') || '{}');
      console.log('[useAuth] User from localStorage:', authUser);
      
      // Prepare request data for both REQUEST and FORMS_INSTANCE tables
      const requestData = {
        name: requestName,
        abbreviation,
        description,
        templateId: formId,
        companyId: authUser?.company?.id || 14, // Get company ID from authenticated user or default to DEV-TEAM (14)
        userId: authUser?.id || 1036, // Get user ID from authenticated user or default to Ernest Pena (1036)
        formFieldValues: fieldValues // Include the form field values
      };
      
      // Use only the main endpoint to avoid duplicate creation
      console.log('Creating request using main endpoint...');
      console.log('Request data being sent:', requestData);
      
      // Ensure name is not empty
      if (!requestData.name || requestData.name.trim() === '') {
        throw new Error('Request name is required');
      }
      
      // Only call the parent onSubmit callback - don't create the request twice
      // The parent component (RequestDashboard) handles the actual request creation
      const submissionResult = await onSubmit(requestData);
      
      // Reset form
      resetForm();
      
      // Close the modal
      onClose();
      
      // Show success message with SweetAlert2
      MySwal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Request created successfully!',
        confirmButtonText: 'OK',
        timer: 3000,
        timerProgressBar: true
      });
      
      return submissionResult;
    } catch (error: any) {
      console.error('Error creating request:', error);
      
      // Extract more detailed error information if available
      const errorDetails = error.response?.data?.error || error.message || 'Unknown error';
      
      // Show error message with SweetAlert2
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: `Error creating request: ${errorDetails}. Please try again.`,
        confirmButtonText: 'OK'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Reset form function
  const resetForm = () => {
    setStep(1);
    setRequestName('');
    setAbbreviation('');
    setDescription('');
    setSelectedTemplate('SUBJECT');
    setTemplateFields([]);
    setFieldValues({});
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Add Request Modal"
      className="modal-content"
      overlayClassName="modal-overlay"
      id="AddRequestModal"
    >
      <div className="modal-header">
        <h2 className="modal-title">
          {step === 1 ? 'Add New Request' : `Fill Request Form - ${requestName}`}
        </h2>
        <button 
          type="button" 
          className="btn-close" 
          onClick={onClose} 
          aria-label="Close"
        ></button>
      </div>
      
      <form onSubmit={step === 1 ? handleNext : (e) => e.preventDefault()}>
        <div className="modal-body" style={{ maxHeight: 'none', overflow: 'visible', padding: '16px 20px' }}>
          {step === 1 && (
            <>
          <div className="mb-4">
            <label htmlFor="formTemplate" className="form-label">Form Template</label>
            <div
              className="d-flex flex-column gap-2 template-selection-container"
              style={{
                height: '300px',
                maxHeight: '300px',
                overflowY: 'auto',
                padding: '12px',
                marginBottom: '15px',
                scrollbarWidth: 'thin',
                scrollbarColor: '#dee2e6 transparent',
                border: '1px solid #dee2e6',
                borderRadius: '0.375rem'
              }}
            >
              {isLoading ? (
                <div className="text-center p-4">
                  <FaSpinner className="fa-spin" style={{ fontSize: '24px' }} />
                  <p className="mt-2">Loading templates...</p>
                </div>
              ) : formTemplates.length === 0 ? (
                <div className="text-center p-4">
                  <p>No templates available. Please create templates in the database.</p>
                </div>
              ) : (
                formTemplates.map((template) => (
                  <div 
                    key={template.id}
                    className={`card cursor-pointer template-card ${selectedTemplate === template.id ? 'border-primary' : ''}`}
                    onClick={() => handleTemplateSelect(template.id)}
                    style={{ 
                      cursor: 'pointer',
                      padding: '1rem 1.25rem',
                      marginBottom: '0.75rem',
                      borderRadius: '0.5rem',
                      border: selectedTemplate === template.id ? '1px solid #0d6efd' : '1px solid #dee2e6',
                      minHeight: '80px',
                      display: 'flex',
                     
                    }}
                  >
                    <div className="d-flex align-items-center">
                      <div className={`me-3 ${selectedTemplate === template.id ? 'text-primary' : ''}`} style={{ fontSize: '24px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {template.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: selectedTemplate === template.id ? '500' : 'normal' }}>{template.name}</div>
                        <p className="mb-0 text-muted" style={{ fontSize: '0.8rem', lineHeight: '1.2' }}>{template.fields}</p>
                      </div>
                      <div className="ms-auto">
                        <input 
                          type="radio" 
                          name="templateSelection" 
                          className="form-check-input"
                          style={{ width: '1rem', height: '1rem' }}
                          checked={selectedTemplate === template.id}
                          onChange={() => handleTemplateSelect(template.id)}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="d-flex align-items-end gap-3 mb-3">
            <div style={{ flex: '3' }}>
              <label htmlFor="requestName" className="form-label">Request Name *</label>
              <input
                type="text"
                className="form-control"
                id="requestName"
                value={requestName}
                onChange={(e) => {
                  const newName = e.target.value;
                  setRequestName(newName);
                  
                  // Generate abbreviation from first initials of each word
                  const words = newName.split(/\s+/).filter(word => word.length > 0);
                  let abbr = '';
                  for (let i = 0; i < Math.min(words.length, 5); i++) {
                    if (words[i][0]) {
                      abbr += words[i][0].toUpperCase();
                    }
                  }
                  setAbbreviation(abbr);
                }}
                placeholder="Enter request name"
                required
              />
            </div>
            <div style={{ flex: '1', minWidth: '120px' }}>
              <label htmlFor="abbreviation" className="form-label">Abbreviation *</label>
              <input
                type="text"
                className="form-control"
                id="abbreviation"
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value.toUpperCase().substring(0, 5))}
                maxLength={5}
                placeholder="AUTO"
                required
                style={{ textTransform: 'uppercase' }}
                title="Auto-generated from request name initials. You can also edit manually."
              />
            </div>
          </div>
          
          <div className="mb-3">
            <label htmlFor="description" className="form-label">Description</label>
            <textarea
              className="form-control"
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            ></textarea>
          </div>
          
          {selectedTemplate && (
            <div className="alert alert-info mt-3 mb-3" style={{ backgroundColor: '#e6f7ff', border: 'none', borderRadius: '0.5rem' }}>
              <p className="mb-0">The {formTemplates.find(t => t.id === selectedTemplate)?.name} template will be attached to this request.</p>
            </div>
          )}
          
          {/* Submit button for step 1 */}
          <div className="d-flex justify-content-end gap-2 mt-4">
            <button 
              type="button" 
              className="btn btn-outline-secondary"
              onClick={onClose}
              style={{ borderRadius: '0.375rem', padding: '0.5rem 1.5rem' }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isSubmitting}
              style={{ borderRadius: '0.375rem', padding: '0.5rem 1.5rem' }}
            >
              Next
            </button>
          </div>
            </>
          )}
          
          {step === 2 && (
            <div>
              {/* Template info header */}
              <div className="mb-4 p-3" style={{ backgroundColor: '#f8f9fa', borderRadius: '0.375rem' }}>
                <h5 className="text-primary mb-1">
                  {formTemplates.find(t => t.id === selectedTemplate)?.name} Template
                </h5>
                <p className="text-muted mb-0 small">
                  {formTemplates.find(t => t.id === selectedTemplate)?.name === 'FINANCIAL' 
                    ? 'Banking information template' 
                    : formTemplates.find(t => t.id === selectedTemplate)?.description || 'Form template'}
                </p>
              </div>
              
              {loadingFields ? (
                <div className="text-center p-4">
                  <FaSpinner className="fa-spin" style={{ fontSize: '24px' }} />
                  <p className="mt-2">Loading form fields...</p>
                </div>
              ) : (
                <div>
                  {templateFields.filter(field => field.FIELD_NAME !== 'Request Status').map((field, index) => {
                    const fieldId = String(field.FIELD_ID || index);
                    return (
                    <div key={fieldId} className="mb-3">
                      <label className="form-label">
                        {field.FIELD_NAME}
                        <span className="text-danger ms-1">*</span>
                      </label>
                      {field.FIELD_TYPE_DESC === 'date' ? (
                        <input
                          type="date"
                          className="form-control"
                          value={fieldValues[fieldId] || ''}
                          onChange={(e) => handleFieldValueChange(fieldId, e.target.value)}
                          required
                        />
                      ) : field.FIELD_TYPE_DESC === 'textarea' ? (
                        <textarea
                          className="form-control"
                          rows={3}
                          placeholder={`Enter ${field.FIELD_NAME}`}
                          value={fieldValues[fieldId] || ''}
                          onChange={(e) => handleFieldValueChange(fieldId, e.target.value)}
                          required
                        />
                      ) : field.FIELD_TYPE_DESC === 'select' && field.OPTIONS ? (
                        <select
                          className="form-select"
                          value={fieldValues[fieldId] || ''}
                          onChange={(e) => handleFieldValueChange(fieldId, e.target.value)}
                          required
                        >
                          <option value="">Select {field.FIELD_NAME}</option>
                          {field.OPTIONS.split(',').map((option: string, i: number) => (
                            <option key={i} value={option.trim()}>{option.trim()}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="form-control"
                          placeholder={
                            fieldId === 'routing_number' ? '123456789' :
                            fieldId === 'bank_name' ? 'USA' :
                            fieldId === 'account_holder' ? 'Ernest Pena' :
                            `Enter ${field.FIELD_NAME}`
                          }
                          value={fieldValues[fieldId] || ''}
                          onChange={(e) => handleFieldValueChange(fieldId, e.target.value)}
                          required
                        />
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
              
              {/* Submit buttons for step 2 */}
              <div className="d-flex justify-content-end gap-2 mt-4">
                <button 
                  type="button" 
                  className="btn btn-success"
                  onClick={handleStart}
                  disabled={isSubmitting}
                  style={{ borderRadius: '0.375rem', padding: '0.5rem 1.5rem' }}
                >
                  {isSubmitting ? 'Starting...' : 'Start'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleComplete}
                  disabled={isSubmitting}
                  style={{ borderRadius: '0.375rem', padding: '0.5rem 1.5rem' }}
                >
                  {isSubmitting ? 'Completing...' : 'Complete'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline-danger"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  style={{ borderRadius: '0.375rem', padding: '0.5rem 1.5rem' }}
                >
                  {isSubmitting ? 'Cancelling...' : 'Cancel'}
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default AddRequestModal;
