import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { showToast } from '../utils/toast';
import sendgrid from '../utils/sendgrid';

function Register() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
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
  const [isValidatingEmail, setIsValidatingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');

  const validatePassword = (password: string) => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password);
    const isLongEnough = password.length >= 12;

    return isLongEnough && hasUpperCase && hasLowerCase && hasNumber && hasSymbol;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'email') {
      setEmailError('');
    }

    if (name === 'password') {
      if (!validatePassword(value)) {
        setPasswordError('Password requirements not met.');
      } else {
        setPasswordError('');
      }
    }

    if (name === 'confirmPassword') {
      if (value !== formData.password) {
        setPasswordError('Passwords do not match.');
      } else if (!validatePassword(formData.password)) {
        setPasswordError('Password requirements not met.');
      } else {
        setPasswordError('');
      }
    }
  };

  const validateEmailWithSendGrid = async (email: string) => {
    setIsValidatingEmail(true);
    try {
      const result = await sendgrid.validateEmail(email);
      
      if (!result.isValid) {
        setEmailError(result.reason || 'Invalid email address');
        showToast.error(result.reason || 'Invalid email address');
        setIsValidatingEmail(false);
        return false;
      }
      
      setEmailError('');
      setIsValidatingEmail(false);
      return true;
    } catch (error) {
      console.error('Email validation error:', error);
      setEmailError('Error validating email');
      showToast.error('Error validating email. Please try again.');
      setIsValidatingEmail(false);
      return false;
    }
  };

  const handleRoleSelect = (role: string) => {
    setFormData(prev => ({ ...prev, role }));
  };

  const handleTeamSizeSelect = (teamSize: string) => {
    setFormData(prev => ({ ...prev, teamSize }));
  };

  const handleCompanySizeSelect = (companySize: string) => {
    setFormData(prev => ({ ...prev, companySize }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (currentStep === 1) {
      if (!formData.email) {
        showToast.error('Please enter your email address');
        return;
      }
      
      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setEmailError('Please enter a valid email address');
        showToast.error('Please enter a valid email address');
        return;
      }
      
      // Validate email with SendGrid
      const isValid = await validateEmailWithSendGrid(formData.email);
      if (!isValid) {
        return;
      }
      
      setCurrentStep(2);
      return;
    }
    
    if (currentStep === 2) {
      if (!formData.fullName || !formData.password || !formData.confirmPassword || !formData.workspaceName) {
        showToast.error('Please fill in all required fields');
        return;
      }
      
      if (passwordError) {
        showToast.error(passwordError);
        return;
      }
      
      if (formData.password !== formData.confirmPassword) {
        showToast.error('Passwords do not match');
        return;
      }
      
      setCurrentStep(3);
      return;
    }
    
    if (currentStep === 3) {
      if (!formData.role || !formData.teamSize || !formData.companySize) {
        showToast.error('Please complete all selections');
        return;
      }
      
      try {
        // Generate a verification code
        const verificationCode = sendgrid.generateVerificationCode();
        
        // Store verification code and user data (in a real app, this would be in a database)
        // For this example, we'll use localStorage
        localStorage.setItem('pendingRegistration', JSON.stringify({
          userData: formData,
          verificationCode,
          expiresAt: new Date().getTime() + 10 * 60 * 1000 // 10 minutes from now
        }));
        
        // Send verification email
        const emailSent = await sendgrid.sendVerificationEmail(formData.email, verificationCode);
        
        if (emailSent) {
          showToast.success('Verification code sent to your email');
          navigate('/verify-email');
        } else {
          showToast.error('Failed to send verification email. Please try again.');
        }
      } catch (error) {
        console.error('Registration error:', error);
        showToast.error('An error occurred during registration. Please try again.');
      }
    }
  };

  const renderStep1 = () => (
    <>
      <h1 className="text-h3 font-display font-bold text-center mb-8">Welcome to Guardian</h1>
      <div className="mb-6">
        <input
          type="email"
          name="email"
          placeholder="JohnSmith@company.com"
          value={formData.email}
          onChange={handleChange}
          className={`w-full px-4 py-3 rounded-lg border ${emailError ? 'border-error' : 'border-gray-5'} focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all`}
          disabled={isValidatingEmail}
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
      
      <button
        type="submit"
        className="w-full bg-secondary text-white font-semibold py-3 px-4 rounded-lg hover:bg-secondary/90 transition-colors"
        disabled={isValidatingEmail}
      >
        {isValidatingEmail ? 'Validating Email...' : 'Continue'}
      </button>
      
      <div className="mt-8 text-center">
        <p className="text-body-sm">
          Already have an account? <Link to="/login" className="text-secondary font-semibold">Sign In</Link>
        </p>
      </div>
    </>
  );

  const renderStep2 = () => (
    <>
      <h1 className="text-h3 font-display font-bold text-center mb-8">Create your account</h1>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="fullName" className="block text-body-sm font-medium mb-1">Full Name</label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            placeholder="John Smith"
            value={formData.fullName}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-lg border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-body-sm font-medium mb-1">*Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`w-full px-4 py-3 rounded-lg border ${passwordError ? 'border-error' : 'border-gray-5'} focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all`}
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-3 hover:text-gray-1 focus:outline-none"
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
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="block text-body-sm font-medium mb-1">Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`w-full px-4 py-3 rounded-lg border ${passwordError ? 'border-error' : 'border-gray-5'} focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all`}
            />
            <button
              type="button"
              onClick={toggleConfirmPasswordVisibility}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-3 hover:text-gray-1 focus:outline-none"
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
        
        {passwordError && (
          <p className="text-error text-body-sm">
            {passwordError}
          </p>
        )}
        
        <p className="text-error text-body-sm">
          *Password must be at least 12 characters, contain at least one uppercase letter, 
          one lowercase letter, one symbol, and one number.
        </p>
        
        <div>
          <label htmlFor="workspaceName" className="block text-body-sm font-medium mb-1">Workspace Name</label>
          <input
            type="text"
            id="workspaceName"
            name="workspaceName"
            placeholder="Example: Your agency or department"
            value={formData.workspaceName}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-lg border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
          />
        </div>
      </div>
      
      <div className="mt-6">
        <button
          type="submit"
          className="w-full bg-secondary text-white font-semibold py-3 px-4 rounded-lg hover:bg-secondary/90 transition-colors"
        >
          Continue
        </button>
      </div>
    </>
  );

  const renderStep3 = () => (
    <>
      <h1 className="text-h3 font-display font-bold text-center mb-8">Create your account</h1>
      
      <div className="space-y-6">
        <div>
          <p className="text-body-md font-medium mb-2">What best describes your current role?</p>
          <div className="grid grid-cols-2 gap-2">
            {['Executive', 'Supervisor', 'Investigator', 'Officer', 'Analyst', 'Support', 'Other'].map((role) => (
              <button
                key={role}
                type="button"
                className={`flex items-center gap-2 px-4 py-2 rounded-full border ${formData.role === role ? 'border-secondary' : 'border-gray-5'}`}
                onClick={() => handleRoleSelect(role)}
              >
                <div className={`w-4 h-4 rounded-full border ${formData.role === role ? 'border-secondary' : 'border-gray-5'} flex items-center justify-center`}>
                  {formData.role === role && <div className="w-2 h-2 rounded-full bg-secondary"></div>}
                </div>
                <span>{role}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <p className="text-body-md font-medium mb-2">How many people are on your team?</p>
          <div className="grid grid-cols-2 gap-2">
            {['Only me', '2-5', '6-10', '11-15', '16-24', '25-50', '51-100', '101-500'].map((size) => (
              <button
                key={size}
                type="button"
                className={`flex items-center gap-2 px-4 py-2 rounded-full border ${formData.teamSize === size ? 'border-secondary' : 'border-gray-5'}`}
                onClick={() => handleTeamSizeSelect(size)}
              >
                <div className={`w-4 h-4 rounded-full border ${formData.teamSize === size ? 'border-secondary' : 'border-gray-5'} flex items-center justify-center`}>
                  {formData.teamSize === size && <div className="w-2 h-2 rounded-full bg-secondary"></div>}
                </div>
                <span>{size}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <p className="text-body-md font-medium mb-2">How many people work at your company?</p>
          <div className="grid grid-cols-2 gap-2">
            {['1-19', '20-49', '50-99', '100-250', '251-500', '501-1500', '1500+'].map((size) => (
              <button
                key={size}
                type="button"
                className={`flex items-center gap-2 px-4 py-2 rounded-full border ${formData.companySize === size ? 'border-secondary' : 'border-gray-5'}`}
                onClick={() => handleCompanySizeSelect(size)}
              >
                <div className={`w-4 h-4 rounded-full border ${formData.companySize === size ? 'border-secondary' : 'border-gray-5'} flex items-center justify-center`}>
                  {formData.companySize === size && <div className="w-2 h-2 rounded-full bg-secondary"></div>}
                </div>
                <span>{size}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-8 flex justify-between">
        <button
          type="button"
          className="px-6 py-3 rounded-lg border border-gray-5 hover:bg-gray-1 transition-colors"
          onClick={() => setCurrentStep(2)}
        >
          Back
        </button>
        <button
          type="submit"
          className="bg-secondary text-white font-semibold px-6 py-3 rounded-lg hover:bg-secondary/90 transition-colors"
        >
          Continue
        </button>
      </div>
    </>
  );

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

        <form onSubmit={handleSubmit}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
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

export default Register;
