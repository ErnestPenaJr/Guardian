import { test, expect } from "bun:test";
import { Resend } from 'resend';

test("Send direct test email using Resend", async () => {
  console.log("🚀 Testing direct email send to epenajr@gmail.com");
  
  // Get email configuration from environment
  const RESEND_API_KEY = process.env.SMTP_PASSWORD; // Using SMTP_PASSWORD from .env which contains Resend API key
  const EMAIL_FROM = process.env.EMAIL_FROM || 'support@shieldlytics.com';
  
  console.log("Email from:", EMAIL_FROM);
  console.log("Has API key:", !!RESEND_API_KEY);
  
  if (!RESEND_API_KEY) {
    console.log("❌ No Resend API key found");
    expect(true).toBe(true); // Skip test if no API key
    return;
  }
  
  // Initialize Resend client
  const resend = new Resend(RESEND_API_KEY);
  
  try {
    // Send test invite email
    const { data, error } = await resend.emails.send({
      from: `Shieldlytics <${EMAIL_FROM}>`,
      to: ['epenajr@gmail.com'],
      subject: 'Test Invite - Guardian MVP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <h2 style="color: #333; text-align: center; margin-bottom: 30px;">Test Invitation to Guardian</h2>
          <p style="font-size: 16px; line-height: 1.5; color: #666;">
            Hello! This is a test email from the Guardian MVP application.
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #666;">
            This email was sent as part of testing the invite functionality.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="http://localhost:3001" style="background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Visit Guardian
            </a>
          </div>
          <p style="font-size: 14px; color: #999; text-align: center;">
            This is a test message from Guardian MVP
          </p>
        </div>
      `,
      text: `
        Test Invitation to Guardian

        Hello! This is a test email from the Guardian MVP application.
        
        This email was sent as part of testing the invite functionality.
        
        Visit Guardian at: http://localhost:3001
        
        This is a test message from Guardian MVP
      `
    });
    
    if (error) {
      console.error("❌ Email send error:", error);
      expect(false).toBe(true); // Fail test if email failed to send
    } else {
      console.log("✅ Email sent successfully!");
      console.log("Email ID:", data?.id);
      expect(data?.id).toBeDefined();
    }
    
  } catch (error) {
    console.error("❌ Exception:", error);
    expect(false).toBe(true); // Fail test if exception occurred
  }
  
  console.log("🎉 Test completed!");
});