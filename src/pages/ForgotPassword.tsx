import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { showToast } from '../utils/toast';
import { devConsole } from '../utils/devConsole';
import sendgrid from '../utils/sendgrid';

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
        showToast.error('Please enter a valid email address');
        setIsValidatingEmail(false);
        return false;
      }
      
      // Set a timeout to ensure validation doesn't get stuck
      const timeoutPromise = new Promise<{valid: boolean, reason?: string}>((_, reject) => {
        setTimeout(() => reject(new Error('Validation timed out')), 5000);
      });
      
      // Then validate with SendGrid with a timeout
      try {
        const validationResult = await Promise.race([
          sendgrid.validateEmail(email),
          timeoutPromise
        ]);
        
        if (!validationResult.valid) {
          setEmailError(validationResult.reason || 'Invalid email address');
          showToast.error(validationResult.reason || 'Invalid email address');
          setIsValidatingEmail(false);
          return false;
        }
      } catch (error) {
        console.warn('Email validation timed out or failed, using basic validation instead');
        // If SendGrid validation fails or times out, just use basic validation
        // We already checked basic format above, so we can proceed
      }
      
      setIsValidatingEmail(false);
      return true;
    } catch (error) {
      console.error('Email validation error:', error);
      setEmailError('Error validating email. Please try again.');
      showToast.error('Error validating email. Please try again.');
      setIsValidatingEmail(false);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      showToast.error('Please enter your email address');
      return;
    }
    
    // Basic email format validation
    if (!sendgrid.validateEmailFormat(email)) {
      setEmailError('Please enter a valid email address');
      showToast.error('Please enter a valid email address');
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
      // Get or create a verification code with expiration time
      const verificationData = sendgrid.getOrCreateVerificationCode();
      
      // Store verification code and user data (in a real app, this would be in a database)
      // For this example, we'll use localStorage
      localStorage.setItem('passwordResetData', JSON.stringify({
        email,
        verificationCode: verificationData.code,
        expiryTime: verificationData.expiryTime
      }));
      
      console.log(`Sending verification email to: ${email}`);
      
      try {
        // Send verification email
        const emailSent = await sendgrid.sendVerificationEmail(email, verificationData.code);
        
        if (emailSent) {
          showToast.success(`Verification code sent to ${email}`);
          navigate('/verify-forgot-password', { state: { email } });
        } else {
          // For development purposes, show the verification code in the console
          devConsole.log(`[DEV MODE] Verification code for ${email}: ${verificationData.code}`);
          showToast.warning('Email service unavailable. Check console for verification code (development only).');
          navigate('/verify-forgot-password', { state: { email } });
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // For development purposes, show the verification code in the console
        devConsole.log(`[DEV MODE] Verification code for ${email}: ${verificationData.code}`);
        showToast.warning('Email service unavailable. Check console for verification code (development only).');
        navigate('/verify-forgot-password', { state: { email } });
      }
    } catch (error) {
      console.error('Password reset request error:', error);
      setError('An error occurred during password reset request. Please try again.');
      showToast.error('An error occurred during password reset request. Please try again.');
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
