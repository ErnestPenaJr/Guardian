import React from 'react';
import Badge from './ui/Badge';

interface FormFieldValue {
  fieldName: string;
  value: string | number | boolean;
}

interface Requestor {
  FIRST_NAME: string;
  LAST_NAME: string;
}

interface Request {
  REQUEST_ID: number;
  REQUEST_NAME: string;
  STATUS: string;
  TRACKINGID?: string | null;
  CREATE_DATE: string | null;
  requestorName?: string;
  requestor?: Requestor;
  FIRST_NAME?: string;
  LAST_NAME?: string;
  EXTERNAL_USER?: string | null;
  DESCRIPTION?: string;
  REQUEST_DESCRIPTION?: string;
}

interface SimpleRequestViewProps {
  request: Request;
  formFieldValues?: FormFieldValue[];
  className?: string;
  onClick?: () => void;
}

/**
 * Simple, telegram-style request view component
 * Clean, minimal design focused on essential information
 */
const SimpleRequestView: React.FC<SimpleRequestViewProps> = ({ 
  request, 
  formFieldValues = [],
  className = '',
  onClick 
}) => {
  // Get status display with appropriate styling
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'P': return <Badge variant="primary">In Progress</Badge>;
      case 'A': return <Badge variant="success">Approved</Badge>;
      case 'R': return <Badge variant="danger">Rejected</Badge>;
      case 'C': return <Badge variant="secondary">Completed</Badge>;
      default: return <Badge variant="warning">Unknown</Badge>;
    }
  };

  // Get requestor name from various possible sources
  const getRequestorName = (): string => {
    if (request.requestorName) return request.requestorName;
    if (request.requestor) {
      return `${request.requestor.FIRST_NAME} ${request.requestor.LAST_NAME}`;
    }
    if (request.FIRST_NAME && request.LAST_NAME) {
      return `${request.FIRST_NAME} ${request.LAST_NAME}`;
    }
    if (request.EXTERNAL_USER) return request.EXTERNAL_USER;
    return 'Unknown';
  };

  // Format date for display
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Get tracking ID display
  const getTrackingId = (): string => {
    return request.TRACKINGID || `REQ-${request.REQUEST_ID}`;
  };

  return (
    <div 
      className={`
        bg-white rounded-lg shadow-sm border border-gray-200 
        hover:shadow-md transition-shadow duration-200
        ${onClick ? 'cursor-pointer hover:border-gray-300' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="p-4">
        {/* Header with name and status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {request.REQUEST_NAME}
            </h3>
            <p className="text-sm text-gray-500 font-mono">
              {getTrackingId()}
            </p>
          </div>
          <div className="ml-3 flex-shrink-0">
            {getStatusBadge(request.STATUS)}
          </div>
        </div>

        {/* Description (if available) */}
        {(request.DESCRIPTION || request.REQUEST_DESCRIPTION) && (
          <div className="mb-3">
            <p className="text-sm text-gray-600 line-clamp-2">
              {request.DESCRIPTION || request.REQUEST_DESCRIPTION}
            </p>
          </div>
        )}

        {/* Form field values (if any) */}
        {formFieldValues.length > 0 && (
          <div className="mb-3 space-y-2">
            {formFieldValues.slice(0, 3).map((field, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {field.fieldName}
                </span>
                <span className="text-sm text-gray-900 truncate max-w-32">
                  {String(field.value)}
                </span>
              </div>
            ))}
            {formFieldValues.length > 3 && (
              <div className="text-xs text-gray-400">
                +{formFieldValues.length - 3} more fields
              </div>
            )}
          </div>
        )}

        {/* Footer with requestor and date */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-blue-600">
                {getRequestorName().charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-gray-600 truncate">
              {getRequestorName()}
            </span>
          </div>
          <span className="text-xs text-gray-400 flex-shrink-0">
            {formatDate(request.CREATE_DATE)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SimpleRequestView;