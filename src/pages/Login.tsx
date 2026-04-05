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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Brand Panel — hidden on mobile */}
      <div className="hidden lg:flex w-[42%] bg-gradient-to-br from-[#032424] to-[#064a4a] text-white p-10 flex-col justify-center relative overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="w-10 h-10" />
            <span className="font-display font-extrabold text-[24px] text-secondary">Guardian</span>
          </div>
          <p className="text-[15px] text-white/70 leading-relaxed mb-8 max-w-[320px]">
            Secure request management for modern teams.
          </p>
          <div className="space-y-4">
            {['Company-isolated data security', 'Role-based access control', 'End-to-end workflow tracking'].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center text-[11px] text-secondary flex-shrink-0">&#10003;</div>
                <span className="text-[13px] text-white/60">{text}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Powered by */}
        <div className="relative z-10 mt-auto pt-12">
          <p className="text-white/30 text-[11px]">Powered by</p>
          <img src="/images/shieldlytics.png" alt="Shieldlytics" className="w-[180px] mt-1 opacity-60" />
        </div>
      </div>

      {/* Form Panel */}
      <div className="flex-1 bg-white flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="w-8 h-8" />
            <span className="font-display font-bold text-[20px] text-[#032424]">Guardian</span>
          </div>

          <h1 className="font-display font-bold text-[30px] text-[#032424]">Welcome back</h1>
          <p className="text-[15px] text-gray-500 mt-1 mb-8">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field */}
            <div>
              <label htmlFor="email" className="block text-[14px] font-medium text-gray-600 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  placeholder="user@company.com"
                  value={credentials.email}
                  onChange={handleChange}
                  name="email"
                  maxLength={125}
                  className={`w-full px-4 py-3.5 border-[1.5px] rounded-[10px] text-[16px] text-[#032424] placeholder:text-gray-400 outline-none transition-all ${
                    validation.email.touched
                      ? validation.email.valid
                        ? 'border-green-400 focus:border-green-400 focus:ring-[3px] focus:ring-green-400/10'
                        : 'border-red-400 focus:border-red-400 focus:ring-[3px] focus:ring-red-400/10'
                      : 'border-gray-200 focus:border-[#2EBCBC] focus:ring-[3px] focus:ring-[#2EBCBC]/10'
                  }`}
                  disabled={isLoading}
                />
                {validation.email.touched && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none">
                    {validation.email.valid ? (
                      <span className="text-green-500 text-[14px]">&#10003;</span>
                    ) : (
                      <span className="text-red-400 text-[14px]">&#10007;</span>
                    )}
                  </div>
                )}
              </div>
              {validation.email.touched && !validation.email.valid && (
                <p className="mt-1.5 text-[11px] text-red-500">{validation.email.message}</p>
              )}
            </div>

            {/* Password field */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="password" className="block text-[14px] font-medium text-gray-600">
                  Password
                </label>
                <Link to="/forgot-password" className="text-[13px] text-[#2EBCBC] hover:underline">
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={handleChange}
                  name="password"
                  className={`w-full px-4 py-3.5 border-[1.5px] rounded-[10px] text-[16px] text-[#032424] placeholder:text-gray-400 outline-none transition-all pr-20 ${
                    validation.password.touched
                      ? validation.password.valid
                        ? 'border-green-400 focus:border-green-400 focus:ring-[3px] focus:ring-green-400/10'
                        : 'border-red-400 focus:border-red-400 focus:ring-[3px] focus:ring-red-400/10'
                      : 'border-gray-200 focus:border-[#2EBCBC] focus:ring-[3px] focus:ring-[#2EBCBC]/10'
                  }`}
                  disabled={isLoading}
                />
                <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3.5">
                  {validation.password.touched && (
                    <span className="pointer-events-none">
                      {validation.password.valid ? (
                        <span className="text-green-500 text-[14px]">&#10003;</span>
                      ) : (
                        <span className="text-red-400 text-[14px]">&#10007;</span>
                      )}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none ml-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
                  </button>
                </div>
              </div>
              {validation.password.touched && !validation.password.valid && (
                <p className="mt-1.5 text-[11px] text-red-500">{validation.password.message}</p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              className="w-full py-3.5 rounded-[10px] text-white font-semibold text-[16px] flex items-center justify-center gap-2 transition-all bg-[#032424] hover:bg-[#064a4a] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <FaSpinner className="animate-spin" aria-label="Loading" />
                  Verifying credentials...
                </>
              ) : (
                'Sign in'
              )}
            </button>

            {/* Register link */}
            <p className="text-center text-[15px] text-gray-500 mt-4">
              Don't have an account?{' '}
              <Link to="/register" className="text-[#2EBCBC] font-medium hover:underline">
                Register
              </Link>
            </p>

            {/* Legal links */}
            <p className="text-center text-[13px] text-gray-400 mt-4">
              By signing in you agree to the{' '}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setLegalModalType('terms'); setLegalModalOpen(true); }}
                className="text-[#2EBCBC] hover:underline cursor-pointer bg-transparent border-none p-0 text-[11px]"
              >
                Terms of Service
              </button>
              {' '}and{' '}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setLegalModalType('privacy'); setLegalModalOpen(true); }}
                className="text-[#2EBCBC] hover:underline cursor-pointer bg-transparent border-none p-0 text-[11px]"
              >
                Privacy Policy
              </button>
            </p>
          </form>
        </div>
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
