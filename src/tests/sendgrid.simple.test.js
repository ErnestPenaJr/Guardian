// Simple SendGrid email test (JavaScript, CommonJS)
const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SENDGRID_API_KEY = process.env.VITE_SENDGRID_API_KEY;
const TO_EMAIL = 'ernest@shieldlytics.com';

if (!SENDGRID_API_KEY) {
  console.error('❌ SendGrid API key is not set.');
  process.exit(1);
}

sgMail.setApiKey(SENDGRID_API_KEY);

const msg = {
  to: TO_EMAIL,
  from: 'support@shieldlytics.com', // Use your verified sender
  subject: 'Test Email from Guardian MVP',
  text: 'This is a simple test email sent from the Guardian MVP project.',
  html: '<strong>This is a simple test email sent from the Guardian MVP project.</strong>'
};

sgMail
  .send(msg)
  .then(() => {
    console.log('✅ Test email sent successfully to', TO_EMAIL);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to send test email:', error);
    process.exit(1);
  });
