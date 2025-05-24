import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import { FaUsers, FaClipboardList, FaCog, FaPalette, FaProjectDiagram, FaTimes } from 'react-icons/fa';
import Modal from 'react-modal';
import SimpleFormBuilder from '../components/SimpleFormBuilder';

// Set the app element for accessibility
Modal.setAppElement('#root');

const AdminDashboard: React.FC<{ onShowUserManagement?: () => void }> = ({ onShowUserManagement }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  // State for the form builder modal
  const [formBuilderModalOpen, setFormBuilderModalOpen] = useState(false);
  const [formFields, setFormFields] = useState<any[]>([]);
  
  // Handle form field changes
  const handleFormFieldsChange = (updatedFields: any) => {
    setFormFields(updatedFields);
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
            <li>Process management</li>
            <li 
              className="cursor-pointer hover:text-secondary transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setFormBuilderModalOpen(true);
              }}
            >
              Workflow templates
            </li>
            <li>Automation rules</li>
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
          href="#"
          className="bg-white rounded-lg shadow p-6 flex flex-col items-center hover:bg-blue-50 transition"
          onClick={e => {
            e.preventDefault();
            // Navigate to style guide
            // navigate('/style-guide');
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

      {/* Form Builder Modal */}
      <Modal
        isOpen={formBuilderModalOpen}
        onRequestClose={() => setFormBuilderModalOpen(false)}
        contentLabel="Form Builder"
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
            onClick={() => setFormBuilderModalOpen(false)}
          >
            <FaTimes size={20} />
          </button>
          <h2 className="text-2xl font-bold mb-4">Workflow Template Builder</h2>
          <SimpleFormBuilder
            formFields={formFields}
            onChange={handleFormFieldsChange}
          />
        </div>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
