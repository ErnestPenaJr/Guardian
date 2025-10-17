import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Swal from 'sweetalert2';
import { FaSpinner, FaEye, FaEyeSlash } from 'react-icons/fa';
import errorCapture from '../utils/errorCapture';
import LegalModal from '../components/LegalModal';

function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });

  // Client-side rate limiting awareness
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);

  // Legal modal state
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy'>('terms');
  
  // Validation states
  const [validation, setValidation] = useState<{
    email: {
      valid: boolean;
      message: string;
      touched: boolean;
    };
    password: {
      valid: boolean;
      message: string;
      touched: boolean;
    };
  }>({
    email: {
      valid: false,
      message: '',
      touched: false
    },
    password: {
      valid: false,
      message: '',
      touched: false
    }
  });

  // Enhanced email validation with security hardening
  const validateEmail = (email: string): { valid: boolean; message: string } => {
    // Normalize input by trimming spaces
    const normalizedEmail = email ? email.trim() : '';
    
    // Security: Prevent extremely long emails (125 character limit)
    if (!normalizedEmail || normalizedEmail.length > 125) {
      return { valid: false, message: 'Email address must be 125 characters or less.' };
    }
    
    // Security: Prevent email injection attacks
    if (normalizedEmail.includes('\n') || normalizedEmail.includes('\r') || normalizedEmail.includes('\t')) {
      return { valid: false, message: 'Invalid characters in email address.' };
    }
    
    // Enhanced RFC 5322 compliant pattern (more restrictive and secure)
    const strictEmailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!strictEmailRegex.test(normalizedEmail)) {
      return { valid: false, message: 'Please provide a valid email address.' };
    }
    
    // Security: Prevent common attack vectors
    const suspiciousPatterns = [
      /\.{2,}/, // Multiple consecutive dots
      /^\.|\.$/,  // Starting or ending with dot
      /^@|@$/     // Starting or ending with @
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(normalizedEmail)) {
        return { valid: false, message: 'Please provide a valid email address.' };
      }
    }
    
    return { valid: true, message: 'Looks good!' };
  };

  // Validate password (at least 6 characters)
  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  // Client-side rate limiting check
  const checkRateLimit = () => {
    if (lockoutUntil && new Date() < lockoutUntil) {
      const remainingTime = Math.ceil((lockoutUntil.getTime() - Date.now()) / 1000);
      throw new Error(`Too many attempts. Try again in ${remainingTime} seconds.`);
    }
    
    if (failedAttempts >= 5) {
      const lockoutTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      setLockoutUntil(lockoutTime);
      throw new Error('Too many failed attempts. Account temporarily locked for 15 minutes.');
    }
  };

  // Validate field helper function
  const validateField = (fieldName: string, value: string) => {
    if (fieldName === 'email') {
      const emailValidation = validateEmail(value);
      setValidation(prev => ({
        ...prev,
        email: {
          ...prev.email,
          valid: emailValidation.valid,
          message: emailValidation.message
        }
      }));
    } else if (fieldName === 'password') {
      setValidation(prev => ({
        ...prev,
        password: {
          ...prev.password,
          valid: validatePassword(value),
          message: validatePassword(value) ? '' : 'Please provide your password.'
        }
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Client-side rate limiting check
      try {
        checkRateLimit();
      } catch (rateLimitError: any) {
        await Swal.fire({
          title: 'Rate Limited',
          text: rateLimitError.message,
          icon: 'warning',
          confirmButtonText: 'OK',
          customClass: {
            popup: 'swal2-popup',
            title: 'swal2-title',
            htmlContainer: 'swal2-html-container',
            confirmButton: 'swal2-confirm'
          },
          buttonsStyling: false,
          confirmButtonColor: '#032424',
          allowOutsideClick: false
        });
        return;
      }
      
      // Mark all fields as touched to trigger validation
      setValidation(prev => ({
        email: { ...prev.email, touched: true },
        password: { ...prev.password, touched: true }
      }));
      
      // Check if form is valid
      if (!validateEmail(credentials.email).valid || !validatePassword(credentials.password)) {
        await Swal.fire({
          title: 'Validation Error',
          text: 'Please correct the errors in the form.',
          icon: 'error',
          confirmButtonText: 'OK',
          customClass: {
            popup: 'swal2-popup',
            title: 'swal2-title',
            htmlContainer: 'swal2-html-container',
            confirmButton: 'swal2-confirm'
          },
          buttonsStyling: false,
          confirmButtonColor: '#032424',
          allowOutsideClick: false
        });
        return;
      }
      
      setIsLoading(true);
      
      // Call the login API endpoint using our API utility
      const response = await api.post('/api/login', {
        email: credentials.email,
        password: credentials.password
      });
      
      // Store the JWT token in localStorage
      localStorage.setItem('token', response.data.token);
      
      // Store user info in localStorage
      localStorage.setItem('user', JSON.stringify(response.data.user));

      // Store companyId and companyName from the user object
      const { companyId, companyName } = response.data.user || {};
      if (companyId) localStorage.setItem('companyId', companyId.toString());
      if (companyName) localStorage.setItem('companyName', companyName);

      // Reset rate limiting on successful login
      setFailedAttempts(0);
      setLockoutUntil(null);

      // Show success message
      Swal.fire({
        title: 'Success',
        text: 'Login successful',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-popup',
          title: 'swal2-title',
          htmlContainer: 'swal2-html-container'
        },
        buttonsStyling: false,
        confirmButtonColor: '#032424'
      });
      
      // Redirect to home page after successful login
      navigate('/home');
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      console.error('Error response data:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      // Capture error for email notification (now with infinite loop protection)
      try {
        errorCapture.captureLoginError(error, { 
          email: credentials.email,
          attempts: failedAttempts + 1
        });
      } catch (captureErr) {
        // Silently fail error capture to prevent loops
      }
      
      // Prevent any potential page reload by stopping here if needed
      const shouldShowAlert = true;
      
      // Handle different error scenarios with specific messages
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const statusCode = error.response.status;
        const errorMessage = error.response.data?.message || error.response.data?.error || 'Authentication failed';
        
        // SECURITY FIX: Use generic error messages to prevent user enumeration attacks
        // All authentication failures now show the same message regardless of the reason
        if (statusCode === 429) {
          // Rate limiting gets a specific message for user experience
          if (shouldShowAlert) {
            await Swal.fire({
              title: 'Too Many Attempts',
              text: 'Too many login attempts. Please try again later.',
              icon: 'warning',
              confirmButtonText: 'OK',
              customClass: {
                popup: 'swal2-popup',
                title: 'swal2-title',
                htmlContainer: 'swal2-html-container',
                confirmButton: 'swal2-confirm'
              },
              buttonsStyling: false,
              confirmButtonColor: '#032424',
              returnFocus: false
            });
          }
        } else {
          // Increment failed attempts for authentication failures
          setFailedAttempts(prev => prev + 1);
          
          // Generic error message for all other authentication failures (401, 403, 404, etc.)
          if (shouldShowAlert) {
            await Swal.fire({
              title: 'Authentication Failed',
              text: 'Invalid credentials. Please check your email and password and try again.',
              icon: 'error',
              confirmButtonText: 'OK',
              customClass: {
                popup: 'swal2-popup',
                title: 'swal2-title',
                htmlContainer: 'swal2-html-container',
                confirmButton: 'swal2-confirm'
              },
              buttonsStyling: false,
              confirmButtonColor: '#032424',
              allowOutsideClick: false,
              allowEscapeKey: false,
              returnFocus: false
            });
          }
          // Reset password field but keep email for better UX
          setCredentials(prev => ({ ...prev, password: '' }));
          // Focus back to password field after a short delay
           setTimeout(() => {
            const passwordInput = document.getElementById('password');
            if (passwordInput) passwordInput.focus();
          }, 300);
        }
      } else if (error.request) {
        // The request was made but no response was received
        // Increment failed attempts for network errors (potential attack)
        setFailedAttempts(prev => prev + 1);
        
        if (shouldShowAlert) {
          await Swal.fire({
            title: 'Network Error',
            text: 'Cannot connect to server. Please check your internet connection.',
            icon: 'error',
            confirmButtonText: 'OK',
            customClass: {
              popup: 'swal2-popup',
              title: 'swal2-title',
              htmlContainer: 'swal2-html-container',
              confirmButton: 'swal2-confirm'
            },
            buttonsStyling: false,
            confirmButtonColor: '#032424',
            returnFocus: false
          });
        }
      } else {
        // Something happened in setting up the request that triggered an Error
        // Increment failed attempts for unexpected errors
        setFailedAttempts(prev => prev + 1);
        
        if (shouldShowAlert) {
          await Swal.fire({
            title: 'Unexpected Error',
            text: 'An unexpected error occurred. Error details have been sent to support.',
            icon: 'error',
            confirmButtonText: 'OK',
            customClass: {
              popup: 'swal2-popup',
              title: 'swal2-title',
              htmlContainer: 'swal2-html-container',
              confirmButton: 'swal2-confirm'
            },
            buttonsStyling: false,
            confirmButtonColor: '#032424',
            returnFocus: false
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Mark field as touched and validate
    setValidation(prev => ({
      ...prev,
      [name]: {
        ...(prev as any)[name],
        touched: true
      }
    }));
    
    // Validate the field after marking as touched
    setTimeout(() => validateField(name, value), 0);
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{
        backgroundImage: 'url("/images/background.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="w-8 h-8" />
            <span className="text-h4 font-display font-bold text-black">Guardian</span>
          </div>
          <h1 className="text-h5 font-display font-bold mb-1">Welcome Back</h1>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                placeholder="Email"
                value={credentials.email}
                onChange={handleChange}
                name="email"
                maxLength={125}
                className={`w-full px-4 py-3 border ${
                  validation.email.touched
                    ? validation.email.valid
                      ? 'border-green-500 focus:ring-green-500'
                      : 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-secondary'
                } focus:outline-none focus:ring-2 focus:border-transparent transition-all pr-10`}
                style={{ borderRadius: '6px' }}
                disabled={isLoading}
              />
              {validation.email.touched && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  {validation.email.valid ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <span className="text-red-500">✗</span>
                  )}
                </div>
              )}
            </div>
            {validation.email.touched && !validation.email.valid && (
              <p className="mt-1 text-sm text-red-600">
                {validation.email.message}
              </p>
            )}
            {validation.email.touched && validation.email.valid && (
              <p className="mt-1 text-sm text-green-600">
                Looks good!
              </p>
            )}
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={credentials.password}
                onChange={handleChange}
                name="password"
                className={`w-full px-4 py-3 border ${
                  validation.password.touched
                    ? validation.password.valid
                      ? 'border-green-500 focus:ring-green-500'
                      : 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-secondary'
                } focus:outline-none focus:ring-2 focus:border-transparent transition-all pr-10`}
                style={{ borderRadius: '6px' }}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
              {validation.password.touched && (
                <div className="absolute inset-y-0 right-8 flex items-center pr-3 pointer-events-none">
                  {validation.password.valid ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <span className="text-red-500">✗</span>
                  )}
                </div>
              )}
            </div>
            {validation.password.touched && !validation.password.valid && (
              <p className="mt-1 text-sm text-red-600">
                {validation.password.message}
              </p>
            )}
            {validation.password.touched && validation.password.valid && (
              <p className="mt-1 text-sm text-green-600">
                Looks good!
              </p>
            )}
          </div>
          
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-sm text-secondary hover:underline">
              Forgot password?
            </Link>
          </div>
          
          <div>
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-colors duration-300 ease-in-out cursor-pointer bg-secondary hover:!bg-info hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:!bg-secondary disabled:hover:shadow-none"
              data-component-name="Login"
              disabled={isLoading}
              style={{
                background: isLoading ? undefined : '#2EBCBC'
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = '#2F8CED';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = '#2EBCBC';
                }
              }}
            >
              {isLoading ? (
                <>
                  <FaSpinner className="animate-spin" aria-label="Loading" />
                  Verifying credentials...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </div>
          
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="text-gray-3 text-body-sm">Don't have an account?</span>
            <Link
              to="/register"
              className="text-secondary text-body-sm font-semibold hover:text-secondary/80 transition-colors"
            >
              Create New Account
            </Link>
          </div>

          <p className="text-center text-body-sm mt-6">
            By signing in you agree to the{' '}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setLegalModalType('terms');
                setLegalModalOpen(true);
              }}
              className="text-secondary hover:underline cursor-pointer bg-transparent border-none p-0"
            >
              Terms of Service
            </button>
            {' '}and{' '}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setLegalModalType('privacy');
                setLegalModalOpen(true);
              }}
              className="text-secondary hover:underline cursor-pointer bg-transparent border-none p-0"
            >
              Privacy Policy
            </button>
          </p>
        </form>
      </div>
      
      <div className="mt-8 text-center">
        <p className="text-white text-body-sm font-semibold drop-shadow-md">
          Powered by <br></br>
          <img src="/images/shieldlytics.png" alt="Shieldlytics" width={300} />
        </p>
      </div>

      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        type={legalModalType}
      />
    </div>
  );
}

export default Login;
