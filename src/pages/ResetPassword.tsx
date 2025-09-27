import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Eye, EyeOff } from 'lucide-react';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { email, verified, verificationCode } = location.state || {};
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Check if user is verified
    if (!verified) {
      navigate('/forgot-password');
      return;
    }
    
    // Check if email is provided
    if (!email) {
      navigate('/forgot-password');
      return;
    }
    
    // Check if there's a pending password reset
    const passwordResetData = localStorage.getItem('passwordResetData');
    
    if (!passwordResetData) {
      navigate('/forgot-password');
      return;
    }
    
    try {
      const resetData = JSON.parse(passwordResetData);
      
      // Check if the email matches
      if (resetData.email !== email) {
        navigate('/forgot-password');
        return;
      }
    } catch (error) {
      console.error('Error parsing password reset data:', error);
      navigate('/forgot-password');
    }
  }, [navigate, email, verified]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      // Validate form data
      if (!formData.password || !formData.confirmPassword) {
        setError('Please fill in all required fields');
        Swal.fire({
          icon: 'error',
          title: 'Missing Fields',
          text: 'Please fill in all required fields.',
          confirmButtonColor: '#0D9488'
        });
        setIsLoading(false);
        return;
      }
      if (passwordError) {
        setError(passwordError);
        Swal.fire({
          icon: 'error',
          title: 'Invalid Password',
          text: passwordError,
          confirmButtonColor: '#0D9488'
        });
        setIsLoading(false);
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        Swal.fire({
          icon: 'error',
          title: 'Password Mismatch',
          text: 'Passwords do not match.',
          confirmButtonColor: '#0D9488'
        });
        setIsLoading(false);
        return;
      }
      // Get the pending password reset data
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
      
      // Use the verification code from the navigation state if available
      const codeToUse = verificationCode || data.verificationCode;
      
      // Log the data being sent to the server for debugging
      console.log('Reset password data:', {
        email: data.email,
        code: codeToUse,
        newPassword: formData.password
      });
      
      // Ensure all required fields are present
      if (!data.email || !codeToUse || !formData.password) {
        console.error('Missing required fields for password reset:', {
          email: !!data.email,
          code: !!codeToUse,
          newPassword: !!formData.password
        });
        
        setError('Missing required fields for password reset');
        Swal.fire({
          icon: 'error',
          title: 'Missing Information',
          text: 'Some required information is missing. Please try requesting a new password reset.',
          confirmButtonColor: '#0D9488'
        });
        setIsLoading(false);
        return;
      }
      
      // Call backend to reset password
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          code: codeToUse,
          newPassword: formData.password
        })
      });
      const respData = await response.json();
      if (response.ok && respData.success) {
        Swal.fire({
          icon: 'success',
          title: 'Password Reset Successful',
          text: 'Your password has been reset successfully. You may now log in.',
          confirmButtonText: 'Sign In',
          confirmButtonColor: '#0D9488',
          allowOutsideClick: false,
          customClass: {
            title: 'text-h4 font-display font-bold',
            htmlContainer: 'text-body-md text-gray-1',
            confirmButton: 'font-semibold'
          }
        }).then(() => {
          navigate('/login');
        });
      } else if (respData.error) {
        Swal.fire({
          icon: 'error',
          title: 'Password Reset Failed',
          text: respData.error,
          confirmButtonColor: '#0D9488'
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Password Reset Failed',
          text: 'An error occurred while resetting your password. Please try again.',
          confirmButtonColor: '#0D9488'
        });
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setError('An error occurred while resetting your password. Please try again.');
      Swal.fire({
        icon: 'error',
        title: 'Reset Error',
        text: 'An error occurred while resetting your password. Please try again.',
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

        <h1 className="text-h3 font-display font-bold text-center mb-2">Reset Password</h1>
        <p className="text-center text-gray-2 mb-8">
          Create a new password for your account.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-body-sm font-medium text-gray-1 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder="Enter your new password"
                value={formData.password}
                onChange={handlePasswordChange}
                className={`w-full px-4 py-3 rounded-lg border ${passwordError ? 'border-error' : 'border-gray-5'} focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all pr-10`}
                disabled={isLoading}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {passwordError && (
              <p className="text-error text-body-sm mt-1">
                {passwordError}
              </p>
            )}
            <div className="mt-2">
              <p className="text-body-sm text-gray-2">Password must:</p>
              <ul className="text-body-sm text-gray-2 list-disc pl-5 space-y-1 mt-1">
                <li className={formData.password.length >= 12 ? 'text-success' : ''}>Be at least 12 characters long</li>
                <li className={/[A-Z]/.test(formData.password) ? 'text-success' : ''}>Include at least one uppercase letter</li>
                <li className={/[a-z]/.test(formData.password) ? 'text-success' : ''}>Include at least one lowercase letter</li>
                <li className={/[0-9]/.test(formData.password) ? 'text-success' : ''}>Include at least one number</li>
                <li className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(formData.password) ? 'text-success' : ''}>Include at least one symbol</li>
              </ul>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-body-sm font-medium text-gray-1 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                placeholder="Confirm your new password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className={`w-full px-4 py-3 rounded-lg border ${formData.password !== formData.confirmPassword && formData.confirmPassword ? 'border-error' : 'border-gray-5'} focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all pr-10`}
                disabled={isLoading}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-3"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {formData.password !== formData.confirmPassword && formData.confirmPassword && (
              <p className="text-error text-body-sm mt-1">
                Passwords do not match
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
            className="w-full bg-secondary text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            style={{ backgroundColor: '#2EBCBC' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#24A5A5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2EBCBC'}
            disabled={isLoading || !!passwordError || formData.password !== formData.confirmPassword || !formData.password || !formData.confirmPassword}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Resetting Password...
              </div>
            ) : (
              'Reset Password'
            )}
          </button>
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

export default ResetPassword;
