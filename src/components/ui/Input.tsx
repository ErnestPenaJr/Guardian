import React, { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  status?: string;
  statusType?: 'default' | 'success' | 'warning' | 'error';
  icon?: ReactNode;
  className?: string;
}

// Shieldlytics Input — uses the .input class declared in src/index.css per §6.2.
// Label is sentence case, small, semibold gray (§5).
const Input: React.FC<InputProps> = ({
  label,
  status,
  statusType = 'default',
  icon,
  className = '',
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
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: 'var(--fg3)' }}>
            {icon}
          </div>
        )}
        <input
          className={`input ${icon ? 'pl-10' : ''} ${className}`}
          aria-invalid={ariaInvalid}
          {...props}
        />
      </div>
      {status && (
        <p className="mt-1" style={{ fontSize: 'var(--fs-xs)', color: statusColor }}>
          {status}
        </p>
      )}
    </div>
  );
};

export default Input;
