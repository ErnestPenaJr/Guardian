import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash, FaSave, FaEye, FaCog, FaWrench, FaArrowLeft } from 'react-icons/fa';
import SimpleFormBuilder from './SimpleFormBuilder';
import { FormField } from '../types/formBuilder';

interface CustomWorkflowTemplate {
  FORM_ID: number;
  FORM_NAME: string;
  FORM_DESCRIPTION: string;
  IS_ACTIVE: boolean;
  CREATE_DATE: string;
  fieldCount?: number;
  fields?: any[];
}

interface CustomWorkflowTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CustomWorkflowTemplateModal: React.FC<CustomWorkflowTemplateModalProps> = ({
  isOpen,
  onClose
}) => {
  const [templates, setTemplates] = useState<CustomWorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CustomWorkflowTemplate | null>(null);
  const [showFieldBuilder, setShowFieldBuilder] = useState(false);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    formType: 'requests'
  });

  // Load custom templates
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/custom-templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Custom templates loaded:', data);
        setTemplates(data);
      } else {
        console.log('No custom templates found');
        setTemplates([]);
      }
    } catch (error) {
      console.error('Error loading custom templates:', error);
      toast.error('Failed to load custom templates');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  // Load templates when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  // Handle create new template
  const handleCreateTemplate = async () => {
    if (!formData.name.trim()) {
      toast.error('Template name is required');
      return;
    }

    try {
      // Convert FormField[] to the format expected by the API
      const fieldsForApi = formFields.map((field, index) => ({
        FIELD_NAME: field.fieldName,
        FIELD_TYPE_ID: field.dbFieldTypeId || 1,
        IS_REQUIRED: field.required || false,
        OPTIONS: field.options || null,
        SEQUENCE: index + 1,
        IS_ACTIVE: true,
        IS_DELETED: false,
        HELP_TEXT: field.helpText || null
      }));

      const response = await fetch('/api/custom-templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          form: {
            FORM_NAME: formData.name.trim(),
            FORM_DESCRIPTION: formData.description.trim(),
            FORM_TYPE: formData.formType,
            IS_PUBLIC: false,
            IS_ACTIVE: true,
            IS_DELETED: false,
            CUSTOM_TEMPLATE: true // Mark as custom template
          },
          fields: fieldsForApi
        })
      });

      if (response.ok) {
        toast.success('Custom template created successfully');
        setFormData({ name: '', description: '', formType: 'requests' });
        setFormFields([]);
        setShowCreateForm(false);
        setShowFieldBuilder(false);
        loadTemplates(); // Refresh the list
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to create custom template');
      }
    } catch (error) {
      console.error('Error creating custom template:', error);
      toast.error('Failed to create custom template');
    }
  };

  // Handle delete template
  const handleDeleteTemplate = async (templateId: number, templateName: string) => {
    if (!confirm(`Are you sure you want to delete the custom template "${templateName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/custom-templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success('Custom template deleted successfully');
        loadTemplates(); // Refresh the list
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to delete custom template');
      }
    } catch (error) {
      console.error('Error deleting custom template:', error);
      toast.error('Failed to delete custom template');
    }
  };

  // Handle template status toggle
  const handleToggleStatus = async (templateId: number, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/custom-templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          IS_ACTIVE: !currentStatus
        })
      });

      if (response.ok) {
        toast.success(`Template ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
        loadTemplates(); // Refresh the list
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update template status');
      }
    } catch (error) {
      console.error('Error updating template status:', error);
      toast.error('Failed to update template status');
    }
  };

  // Handle edit template fields
  const handleEditTemplate = async (template: CustomWorkflowTemplate) => {
    try {
      // Load template with its fields
      const response = await fetch(`/api/custom-templates/${template.FORM_ID}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const templateData = await response.json();
        console.log('🔍 DEBUG: Loaded template for editing:', templateData);
        
        setEditingTemplate(template);
        setFormData({
          name: template.FORM_NAME,
          description: template.FORM_DESCRIPTION || '',
          formType: 'requests'
        });
        
        // Convert API fields to FormField format
        const convertedFields: FormField[] = templateData.fields ? templateData.fields.map((field: any) => ({
          id: field.FIELD_ID.toString(),
          fieldName: field.FIELD_NAME,
          fieldType: 'text', // Default, will be determined by FIELD_TYPE_ID
          dbFieldTypeId: field.FIELD_TYPE_ID,
          required: field.IS_REQUIRED || false,
          options: field.OPTIONS || null,
          helpText: field.HELP_TEXT || ''
        })) : [];
        
        setFormFields(convertedFields);
        setShowFieldBuilder(true);
        setShowCreateForm(false);
      } else {
        toast.error('Failed to load template details');
      }
    } catch (error) {
      console.error('Error loading template for editing:', error);
      toast.error('Failed to load template details');
    }
  };

  // Handle save edited template
  const handleSaveEditedTemplate = async () => {
    if (!editingTemplate) return;

    try {
      // Convert FormField[] to the format expected by the API
      const fieldsForApi = formFields.map((field, index) => ({
        FIELD_NAME: field.fieldName,
        FIELD_TYPE_ID: field.dbFieldTypeId || 1,
        IS_REQUIRED: field.required || false,
        OPTIONS: field.options || null,
        SEQUENCE: index + 1,
        IS_ACTIVE: true,
        IS_DELETED: false,
        HELP_TEXT: field.helpText || null
      }));

      const response = await fetch(`/api/custom-templates/${editingTemplate.FORM_ID}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          form: {
            FORM_NAME: formData.name.trim(),
            FORM_DESCRIPTION: formData.description.trim(),
            FORM_TYPE: formData.formType
          },
          fields: fieldsForApi
        })
      });

      if (response.ok) {
        toast.success('Custom template updated successfully');
        setEditingTemplate(null);
        setFormData({ name: '', description: '', formType: 'requests' });
        setFormFields([]);
        setShowFieldBuilder(false);
        loadTemplates(); // Refresh the list
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update custom template');
      }
    } catch (error) {
      console.error('Error updating custom template:', error);
      toast.error('Failed to update custom template');
    }
  };

  // Handle form fields change
  const handleFormFieldsChange = (fields: FormField[]) => {
    setFormFields(fields);
  };

  // Handle cancel edit/create
  const handleCancel = () => {
    setShowCreateForm(false);
    setShowFieldBuilder(false);
    setEditingTemplate(null);
    setFormData({ name: '', description: '', formType: 'requests' });
    setFormFields([]);
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Custom Workflow Templates" 
      size="lg"
    >
      <div className="custom-template-modal">
        {showFieldBuilder ? (
          <div>
            {/* Field builder header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div className="d-flex align-items-center">
                <button 
                  className="btn btn-outline-secondary me-3"
                  onClick={handleCancel}
                >
                  <FaArrowLeft className="me-2" />
                  Back
                </button>
                <h5>
                  <FaCog className="me-2" />
                  {editingTemplate ? `Edit Template: ${editingTemplate.FORM_NAME}` : `Build Template: ${formData.name}`}
                </h5>
              </div>
              <button 
                className="btn btn-success"
                onClick={editingTemplate ? handleSaveEditedTemplate : handleCreateTemplate}
                disabled={!formData.name.trim()}
              >
                <FaSave className="me-2" />
                {editingTemplate ? 'Update Template' : 'Save Template'}
              </button>
            </div>

            {/* Template info */}
            <div className="card mb-4">
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6">
                    <label className="form-label">Template Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter template name"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Template Type</label>
                    <select
                      className="form-select"
                      value={formData.formType}
                      onChange={(e) => setFormData({ ...formData, formType: e.target.value })}
                    >
                      <option value="requests">Requests</option>
                      <option value="self-service">Self-Service</option>
                      <option value="notice">Notice</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter template description"
                  />
                </div>
              </div>
            </div>

            {/* Form builder */}
            <div className="form-builder-container" style={{ height: '60vh', border: '1px solid #dee2e6', borderRadius: '8px' }}>
              <SimpleFormBuilder
                formFields={formFields}
                onChange={handleFormFieldsChange}
                formId={editingTemplate?.FORM_ID}
              />
            </div>
          </div>
        ) : (
          <div>
            {/* Header with create button */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5>Manage Custom Templates</h5>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setFormData({ name: '', description: '', formType: 'requests' });
                  setFormFields([]);
                  setShowCreateForm(true);
                }}
              >
                <FaPlus className="me-2" />
                Create New Template
              </button>
            </div>

            {/* Create form */}
            {showCreateForm && (
              <div className="card mb-4">
                <div className="card-header">
                  <h6>Create New Custom Template</h6>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <label className="form-label">Template Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter template name"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Template Type</label>
                      <select
                        className="form-select"
                        value={formData.formType}
                        onChange={(e) => setFormData({ ...formData, formType: e.target.value })}
                      >
                        <option value="requests">Requests</option>
                        <option value="self-service">Self-Service</option>
                        <option value="notice">Notice</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter template description"
                    />
                  </div>
                  <div className="mt-3">
                    <button 
                      className="btn btn-success me-2"
                      onClick={() => {
                        if (!formData.name.trim()) {
                          toast.error('Template name is required');
                          return;
                        }
                        setShowFieldBuilder(true);
                      }}
                    >
                      <FaWrench className="me-2" />
                      Build Template
                    </button>
                    <button 
                      className="btn btn-secondary"
                      onClick={handleCancel}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Templates list */}
            <div className="templates-list">
              {loading ? (
                <div className="text-center p-4">
                  <div className="spinner-border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Loading custom templates...</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center p-4">
                  <div className="mb-3">
                    <FaEye size={48} className="text-muted" />
                  </div>
                  <h6>No Custom Templates Found</h6>
                  <p className="text-muted">Create your first custom workflow template to get started.</p>
                </div>
              ) : (
                <div className="row">
                  {templates.map((template) => (
                    <div key={template.FORM_ID} className="col-md-6 mb-3">
                      <div className="card">
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <h6 className="card-title">{template.FORM_NAME}</h6>
                              {template.FORM_DESCRIPTION && (
                                <p className="card-text text-muted small">
                                  {template.FORM_DESCRIPTION}
                                </p>
                              )}
                              <small className="text-muted">
                                Created: {new Date(template.CREATE_DATE).toLocaleDateString()}
                              </small>
                              {template.fieldCount && (
                                <div className="mt-1">
                                  <small className="text-info">{template.fieldCount} fields</small>
                                </div>
                              )}
                            </div>
                            <div className="d-flex flex-column">
                              <span 
                                className={`badge ${template.IS_ACTIVE ? 'bg-success' : 'bg-secondary'} mb-2`}
                              >
                                {template.IS_ACTIVE ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3">
                            <button
                              className="btn btn-sm btn-outline-primary me-2"
                              onClick={() => handleEditTemplate(template)}
                              title="Edit Template Fields"
                            >
                              <FaEdit className="me-1" />
                              Edit Fields
                            </button>
                            <button
                              className={`btn btn-sm ${template.IS_ACTIVE ? 'btn-outline-warning' : 'btn-outline-success'} me-2`}
                              onClick={() => handleToggleStatus(template.FORM_ID, template.IS_ACTIVE)}
                              title={template.IS_ACTIVE ? 'Deactivate' : 'Activate'}
                            >
                              {template.IS_ACTIVE ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDeleteTemplate(template.FORM_ID, template.FORM_NAME)}
                              title="Delete Template"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-top">
              <div className="d-flex justify-content-between align-items-center">
                <small className="text-muted">
                  Custom templates are only visible to users with JAFAR role (role_id 6)
                </small>
                <button className="btn btn-secondary" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CustomWorkflowTemplateModal;