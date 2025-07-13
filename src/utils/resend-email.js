import { Resend } from 'resend';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const resend = new Resend(process.env.SMTP_PASSWORD); // Resend API key
const FROM_EMAIL = process.env.EMAIL_FROM || 'support@shieldlytics.com';

/**
 * Sends a verification code email using Resend
 * @param {string} email - Recipient email address
 * @param {string} verificationCode - The verification code to send
 * @returns {Promise<boolean>} - Success status
 */
export async function sendVerificationEmail(email, verificationCode) {
  try {
    console.log(`📧 Sending verification email to: ${email}`);
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: 'Verify Your Guardian Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #0D9488; margin: 0;">Guardian</h1>
          </div>
          
          <h2 style="color: #333; text-align: center;">Verify Your Email Address</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.5;">
            Thank you for registering with Guardian. Please use the following verification code to complete your registration:
          </p>
          
          <div style="background-color: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0D9488; font-family: monospace;">
              ${verificationCode}
            </div>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            This verification code will expire in 30 minutes for security reasons.
          </p>
          
          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            If you did not request this verification code, please ignore this email or contact our support team.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            This email was sent from Guardian. Please do not reply to this email.
          </p>
        </div>
      `,
      text: `Your Guardian verification code is: ${verificationCode}. This code will expire in 30 minutes.`
    });

    if (error) {
      console.error('❌ Resend error:', error);
      return false;
    }

    console.log('✅ Verification email sent successfully:', data.id);
    return true;
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    return false;
  }
}

/**
 * Sends an invite email using Resend
 * @param {string} email - Recipient email address
 * @param {string} token - The invite token
 * @param {string} roleName - The role name
 * @returns {Promise<boolean>} - Success status
 */
export async function sendInviteEmail(email, token, roleName = 'User') {
  try {
    console.log(`📧 Sending invite email to: ${email}`);
    
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5175'}/invite/accept?token=${token}`;
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: 'You\'ve been invited to join Guardian',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #0D9488; margin: 0;">Guardian</h1>
          </div>
          
          <h2 style="color: #333; text-align: center;">You've been invited to join Guardian</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.5;">
            You have been invited to join Guardian as a <strong>${roleName}</strong>. Click the button below to accept your invitation and set up your account.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background-color: #0D9488; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            Or copy and paste this link into your browser:
          </p>
          <p style="color: #0D9488; font-size: 14px; word-break: break-all;">
            ${inviteUrl}
          </p>
          
          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            This invitation will expire in 7 days. If you did not expect this invitation, please ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            This email was sent from Guardian. Please do not reply to this email.
          </p>
        </div>
      `,
      text: `You've been invited to join Guardian as a ${roleName}. Click this link to accept: ${inviteUrl}`
    });

    if (error) {
      console.error('❌ Resend error:', error);
      return false;
    }

    console.log('✅ Invite email sent successfully:', data.id);
    return true;
  } catch (error) {
    console.error('❌ Error sending invite email:', error);
    return false;
  }
}

export default {
  sendVerificationEmail,
  sendInviteEmail
};