import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import AdminFormGroupFields from './AdminFormGroupFields';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';

const AdminFormGroupFieldsPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  
  // Redirect if user is not authenticated or doesn't have admin role
  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;
  
  if (!user) return <Navigate to="/login" />;
  
  const isAdmin = user.roles?.some((role: any) => role.id === 1 || role.id === 6) ||
    user.role === '1' || user.role === '6';

  if (!isAdmin) return <Navigate to="/home" />;

  if (!groupId || isNaN(Number(groupId))) {
    return <div className="text-center py-10">Invalid group ID provided</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center py-6">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/admin-forms-groups')}
              className="mr-4 text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <FaArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Manage Form Group Fields</h1>
          </div>
        </div>

        {/* Main content */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md p-6">
          <AdminFormGroupFields groupId={Number(groupId)} />
        </div>
      </div>
    </div>
  );
};

export default AdminFormGroupFieldsPage;
