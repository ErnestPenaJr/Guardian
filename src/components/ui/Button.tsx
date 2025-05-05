import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'normal' | 'medium' | 'large';
  fullWidth?: boolean;
  className?: string;
}

/**
 * Button component based on the Guardian style guide
 */
const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'normal',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseClasses = 'font-semibold rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-opacity-50';
  
  const variantClasses = {
    primary: 'bg-primary text-white hover:bg-primary/90 focus:ring-primary',
    secondary: 'bg-secondary text-white hover:bg-secondary/90 focus:ring-secondary',
  };
  
  const sizeClasses = {
    small: 'py-2 px-4 text-body-sm',
    normal: 'py-3 px-6',
    medium: 'py-3 px-8',
    large: 'py-4 px-10',
  };
  
  const widthClass = fullWidth ? 'w-full' : '';
  
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
