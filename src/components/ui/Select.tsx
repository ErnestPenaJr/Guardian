import React, { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  status?: string;
  statusType?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}

// Shieldlytics Select — uses .input shape (§6.2) with chevron caret on the right.
const Select: React.FC<SelectProps> = ({
  label,
  status,
  statusType = 'default',
  className = '',
  children,
  ...props
}) => {
  const statusColor =
    statusType === 'success' ? 'var(--success-fg)' :
    statusType === 'warning' ? 'var(--warning-fg)' :
    statusType === 'error'   ? 'var(--danger-fg)'  :
    'var(--fg3)';

  const ariaInvalid = statusType === 'error' ? true : undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          className="block mb-1"
          style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 'var(--fw-medium)',
            color: 'var(--fg2)',
          }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className={`input appearance-none pr-10 ${className}`}
          aria-invalid={ariaInvalid}
          {...props}
        >
          {children}
        </select>
        <div
          className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none"
          style={{ color: 'var(--fg3)' }}
        >
          <svg
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {status && (
        <p className="mt-1" style={{ fontSize: 'var(--fs-xs)', color: statusColor }}>
          {status}
        </p>
      )}
    </div>
  );
};

export default Select;
