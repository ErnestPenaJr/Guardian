import axios from 'axios';
import errorCapture from './errorCapture';

// Base URL for API requests
// In development, we use the Vite proxy which is configured in vite.config.ts
// In production, the API is served from the same domain
const isDevelopment = import.meta.env.DEV;
const API_URL = isDevelopment ? '/' : window.location.origin;

console.log('Environment:', isDevelopment ? 'development' : 'production');
console.log('API_URL configured as:', API_URL);
console.log('Current window location:', window.location.href);

// Create an axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include JWT token in requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    
    // List of endpoints that don't require authentication
    const publicEndpoints = [
      '/api/login',
      '/api/register',
      '/api/verify-email',
      '/api/complete-registration',
      '/api/request-password-reset',
      '/api/verify-reset-code',
      '/api/reset-password',
      '/api/send-verification-email',
      '/api/health',
      '/api/test'
    ];
    
    const isPublicEndpoint = publicEndpoints.some(endpoint => config.url?.includes(endpoint));
    
    // Debug logging for auth header issues (only for non-public endpoints)
    if (!isPublicEndpoint) {
      console.log('🔍 [API INTERCEPTOR] Processing request:', {
        url: config.url,
        method: config.method,
        tokenExists: !!token,
        tokenLength: token ? token.length : 0,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'null',
        hasHeaders: !!config.headers,
        baseURL: config.baseURL
      });
    }
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
      if (!isPublicEndpoint) {
        console.log('✅ [API INTERCEPTOR] Added Authorization header for:', config.url);
      }
    } else if (!isPublicEndpoint) {
      console.warn('❌ [API INTERCEPTOR] No auth header added:', {
        url: config.url,
        reason: !token ? 'No token in localStorage' : 'No headers object'
      });
    }
    
    return config;
  },
  (error) => {
    console.error('❌ [API INTERCEPTOR] Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle token expiration and HTML responses
api.interceptors.response.use(
  (response) => {
    // Check if we received HTML instead of JSON (production routing issue)
    if (typeof response.data === 'string' && response.data.includes('<!doctype html>')) {
      console.error('[API] Received HTML instead of JSON for request:', response.config.url);
      console.error('[API] Response data:', response.data.substring(0, 200) + '...');
      
      const error = new Error('API endpoint returned HTML instead of JSON. This indicates a routing or deployment issue.');
      (error as any).isHTMLResponse = true;
      (error as any).originalUrl = response.config.url;
      
      // Capture HTML response error
      errorCapture.captureApiError(error, {
        url: response.config.url,
        method: response.config.method,
        data: response.config.data,
      }, response.data);
      
      return Promise.reject(error);
    }
    
    return response;
  },
  (error) => {
    // Log detailed error information
    console.error('[API] Request failed:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    // Capture API error with detailed information
    try {
      errorCapture.captureApiError(error, {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data,
      }, error.response?.data);
    } catch (captureError) {
      console.warn('Failed to capture API error:', captureError);
    }
    
    if (error.response && error.response.status === 401) {
      // Token expired, invalid, or contains invalid user data - clear all auth data
      console.warn('[API] Authentication failed - clearing all stored auth data');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('companyId');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
