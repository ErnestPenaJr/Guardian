import React, { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

/**
 * Main layout component that applies consistent styling across the application
 * Based on the Guardian style guide
 */
const Layout: React.FC<LayoutProps> = ({ children, className = '' }) => {
  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {children}
      </div>
    </div>
  );
};

export default Layout;
