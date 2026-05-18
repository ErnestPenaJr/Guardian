import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  /**
   * Status mapping (preferred):
   *   - open       → success bg
   *   - review     → info bg
   *   - pending    → warning bg
   *   - escalated  → danger bg
   *   - closed     → neutral gray
   *   - brand      → teal soft
   *
   * Legacy aliases (kept for backwards compatibility):
   *   - primary    → brand
   *   - secondary  → neutral
   *   - success    → open
   *   - warning    → pending
   *   - danger     → escalated
   */
  variant?:
    | 'open' | 'review' | 'pending' | 'escalated' | 'closed' | 'brand' | 'neutral'
    | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  /** Show the leading dot indicator. Default true. */
  dot?: boolean;
  className?: string;
}

// Shieldlytics Badge — consumes .badge / .badge-{variant} classes (§6.3).
const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  dot = true,
  className = '',
}) => {
  const aliased: Record<string, string> = {
    primary: 'brand',
    secondary: 'neutral',
    success: 'open',
    warning: 'pending',
    danger: 'escalated',
  };
  const resolved = aliased[variant] ?? variant;

  return (
    <span className={`badge badge-${resolved} ${className}`}>
      {dot && <span className="dot" aria-hidden="true" />}
      {children}
    </span>
  );
};

export default Badge;
