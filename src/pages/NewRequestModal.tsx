import React, { useState } from 'react';
import Modal from 'react-modal';
import { FormField } from '../types/formBuilder';
import SimpleFormBuilder from '../components/SimpleFormBuilder';
import '../styles/FormCreationFlow.css';

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

const NewRequestModal: React.FC<NewRequestModalProps> = ({ isOpen, onClose, onSave, initialFormData }) => {
  const [step, setStep] = useState(initialFormData ? 2 : 0); // Skip to form builder if initialFormData is provided
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(initialFormData || {
    formType: '',
    name: '',
    description: '',
    formFields: [] as FormField[]
  });

  // Reset form when modal closes
  const handleClose = () => {
    setStep(initialFormData ? 2 : 0);
    setFormData(initialFormData || {
      formType: '',
      name: '',
      description: '',
      formFields: []
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

  // Save the form
  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(formData);
      handleClose();
    } catch (error) {
      console.error('Error saving form:', error);
      alert('Failed to save form. Please try again.');
    } finally {
      setSaving(false);
    }
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
          margin: 'auto',
          borderRadius: '8px',
          padding: '20px',
          maxHeight: '90vh',
          overflow: 'auto'
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      }}
      ariaHideApp={false}
    >
      <div className="modal-header d-flex justify-content-between align-items-center mb-4">
        <h3 className="modal-title m-0">
          {step === 0 && 'Configure your first form!'}
          {step === 1 && `Set up your: ${formData.formType} Form`}
          {step === 2 && 'Design your form'}
        </h3>
        <button type="button" className="btn-close" onClick={handleClose}></button>
      </div>
      
      {/* Step indicator */}
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
      
      {/* Step 3: Form Builder */}
      {step === 2 && (
        <div>
          <div className="form-builder-container">
            <SimpleFormBuilder 
              formFields={formData.formFields} 
              onChange={handleFormFieldsChange} 
              formId={undefined}
            />
          </div>
        </div>
      )}
      
      {/* Navigation Buttons */}
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
          onClick={step === 2 ? handleSave : nextStep}
          disabled={saving}
        >
          {step === 0 && 'Next'}
          {step === 1 && 'Next'}
          {step === 2 && (saving ? 'Saving...' : 'Save Form')}
        </button>
      </div>
    </Modal>
  );
};

export default NewRequestModal;
