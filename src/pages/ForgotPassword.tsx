import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import sendgrid from '../utils/sendgrid';
import Swal from 'sweetalert2';

function ForgotPassword() {
  const navigate = useNavigate();
  const [isValidatingEmail, setIsValidatingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  // Handle email validation
  const validateEmailWithSendGrid = async (email: string) => {
    setIsValidatingEmail(true);
    setEmailError('');
    
    try {
      // First check basic format
      if (!sendgrid.validateEmailFormat(email)) {
        setEmailError('Please enter a valid email address');
        Swal.fire({
          icon: 'error',
          title: 'Invalid Email',
          text: 'Please enter a valid email address.',
          confirmButtonColor: '#0D9488'
        });
        setIsValidatingEmail(false);
        return false;
      }
      
      // Set a timeout to ensure validation doesn't get stuck
      const timeoutPromise = new Promise<{valid: boolean, reason?: string}>((_, reject) => {
        setTimeout(() => reject(new Error('Validation timed out')), 5000);
      });
      
      try {
        const validationResult = await Promise.race([
          fetch('/api/validate-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, purpose: 'reset' })
          }).then(async res => {
            if (res.ok) return await res.json();
            const errorData = await res.json();
            throw { status: res.status, ...errorData };
          }),
          timeoutPromise
        ]);
        
        if (!validationResult.valid) {
          setEmailError(validationResult.reason || 'Invalid email address');
          Swal.fire({
            icon: 'error',
            title: 'Invalid Email',
            text: validationResult.reason || 'Invalid email address',
            confirmButtonColor: '#0D9488'
          });
          setIsValidatingEmail(false);
          return false;
        }
      } catch (error: any) {
        if (error.status === 404) {
          setEmailError('Email not found');
          Swal.fire({
            icon: 'error',
            title: 'Email Not Found',
            text: 'No account found with that email address.',
            confirmButtonColor: '#0D9488'
          });
        } else if (error.status === 403) {
          setEmailError('Email not verified');
          Swal.fire({
            icon: 'error',
            title: 'Email Not Verified',
            text: 'This email address has not been verified. Please check your inbox or register.',
            confirmButtonColor: '#0D9488'
          });
        } else if (error.status === 409) {
          setEmailError('Email already registered');
          Swal.fire({
            icon: 'error',
            title: 'Email Already Registered',
            text: 'This email is already registered. Please log in or reset your password.',
            confirmButtonColor: '#0D9488'
          });
        } else {
          setEmailError('Error validating email. Please try again.');
          Swal.fire({
            icon: 'error',
            title: 'Email Validation Error',
            text: 'Error validating email. Please try again.',
            confirmButtonColor: '#0D9488'
          });
        }
        setIsValidatingEmail(false);
        return false;
      }
      
      setIsValidatingEmail(false);
      return true;
    } catch (error) {
      console.error('Email validation error:', error);
      setEmailError('Error validating email. Please try again.');
      Swal.fire({
        icon: 'error',
        title: 'Email Validation Error',
        text: 'Error validating email. Please try again.',
        confirmButtonColor: '#0D9488'
      });
      setIsValidatingEmail(false);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      Swal.fire({
        icon: 'error',
        title: 'Missing Email',
        text: 'Please enter your email address.',
        confirmButtonColor: '#0D9488'
      });
      return;
    }
    
    // Basic email format validation
    if (!sendgrid.validateEmailFormat(email)) {
      setEmailError('Please enter a valid email address');
      Swal.fire({
        icon: 'error',
        title: 'Invalid Email',
        text: 'Please enter a valid email address.',
        confirmButtonColor: '#0D9488'
      });
      return;
    }
    
    // Validate email with SendGrid
    const isValid = await validateEmailWithSendGrid(email);
    if (!isValid) {
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Call backend to request password reset
      const response = await fetch('/api/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        // Store verification code and expiry information in localStorage
        // This is needed for the verification page to work properly
        const expiryTime = new Date();
        expiryTime.setMinutes(expiryTime.getMinutes() + 15); // 15 minutes expiry
        
        const passwordResetData = {
          email: email,
          verificationCode: data.verificationCode, // Use the code from the server response
          expiryTime: expiryTime.toISOString()
        };
        
        // Store in localStorage for the verification page to access
        localStorage.setItem('passwordResetData', JSON.stringify(passwordResetData));
        
        Swal.fire({
          icon: 'success',
          title: 'Password Reset Code Sent',
          text: 'A password reset code has been sent to your email. Please check your inbox.',
          confirmButtonColor: '#0D9488',
          confirmButtonText: 'Enter Verification Code'
        }).then(() => {
          // Navigate to the verification page with the email in state
          navigate('/verify-forgot-password', { state: { email } });
        });
      } else if (response.status === 403 && data.error) {
        Swal.fire({
          icon: 'warning',
          title: 'Email Not Verified',
          text: data.error,
          confirmButtonColor: '#0D9488',
          footer: '<a href="/verify-email">Verify your email</a>'
        });
      } else if (data.error) {
        Swal.fire({
          icon: 'error',
          title: 'Password Reset Failed',
          text: data.error,
          confirmButtonColor: '#0D9488'
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Password Reset Failed',
          text: 'An error occurred during password reset request. Please try again.',
          confirmButtonColor: '#0D9488'
        });
      }
    } catch (error) {
      console.error('Password reset request error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Request Error',
        text: 'An error occurred during password reset request. Please try again.',
        confirmButtonColor: '#0D9488'
      });
    } finally {
      setIsLoading(false);
    }
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
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="w-8 h-8" />
          <span className="text-h4 font-display font-bold text-primary">Guardian</span>
        </div>

        <h1 className="text-h3 font-display font-bold text-center mb-2">Forgot Password</h1>
        <p className="text-center text-gray-2 mb-8">Enter your email address and we'll send you a verification code to reset your password.</p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="email" className="block text-body-sm font-medium text-gray-1 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="JohnSmith@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border ${emailError ? 'border-error' : 'border-gray-5'} focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all`}
              disabled={isValidatingEmail || isLoading}
            />
            {emailError && (
              <p className="text-error text-body-sm mt-1">
                {emailError}
              </p>
            )}
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-error rounded-lg mb-6">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            className="w-full bg-secondary text-white font-semibold py-3 px-4 rounded-lg hover:bg-secondary/90 transition-colors"
            disabled={isValidatingEmail || isLoading}
          >
            {isValidatingEmail ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Validating Email...
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending Verification Code...
              </div>
            ) : (
              'Send Verification Code'
            )}
          </button>
        </form>
        
        <div className="mt-8 text-center">
          <p className="text-body-sm text-gray-2">
            Remember your password?{' '}
            <Link to="/login" className="text-secondary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
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

export default ForgotPassword;
