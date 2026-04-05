import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { showToast } from '../utils/toast';
import sendgrid from '../utils/sendgrid';
import axios from 'axios';
import Swal from 'sweetalert2';
import LegalModal from '../components/LegalModal';

function Register() {
  const navigate = useNavigate();
  const [isValidatingEmail, setIsValidatingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy'>('terms');

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
          sendgrid.validateEmail(email, 'register'),
          timeoutPromise
        ]);
        
        if (!validationResult.valid) {
          setEmailError(validationResult.reason || 'Invalid email address');
          showToast.error(validationResult.reason || 'Invalid email address');
          setIsValidatingEmail(false);
          return false;
        }
      } catch (error) {
        console.warn('%c Email validation timed out or failed', 'background: #FFC107; color: #000', 'using basic validation instead');
        // If SendGrid validation fails or times out, just use basic validation
        // We already checked basic format above, so we can proceed
      }
      
      setIsValidatingEmail(false);
      return true;
    } catch (error) {
      console.error('%c Email validation error:', 'background: #F44336; color: #fff', error);
      setEmailError('Error validating email. Please try again.');
      showToast.error('Error validating email. Please try again.');
      setIsValidatingEmail(false);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      Swal.fire({
        icon: 'error',
        title: 'Email Required',
        text: 'Please enter your email address',
        confirmButtonColor: '#2EBCBC'
      });
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
      // Call backend registration endpoint without company name
      console.log('%c Registration Submission', 'background: #4CAF50; color: #fff', {
        email,
        timestamp: new Date().toISOString()
      });
      const response = await axios.post('/api/register', { 
        email
      });
      
      console.log('%c Registration API Response', 'background: #2196F3; color: #fff', response.data);
      
      // Check if registration actually succeeded
      if ((response.status === 201 && response.data.message) || 
          (response.status === 200 && response.data.success && response.data.message)) {
        // Success: proceed to verification
        showToast.success(`Verification code sent to ${email}`);
        // Persist registration data for verification page
        const expiryTime = new Date(Date.now() + 1000 * 60 * 30).toISOString();
        const registrationData = { 
          email, 
          expiryTime,
          // Include verification code if provided (development mode)
          ...(response.data.verificationCode && { verificationCode: response.data.verificationCode })
        };
        localStorage.setItem('registrationData', JSON.stringify(registrationData));
        
        // Show verification code in development mode
        if (response.data.verificationCode) {
          console.log('%c Development Mode - Verification Code:', 'background: #FF9800; color: #fff; font-size: 16px; font-weight: bold;', response.data.verificationCode);
          showToast.success(`Verification code sent to ${email} (Dev: ${response.data.verificationCode})`);
        }
        
        navigate('/verify-email', { state: { email } });
      } else {
        throw new Error('Registration failed - unexpected response from server');
      }
    } catch (error: any) {
      console.error('[Registration] Error:', error);
      
      let errorMessage = 'An error occurred during registration. Please try again.';
      
      if (error.response) {
        // Server responded with error status
        if (error.response.status === 409) {
          errorMessage = 'An account with this email already exists.';
        } else if (error.response.status === 503) {
          errorMessage = 'Database connection failed. Please try again later.';
        } else if (error.response.data && error.response.data.error) {
          errorMessage = error.response.data.error;
        } else {
          errorMessage = `Server error (${error.response.status}). Please try again.`;
        }
      } else if (error.request) {
        // Network error - no response received
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else {
        // Other errors (including our custom "unexpected response" error)
        errorMessage = error.message || 'Registration failed. Please try again.';
      }
      
      setError(errorMessage);
      showToast.error(errorMessage);
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
            Create your account in a few simple steps.
          </p>

          {/* Step progress indicator */}
          <div className="space-y-0 text-left">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#2EBCBC] text-[#032424] flex items-center justify-center text-[14px] font-bold">1</div>
              <div>
                <div className="text-[14px] font-medium text-white">Verify Email</div>
                <div className="text-[12px] text-white/40">You are here</div>
              </div>
            </div>
            <div className="w-px h-4 bg-white/15 ml-4"></div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 text-white/30 flex items-center justify-center text-[14px] font-semibold">2</div>
              <div className="text-[14px] text-white/30">Account Details</div>
            </div>
            <div className="w-px h-4 bg-white/15 ml-4"></div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 text-white/30 flex items-center justify-center text-[14px] font-semibold">3</div>
              <div className="text-[14px] text-white/30">Set Password</div>
            </div>
          </div>
        </div>
        {/* Powered by */}
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

          <h1 className="font-display font-bold text-[30px] text-[#032424]">Create your account</h1>
          <p className="text-[15px] text-gray-500 mt-1 mb-8">Enter your email to get started</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-[14px] font-medium text-gray-600 mb-1.5">
                Email address <span className="text-red-400">*</span>
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
                <p className="mt-1.5 text-[11px] text-red-500">{emailError}</p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-[12px] rounded-[10px] border border-red-100">
                {error}
              </div>
            )}

            <p className="text-[13px] text-gray-400 text-center">
              By proceeding you agree to the{' '}
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
              Already have an account?{' '}
              <Link to="/login" className="text-[#2EBCBC] font-medium hover:underline">
                Sign in
              </Link>
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

export default Register;
