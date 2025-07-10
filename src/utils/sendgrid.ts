import axios from 'axios';

// Constants
export const VERIFICATION_CODE_EXPIRY = 15 * 60 * 1000; // 15 minutes in milliseconds

// API endpoints
const API_BASE_URL = '/api';
const VALIDATE_EMAIL_ENDPOINT = `${API_BASE_URL}/validate-email`;
const SEND_VERIFICATION_EMAIL_ENDPOINT = `${API_BASE_URL}/send-verification-email`;

// Store the latest verification code for reference
let latestVerificationCode = '';

/**
 * Validates an email address using basic regex
 * @param email - The email address to validate
 * @returns Boolean indicating if the email format is valid
 */
export const validateEmailFormat = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates an email address using SendGrid's Email Validation API
 * @param email - The email address to validate
 * @param purpose - The purpose of validation ('register' or 'reset')
 * @returns Object containing validation result and reason if invalid
 */
export const validateEmail = async (
  email: string,
  purpose: 'register' | 'reset' = 'register'
): Promise<{ valid: boolean; reason?: string }> => {
  try {
    // Call our backend API to validate the email
    const response = await axios.post(VALIDATE_EMAIL_ENDPOINT, { email, purpose });
    return response.data;
  } catch (error: any) {
    console.error('Error validating email:', error);
    
    // Fall back to basic validation if API call fails
    const isValid = validateEmailFormat(email);
    
    return {
      valid: isValid,
      reason: isValid ? 'API error, but format is valid' : 'Invalid email format'
    };
  }
};

/**
 * Generates a random verification code
 * @returns A 6-digit verification code
 */
export const generateVerificationCode = (): string => {
  // Generate a random 6-digit number
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Sends a verification code email to the user using SendGrid
 * @param email - Recipient email address
 * @param verificationCode - The verification code to send
 * @returns Boolean indicating if the email was sent successfully
 */
export const sendVerificationEmail = async (
  email: string,
  verificationCode: string
): Promise<boolean> => {
  try {
    // Store the latest verification code for reference
    latestVerificationCode = verificationCode;
    
    // Log the verification code for debugging
    console.log('Sending verification code to:', email, 'Code:', verificationCode);
    
    // Call our backend API to send the verification email
    const response = await axios.post(SEND_VERIFICATION_EMAIL_ENDPOINT, {
      email,
      verificationCode
    });
    
    return response.data.success;
  } catch (error: any) {
    console.error('Error sending verification email:', error);
    return false;
  }
};

/**
 * Checks if a verification code has expired
 * @param expiryTime - The expiry time of the verification code
 * @returns Boolean indicating if the code has expired
 */
export const isVerificationCodeExpired = (expiryTime: string): boolean => {
  const expiry = new Date(expiryTime).getTime();
  const now = new Date().getTime();
  return now > expiry;
};

/**
 * Gets or creates a verification code
 * @returns Object containing the code, expiry time, and whether it's new
 */
export const getOrCreateVerificationCode = (): {
  code: string;
  expiryTime: string;
  isNew: boolean;
} => {
  try {
    const registrationData = localStorage.getItem('registrationData');
    
    if (registrationData) {
      const data = JSON.parse(registrationData);
      
      // Check if there's an existing verification code that hasn't expired
      if (
        data.verificationCode &&
        data.expiryTime &&
        !isVerificationCodeExpired(data.expiryTime)
      ) {
        return {
          code: data.verificationCode,
          expiryTime: data.expiryTime,
          isNew: false
        };
      }
    }
    
    // Generate a new verification code
    const code = generateVerificationCode();
    const expiryTime = new Date(Date.now() + VERIFICATION_CODE_EXPIRY).toISOString();
    
    return {
      code,
      expiryTime,
      isNew: true
    };
  } catch (error: any) {
    console.error('Error parsing registration data:', error);
    
    // Generate a new verification code as fallback
    const code = generateVerificationCode();
    const expiryTime = new Date(Date.now() + VERIFICATION_CODE_EXPIRY).toISOString();
    
    return {
      code,
      expiryTime,
      isNew: true
    };
  }
};

/**
 * Gets the latest verification code
 * @returns The latest verification code
 */
export const getLatestVerificationCode = (): string => {
  return latestVerificationCode;
};

export default {
  validateEmail,
  validateEmailFormat,
  sendVerificationEmail,
  generateVerificationCode,
  isVerificationCodeExpired,
  getOrCreateVerificationCode,
  getLatestVerificationCode,
  VERIFICATION_CODE_EXPIRY
};
