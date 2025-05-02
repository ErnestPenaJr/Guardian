import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { showToast } from '../utils/toast';
import Swal from 'sweetalert2';
import axios from 'axios'; // Import axios

// Helper function to validate email format
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { email } = location.state || {};
  
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isResendDisabled, setIsResendDisabled] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [registrationStep, setRegistrationStep] = useState(1); // Step 1: Personal info, Step 2: Role and team info
  
  // Create refs for the verification code inputs
  const inputRefs = Array(6).fill(0).map(() => React.useRef<HTMLInputElement>(null));

  //get first name from fullname
  
  // Form data for after verification
  const [formData, setFormData] = useState({
    fullName: '',
    password: '',
    confirmPassword: '',
    workspaceName: '',
    role: '',
    teamSize: '',
    companySize: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Check if there's a pending registration
    const registrationData = localStorage.getItem('registrationData');
    
    if (!registrationData) {
      // No pending registration, redirect to register page
      navigate('/register');
      return;
    }
    
    try {
      const data = JSON.parse(registrationData);
      
      // Calculate time left for verification code expiration
      if (data.expiryTime) {
        const expiryTime = new Date(data.expiryTime).getTime();
        const currentTime = Date.now();
        const timeRemaining = Math.max(0, expiryTime - currentTime);
        
        setTimeLeft(Math.floor(timeRemaining / 1000));
      }
    } catch (error) {
      console.error('%c Error parsing registration data:', 'background: #F44336; color: #fff', error);
      navigate('/register');
    }
  }, [navigate]);

  useEffect(() => {
    // If no email was provided, redirect to register
    if (!email || !isValidEmail(email)) {
      navigate('/register');
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

  const validatePassword = (password: string) => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password);
    const isLongEnough = password.length >= 12;

    return hasUpperCase && hasLowerCase && hasNumber && hasSymbol && isLongEnough;
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    setFormData({ ...formData, password });
    
    if (!validatePassword(password)) {
      setPasswordError('Password must be at least 12 characters and include at least one uppercase letter, one lowercase letter, one number, and one symbol');
    } else {
      setPasswordError('');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      // POST to backend to verify email
      const response = await axios.post('/api/verify-email', {
        email,
        verificationCode
      });
      if (response.data.success) {
        showToast.success('Email verified successfully!');
        setVerificationComplete(true);
      } else {
        setError(response.data.error || 'Verification failed.');
      }
    } catch (error: any) {
      if (error.response && error.response.data && error.response.data.error) {
        setError(error.response.data.error);
      } else {
        setError('An error occurred during verification. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    setError('');
    setIsResendDisabled(true);
    setResendCountdown(60); // 1 minute cooldown
    try {
      // Get pending registration data
      const registrationData = localStorage.getItem('registrationData');
      if (!registrationData) {
        setError('No pending registration found. Please register again.');
        setIsLoading(false);
        return;
      }
      const data = JSON.parse(registrationData);
      // Get the email from the pending registration
      const userEmail = data.userData?.email || data.email;
      if (!userEmail) {
        setError('Email address not found. Please register again.');
        setIsLoading(false);
        return;
      }
      // Call backend to resend verification code
      const response = await axios.post('/api/send-verification-email', { email: userEmail });
      if (response.data.success) {
        showToast.success(`Verification code resent to ${userEmail}`);
        // Update localStorage with new code and expiry if returned
        if (response.data.code && response.data.expiryTime) {
          const updatedData = {
            ...data,
            verificationCode: response.data.code,
            expiryTime: response.data.expiryTime
          };
          localStorage.setItem('registrationData', JSON.stringify(updatedData));
          // Update timer
          const timeRemaining = Math.max(0, new Date(response.data.expiryTime).getTime() - Date.now());
          setTimeLeft(Math.floor(timeRemaining / 1000));
        }
      } else {
        setError(response.data.error || `Failed to resend verification code to ${userEmail}. Please try again.`);
      }
    } catch (error: any) {
      console.error('%c Resend code error:', 'background: #F44336; color: #fff', error);
      if (error.response && error.response.data && error.response.data.error) {
        setError(error.response.data.error);
      } else {
        setError('An error occurred while resending the code. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      // Validate form data
      if (!formData.fullName || !formData.password || !formData.confirmPassword || !formData.workspaceName) {
        setError('Please fill in all required fields');
        setIsLoading(false);
        return;
      }
      if (passwordError) {
        setError(passwordError);
        setIsLoading(false);
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }
      // Prepare payload for backend
      const payload = {
        email,
        password: formData.password,
        fullName: formData.fullName, // Send as fullName
        workspaceName: formData.workspaceName,
        role: formData.role,
        teamSize: formData.teamSize,
        companySize: formData.companySize
      };
      // POST to backend to complete registration
      const response = await axios.post('/api/complete-registration', payload);
      if (response.data.success) {
        // Show success message with SweetAlert2
        await Swal.fire({
          title: '<strong>Registration Completed!</strong>',
          html: '<p>Your account has successfully been created. Please sign in to get started!</p>',
          icon: 'success',
          confirmButtonText: 'Sign In',
          confirmButtonColor: '#0D9488', // secondary color
          allowOutsideClick: false,
          customClass: {
            title: 'text-h4 font-display font-bold',
            htmlContainer: 'text-body-md text-gray-1',
            confirmButton: 'font-semibold'
          }
        });
        // Redirect to login page
        navigate('/login');
      } else {
        setError(response.data.error || 'Registration failed.');
      }
    } catch (error: any) {
      console.error('%c Registration completion error:', 'background: #F44336; color: #fff', error);
      if (error.response && error.response.data && error.response.data.error) {
        setError(error.response.data.error);
      } else {
        setError('An error occurred while completing registration. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextStep = () => {
    // Validate current step
    if (registrationStep === 1) {
      if (!formData.fullName) {
        setError('Please enter your full name');
        return;
      }
      if (!formData.password) {
        setError('Please enter a password');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (!validatePassword(formData.password)) {
        return;
      }
      if (!formData.workspaceName) {
        setError('Please enter a workspace name');
        return;
      }
      
      // Move to next step
      setRegistrationStep(2);
      setError('');
    }
  };

  const handlePrevStep = () => {
    setRegistrationStep(1);
    setError('');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If on step 1, move to step 2
    if (registrationStep === 1) {
      handleNextStep();
      return;
    }
    
    // Otherwise, complete registration
    handleCompleteRegistration(e);
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
  };
  
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      // Move to previous input when backspace is pressed on an empty input
      inputRefs[index - 1].current?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      // Move to previous input when left arrow is pressed
      inputRefs[index - 1].current?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      // Move to next input when right arrow is pressed
      inputRefs[index + 1].current?.focus();
    }
  };
  
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 6);
    
    if (digits) {
      setVerificationCode(digits);
      
      // Fill in the inputs with the pasted digits
      digits.split('').forEach((digit, index) => {
        if (inputRefs[index] && inputRefs[index].current) {
          inputRefs[index].current.value = digit;
        }
      });
      
      // Focus the next empty input or the last input
      const nextEmptyIndex = digits.length < 6 ? digits.length : 5;
      inputRefs[nextEmptyIndex].current?.focus();
    }
  };

  const renderVerificationForm = () => (
    <>
      <div className="flex items-center justify-center gap-3 mb-8">
        <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="w-8 h-8" />
        <span className="text-h4 font-display font-bold text-primary">Guardian</span>
      </div>
      
      <h1 className="text-h3 font-display font-bold text-center mb-8">Verify Your Email</h1>
      
      <p className="text-body-md text-gray-1 mb-6 text-center">
        We've sent a 6-digit verification code to <span className="font-medium">{email}</span>
      </p>
      
      {timeLeft > 0 && (
        <div className="mb-6 text-center">
          <p className="text-body-sm text-gray-2 mb-2">
            Code expires in:
          </p>
          <p className="text-heading-sm font-medium text-primary">{formatTime(timeLeft)}</p>
        </div>
      )}
      
      {timeLeft === 0 && (
        <div className="mb-6 text-center">
          <p className="text-body-sm text-error">Verification code has expired</p>
          <p className="text-body-sm text-gray-2">Please request a new code</p>
        </div>
      )}
      
      <form onSubmit={handleVerify} className="space-y-6">
        <div>
          <label htmlFor="verificationCode" className="block text-body-sm font-medium text-gray-1 mb-2">
            Verification Code
          </label>
          <div className="flex justify-between gap-2 mb-6">
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
                className="w-full aspect-square text-center text-lg font-medium rounded-lg border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
              />
            ))}
          </div>
        </div>
        
        {error && (
          <div className="p-3 bg-red-50 text-error rounded-lg mb-6">
            {error}
          </div>
        )}
        
        <button
          type="submit"
          disabled={isLoading || verificationCode.length !== 6 || timeLeft === 0}
          className={`w-full bg-secondary text-white font-semibold py-3 px-4 rounded-lg ${
            isLoading || verificationCode.length !== 6 || timeLeft === 0
              ? 'opacity-70 cursor-not-allowed'
              : 'hover:bg-secondary/90 transition-colors'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying...
            </div>
          ) : (
            'Verify Email'
          )}
        </button>
      </form>
      
      <div className="mt-8 text-center">
        <p className="text-body-sm text-gray-2 mb-2">
          Didn't receive the code?
        </p>
        <button
          onClick={handleResendCode}
          disabled={isResendDisabled || isLoading}
          className={`text-secondary font-medium ${
            isResendDisabled || isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:underline'
          }`}
        >
          {isResendDisabled ? `Resend code (${resendCountdown}s)` : 'Resend code'}
        </button>
      </div>
    </>
  );

  const renderPersonalInfoForm = () => (
    <>
      <h1 className="text-h3 font-display font-bold text-center mb-8">Complete Your Registration</h1>
      
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div>
          <label htmlFor="fullName" className="block text-body-sm font-medium text-gray-1 mb-2">
            Full Name
          </label>
          <input
            type="text"
            id="fullName"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="John Smith"
            className="w-full px-4 py-3 rounded-lg border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-body-sm font-medium text-gray-1 mb-2">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={formData.password}
              onChange={handlePasswordChange}
              placeholder="Create a strong password"
              className={`w-full px-4 py-3 rounded-lg border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-2"
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              )}
            </button>
          </div>
          {passwordError && (
            <p className="text-error text-body-sm mt-1">
              {passwordError}
            </p>
          )}
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="block text-body-sm font-medium text-gray-1 mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              value={formData.confirmPassword}
              onChange={(e) => {
                setFormData({ ...formData, confirmPassword: e.target.value });
                if (e.target.value !== formData.password) {
                  setError('Passwords do not match');
                } else {
                  setError('');
                }
              }}
              placeholder="Confirm your password"
              className={`w-full px-4 py-3 rounded-lg border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-2"
            >
              {showConfirmPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        
        <div>
          <label htmlFor="workspaceName" className="block text-body-sm font-medium text-gray-1 mb-2">
            Workspace Name
          </label>
          <input
            type="text"
            id="workspaceName"
            value={formData.workspaceName}
            onChange={(e) => setFormData({ ...formData, workspaceName: e.target.value })}
            placeholder="Add a team name"
            className="w-full px-4 py-3 rounded-lg border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
          />
        </div>
        
        {error && (
          <div className="p-3 bg-red-50 text-error rounded-lg">
            {error}
          </div>
        )}
        
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full bg-secondary text-white font-semibold py-3 px-4 rounded-lg ${
            isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-secondary/90 transition-colors'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Next...
            </div>
          ) : (
            'Continue'
          )}
        </button>
      </form>
    </>
  );
  
  const renderRoleAndTeamForm = () => (
    <>
      <h1 className="text-h3 font-display font-bold text-center mb-8">Create your account</h1>
      
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div className="mb-6">
          <p className="text-body-md font-medium text-gray-1 mb-3">What best describes your <span className="font-semibold">current role</span>?</p>
          <div className="flex flex-wrap gap-2">
            {['Executive', 'Supervisor', 'Investigator', 'Officer', 'Analyst', 'Support', 'Other'].map((role) => (
              <label 
                key={role} 
                className={`flex items-center gap-2 px-4 py-2 border rounded-full cursor-pointer transition-all ${
                  formData.role === role 
                    ? 'border-secondary bg-secondary/10' 
                    : 'border-gray-5 hover:border-gray-4'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={role}
                  checked={formData.role === role}
                  onChange={() => setFormData({ ...formData, role })}
                  className="h-4 w-4 text-secondary border-gray-5 focus:ring-secondary"
                />
                {role}
              </label>
            ))}
          </div>
        </div>
        
        <div className="mb-6">
          <p className="text-body-md font-medium text-gray-1 mb-3">How many people are on your <span className="font-semibold">team</span>?</p>
          <div className="flex flex-wrap gap-2">
            {['Only me', '2-5', '6-10', '11-15', '16-24', '25-50', '51-100', '101-500'].map((size) => (
              <label 
                key={size} 
                className={`flex items-center gap-2 px-4 py-2 border rounded-full cursor-pointer transition-all ${
                  formData.teamSize === size 
                    ? 'border-secondary bg-secondary/10' 
                    : 'border-gray-5 hover:border-gray-4'
                }`}
              >
                <input
                  type="radio"
                  name="teamSize"
                  value={size}
                  checked={formData.teamSize === size}
                  onChange={() => setFormData({ ...formData, teamSize: size })}
                  className="h-4 w-4 text-secondary border-gray-5 focus:ring-secondary"
                />
                {size}
              </label>
            ))}
          </div>
        </div>
        
        <div className="mb-6">
          <p className="text-body-md font-medium text-gray-1 mb-3">How many people work at your <span className="font-semibold">company</span>?</p>
          <div className="flex flex-wrap gap-2">
            {['1-19', '20-49', '50-99', '100-250', '251-500', '501-1500', '1500+'].map((size) => (
              <label 
                key={size} 
                className={`flex items-center gap-2 px-4 py-2 border rounded-full cursor-pointer transition-all ${
                  formData.companySize === size 
                    ? 'border-secondary bg-secondary/10' 
                    : 'border-gray-5 hover:border-gray-4'
                }`}
              >
                <input
                  type="radio"
                  name="companySize"
                  value={size}
                  checked={formData.companySize === size}
                  onChange={() => setFormData({ ...formData, companySize: size })}
                  className="h-4 w-4 text-secondary border-gray-5 focus:ring-secondary"
                />
                {size}
              </label>
            ))}
          </div>
        </div>
        
        {error && (
          <div className="p-3 bg-red-50 text-error rounded-lg">
            {error}
          </div>
        )}
        
        <div className="flex gap-4">
          <button
            type="button"
            onClick={handlePrevStep}
            className="w-1/3 bg-white border border-gray-5 text-gray-1 font-semibold py-3 px-4 rounded-lg hover:bg-gray-7/50 transition-colors"
          >
            Back
          </button>
          
          <button
            type="submit"
            disabled={isLoading}
            className={`w-2/3 bg-secondary text-white font-semibold py-3 px-4 rounded-lg ${
              isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-secondary/90 transition-colors'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Completing Registration...
              </div>
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </form>
    </>
  );

  const renderRegistrationForm = () => {
    return registrationStep === 1 ? renderPersonalInfoForm() : renderRoleAndTeamForm();
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
        {verificationComplete ? renderRegistrationForm() : renderVerificationForm()}
      </div>
    </div>
  );
};

export default VerifyEmail;
