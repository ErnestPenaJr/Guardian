/**
 * Centralized Error Message Templates for Guardian MVP
 * User-friendly error messages with role-based customization
 */

import { ErrorCodes, UserRole, ErrorCategory } from '../types/errorTypes';

export interface ErrorMessageTemplate {
  title: string;
  message: string;
  technicalMessage?: string;
  recoveryGuidance?: string;
  roleSpecific?: {
    [key in UserRole]?: {
      title?: string;
      message?: string;
      recoveryGuidance?: string;
    };
  };
}

export const ERROR_MESSAGES: Record<string, ErrorMessageTemplate> = {
  // Database Errors
  [ErrorCodes.CONSTRAINT_VIOLATION]: {
    title: 'Data Conflict',
    message: 'The information you entered conflicts with existing data in the system.',
    technicalMessage: 'Database constraint violation occurred',
    recoveryGuidance: 'Please check your input and try again, or contact support if the issue persists.',
    roleSpecific: {
      admin: {
        title: 'Database Constraint Violation',
        message: 'A database constraint has been violated. This typically indicates a data integrity issue.',
        recoveryGuidance: 'Check the database logs for specific constraint details and resolve the underlying data conflict.'
      },
      user: {
        message: 'There was a problem saving your information. Some of the data you entered may already exist or be invalid.',
        recoveryGuidance: 'Please review your information and try again. If you continue to have problems, contact your administrator.'
      }
    }
  },

  [ErrorCodes.DUPLICATE_ENTRY]: {
    title: 'Already Exists',
    message: 'This information already exists in the system.',
    technicalMessage: 'Duplicate entry violation',
    recoveryGuidance: 'Please use different information or update the existing record instead.',
    roleSpecific: {
      admin: {
        message: 'A duplicate entry was detected. This could be an email address, username, or other unique identifier.',
        recoveryGuidance: 'Check for existing records with similar information or modify the unique fields.'
      }
    }
  },

  [ErrorCodes.FOREIGN_KEY_VIOLATION]: {
    title: 'Cannot Delete',
    message: 'This item cannot be removed because it is being used by other parts of the system.',
    technicalMessage: 'Foreign key constraint violation',
    recoveryGuidance: 'Remove any dependencies first, then try again.',
    roleSpecific: {
      admin: {
        message: 'Foreign key constraint prevents this operation. The record is referenced by other tables.',
        recoveryGuidance: 'Identify and remove dependent records first, or use cascade delete if appropriate.'
      },
      user: {
        message: 'This item is connected to other information and cannot be deleted right now.',
        recoveryGuidance: 'Contact your administrator for help removing this item and its connections.'
      }
    }
  },

  [ErrorCodes.CONNECTION_FAILED]: {
    title: 'Connection Problem',
    message: 'Unable to connect to the database. Your changes may not have been saved.',
    technicalMessage: 'Database connection failed',
    recoveryGuidance: 'Please try again in a moment. If the problem continues, contact support.',
    roleSpecific: {
      admin: {
        title: 'Database Connection Failed',
        message: 'The application cannot connect to the database server.',
        recoveryGuidance: 'Check database server status, connection string, and network connectivity.'
      }
    }
  },

  // Network Errors
  [ErrorCodes.NETWORK_ERROR]: {
    title: 'Connection Issue',
    message: 'There was a problem connecting to the server. Please check your internet connection.',
    technicalMessage: 'Network request failed',
    recoveryGuidance: 'Check your internet connection and try again.',
    roleSpecific: {
      admin: {
        message: 'Network request failed. This could be due to server issues, DNS problems, or network connectivity.',
        recoveryGuidance: 'Check server status, network connectivity, and review server logs for errors.'
      }
    }
  },

  [ErrorCodes.TIMEOUT_ERROR]: {
    title: 'Request Timed Out',
    message: 'The server is taking too long to respond. This might be due to a slow connection or server issues.',
    technicalMessage: 'Request timeout exceeded',
    recoveryGuidance: 'Please try again. If the problem persists, contact support.',
    roleSpecific: {
      admin: {
        message: 'Request timeout occurred. This could indicate server performance issues or network latency.',
        recoveryGuidance: 'Check server performance metrics and consider increasing timeout values if appropriate.'
      }
    }
  },

  [ErrorCodes.OFFLINE]: {
    title: 'No Internet Connection',
    message: 'You appear to be offline. Please check your internet connection.',
    technicalMessage: 'No network connectivity detected',
    recoveryGuidance: 'Connect to the internet and try again. Your changes will be saved when connection is restored.',
  },

  [ErrorCodes.SERVER_ERROR]: {
    title: 'Server Error',
    message: 'The server encountered an unexpected problem while processing your request.',
    technicalMessage: 'Internal server error (500)',
    recoveryGuidance: 'Please try again in a few minutes. If the error continues, contact support.',
    roleSpecific: {
      admin: {
        message: 'An internal server error occurred. Check server logs for specific error details.',
        recoveryGuidance: 'Review application logs, check server resources, and investigate any recent code changes.'
      }
    }
  },

  [ErrorCodes.NOT_FOUND]: {
    title: 'Not Found',
    message: 'The information you are looking for could not be found.',
    technicalMessage: 'Resource not found (404)',
    recoveryGuidance: 'The item may have been moved or deleted. Please check the URL or search for the item.',
    roleSpecific: {
      admin: {
        message: 'The requested resource was not found. This could indicate a missing file, deleted record, or incorrect URL.',
        recoveryGuidance: 'Verify the resource exists and check for any recent changes that might have affected it.'
      }
    }
  },

  [ErrorCodes.UNAUTHORIZED]: {
    title: 'Authentication Required',
    message: 'You need to sign in to access this information.',
    technicalMessage: 'Unauthorized access (401)',
    recoveryGuidance: 'Please sign in and try again.',
    roleSpecific: {
      admin: {
        message: 'Authentication failed. The user session may have expired or the token is invalid.',
        recoveryGuidance: 'Check authentication configuration and token validation logic.'
      }
    }
  },

  [ErrorCodes.FORBIDDEN]: {
    title: 'Access Denied',
    message: 'You do not have permission to perform this action.',
    technicalMessage: 'Forbidden (403)',
    recoveryGuidance: 'Contact your administrator if you believe you should have access to this feature.',
    roleSpecific: {
      admin: {
        message: 'Access forbidden. The user lacks the required permissions for this resource.',
        recoveryGuidance: 'Review user permissions and role assignments.'
      }
    }
  },

  [ErrorCodes.RATE_LIMITED]: {
    title: 'Too Many Requests',
    message: 'You are making requests too quickly. Please wait a moment and try again.',
    technicalMessage: 'Rate limit exceeded (429)',
    recoveryGuidance: 'Wait a few minutes before making another request.',
  },

  // Validation Errors
  [ErrorCodes.REQUIRED_FIELD]: {
    title: 'Required Information Missing',
    message: 'Please fill in all required fields before continuing.',
    technicalMessage: 'Required field validation failed',
    recoveryGuidance: 'Complete all fields marked with an asterisk (*) and try again.',
  },

  [ErrorCodes.INVALID_FORMAT]: {
    title: 'Invalid Format',
    message: 'The information you entered is not in the correct format.',
    technicalMessage: 'Format validation failed',
    recoveryGuidance: 'Please check the format requirements and enter the information correctly.',
  },

  [ErrorCodes.OUT_OF_RANGE]: {
    title: 'Value Out of Range',
    message: 'The value you entered is outside the allowed range.',
    technicalMessage: 'Range validation failed',
    recoveryGuidance: 'Please enter a value within the specified limits.',
  },

  // Permission Errors
  [ErrorCodes.INSUFFICIENT_PERMISSIONS]: {
    title: 'Insufficient Permissions',
    message: 'You do not have the required permissions to perform this action.',
    technicalMessage: 'User lacks required permissions',
    recoveryGuidance: 'Contact your administrator to request additional permissions.',
    roleSpecific: {
      admin: {
        message: 'The user account lacks the required role or permission for this operation.',
        recoveryGuidance: 'Review and update the user\'s role assignments or permissions.'
      }
    }
  },

  [ErrorCodes.EXPIRED_SESSION]: {
    title: 'Session Expired',
    message: 'Your session has expired for security reasons. Please sign in again.',
    technicalMessage: 'User session has expired',
    recoveryGuidance: 'Sign in again to continue where you left off.',
  },

  [ErrorCodes.INVALID_TOKEN]: {
    title: 'Invalid Authentication',
    message: 'Your authentication token is invalid. Please sign in again.',
    technicalMessage: 'Authentication token is invalid or corrupted',
    recoveryGuidance: 'Sign out and sign back in to get a new authentication token.',
  },

  // File Errors
  [ErrorCodes.FILE_TOO_LARGE]: {
    title: 'File Too Large',
    message: 'The file you are trying to upload is too large.',
    technicalMessage: 'File size exceeds maximum allowed limit',
    recoveryGuidance: 'Please select a smaller file or compress the file before uploading.',
  },

  [ErrorCodes.INVALID_FILE_TYPE]: {
    title: 'Invalid File Type',
    message: 'This file type is not allowed.',
    technicalMessage: 'File type not in allowed list',
    recoveryGuidance: 'Please select a file with an allowed file extension.',
  },

  [ErrorCodes.UPLOAD_FAILED]: {
    title: 'Upload Failed',
    message: 'There was a problem uploading your file.',
    technicalMessage: 'File upload process failed',
    recoveryGuidance: 'Check your internet connection and try uploading the file again.',
    roleSpecific: {
      admin: {
        message: 'File upload failed. This could be due to server storage issues, permission problems, or network errors.',
        recoveryGuidance: 'Check server storage space, file system permissions, and upload directory configuration.'
      }
    }
  },

  // System Errors
  [ErrorCodes.SYSTEM_ERROR]: {
    title: 'System Error',
    message: 'An unexpected system error occurred.',
    technicalMessage: 'Unhandled system error',
    recoveryGuidance: 'Please try again. If the error persists, contact support with details about what you were doing.',
    roleSpecific: {
      admin: {
        message: 'A system error occurred. Check application logs and server status.',
        recoveryGuidance: 'Review error logs, check system resources, and investigate any recent system changes.'
      }
    }
  },

  [ErrorCodes.SERVICE_UNAVAILABLE]: {
    title: 'Service Unavailable',
    message: 'This service is temporarily unavailable.',
    technicalMessage: 'Service unavailable (503)',
    recoveryGuidance: 'Please try again in a few minutes. The service may be undergoing maintenance.',
    roleSpecific: {
      admin: {
        message: 'Service is unavailable. This could be due to maintenance, overload, or service failure.',
        recoveryGuidance: 'Check service status, server load, and any scheduled maintenance windows.'
      }
    }
  },

  [ErrorCodes.MAINTENANCE_MODE]: {
    title: 'System Maintenance',
    message: 'The system is currently undergoing maintenance and will be available again shortly.',
    technicalMessage: 'System in maintenance mode',
    recoveryGuidance: 'Please try again after the maintenance window ends.',
  },

  // User Errors
  [ErrorCodes.INVALID_INPUT]: {
    title: 'Invalid Input',
    message: 'The information you entered is not valid.',
    technicalMessage: 'User input validation failed',
    recoveryGuidance: 'Please check your input and enter valid information.',
  },

  [ErrorCodes.OPERATION_CANCELLED]: {
    title: 'Operation Cancelled',
    message: 'The operation was cancelled.',
    technicalMessage: 'User cancelled the operation',
    recoveryGuidance: 'You can try the operation again if needed.',
  },

  [ErrorCodes.UNSUPPORTED_OPERATION]: {
    title: 'Operation Not Supported',
    message: 'This operation is not supported in your current context.',
    technicalMessage: 'Unsupported operation attempted',
    recoveryGuidance: 'Try a different approach or contact support for assistance.',
    roleSpecific: {
      admin: {
        message: 'The requested operation is not supported in the current system configuration.',
        recoveryGuidance: 'Check system capabilities and configuration settings.'
      }
    }
  }
};

// Helper function to get role-specific error message
export const getErrorMessage = (
  errorCode: string, 
  userRole: UserRole = 'user',
  context?: { [key: string]: string }
): ErrorMessageTemplate => {
  const baseMessage = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES[ErrorCodes.SYSTEM_ERROR];
  
  // Apply role-specific customization if available
  const roleSpecific = baseMessage.roleSpecific?.[userRole];
  if (roleSpecific) {
    return {
      ...baseMessage,
      title: roleSpecific.title || baseMessage.title,
      message: roleSpecific.message || baseMessage.message,
      recoveryGuidance: roleSpecific.recoveryGuidance || baseMessage.recoveryGuidance
    };
  }

  return baseMessage;
};

// Common error message patterns for specific scenarios
export const CONTEXT_SPECIFIC_MESSAGES = {
  email: {
    [ErrorCodes.DUPLICATE_ENTRY]: {
      title: 'Email Already Registered',
      message: 'This email address is already registered in the system.',
      recoveryGuidance: 'Try signing in instead, or use a different email address.'
    }
  },
  
  login: {
    [ErrorCodes.UNAUTHORIZED]: {
      title: 'Sign In Failed',
      message: 'The email or password you entered is incorrect.',
      recoveryGuidance: 'Please check your credentials and try again, or reset your password if needed.'
    },
    [ErrorCodes.ACCOUNT_DISABLED]: {
      title: 'Account Disabled',
      message: 'Your account has been disabled.',
      recoveryGuidance: 'Contact your administrator to reactivate your account.'
    }
  },

  upload: {
    [ErrorCodes.FILE_TOO_LARGE]: {
      title: 'File Too Large',
      message: 'Your file is larger than the maximum allowed size of {maxSize}.',
      recoveryGuidance: 'Please select a smaller file or compress your file before uploading.'
    },
    [ErrorCodes.INVALID_FILE_TYPE]: {
      title: 'File Type Not Allowed',
      message: 'Only {allowedTypes} files are allowed.',
      recoveryGuidance: 'Please select a file with an allowed file type.'
    }
  },

  form: {
    [ErrorCodes.REQUIRED_FIELD]: {
      title: 'Required Fields Missing',
      message: '{fieldCount} required fields need to be completed.',
      recoveryGuidance: 'Please fill in all required fields marked with an asterisk (*).'
    }
  }
};

// Helper to get context-specific message with template replacement
export const getContextualErrorMessage = (
  errorCode: string,
  context: string,
  templateData?: { [key: string]: any },
  userRole: UserRole = 'user'
): ErrorMessageTemplate => {
  const contextualMessage = CONTEXT_SPECIFIC_MESSAGES[context]?.[errorCode];
  
  if (contextualMessage && templateData) {
    // Replace template variables in the message
    let processedMessage = { ...contextualMessage };
    
    Object.entries(templateData).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      processedMessage.title = processedMessage.title?.replace(placeholder, String(value));
      processedMessage.message = processedMessage.message?.replace(placeholder, String(value));
      processedMessage.recoveryGuidance = processedMessage.recoveryGuidance?.replace(placeholder, String(value));
    });
    
    return processedMessage;
  }
  
  return contextualMessage || getErrorMessage(errorCode, userRole);
};