/**
 * Comprehensive Error Type Definitions for Guardian MVP
 * Supports SweetAlert2-based error handling with user-friendly messaging
 */

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ErrorCategory = 'database' | 'network' | 'validation' | 'permission' | 'authentication' | 'file' | 'api' | 'system' | 'user';
export type UserRole = 'admin' | 'user' | 'processor' | 'manager' | 'external' | 'guest';

export interface ErrorContext {
  userId?: string;
  userEmail?: string;
  userRole?: UserRole;
  companyId?: string;
  page?: string;
  component?: string;
  action?: string;
  endpoint?: string;
  method?: string;
  requestData?: any;
  responseData?: any;
  sessionId?: string;
}

export interface ErrorRecoveryAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  action: () => void | Promise<void>;
  icon?: string;
  disabled?: boolean;
}

export interface ErrorDetails {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;
  technicalMessage?: string;
  userFriendlyMessage: string;
  context?: ErrorContext;
  recoveryActions?: ErrorRecoveryAction[];
  helpUrl?: string;
  contactSupport?: boolean;
  timestamp: Date;
  canRetry?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export interface DatabaseErrorDetails extends ErrorDetails {
  category: 'database';
  constraint?: string;
  table?: string;
  field?: string;
  violatedValue?: string;
}

export interface NetworkErrorDetails extends ErrorDetails {
  category: 'network';
  endpoint?: string;
  method?: string;
  statusCode?: number;
  timeout?: boolean;
  offline?: boolean;
  retryAfter?: number;
}

export interface ValidationErrorDetails extends ErrorDetails {
  category: 'validation';
  field?: string;
  value?: any;
  rule?: string;
  fieldErrors?: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

export interface PermissionErrorDetails extends ErrorDetails {
  category: 'permission';
  requiredRole?: UserRole;
  requiredPermission?: string;
  resource?: string;
  action?: string;
}

export interface FileErrorDetails extends ErrorDetails {
  category: 'file';
  filename?: string;
  fileSize?: number;
  fileType?: string;
  maxSize?: number;
  allowedTypes?: string[];
  uploadProgress?: number;
}

export interface ApiErrorDetails extends ErrorDetails {
  category: 'api';
  endpoint: string;
  method: string;
  statusCode: number;
  responseBody?: any;
  requestBody?: any;
  headers?: Record<string, string>;
}

export interface ErrorDisplayOptions {
  title?: string;
  showTechnicalDetails?: boolean;
  showRecoveryActions?: boolean;
  showContactSupport?: boolean;
  autoClose?: boolean;
  autoCloseDelay?: number;
  position?: 'top' | 'top-start' | 'top-end' | 'center' | 'center-start' | 'center-end' | 'bottom' | 'bottom-start' | 'bottom-end';
  backdrop?: boolean;
  allowOutsideClick?: boolean;
  showProgressBar?: boolean;
  customClass?: {
    container?: string;
    popup?: string;
    header?: string;
    title?: string;
    content?: string;
    actions?: string;
    confirmButton?: string;
    cancelButton?: string;
  };
}

export interface ErrorTheme {
  critical: {
    iconColor: string;
    confirmButtonColor: string;
    background: string;
    titleColor: string;
  };
  high: {
    iconColor: string;
    confirmButtonColor: string;
    background: string;
    titleColor: string;
  };
  medium: {
    iconColor: string;
    confirmButtonColor: string;
    background: string;
    titleColor: string;
  };
  low: {
    iconColor: string;
    confirmButtonColor: string;
    background: string;
    titleColor: string;
  };
  info: {
    iconColor: string;
    confirmButtonColor: string;
    background: string;
    titleColor: string;
  };
}

export interface ErrorHandlerConfig {
  enableEmailReporting?: boolean;
  enableConsoleLogging?: boolean;
  enableUserFeedback?: boolean;
  defaultTheme?: ErrorTheme;
  maxRetries?: number;
  retryDelay?: number;
  offlineRetryInterval?: number;
  supportEmail?: string;
  helpBaseUrl?: string;
}

export interface ErrorMetrics {
  errorId: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  userId?: string;
  userRole?: UserRole;
  page?: string;
  timestamp: Date;
  resolved: boolean;
  resolutionTime?: number;
  resolutionMethod?: 'retry' | 'user-action' | 'support' | 'auto-resolve';
  userFeedback?: {
    helpful: boolean;
    comment?: string;
  };
}

// Utility type for error handler responses
export type ErrorHandlerResponse = {
  success: boolean;
  action?: 'retry' | 'redirect' | 'contact-support' | 'dismiss';
  redirectUrl?: string;
  retryFunction?: () => Promise<void>;
};

// Common error codes for consistent handling
export enum ErrorCodes {
  // Database Errors
  CONSTRAINT_VIOLATION = 'DB_CONSTRAINT_VIOLATION',
  DUPLICATE_ENTRY = 'DB_DUPLICATE_ENTRY',
  FOREIGN_KEY_VIOLATION = 'DB_FOREIGN_KEY_VIOLATION',
  CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  TIMEOUT = 'DB_TIMEOUT',

  // Network Errors
  NETWORK_ERROR = 'NET_ERROR',
  TIMEOUT_ERROR = 'NET_TIMEOUT',
  OFFLINE = 'NET_OFFLINE',
  SERVER_ERROR = 'NET_SERVER_ERROR',
  NOT_FOUND = 'NET_NOT_FOUND',
  UNAUTHORIZED = 'NET_UNAUTHORIZED',
  FORBIDDEN = 'NET_FORBIDDEN',
  RATE_LIMITED = 'NET_RATE_LIMITED',

  // Validation Errors
  REQUIRED_FIELD = 'VAL_REQUIRED_FIELD',
  INVALID_FORMAT = 'VAL_INVALID_FORMAT',
  OUT_OF_RANGE = 'VAL_OUT_OF_RANGE',
  INVALID_TYPE = 'VAL_INVALID_TYPE',
  CUSTOM_VALIDATION = 'VAL_CUSTOM',

  // Permission Errors
  INSUFFICIENT_PERMISSIONS = 'PERM_INSUFFICIENT',
  EXPIRED_SESSION = 'PERM_EXPIRED_SESSION',
  INVALID_TOKEN = 'PERM_INVALID_TOKEN',
  ACCOUNT_DISABLED = 'PERM_ACCOUNT_DISABLED',

  // File Errors
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'FILE_INVALID_TYPE',
  FILE_CORRUPTED = 'FILE_CORRUPTED',
  UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  STORAGE_FULL = 'FILE_STORAGE_FULL',

  // System Errors
  SYSTEM_ERROR = 'SYS_ERROR',
  SERVICE_UNAVAILABLE = 'SYS_SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE = 'SYS_MAINTENANCE',
  RESOURCE_EXHAUSTED = 'SYS_RESOURCE_EXHAUSTED',

  // User Errors
  INVALID_INPUT = 'USER_INVALID_INPUT',
  OPERATION_CANCELLED = 'USER_CANCELLED',
  UNSUPPORTED_OPERATION = 'USER_UNSUPPORTED'
}