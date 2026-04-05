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
            Secure password reset process.
          </p>

          {/* Reset flow steps */}
          <div className="space-y-4">
            {[
              { step: '1', text: 'Enter your email address', active: false, done: true },
              { step: '2', text: 'Verify your code', active: false, done: true },
              { step: '3', text: 'Create new password', active: true, done: false },
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

          <h1 className="font-display font-bold text-[30px] text-[#032424]">Create new password</h1>
          <p className="text-[15px] text-gray-500 mt-1 mb-8">
            Choose a strong password for your account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-[14px] font-medium text-gray-600 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="Enter your new password"
                  value={formData.password}
                  onChange={handlePasswordChange}
                  className={`w-full px-4 py-3.5 border-[1.5px] rounded-[10px] text-[16px] text-[#032424] placeholder:text-gray-400 outline-none transition-all pr-12 ${
                    passwordError ? 'border-red-400 focus:border-red-400 focus:ring-[3px] focus:ring-red-400/10' : 'border-gray-200 focus:border-[#2EBCBC] focus:ring-[3px] focus:ring-[#2EBCBC]/10'
                  }`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError && (
                <p className="text-[12px] text-red-500 mt-1">{passwordError}</p>
              )}
              <div className="mt-3 space-y-1.5">
                <p className="text-[13px] text-gray-400">Password must:</p>
                <ul className="space-y-1">
                  <li className={`text-[13px] flex items-center gap-2 ${formData.password.length >= 12 ? 'text-green-500' : 'text-gray-400'}`}>
                    <span className="text-[11px]">{formData.password.length >= 12 ? '\u2713' : '\u2022'}</span>
                    Be at least 12 characters long
                  </li>
                  <li className={`text-[13px] flex items-center gap-2 ${/[A-Z]/.test(formData.password) ? 'text-green-500' : 'text-gray-400'}`}>
                    <span className="text-[11px]">{/[A-Z]/.test(formData.password) ? '\u2713' : '\u2022'}</span>
                    Include at least one uppercase letter
                  </li>
                  <li className={`text-[13px] flex items-center gap-2 ${/[a-z]/.test(formData.password) ? 'text-green-500' : 'text-gray-400'}`}>
                    <span className="text-[11px]">{/[a-z]/.test(formData.password) ? '\u2713' : '\u2022'}</span>
                    Include at least one lowercase letter
                  </li>
                  <li className={`text-[13px] flex items-center gap-2 ${/[0-9]/.test(formData.password) ? 'text-green-500' : 'text-gray-400'}`}>
                    <span className="text-[11px]">{/[0-9]/.test(formData.password) ? '\u2713' : '\u2022'}</span>
                    Include at least one number
                  </li>
                  <li className={`text-[13px] flex items-center gap-2 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(formData.password) ? 'text-green-500' : 'text-gray-400'}`}>
                    <span className="text-[11px]">{/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(formData.password) ? '\u2713' : '\u2022'}</span>
                    Include at least one symbol
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-[14px] font-medium text-gray-600 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  placeholder="Confirm your new password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={`w-full px-4 py-3.5 border-[1.5px] rounded-[10px] text-[16px] text-[#032424] placeholder:text-gray-400 outline-none transition-all pr-12 ${
                    formData.password !== formData.confirmPassword && formData.confirmPassword
                      ? 'border-red-400 focus:border-red-400 focus:ring-[3px] focus:ring-red-400/10'
                      : 'border-gray-200 focus:border-[#2EBCBC] focus:ring-[3px] focus:ring-[#2EBCBC]/10'
                  }`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {formData.password !== formData.confirmPassword && formData.confirmPassword && (
                <p className="text-[12px] text-red-500 mt-1">
                  Passwords do not match
                </p>
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
      </div>
    </div>
  );
};

export default ResetPassword;
