import React, { useState } from 'react';
import { useErrorHandler, useApiWithErrorHandling, useFormErrorHandler } from '../hooks/useErrorHandler';
import { ErrorCodes } from '../types/errorTypes';
import errorCapture from '../utils/errorCapture';
import api from '../utils/api';

/**
 * Enhanced ErrorTestingComponent - Comprehensive error handling system testing
 * Tests both legacy error capture and new SweetAlert2-based error handling
 * IMPORTANT: This should only be used in development and removed from production builds
 */
const ErrorTestingComponent: React.FC = () => {
  const [showTesting, setShowTesting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });

  // Initialize new error handling hooks
  const { 
    handleError, 
    handleAsyncError, 
    showSuccess, 
    showWarning, 
    showInfo, 
    confirmAction,
    isOnline 
  } = useErrorHandler({
    component: 'ErrorTestingComponent',
    enableAutoReporting: true
  });

  const { apiCall } = useApiWithErrorHandling('/api/test', {
    component: 'ErrorTestingComponent'
  });

  const { 
    handleFormSubmit, 
    handleValidationError 
  } = useFormErrorHandler('errorTestForm');

  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // Enhanced error simulation methods using new error handling system
  const simulateError = async (errorType: string) => {
    setLoading(true);
    
    try {
      switch (errorType) {
        case 'network':
          throw new Error('Network request failed');
          
        case 'timeout':
          throw { code: 'ECONNABORTED', message: 'Request timeout' };
          
        case 'server':
          throw { response: { status: 500, data: { error: 'Internal server error' } } };
          
        case 'unauthorized':
          throw { response: { status: 401, data: { error: 'Unauthorized' } } };
          
        case 'forbidden':
          throw { response: { status: 403, data: { error: 'Forbidden' } } };
          
        case 'notfound':
          throw { response: { status: 404, data: { error: 'Not found' } } };
          
        case 'validation':
          throw { 
            fieldErrors: [
              { field: 'email', message: 'Please enter a valid email address' },
              { field: 'password', message: 'Password must be at least 8 characters' }
            ]
          };
          
        case 'database':
          throw { 
            constraint: 'UNIQUE_EMAIL',
            table: 'USERS',
            field: 'email',
            message: 'UNIQUE constraint failed: USERS.email'
          };
          
        case 'file':
          throw {
            code: ErrorCodes.FILE_TOO_LARGE,
            filename: 'large-document.pdf',
            fileSize: 15728640, // 15MB
            maxSize: 10485760, // 10MB
            message: 'File too large'
          };
          
        case 'offline':
          // Simulate offline error
          Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: false
          });
          throw { code: ErrorCodes.OFFLINE, message: 'No internet connection' };
          
        default:
          throw new Error('Unknown error occurred');
      }
    } catch (error) {
      await handleError(error, {
        action: `simulate_${errorType}_error`,
        endpoint: `/api/test/${errorType}`
      });
    } finally {
      setLoading(false);
      // Reset online status
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });
    }
  };

  // Legacy error testing methods (for comparison)
  const triggerJavaScriptError = () => {
    throw new Error('Test JavaScript Error - This is a test error triggered manually');
  };

  const triggerApiError = async () => {
    try {
      await api.get('/api/test-error-endpoint-that-does-not-exist');
    } catch (error) {
      console.log('API error caught and should be automatically captured:', error);
    }
  };

  const triggerConsoleError = () => {
    console.error('Test Console Error - This is a test console.error() call');
  };

  // Test form validation with new system
  const testFormValidation = async () => {
    const fieldErrors = [];
    
    if (!formData.email) {
      fieldErrors.push({ field: 'email', message: 'Email is required' });
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      fieldErrors.push({ field: 'email', message: 'Please enter a valid email address' });
    }
    
    if (!formData.password) {
      fieldErrors.push({ field: 'password', message: 'Password is required' });
    } else if (formData.password.length < 8) {
      fieldErrors.push({ field: 'password', message: 'Password must be at least 8 characters long' });
    }
    
    if (fieldErrors.length > 0) {
      await handleValidationError(fieldErrors, 'testForm');
    } else {
      await showSuccess('Form validation passed!', 'All fields are valid.');
    }
  };

  // Test success messages
  const testSuccessMessage = () => showSuccess('Operation completed!', 'This is a success message test.');
  const testWarningMessage = () => showWarning('Warning message', 'This is a warning message test.');
  const testInfoMessage = () => showInfo('Information', 'This is an info message test.');

  // Test confirmation dialog
  const testConfirmation = async () => {
    const confirmed = await confirmAction(
      'Delete Test Item',
      'Are you sure you want to delete this test item? This action cannot be undone.',
      true // isDangerous
    );

    if (confirmed) {
      await showInfo('Item would be deleted', 'This is just a test - no actual deletion occurred.');
    } else {
      await showInfo('Deletion cancelled', 'Test item was not deleted.');
    }
  };

  // Test API call with error handling
  const testApiCall = async () => {
    const result = await apiCall(async () => {
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    }, '/api/health', 'GET');

    if (result) {
      await showSuccess('API call successful!', JSON.stringify(result, null, 2));
    }
  };

  if (!showTesting) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowTesting(true)}
          className="bg-red-500 text-white px-3 py-2 rounded-md text-sm hover:bg-red-600 shadow-lg"
        >
          🚨 Error Testing Suite
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-4 max-w-md max-h-[80vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-red-600">🚨 Error Testing Suite</h3>
        <button
          onClick={() => setShowTesting(false)}
          className="text-gray-400 hover:text-gray-600 text-xl"
        >
          ✕
        </button>
      </div>

      {/* Network Status */}
      <div className={`mb-4 p-2 rounded text-xs ${isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        <strong>Network:</strong> {isOnline ? '🟢 Online' : '🔴 Offline'}
      </div>
      
      {/* New SweetAlert2 Error Tests */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-2 text-blue-600">🆕 SweetAlert2 Error Tests</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={() => simulateError('network')}
            disabled={loading}
            className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Network
          </button>
          <button
            onClick={() => simulateError('timeout')}
            disabled={loading}
            className="bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Timeout
          </button>
          <button
            onClick={() => simulateError('server')}
            disabled={loading}
            className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 disabled:opacity-50"
          >
            Server 500
          </button>
          <button
            onClick={() => simulateError('unauthorized')}
            disabled={loading}
            className="bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600 disabled:opacity-50"
          >
            Auth 401
          </button>
          <button
            onClick={() => simulateError('forbidden')}
            disabled={loading}
            className="bg-pink-500 text-white px-2 py-1 rounded hover:bg-pink-600 disabled:opacity-50"
          >
            Forbidden
          </button>
          <button
            onClick={() => simulateError('notfound')}
            disabled={loading}
            className="bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600 disabled:opacity-50"
          >
            Not Found
          </button>
          <button
            onClick={() => simulateError('database')}
            disabled={loading}
            className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 disabled:opacity-50"
          >
            Database
          </button>
          <button
            onClick={() => simulateError('validation')}
            disabled={loading}
            className="bg-yellow-500 text-black px-2 py-1 rounded hover:bg-yellow-600 disabled:opacity-50"
          >
            Validation
          </button>
          <button
            onClick={() => simulateError('file')}
            disabled={loading}
            className="bg-teal-500 text-white px-2 py-1 rounded hover:bg-teal-600 disabled:opacity-50"
          >
            File Error
          </button>
          <button
            onClick={() => simulateError('offline')}
            disabled={loading}
            className="bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 disabled:opacity-50"
          >
            Offline
          </button>
        </div>
      </div>

      {/* Form Test */}
      <div className="mb-4 p-2 bg-gray-50 rounded">
        <h4 className="text-sm font-semibold mb-2 text-green-600">📝 Form Test</h4>
        <input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full mb-2 px-2 py-1 border rounded text-xs"
        />
        <input
          type="password"
          placeholder="Password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className="w-full mb-2 px-2 py-1 border rounded text-xs"
        />
        <button
          onClick={testFormValidation}
          className="w-full bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 text-xs"
        >
          Test Validation
        </button>
      </div>

      {/* Success Messages */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-2 text-purple-600">✅ Message Tests</h4>
        <div className="grid grid-cols-3 gap-1 text-xs">
          <button
            onClick={testSuccessMessage}
            className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
          >
            Success
          </button>
          <button
            onClick={testWarningMessage}
            className="bg-yellow-500 text-black px-2 py-1 rounded hover:bg-yellow-600"
          >
            Warning
          </button>
          <button
            onClick={testInfoMessage}
            className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
          >
            Info
          </button>
        </div>
      </div>

      {/* API & Confirmation Tests */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-2 text-indigo-600">🔗 Advanced Tests</h4>
        <div className="space-y-2 text-xs">
          <button
            onClick={testApiCall}
            className="w-full bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-600"
          >
            Test API Call
          </button>
          <button
            onClick={testConfirmation}
            className="w-full bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
          >
            Test Confirmation
          </button>
        </div>
      </div>

      {/* Legacy Tests */}
      <div className="mb-4 border-t pt-2">
        <h4 className="text-sm font-semibold mb-2 text-gray-600">📧 Legacy Tests</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={triggerJavaScriptError}
            className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
          >
            JS Error
          </button>
          <button
            onClick={triggerApiError}
            className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
          >
            API Error
          </button>
          <button
            onClick={triggerConsoleError}
            className="bg-yellow-500 text-black px-2 py-1 rounded hover:bg-yellow-600"
          >
            Console
          </button>
          <button
            onClick={() => errorCapture.captureError(new Error('Manual test error'), { page: 'Test Component' })}
            className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
          >
            Manual
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500 border-t pt-2">
        <p><strong>🆕 New:</strong> SweetAlert2 modals with recovery actions</p>
        <p><strong>📧 Legacy:</strong> Email capture only</p>
        <p><strong>Network:</strong> {isOnline ? 'Online' : 'Offline'} | 
           <strong> Loading:</strong> {loading ? 'Yes' : 'No'}</p>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl mb-2">⏳</div>
            <div className="text-xs">Processing...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ErrorTestingComponent;