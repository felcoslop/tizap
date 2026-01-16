
import 'dotenv/config';
import nodemailer from 'nodemailer';
import { EMAIL_USER, EMAIL_PASS } from './server/config/constants.js';

console.log('--- SMTP FORCE TEST ---');
console.log('USER:', EMAIL_USER);
console.log('PASS (Len):', EMAIL_PASS ? EMAIL_PASS.length : 'MISSING');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS // Using the App Password cyeq scjz...
    },
    tls: { rejectUnauthorized: false }
});

console.log('Verifying SMTP connection...');

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ SMTP FAILED:', error);
    } else {
        console.log('✅ SMTP SUCCESS! App Password works.');
    }
});
