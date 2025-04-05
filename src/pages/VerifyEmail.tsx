import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../utils/toast';
import sendgrid from '../utils/sendgrid';

function VerifyEmail() {
  const navigate = useNavigate();
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState('');
  const [expiryTime, setExpiryTime] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // Initialize refs array and get registration data
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6);
    
    // Get pending registration data from localStorage
    const pendingRegistration = localStorage.getItem('pendingRegistration');
    if (pendingRegistration) {
      try {
        const data = JSON.parse(pendingRegistration);
        
        // Check if verification code has expired
        if (sendgrid.isVerificationCodeExpired(data.expiresAt)) {
          showToast.error('Verification code has expired. Please register again.');
          navigate('/register');
          return;
        }
        
        setEmail(data.userData.email);
        setExpiryTime(new Date(data.expiresAt));
      } catch (error) {
        console.error('Error parsing pending registration:', error);
        showToast.error('An error occurred. Please register again.');
        navigate('/register');
      }
    } else {
      // No pending registration found, redirect to registration
      showToast.error('No pending registration found. Please register first.');
      navigate('/register');
    }
  }, [navigate]);
  
  // Update timer every second
  useEffect(() => {
    if (!expiryTime) return;
    
    const updateTimeRemaining = () => {
      const now = new Date();
      const diffMs = expiryTime.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        setTimeRemaining('Expired');
        showToast.error('Verification code has expired. Please request a new one.');
        return;
      }
      
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);
      setTimeRemaining(`${diffMins}:${diffSecs < 10 ? '0' : ''}${diffSecs}`);
    };
    
    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);
    
    return () => clearInterval(interval);
  }, [expiryTime]);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.charAt(0);
    }
    
    // Update the code array
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    
    // Auto-focus next input if value is entered
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit if all fields are filled
    if (value && index === 5 && newCode.every(digit => digit)) {
      setTimeout(() => {
        handleSubmit(new Event('submit') as any);
      }, 300);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    
    // If pasted data is a 6-digit code
    if (/^\d{6}$/.test(pastedData)) {
      const newCode = pastedData.split('');
      setVerificationCode(newCode);
      
      // Focus the last input
      inputRefs.current[5]?.focus();
      
      // Auto-submit after a short delay
      setTimeout(() => {
        handleSubmit(new Event('submit') as any);
      }, 300);
    }
  };

  const handleResendCode = async () => {
    if (isResending || !email) return;
    
    setIsResending(true);
    try {
      // Get the pending registration data
      const pendingRegistration = localStorage.getItem('pendingRegistration');
      if (!pendingRegistration) {
        showToast.error('No pending registration found. Please register again.');
        navigate('/register');
        return;
      }
      
      const data = JSON.parse(pendingRegistration);
      
      // Check if the existing code is still valid
      if (!sendgrid.isVerificationCodeExpired(data.expiresAt)) {
        // If code is still valid, resend the same code
        const emailSent = await sendgrid.sendVerificationEmail(email, data.verificationCode);
        
        if (emailSent) {
          showToast.success('Verification code resent to your email');
          setExpiryTime(new Date(data.expiresAt));
        } else {
          showToast.error('Failed to resend verification code. Please try again.');
        }
      } else {
        // If code has expired, generate a new one
        const { code: newVerificationCode, expiresAt } = sendgrid.getOrCreateVerificationCode();
        
        // Update the stored verification code
        data.verificationCode = newVerificationCode;
        data.expiresAt = expiresAt;
        localStorage.setItem('pendingRegistration', JSON.stringify(data));
        
        // Send the new verification code
        const emailSent = await sendgrid.sendVerificationEmail(email, newVerificationCode);
        
        if (emailSent) {
          showToast.success('New verification code sent to your email');
          setExpiryTime(new Date(expiresAt));
        } else {
          showToast.error('Failed to send new verification code. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error resending verification code:', error);
      showToast.error('An error occurred while resending the verification code.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if all fields are filled
    if (verificationCode.some(digit => !digit)) {
      showToast.error('Please enter the complete verification code');
      return;
    }
    
    // Get the entered code
    const enteredCode = verificationCode.join('');
    
    // Get the stored verification code
    const pendingRegistration = localStorage.getItem('pendingRegistration');
    if (!pendingRegistration) {
      showToast.error('No pending registration found. Please register again.');
      navigate('/register');
      return;
    }
    
    try {
      const data = JSON.parse(pendingRegistration);
      
      // Check if verification code has expired
      if (sendgrid.isVerificationCodeExpired(data.expiresAt)) {
        showToast.error('Verification code has expired. Please request a new one.');
        return;
      }
      
      // Verify the code
      if (enteredCode === data.verificationCode) {
        // Code is correct, proceed with registration
        showToast.success('Email verified successfully');
        
        // In a real application, you would make an API call here to create the user account
        // For this example, we'll just simulate a successful registration
        
        // Clear the pending registration data
        localStorage.removeItem('pendingRegistration');
        
        // Redirect to dashboard or login page
        navigate('/dashboard');
      } else {
        showToast.error('Invalid verification code. Please try again.');
        // Clear the verification code fields
        setVerificationCode(['', '', '', '', '', '']);
        // Focus the first input
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      showToast.error('An error occurred during verification. Please try again.');
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
        <h1 className="text-h3 font-display font-bold text-center mb-4">Verify E-mail</h1>
        
        <p className="text-center text-body-md mb-2">
          A verification code was sent to <span className="font-semibold">{email}</span>
        </p>
        
        <p className="text-center text-body-md mb-6">
          Please enter the verification code to complete registration.
        </p>
        
        {timeRemaining && (
          <p className="text-center text-body-sm text-secondary font-semibold mb-4">
            Code expires in: {timeRemaining}
          </p>
        )}
        
        <p className="text-center text-body-sm text-gray-3 mb-8">
          If an e-mail is not received, check your spam folder or
          <br />resend a verification code.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-8">
            <label className="block text-center text-body-md font-medium mb-4">Verification Code</label>
            <div className="flex justify-center gap-2">
              {verificationCode.map((digit, index) => (
                <input
                  key={index}
                  ref={el => inputRefs.current[index] = el}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleCodeChange(index, e.target.value)}
                  onKeyDown={e => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  className="w-12 h-16 text-center text-h4 border border-gray-5 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                />
              ))}
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleResendCode}
            className="w-full border border-gray-5 text-primary font-semibold py-3 px-4 rounded-lg hover:bg-gray-1 transition-colors mb-4"
            disabled={isResending}
          >
            {isResending ? 'Resending...' : 'Resend Verification Code'}
          </button>
          
          <button
            type="submit"
            className="w-full bg-secondary text-white font-semibold py-3 px-4 rounded-lg hover:bg-secondary/90 transition-colors"
          >
            Verify
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
}

export default VerifyEmail;
