import React, { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  status?: string;
  statusType?: 'default' | 'success' | 'warning' | 'error';
  icon?: ReactNode;
  className?: string;
}

/**
 * Input component based on the Guardian style guide
 */
const Input: React.FC<InputProps> = ({
  label,
  status,
  statusType = 'default',
  icon,
  className = '',
  ...props
}) => {
  const baseInputClasses = 'w-full px-4 py-3 rounded-full border focus:outline-none focus:ring-2 transition-all';
  
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
  
  const inputClasses = `${baseInputClasses} ${statusClasses[statusType]} ${icon ? 'pl-10' : ''} ${className}`;
  
  return (
    <div className="w-full">
      {label && <label className="block text-body-sm mb-1">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {icon}
          </div>
        )}
        <input className={inputClasses} {...props} />
      </div>
      {status && <p className={`text-body-xs ${statusTextClasses[statusType]} mt-1`}>{status}</p>}
    </div>
  );
};

export default Input;
