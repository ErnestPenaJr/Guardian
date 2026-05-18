import React, { InputHTMLAttributes } from 'react';

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  className?: string;
}

// Shieldlytics Checkbox — uses native input with `accent-color` set to teal-600.
// Focus ring matches --shadow-focus.
const Checkbox: React.FC<CheckboxProps> = ({
  label,
  className = '',
  ...props
}) => {
  return (
    <label className={`inline-flex items-center gap-2 ${className}`}>
      <input
        type="checkbox"
        className="focus:outline-none"
        style={{
          width: 16,
          height: 16,
          accentColor: 'var(--sl-teal-600)',
        }}
        onFocus={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-focus)'; props.onFocus?.(e); }}
        onBlur={(e)  => { e.currentTarget.style.boxShadow = 'none'; props.onBlur?.(e); }}
        {...props}
      />
      {label && (
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg1)' }}>
          {label}
        </span>
      )}
    </label>
  );
};

export default Checkbox;
