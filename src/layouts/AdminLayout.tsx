import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * AdminLayout - A minimal layout component for admin pages
 * Provides consistent structure for admin pages without duplicating the sidebar
 */
const AdminLayout: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main content with proper spacing to match Home layout */}
      <div className="flex flex-col pl-20">
        {/* Content area */}
        <main className="flex-1 flex flex-col mt-16 px-2 sm:px-4 md:px-8 py-4 md:py-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
