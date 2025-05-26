import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import formService from '../services/formService';
import { FaSpinner, FaCheck, FaFileAlt } from 'react-icons/fa';
import StandardTemplates from './StandardTemplates';

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
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  const handleSelectForm = () => {
    if (selectedFormId) {
      onSelectForm(selectedFormId);
    } else {
      toast.warning('Please select a form template');
    }
  };
  
  // Handle selection of a standard template
  const handleSelectTemplate = (templateId: string) => {
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
          IS_DELETED: false
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
        onSelectForm(0, { form: subjectForm, fields: subjectFields });
        break;
        
      case 'financial':
        // Create a FINANCIAL template form
        const financialForm = {
          FORM_ID: 0,
          FORM_NAME: 'FINANCIAL Template',
          FORM_DESCRIPTION: 'Bank Name, Account #, Routing #',
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false
        };
        
        // Fields for FINANCIAL template
        const financialFields = [
          { FIELD_NAME: 'Bank Name', FIELD_TYPE_ID: 1, IS_REQUIRED: true, OPTIONS: null, SEQUENCE: 1, IS_ACTIVE: true, IS_DELETED: false },
          { FIELD_NAME: 'Account #', FIELD_TYPE_ID: 1, IS_REQUIRED: true, OPTIONS: null, SEQUENCE: 2, IS_ACTIVE: true, IS_DELETED: false },
          { FIELD_NAME: 'Routing #', FIELD_TYPE_ID: 1, IS_REQUIRED: true, OPTIONS: null, SEQUENCE: 3, IS_ACTIVE: true, IS_DELETED: false }
        ];
        
        // Close this modal and open the form for the user to fill out
        onClose();
        onSelectForm(0, { form: financialForm, fields: financialFields });
        break;
        
      case 'address':
        // Create an ADDRESS template form
        const addressForm = {
          FORM_ID: 0,
          FORM_NAME: 'ADDRESS Template',
          FORM_DESCRIPTION: 'Address Line 1, Address Line 2, City, State, ZIP Code',
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false
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
        onSelectForm(0, { form: addressForm, fields: addressFields });
        break;
        
      default:
        toast.error('Unknown template type');
    }
  };

  // Filter forms based on search term
  const filteredForms = forms.filter(form => 
    form.FORM_NAME.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (form.FORM_DESCRIPTION || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          margin: 'auto',
          borderRadius: '8px',
          padding: '20px',
          maxHeight: '90vh',
          overflow: 'auto'
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
                // Create a new form based on the selected template
                handleSelectTemplate(templateId);
              }}
            />
          </div>
          
          {/* Custom Templates Section */}
          {forms.length === 0 ? (
            <div className="text-center mt-4">
              <p className="text-muted">Or create custom templates in the Admin Dashboard</p>
              <button 
                className="btn btn-outline-primary mt-2"
                onClick={() => window.location.href = '/admin'}
              >
                Go to Admin Dashboard
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <h4 className="text-center mb-4">Custom Templates</h4>
              <div className="form-templates-list">
                {filteredForms.map(form => (
                  <div 
                    key={form.FORM_ID}
                    className={`form-template-item p-3 mb-3 border rounded ${selectedFormId === form.FORM_ID ? 'border-primary bg-light' : ''}`}
                    onClick={() => setSelectedFormId(form.FORM_ID || 0)}
                  >
                    <div className="d-flex align-items-center">
                      <div className="form-template-icon me-3">
                        <FaFileAlt size={24} className="text-secondary" />
                      </div>
                      <div className="form-template-details flex-grow-1">
                        <h5 className="mb-1">{form.FORM_NAME}</h5>
                        <p className="text-muted mb-1">{form.FORM_DESCRIPTION || 'No description'}</p>
                        <div className="d-flex align-items-center">
                          <span className="badge bg-info me-2">Form</span>
                          <small className="text-muted">Form Template</small>
                        </div>
                      </div>
                      {selectedFormId === form.FORM_ID && (
                        <div className="form-template-selected">
                          <FaCheck className="text-success" size={20} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      
      <div className="modal-footer d-flex justify-content-between mt-3">
        <button 
          className="btn btn-secondary" 
          onClick={onClose}
        >
          Cancel
        </button>
        <button 
          className="btn btn-primary" 
          onClick={handleSelectForm}
          disabled={!selectedFormId || loading}
        >
          Use Selected Template
        </button>
      </div>
    </Modal>
  );
};

export default SelectFormModal;
