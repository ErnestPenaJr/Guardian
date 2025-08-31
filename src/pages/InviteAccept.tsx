import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { FaEye, FaEyeSlash, FaCheck, FaShieldAlt } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';

export default function InviteAccept() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [completedFields, setCompletedFields] = useState<{[key: string]: boolean}>({});
  const [welcomeAnimationPlayed, setWelcomeAnimationPlayed] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.log('InviteAccept component mounted with token:', token);
    
    // Play welcome animation after a brief delay
    setTimeout(() => setWelcomeAnimationPlayed(true), 300);
  }, [token]);

  const validatePassword = (password: string) => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password);
    const isLongEnough = password.length >= 12;

    return hasUpperCase && hasLowerCase && hasNumber && hasSymbol && isLongEnough;
  };

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 12) strength += 20;
    if (/[A-Z]/.test(password)) strength += 20;
    if (/[a-z]/.test(password)) strength += 20;
    if (/[0-9]/.test(password)) strength += 20;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password)) strength += 20;
    return Math.min(strength, 100);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    
    // Calculate password strength for visual feedback
    const strength = calculatePasswordStrength(newPassword);
    setPasswordStrength(strength);
    
    if (newPassword && !validatePassword(newPassword)) {
      setPasswordError('Password must be at least 12 characters and include at least one uppercase letter, one lowercase letter, one number, and one symbol');
    } else {
      setPasswordError('');
      // Mark field as completed when password is valid
      setCompletedFields(prev => ({...prev, password: validatePassword(newPassword)}));
    }
  };

  const handleFieldComplete = (fieldName: string, value: string) => {
    setCompletedFields(prev => ({
      ...prev,
      [fieldName]: value.trim().length > 0
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate password before submitting
    if (!validatePassword(password)) {
      setPasswordError('Password must be at least 12 characters and include at least one uppercase letter, one lowercase letter, one number, and one symbol');
      return;
    }
    
    setLoading(true);
    
    console.log('Submitting invite acceptance with:', { token, firstName, lastName });
    
    try {
      const response = await axios.post('/api/invite/accept', {
        token,
        firstName,
        lastName,
        password
      });
      
      console.log('Invite acceptance successful:', response.data);
      setSuccess(true);
      // Longer delay to allow celebration animation to play
      setTimeout(() => navigate('/login'), 3500);
    } catch (err: any) {
      console.error('Invite acceptance error:', err);
      // More encouraging error messages
      const errorMessage = err.response?.data?.error || 'Something unexpected happened';
      if (errorMessage.includes('token')) {
        setError('This invitation link has expired or been used. Please contact your administrator for a new invitation.');
      } else if (errorMessage.includes('password')) {
        setError('Password requirements not met. Please ensure your password includes all required elements.');
      } else {
        setError('We encountered a temporary issue. Please try again in a moment - your information has been saved.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
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
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md transform transition-all duration-500 hover:shadow-2xl">
          <div className="text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="absolute inset-0 bg-secondary/20 rounded-full animate-pulse"></div>
                <FaShieldAlt className="w-8 h-8 text-secondary animate-bounce" />
              </div>
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-secondary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-body-md text-gray-2">Preparing your secure workspace...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    console.log('No token found in URL parameters');
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
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md transform transition-all duration-500 hover:shadow-2xl">
          <div className="flex items-center justify-center gap-3 mb-8">
            <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="w-8 h-8" />
            <span className="text-h4 font-display font-bold text-primary">Guardian</span>
          </div>
          
          <div className="text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-warning/10 rounded-full w-16 h-16 mx-auto animate-pulse"></div>
              <div className="text-warning text-2xl mb-4 relative z-10 pt-4">⚠️</div>
            </div>
            <h2 className="text-h3 font-display font-bold mb-4 text-gray-1">Invitation Link Issue</h2>
            <p className="text-body-md text-gray-2 mb-6">Don't worry! This sometimes happens. Please check your email for the correct invitation link, or contact your administrator for assistance.</p>
            
            <Link 
              to="/login" 
              className="inline-block bg-secondary text-white font-semibold py-3 px-6 rounded-lg hover:bg-secondary/90 transition-colors"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  console.log('Rendering InviteAccept component with token:', token);
  
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
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md transform transition-all duration-500 hover:shadow-2xl">
        <div className={`flex items-center justify-center gap-3 mb-8 transition-all duration-700 ${welcomeAnimationPlayed ? 'animate-fade-in' : 'opacity-0 translate-y-4'}`}>
          <div className="relative">
            <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="w-8 h-8 transform transition-transform duration-300 hover:scale-110" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full animate-pulse"></div>
          </div>
          <span className="text-h4 font-display font-bold text-primary">Guardian</span>
          <HiSparkles className="w-5 h-5 text-secondary animate-pulse ml-2" />
        </div>
        
        <div className={`text-center mb-8 transition-all duration-700 delay-200 ${welcomeAnimationPlayed ? 'animate-slide-up' : 'opacity-0 translate-y-6'}`}>
          <h1 className="text-h3 font-display font-bold text-gray-1 mb-2">Welcome to Guardian!</h1>
          <p className="text-body-md text-gray-2">You're just a few steps away from joining your secure workspace</p>
        </div>
        
        {success ? (
          <div className="text-center animate-scale-in">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-success/10 rounded-full w-20 h-20 mx-auto animate-pulse"></div>
              <div className="relative z-10 pt-6">
                <div className="text-success text-3xl mb-2 animate-bounce">🎉</div>
                <FaCheck className="w-8 h-8 text-success mx-auto animate-pulse" />
              </div>
            </div>
            <h2 className="text-h4 font-display font-semibold mb-2 text-gray-1">Welcome to the Team!</h2>
            <p className="text-body-md text-gray-2 mb-4">Your secure Guardian account has been created successfully.</p>
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
              <p className="text-body-sm text-gray-3">Taking you to your dashboard in a moment...</p>
              <div className="w-2 h-2 bg-secondary rounded-full animate-pulse delay-150"></div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={`space-y-6 transition-all duration-700 delay-400 ${welcomeAnimationPlayed ? 'animate-fade-in' : 'opacity-0 translate-y-4'}`}>
            <div className="relative">
              <label htmlFor="firstName" className="block text-body-sm font-medium text-gray-1 mb-2">
                <span className="flex items-center gap-2">
                  First Name
                  {completedFields.firstName && (
                    <FaCheck className="w-3 h-3 text-success animate-pulse" />
                  )}
                </span>
              </label>
              <div className="relative">
                <input 
                  type="text"
                  id="firstName"
                  className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 transform ${
                    focusedField === 'firstName' ? 'scale-[1.02] shadow-lg' : ''
                  } ${
                    completedFields.firstName 
                      ? 'border-success focus:ring-success bg-success/5' 
                      : 'border-gray-5 focus:ring-secondary'
                  }`}
                  value={firstName} 
                  onChange={e => {
                    setFirstName(e.target.value);
                    handleFieldComplete('firstName', e.target.value);
                  }}
                  onFocus={() => setFocusedField('firstName')}
                  onBlur={() => setFocusedField(null)}
                  required 
                  placeholder="What should we call you?"
                  disabled={loading}
                />
                {completedFields.firstName && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="relative">
              <label htmlFor="lastName" className="block text-body-sm font-medium text-gray-1 mb-2">
                <span className="flex items-center gap-2">
                  Last Name
                  {completedFields.lastName && (
                    <FaCheck className="w-3 h-3 text-success animate-pulse" />
                  )}
                </span>
              </label>
              <div className="relative">
                <input 
                  type="text"
                  id="lastName"
                  className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 transform ${
                    focusedField === 'lastName' ? 'scale-[1.02] shadow-lg' : ''
                  } ${
                    completedFields.lastName 
                      ? 'border-success focus:ring-success bg-success/5' 
                      : 'border-gray-5 focus:ring-secondary'
                  }`}
                  value={lastName} 
                  onChange={e => {
                    setLastName(e.target.value);
                    handleFieldComplete('lastName', e.target.value);
                  }}
                  onFocus={() => setFocusedField('lastName')}
                  onBlur={() => setFocusedField(null)}
                  required 
                  placeholder="Your family name"
                  disabled={loading}
                />
                {completedFields.lastName && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="relative">
              <label htmlFor="password" className="block text-body-sm font-medium text-gray-1 mb-2">
                <span className="flex items-center gap-2">
                  Create Your Secure Password
                  {completedFields.password && (
                    <FaCheck className="w-3 h-3 text-success animate-pulse" />
                  )}
                  <FaShieldAlt className="w-3 h-3 text-secondary" />
                </span>
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  id="password"
                  className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 transform pr-12 ${
                    focusedField === 'password' ? 'scale-[1.02] shadow-lg' : ''
                  } ${
                    passwordError 
                      ? 'border-error focus:ring-error' 
                      : completedFields.password 
                        ? 'border-success focus:ring-success bg-success/5'
                        : 'border-gray-5 focus:ring-secondary'
                  }`}
                  value={password} 
                  onChange={handlePasswordChange}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  required 
                  minLength={12}
                  placeholder="Make it strong and memorable!"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-3 hover:text-gray-2 focus:outline-none transition-colors duration-200"
                  tabIndex={-1}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {password && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-body-sm text-gray-2">Password strength:</span>
                    <div className="flex-1 h-2 bg-gray-5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          passwordStrength >= 80 
                            ? 'bg-success' 
                            : passwordStrength >= 60 
                              ? 'bg-warning' 
                              : 'bg-error'
                        }`}
                        style={{ width: `${passwordStrength}%` }}
                      ></div>
                    </div>
                    <span className={`text-body-sm font-medium ${
                      passwordStrength >= 80 
                        ? 'text-success' 
                        : passwordStrength >= 60 
                          ? 'text-warning' 
                          : 'text-error'
                    }`}>
                      {passwordStrength >= 80 ? 'Excellent!' : passwordStrength >= 60 ? 'Good' : 'Needs work'}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="mt-2">
                <p className="text-body-sm text-gray-2">
                  Your password needs: 12+ characters, uppercase, lowercase, number, and symbol
                </p>
                {passwordError && (
                  <p className="text-body-sm text-error mt-2 animate-fade-in">
                    {passwordError.replace('Password must be at least', 'Almost there! Just need')}
                  </p>
                )}
              </div>
            </div>
            
            {error && (
              <div className="p-4 bg-red-50 border border-error/20 text-error rounded-lg animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="text-error text-lg">💡</div>
                  <div className="flex-1">
                    <p className="font-medium mb-1">Let's fix this together:</p>
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            <button 
              type="submit" 
              className={`w-full font-semibold py-4 px-4 rounded-lg transition-all duration-300 transform ${
                loading || !validatePassword(password) || !firstName.trim() || !lastName.trim()
                  ? 'opacity-70 cursor-not-allowed bg-gray-5 text-gray-3 scale-95'
                  : 'bg-secondary text-white hover:bg-secondary/90 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]'
              }`}
              disabled={loading || !validatePassword(password) || !firstName.trim() || !lastName.trim()}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="animate-pulse">Setting up your secure workspace...</span>
                </div>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>Join Your Guardian Team</span>
                  <HiSparkles className="w-4 h-4" />
                </span>
              )}
            </button>
          </form>
        )}
        
        <div className={`mt-8 text-center transition-all duration-700 delay-600 ${welcomeAnimationPlayed ? 'animate-fade-in' : 'opacity-0 translate-y-2'}`}>
          <p className="text-body-sm text-gray-2">
            Already have an account?{' '}
            <Link 
              to="/login" 
              className="text-secondary font-medium hover:underline transition-colors duration-200 hover:text-secondary/80"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}