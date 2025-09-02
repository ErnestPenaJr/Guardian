/**
 * Comprehensive Error Manager for Guardian MVP
 * Centralized error handling with SweetAlert2, user-friendly messaging, and recovery actions
 */

import { 
  ErrorDetails, 
  ErrorSeverity, 
  ErrorCategory, 
  UserRole, 
  ErrorContext,
  ErrorRecoveryAction,
  ErrorDisplayOptions,
  ErrorHandlerResponse,
  DatabaseErrorDetails,
  NetworkErrorDetails,
  ValidationErrorDetails,
  PermissionErrorDetails,
  FileErrorDetails,
  ApiErrorDetails,
  ErrorCodes
} from '../types/errorTypes';

import { getErrorMessage, getContextualErrorMessage } from '../constants/errorMessages';
import GuardianSweetAlert from '../utils/sweetAlert';
import errorCapture from '../utils/errorCapture';

export class ErrorManager {
  private static instance: ErrorManager;
  
  // Configuration
  private config = {
    enableEmailReporting: true,
    enableConsoleLogging: true,
    enableUserFeedback: true,
    maxRetries: 3,
    retryDelay: 1000,
    offlineRetryInterval: 30000,
    supportEmail: 'ernest@shieldlytics.com'
  };

  // Current user context
  private userContext: Partial<ErrorContext> = {};

  private constructor() {
    this.initializeUserContext();
    this.setupNetworkMonitoring();
  }

  public static getInstance(): ErrorManager {
    if (!ErrorManager.instance) {
      ErrorManager.instance = new ErrorManager();
    }
    return ErrorManager.instance;
  }

  // Initialize user context from localStorage and auth state
  private initializeUserContext(): void {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const companyId = localStorage.getItem('companyId');
      
      this.userContext = {
        userId: user?.id?.toString(),
        userEmail: user?.email,
        userRole: this.mapToUserRole(user?.role),
        companyId: companyId || undefined,
        page: window.location.pathname,
        sessionId: this.generateSessionId()
      };
    } catch (error) {
      console.error('Failed to initialize user context:', error);
    }
  }

  // Map Guardian role IDs to UserRole enum
  private mapToUserRole(roleId: number | string): UserRole {
    switch (roleId?.toString()) {
      case '1': return 'admin';
      case '3': return 'processor';
      case '4': return 'manager';
      case '6': return 'admin'; // Super admin
      default: return 'user';
    }
  }

  // Generate unique session ID for error tracking
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Set up network monitoring for offline/online detection
  private setupNetworkMonitoring(): void {
    window.addEventListener('online', () => {
      GuardianSweetAlert.showToast('Connection restored', 'success');
    });

    window.addEventListener('offline', () => {
      this.handleNetworkError({
        type: 'offline',
        message: 'No internet connection detected'
      });
    });
  }

  // Update user context (call when user login state changes)
  public updateUserContext(context: Partial<ErrorContext>): void {
    this.userContext = {
      ...this.userContext,
      ...context
    };
  }

  // Main error handling method - determines error type and handles appropriately
  public async handleError(error: any, context?: Partial<ErrorContext>): Promise<ErrorHandlerResponse> {
    const fullContext = {
      ...this.userContext,
      ...context,
      page: window.location.pathname,
      timestamp: new Date()
    };

    // Classify error type and route to appropriate handler
    if (this.isDatabaseError(error)) {
      return this.handleDatabaseError(error, fullContext);
    } else if (this.isNetworkError(error)) {
      return this.handleNetworkError(error, fullContext);
    } else if (this.isValidationError(error)) {
      return this.handleValidationError(error, fullContext);
    } else if (this.isPermissionError(error)) {
      return this.handlePermissionError(error, fullContext);
    } else if (this.isFileError(error)) {
      return this.handleFileError(error, fullContext);
    } else if (this.isApiError(error)) {
      return this.handleApiError(error, fullContext);
    } else {
      return this.handleGenericError(error, fullContext);
    }
  }

  // Database error handling
  public async handleDatabaseError(error: any, context: Partial<ErrorContext> = {}): Promise<ErrorHandlerResponse> {
    const errorCode = this.classifyDatabaseError(error);
    const errorMessage = getErrorMessage(errorCode, context.userRole);
    
    const errorDetails: DatabaseErrorDetails = {
      id: this.generateErrorId(),
      category: 'database',
      severity: 'high',
      code: errorCode,
      message: error.message || 'Database operation failed',
      technicalMessage: this.sanitizeStackTrace(error.stack || error.message),
      userFriendlyMessage: errorMessage.title,
      context: { ...this.userContext, ...context },
      timestamp: new Date(),
      constraint: this.extractConstraintInfo(error),
      table: this.extractTableInfo(error),
      field: this.extractFieldInfo(error),
      canRetry: true,
      maxRetries: 2
    };

    // Add recovery actions
    errorDetails.recoveryActions = this.createDatabaseRecoveryActions(errorDetails);

    // Report error for technical analysis
    this.reportError(errorDetails);

    // Show user-friendly error with recovery options
    return this.displayError(errorDetails, {
      showTechnicalDetails: context.userRole === 'admin',
      showContactSupport: true
    });
  }

  // Network/API error handling
  public async handleNetworkError(error: any, context: Partial<ErrorContext> = {}): Promise<ErrorHandlerResponse> {
    const errorCode = this.classifyNetworkError(error);
    const errorMessage = getErrorMessage(errorCode, context.userRole);
    
    const errorDetails: NetworkErrorDetails = {
      id: this.generateErrorId(),
      category: 'network',
      severity: this.getNetworkErrorSeverity(error),
      code: errorCode,
      message: error.message || 'Network request failed',
      technicalMessage: this.sanitizeStackTrace(error.stack || error.message),
      userFriendlyMessage: errorMessage.title,
      context: { ...this.userContext, ...context },
      timestamp: new Date(),
      endpoint: error.config?.url || context.endpoint,
      method: error.config?.method?.toUpperCase() || context.method,
      statusCode: error.response?.status,
      timeout: error.code === 'ECONNABORTED',
      offline: !navigator.onLine,
      canRetry: this.canRetryNetworkError(error),
      maxRetries: 3
    };

    // Add network-specific recovery actions
    errorDetails.recoveryActions = this.createNetworkRecoveryActions(errorDetails);

    // Report error
    this.reportError(errorDetails);

    // Handle offline scenarios specially
    if (errorDetails.offline) {
      return this.handleOfflineError(errorDetails);
    }

    return this.displayError(errorDetails, {
      showTechnicalDetails: context.userRole === 'admin',
      showContactSupport: errorDetails.severity === 'critical'
    });
  }

  // Validation error handling
  public async handleValidationError(error: any, context: Partial<ErrorContext> = {}): Promise<ErrorHandlerResponse> {
    const errorCode = ErrorCodes.REQUIRED_FIELD;
    const fieldErrors = this.extractValidationErrors(error);
    
    const errorDetails: ValidationErrorDetails = {
      id: this.generateErrorId(),
      category: 'validation',
      severity: 'medium',
      code: errorCode,
      message: 'Validation failed',
      technicalMessage: JSON.stringify(fieldErrors, null, 2),
      userFriendlyMessage: fieldErrors.length === 1 ? 
        `Please fix the ${fieldErrors[0].field} field` : 
        `Please fix ${fieldErrors.length} form fields`,
      context: { ...this.userContext, ...context },
      timestamp: new Date(),
      fieldErrors,
      canRetry: false
    };

    // Add validation-specific recovery actions
    errorDetails.recoveryActions = this.createValidationRecoveryActions(errorDetails);

    return this.displayError(errorDetails, {
      showTechnicalDetails: false,
      showContactSupport: false
    });
  }

  // Permission error handling
  public async handlePermissionError(error: any, context: Partial<ErrorContext> = {}): Promise<ErrorHandlerResponse> {
    const errorCode = this.classifyPermissionError(error);
    const errorMessage = getErrorMessage(errorCode, context.userRole);
    
    const errorDetails: PermissionErrorDetails = {
      id: this.generateErrorId(),
      category: 'permission',
      severity: 'high',
      code: errorCode,
      message: error.message || 'Access denied',
      technicalMessage: this.sanitizeStackTrace(error.stack || error.message),
      userFriendlyMessage: errorMessage.message,
      context: { ...this.userContext, ...context },
      timestamp: new Date(),
      requiredRole: this.extractRequiredRole(error),
      resource: context.endpoint || context.action,
      canRetry: false
    };

    // Add permission-specific recovery actions
    errorDetails.recoveryActions = this.createPermissionRecoveryActions(errorDetails);

    this.reportError(errorDetails);

    return this.displayError(errorDetails, {
      showTechnicalDetails: context.userRole === 'admin',
      showContactSupport: true
    });
  }

  // File error handling
  public async handleFileError(error: any, context: Partial<ErrorContext> = {}): Promise<ErrorHandlerResponse> {
    const errorCode = this.classifyFileError(error);
    const errorMessage = getContextualErrorMessage(errorCode, 'upload', {
      maxSize: this.formatFileSize(error.maxSize || 10485760), // 10MB default
      allowedTypes: error.allowedTypes?.join(', ') || 'PDF, DOC, DOCX'
    }, context.userRole);
    
    const errorDetails: FileErrorDetails = {
      id: this.generateErrorId(),
      category: 'file',
      severity: 'medium',
      code: errorCode,
      message: error.message || 'File operation failed',
      technicalMessage: this.sanitizeStackTrace(error.stack || error.message),
      userFriendlyMessage: errorMessage.message,
      context: { ...this.userContext, ...context },
      timestamp: new Date(),
      filename: this.sanitizeFilePath(error.filename),
      fileSize: error.fileSize,
      fileType: error.fileType,
      maxSize: error.maxSize,
      allowedTypes: error.allowedTypes,
      canRetry: true,
      maxRetries: 2
    };

    // Add file-specific recovery actions
    errorDetails.recoveryActions = this.createFileRecoveryActions(errorDetails);

    return this.displayError(errorDetails, {
      showTechnicalDetails: false,
      showContactSupport: false
    });
  }

  // API error handling
  public async handleApiError(error: any, context: Partial<ErrorContext> = {}): Promise<ErrorHandlerResponse> {
    const statusCode = error.response?.status || 500;
    const errorCode = this.mapStatusCodeToErrorCode(statusCode);
    const errorMessage = getErrorMessage(errorCode, context.userRole);
    
    const errorDetails: ApiErrorDetails = {
      id: this.generateErrorId(),
      category: 'api',
      severity: this.getApiErrorSeverity(statusCode),
      code: errorCode,
      message: error.message || 'API request failed',
      technicalMessage: JSON.stringify(error.response?.data, null, 2) || this.sanitizeStackTrace(error.stack),
      userFriendlyMessage: errorMessage.message,
      context: { ...this.userContext, ...context },
      timestamp: new Date(),
      endpoint: error.config?.url || context.endpoint || 'unknown',
      method: error.config?.method?.toUpperCase() || context.method || 'GET',
      statusCode,
      responseBody: error.response?.data,
      requestBody: error.config?.data,
      canRetry: this.canRetryApiError(statusCode),
      maxRetries: statusCode >= 500 ? 3 : 1
    };

    // Add API-specific recovery actions
    errorDetails.recoveryActions = this.createApiRecoveryActions(errorDetails);

    this.reportError(errorDetails);

    return this.displayError(errorDetails, {
      showTechnicalDetails: context.userRole === 'admin',
      showContactSupport: statusCode >= 500
    });
  }

  // Generic error handling fallback
  public async handleGenericError(error: any, context: Partial<ErrorContext> = {}): Promise<ErrorHandlerResponse> {
    const errorDetails: ErrorDetails = {
      id: this.generateErrorId(),
      category: 'system',
      severity: 'medium',
      code: ErrorCodes.SYSTEM_ERROR,
      message: error.message || 'An unexpected error occurred',
      technicalMessage: this.sanitizeStackTrace(error.stack || error.toString()),
      userFriendlyMessage: 'Something went wrong. Please try again.',
      context: { ...this.userContext, ...context },
      timestamp: new Date(),
      canRetry: true,
      maxRetries: 2
    };

    // Add generic recovery actions
    errorDetails.recoveryActions = this.createGenericRecoveryActions(errorDetails);

    this.reportError(errorDetails);

    return this.displayError(errorDetails, {
      showTechnicalDetails: context.userRole === 'admin',
      showContactSupport: true
    });
  }

  // Display error using SweetAlert2 with recovery actions
  private async displayError(errorDetails: ErrorDetails, options: ErrorDisplayOptions = {}): Promise<ErrorHandlerResponse> {
    if (errorDetails.recoveryActions && errorDetails.recoveryActions.length > 0) {
      return GuardianSweetAlert.showErrorWithActions(errorDetails, errorDetails.recoveryActions, options);
    } else {
      return GuardianSweetAlert.showError(errorDetails, options);
    }
  }

  // Report error to backend and error capture system
  private reportError(errorDetails: ErrorDetails): void {
    if (this.config.enableEmailReporting) {
      // Use existing error capture system for email reporting
      errorCapture.captureError(new Error(errorDetails.message), {
        page: errorDetails.context?.page,
        function: errorDetails.context?.component,
        userId: errorDetails.context?.userId,
        additionalInfo: {
          errorId: errorDetails.id,
          category: errorDetails.category,
          severity: errorDetails.severity,
          code: errorDetails.code,
          context: errorDetails.context
        }
      });
    }

    if (this.config.enableConsoleLogging && process.env.NODE_ENV === 'development') {
      console.group(`🚨 Guardian Error: ${errorDetails.id}`);
      console.error('Category:', errorDetails.category);
      console.error('Severity:', errorDetails.severity);
      console.error('Code:', errorDetails.code);
      console.error('Message:', errorDetails.message);
      console.error('Context:', errorDetails.context);
      console.error('Technical Details:', errorDetails.technicalMessage);
      console.groupEnd();
    }
  }

  // Error classification methods
  private isDatabaseError(error: any): boolean {
    return error?.code?.startsWith('DB_') || 
           error?.message?.includes('FOREIGN KEY') ||
           error?.message?.includes('UNIQUE constraint') ||
           error?.constraint ||
           error?.errno; // MySQL/SQL Server error numbers
  }

  private isNetworkError(error: any): boolean {
    return error?.code === 'NETWORK_ERROR' ||
           error?.code === 'ECONNABORTED' ||
           error?.response ||
           error?.request ||
           error?.isAxiosError;
  }

  private isValidationError(error: any): boolean {
    return error?.validationErrors ||
           error?.fieldErrors ||
           (Array.isArray(error) && error.some(e => e.field && e.message));
  }

  private isPermissionError(error: any): boolean {
    return error?.response?.status === 403 ||
           error?.response?.status === 401 ||
           error?.code === 'INSUFFICIENT_PERMISSIONS' ||
           error?.message?.includes('permission') ||
           error?.message?.includes('unauthorized');
  }

  private isFileError(error: any): boolean {
    return error?.code?.startsWith('FILE_') ||
           this.sanitizeFilePath(error?.filename) ||
           error?.fileSize ||
           error?.type === 'file';
  }

  private isApiError(error: any): boolean {
    return error?.response?.status || 
           error?.status ||
           error?.statusCode;
  }

  // Error classification helpers
  private classifyDatabaseError(error: any): string {
    if (error?.constraint || error?.message?.includes('UNIQUE constraint')) {
      return ErrorCodes.DUPLICATE_ENTRY;
    }
    if (error?.message?.includes('FOREIGN KEY')) {
      return ErrorCodes.FOREIGN_KEY_VIOLATION;
    }
    if (error?.code === 'ECONNREFUSED' || error?.message?.includes('connection')) {
      return ErrorCodes.CONNECTION_FAILED;
    }
    return ErrorCodes.CONSTRAINT_VIOLATION;
  }

  private classifyNetworkError(error: any): string {
    if (error?.code === 'ECONNABORTED') return ErrorCodes.TIMEOUT_ERROR;
    if (!navigator.onLine) return ErrorCodes.OFFLINE;
    if (error?.response?.status === 404) return ErrorCodes.NOT_FOUND;
    if (error?.response?.status === 401) return ErrorCodes.UNAUTHORIZED;
    if (error?.response?.status === 403) return ErrorCodes.FORBIDDEN;
    if (error?.response?.status === 429) return ErrorCodes.RATE_LIMITED;
    if (error?.response?.status >= 500) return ErrorCodes.SERVER_ERROR;
    return ErrorCodes.NETWORK_ERROR;
  }

  private classifyPermissionError(error: any): string {
    if (error?.response?.status === 401) return ErrorCodes.UNAUTHORIZED;
    if (error?.response?.status === 403) return ErrorCodes.FORBIDDEN;
    if (error?.message?.includes('expired')) return ErrorCodes.EXPIRED_SESSION;
    if (error?.message?.includes('invalid token')) return ErrorCodes.INVALID_TOKEN;
    return ErrorCodes.INSUFFICIENT_PERMISSIONS;
  }

  private classifyFileError(error: any): string {
    if (error?.code === 'FILE_TOO_LARGE' || error?.fileSize > error?.maxSize) {
      return ErrorCodes.FILE_TOO_LARGE;
    }
    if (error?.code === 'INVALID_FILE_TYPE' || 
        (error?.allowedTypes && !error?.allowedTypes.includes(error?.fileType))) {
      return ErrorCodes.INVALID_FILE_TYPE;
    }
    return ErrorCodes.UPLOAD_FAILED;
  }

  private mapStatusCodeToErrorCode(statusCode: number): string {
    const mapping: { [key: number]: string } = {
      400: ErrorCodes.INVALID_INPUT,
      401: ErrorCodes.UNAUTHORIZED,
      403: ErrorCodes.FORBIDDEN,
      404: ErrorCodes.NOT_FOUND,
      422: ErrorCodes.INVALID_FORMAT,
      429: ErrorCodes.RATE_LIMITED,
      500: ErrorCodes.SERVER_ERROR,
      502: ErrorCodes.SERVICE_UNAVAILABLE,
      503: ErrorCodes.SERVICE_UNAVAILABLE,
      504: ErrorCodes.TIMEOUT_ERROR
    };
    
    return mapping[statusCode] || ErrorCodes.SYSTEM_ERROR;
  }

  // Severity classification
  private getNetworkErrorSeverity(error: any): ErrorSeverity {
    if (!navigator.onLine) return 'critical';
    if (error?.response?.status >= 500) return 'high';
    if (error?.response?.status === 404) return 'medium';
    return 'low';
  }

  private getApiErrorSeverity(statusCode: number): ErrorSeverity {
    if (statusCode >= 500) return 'high';
    if (statusCode === 401 || statusCode === 403) return 'high';
    if (statusCode === 404) return 'medium';
    return 'low';
  }

  // Recovery action creators
  private createDatabaseRecoveryActions(errorDetails: DatabaseErrorDetails): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = [];

    if (errorDetails.canRetry) {
      actions.push({
        id: 'retry-database',
        label: '🔄 Try Again',
        type: 'primary',
        action: async () => {
          // Implement retry logic
          GuardianSweetAlert.showToast('Retrying operation...', 'info');
        }
      });
    }

    if (errorDetails.code === ErrorCodes.DUPLICATE_ENTRY) {
      actions.push({
        id: 'modify-data',
        label: '✏️ Modify Information',
        type: 'secondary',
        action: async () => {
          // Focus on problematic field or show form
        }
      });
    }

    actions.push({
      id: 'contact-support',
      label: '📞 Contact Support',
      type: 'secondary',
      action: async () => {
        window.location.href = `mailto:${this.config.supportEmail}?subject=Database Error - ${errorDetails.id}`;
      }
    });

    return actions;
  }

  private createNetworkRecoveryActions(errorDetails: NetworkErrorDetails): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = [];

    if (errorDetails.canRetry) {
      actions.push({
        id: 'retry-network',
        label: '🔄 Retry Request',
        type: 'primary',
        action: async () => {
          // Implement network retry logic
          await this.retryWithDelay(async () => {
            // Retry the original request
            GuardianSweetAlert.showToast('Retrying request...', 'info');
          }, this.config.retryDelay);
        }
      });
    }

    if (errorDetails.offline) {
      actions.push({
        id: 'check-connection',
        label: '🌐 Check Connection',
        type: 'secondary',
        action: async () => {
          if (navigator.onLine) {
            GuardianSweetAlert.showToast('Connection restored!', 'success');
          } else {
            GuardianSweetAlert.showToast('Still offline. Please check your internet connection.', 'warning');
          }
        }
      });
    }

    return actions;
  }

  private createValidationRecoveryActions(errorDetails: ValidationErrorDetails): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = [];

    actions.push({
      id: 'fix-validation',
      label: '✅ Fix Issues',
      type: 'primary',
      action: async () => {
        // Scroll to and highlight problem fields
        if (errorDetails.fieldErrors) {
          errorDetails.fieldErrors.forEach(fieldError => {
            const field = document.querySelector(`[name="${fieldError.field}"], [data-field="${fieldError.field}"]`) as HTMLElement;
            if (field) {
              field.scrollIntoView({ behavior: 'smooth', block: 'center' });
              field.classList.add('error');
              field.focus();
            }
          });
        }
      }
    });

    return actions;
  }

  private createPermissionRecoveryActions(errorDetails: PermissionErrorDetails): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = [];

    if (errorDetails.code === ErrorCodes.EXPIRED_SESSION) {
      actions.push({
        id: 'sign-in-again',
        label: '🔐 Sign In Again',
        type: 'primary',
        action: async () => {
          window.location.href = '/login';
        }
      });
    } else {
      actions.push({
        id: 'request-access',
        label: '📝 Request Access',
        type: 'primary',
        action: async () => {
          window.location.href = `mailto:${this.config.supportEmail}?subject=Access Request - ${errorDetails.resource}`;
        }
      });
    }

    return actions;
  }

  private createFileRecoveryActions(errorDetails: FileErrorDetails): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = [];

    if (errorDetails.code === ErrorCodes.FILE_TOO_LARGE) {
      actions.push({
        id: 'compress-file',
        label: '📦 Choose Smaller File',
        type: 'primary',
        action: async () => {
          // Trigger file selector
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
          if (fileInput) {
            fileInput.click();
          }
        }
      });
    }

    if (errorDetails.code === ErrorCodes.INVALID_FILE_TYPE) {
      actions.push({
        id: 'choose-different-file',
        label: '📄 Choose Different File',
        type: 'primary',
        action: async () => {
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
          if (fileInput) {
            fileInput.click();
          }
        }
      });
    }

    return actions;
  }

  private createApiRecoveryActions(errorDetails: ApiErrorDetails): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = [];

    if (errorDetails.canRetry) {
      actions.push({
        id: 'retry-api',
        label: '🔄 Try Again',
        type: 'primary',
        action: async () => {
          GuardianSweetAlert.showToast('Retrying request...', 'info');
        }
      });
    }

    if (errorDetails.statusCode === 404) {
      actions.push({
        id: 'go-back',
        label: '← Go Back',
        type: 'secondary',
        action: async () => {
          window.history.back();
        }
      });
    }

    return actions;
  }

  private createGenericRecoveryActions(errorDetails: ErrorDetails): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = [];

    if (errorDetails.canRetry) {
      actions.push({
        id: 'retry-generic',
        label: '🔄 Try Again',
        type: 'primary',
        action: async () => {
          window.location.reload();
        }
      });
    }

    actions.push({
      id: 'report-issue',
      label: '🐛 Report Issue',
      type: 'secondary',
      action: async () => {
        window.location.href = `mailto:${this.config.supportEmail}?subject=Error Report - ${errorDetails.id}&body=Error Details: ${JSON.stringify(errorDetails, null, 2)}`;
      }
    });

    return actions;
  }

  // Utility methods
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Sanitize file paths to prevent development file path leakage in production
  private sanitizeFilePath(filePath?: string): string | undefined {
    if (!filePath) return undefined;
    
    // In production, only show the filename, not the full path
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      // Extract just the filename from the full path
      return filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown';
    }
    
    return filePath;
  }

  // Sanitize stack traces to prevent development file path leakage in production
  private sanitizeStackTrace(stackTrace?: string): string | undefined {
    if (!stackTrace) return undefined;
    
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
      return stackTrace;
    }
    
    // In production, remove file paths from stack traces
    return stackTrace
      .split('\n')
      .map(line => {
        // Remove absolute file paths, keep only relative paths and function names
        return line.replace(/\/[^:\s]*\/[^:\s]*\//g, '...')
                  .replace(/C:\\[^:\s]*\\[^:\s]*\\/g, '...')
                  .replace(/\/Users\/[^\/]*\/[^:\s]*\//g, '...')
                  .replace(/\/opt\/[^:\s]*\//g, '...');
      })
      .join('\n');
  }

  private async retryWithDelay(fn: () => Promise<void>, delay: number): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          await fn();
          resolve();
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  }

  private canRetryNetworkError(error: any): boolean {
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    return retryableStatusCodes.includes(error.response?.status) ||
           error.code === 'ECONNABORTED' ||
           error.code === 'NETWORK_ERROR';
  }

  private canRetryApiError(statusCode: number): boolean {
    return [408, 429, 500, 502, 503, 504].includes(statusCode);
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private extractValidationErrors(error: any): Array<{ field: string; message: string; value?: any }> {
    if (error?.fieldErrors) return error.fieldErrors;
    if (error?.validationErrors) return error.validationErrors;
    if (Array.isArray(error)) return error;
    
    // Try to extract from common validation error formats
    if (error?.response?.data?.errors) {
      return Object.entries(error.response.data.errors).map(([field, message]) => ({
        field,
        message: Array.isArray(message) ? message[0] : message
      }));
    }
    
    return [{ field: 'unknown', message: error.message || 'Validation failed' }];
  }

  private extractConstraintInfo(error: any): string | undefined {
    return error?.constraint || error?.constraintName;
  }

  private extractTableInfo(error: any): string | undefined {
    return error?.table || error?.tableName;
  }

  private extractFieldInfo(error: any): string | undefined {
    return error?.field || error?.column || error?.columnName;
  }

  private extractRequiredRole(error: any): UserRole | undefined {
    return error?.requiredRole;
  }

  private async handleOfflineError(errorDetails: NetworkErrorDetails): Promise<ErrorHandlerResponse> {
    // Special handling for offline scenarios
    const result = await GuardianSweetAlert.showConfirmation(
      'No Internet Connection',
      'You appear to be offline. Would you like to try again when your connection is restored?',
      {
        confirmText: 'Retry When Online',
        cancelText: 'Cancel',
        severity: 'high'
      }
    );

    if (result) {
      // Wait for online event and then retry
      return new Promise((resolve) => {
        const handleOnline = () => {
          window.removeEventListener('online', handleOnline);
          resolve({ success: true, action: 'retry' });
        };
        window.addEventListener('online', handleOnline);
      });
    }

    return { success: false, action: 'dismiss' };
  }
}

// Export singleton instance
export const errorManager = ErrorManager.getInstance();
export default errorManager;