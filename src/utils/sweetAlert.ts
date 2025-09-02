/**
 * Enhanced SweetAlert2 Utilities for Guardian MVP
 * Branded error handling with user-friendly messaging and recovery actions
 */

import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { 
  ErrorDetails, 
  ErrorSeverity, 
  ErrorCategory, 
  ErrorDisplayOptions, 
  ErrorRecoveryAction,
  UserRole,
  ErrorHandlerResponse 
} from '../types/errorTypes';

// Initialize SweetAlert2 with React content support
const MySwal = withReactContent(Swal);

// Guardian MVP branded theme configuration
const GUARDIAN_THEME = {
  colors: {
    primary: '#2EBCBC',
    success: '#27AE60',
    warning: '#E2B93B',
    error: '#C10000',
    info: '#2F8CED',
    dark: '#333333',
    light: '#f8f9fa',
    white: '#ffffff'
  },
  fonts: {
    primary: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    monospace: '"Courier New", Courier, monospace'
  }
};

// Severity-based styling configuration
const SEVERITY_STYLES = {
  critical: {
    iconColor: GUARDIAN_THEME.colors.error,
    confirmButtonColor: GUARDIAN_THEME.colors.error,
    background: GUARDIAN_THEME.colors.white,
    titleColor: GUARDIAN_THEME.colors.error,
    icon: 'error' as const
  },
  high: {
    iconColor: GUARDIAN_THEME.colors.warning,
    confirmButtonColor: GUARDIAN_THEME.colors.warning,
    background: GUARDIAN_THEME.colors.white,
    titleColor: GUARDIAN_THEME.colors.dark,
    icon: 'warning' as const
  },
  medium: {
    iconColor: GUARDIAN_THEME.colors.info,
    confirmButtonColor: GUARDIAN_THEME.colors.primary,
    background: GUARDIAN_THEME.colors.white,
    titleColor: GUARDIAN_THEME.colors.dark,
    icon: 'info' as const
  },
  low: {
    iconColor: GUARDIAN_THEME.colors.info,
    confirmButtonColor: GUARDIAN_THEME.colors.primary,
    background: GUARDIAN_THEME.colors.white,
    titleColor: GUARDIAN_THEME.colors.dark,
    icon: 'info' as const
  },
  info: {
    iconColor: GUARDIAN_THEME.colors.success,
    confirmButtonColor: GUARDIAN_THEME.colors.success,
    background: GUARDIAN_THEME.colors.white,
    titleColor: GUARDIAN_THEME.colors.dark,
    icon: 'success' as const
  }
};

// Custom CSS classes for Guardian branding
const GUARDIAN_CUSTOM_CLASSES = {
  container: 'guardian-swal-container',
  popup: 'guardian-swal-popup',
  header: 'guardian-swal-header',
  title: 'guardian-swal-title',
  content: 'guardian-swal-content',
  actions: 'guardian-swal-actions',
  confirmButton: 'guardian-swal-confirm',
  cancelButton: 'guardian-swal-cancel'
};

// Enhanced SweetAlert2 utility class
export class GuardianSweetAlert {
  private static injectCustomStyles(): void {
    const styleId = 'guardian-swal-styles';
    
    // Check if styles are already injected
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .guardian-swal-container {
        z-index: 10000;
      }
      
      .guardian-swal-popup {
        font-family: ${GUARDIAN_THEME.fonts.primary};
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      }
      
      .guardian-swal-title {
        font-weight: 600;
        font-size: 1.5rem;
        margin-bottom: 1rem;
      }
      
      .guardian-swal-content {
        font-size: 1rem;
        line-height: 1.5;
        color: ${GUARDIAN_THEME.colors.dark};
      }
      
      .guardian-swal-actions {
        gap: 1rem;
        flex-wrap: wrap;
      }
      
      .guardian-swal-confirm {
        padding: 0.75rem 2rem;
        border-radius: 6px;
        font-weight: 500;
        min-width: 120px;
        transition: all 0.3s ease;
      }
      
      .guardian-swal-cancel {
        padding: 0.75rem 2rem;
        border-radius: 6px;
        font-weight: 500;
        min-width: 120px;
        background-color: transparent;
        border: 2px solid #ddd;
        color: ${GUARDIAN_THEME.colors.dark};
        transition: all 0.3s ease;
      }
      
      .guardian-swal-cancel:hover {
        background-color: ${GUARDIAN_THEME.colors.light};
        border-color: ${GUARDIAN_THEME.colors.primary};
      }
      
      .error-details {
        background-color: ${GUARDIAN_THEME.colors.light};
        border-radius: 6px;
        padding: 1rem;
        margin: 1rem 0;
        font-family: ${GUARDIAN_THEME.fonts.monospace};
        font-size: 0.875rem;
        color: ${GUARDIAN_THEME.colors.dark};
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 200px;
        overflow-y: auto;
      }
      
      .recovery-actions {
        margin-top: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      
      .recovery-action {
        display: flex;
        align-items: center;
        padding: 0.75rem 1rem;
        border: 1px solid #ddd;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.3s ease;
        background-color: white;
      }
      
      .recovery-action:hover {
        border-color: ${GUARDIAN_THEME.colors.primary};
        background-color: ${GUARDIAN_THEME.colors.light};
      }
      
      .recovery-action-icon {
        margin-right: 0.75rem;
        font-size: 1.1rem;
      }
      
      .recovery-action-label {
        flex: 1;
        font-weight: 500;
      }
      
      .error-summary {
        background-color: white;
        border-left: 4px solid;
        padding: 1rem;
        margin-bottom: 1rem;
      }
      
      .error-summary.critical {
        border-left-color: ${GUARDIAN_THEME.colors.error};
      }
      
      .error-summary.high {
        border-left-color: ${GUARDIAN_THEME.colors.warning};
      }
      
      .error-summary.medium,
      .error-summary.low,
      .error-summary.info {
        border-left-color: ${GUARDIAN_THEME.colors.info};
      }
      
      .expandable-details {
        margin-top: 1rem;
      }
      
      .expandable-details summary {
        cursor: pointer;
        padding: 0.5rem;
        font-weight: 500;
        color: ${GUARDIAN_THEME.colors.primary};
      }
      
      .expandable-details summary:hover {
        background-color: ${GUARDIAN_THEME.colors.light};
        border-radius: 4px;
      }
      
      .toast-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10001;
        max-width: 400px;
      }
    `;
    
    document.head.appendChild(style);
  }

  // Display comprehensive error modal
  public static async showError(errorDetails: ErrorDetails, options: ErrorDisplayOptions = {}): Promise<ErrorHandlerResponse> {
    this.injectCustomStyles();
    
    const severity = errorDetails.severity;
    const severityStyle = SEVERITY_STYLES[severity];
    
    const htmlContent = this.buildErrorHTML(errorDetails, options);
    
    const result = await MySwal.fire({
      title: options.title || errorDetails.userFriendlyMessage,
      html: htmlContent,
      icon: severityStyle.icon,
      iconColor: severityStyle.iconColor,
      confirmButtonText: 'OK',
      confirmButtonColor: severityStyle.confirmButtonColor,
      cancelButtonColor: '#6c757d',
      background: severityStyle.background,
      allowOutsideClick: options.allowOutsideClick !== false,
      backdrop: options.backdrop !== false,
      showCancelButton: false,
      customClass: {
        container: GUARDIAN_CUSTOM_CLASSES.container,
        popup: GUARDIAN_CUSTOM_CLASSES.popup,
        title: GUARDIAN_CUSTOM_CLASSES.title,
        htmlContainer: GUARDIAN_CUSTOM_CLASSES.content,
        actions: GUARDIAN_CUSTOM_CLASSES.actions,
        confirmButton: GUARDIAN_CUSTOM_CLASSES.confirmButton,
        cancelButton: GUARDIAN_CUSTOM_CLASSES.cancelButton
      },
      ...options
    });

    return {
      success: result.isConfirmed,
      action: 'dismiss'
    };
  }

  // Display error with recovery actions
  public static async showErrorWithActions(
    errorDetails: ErrorDetails, 
    actions: ErrorRecoveryAction[],
    options: ErrorDisplayOptions = {}
  ): Promise<ErrorHandlerResponse> {
    this.injectCustomStyles();
    
    const severity = errorDetails.severity;
    const severityStyle = SEVERITY_STYLES[severity];
    
    const htmlContent = this.buildErrorHTMLWithActions(errorDetails, actions, options);
    
    const result = await MySwal.fire({
      title: options.title || errorDetails.userFriendlyMessage,
      html: htmlContent,
      icon: severityStyle.icon,
      iconColor: severityStyle.iconColor,
      showConfirmButton: false,
      showCancelButton: false,
      allowOutsideClick: options.allowOutsideClick !== false,
      backdrop: options.backdrop !== false,
      customClass: {
        container: GUARDIAN_CUSTOM_CLASSES.container,
        popup: GUARDIAN_CUSTOM_CLASSES.popup,
        title: GUARDIAN_CUSTOM_CLASSES.title,
        htmlContainer: GUARDIAN_CUSTOM_CLASSES.content,
      },
      didOpen: (popup) => {
        // Add click handlers for recovery actions
        actions.forEach((action, index) => {
          const button = popup.querySelector(`[data-action-id="${action.id}"]`) as HTMLElement;
          if (button) {
            button.addEventListener('click', async () => {
              MySwal.close();
              try {
                await action.action();
              } catch (error) {
                console.error('Recovery action failed:', error);
              }
            });
          }
        });
      },
      ...options
    });

    return {
      success: result.isConfirmed,
      action: 'dismiss'
    };
  }

  // Display confirmation dialog with error context
  public static async showConfirmation(
    title: string,
    message: string,
    options: {
      confirmText?: string;
      cancelText?: string;
      severity?: ErrorSeverity;
      dangerousAction?: boolean;
    } = {}
  ): Promise<boolean> {
    this.injectCustomStyles();
    
    const severity = options.severity || 'medium';
    const severityStyle = SEVERITY_STYLES[severity];
    
    const result = await MySwal.fire({
      title,
      text: message,
      icon: options.dangerousAction ? 'warning' : severityStyle.icon,
      iconColor: options.dangerousAction ? GUARDIAN_THEME.colors.error : severityStyle.iconColor,
      showCancelButton: true,
      confirmButtonText: options.confirmText || 'Confirm',
      cancelButtonText: options.cancelText || 'Cancel',
      confirmButtonColor: options.dangerousAction ? GUARDIAN_THEME.colors.error : GUARDIAN_THEME.colors.primary,
      cancelButtonColor: '#6c757d',
      customClass: {
        container: GUARDIAN_CUSTOM_CLASSES.container,
        popup: GUARDIAN_CUSTOM_CLASSES.popup,
        title: GUARDIAN_CUSTOM_CLASSES.title,
        confirmButton: GUARDIAN_CUSTOM_CLASSES.confirmButton,
        cancelButton: GUARDIAN_CUSTOM_CLASSES.cancelButton
      }
    });

    return result.isConfirmed;
  }

  // Display success message
  public static async showSuccess(
    title: string, 
    message?: string,
    options: ErrorDisplayOptions = {}
  ): Promise<void> {
    this.injectCustomStyles();
    
    await MySwal.fire({
      title,
      text: message,
      icon: 'success',
      iconColor: GUARDIAN_THEME.colors.success,
      confirmButtonText: 'Great!',
      confirmButtonColor: GUARDIAN_THEME.colors.success,
      timer: options.autoClose ? (options.autoCloseDelay || 3000) : undefined,
      timerProgressBar: options.showProgressBar,
      customClass: {
        container: GUARDIAN_CUSTOM_CLASSES.container,
        popup: GUARDIAN_CUSTOM_CLASSES.popup,
        title: GUARDIAN_CUSTOM_CLASSES.title,
        confirmButton: GUARDIAN_CUSTOM_CLASSES.confirmButton
      },
      ...options
    });
  }

  // Display toast notification
  public static async showToast(
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    duration: number = 3000
  ): Promise<void> {
    const Toast = MySwal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: duration,
      timerProgressBar: true,
      customClass: {
        container: 'toast-notification'
      },
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
      }
    });

    const colors = {
      success: GUARDIAN_THEME.colors.success,
      error: GUARDIAN_THEME.colors.error,
      warning: GUARDIAN_THEME.colors.warning,
      info: GUARDIAN_THEME.colors.info
    };

    await Toast.fire({
      icon: type,
      iconColor: colors[type],
      title: message,
      background: GUARDIAN_THEME.colors.white,
      color: GUARDIAN_THEME.colors.dark
    });
  }

  // Build HTML content for error display
  private static buildErrorHTML(errorDetails: ErrorDetails, options: ErrorDisplayOptions): string {
    let html = `<div class="error-summary ${errorDetails.severity}">`;
    
    // Main error message
    html += `<div style="margin-bottom: 1rem;">${errorDetails.userFriendlyMessage}</div>`;
    
    // Recovery guidance if available
    if (errorDetails.recoveryActions && errorDetails.recoveryActions.length > 0) {
      html += `<div style="margin-bottom: 1rem; font-style: italic; color: #666;">`;
      html += `Click one of the options below to resolve this issue:`;
      html += `</div>`;
    }
    
    // Show technical details if requested and user has appropriate role
    if (options.showTechnicalDetails && errorDetails.technicalMessage) {
      html += `
        <div class="expandable-details">
          <details>
            <summary>Technical Details</summary>
            <div class="error-details">${errorDetails.technicalMessage}</div>
          </details>
        </div>
      `;
    }
    
    // Show contact support option if enabled
    if (options.showContactSupport || errorDetails.contactSupport) {
      html += `
        <div style="margin-top: 1rem; padding: 1rem; background-color: #f8f9fa; border-radius: 6px; text-align: center;">
          <small style="color: #666;">
            Need help? <a href="mailto:ernest@shieldlytics.com?subject=Guardian MVP Error - ${errorDetails.code}" 
                         style="color: ${GUARDIAN_THEME.colors.primary}; text-decoration: none;">
              Contact Support
            </a>
          </small>
        </div>
      `;
    }
    
    html += `</div>`;
    
    return html;
  }

  // Build HTML content with recovery actions
  private static buildErrorHTMLWithActions(
    errorDetails: ErrorDetails, 
    actions: ErrorRecoveryAction[],
    options: ErrorDisplayOptions
  ): string {
    let html = this.buildErrorHTML(errorDetails, options);
    
    if (actions && actions.length > 0) {
      html += `<div class="recovery-actions">`;
      
      actions.forEach(action => {
        const buttonClass = `recovery-action ${action.type || 'primary'}`;
        const disabled = action.disabled ? 'disabled' : '';
        
        html += `
          <button class="${buttonClass}" data-action-id="${action.id}" ${disabled}>
            ${action.icon ? `<span class="recovery-action-icon">${action.icon}</span>` : ''}
            <span class="recovery-action-label">${action.label}</span>
          </button>
        `;
      });
      
      html += `</div>`;
    }
    
    return html;
  }
}

// Export convenience functions for backward compatibility
export const showToast = {
  success: (message: string) => GuardianSweetAlert.showToast(message, 'success'),
  error: (message: string) => GuardianSweetAlert.showToast(message, 'error'),
  warning: (message: string) => GuardianSweetAlert.showToast(message, 'warning'),
  info: (message: string) => GuardianSweetAlert.showToast(message, 'info')
};

export const showAlert = {
  confirm: async (options: {
    title: string;
    text: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
    dangerousAction?: boolean;
  }) => {
    return GuardianSweetAlert.showConfirmation(
      options.title,
      options.text,
      {
        confirmText: options.confirmButtonText,
        cancelText: options.cancelButtonText,
        dangerousAction: options.dangerousAction
      }
    );
  },
  success: (title: string, text?: string) => {
    return GuardianSweetAlert.showSuccess(title, text);
  },
  error: (title: string, text?: string) => {
    // This will be replaced by the ErrorManager for proper error handling
    return GuardianSweetAlert.showToast(`${title}: ${text}`, 'error');
  }
};

export default GuardianSweetAlert;