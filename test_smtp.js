
const nodemailer = require('nodemailer');

const recipient = 'xmitox@Live.com'; // Use the address from the log that failed

// Try to load env from .env file for local testing
require('dotenv').config();

const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = process.env.EMAIL_PORT || 587;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS || process.env.GMAIL_REFRESH_TOKEN; // Fallback or distinct var

console.log('--- SMTP Connectivity Test ---');
console.log(`Host: ${EMAIL_HOST}`);
console.log(`Port: ${EMAIL_PORT}`);
console.log(`User: ${EMAIL_USER}`);
console.log(`Pass: ${EMAIL_PASS ? '******' : 'MISSING'}`);

if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('ERROR: EMAIL_USER or EMAIL_PASS not set within process.env');
    // Assuming this script might be run where .env isn't loaded automatically by the app logic
    console.log('Ensure you are running this in an environment where these variables are set, or edit the script to hardcode them for testing (DO NOT COMMIT HARDCODED CREDENTIALS).');
    process.exit(1);
}

const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: parseInt(EMAIL_PORT),
    secure: parseInt(EMAIL_PORT) === 465, // true for 465, false for other ports
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
    },
    // Debug settings
    logger: true,
    debug: true,
    connectionTimeout: 10000, // 10s
    greetingTimeout: 10000,
    socketTimeout: 10000
});

console.log('Attempting to verify connection configuration...');

transporter.verify(function (error, success) {
    if (error) {
        console.error('VERIFY ERROR:', error);
        console.log('\nSUGGESTION: If "Connection timeout", check if port 587 or 465 is blocked by your hosting/container provider.');
        console.log('SUGGESTION: If "Invalid login", check your app password.');
    } else {
        console.log('Server is ready to take our messages');

        console.log(`Sending test email to ${recipient}...`);
        transporter.sendMail({
            from: `"Test Script" <${EMAIL_USER}>`,
            to: recipient,
            subject: 'SMTP Connectivity Test',
            text: 'If you receive this, the connection is working!',
            html: '<b>If you receive this, the connection is working!</b>'
        }, (err, info) => {
            if (err) {
                console.error('SEND ERROR:', err);
            } else {
                console.log('Message sent: %s', info.messageId);
                console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            }
        });
    }
});
