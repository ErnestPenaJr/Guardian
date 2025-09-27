import React, { InputHTMLAttributes } from 'react';

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  className?: string;
}

/**
 * Checkbox component based on the Guardian style guide
 */
const Checkbox: React.FC<CheckboxProps> = ({
  label,
  className = '',
  ...props
}) => {
  return (
    <div className={`flex items-center ${className}`}>
      <input 
        type="checkbox" 
        className="w-5 h-5 text-primary focus:ring-primary" 
        style={{ borderRadius: '6px' }}
        {...props} 
      />
      {label && <label className="ml-2 text-body-sm">{label}</label>}
    </div>
  );
};

export default Checkbox;
