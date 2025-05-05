import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import { FaUsers, FaClipboardList, FaCog, FaPalette } from 'react-icons/fa';

const AdminDashboard: React.FC<{ onShowUserManagement?: () => void }> = ({ onShowUserManagement }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <div>Loading...</div>; 
  }

  // Only allow users with admin role_id (1)
  if (!user || !user.roles || !user.roles.some((role: any) => role.id === 1)) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="container">
      <h2 className="text-2xl font-bold uppercase fs-2 mb-8">Admin Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Users Card - triggers callback to show user management */}
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
        {/* Requests Dashboard Card */}
        {/*
        <a
          href="/requests-dashboard"
          className="bg-white rounded-lg shadow p-6 flex flex-col items-center hover:bg-blue-50 transition"
        >
          <FaClipboardList className="h-12 w-12 text-secondary mb-4" />
          <h3 className="text-lg font-semibold mb-2">Requests Dashboard</h3>
          <ul className="text-gray-600">
            <li>View all requests</li>
            <li>Status tracking</li>
            <li>Request management</li>
          </ul>
        </a>
        */}
        {/* Account Card */}
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
          <FaClipboardList className="h-12 w-12 text-secondary mb-4" />
          <h3 className="text-lg font-semibold mb-2">Account</h3>
          <ul className="text-gray-600">
            <li>Licenses</li>
            <li>Setup</li>
            <li>Permissions</li>
          </ul>
        </div>
        {/* Settings Card */}
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
          <FaCog className="h-12 w-12 text-secondary mb-4" />
          <h3 className="text-lg font-semibold mb-2">Settings</h3>
          <ul className="text-gray-600">
            <li>Change password</li>
            <li>Update preferences</li>
            <li>Configurations</li>
          </ul>
        </div>
        {/* Style Guide Card */}
        <a
          href="#"
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
      </div>
    </div>
  );
};

export default AdminDashboard;
