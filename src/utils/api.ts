import axios from 'axios';

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
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
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
    
    if (error.response && error.response.status === 401) {
      // Token expired or invalid, redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
