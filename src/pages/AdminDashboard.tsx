import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { FaUsers, FaCog, FaPalette, FaProjectDiagram, FaTimes } from 'react-icons/fa';
import Modal from 'react-modal';
import EnhancedFormBuilder from '../components/EnhancedFormBuilder';
import NewRequestModal from '../pages/NewRequestModal';
import formService from '../services/formService';
import { toast } from 'react-toastify';

// Set the app element for accessibility
Modal.setAppElement('#root');

const AdminDashboard: React.FC<{ onShowUserManagement?: () => void }> = ({ onShowUserManagement }) => {
  const { user, loading } = useAuth();
  
  // State for modals
  const [enhancedFormBuilderModalOpen, setEnhancedFormBuilderModalOpen] = useState(false);
  const [enhancedFormFields, setEnhancedFormFields] = useState<any[]>([]);
  const [newRequestModalOpen, setNewRequestModalOpen] = useState(false);
  
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
          className="bg-white rounded-lg shadow p-6 flex flex-col items-center hover:bg-blue-50 transition"
          onClick={e => {
            e.preventDefault();
            // Add workflow navigation or action here
            // navigate('/workflow-manager');
          }}
        >
          <FaProjectDiagram className="h-12 w-12 text-secondary mb-4" />
          <h3 className="text-lg font-semibold mb-2">Workflow</h3>
          <ul className="text-gray-600">
            <li 
              className="cursor-pointer hover:text-secondary transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setNewRequestModalOpen(true);
              }}
            >
              Workflow templates
            </li>
            <li 
              data-component-name="AdminDashboard"
              className="cursor-pointer hover:text-secondary transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = '/admin-fields';
              }}
            >
              Manage Fields
            </li>
          </ul>
        </a>

        {/* Users Card - triggers callback to show user management - only visible to JAFAR (role 6) */}
        {((user.roles && user.roles.some((role: any) => role.id === 6)) || user.role === '6') && (
          <a
            href="#"
            className="bg-white rounded-lg shadow p-6 flex flex-col items-center hover:bg-blue-50 transition"
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

        {/* Style Guide Card */}
        <a
          href="/style-guide"
          className="bg-white rounded-lg shadow p-6 flex flex-col items-center hover:bg-blue-50 transition"
          onClick={e => {
            e.preventDefault();
            window.location.href = '/style-guide';
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

        {/* System Settings Card */}
        <a
          href="#"
          className="bg-white rounded-lg shadow p-6 flex flex-col items-center hover:bg-blue-50 transition"
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
          </ul>
        </a>
      </div>

      {/* Enhanced Form Builder Modal */}
      <Modal
        isOpen={enhancedFormBuilderModalOpen}
        onRequestClose={() => setEnhancedFormBuilderModalOpen(false)}
        contentLabel="Field Type Manager"
        className="modal-content xl-modal"
        overlayClassName="modal-overlay"
        style={{
          content: {
            width: '90%',
            maxWidth: '1400px',
            height: '90%',
            margin: 'auto',
            padding: '20px',
            borderRadius: '8px',
            backgroundColor: '#fff',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: 'none',
            overflow: 'auto',
            position: 'relative' as 'relative'
          },
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            position: 'fixed' as 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }
        }}
      >
        <div className="relative">
          <button
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 bg-transparent border-none p-2 rounded-full hover:bg-gray-100 transition"
            onClick={() => setEnhancedFormBuilderModalOpen(false)}
          >
            <FaTimes size={20} />
          </button>
          <h2 className="text-2xl font-bold mb-4">Field Type Manager</h2>
          <EnhancedFormBuilder
            formFields={enhancedFormFields}
            onChange={handleEnhancedFormFieldsChange}
            formType="fieldTypes"
          />
        </div>
      </Modal>
      {/* New Request Modal */}
      <NewRequestModal
        isOpen={newRequestModalOpen}
        onClose={() => setNewRequestModalOpen(false)}
        onSave={handleSaveForm}
      />
    </div>
  );
};

export default AdminDashboard;
