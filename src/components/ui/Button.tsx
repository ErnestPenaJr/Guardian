import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'small' | 'normal' | 'medium' | 'large';
  fullWidth?: boolean;
  className?: string;
}

// Shieldlytics Button — consumes the .btn / .btn-{variant} / .btn-{size}
// classes declared in src/index.css per UI_DESIGN-DIANA.md §6.1.
const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'normal',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  }[variant];

  const sizeClass =
    size === 'small' ? 'btn-sm' :
    size === 'large' ? 'btn-lg' :
    '';

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={['btn', variantClass, sizeClass, widthClass, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
