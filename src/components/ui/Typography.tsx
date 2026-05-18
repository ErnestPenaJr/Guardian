import React, { ReactNode, HTMLAttributes } from 'react';

type Variant =
  | 'display' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5'
  | 'body-lg' | 'body-md' | 'body-base' | 'body-sm' | 'body-xs'
  | 'lead' | 'small' | 'meta' | 'eyebrow' | 'code' | 'num';

interface TypographyProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  variant: Variant;
  component?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'code';
  /**
   * Optional weight override. The .sl-* classes already set the spec weight;
   * use this sparingly (e.g. emphasizing a sub-section).
   */
  weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold';
  /** Optional color token override. Defaults to the class's built-in color. */
  color?: 'fg1' | 'fg2' | 'fg3' | 'fg4' | 'brand' | 'on-brand';
  className?: string;
}

// Shieldlytics Typography — maps variants to the .sl-* utility classes (§5).
// Legacy body-* aliases map to the closest semantic class.
const Typography: React.FC<TypographyProps> = ({
  children,
  variant,
  component,
  weight,
  color,
  className = '',
  style,
  ...props
}) => {
  const variantClass: Record<Variant, string> = {
    display:     'sl-display',
    h1:          'sl-h1',
    h2:          'sl-h2',
    h3:          'sl-h3',
    h4:          'sl-h4',
    h5:          'sl-h5',
    'body-lg':   'sl-lead',
    'body-md':   'sl-p',
    'body-base': 'sl-p',
    'body-sm':   'sl-small',
    'body-xs':   'sl-meta',
    lead:        'sl-lead',
    small:       'sl-small',
    meta:        'sl-meta',
    eyebrow:     'sl-eyebrow',
    code:        'sl-code',
    num:         'sl-num',
  };

  const defaultComponent: Record<Variant, string> = {
    display: 'h1', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5',
    'body-lg': 'p', 'body-md': 'p', 'body-base': 'p', 'body-sm': 'p', 'body-xs': 'p',
    lead: 'p', small: 'p', meta: 'p', eyebrow: 'span', code: 'code', num: 'span',
  };

  const Component = (component || defaultComponent[variant]) as keyof JSX.IntrinsicElements;

  const weightToken = weight
    ? { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700 }[weight]
    : undefined;

  const colorVar = color
    ? color === 'brand' ? 'var(--sl-teal-600)'
      : color === 'on-brand' ? 'var(--fg-on-brand)'
      : `var(--${color})`
    : undefined;

  return (
    <Component
      className={`${variantClass[variant]} ${className}`}
      style={{
        ...(weightToken !== undefined ? { fontWeight: weightToken } : null),
        ...(colorVar ? { color: colorVar } : null),
        ...style,
      }}
      {...props}
    >
      {children}
    </Component>
  );
};

export default Typography;
