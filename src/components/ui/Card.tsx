import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  /**
   * Hover affordance (lifts the border + adds a soft shadow). Off by default —
   * cards in dashboards should feel still, not interactive.
   */
  hover?: boolean;
  /**
   * @deprecated The Shieldlytics system has no blue accent stripe on cards.
   * Kept as a no-op for backwards compatibility.
   */
  noAccent?: boolean;
}

// Shieldlytics Card — consumes the .card / .card-hover classes (§6.4).
const Card: React.FC<CardProps> = ({ children, className = '', hover = false }) => {
  return (
    <div className={`card ${hover ? 'card-hover' : ''} ${className}`}>
      {children}
    </div>
  );
};

export default Card;
