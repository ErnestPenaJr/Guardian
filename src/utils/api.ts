import axios from 'axios';
import errorCapture from './errorCapture';
import dbWakeUp from './dbWakeUp';

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

    // JAFAR impersonation — backend honors this only when the authenticated
    // user has role 6. While impersonating, downstream requests act as the
    // target user (their permissions, their company, their data scope).
    // Skip for the JAFAR-admin endpoints themselves so the switcher dropdown
    // is never tainted by an active impersonation.
    const jafarImpersonateUserId = localStorage.getItem('jafarImpersonateUserId');
    if (
      jafarImpersonateUserId &&
      config.headers &&
      !config.url?.includes('/api/jafar-admin/')
    ) {
      config.headers['X-Jafar-Impersonate-User-Id'] = jafarImpersonateUserId;
    }

    return config;
  },
  (error) => {
    console.error('❌ [API INTERCEPTOR] Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Global axios interceptor — many components call raw `axios.get/post/...`
// (e.g. Home.tsx fetchRequests, services/mynotices.ts, AdminFields, etc.)
// instead of the configured `api` client. Without this, JAFAR impersonation
// would silently bypass those calls and return the impersonator's data.
// Auth headers are still set per-call by those callers; we only add the
// impersonation header here.
axios.interceptors.request.use((config) => {
  const impersonateUserId = localStorage.getItem('jafarImpersonateUserId');
  if (
    impersonateUserId &&
    config.headers &&
    !config.url?.includes('/api/jafar-admin/')
  ) {
    config.headers['X-Jafar-Impersonate-User-Id'] = impersonateUserId;
  }
  return config;
});

// Native fetch() patch — components like SimpleFormBuilder, CustomWorkflow
// TemplateModal, etc. call window.fetch directly (not axios). Wrap it so
// the impersonation header travels with those calls too. Idempotent.
if (typeof window !== 'undefined' && !(window.fetch as any).__jafarImpersonationPatched) {
  const originalFetch = window.fetch.bind(window);
  const patched = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    const impersonateUserId = localStorage.getItem('jafarImpersonateUserId');
    if (impersonateUserId && url && !url.includes('/api/jafar-admin/')) {
      const newInit: RequestInit = init ? { ...init } : {};
      const headers = new Headers(
        newInit.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      headers.set('X-Jafar-Impersonate-User-Id', impersonateUserId);
      newInit.headers = headers;
      return originalFetch(input, newInit);
    }
    return originalFetch(input, init);
  };
  (patched as any).__jafarImpersonationPatched = true;
  window.fetch = patched as typeof window.fetch;
}

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
  async (error) => {
    // Log detailed error information
    console.error('[API] Request failed:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });

    // --- Database wake-up handling -------------------------------------
    // Azure SQL Serverless can auto-pause; the first request after a sleep
    // returns 503 DB_WAKING (from /api/login) or fails the network entirely.
    // We probe /api/health/db, show the friendly overlay while waiting, and
    // transparently retry the original request once the DB is back.
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const isExplicitWaking = status === 503 && code === 'DB_WAKING';
    const isNetworkFailure = !error.response && (
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      /timeout|Network Error/i.test(error.message || '')
    );
    const isFiveHundred = status === 500;
    const cfg: any = error.config || {};
    const alreadyRetried = cfg.__dbWakeRetried === true;
    const isHealthCheck = (cfg.url || '').includes('/api/health/db');

    if (!alreadyRetried && !isHealthCheck && (isExplicitWaking || isNetworkFailure || isFiveHundred)) {
      // For 500 / network failures, confirm it's a DB issue before triggering
      // overlay UI. /api/health/db is cheap and returns 503 only when the DB
      // is actually down — so a 200 here means the original failure was
      // unrelated (we just rethrow normally).
      let shouldWake = isExplicitWaking;
      if (!shouldWake) {
        try {
          const probe = await fetch('/api/health/db', { cache: 'no-store' });
          shouldWake = probe.status === 503;
        } catch {
          shouldWake = true; // can't even reach health endpoint -> server / DB asleep
        }
      }

      if (shouldWake) {
        cfg.__dbWakeRetried = true;
        const ready = await dbWakeUp.trigger();
        if (ready) {
          // Replay the original request with the same config (token/header
          // interceptor will re-run automatically).
          return api.request(cfg);
        }
        // Fall through to existing error handling if wake-up timed out.
      }
    }
    // -------------------------------------------------------------------

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
      // Don't force redirect for the login endpoint itself so the page can show SweetAlert
      const url = error.config?.url || '';
      const isLoginCall = url.includes('/api/login');
      const isAlreadyOnLogin = window.location.pathname === '/login';

      // Only wipe auth state for actual token problems. Other 401s (permissions,
      // transient backend issues misclassified upstream) must not force a logout.
      const tokenErrorTypes = ['TOKEN_EXPIRED', 'TOKEN_INVALID', 'TOKEN_MALFORMED', 'TOKEN_NOT_ACTIVE'];
      const responseErrorType = error.response?.data?.errorType;
      const isTokenProblem = tokenErrorTypes.includes(responseErrorType);

      if (!isLoginCall && isTokenProblem) {
        console.warn('[API] Token problem (' + responseErrorType + ') - clearing stored auth data');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('companyId');
        if (!isAlreadyOnLogin) {
          window.location.href = '/login';
        }
      } else if (!isLoginCall) {
        console.warn('[API] 401 without token errorType — not clearing auth:', responseErrorType || 'unspecified');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
