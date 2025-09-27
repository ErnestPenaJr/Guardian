import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  noAccent?: boolean; // Option to disable the blue accent stripe
}

/**
 * Card component based on the Guardian style guide
 */
const Card: React.FC<CardProps> = ({ children, className = '', noAccent = false }) => {
  const accentClasses = noAccent ? '' : 'border-t-4 border-t-secondary';
  return (
    <div className={`bg-white p-6 shadow-sm border border-gray-200 ${accentClasses} ${className}`} style={{ borderRadius: '6px' }}>
      {children}
    </div>
  );
};

export default Card;
