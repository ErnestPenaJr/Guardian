import React, { TextareaHTMLAttributes } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  status?: string;
  statusType?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}

// Shieldlytics TextArea — uses the .input class (§6.2) with auto-height behavior left to caller.
const TextArea: React.FC<TextAreaProps> = ({
  label,
  status,
  statusType = 'default',
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
      <textarea
        className={`input ${className}`}
        aria-invalid={ariaInvalid}
        {...props}
      />
      {status && (
        <p className="mt-1" style={{ fontSize: 'var(--fs-xs)', color: statusColor }}>
          {status}
        </p>
      )}
    </div>
  );
};

export default TextArea;
