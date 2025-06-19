import axios from 'axios';

// Base URL for API requests
const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api' // In production, the API is served from the same domain
  : 'http://localhost:3001/api'; // In development, the API is served from a separate port

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
      // Log token information (without showing the full token for security)
      console.log('API Request:', { 
        url: config.url,
        method: config.method,
        hasToken: !!token,
        tokenStart: token ? token.substring(0, 10) + '...' : null
      });
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('No token found for API request:', config.url);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
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
