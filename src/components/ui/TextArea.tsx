import React, { TextareaHTMLAttributes } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  status?: string;
  statusType?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}

/**
 * TextArea component based on the Guardian style guide
 */
const TextArea: React.FC<TextAreaProps> = ({
  label,
  status,
  statusType = 'default',
  className = '',
  ...props
}) => {
  const baseTextAreaClasses = 'w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all';
  
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
  
  const textAreaClasses = `${baseTextAreaClasses} ${statusClasses[statusType]} ${className}`;
  
  return (
    <div className="w-full">
      {label && <label className="block text-body-sm mb-1">{label}</label>}
      <textarea className={textAreaClasses} {...props} />
      {status && <p className={`text-body-xs ${statusTextClasses[statusType]} mt-1`}>{status}</p>}
    </div>
  );
};

export default TextArea;
