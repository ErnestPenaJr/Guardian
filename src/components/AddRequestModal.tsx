import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
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
        // Filter for public and active forms with company ID 1000
        const activeTemplates = forms.filter(form => 
          form.IS_ACTIVE && 
          form.IS_PUBLIC && 
          !form.IS_DELETED && 
          form.ORGANIZATION_ID === 1000
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
      setRequestName('');
      setAbbreviation('');
      setDescription('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (abbreviation.length > 5) {
      toast.error('Abbreviation must be 5 characters or less');
      return;
    }
    
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
        userId: authUser?.id || 1036 // Get user ID from authenticated user or default to Ernest Pena (1036)
      };
      
      // Use the standard endpoint directly which now uses transactions and proper ID handling
      let requestResult;
      try {
        console.log('Using standard endpoint with transaction support...');
        console.log('Request data being sent:', requestData);
        
        // Ensure name is not empty
        if (!requestData.name || requestData.name.trim() === '') {
          throw new Error('Request name is required');
        }
        
        requestResult = await requestService.createRequest(requestData);
        console.log('Standard endpoint success:', requestResult);
        
        // Verify that we have both a request and form instance
        if (!requestResult.request || !requestResult.formInstance) {
          throw new Error('Incomplete response: missing request or form instance data');
        }
        
        // Log the relationship between request and form instance
        console.log(`Successfully created request ${requestResult.request.REQUEST_ID} with form instance ${requestResult.formInstance.FORM_INSTANCE_ID}`);
      } catch (error) {
        console.error('Standard endpoint failed:', error);
        
        // If standard endpoint fails, try the SQL endpoint as fallback
        try {
          console.log('Attempting to use SQL endpoint as fallback...');
          const sqlData = {
            name: requestName,
            abbreviation,
            description,
            templateId: formId
          };
          requestResult = await requestService.sqlCreateRequest(sqlData);
          console.log('SQL endpoint success:', requestResult);
        } catch (sqlError) {
          console.error('SQL endpoint failed:', sqlError);
          toast.error('SQL endpoint failed. Trying simple endpoint...');
          
          // Try the simple endpoint as last resort
          try {
            console.log('Attempting to use simple endpoint as last resort...');
            const simpleData = {
              name: requestName,
              abbreviation,
              description
            };
            requestResult = await requestService.simpleCreateRequest(simpleData);
            console.log('Simple endpoint success:', requestResult);
          } catch (simpleError) {
            console.error('Simple endpoint failed:', simpleError);
            throw simpleError; // Re-throw to be caught by the outer catch block
          }
        }
      }
      
      if (!requestResult) {
        throw new Error('Request creation failed - no result returned');
      }
      
      console.log('Request created successfully:', requestResult);
      
      // Call the original onSubmit callback with the result
      // This will trigger the fetchRequests() in RequestDashboard to refresh the datatable
      const submissionResult = await onSubmit({
        ...requestData,
        id: requestResult.requestId || requestResult.request?.REQUEST_ID || 0,
        formInstanceId: requestResult.formInstance?.FORM_INSTANCE_ID || 0
      });
      
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
    setRequestName('');
    setAbbreviation('');
    setDescription('');
    setSelectedTemplate('SUBJECT');
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
        <h2 className="modal-title">Add New Request</h2>
        <button 
          type="button" 
          className="btn-close" 
          onClick={onClose} 
          aria-label="Close"
        ></button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ maxHeight: 'none', overflow: 'visible' }}>
          <div className="mb-4">
            <label htmlFor="formTemplate" className="form-label">Form Template</label>
            <div
              className="d-flex flex-column gap-2 template-selection-container"
              style={{
                height: '300px',
                maxHeight: '300px',
                overflowY: 'auto',
                paddingRight: '10px',
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
          
          {/* Submit button */}
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
              {isSubmitting ? 'Adding...' : 'Add Request'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default AddRequestModal;
