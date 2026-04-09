import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface RequireJafarProps {
    children: React.ReactNode;
}

/**
 * Route guard that restricts access to users with Jafar role (role ID 6).
 * Non-Jafar users are redirected to /home. Use this to wrap routes that
 * should only be visible to platform administrators.
 *
 * Example:
 *   <Route path="/jafar/site-analysis" element={
 *     <RequireJafar><SiteAnalysis /></RequireJafar>
 *   } />
 */
const RequireJafar: React.FC<RequireJafarProps> = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="container py-4">Loading...</div>;
    }

    const isJafar =
        !!user &&
        (
            (Array.isArray((user as any).roles) && (user as any).roles.some((role: any) => role.id === 6)) ||
            (user as any).role === '6'
        );

    if (!isJafar) {
        return <Navigate to="/home" replace />;
    }

    return <>{children}</>;
};

export default RequireJafar;
