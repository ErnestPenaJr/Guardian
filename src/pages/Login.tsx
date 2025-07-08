import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Swal from 'sweetalert2';
import { FaSpinner, FaEye, FaEyeSlash } from 'react-icons/fa';

function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  
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

  // Validate email format
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate password (at least 6 characters)
  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  // Update validation whenever credentials change
  useEffect(() => {
    if (validation.email.touched) {
      setValidation(prev => ({
        ...prev,
        email: {
          ...prev.email,
          valid: validateEmail(credentials.email),
          message: validateEmail(credentials.email) ? '' : 'Please provide a valid email address.'
        }
      }));
    }

    if (validation.password.touched) {
      setValidation(prev => ({
        ...prev,
        password: {
          ...prev.password,
          valid: validatePassword(credentials.password),
          message: validatePassword(credentials.password) ? '' : 'Please provide your password.'
        }
      }));
    }
  }, [credentials, validation.email.touched, validation.password.touched]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched to trigger validation
    setValidation(prev => ({
      email: { ...prev.email, touched: true },
      password: { ...prev.password, touched: true }
    }));
    
    // Check if form is valid
    if (!validateEmail(credentials.email) || !validatePassword(credentials.password)) {
      Swal.fire({
        title: 'Validation Error',
        text: 'Please correct the errors in the form.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    try {
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

      // Show success message
      Swal.fire({
        title: 'Success',
        text: 'Login successful',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
      
      // Redirect to home page after successful login
      navigate('/home');
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle different error scenarios with specific messages
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const statusCode = error.response.status;
        const errorMessage = error.response.data.message || 'Authentication failed';
        
        // Show appropriate error message based on status code
        switch (statusCode) {
          case 401:
            Swal.fire({
              title: 'Authentication Failed',
              text: 'Invalid email or password. Please try again.',
              icon: 'error',
              confirmButtonText: 'OK'
            });
            break;
          case 403:
            Swal.fire({
              title: 'Account Issue',
              text: 'Your account is not active or email is not verified.',
              icon: 'warning',
              confirmButtonText: 'OK'
            });
            break;
          case 404:
            Swal.fire({
              title: 'User Not Found',
              text: 'User not found. Please check your email or register a new account.',
              icon: 'error',
              confirmButtonText: 'OK'
            });
            break;
          case 429:
            Swal.fire({
              title: 'Too Many Attempts',
              text: 'Too many login attempts. Please try again later.',
              icon: 'warning',
              confirmButtonText: 'OK'
            });
            break;
          default:
            Swal.fire({
              title: 'Error',
              text: errorMessage,
              icon: 'error',
              confirmButtonText: 'OK'
            });
        }
      } else if (error.request) {
        // The request was made but no response was received
        Swal.fire({
          title: 'Server Error',
          text: 'Server not responding. Please try again later.',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      } else {
        // Something happened in setting up the request that triggered an Error
        Swal.fire({
          title: 'Unexpected Error',
          text: 'An unexpected error occurred. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK'
        });
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
    
    // Mark field as touched to trigger validation
    setValidation(prev => ({
      ...prev,
      [name]: {
        ...(prev as any)[name],
        touched: true
      }
    }));
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
            <span className="text-h4 font-display font-bold text-primary">Guardian</span>
          </div>
          <h1 className="text-h2 font-display font-bold mb-1">Welcome Back</h1>
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
                className={`w-full px-4 py-3 rounded-lg border ${
                  validation.email.touched
                    ? validation.email.valid
                      ? 'border-green-500 focus:ring-green-500'
                      : 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-secondary'
                } focus:outline-none focus:ring-2 focus:border-transparent transition-all pr-10`}
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
                className={`w-full px-4 py-3 rounded-lg border ${
                  validation.password.touched
                    ? validation.password.valid
                      ? 'border-green-500 focus:ring-green-500'
                      : 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-secondary'
                } focus:outline-none focus:ring-2 focus:border-transparent transition-all pr-10`}
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
              className="w-full py-3 px-4 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-all bg-secondary hover:bg-secondary-dark"
              data-component-name="Login"
              disabled={isLoading}
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
        </form>
      </div>
      
      <div className="mt-8 text-center">
        <p className="text-white text-body-sm font-semibold drop-shadow-md">
          Powered by <br></br>
          <img src="/images/shieldlytics.png" alt="Shieldlytics" width={300} />
        </p>
      </div>
    </div>
  );
}

export default Login;
