import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { FaUsers, FaClipboardList, FaCog } from 'react-icons/fa';

const AdminDashboard: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; 
  }

  // Only allow users with admin role_id (1)
  if (!user || !user.roles || !user.roles.includes(1)) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="container mt-5">
      <h2 className="text-2xl font-bold mb-8">Admin Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Users Card */}
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
          <FaUsers className="h-12 w-12 text-secondary mb-4" />
          <h3 className="text-lg font-semibold mb-2">Users</h3>
          <ul className="text-gray-600">
            <li>Add user</li>
            <li>Delete user</li>
            <li>Edit user</li>
          </ul>
        </div>
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
      </div>
    </div>
  );
};

export default AdminDashboard;
