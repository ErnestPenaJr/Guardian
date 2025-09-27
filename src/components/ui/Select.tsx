import React, { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  status?: string;
  statusType?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}

/**
 * Select component based on the Guardian style guide
 */
const Select: React.FC<SelectProps> = ({
  label,
  status,
  statusType = 'default',
  className = '',
  children,
  ...props
}) => {
  const baseSelectClasses = 'w-full px-4 py-3 border appearance-none bg-white focus:outline-none focus:ring-2 pr-10';
  
  const statusClasses = {
    default: 'border-gray-5 focus:ring-secondary focus:border-transparent',
    success: 'border-success focus:ring-success focus:border-transparent',
    warning: 'border-warning focus:ring-warning focus:border-transparent',
    error: 'border-error focus:ring-error focus:border-transparent',
  };
  
  const statusTextClasses = {
    default: 'text-gray-3',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
  };
  
  const selectClasses = `${baseSelectClasses} ${statusClasses[statusType]} ${className}`;
  
  return (
    <div className="w-full">
      {label && <label className="block text-body-sm mb-1">{label}</label>}
      <div className="relative">
        <select className={selectClasses} style={{ borderRadius: '6px' }} {...props}>
          {children}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
          <svg className="w-5 h-5 text-gray-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>
      </div>
      {status && <p className={`text-body-xs ${statusTextClasses[statusType]} mt-1`}>{status}</p>}
    </div>
  );
};

export default Select;
