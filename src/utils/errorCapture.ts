/**
 * Global Error Capture System
 * Captures JavaScript errors and sends detailed reports to support email
 */

interface ErrorDetails {
  mainError: string;
  pageName: string;
  functionName: string;
  lineNumber: number;
  columnNumber: number;
  fileName: string;
  stackTrace: string;
  userAgent: string;
  timestamp: string;
  url: string;
  userId?: string;
  email?: string;
  errorType?: 'javascript' | 'react' | 'api' | 'console' | 'promise';
  apiEndpoint?: string;
  apiMethod?: string;
  apiStatusCode?: number;
  apiRequestData?: any;
  apiResponseData?: any;
  componentStack?: string;
}

class ErrorCapture {
  private static instance: ErrorCapture;
  private readonly SUPPORT_EMAIL = 'ernest@shieldlytics.com';
  private readonly API_BASE = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3001' 
    : window.location.origin;
  
  // Infinite loop protection
  private isProcessingError = false;
  private errorQueue: Set<string> = new Set();
  private lastErrorTime = 0;
  private errorCount = 0;
  private readonly MAX_ERRORS_PER_MINUTE = 10;
  private readonly DEBOUNCE_TIME = 1000; // 1 second

  private constructor() {
    this.setupGlobalErrorHandlers();
  }

  public static getInstance(): ErrorCapture {
    if (!ErrorCapture.instance) {
      ErrorCapture.instance = new ErrorCapture();
    }
    return ErrorCapture.instance;
  }

  private setupGlobalErrorHandlers(): void {
    // Capture JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError({
        error: event.error,
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        errorType: 'javascript',
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        error: event.reason,
        message: `Unhandled Promise Rejection: ${event.reason}`,
        filename: 'Promise',
        lineno: 0,
        colno: 0,
        errorType: 'promise',
      });
    });

    // Capture console errors
    this.setupConsoleErrorCapture();

    // Capture React errors (if using error boundaries)
    this.setupReactErrorBoundary();
  }

  private setupReactErrorBoundary(): void {
    // This will be called by React Error Boundaries
    (window as any).__GUARDIAN_ERROR_CAPTURE__ = (error: Error, errorInfo: any) => {
      this.handleError({
        error: error,
        message: error.message,
        filename: 'React Component',
        lineno: 0,
        colno: 0,
        componentStack: errorInfo.componentStack,
        errorType: 'react',
      });
    };
  }

  private setupConsoleErrorCapture(): void {
    // Store original console methods
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    // Override console.error to capture errors
    console.error = (...args: any[]) => {
      // Call original console.error first
      originalConsoleError.apply(console, args);
      
      // Prevent recursive error capture
      if (this.isProcessingError) {
        return;
      }
      
      // Only capture if it's not from our error capture system
      const message = args.join(' ');
      const excludePatterns = [
        'Error in error capture system',
        'Failed to send error email',
        'Error sending error email',
        '[API]',
        '🚨 Error Captured', // Our own debug logs
        'ErrorCapture',
        'GUARDIAN_ERROR'
      ];
      
      const shouldExclude = excludePatterns.some(pattern => 
        message.includes(pattern)
      );
      
      if (!shouldExclude && !this.isDuplicateError(message)) {
        try {
          this.handleError({
            error: new Error(message),
            message: `Console Error: ${message}`,
            filename: 'Console',
            lineno: 0,
            colno: 0,
            errorType: 'console',
          });
        } catch (e) {
          // Prevent infinite loops - silently fail
        }
      }
    };

    // Store the original methods for potential restoration
    (window as any).__ORIGINAL_CONSOLE_ERROR__ = originalConsoleError;
    (window as any).__ORIGINAL_CONSOLE_WARN__ = originalConsoleWarn;
  }

  // Helper method to detect duplicate errors
  private isDuplicateError(message: string): boolean {
    const errorHash = this.hashString(message);
    
    if (this.errorQueue.has(errorHash)) {
      return true;
    }
    
    this.errorQueue.add(errorHash);
    
    // Clean up old errors after 5 minutes
    setTimeout(() => {
      this.errorQueue.delete(errorHash);
    }, 5 * 60 * 1000);
    
    return false;
  }

  // Simple hash function for error deduplication
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  // Rate limiting check
  private shouldProcessError(): boolean {
    const now = Date.now();
    
    // Reset counter every minute
    if (now - this.lastErrorTime > 60000) {
      this.errorCount = 0;
      this.lastErrorTime = now;
    }
    
    // Check rate limit
    if (this.errorCount >= this.MAX_ERRORS_PER_MINUTE) {
      return false;
    }
    
    this.errorCount++;
    return true;
  }

  private handleError(errorEvent: {
    error?: Error;
    message: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    componentStack?: string;
    errorType?: 'javascript' | 'react' | 'api' | 'console' | 'promise';
    apiEndpoint?: string;
    apiMethod?: string;
    apiStatusCode?: number;
    apiRequestData?: any;
    apiResponseData?: any;
  }): void {
    // Prevent recursive error handling
    if (this.isProcessingError) {
      return;
    }
    
    // Rate limiting
    if (!this.shouldProcessError()) {
      return;
    }
    
    // Mark as processing to prevent recursion
    this.isProcessingError = true;
    
    try {
      const errorDetails = this.extractErrorDetails(errorEvent);
      
      // Send error email (async, don't await to avoid blocking)
      this.sendErrorEmail(errorDetails).catch(() => {
        // Silently fail email sending to prevent loops
      });
      
      // Also log to console for development (use original console to avoid recursion)
      if (process.env.NODE_ENV === 'development') {
        const originalConsoleError = (window as any).__ORIGINAL_CONSOLE_ERROR__ || console.error;
        const originalConsoleLog = console.log;
        
        originalConsoleLog('🚨 GUARDIAN_ERROR: Error Captured');
        originalConsoleError('GUARDIAN_ERROR - Main Error:', errorDetails.mainError);
        originalConsoleLog('GUARDIAN_ERROR - Page:', errorDetails.pageName);
        originalConsoleLog('GUARDIAN_ERROR - Function:', errorDetails.functionName);
        originalConsoleLog('GUARDIAN_ERROR - Line:', errorDetails.lineNumber);
      }
    } catch (captureError) {
      // Use original console.error to avoid recursion
      const originalConsoleError = (window as any).__ORIGINAL_CONSOLE_ERROR__ || console.error;
      originalConsoleError('GUARDIAN_ERROR: Error in error capture system:', captureError);
    } finally {
      // Always reset the processing flag
      setTimeout(() => {
        this.isProcessingError = false;
      }, this.DEBOUNCE_TIME);
    }
  }

  private extractErrorDetails(errorEvent: {
    error?: Error;
    message: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    componentStack?: string;
    errorType?: 'javascript' | 'react' | 'api' | 'console' | 'promise';
    apiEndpoint?: string;
    apiMethod?: string;
    apiStatusCode?: number;
    apiRequestData?: any;
    apiResponseData?: any;
  }): ErrorDetails {
    const currentPage = window.location.pathname;
    const pageName = this.getPageName(currentPage);
    
    // Extract function name from stack trace
    const stackTrace = errorEvent.error?.stack || 'No stack trace available';
    const functionName = this.extractFunctionName(stackTrace);
    
    // Get user info from localStorage if available
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    return {
      mainError: errorEvent.message || 'Unknown error',
      pageName: pageName,
      functionName: functionName,
      lineNumber: errorEvent.lineno || 0,
      columnNumber: errorEvent.colno || 0,
      fileName: errorEvent.filename || 'Unknown file',
      stackTrace: stackTrace,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userId: user?.id?.toString(),
      email: user?.email,
      errorType: errorEvent.errorType || 'javascript',
      apiEndpoint: errorEvent.apiEndpoint,
      apiMethod: errorEvent.apiMethod,
      apiStatusCode: errorEvent.apiStatusCode,
      apiRequestData: errorEvent.apiRequestData ? JSON.stringify(errorEvent.apiRequestData, null, 2) : undefined,
      apiResponseData: errorEvent.apiResponseData ? JSON.stringify(errorEvent.apiResponseData, null, 2) : undefined,
      componentStack: errorEvent.componentStack,
    };
  }

  private getPageName(pathname: string): string {
    const pageMap: { [key: string]: string } = {
      '/': 'Home',
      '/login': 'Login',
      '/register': 'Registration',
      '/forgot-password': 'Forgot Password',
      '/reset-password': 'Reset Password',
      '/verify-email': 'Email Verification',
      '/home': 'Dashboard',
      '/requests': 'Requests',
      '/forms': 'Forms',
      '/users': 'User Management',
      '/profile': 'Profile',
    };

    return pageMap[pathname] || pathname.replace('/', '') || 'Unknown Page';
  }

  private extractFunctionName(stackTrace: string): string {
    try {
      const lines = stackTrace.split('\n');
      
      // Look for the first meaningful function name (skip error constructors)
      for (let i = 1; i < Math.min(lines.length, 5); i++) {
        const line = lines[i].trim();
        
        // Match patterns like "at functionName" or "at Object.functionName"
        const match = line.match(/at (?:(?:Object|Array)\.)?(\w+)/);
        if (match && match[1] && !['Error', 'Object', 'Array'].includes(match[1])) {
          return match[1];
        }
        
        // Match React component patterns
        const reactMatch = line.match(/at (\w+) \(/);
        if (reactMatch && reactMatch[1]) {
          return reactMatch[1];
        }
      }
      
      return 'Unknown function';
    } catch {
      return 'Stack trace parse error';
    }
  }

  private async sendErrorEmail(errorDetails: ErrorDetails): Promise<void> {
    try {
      const emailBody = this.formatErrorEmail(errorDetails);
      
      // Use fetch with timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${this.API_BASE}/api/send-error-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: this.SUPPORT_EMAIL,
          subject: `🚨 ${errorDetails.errorType?.toUpperCase() || 'FRONTEND'} Error - ${errorDetails.pageName}${errorDetails.apiEndpoint ? ` (${errorDetails.apiEndpoint})` : ''}`,
          errorDetails: errorDetails,
          htmlBody: emailBody,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Don't log warnings that could trigger more error captures
        if (process.env.NODE_ENV === 'development') {
          const originalConsoleError = (window as any).__ORIGINAL_CONSOLE_ERROR__ || console.error;
          originalConsoleError('GUARDIAN_ERROR: Failed to send error email:', response.statusText);
        }
      }
    } catch (emailError) {
      // Don't log warnings that could trigger more error captures
      if (process.env.NODE_ENV === 'development') {
        const originalConsoleError = (window as any).__ORIGINAL_CONSOLE_ERROR__ || console.error;
        originalConsoleError('GUARDIAN_ERROR: Error sending error email:', emailError);
      }
    }
  }

  private formatErrorEmail(error: ErrorDetails): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Frontend Error Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
    .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: #dc3545; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .section { margin-bottom: 20px; }
    .label { font-weight: bold; color: #333; }
    .value { background: #f8f9fa; padding: 8px; border-radius: 4px; margin-top: 5px; word-break: break-all; }
    .stack-trace { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; font-family: monospace; font-size: 12px; }
    .critical { color: #dc3545; font-weight: bold; }
    .info { color: #6c757d; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 Frontend Error Report</h1>
      <p>A JavaScript error occurred in the Guardian application</p>
    </div>

    <div class="section">
      <h2 class="critical">Error Summary</h2>
      <table>
        <tr>
          <th>Error Type</th>
          <td class="critical">${error.errorType?.toUpperCase() || 'UNKNOWN'}</td>
        </tr>
        <tr>
          <th>Main Error</th>
          <td class="critical">${error.mainError}</td>
        </tr>
        <tr>
          <th>Page</th>
          <td>${error.pageName}</td>
        </tr>
        <tr>
          <th>Function</th>
          <td>${error.functionName}</td>
        </tr>
        <tr>
          <th>Line Number</th>
          <td>${error.lineNumber}:${error.columnNumber}</td>
        </tr>
        <tr>
          <th>File</th>
          <td>${error.fileName}</td>
        </tr>
        <tr>
          <th>Timestamp</th>
          <td>${error.timestamp}</td>
        </tr>
      </table>
    </div>

    ${error.errorType === 'api' ? `
    <div class="section">
      <h2>API Error Details</h2>
      <table>
        <tr>
          <th>Endpoint</th>
          <td>${error.apiEndpoint || 'Unknown'}</td>
        </tr>
        <tr>
          <th>Method</th>
          <td>${error.apiMethod || 'Unknown'}</td>
        </tr>
        <tr>
          <th>Status Code</th>
          <td class="${error.apiStatusCode && error.apiStatusCode >= 400 ? 'critical' : ''}">${error.apiStatusCode || 'Unknown'}</td>
        </tr>
        ${error.apiRequestData ? `
        <tr>
          <th>Request Data</th>
          <td><pre class="stack-trace">${error.apiRequestData}</pre></td>
        </tr>
        ` : ''}
        ${error.apiResponseData ? `
        <tr>
          <th>Response Data</th>
          <td><pre class="stack-trace">${error.apiResponseData}</pre></td>
        </tr>
        ` : ''}
      </table>
    </div>
    ` : ''}

    ${error.errorType === 'react' && error.componentStack ? `
    <div class="section">
      <h2>React Component Stack</h2>
      <div class="stack-trace">${error.componentStack}</div>
    </div>
    ` : ''}

    <div class="section">
      <h2>User Information</h2>
      <table>
        <tr>
          <th>User ID</th>
          <td>${error.userId || 'Not logged in'}</td>
        </tr>
        <tr>
          <th>Email</th>
          <td>${error.email || 'Not available'}</td>
        </tr>
        <tr>
          <th>URL</th>
          <td>${error.url}</td>
        </tr>
        <tr>
          <th>User Agent</th>
          <td class="info">${error.userAgent}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <h2>Stack Trace</h2>
      <div class="stack-trace">${error.stackTrace}</div>
    </div>

    <div class="section info">
      <p><strong>Next Steps:</strong></p>
      <ol>
        <li>Check the browser console for additional details</li>
        <li>Reproduce the error with the same steps</li>
        <li>Check server logs for related backend errors</li>
        <li>Review recent code changes in the affected area</li>
      </ol>
    </div>
  </div>
</body>
</html>`;
  }

  // Public method to manually capture errors
  public captureError(error: Error, context?: { 
    page?: string; 
    function?: string; 
    userId?: string; 
    additionalInfo?: any; 
  }): void {
    this.handleError({
      error,
      message: error.message,
      filename: context?.page || 'Manual capture',
      lineno: 0,
      colno: 0,
    });
  }

  // Public method to capture login-specific errors
  public captureLoginError(error: Error, loginData?: { email?: string; attempts?: number }): void {
    const enhancedError = new Error(`Login Error: ${error.message} | Email: ${loginData?.email || 'unknown'} | Attempts: ${loginData?.attempts || 1}`);
    enhancedError.stack = error.stack;
    
    this.handleError({
      error: enhancedError,
      message: enhancedError.message,
      filename: 'Login.tsx',
      lineno: 0,
      colno: 0,
      errorType: 'api',
    });
  }

  // Public method to capture API errors
  public captureApiError(error: any, requestConfig: {
    url?: string;
    method?: string;
    data?: any;
  }, response?: any): void {
    const apiError = error.response ? error.response.data : error;
    const statusCode = error.response?.status;
    
    this.handleError({
      error: error,
      message: `API Error: ${error.message || 'Unknown API error'}`,
      filename: 'API Request',
      lineno: 0,
      colno: 0,
      errorType: 'api',
      apiEndpoint: requestConfig.url,
      apiMethod: requestConfig.method?.toUpperCase(),
      apiStatusCode: statusCode,
      apiRequestData: requestConfig.data,
      apiResponseData: apiError,
    });
  }
}

// Initialize error capture when module loads
const errorCapture = ErrorCapture.getInstance();

// Export types for use in other modules
export type { ErrorDetails };

export default errorCapture;