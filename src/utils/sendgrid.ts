import client from '@sendgrid/client';

// Initialize SendGrid client with API key from environment variables
const SENDGRID_API_KEY = import.meta.env.VITE_SENDGRID_API_KEY || '';
client.setApiKey(SENDGRID_API_KEY);

/**
 * Validates an email address using SendGrid's Email Validation API
 * @param email - The email address to validate
 * @returns Object containing validation results
 */
export const validateEmail = async (email: string): Promise<{
  isValid: boolean;
  reason?: string;
}> => {
  try {
    // SendGrid Email Validation API endpoint
    const request = {
      url: '/v3/validations/email',
      method: 'POST' as const,
      body: {
        email,
        source: 'Guardian MVP'
      }
    };

    const [response] = await client.request(request);
    const data = response.body as any;

    // Check if the email is valid based on SendGrid's response
    if (response.statusCode === 200) {
      // Determine if the email is valid based on SendGrid's verdict
      const isValid = data.result.verdict === 'Valid';
      let reason = '';

      if (!isValid) {
        // Provide a reason why the email is invalid
        if (data.result.verdict === 'Risky') {
          reason = 'This email address appears to be risky or suspicious.';
        } else if (data.result.verdict === 'Invalid') {
          reason = 'This email address is invalid.';
        } else {
          reason = 'This email address cannot be validated.';
        }
      }

      return {
        isValid,
        reason
      };
    } else {
      console.error('SendGrid validation error:', response.body);
      return {
        isValid: false,
        reason: 'Unable to validate email at this time.'
      };
    }
  } catch (error) {
    console.error('Error validating email with SendGrid:', error);
    return {
      isValid: false,
      reason: 'An error occurred during email validation.'
    };
  }
};

/**
 * Sends a verification code email to the user
 * @param email - Recipient email address
 * @param verificationCode - The verification code to send
 * @returns Boolean indicating if the email was sent successfully
 */
export const sendVerificationEmail = async (
  email: string,
  verificationCode: string
): Promise<boolean> => {
  try {
    const sgMail = await import('@sendgrid/mail');
    sgMail.default.setApiKey(SENDGRID_API_KEY);

    const msg = {
      to: email,
      from: 'noreply@guardian-mvp.com', // Change to your verified sender
      subject: 'Verify Your Guardian Account',
      text: `Your verification code is: ${verificationCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verify Your Guardian Account</h2>
          <p>Thank you for registering with Guardian. Please use the following verification code to complete your registration:</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
            ${verificationCode}
          </div>
          <p style="margin-top: 20px;">This code will expire in 10 minutes.</p>
          <p>If you did not request this verification, please ignore this email.</p>
        </div>
      `
    };

    await sgMail.default.send(msg);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
};

/**
 * Generates a random 6-digit verification code
 * @returns A 6-digit verification code as a string
 */
export const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export default {
  validateEmail,
  sendVerificationEmail,
  generateVerificationCode
};
