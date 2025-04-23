import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { showToast } from '../utils/toast';
import sendgrid from '../utils/sendgrid';
import axios from 'axios';

function Register() {
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
      // Call backend registration endpoint
      const response = await axios.post('/api/register', { email });
      // Success: proceed to verification
      showToast.success(`Verification code sent to ${email}`);
      // Persist registration data for verification page
      const expiryTime = new Date(Date.now() + 1000 * 60 * 30).toISOString();
      localStorage.setItem('registrationData', JSON.stringify({ email, expiryTime }));
      navigate('/verify-email', { state: { email } });
    } catch (error: any) {
      if (error.response && error.response.data && error.response.data.error) {
        setError(error.response.data.error);
        showToast.error(error.response.data.error);
      } else {
        setError('An error occurred during registration. Please try again.');
        showToast.error('An error occurred during registration. Please try again.');
      }
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

        <h1 className="text-h3 font-display font-bold text-center mb-8">Welcome to Guardian</h1>
        
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
          
          <p className="text-center text-body-sm mb-6">
            By proceeding you agree to the <Link to="/terms" className="text-secondary">Terms of Service</Link> and <Link to="/privacy" className="text-secondary">Privacy Policy</Link>
          </p>
          
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
              'Continue'
            )}
          </button>
        </form>
        
        <div className="mt-8 text-center">
          <p className="text-body-sm text-gray-2">
            Already have an account?{' '}
            <Link to="/login" className="text-secondary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
