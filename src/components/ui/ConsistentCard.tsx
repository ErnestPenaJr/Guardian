import React from 'react';
import './ConsistentCard.css';

interface ConsistentCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerControls?: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'info';
}

const ConsistentCard: React.FC<ConsistentCardProps> = ({
  title,
  subtitle,
  icon,
  children,
  className = '',
  headerControls,
  variant = 'default'
}) => {
  return (
    <div className={`consistent-card consistent-card--${variant} ${className}`}>
      {/* Blue top border gradient */}
      <div className="consistent-card__top-border" />
      
      {/* Header section */}
      <div className="consistent-card__header">
        <div className="consistent-card__title-section">
          {icon && (
            <div className="consistent-card__icon">
              {icon}
            </div>
          )}
          <div className="consistent-card__title-content">
            <h3 className="consistent-card__title">{title}</h3>
            {subtitle && (
              <p className="consistent-card__subtitle">{subtitle}</p>
            )}
          </div>
        </div>
        
        {headerControls && (
          <div className="consistent-card__controls">
            {headerControls}
          </div>
        )}
      </div>
      
      {/* Content section */}
      <div className="consistent-card__content">
        {children}
      </div>
    </div>
  );
};

export default ConsistentCard;
