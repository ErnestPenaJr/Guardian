import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import AdminFieldsLookup from './AdminFieldsLookup';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';

const AdminFieldsLookupPage: React.FC = () => {
  const { fieldId } = useParams<{ fieldId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  
  // Redirect if user is not authenticated or doesn't have admin role
  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;
  
  if (!user) return <Navigate to="/login" />;
  
  if (!user.roles.includes('admin')) {
    return <Navigate to="/dashboard" />;
  }

  if (!fieldId || isNaN(Number(fieldId))) {
    return <div className="text-center py-10">Invalid field ID provided</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center py-6">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/admin/fields')}
              className="mr-4 text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <FaArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Manage Field Lookups</h1>
          </div>
        </div>

        {/* Main content */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md p-6">
          <AdminFieldsLookup fieldId={Number(fieldId)} />
        </div>
      </div>
    </div>
  );
};

export default AdminFieldsLookupPage;
