import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import { FaUsers, FaCog, FaPalette, FaProjectDiagram, FaChartBar, FaUserShield } from 'react-icons/fa';
import ReactModal from 'react-modal';
import Modal from '../components/Modal';
import EnhancedFormBuilder from '../components/EnhancedFormBuilder';
import NewRequestModal from '../pages/NewRequestModal';
import CreateTemplateModal from '../components/CreateTemplateModal';
import AdminFormsGroupsModal from '../components/AdminFormsGroupsModal';
import AdminFields from '../pages/AdminFields';
import WorkflowManagementModal from '../components/WorkflowManagementModal';
import FormTemplateEditorModal from '../components/FormTemplateEditorModal';
import CustomWorkflowTemplateModal from '../components/CustomWorkflowTemplateModal';
import formService from '../services/formService';
import { toast } from 'react-toastify';

// Set the app element for accessibility for react-modal
ReactModal.setAppElement('#root');

const AdminDashboard: React.FC<{
  onShowUserManagement?: () => void;
  onShowJafarAdministration?: () => void;
  onShowJafarSiteAnalysis?: () => void;
  onShowJafarUserManagement?: () => void;
  onShowJafarRoleSettings?: () => void;
}> = ({ onShowUserManagement, onShowJafarAdministration, onShowJafarSiteAnalysis, onShowJafarUserManagement, onShowJafarRoleSettings }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  // State for modals
  const [enhancedFormBuilderModalOpen, setEnhancedFormBuilderModalOpen] = useState(false);
  const [enhancedFormFields, setEnhancedFormFields] = useState<any[]>([]);
  const [newRequestModalOpen, setNewRequestModalOpen] = useState(false);
  const [createTemplateModalOpen, setCreateTemplateModalOpen] = useState(false);
  const [formsGroupsModalOpen, setFormsGroupsModalOpen] = useState(false);
  const [adminFieldsModalOpen, setAdminFieldsModalOpen] = useState(false);
  const [workflowManagementModalOpen, setWorkflowManagementModalOpen] = useState(false);
  const [templateEditorModalOpen, setTemplateEditorModalOpen] = useState(false);
  const [customTemplateModalOpen, setCustomTemplateModalOpen] = useState(false);
  const [editingFormId, setEditingFormId] = useState<number | undefined>(undefined);
  const [editingFormData, setEditingFormData] = useState<any>(null);
  
  // Helper function to check if user has role_id 6 (JAFAR)
  const isJafarUser = () => {
    if (!user) return false;
    
    // Check roles array
    if (user.roles && user.roles.some((role: any) => role.id === 6)) {
      return true;
    }
    
    // Check role property as string
    if (user.role === '6') {
      return true;
    }
    
    return false;
  };
  
  // Handle enhanced form field changes
  const handleEnhancedFormFieldsChange = (updatedFields: any) => {
    setEnhancedFormFields(updatedFields);
  };
  
  // Handle form save
  const handleSaveForm = async (formData: any) => {
    try {
      // Create the form using the formService
      const formToSave: any = {
        FORM_NAME: formData.name,
        FORM_DESCRIPTION: formData.description,
        IS_PUBLIC: true,
        IS_ACTIVE: true,
        IS_DELETED: false,
        FORM_TYPE: formData.formType.toLowerCase()
      };
      
      // Convert form fields to DB fields format if needed
      const fieldsToSave = formData.formFields.map((field: any, index: number) => ({
        FIELD_NAME: field.fieldName,
        FIELD_TYPE_ID: field.dbFieldTypeId || 1, // Default to text if not specified
        IS_REQUIRED: field.required || false,
        OPTIONS: field.options || null,
        SEQUENCE: index + 1,
        IS_ACTIVE: true,
        IS_DELETED: false
      }));
      
      await formService.createForm(formToSave, fieldsToSave);
      toast.success('Form created successfully');
    } catch (error: any) {
      console.error('Error saving form:', error);
      toast.error(error.response?.data?.error || error.message || 'Failed to save form');
    }
  };

  // Handle workflow template editing
  const handleEditTemplate = async (formId: number, formData: any) => {
    console.log('Opening template editor for form:', formId);
    
    // Open the template editor modal
    setEditingFormId(formId);
    setTemplateEditorModalOpen(true);
  };

  // Handle creating new workflow template
  const handleCreateNewTemplate = () => {
    console.log('Creating new workflow template');
    setEditingFormData(null); // Clear any existing editing data
    setCreateTemplateModalOpen(true); // Open the redesigned metadata modal
  };

  // Handle template editor save/close
  const handleTemplateEditorSave = () => {
    console.log('Template saved, refreshing workflow management modal');
    // The WorkflowManagementModal will need to refresh its data
    // This could trigger a refresh in the parent or the modal itself
  };

  const handleTemplateEditorClose = () => {
    setTemplateEditorModalOpen(false);
    setEditingFormId(undefined);
  };

  if (loading) {
    return <div>Loading...</div>; 
  }

  // Allow users with admin role_id (1) or JAFAR role_id (6)
  if (!user || 
      ((!user.roles || !user.roles.some((role: any) => role.id === 1 || role.id === 6)) && 
       (user.role !== '1' && user.role !== '6'))) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="container">
      <h2 className="text-2xl font-bold uppercase fs-2 mb-8">Admin Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Workflow Card */}
        <a
          href="#"
          className="bg-white shadow-sm p-6 flex flex-col items-center transition-colors duration-200 border border-gray-200 border-t-4 border-t-secondary"
          style={{
            borderRadius: '6px',
            backgroundColor: '#FFFFFF'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
          onClick={(e) => {
            e.preventDefault();
            setCustomTemplateModalOpen(true);
          }}
        >
          <FaProjectDiagram className="h-12 w-12 text-secondary mb-4" />
          <h3 className="text-lg font-semibold mb-2">Workflow</h3>
          <ul className="text-gray-600">
            <li>Create & manage templates</li>
            <li>Configure form fields</li>
            <li>Automate request flows</li>
          </ul>
        </a>

        {/* Users Card - triggers callback to show user management - visible to admin (role 1) and JAFAR (role 6) */}
        {((user.roles && user.roles.some((role: any) => role.id === 1 || role.id === 6)) || user.role === '1' || user.role === '6') && (
          <a
            href="#"
            className="bg-white shadow-sm p-6 flex flex-col items-center transition-colors duration-200 border border-gray-200 border-t-4 border-t-secondary"
            style={{ 
              borderRadius: '6px',
              backgroundColor: '#FFFFFF'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
            onClick={e => {
              e.preventDefault();
              onShowUserManagement && onShowUserManagement();
            }}
          >
            <FaUsers className="h-12 w-12 text-secondary mb-4" />
            <h3 className="text-lg font-semibold mb-2">User Management</h3>
            <ul className="text-gray-600">
              <li>View users & invites</li>
              <li>Add, edit, delete users</li>
              <li>Manage invitations</li>
            </ul>
          </a>
        )}

        {isJafarUser() && (
          <a
            href="#"
            className="bg-white shadow-sm p-6 flex flex-col items-center transition-colors duration-200 border border-gray-200 border-t-4 border-t-danger"
            style={{
              borderRadius: '6px',
              backgroundColor: '#FFFFFF'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff5f5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
            onClick={e => {
              e.preventDefault();
              onShowJafarAdministration && onShowJafarAdministration();
            }}
          >
            <FaUsers className="h-12 w-12 text-danger mb-4" />
            <h3 className="text-lg font-semibold mb-2">JAFAR Hard Delete</h3>
            <ul className="text-gray-600">
              <li>Preview destructive purges</li>
              <li>Hard delete users</li>
              <li>Wipe an entire company</li>
            </ul>
          </a>
        )}

        {isJafarUser() && (
          <a
            href="#"
            className="bg-white shadow-sm p-6 flex flex-col items-center transition-colors duration-200 border border-gray-200 border-t-4 border-t-indigo-500"
            style={{
              borderRadius: '6px',
              backgroundColor: '#FFFFFF'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0ff'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
            onClick={e => {
              e.preventDefault();
              onShowJafarUserManagement && onShowJafarUserManagement();
            }}
          >
            <FaUserShield className="h-12 w-12 text-indigo-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">JAFAR Users</h3>
            <ul className="text-gray-600">
              <li>Add shieldilytics accounts</li>
              <li>Remove platform users</li>
              <li>Manage Jafar access</li>
            </ul>
          </a>
        )}

        {isJafarUser() && (
          <a
            href="#"
            className="bg-white shadow-sm p-6 flex flex-col items-center transition-colors duration-200 border border-gray-200 border-t-4 border-t-primary"
            style={{
              borderRadius: '6px',
              backgroundColor: '#FFFFFF'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f7ff'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
            onClick={e => {
              e.preventDefault();
              onShowJafarSiteAnalysis && onShowJafarSiteAnalysis();
            }}
          >
            <FaChartBar className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Site Analysis</h3>
            <ul className="text-gray-600">
              <li>Cross-company usage metrics</li>
              <li>Platform activity trends</li>
              <li>Company breakdown</li>
            </ul>
          </a>
        )}

        {isJafarUser() && (
          <a
            href="#"
            className="bg-white shadow-sm p-6 flex flex-col items-center transition-colors duration-200 border border-gray-200 border-t-4 border-t-primary"
            style={{ borderRadius: '6px', backgroundColor: '#FFFFFF' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f7ff'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
            onClick={e => {
              e.preventDefault();
              if (onShowJafarRoleSettings) onShowJafarRoleSettings();
            }}
          >
            <FaUserShield className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Role Access Matrix</h3>
            <ul className="text-gray-600">
              <li>Edit feature permissions per role</li>
              <li>Manage External User allowlists</li>
              <li>Reset to defaults</li>
            </ul>
          </a>
        )}

        {/* Style Guide Card - Hidden */}
        {/*
        <a
          href="/style-guide"
          className="bg-white rounded-lg shadow p-6 flex flex-col items-center hover:bg-blue-50 transition"
          onClick={e => {
            e.preventDefault();
            navigate('/style-guide');
          }}
        >
          <FaPalette className="h-12 w-12 text-secondary mb-4" />
          <h3 className="text-lg font-semibold mb-2">Style Guide</h3>
          <ul className="text-gray-600">
            <li>Design system</li>
            <li>UI components</li>
            <li>Brand guidelines</li>
          </ul>
        </a>
        */}

        {/* System Settings Card */}
        <a
          href="#"
          className="bg-white shadow-sm p-6 flex flex-col items-center transition-colors duration-200 border border-gray-200 border-t-4 border-t-secondary"
          style={{ 
            borderRadius: '6px',
            backgroundColor: '#FFFFFF'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
          onClick={e => {
            e.preventDefault();
            // Navigate to system settings
            // navigate('/system-settings');
          }}
        >
          <FaCog className="h-12 w-12 text-secondary mb-4" />
          <h3 className="text-lg font-semibold mb-2">System Settings</h3>
          <ul className="text-gray-600">
            <li>General settings</li>
            <li>Email templates</li>
            <li>Notification settings</li>
            <li 
              className="cursor-pointer hover:text-secondary transition-colors mt-2 border-t border-gray-200 pt-2"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/style-guide');
              }}
            >
              📖 Style Guide
            </li>
          </ul>
        </a>
      </div>

      {/* Enhanced Form Builder Modal */}
      <Modal
        isOpen={enhancedFormBuilderModalOpen}
        onClose={() => setEnhancedFormBuilderModalOpen(false)}
        title="Field Type Manager"
        size="xl"
      >
        <div className="h-[80vh] overflow-auto">
          <EnhancedFormBuilder
            formFields={enhancedFormFields}
            onChange={handleEnhancedFormFieldsChange}
            formType="fieldTypes"
          />
        </div>
      </Modal>
      {/* New Request Modal (retained for template-fill flow) */}
      <NewRequestModal
        isOpen={newRequestModalOpen}
        onClose={() => {
          setNewRequestModalOpen(false);
          setEditingFormData(null); // Clear editing data when modal closes
        }}
        onSave={handleSaveForm}
        initialFormData={editingFormData}
      />

      {/* Create Template Modal — entry point for building a new template */}
      <CreateTemplateModal
        isOpen={createTemplateModalOpen}
        onClose={() => setCreateTemplateModalOpen(false)}
      />

      {/* Forms Groups Modal */}
      <AdminFormsGroupsModal
        isOpen={formsGroupsModalOpen}
        onClose={() => setFormsGroupsModalOpen(false)}
      />
      
      {/* Admin Fields Modal */}
      <Modal
        isOpen={adminFieldsModalOpen}
        onClose={() => setAdminFieldsModalOpen(false)}
        title="Field Management"
        size="full"
        className="h-auto max-h-[90vh]"
      >
        <div className="p-4">
          <AdminFields isModal={true} />
        </div>
      </Modal>
      
      {/* Workflow Management Modal */}
      <WorkflowManagementModal
        isOpen={workflowManagementModalOpen}
        onClose={() => setWorkflowManagementModalOpen(false)}
        onEditTemplate={handleEditTemplate}
        onCreateNew={handleCreateNewTemplate}
      />

      {/* Form Template Editor Modal */}
      <FormTemplateEditorModal
        isOpen={templateEditorModalOpen}
        onClose={handleTemplateEditorClose}
        formId={editingFormId}
        onSave={handleTemplateEditorSave}
      />

      {/* Custom Workflow Template Modal - Only for JAFAR users */}
      {isJafarUser() && (
        <CustomWorkflowTemplateModal
          isOpen={customTemplateModalOpen}
          onClose={() => setCustomTemplateModalOpen(false)}
          onCreateNew={handleCreateNewTemplate}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
