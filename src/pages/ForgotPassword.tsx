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
          confirmButtonColor: '#2EBCBC'
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
            confirmButtonColor: '#2EBCBC'
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
            confirmButtonColor: '#2EBCBC'
          });
        } else if (error.status === 403) {
          setEmailError('Email not verified');
          Swal.fire({
            icon: 'error',
            title: 'Email Not Verified',
            text: 'This email address has not been verified. Please check your inbox or register.',
            confirmButtonColor: '#2EBCBC'
          });
        } else if (error.status === 409) {
          setEmailError('Email already registered');
          Swal.fire({
            icon: 'error',
            title: 'Email Already Registered',
            text: 'This email is already registered. Please log in or reset your password.',
            confirmButtonColor: '#2EBCBC'
          });
        } else {
          setEmailError('Error validating email. Please try again.');
          Swal.fire({
            icon: 'error',
            title: 'Email Validation Error',
            text: 'Error validating email. Please try again.',
            confirmButtonColor: '#2EBCBC'
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
        
        // Navigate directly to the verification page without showing modal
        navigate('/verify-forgot-password', { state: { email } });
      } else if (response.status === 403 && data.error) {
        Swal.fire({
          icon: 'warning',
          title: 'Email Not Verified',
          text: data.error,
          confirmButtonColor: '#2EBCBC',
          footer: '<a href="/verify-email">Verify your email</a>'
        });
      } else if (data.error) {
        Swal.fire({
          icon: 'error',
          title: 'Password Reset Failed',
          text: data.error,
          confirmButtonColor: '#2EBCBC'
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Password Reset Failed',
          text: 'An error occurred during password reset request. Please try again.',
          confirmButtonColor: '#2EBCBC'
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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Brand Panel */}
      <div className="hidden lg:flex w-[42%] bg-gradient-to-br from-[#032424] to-[#064a4a] text-white p-10 flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="flex items-center gap-4 mb-6">
            <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="w-16 h-16" />
            <span className="font-display font-extrabold text-[36px] text-secondary">Guardian</span>
          </div>
          <p className="text-[17px] text-white/70 leading-relaxed mb-10 max-w-[340px]">
            Secure password reset process.
          </p>

          {/* Reset flow info */}
          <div className="space-y-5 text-left">
            {[
              { step: '1', text: 'Enter your email address', active: true },
              { step: '2', text: 'Receive verification code' },
              { step: '3', text: 'Create new password' },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold ${
                  item.active ? 'bg-[#2EBCBC] text-[#032424]' : 'bg-white/10 text-white/30'
                }`}>{item.step}</div>
                <span className={`text-[15px] ${item.active ? 'text-white font-medium' : 'text-white/30'}`}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 mt-auto pt-12 text-center">
          <p className="text-white/30 text-[12px]">Powered by</p>
          <img src="/images/shieldlytics.png" alt="Shieldlytics" className="w-[200px] mt-1 opacity-60 mx-auto" />
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

          <h1 className="font-display font-bold text-[30px] text-[#032424]">Forgot password?</h1>
          <p className="text-[15px] text-gray-500 mt-1 mb-8">Enter your email and we'll send you a verification code to reset your password.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-[14px] font-medium text-gray-600 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-3.5 border-[1.5px] rounded-[10px] text-[16px] text-[#032424] placeholder:text-gray-400 outline-none transition-all ${
                  emailError
                    ? 'border-red-400 focus:border-red-400 focus:ring-[3px] focus:ring-red-400/10'
                    : 'border-gray-200 focus:border-[#2EBCBC] focus:ring-[3px] focus:ring-[#2EBCBC]/10'
                }`}
                disabled={isValidatingEmail || isLoading}
              />
              {emailError && (
                <p className="mt-1.5 text-[12px] text-red-500">{emailError}</p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-[13px] rounded-[10px] border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-[10px] text-white font-semibold text-[16px] flex items-center justify-center gap-2 transition-all bg-[#032424] hover:bg-[#064a4a] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isValidatingEmail || isLoading}
            >
              {isValidatingEmail ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Validating Email...
                </div>
              ) : isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending Verification Code...
                </div>
              ) : (
                'Send Verification Code'
              )}
            </button>

            <p className="text-center text-[15px] text-gray-500 mt-4">
              Remember your password?{' '}
              <Link to="/login" className="text-[#2EBCBC] font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
