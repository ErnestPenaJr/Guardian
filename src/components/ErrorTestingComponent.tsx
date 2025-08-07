import React, { useState } from 'react';
import errorCapture from '../utils/errorCapture';
import api from '../utils/api';

/**
 * ErrorTestingComponent - A testing component to verify error capture functionality
 * This component provides buttons to trigger different types of errors for testing
 * IMPORTANT: This should only be used in development and removed from production builds
 */
const ErrorTestingComponent: React.FC = () => {
  const [showTesting, setShowTesting] = useState(false);

  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const triggerJavaScriptError = () => {
    // Trigger a JavaScript error
    throw new Error('Test JavaScript Error - This is a test error triggered manually');
  };

  const triggerReactError = () => {
    // Trigger a React render error by setting invalid state
    const BadComponent = () => {
      throw new Error('Test React Component Error - This is a test React error');
    };
    
    // This will cause a React error
    return <BadComponent />;
  };

  const triggerApiError = async () => {
    try {
      // Trigger an API error by calling a non-existent endpoint
      await api.get('/api/test-error-endpoint-that-does-not-exist');
    } catch (error) {
      console.log('API error caught and should be automatically captured:', error);
    }
  };

  const triggerConsoleError = () => {
    console.error('Test Console Error - This is a test console.error() call');
  };

  const triggerPromiseRejection = () => {
    // Trigger an unhandled promise rejection
    Promise.reject(new Error('Test Unhandled Promise Rejection - This is a test promise rejection'));
  };

  const triggerManualCapture = () => {
    // Manually capture an error using the error capture system
    errorCapture.captureError(
      new Error('Test Manual Error Capture - This is a test error captured manually'), 
      {
        page: 'Error Testing Component',
        function: 'triggerManualCapture',
        additionalInfo: {
          testType: 'manual',
          timestamp: new Date().toISOString(),
        },
      }
    );
  };

  if (!showTesting) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowTesting(true)}
          className="bg-red-500 text-white px-3 py-2 rounded-md text-sm hover:bg-red-600"
        >
          🧪 Error Testing
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-red-600">Error Testing (DEV)</h3>
        <button
          onClick={() => setShowTesting(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2 text-xs">
        <button
          onClick={triggerJavaScriptError}
          className="w-full bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
        >
          JS Error
        </button>
        
        <button
          onClick={triggerReactError}
          className="w-full bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600"
        >
          React Error
        </button>
        
        <button
          onClick={triggerApiError}
          className="w-full bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
        >
          API Error
        </button>
        
        <button
          onClick={triggerConsoleError}
          className="w-full bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
        >
          Console Error
        </button>
        
        <button
          onClick={triggerPromiseRejection}
          className="w-full bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600"
        >
          Promise Reject
        </button>
        
        <button
          onClick={triggerManualCapture}
          className="w-full bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
        >
          Manual Capture
        </button>
      </div>
      
      <p className="text-xs text-gray-500 mt-2">
        Each button triggers a different error type. Check email for error reports.
      </p>
    </div>
  );
};

export default ErrorTestingComponent;