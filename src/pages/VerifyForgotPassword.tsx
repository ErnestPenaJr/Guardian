import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import sendgrid from '../utils/sendgrid';
import Swal from 'sweetalert2';

// Helper function to validate email format
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const VerifyForgotPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { email } = location.state || {};
  
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isResendDisabled, setIsResendDisabled] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [devMode, setDevMode] = useState(false);
  
  // Create refs for the verification code inputs
  const inputRefs = Array(6).fill(0).map(() => React.useRef<HTMLInputElement>(null));

  useEffect(() => {
    // Check if there's a pending password reset
    const passwordResetData = localStorage.getItem('passwordResetData');
    
    if (!passwordResetData) {
      // No pending password reset, redirect to forgot password page
      navigate('/forgot-password');
      return;
    }
    
    try {
      const data = JSON.parse(passwordResetData);
      
      // Calculate time left for verification code expiration
      if (data.expiryTime) {
        const expiryTime = new Date(data.expiryTime).getTime();
        const currentTime = Date.now();
        const timeRemaining = Math.max(0, expiryTime - currentTime);
        
        setTimeLeft(Math.floor(timeRemaining / 1000));
      }

      // Check if we're in development mode by looking for a console log
      const consoleOutput = document.querySelector('meta[name="console-output"]');
      if (consoleOutput && consoleOutput.getAttribute('content')?.includes('[DEV MODE]')) {
        setDevMode(true);
      }
    } catch (error) {
      console.error('Error parsing password reset data:', error);
      navigate('/forgot-password');
    }
  }, [navigate]);

  useEffect(() => {
    // If no email was provided, redirect to forgot password
    if (!email || !isValidEmail(email)) {
      navigate('/forgot-password');
      return;
    }
  }, [email, navigate]);

  // Timer for code expiration
  useEffect(() => {
    if (timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Timer for resend button cooldown
  useEffect(() => {
    if (resendCountdown <= 0) {
      setIsResendDisabled(false);
      return;
    }
    
    const timer = setInterval(() => {
      setResendCountdown(prevTime => {
        if (prevTime <= 1) {
          clearInterval(timer);
          setIsResendDisabled(false);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const handleVerify = async (e?: React.FormEvent, codeOverride?: string) => {
    e?.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      // Get pending password reset data
      const passwordResetData = localStorage.getItem('passwordResetData');
      if (!passwordResetData) {
        setError('No pending password reset found. Please request a new code.');
        Swal.fire({
          icon: 'error',
          title: 'No Pending Reset',
          text: 'No pending password reset found. Please request a new code.',
          confirmButtonColor: '#0D9488'
        });
        setIsLoading(false);
        return;
      }
      const data = JSON.parse(passwordResetData);
      // Check if verification code has expired
      if (data.expiryTime && new Date(data.expiryTime).getTime() < Date.now()) {
        setError('Verification code expired. Please request a new code.');
        Swal.fire({
          icon: 'warning',
          title: 'Code Expired',
          text: 'Verification code expired. Please request a new code.',
          confirmButtonColor: '#0D9488'
        });
        setIsLoading(false);
        return;
      }
      // Get the stored email for verification
      
      // Use the code override if provided (for auto-submit), otherwise use state
      const codeToUse = codeOverride || verificationCode;
      
      // Debug logging
      console.log('🔍 Verification attempt:', {
        storedEmail: data.email,
        enteredCode: codeToUse,
        codeLength: codeToUse.length,
        usingOverride: !!codeOverride
      });
      
      // Verify the code with the server instead of just comparing locally
      const response = await fetch('/api/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: data.email, 
          code: codeToUse 
        })
      });
      
      const result = await response.json();
      
      // Debug logging for response
      console.log('📥 Verification response:', {
        status: response.status,
        success: result.success,
        error: result.error,
        fullResult: result
      });
      
      if (!response.ok || !result.success) {
        setError('Invalid verification code. Please check your email and try again.');
        Swal.fire({
          icon: 'error',
          title: 'Invalid Code',
          text: result.error || 'Invalid verification code. Please check your email and try again.',
          confirmButtonColor: '#0D9488'
        });
        setIsLoading(false);
        return;
      }
      // Verification successful
      Swal.fire({
        icon: 'success',
        title: 'Verification Successful',
        text: 'Your code has been verified. Please choose a new password.',
        confirmButtonColor: '#0D9488'
      }).then(() => {
        // Pass the verification code along with email and verified flag
        // Use codeToUse instead of verificationCode to ensure we pass the actual verified code
        navigate('/reset-password', {
          state: {
            email,
            verified: true,
            verificationCode: codeToUse
          }
        });
      });
    } catch (error) {
      console.error('Verification error:', error);
      setError('An error occurred during verification. Please try again.');
      Swal.fire({
        icon: 'error',
        title: 'Verification Error',
        text: 'An error occurred during verification. Please try again.',
        confirmButtonColor: '#0D9488'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    setError('');
    setIsResendDisabled(true);
    setResendCountdown(60); // 1 minute cooldown
    
    // Clear any existing verification code input to ensure user enters new code
    setVerificationCode('');
    
    try {
      // Get pending password reset data
      const passwordResetData = localStorage.getItem('passwordResetData');
      
      if (!passwordResetData) {
        setError('No pending password reset found. Please request a new code.');
        Swal.fire({
          icon: 'error',
          title: 'No Pending Reset',
          text: 'No pending password reset found. Please request a new code.',
          confirmButtonColor: '#0D9488'
        });
        setIsLoading(false);
        return;
      }
      
      const data = JSON.parse(passwordResetData);
      
      // Get the email from the pending password reset
      const userEmail = data.email;
      
      if (!userEmail) {
        setError('Email address not found. Please request a new code.');
        Swal.fire({
          icon: 'error',
          title: 'Email Not Found',
          text: 'Email address not found. Please request a new code.',
          confirmButtonColor: '#0D9488'
        });
        setIsLoading(false);
        return;
      }
      
      console.log(`Resending verification code to: ${userEmail}`);
      
      // Call backend API to generate and send new verification code (uses Resend)
      const response = await fetch('/api/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Update localStorage with new verification code and expiry
        const expiryTime = new Date();
        expiryTime.setMinutes(expiryTime.getMinutes() + 15); // 15 minutes expiry
        
        const updatedData = {
          email: userEmail,
          verificationCode: result.verificationCode, // From backend response
          expiryTime: expiryTime.toISOString()
        };
        
        localStorage.setItem('passwordResetData', JSON.stringify(updatedData));
        
        // Update the expiration time in component state
        setTimeLeft(15 * 60); // 15 minutes in seconds
        
        Swal.fire({
          icon: 'success',
          title: 'New Code Sent',
          text: `A new verification code has been sent to ${userEmail}`,
          confirmButtonColor: '#0D9488'
        });
      } else {
        throw new Error(result.error || 'Failed to send new verification code');
      }
    } catch (error) {
      console.error('Resend code error:', error);
      setError('An error occurred while resending the code. Please try again.');
      Swal.fire({
        icon: 'error',
        title: 'Resend Error',
        text: 'An error occurred while resending the code. Please try again.',
        confirmButtonColor: '#0D9488'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    
    if (!/^\d*$/.test(value)) {
      return;
    }
    
    const newCode = verificationCode.split('');
    newCode[index] = value;
    const updatedCode = newCode.join('');
    setVerificationCode(updatedCode);
    
    // Auto-focus next input if a digit was entered
    if (value && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
    
    // Auto-submit when all 6 digits are entered
    if (updatedCode.length === 6 && !isLoading) {
      // Small delay to ensure UI updates, then trigger verification with the updated code
      setTimeout(() => {
        handleVerify(undefined, updatedCode);
      }, 100);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace key
    if (e.key === 'Backspace' && index > 0 && !verificationCode[index]) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    
    // Check if pasted data is a 6-digit number
    if (/^\d{6}$/.test(pastedData)) {
      setVerificationCode(pastedData);
      
      // Focus the last input
      inputRefs[5].current?.focus();
      
      // Auto-submit when 6-digit code is pasted
      if (!isLoading) {
        // Small delay to ensure UI updates, then trigger verification with the pasted code
        setTimeout(() => {
          handleVerify(undefined, pastedData);
        }, 100);
      }
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
          <span className="text-h4 font-display font-bold text-black">Guardian</span>
        </div>

        <h1 className="text-h5 font-display font-bold text-center mb-1">Verify Your Code</h1>
        <p className="text-center text-gray-2 mb-8">
          We've sent a 6-digit verification code to <span className="font-semibold">{email}</span>. 
          Enter the code below to continue.
        </p>
        
        {devMode && (
          <div className="mb-6 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-center">
            <p className="text-body-sm font-medium">Development Mode</p>
            <p className="text-body-sm">Check the browser console for the verification code.</p>
          </div>
        )}
        
        <form onSubmit={handleVerify} className="space-y-6">
          <div>
            <label htmlFor="verification-code" className="block text-body-sm font-medium text-gray-1 mb-2">
              Verification Code
            </label>
            <div className="flex justify-between gap-2">
              {Array(6).fill(0).map((_, index) => (
                <input
                  key={index}
                  ref={inputRefs[index]}
                  type="text"
                  maxLength={1}
                  value={verificationCode[index] || ''}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  className="w-12 h-12 text-center text-xl font-semibold rounded-lg border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                  disabled={isLoading}
                />
              ))}
            </div>
            
            {timeLeft > 0 ? (
              <p className="text-center text-body-sm text-gray-2 mt-2">
                Code expires in {formatTime(timeLeft)}
              </p>
            ) : (
              <p className="text-center text-body-sm text-error mt-2">
                Verification code has expired. Please request a new one.
              </p>
            )}
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 text-error rounded-lg">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            className="w-full py-3 px-4 text-white font-medium flex items-center justify-center gap-2 transition-colors duration-300 ease-in-out cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderRadius: '8px',
              backgroundColor: '#2EBCBC'
            }}
            onMouseEnter={(e) => {
              if (verificationCode.length === 6 && !isLoading) {
                e.currentTarget.style.backgroundColor = '#2F8CED';
              }
            }}
            onMouseLeave={(e) => {
              if (verificationCode.length === 6 && !isLoading) {
                e.currentTarget.style.backgroundColor = '#2EBCBC';
              }
            }}
            disabled={verificationCode.length !== 6 || isLoading}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </div>
            ) : (
              'Verify'
            )}
          </button>
          
          <div className="text-center">
            <button
              type="button"
              onClick={handleResendCode}
              className={`text-secondary text-body-sm hover:text-secondary/80 transition-colors ${isResendDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isResendDisabled || isLoading}
            >
              {isResendDisabled ? `Send new code in ${resendCountdown}s` : 'Send new code'}
            </button>
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
};

export default VerifyForgotPassword;
