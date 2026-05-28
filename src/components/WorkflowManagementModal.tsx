import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import formService from '../services/formService';
import { FaSpinner, FaEdit, FaTrash, FaEye, FaPlus, FaCopy } from 'react-icons/fa';
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

  // Helper: true only for Super Admin / JAFAR (role 6)
  const isJafarUser = (): boolean => {
    if (!user) return false;
    if (user.roles && user.roles.some((r: any) => r.id === 6)) return true;
    if (user.role === '6') return true;
    return false;
  };

  // Helper: true for forms that are platform-wide global templates
  // IS_PUBLIC can arrive as boolean (Prisma-coerced) or number 1 (raw BIT), so accept both —
  // matches lib/globalForms.cjs::isGlobalForm. Without this, the badge/lock/clone never render.
  const isGlobalForm = (form: DbForm): boolean =>
    form.COMPANY_ID == null &&
    form.ORGANIZATION_ID == null &&
    ((form.IS_PUBLIC as unknown) === 1 || form.IS_PUBLIC === true);

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

  const handleEditTemplate = async (form: DbForm) => {
    console.log('Editing template:', form);
    try {
      // Fetch the complete form data with fields before closing modal
      const response = await formService.getFormById(form.FORM_ID || 0);
      
      // Convert DbForm to the format expected by the form builder
      const formData = {
        name: form.FORM_NAME,
        description: form.FORM_DESCRIPTION || '',
        formType: 'custom', // Default to custom since TEMPLATE_TYPE doesn't exist in DbForm
        formFields: response.fields || [] // Use the fetched fields
      };
      
      onClose();
      onEditTemplate(form.FORM_ID || 0, formData);
    } catch (error) {
      console.error('Error fetching form data for editing:', error);
      toast.error('Failed to load form data for editing. You may not have permission to edit this template.');
      // Don't close the modal if there's an error
    }
  };

  const handleDeleteTemplate = async (formId: number, formName: string) => {
    // Show confirmation dialog with detailed warning
    const result = await Swal.fire({
      title: 'Delete Workflow Template?',
      html: `
        <div class="text-start">
          <p><strong>Are you sure you want to delete "${formName}"?</strong></p>
          <div class="alert alert-warning mt-3">
            <strong>⚠️ Warning:</strong> This will permanently delete:
            <ul class="mt-2 mb-0">
              <li>The workflow template and all its fields</li>
              <li>All requests created using this template</li>
              <li>All form submissions and data</li>
              <li>All tasks and attachments related to these requests</li>
              <li>All notifications related to these requests</li>
            </ul>
          </div>
          <p class="text-danger mt-2"><strong>This action cannot be undone!</strong></p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete everything',
      cancelButtonText: 'Cancel',
      width: 600
    });

    if (result.isConfirmed) {
      try {
        console.log('Deleting workflow template:', formId, formName);
        await formService.deleteForm(formId);
        
        await Swal.fire({
          title: 'Deleted!',
          text: `Workflow template "${formName}" and all associated data has been deleted successfully.`,
          icon: 'success',
          timer: 3000,
          showConfirmButton: false
        });
        
        fetchForms(); // Refresh the list
      } catch (error: any) {
        console.error('Error deleting template:', error);
        
        await Swal.fire({
          title: 'Delete Failed',
          text: error.response?.data?.error || error.message || 'Failed to delete workflow template',
          icon: 'error'
        });
      }
    }
  };

  const handleCloneTemplate = async (form: DbForm) => {
    if (!form.FORM_ID) return;
    try {
      const result = await formService.cloneForm(form.FORM_ID);
      toast.success(`Template cloned as "${result.FORM_NAME}". Edit it from your company templates.`);
      await fetchForms();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to clone template';
      toast.error(msg);
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
          width: '1200px',
          maxWidth: '95%',
          margin: '0',
          borderRadius: '8px',
          padding: '12px',
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
      <div className="modal-header d-flex justify-content-between align-items-center mb-3">
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
                      <span className="d-inline-flex align-items-center">
                        <strong>{form.FORM_NAME}</strong>
                        {isGlobalForm(form) && (
                          <span
                            className="badge bg-primary ms-2"
                            data-testid={`global-badge-${form.FORM_ID}`}
                          >
                            🌐 Global
                          </span>
                        )}
                      </span>
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
                              disabled={isGlobalForm(form) && !isJafarUser()}
                              title={isGlobalForm(form) && !isJafarUser() ? 'Only JAFAR users can edit global templates' : 'Edit Template'}
                            >
                              <FaEdit />
                            </button>

                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDeleteTemplate(form.FORM_ID || 0, form.FORM_NAME)}
                              disabled={isGlobalForm(form) && !isJafarUser()}
                              title={isGlobalForm(form) && !isJafarUser() ? 'Only JAFAR users can delete global templates' : 'Delete Template'}
                            >
                              <FaTrash />
                            </button>

                            {isGlobalForm(form) && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-info"
                                onClick={() => handleCloneTemplate(form)}
                                title="Create an editable copy in your company"
                                data-testid={`clone-global-${form.FORM_ID}`}
                              >
                                <FaCopy className="me-1" />Clone
                              </button>
                            )}
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
      
      <div className="modal-footer d-flex justify-content-end mt-2">
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
