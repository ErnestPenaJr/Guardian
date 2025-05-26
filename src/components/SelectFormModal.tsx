import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import formService from '../services/formService';
import { FaSpinner } from 'react-icons/fa';
import StandardTemplates from './StandardTemplates';
import { useAuth } from '../hooks/useAuth';

// Use the DbForm type from formService
import { DbForm } from '../services/formService';

interface SelectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectForm: (formId: number, formData?: any) => void;
}

const SelectFormModal: React.FC<SelectFormModalProps> = ({ isOpen, onClose, onSelectForm }) => {
  const [forms, setForms] = useState<DbForm[]>([]);
  const [loading, setLoading] = useState(false);
  // Removed selectedFormId state since we're not using custom templates anymore
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  
  // Helper function to check if user has manager, admin, or jfar role
  const hasRequiredRole = () => {
    if (!user) return false;
    
    // Check roles array (objects with id property)
    // Admin (1), JFAR (6), Manager (3)
    const hasRoleInArray = user.roles?.some((role: any) => 
      role.id === 1 || role.id === 6 || role.id === 3
    );
    
    // Check role string property
    const hasRoleAsString = user.role === '1' || user.role === '6' || user.role === '3';
    
    return hasRoleInArray || hasRoleAsString;
  };

  // Fetch forms when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchForms();
    }
  }, [isOpen]);

  const fetchForms = async () => {
    setLoading(true);
    try {
      const response = await formService.getAllForms();
      setForms(response);
    } catch (error) {
      console.error('Error fetching forms:', error);
      toast.error('Failed to load form templates');
    } finally {
      setLoading(false);
    }
  };

  // No longer need handleSelectForm since we're only using standard templates now
  
  // Handle selection of a standard template
  const handleSelectTemplate = (templateId: string) => {
    console.log(`SelectFormModal: Processing template selection for ID: ${templateId}`);
    // Create a form based on the selected template
    switch(templateId) {
      case 'subject':
        // Create a SUBJECT template form
        const subjectForm = {
          FORM_ID: 0, // Will be assigned by the backend
          FORM_NAME: 'SUBJECT Template',
          FORM_DESCRIPTION: 'First Name, Middle Name, Last Name, DOB, SSN',
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          TEMPLATE_TYPE: 'subject' // Add explicit template type
        };
        
        // Fields for SUBJECT template
        const subjectFields = [
          { FIELD_NAME: 'First Name', FIELD_TYPE_ID: 1, IS_REQUIRED: true, OPTIONS: null, SEQUENCE: 1, IS_ACTIVE: true, IS_DELETED: false },
          { FIELD_NAME: 'Middle Name', FIELD_TYPE_ID: 1, IS_REQUIRED: false, OPTIONS: null, SEQUENCE: 2, IS_ACTIVE: true, IS_DELETED: false },
          { FIELD_NAME: 'Last Name', FIELD_TYPE_ID: 1, IS_REQUIRED: true, OPTIONS: null, SEQUENCE: 3, IS_ACTIVE: true, IS_DELETED: false },
          { FIELD_NAME: 'DOB', FIELD_TYPE_ID: 3, IS_REQUIRED: true, OPTIONS: null, SEQUENCE: 4, IS_ACTIVE: true, IS_DELETED: false },
          { FIELD_NAME: 'SSN', FIELD_TYPE_ID: 1, IS_REQUIRED: true, OPTIONS: null, SEQUENCE: 5, IS_ACTIVE: true, IS_DELETED: false }
        ];
        
        // Close this modal and open the form for the user to fill out
        onClose();
        onSelectForm(0, { form: subjectForm, fields: subjectFields, templateType: 'subject' });
        break;
        
      case 'financial':
        // Create a FINANCIAL template form
        const financialForm = {
          FORM_ID: 0,
          FORM_NAME: 'FINANCIAL Template',
          FORM_DESCRIPTION: 'Bank Name, Account #, Routing #',
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          TEMPLATE_TYPE: 'financial' // Add explicit template type
        };
        
        // Fields for FINANCIAL template
        const financialFields = [
          { FIELD_NAME: 'Bank Name', FIELD_TYPE_ID: 1, IS_REQUIRED: true, OPTIONS: null, SEQUENCE: 1, IS_ACTIVE: true, IS_DELETED: false },
          { FIELD_NAME: 'Account #', FIELD_TYPE_ID: 1, IS_REQUIRED: true, OPTIONS: null, SEQUENCE: 2, IS_ACTIVE: true, IS_DELETED: false },
          { FIELD_NAME: 'Routing #', FIELD_TYPE_ID: 1, IS_REQUIRED: true, OPTIONS: null, SEQUENCE: 3, IS_ACTIVE: true, IS_DELETED: false }
        ];
        
        // Close this modal and open the form for the user to fill out
        onClose();
        onSelectForm(0, { form: financialForm, fields: financialFields, templateType: 'financial' });
        break;
        
      case 'address':
        // Create an ADDRESS template form
        const addressForm = {
          FORM_ID: 0,
          FORM_NAME: 'ADDRESS Template',
          FORM_DESCRIPTION: 'Address Line 1, Address Line 2, City, State, ZIP Code',
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          TEMPLATE_TYPE: 'address' // Add explicit template type
        };
        
        // Fields for ADDRESS template
        const addressFields = [
          { FIELD_NAME: 'Address Line 1', FIELD_TYPE_ID: 1, IS_REQUIRED: true, OPTIONS: null, SEQUENCE: 1, IS_ACTIVE: true, IS_DELETED: false },
          { FIELD_NAME: 'Address Line 2', FIELD_TYPE_ID: 1, IS_REQUIRED: false, OPTIONS: null, SEQUENCE: 2, IS_ACTIVE: true, IS_DELETED: false },
          { FIELD_NAME: 'City', FIELD_TYPE_ID: 1, IS_REQUIRED: true, OPTIONS: null, SEQUENCE: 3, IS_ACTIVE: true, IS_DELETED: false },
          { FIELD_NAME: 'State', FIELD_TYPE_ID: 1, IS_REQUIRED: true, OPTIONS: null, SEQUENCE: 4, IS_ACTIVE: true, IS_DELETED: false },
          { FIELD_NAME: 'ZIP Code', FIELD_TYPE_ID: 1, IS_REQUIRED: true, OPTIONS: null, SEQUENCE: 5, IS_ACTIVE: true, IS_DELETED: false }
        ];
        
        // Close this modal and open the form for the user to fill out
        onClose();
        onSelectForm(0, { form: addressForm, fields: addressFields, templateType: 'address' });
        break;
        
      default:
        toast.error('Unknown template type');
    }
  };

  // No longer need to filter forms since we're not displaying custom templates

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Select Form Template"
      className="modal-content"
      style={{
        content: {
          width: '800px',
          maxWidth: '90%',
          margin: '0',
          borderRadius: '8px',
          padding: '20px',
          maxHeight: '90vh',
          overflow: 'auto',
          inset: '50% auto auto 50%',
          transform: 'translate(-50%, -50%)',
          border: '1px solid #ccc',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
        },
        overlay: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
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
        <h3 className="modal-title m-0">Select Form Template</h3>
        <button type="button" className="btn-close" onClick={onClose}></button>
      </div>
      
      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Search forms..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {loading ? (
        <div className="text-center py-5">
          <FaSpinner className="fa-spin" size={30} />
          <p className="mt-2">Loading form templates...</p>
        </div>
      ) : (
        <>
          {/* Standard Templates Section */}
          <div className="py-4 mb-4">
            <h4 className="text-center mb-4">Standard Templates</h4>
            <StandardTemplates 
              onSelectTemplate={(templateId) => {
                // Clear any previously rendered forms
                if (forms.length > 0) {
                  console.log('Clearing previously rendered forms');
                  // We're not modifying the forms array directly, just ensuring a clean state for the new selection
                }
                
                // Create a new form based on the selected template
                console.log(`SelectFormModal received template ID: ${templateId}`);
                // Ensure we're passing the correct template ID
                if (templateId === 'subject' || templateId === 'financial' || templateId === 'address') {
                  handleSelectTemplate(templateId);
                } else {
                  console.error(`Invalid template ID received: ${templateId}`);
                  toast.error('Error selecting template. Please try again.');
                }
              }}
            />
          </div>
          
          {/* Admin Dashboard Link - only visible to manager, admin, and jfar roles */}
          {hasRequiredRole() && (
            <div className="text-center mt-4">
              <p className="text-muted">Need more options? Create custom templates in the Admin Dashboard</p>
              <button 
                className="btn btn-outline-primary mt-2"
                onClick={() => window.location.href = '/admin'}
              >
                Go to Admin Dashboard
              </button>
            </div>
          )}
        </>
      )}
      
      <div className="modal-footer d-flex justify-content-end mt-3">
        <button 
          className="btn btn-secondary" 
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
};

export default SelectFormModal;
