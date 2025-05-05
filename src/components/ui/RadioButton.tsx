import React, { InputHTMLAttributes } from 'react';

interface RadioButtonProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  className?: string;
}

/**
 * RadioButton component based on the Guardian style guide
 */
const RadioButton: React.FC<RadioButtonProps> = ({
  label,
  className = '',
  ...props
}) => {
  return (
    <div className={`flex items-center ${className}`}>
      <input 
        type="radio" 
        className="w-5 h-5 text-primary focus:ring-primary" 
        {...props} 
      />
      {label && <label className="ml-2 text-body-sm">{label}</label>}
    </div>
  );
};

export default RadioButton;
