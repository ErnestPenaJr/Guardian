import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import { FormField } from '../types/formBuilder';
import SimpleFormBuilder from './SimpleFormBuilder';
import formService from '../services/formService';
import { FaSpinner, FaSave, FaTimes } from 'react-icons/fa';

interface FormTemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId?: number;
  onSave?: () => void;
}

interface FormTemplateData {
  id?: number;
  name: string;
  description: string;
  formFields: FormField[];
}

const FormTemplateEditorModal: React.FC<FormTemplateEditorModalProps> = ({ 
  isOpen, 
  onClose, 
  formId,
  onSave 
}) => {
  const [formData, setFormData] = useState<FormTemplateData>({
    name: '',
    description: '',
    formFields: []
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // Load form data when modal opens
  useEffect(() => {
    if (isOpen && formId && initialLoad) {
      loadFormData();
      setInitialLoad(false);
    } else if (isOpen && !formId) {
      // New template - reset form
      setFormData({
        name: '',
        description: '',
        formFields: []
      });
      setInitialLoad(false);
    }
  }, [isOpen, formId, initialLoad]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setInitialLoad(true);
    }
  }, [isOpen]);

  const loadFormData = async () => {
    if (!formId) return;

    setLoading(true);
    try {
      console.log('Loading form data for editing:', formId);
      const response = await formService.getFormById(formId);
      
      // Convert database fields to form builder format
      const convertedFields = formService.convertDbFieldsToFormFields(response.fields);
      
      setFormData({
        id: formId,
        name: response.form.FORM_NAME,
        description: response.form.FORM_DESCRIPTION || '',
        formFields: convertedFields
      });
    } catch (error) {
      console.error('Error loading form data:', error);
      toast.error('Failed to load form template');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Form name is required');
      return;
    }

    setSaving(true);
    try {
      console.log('Saving form template:', formData);
      
      if (formData.id) {
        // Update existing template
        await formService.updateFormTemplate(formData.id, {
          name: formData.name,
          description: formData.description,
          formFields: formData.formFields
        });
        toast.success(`Form template "${formData.name}" updated successfully`);
      } else {
        // TODO: Create new template
        console.log('Creating new template not yet implemented');
        toast.info('Creating new templates is not yet implemented');
        return;
      }
      
      if (onSave) {
        onSave();
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving form template:', error);
      toast.error('Failed to save form template');
    } finally {
      setSaving(false);
    }
  };

  const handleFieldsChange = (fields: FormField[]) => {
    setFormData(prev => ({
      ...prev,
      formFields: fields
    }));
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      name: e.target.value
    }));
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      description: e.target.value
    }));
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleClose}
      contentLabel={formId ? "Edit Form Template" : "Create Form Template"}
      className="modal-dialog-lg"
      style={{
        content: {
          width: '95%',
          maxWidth: '1400px',
          height: '90vh',
          margin: '0',
          borderRadius: '8px',
          padding: '0',
          overflow: 'hidden',
          inset: '50% auto auto 50%',
          transform: 'translate(-50%, -50%)',
          border: '1px solid #ccc',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          backgroundColor: '#fff'
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
      <div className="h-100 d-flex flex-column">
        {/* Header */}
        <div className="modal-header justify-content-between align-items-center border-bottom p-2 px-3">
          <h3 className="modal-title">
            {formId ? `Edit Template: ${formData.name || 'Loading...'}` : 'Create New Template'}
          </h3>
          <button 
            type="button" 
            className="btn-close" 
            onClick={handleClose}
            disabled={saving}
          ></button>
        </div>

        {/* Content */}
        <div className="flex-grow-1 overflow-auto px-3 py-2">
          {loading ? (
            <div className="text-center py-5">
              <FaSpinner className="fa-spin" size={30} />
              <p className="mt-2">Loading form template...</p>
            </div>
          ) : (
            <div className="row">
              {/* Form Details Panel */}
              <div className="col-md-4 border-end">
                <div className="mb-3">
                  <h5>Template Details</h5>
                  
                  <div className="mb-3">
                    <label htmlFor="templateName" className="form-label">
                      Template Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      id="templateName"
                      className="form-control"
                      value={formData.name}
                      onChange={handleNameChange}
                      placeholder="Enter template name"
                      disabled={saving}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="templateDescription" className="form-label">
                      Description
                    </label>
                    <textarea
                      id="templateDescription"
                      className="form-control"
                      rows={3}
                      value={formData.description}
                      onChange={handleDescriptionChange}
                      placeholder="Enter template description"
                      disabled={saving}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Template Info</label>
                    <div className="small text-muted">
                      <p>Fields: {formData.formFields.length}</p>
                      <p>Type: {formId ? 'Existing Template' : 'New Template'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Builder Panel */}
              <div className="col-md-8">
                <h5 className="mb-3">Form Fields</h5>
                <div className="border rounded p-3">
                  <SimpleFormBuilder
                    formFields={formData.formFields}
                    onChange={handleFieldsChange}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer d-flex justify-content-end gap-2 px-3 py-2 border-top">
          <button 
            className="btn btn-secondary" 
            onClick={handleClose}
            disabled={saving}
          >
            <FaTimes className="me-2" />
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={saving || loading || !formData.name.trim()}
          >
            {saving ? (
              <>
                <FaSpinner className="fa-spin me-2" />
                Saving...
              </>
            ) : (
              <>
                <FaSave className="me-2" />
                Save Template
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default FormTemplateEditorModal;