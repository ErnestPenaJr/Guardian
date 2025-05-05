import React, { ReactNode, HTMLAttributes } from 'react';

interface TypographyProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  variant: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body-lg' | 'body-md' | 'body-base' | 'body-sm' | 'body-xs';
  component?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: 'primary' | 'secondary' | 'black' | 'white' | 'gray-1' | 'gray-2' | 'gray-3' | 'gray-4' | 'gray-5';
  className?: string;
}

/**
 * Typography component based on the Guardian style guide
 */
const Typography: React.FC<TypographyProps> = ({
  children,
  variant,
  component,
  weight = 'normal',
  color = 'black',
  className = '',
  ...props
}) => {
  // Default component mapping based on variant
  const defaultComponents = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    h6: 'h6',
    'body-lg': 'p',
    'body-md': 'p',
    'body-base': 'p',
    'body-sm': 'p',
    'body-xs': 'p',
  };

  // Determine which HTML element to use
  const Component = (component || defaultComponents[variant]) as keyof JSX.IntrinsicElements;

  // Font weight classes
  const weightClasses = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  };

  // Color classes
  const colorClasses = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    black: 'text-black-1',
    white: 'text-white',
    'gray-1': 'text-gray-1',
    'gray-2': 'text-gray-2',
    'gray-3': 'text-gray-3',
    'gray-4': 'text-gray-4',
    'gray-5': 'text-gray-5',
  };

  // Font family classes
  const fontFamilyClasses = {
    h1: 'font-display',
    h2: 'font-display',
    h3: 'font-display',
    h4: 'font-display',
    h5: 'font-display',
    h6: 'font-display',
    'body-lg': 'font-sans',
    'body-md': 'font-sans',
    'body-base': 'font-sans',
    'body-sm': 'font-sans',
    'body-xs': 'font-sans',
  };

  return (
    <Component
      className={`text-${variant} ${fontFamilyClasses[variant]} ${weightClasses[weight]} ${colorClasses[color]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
};

export default Typography;
