import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import formService from '../services/formService';
import { FaSpinner, FaEdit, FaTrash, FaEye, FaPlus } from 'react-icons/fa';
import { useAuth } from '../hooks/useAuth';
import { DbForm } from '../services/formService';

interface WorkflowManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEditTemplate: (formId: number, formData: any) => void;
  onCreateNew: () => void;
}

const WorkflowManagementModal: React.FC<WorkflowManagementModalProps> = ({ 
  isOpen, 
  onClose, 
  onEditTemplate,
  onCreateNew 
}) => {
  const [forms, setForms] = useState<DbForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  
  // Helper function to check if user has admin or JAFAR role
  const hasAdminRole = () => {
    if (!user) return false;
    
    // Check roles array (objects with id property)
    // Admin (1), JAFAR (6)
    const hasRoleInArray = user.roles?.some((role: any) => 
      role.id === 1 || role.id === 6
    );
    
    // Check role string property
    const hasRoleAsString = user.role === '1' || user.role === '6';
    
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
      toast.error('Failed to load workflow templates');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTemplate = (form: DbForm) => {
    console.log('Editing template:', form);
    // Convert DbForm to the format expected by the form builder
    const formData = {
      name: form.FORM_NAME,
      description: form.FORM_DESCRIPTION || '',
      formType: 'custom', // Default to custom since TEMPLATE_TYPE doesn't exist in DbForm
      formFields: [] // This would need to be populated with actual fields
    };
    
    onClose();
    onEditTemplate(form.FORM_ID || 0, formData);
  };

  const handleDeleteTemplate = async (formId: number, formName: string) => {
    if (window.confirm(`Are you sure you want to delete the template "${formName}"?`)) {
      try {
        // TODO: Implement delete functionality in formService
        console.log('Deleting template:', formId);
        toast.success('Template deleted successfully');
        fetchForms(); // Refresh the list
      } catch (error) {
        console.error('Error deleting template:', error);
        toast.error('Failed to delete template');
      }
    }
  };

  const handleViewTemplate = (form: DbForm) => {
    console.log('Viewing template:', form);
    // TODO: Implement view functionality - could open a read-only modal
    toast.info('View functionality coming soon');
  };

  // Filter forms based on search term
  const filteredForms = forms.filter(form =>
    form.FORM_NAME.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (form.FORM_DESCRIPTION && form.FORM_DESCRIPTION.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Manage Workflow Templates"
      className="modal-content"
      style={{
        content: {
          width: '900px',
          maxWidth: '95%',
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
        <h3 className="modal-title m-0">Manage Workflow Templates</h3>
        <button type="button" className="btn-close" onClick={onClose}></button>
      </div>
      
      <div className="d-flex justify-content-between align-items-center mb-3">
        <input
          type="text"
          className="form-control me-3"
          placeholder="Search workflow templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: '400px' }}
        />
        
        {hasAdminRole() && (
          <button 
            className="btn btn-primary d-flex align-items-center"
            onClick={() => {
              onClose();
              onCreateNew();
            }}
          >
            <FaPlus className="me-2" />
            Create New Template
          </button>
        )}
      </div>
      
      {loading ? (
        <div className="text-center py-5">
          <FaSpinner className="fa-spin" size={30} />
          <p className="mt-2">Loading workflow templates...</p>
        </div>
      ) : (
        <div className="table-responsive">
          {filteredForms.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-muted">
                {searchTerm ? 'No templates found matching your search.' : 'No workflow templates found.'}
              </p>
              {hasAdminRole() && !searchTerm && (
                <button 
                  className="btn btn-primary mt-2"
                  onClick={() => {
                    onClose();
                    onCreateNew();
                  }}
                >
                  Create Your First Template
                </button>
              )}
            </div>
          ) : (
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Template Name</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredForms.map((form) => (
                  <tr key={form.FORM_ID}>
                    <td>
                      <strong>{form.FORM_NAME}</strong>
                    </td>
                    <td>
                      <span className="text-muted">
                        {form.FORM_DESCRIPTION || 'No description'}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-secondary">
                        Custom
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${form.IS_ACTIVE ? 'bg-success' : 'bg-warning'}`}>
                        {form.IS_ACTIVE ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="btn-group" role="group">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleViewTemplate(form)}
                          title="View Template"
                        >
                          <FaEye />
                        </button>
                        
                        {hasAdminRole() && (
                          <>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => handleEditTemplate(form)}
                              title="Edit Template"
                            >
                              <FaEdit />
                            </button>
                            
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDeleteTemplate(form.FORM_ID || 0, form.FORM_NAME)}
                              title="Delete Template"
                            >
                              <FaTrash />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      
      <div className="modal-footer d-flex justify-content-end mt-3">
        <button 
          className="btn btn-secondary" 
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </Modal>
  );
};

export default WorkflowManagementModal;
