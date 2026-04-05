import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { showToast } from '../utils/toast';
import Swal from 'sweetalert2';
import axios from 'axios'; // Import axios
import LegalModal from '../components/LegalModal';

// Helper function to validate email format
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Helper function to generate military call signs
const generateCallSign = (): string => {
  const callSignPrefixes = [
    'GUARDIAN', 'SHIELD', 'DRAGON', 'PHOENIX', 'EAGLE', 'FALCON', 'WARRIOR',
    'THUNDER', 'LIGHTNING', 'STORM', 'BLADE', 'STEEL', 'IRON', 'TITAN',
    'VIPER', 'HAWK', 'RAVEN', 'WOLF', 'BEAR', 'LION', 'KNIGHT', 'SABER',
    'GHOST', 'SHADOW', 'RANGER', 'SCOUT', 'HUNTER', 'ARCHER', 'SNIPER'
  ];

  const randomPrefix = callSignPrefixes[Math.floor(Math.random() * callSignPrefixes.length)];
  const randomNumber = Math.floor(Math.random() * 90) + 10; // Generate 2-digit number (10-99)

  return `${randomPrefix}-${randomNumber}`;
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
    workspace: '',
    role: '',
    teamSize: '',
    companySize: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Legal modal state
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy'>('terms');

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

      // Auto-fill verification code in development mode
      if (data.verificationCode && process.env.NODE_ENV === 'development') {
        console.log('%c Development Mode - Auto-filling verification code:', 'background: #FF9800; color: #fff; font-size: 14px;', data.verificationCode);
        setVerificationCode(data.verificationCode);
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

        // Pre-populate workspace field with generated call sign when verification is complete
        if (!formData.workspace) {
          const generatedCallSign = generateCallSign();
          setFormData(prev => ({ ...prev, workspace: generatedCallSign }));
        }
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
      if (!formData.fullName || !formData.password || !formData.confirmPassword || !formData.workspace) {
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
      // Prepare payload for backend (workspaceName provided by user)
      const payload = {
        email,
        password: formData.password,
        fullName: formData.fullName, // Send as fullName
        workspaceName: formData.workspace, // Send custom workspace name
        role: formData.role,
        teamSize: formData.teamSize,
        companySize: formData.companySize
      };
      // POST to backend to complete registration
      const response = await axios.post('/api/complete-registration', payload);
      if (response.data.success) {
        // Show simple success toast and redirect to login
        const callSign = response.data.callSign || 'GUARDIAN-XX';
        showToast.success(`Registration completed! Welcome to ${callSign}. Please sign in to continue.`);

        // Clear registration data from localStorage
        localStorage.removeItem('registrationData');

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
      if (!formData.workspace) {
        setError('Please enter your workspace name');
        return;
      }
      if (!validatePassword(formData.password)) {
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

  // Determine which step is active for the brand panel indicator
  const getCurrentStep = () => {
    if (!verificationComplete) return 1;
    if (registrationStep === 1) return 2;
    return 3;
  };

  const renderVerificationForm = () => (
    <>
      <h1 className="font-display font-bold text-[30px] text-[#032424]">Verify your email</h1>
      <p className="text-[15px] text-gray-500 mt-1 mb-8">
        We've sent a 6-digit code to <span className="font-medium text-[#032424]">{email}</span>
      </p>

      {timeLeft > 0 && (
        <div className="mb-6">
          <p className="text-[13px] text-gray-400">Code expires in</p>
          <p className="text-[16px] font-semibold text-[#032424]">{formatTime(timeLeft)}</p>
        </div>
      )}

      {timeLeft === 0 && (
        <div className="mb-6">
          <p className="text-[13px] text-red-500">Verification code has expired</p>
          <p className="text-[13px] text-gray-400">Please request a new code</p>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-5">
        <div>
          <label htmlFor="verificationCode" className="block text-[14px] font-medium text-gray-600 mb-2">
            Verification Code
          </label>
          <div className="flex justify-between gap-2.5 mb-1">
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
                className="w-12 h-14 text-center text-[20px] font-semibold rounded-[10px] border-[1.5px] border-gray-200 focus:outline-none focus:border-[#2EBCBC] focus:ring-[3px] focus:ring-[#2EBCBC]/10 transition-all"
                disabled={isLoading}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-[13px] rounded-[10px] border border-red-100">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || verificationCode.length !== 6 || timeLeft === 0}
          className="w-full py-3.5 rounded-[10px] text-white font-semibold text-[16px] flex items-center justify-center gap-2 transition-all bg-[#032424] hover:bg-[#064a4a] disabled:opacity-50 disabled:cursor-not-allowed"
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
            'Verify Email'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-[13px] text-gray-400 mb-1">
          Didn't receive the code?
        </p>
        <button
          onClick={handleResendCode}
          disabled={isResendDisabled || isLoading}
          className={`text-[15px] text-[#2EBCBC] font-medium ${
            isResendDisabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:underline'
          }`}
        >
          {isResendDisabled ? `Resend code (${resendCountdown}s)` : 'Resend code'}
        </button>
      </div>
    </>
  );

  const renderPersonalInfoForm = () => (
    <>
      <h1 className="font-display font-bold text-[30px] text-[#032424]">Complete your profile</h1>
      <p className="text-[15px] text-gray-500 mt-1 mb-8">Set up your account details to get started.</p>

      <form onSubmit={handleFormSubmit} className="space-y-5">
        <div>
          <label htmlFor="fullName" className="block text-[14px] font-medium text-gray-600 mb-1.5">
            Full Name
          </label>
          <input
            type="text"
            id="fullName"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="John Smith"
            className="w-full px-4 py-3.5 border-[1.5px] rounded-[10px] text-[16px] text-[#032424] placeholder:text-gray-400 outline-none transition-all border-gray-200 focus:border-[#2EBCBC] focus:ring-[3px] focus:ring-[#2EBCBC]/10"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-[14px] font-medium text-gray-600 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={formData.password}
              onChange={handlePasswordChange}
              placeholder="Create a strong password"
              className={`w-full px-4 py-3.5 border-[1.5px] rounded-[10px] text-[16px] text-[#032424] placeholder:text-gray-400 outline-none transition-all pr-12 ${
                passwordError ? 'border-red-400 focus:border-red-400 focus:ring-[3px] focus:ring-red-400/10' : 'border-gray-200 focus:border-[#2EBCBC] focus:ring-[3px] focus:ring-[#2EBCBC]/10'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
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
            <p className="text-[12px] text-red-500 mt-1">{passwordError}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-[14px] font-medium text-gray-600 mb-1.5">
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
              className={`w-full px-4 py-3.5 border-[1.5px] rounded-[10px] text-[16px] text-[#032424] placeholder:text-gray-400 outline-none transition-all pr-12 ${
                formData.confirmPassword && formData.password !== formData.confirmPassword
                  ? 'border-red-400 focus:border-red-400 focus:ring-[3px] focus:ring-red-400/10'
                  : 'border-gray-200 focus:border-[#2EBCBC] focus:ring-[3px] focus:ring-[#2EBCBC]/10'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
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
          {formData.confirmPassword && formData.password !== formData.confirmPassword && (
            <p className="text-[12px] text-red-500 mt-1">Passwords do not match</p>
          )}
        </div>

        <div>
          <label htmlFor="workspace" className="block text-[14px] font-medium text-gray-600 mb-1.5">
            Workspace
          </label>
          <input
            type="text"
            id="workspace"
            value={formData.workspace}
            onChange={(e) => setFormData({ ...formData, workspace: e.target.value })}
            placeholder="Your organization/workspace name"
            className="w-full px-4 py-3.5 border-[1.5px] rounded-[10px] text-[16px] text-[#032424] placeholder:text-gray-400 outline-none transition-all border-gray-200 focus:border-[#2EBCBC] focus:ring-[3px] focus:ring-[#2EBCBC]/10"
          />
          <p className="text-[13px] text-gray-400 mt-1.5">
            {formData.workspace && formData.workspace.match(/^[A-Z]+-\d{2}$/)
              ? 'Pre-generated call sign - you can modify this or use as-is (changeable later in settings)'
              : 'Enter a unique name for your workspace (you can change this later in settings)'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-[13px] rounded-[10px] border border-red-100">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 rounded-[10px] text-white font-semibold text-[16px] flex items-center justify-center gap-2 transition-all bg-[#032424] hover:bg-[#064a4a] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
      <h1 className="font-display font-bold text-[30px] text-[#032424]">About your team</h1>
      <p className="text-[15px] text-gray-500 mt-1 mb-8">Help us personalize your experience.</p>

      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div>
          <p className="text-[15px] font-medium text-gray-600 mb-3">What best describes your <span className="font-semibold text-[#032424]">current role</span>?</p>
          <div className="flex flex-wrap gap-2">
            {['Executive', 'Supervisor', 'Investigator', 'Officer', 'Analyst', 'Support', 'Other'].map((role) => (
              <label
                key={role}
                className={`flex items-center gap-2 px-4 py-2.5 border-[1.5px] rounded-[10px] cursor-pointer transition-all text-[14px] ${
                  formData.role === role
                    ? 'border-[#2EBCBC] bg-[#2EBCBC]/5 text-[#032424] font-medium'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={role}
                  checked={formData.role === role}
                  onChange={() => setFormData({ ...formData, role })}
                  className="h-4 w-4 text-[#2EBCBC] border-gray-300 focus:ring-[#2EBCBC]"
                />
                {role}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[15px] font-medium text-gray-600 mb-3">How many people are on your <span className="font-semibold text-[#032424]">team</span>?</p>
          <div className="flex flex-wrap gap-2">
            {['Only me', '2-5', '6-10', '11-15', '16-24', '25-50', '51-100', '101-500'].map((size) => (
              <label
                key={size}
                className={`flex items-center gap-2 px-4 py-2.5 border-[1.5px] rounded-[10px] cursor-pointer transition-all text-[14px] ${
                  formData.teamSize === size
                    ? 'border-[#2EBCBC] bg-[#2EBCBC]/5 text-[#032424] font-medium'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="teamSize"
                  value={size}
                  checked={formData.teamSize === size}
                  onChange={() => setFormData({ ...formData, teamSize: size })}
                  className="h-4 w-4 text-[#2EBCBC] border-gray-300 focus:ring-[#2EBCBC]"
                />
                {size}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[15px] font-medium text-gray-600 mb-3">How many people work at your <span className="font-semibold text-[#032424]">company</span>?</p>
          <div className="flex flex-wrap gap-2">
            {['1-19', '20-49', '50-99', '100-250', '251-500', '501-1500', '1500+'].map((size) => (
              <label
                key={size}
                className={`flex items-center gap-2 px-4 py-2.5 border-[1.5px] rounded-[10px] cursor-pointer transition-all text-[14px] ${
                  formData.companySize === size
                    ? 'border-[#2EBCBC] bg-[#2EBCBC]/5 text-[#032424] font-medium'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="companySize"
                  value={size}
                  checked={formData.companySize === size}
                  onChange={() => setFormData({ ...formData, companySize: size })}
                  className="h-4 w-4 text-[#2EBCBC] border-gray-300 focus:ring-[#2EBCBC]"
                />
                {size}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-[13px] rounded-[10px] border border-red-100">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handlePrevStep}
            className="w-1/3 py-3.5 rounded-[10px] border-[1.5px] border-gray-200 text-gray-600 font-semibold text-[16px] transition-all hover:bg-gray-50"
          >
            Back
          </button>

          <button
            type="submit"
            disabled={isLoading}
            className="w-2/3 py-3.5 rounded-[10px] text-white font-semibold text-[16px] flex items-center justify-center gap-2 transition-all bg-[#032424] hover:bg-[#064a4a] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Completing Registration...
              </div>
            ) : (
              'Complete Registration'
            )}
          </button>
        </div>

        <p className="text-center text-[13px] text-gray-400 mt-4">
          By proceeding you agree to the{' '}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setLegalModalType('terms');
              setLegalModalOpen(true);
            }}
            className="text-[#2EBCBC] hover:underline cursor-pointer bg-transparent border-none p-0 text-[13px]"
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
            className="text-[#2EBCBC] hover:underline cursor-pointer bg-transparent border-none p-0 text-[13px]"
          >
            Privacy Policy
          </button>
        </p>
      </form>
    </>
  );

  const renderRegistrationForm = () => {
    return registrationStep === 1 ? renderPersonalInfoForm() : renderRoleAndTeamForm();
  };

  const currentStep = getCurrentStep();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Brand Panel */}
      <div className="hidden lg:flex w-[42%] bg-gradient-to-br from-[#032424] to-[#064a4a] text-white p-10 flex-col justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="w-10 h-10" />
            <span className="font-display font-extrabold text-[24px] text-secondary">Guardian</span>
          </div>
          <p className="text-[15px] text-white/70 leading-relaxed mb-8 max-w-[320px]">
            Complete your account setup to get started with Guardian.
          </p>

          {/* Step progress indicator */}
          <div className="space-y-4">
            {[
              { step: '1', text: 'Verify your email', active: currentStep === 1, done: currentStep > 1 },
              { step: '2', text: 'Set up your profile', active: currentStep === 2, done: currentStep > 2 },
              { step: '3', text: 'About your team', active: currentStep === 3, done: false },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold ${
                  item.active ? 'bg-[#2EBCBC] text-[#032424]' : item.done ? 'bg-[#2EBCBC]/30 text-[#2EBCBC]' : 'bg-white/10 text-white/30'
                }`}>
                  {item.done ? '\u2713' : item.step}
                </div>
                <span className={`text-[13px] ${item.active ? 'text-white font-medium' : item.done ? 'text-white/50' : 'text-white/30'}`}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
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

          {verificationComplete ? renderRegistrationForm() : renderVerificationForm()}
        </div>
      </div>

      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        type={legalModalType}
      />
    </div>
  );
};

export default VerifyEmail;
