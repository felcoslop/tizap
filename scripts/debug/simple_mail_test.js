
import 'dotenv/config';
import nodemailer from 'nodemailer';

console.log('--- ENV VARS DEBUG ---');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('GMAIL_REFRESH_TOKEN:', process.env.GMAIL_REFRESH_TOKEN ? 'EXISTS Length: ' + process.env.GMAIL_REFRESH_TOKEN.length : 'UNDEFINED');
console.log('CLIENT_ID:', process.env.CLIENT_ID ? 'EXISTS' : 'UNDEFINED');
console.log('CLIENT_SECRET:', process.env.CLIENT_SECRET ? 'EXISTS' : 'UNDEFINED');
console.log('----------------------');

const EMAIL_USER_VAR = process.env.EMAIL_USER;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const GOOGLE_CLIENT_ID = process.env.CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.CLIENT_SECRET;

const transporterConfig = {};

if (GMAIL_REFRESH_TOKEN && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    console.log('[MAIL] Configuring Gmail API (OAuth2)');
    transporterConfig.service = 'gmail';
    transporterConfig.auth = {
        type: 'OAuth2',
        user: EMAIL_USER_VAR,
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        refreshToken: GMAIL_REFRESH_TOKEN
    };
} else {
    console.log('[MAIL] Fallback to SMTP (FAIL for OAuth2)');
}

console.log('Config:', transporterConfig);

if (transporterConfig.service === 'gmail') {
    const transporter = nodemailer.createTransport(transporterConfig);
    transporter.verify(function (error, success) {
        if (error) {
            console.log('Transporter Verify Error:', error);
        } else {
            console.log('Server is ready to take our messages');
        }
    });
}
