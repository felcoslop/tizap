
import 'dotenv/config';
import nodemailer from 'nodemailer';
import {
    EMAIL_USER, GMAIL_REFRESH_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
    EMAIL_HOST, EMAIL_PORT, EMAIL_PASS
} from './server/config/constants.js';

console.log('--- FINAL EMAIL DEBUG ---');
console.log('USER:', EMAIL_USER);
console.log('REFRESH_TOKEN (Len):', GMAIL_REFRESH_TOKEN ? GMAIL_REFRESH_TOKEN.length : 'MISSING');
console.log('CLIENT_ID (Len):', GOOGLE_CLIENT_ID ? GOOGLE_CLIENT_ID.length : 'MISSING');

const transporterConfig = {};

if (GMAIL_REFRESH_TOKEN && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    console.log('[DEBUG] MODE: OAuth2 (Gmail API)');
    transporterConfig.service = 'gmail';
    transporterConfig.auth = {
        type: 'OAuth2',
        user: EMAIL_USER,
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        refreshToken: GMAIL_REFRESH_TOKEN
    };
} else {
    console.log('[DEBUG] MODE: SMTP (Fallback)');
    transporterConfig.host = EMAIL_HOST;
    transporterConfig.port = parseInt(EMAIL_PORT);
    transporterConfig.secure = transporterConfig.port === 465;
    transporterConfig.auth = { user: EMAIL_USER, pass: EMAIL_PASS };
}

console.log('Transporter Config:', JSON.stringify(transporterConfig, null, 2));

const transporter = nodemailer.createTransport({
    ...transporterConfig,
    tls: { rejectUnauthorized: false }
});

console.log('Attempting to verify connection...');

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ CONNECTION FAILED:', error);
    } else {
        console.log('✅ CONNECTION SUCCESS! Server is ready to send messages.');

        console.log('Attempting to send test email...');
        transporter.sendMail({
            from: `"Debug" <${EMAIL_USER}>`,
            to: EMAIL_USER,
            subject: 'Teste Final de Debug',
            text: 'Se chegou, o código está PERFEITO.'
        }).then(info => {
            console.log('✅ EMAIL SENT:', info.response);
        }).catch(err => {
            console.error('❌ SEND FAILED:', err);
        });
    }
});
