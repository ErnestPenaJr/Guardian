import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import '../styles/Modal.css';
import { toast } from 'react-toastify';
import { FaUser, FaSpinner, FaClipboardList } from 'react-icons/fa';
import formService from '../services/formService';
import requestService from '../services/requestService';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import SectionedFormRenderer from './SectionedFormRenderer';

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
  const [priorityLevel, setPriorityLevel] = useState('Standard');
  
  // Get icon for user-created templates (using a generic workflow icon)
  const getIconForTemplate = (templateName: string) => {
    return <FaClipboardList />;
  };
  

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
          !form.IS_DELETED &&
          form.FORM_ID && // Ensure FORM_ID exists and is valid
          form.FORM_ID > 0
        );
        
        // Create templates with basic info - validate form IDs
        const templatesWithBasicInfo = activeTemplates
          .filter(form => form.FORM_ID && form.FORM_ID > 0) // Double check form ID validity
          .map(form => ({
            id: form.FORM_ID!.toString(), // Use non-null assertion since we filtered for valid IDs above
            name: form.FORM_NAME,
            description: form.FORM_DESCRIPTION || '',
            icon: getIconForTemplate(form.FORM_NAME),
            fields: form.FORM_DESCRIPTION || 'Custom workflow template'
          }));
        
        if (templatesWithBasicInfo.length > 0) {
          console.log('Successfully loaded user-created templates:', templatesWithBasicInfo.length);
          console.log('Template IDs loaded:', templatesWithBasicInfo.map(t => `${t.name}(${t.id})`).join(', '));
          setFormTemplates(templatesWithBasicInfo);
          setSelectedTemplate(templatesWithBasicInfo[0].id);
        } else {
          console.log('No user-created templates found in database');
          setFormTemplates([]);
          setSelectedTemplate('');
        }
      } else {
        console.log('No templates found in database');
        setFormTemplates([]);
        setSelectedTemplate('');
      }
    } catch (error) {
      console.error('Error fetching templates from database:', error);
      toast.error('Error loading templates from database');
      setFormTemplates([]);
      setSelectedTemplate('');
    } finally {
      setIsLoading(false);
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
      setPriorityLevel('Standard');
    }
  }, [isOpen]);
  
  // Handle template selection
  const handleTemplateSelect = async (templateId: string) => {
    setSelectedTemplate(templateId);
    
    // Find the selected template
    const template = formTemplates.find(t => t.id === templateId);
    if (template) {
      toast.info(`Selected workflow: ${template.name}`);
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
      toast.error('Please select a workflow');
      return;
    }

    // Prevent proceeding if no workflows available
    if (formTemplates.length === 0) {
      toast.error('No workflows available. Please create a workflow first.');
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
      const formId = parseInt(selectedTemplateObj?.id || '0');
      
      if (formId && formId > 0) {
        try {
          // Get form with fields
          console.log(`🔍 Loading workflow fields for form ID: ${formId}`);
          const formWithFields = await formService.getFormById(formId);
          setTemplateFields(formWithFields.fields || []);
          console.log(`✅ Successfully loaded ${formWithFields.fields?.length || 0} fields for workflow ${formId}`);
        } catch (formError: any) {
          console.error(`❌ Error loading workflow ${formId}:`, formError);
          
          // Handle specific 404 error
          if (formError.response?.status === 404) {
            toast.error(`Workflow not found (ID: ${formId}). Please contact your administrator.`);
            console.warn(`⚠️ Workflow ${formId} not found in database`);
          } else {
            toast.error(`Error loading workflow. Please try again or contact your administrator.`);
            console.warn(`⚠️ Error loading workflow ${formId}:`, formError.message);
          }
          
          // Set empty fields for errors
          setTemplateFields([]);
        }
      } else {
        console.log(`ℹ️ No valid form ID found for workflow ${templateId}`);
        setTemplateFields([]);
      }
    } catch (error) {
      console.error('Error loading workflow fields:', error);
      toast.error('Error loading workflow. Please try again.');
      setTemplateFields([]);
    } finally {
      setLoadingFields(false);
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
      
      // Get the selected workflow's form ID
      const selectedTemplateObj = formTemplates.find(t => t.id === selectedTemplate);
      const formId = parseInt(selectedTemplateObj?.id || '0');
      
      if (!formId || isNaN(formId)) {
        toast.error('Invalid workflow selected');
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
        requestStatus: status, // Explicitly set the request status
        PRIORITY_LEVEL: priorityLevel // Add priority level
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
      // Get the selected workflow's form ID
      const selectedTemplateObj = formTemplates.find(t => t.id === selectedTemplate);
      const formId = parseInt(selectedTemplateObj?.id || '0');
      
      if (!formId || isNaN(formId)) {
        toast.error('Invalid workflow selected');
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
        formFieldValues: fieldValues, // Include the form field values
        PRIORITY_LEVEL: priorityLevel // Add priority level
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
    setSelectedTemplate('');
    setTemplateFields([]);
    setFieldValues({});
    setPriorityLevel('Standard');
  };

  // Helper functions for input field formatting and validation
  const getInputType = (fieldName: string, fieldTypeDesc: string) => {
    const lowerFieldName = fieldName.toLowerCase();
    
    // Date fields
    if (lowerFieldName.includes('dob') || lowerFieldName.includes('date') || lowerFieldName.includes('birth') || fieldTypeDesc === 'date') {
      return 'date';
    }
    
    // Number fields
    if (lowerFieldName.includes('ssn') || lowerFieldName.includes('social') || 
        lowerFieldName.includes('phone') || lowerFieldName.includes('number') ||
        lowerFieldName.includes('routing') || lowerFieldName.includes('account') ||
        lowerFieldName.includes('zip') || lowerFieldName.includes('postal') ||
        fieldTypeDesc === 'number') {
      return 'tel'; // Use tel for better mobile experience with numbers
    }
    
    // Email fields
    if (lowerFieldName.includes('email') || fieldTypeDesc === 'email') {
      return 'email';
    }
    
    // URL fields
    if (lowerFieldName.includes('url') || lowerFieldName.includes('website') || fieldTypeDesc === 'url') {
      return 'url';
    }
    
    return 'text';
  };

  const getPlaceholder = (fieldName: string, fieldId: string) => {
    const lowerFieldName = fieldName.toLowerCase();
    
    // Specific placeholders for known field types
    if (fieldId === 'routing_number') return '123456789';
    if (fieldId === 'bank_name') return 'USA';
    if (fieldId === 'account_holder') return 'Ernest Pena';
    
    // Date fields
    if (lowerFieldName.includes('dob') || lowerFieldName.includes('birth')) {
      return 'MM/DD/YYYY';
    }
    
    // SSN fields
    if (lowerFieldName.includes('ssn') || lowerFieldName.includes('social')) {
      return '123-45-6789';
    }
    
    // Phone fields
    if (lowerFieldName.includes('phone')) {
      return '(555) 123-4567';
    }
    
    // Zip code fields
    if (lowerFieldName.includes('zip') || lowerFieldName.includes('postal')) {
      return '12345';
    }
    
    return `Enter ${fieldName}`;
  };

  const getInputPattern = (fieldName: string, fieldTypeDesc: string) => {
    const lowerFieldName = fieldName.toLowerCase();
    
    // SSN pattern
    if (lowerFieldName.includes('ssn') || lowerFieldName.includes('social')) {
      return '[0-9]{3}-?[0-9]{2}-?[0-9]{4}';
    }
    
    // Phone pattern
    if (lowerFieldName.includes('phone')) {
      return '[0-9]{3}-?[0-9]{3}-?[0-9]{4}';
    }
    
    // Zip code pattern
    if (lowerFieldName.includes('zip') || lowerFieldName.includes('postal')) {
      return '[0-9]{5}(-[0-9]{4})?';
    }
    
    return undefined;
  };

  const getMinValue = (fieldName: string, fieldTypeDesc: string) => {
    const lowerFieldName = fieldName.toLowerCase();
    
    // Date minimums
    if (lowerFieldName.includes('dob') || lowerFieldName.includes('birth')) {
      return '1900-01-01';
    }
    
    return undefined;
  };

  const getMaxValue = (fieldName: string, fieldTypeDesc: string) => {
    const lowerFieldName = fieldName.toLowerCase();
    
    // Date maximums
    if (lowerFieldName.includes('dob') || lowerFieldName.includes('birth')) {
      return new Date().toISOString().split('T')[0]; // Today's date
    }
    
    return undefined;
  };

  const getStepValue = (fieldName: string, fieldTypeDesc: string) => {
    // Add step values if needed for specific numeric fields
    return undefined;
  };

  const getMaxLength = (fieldName: string, fieldTypeDesc: string) => {
    const lowerFieldName = fieldName.toLowerCase();
    
    // SSN max length
    if (lowerFieldName.includes('ssn') || lowerFieldName.includes('social')) {
      return 11; // 123-45-6789
    }
    
    // Phone max length
    if (lowerFieldName.includes('phone')) {
      return 14; // (555) 123-4567
    }
    
    // Zip code max length
    if (lowerFieldName.includes('zip') || lowerFieldName.includes('postal')) {
      return 10; // 12345-6789
    }
    
    return undefined;
  };

  const getInputTitle = (fieldName: string, fieldTypeDesc: string) => {
    const lowerFieldName = fieldName.toLowerCase();
    
    // Helpful title attributes for validation
    if (lowerFieldName.includes('ssn') || lowerFieldName.includes('social')) {
      return 'Please enter a valid Social Security Number (123-45-6789)';
    }
    
    if (lowerFieldName.includes('phone')) {
      return 'Please enter a valid phone number (555-123-4567)';
    }
    
    if (lowerFieldName.includes('zip') || lowerFieldName.includes('postal')) {
      return 'Please enter a valid zip code (12345 or 12345-6789)';
    }
    
    if (lowerFieldName.includes('dob') || lowerFieldName.includes('birth')) {
      return 'Please enter your date of birth';
    }
    
    return undefined;
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Add Request Modal"
      className={step === 2 ? 'modal-content modal-content--fullscreen' : 'modal-content'}
      overlayClassName="modal-overlay"
      id="AddRequestModal"
    >
      <div className="modal-header" style={{ paddingTop: '20px', paddingLeft: '20px', paddingRight: '20px' }}>
        <h2 className="modal-title">
{step === 1 ? 'Create Request' : `Fill Request Form - ${requestName}`}
        </h2>
        <button 
          type="button" 
          className="btn-close" 
          onClick={onClose} 
          aria-label="Close"
        ></button>
      </div>
      
      <form onSubmit={step === 1 ? handleNext : (e) => e.preventDefault()}>
        <div className="modal-body" style={{ maxHeight: step === 2 ? 'none' : undefined, padding: '16px 20px' }}>
          {step === 1 && (
            <>
          <div className="mb-4">
            <label htmlFor="formTemplate" className="form-label">Select Workflow</label>
            <div
              className="d-flex flex-column gap-2 template-selection-container"
              style={{
                height: '220px',
                maxHeight: '220px',
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
                  <FaClipboardList className="text-muted mb-3" style={{ fontSize: '48px' }} />
                  <h5 className="text-muted mb-2">No Workflows Available</h5>
                  <p className="text-muted mb-0">No user-created workflows found. Please create a workflow first using the form builder.</p>
                  <small className="text-muted">Contact your administrator to set up workflows for your organization.</small>
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
            <div style={{ flex: '1', minWidth: '120px', display: 'none' }}>
              <label htmlFor="abbreviation" className="form-label">Abbreviation *</label>
              <input
                type="hidden"
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

          <div className="mb-3">
            <label htmlFor="priorityLevel" className="form-label">
              Priority Level <span className="text-danger">*</span>
            </label>
            <select 
              className="form-select"
              id="priorityLevel"
              value={priorityLevel}
              onChange={(e) => setPriorityLevel(e.target.value)}
              required
            >
              <option value="Low">Low</option>
              <option value="Standard">Standard (Default)</option>
              <option value="High">High</option>
            </select>
            <small className="form-text text-muted">Select the priority level for this request. Standard is the default priority.</small>
          </div>

          
            </>
          )}
          
          {step === 2 && (
            <div>
              {/* Template info header */}
              <div className="mb-4 p-3" style={{ backgroundColor: '#f8f9fa', borderRadius: '0.375rem' }}>
                <h5 className="text-primary mb-1">
                  {formTemplates.find(t => t.id === selectedTemplate)?.name} Workflow
                </h5>
                <p className="text-muted mb-0 small">
                  {formTemplates.find(t => t.id === selectedTemplate)?.description || 'Custom workflow'}
                </p>
              </div>
              
              {loadingFields ? (
                <div className="text-center p-4">
                  <FaSpinner className="fa-spin" style={{ fontSize: '24px' }} />
                  <p className="mt-2">Loading form fields...</p>
                </div>
              ) : (
                <SectionedFormRenderer
                  formName={formTemplates.find(t => t.id === selectedTemplate)?.name ?? ''}
                  fields={templateFields.filter(field => field.FIELD_NAME !== 'Request Status')}
                  fieldValues={fieldValues}
                  onChange={(id, val) => handleFieldValueChange(id, val)}
                />
              )}
              
              {/* Submit buttons for step 2 */}
              <div className="d-flex justify-content-end gap-2 mt-4">
                <button 
                  type="button" 
                  className="btn btn-success transition-colors duration-200"
                  onClick={handleStart}
                  disabled={isSubmitting}
                  style={{ 
                    borderRadius: '0.375rem', 
                    padding: '0.5rem 1.5rem',
                    backgroundColor: '#032424'
                  }}
                  onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#021818')}
                  onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#032424')}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline-danger transition-colors duration-200"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  style={{ 
                    borderRadius: '0.375rem', 
                    padding: '0.5rem 1.5rem',
                    borderColor: '#C10000',
                    color: '#C10000'
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = '#C10000';
                      e.currentTarget.style.color = '#FFFFFF';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#C10000';
                    }
                  }}
                >
                  {isSubmitting ? 'Cancelling...' : 'Cancel'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer lives outside modal-body so it's always inside the white box */}
        {step === 1 && (
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
              style={{ borderColor: '#2EBCBC', color: '#2EBCBC' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2EBCBC'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#2EBCBC'; }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || formTemplates.length === 0 || !selectedTemplate}
              style={{ backgroundColor: '#032424', borderColor: '#032424' }}
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#021818')}
              onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#032424')}
            >
              Next
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
};

export default AddRequestModal;
