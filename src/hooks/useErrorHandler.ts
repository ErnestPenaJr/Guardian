/**
 * Custom React Hook for Error Handling in Guardian MVP
 * Provides convenient access to ErrorManager with component-specific context
 */

import { useCallback, useContext, useMemo } from 'react';
import { errorManager } from '../services/ErrorManager';
import { 
  ErrorContext, 
  UserRole, 
  ErrorHandlerResponse,
  ErrorCodes 
} from '../types/errorTypes';

// Hook for accessing authentication context (assumes useAuth hook exists)
// This will integrate with your existing auth system
const useAuthContext = () => {
  try {
    // Try to get user context from localStorage or auth context
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const companyId = localStorage.getItem('companyId');
    
    return {
      userId: user?.id?.toString(),
      userEmail: user?.email,
      userRole: mapRoleIdToUserRole(user?.role),
      companyId: companyId || undefined,
      isAuthenticated: !!user
    };
  } catch {
    return {
      userId: undefined,
      userEmail: undefined,
      userRole: 'guest' as UserRole,
      companyId: undefined,
      isAuthenticated: false
    };
  }
};

// Helper function to map Guardian role IDs to UserRole enum
const mapRoleIdToUserRole = (roleId: number | string): UserRole => {
  switch (roleId?.toString()) {
    case '1': return 'admin';
    case '3': return 'processor'; 
    case '4': return 'manager';
    case '6': return 'admin'; // Super admin
    default: return 'user';
  }
};

interface UseErrorHandlerOptions {
  component?: string;
  action?: string;
  endpoint?: string;
  enableAutoReporting?: boolean;
  showToastOnSuccess?: boolean;
}

interface UseErrorHandlerReturn {
  // Main error handling methods
  handleError: (error: any, context?: Partial<ErrorContext>) => Promise<ErrorHandlerResponse>;
  handleAsyncError: <T>(
    asyncFn: () => Promise<T>,
    context?: Partial<ErrorContext>
  ) => Promise<T | null>;
  
  // Specific error handlers for common scenarios
  handleApiError: (error: any, endpoint?: string, method?: string) => Promise<ErrorHandlerResponse>;
  handleFormError: (error: any, formName?: string) => Promise<ErrorHandlerResponse>;
  handleFileError: (error: any, filename?: string) => Promise<ErrorHandlerResponse>;
  handleValidationError: (fieldErrors: any[], formName?: string) => Promise<ErrorHandlerResponse>;
  
  // Utility methods
  showSuccess: (message: string, details?: string) => Promise<void>;
  showWarning: (message: string, details?: string) => Promise<void>;
  showInfo: (message: string, details?: string) => Promise<void>;
  confirmAction: (title: string, message: string, isDangerous?: boolean) => Promise<boolean>;
  
  // Error state management
  isOnline: boolean;
  canRetry: (error: any) => boolean;
}

export const useErrorHandler = (options: UseErrorHandlerOptions = {}): UseErrorHandlerReturn => {
  const authContext = useAuthContext();
  
  // Base context that will be merged with error-specific context
  const baseContext: Partial<ErrorContext> = useMemo(() => ({
    userId: authContext.userId,
    userEmail: authContext.userEmail,
    userRole: authContext.userRole,
    companyId: authContext.companyId,
    page: window.location.pathname,
    component: options.component,
    action: options.action,
    endpoint: options.endpoint
  }), [authContext, options.component, options.action, options.endpoint]);

  // Update error manager user context when auth changes
  useMemo(() => {
    errorManager.updateUserContext(baseContext);
  }, [baseContext]);

  // Main error handler
  const handleError = useCallback(async (
    error: any, 
    context: Partial<ErrorContext> = {}
  ): Promise<ErrorHandlerResponse> => {
    const fullContext = {
      ...baseContext,
      ...context,
      timestamp: new Date()
    };

    return errorManager.handleError(error, fullContext);
  }, [baseContext]);

  // Async error wrapper - handles errors in async operations
  const handleAsyncError = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    context: Partial<ErrorContext> = {}
  ): Promise<T | null> => {
    try {
      return await asyncFn();
    } catch (error) {
      await handleError(error, context);
      return null;
    }
  }, [handleError]);

  // API error handler with endpoint context
  const handleApiError = useCallback(async (
    error: any,
    endpoint?: string,
    method?: string
  ): Promise<ErrorHandlerResponse> => {
    return handleError(error, {
      endpoint: endpoint || options.endpoint,
      method: method?.toUpperCase(),
      category: 'api'
    });
  }, [handleError, options.endpoint]);

  // Form error handler with form-specific context
  const handleFormError = useCallback(async (
    error: any,
    formName?: string
  ): Promise<ErrorHandlerResponse> => {
    return handleError(error, {
      action: `form_submit_${formName}`,
      category: 'validation'
    });
  }, [handleError]);

  // File error handler with file context
  const handleFileError = useCallback(async (
    error: any,
    filename?: string
  ): Promise<ErrorHandlerResponse> => {
    // Sanitize filename to prevent path leakage
    const sanitizedFilename = filename ? 
      filename.split('/').pop() || filename.split('\\').pop() || filename 
      : undefined;
    
    return errorManager.handleFileError(error, {
      ...baseContext,
      action: 'file_upload',
      additionalInfo: { 
        filename: sanitizedFilename,
        originalProvided: !!filename
      }
    });
  }, [baseContext]);

  // Validation error handler
  const handleValidationError = useCallback(async (
    fieldErrors: any[],
    formName?: string
  ): Promise<ErrorHandlerResponse> => {
    const validationError = {
      fieldErrors,
      validationErrors: fieldErrors,
      message: `Form validation failed: ${fieldErrors.length} errors`
    };
    
    return errorManager.handleValidationError(validationError, {
      ...baseContext,
      action: `validate_${formName}`
    });
  }, [baseContext]);

  // Success message handler
  const showSuccess = useCallback(async (message: string, details?: string) => {
    const { showSuccess } = await import('../utils/sweetAlert');
    return showSuccess(message, details);
  }, []);

  // Warning message handler
  const showWarning = useCallback(async (message: string, details?: string) => {
    const GuardianSweetAlert = (await import('../utils/sweetAlert')).default;
    return GuardianSweetAlert.showToast(message, 'warning');
  }, []);

  // Info message handler
  const showInfo = useCallback(async (message: string, details?: string) => {
    const GuardianSweetAlert = (await import('../utils/sweetAlert')).default;
    return GuardianSweetAlert.showToast(message, 'info');
  }, []);

  // Confirmation dialog
  const confirmAction = useCallback(async (
    title: string, 
    message: string, 
    isDangerous: boolean = false
  ): Promise<boolean> => {
    const GuardianSweetAlert = (await import('../utils/sweetAlert')).default;
    return GuardianSweetAlert.showConfirmation(title, message, {
      dangerousAction: isDangerous,
      confirmText: isDangerous ? 'Yes, Delete' : 'Confirm',
      cancelText: 'Cancel'
    });
  }, []);

  // Network status check
  const isOnline = useMemo(() => navigator.onLine, []);

  // Check if error can be retried
  const canRetry = useCallback((error: any): boolean => {
    // Network errors
    if (error?.code === 'NETWORK_ERROR' || error?.code === 'ECONNABORTED') {
      return true;
    }
    
    // API errors with retryable status codes
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    if (error?.response?.status && retryableStatusCodes.includes(error.response.status)) {
      return true;
    }
    
    // Database timeout errors
    if (error?.code === ErrorCodes.TIMEOUT) {
      return true;
    }
    
    return false;
  }, []);

  return {
    // Main methods
    handleError,
    handleAsyncError,
    
    // Specific handlers
    handleApiError,
    handleFormError,
    handleFileError,
    handleValidationError,
    
    // Utility methods
    showSuccess,
    showWarning,
    showInfo,
    confirmAction,
    
    // Status methods
    isOnline,
    canRetry
  };
};

// Additional hook for handling API requests with built-in error handling
export const useApiWithErrorHandling = (
  baseEndpoint?: string,
  options: UseErrorHandlerOptions = {}
) => {
  const { handleApiError, handleAsyncError, isOnline } = useErrorHandler({
    ...options,
    endpoint: baseEndpoint
  });

  const apiCall = useCallback(async <T>(
    apiFunction: () => Promise<T>,
    endpoint?: string,
    method?: string
  ): Promise<T | null> => {
    if (!isOnline) {
      await handleApiError(
        { code: ErrorCodes.OFFLINE, message: 'No internet connection' },
        endpoint,
        method
      );
      return null;
    }

    return handleAsyncError(apiFunction, {
      endpoint: endpoint || baseEndpoint,
      method: method?.toUpperCase()
    });
  }, [handleApiError, handleAsyncError, isOnline, baseEndpoint]);

  return {
    apiCall,
    handleApiError,
    isOnline
  };
};

// Hook specifically for form handling with validation
export const useFormErrorHandler = (formName: string, options: UseErrorHandlerOptions = {}) => {
  const { 
    handleFormError, 
    handleValidationError, 
    handleAsyncError,
    showSuccess,
    confirmAction 
  } = useErrorHandler({
    ...options,
    component: `${formName}Form`,
    action: 'form_submission'
  });

  const handleFormSubmit = useCallback(async <T>(
    submitFunction: () => Promise<T>,
    successMessage?: string
  ): Promise<T | null> => {
    const result = await handleAsyncError(submitFunction, {
      action: 'form_submit',
      additionalInfo: { formName }
    });

    if (result && successMessage && options.showToastOnSuccess !== false) {
      await showSuccess(successMessage);
    }

    return result;
  }, [handleAsyncError, showSuccess, formName, options.showToastOnSuccess]);

  const handleFieldValidation = useCallback(async (
    fieldName: string,
    value: any,
    validationRules: Array<(value: any) => string | null>
  ): Promise<string[]> => {
    const errors: string[] = [];
    
    validationRules.forEach(rule => {
      const error = rule(value);
      if (error) {
        errors.push(error);
      }
    });

    if (errors.length > 0) {
      await handleValidationError([
        { field: fieldName, message: errors[0], value }
      ], formName);
    }

    return errors;
  }, [handleValidationError, formName]);

  const confirmFormReset = useCallback(async (): Promise<boolean> => {
    return confirmAction(
      'Reset Form',
      'Are you sure you want to reset this form? All unsaved changes will be lost.',
      false
    );
  }, [confirmAction]);

  return {
    handleFormSubmit,
    handleFormError,
    handleValidationError,
    handleFieldValidation,
    confirmFormReset,
    showSuccess
  };
};

export default useErrorHandler;