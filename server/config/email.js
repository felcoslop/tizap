import nodemailer from 'nodemailer';
import { EMAIL_USER, EMAIL_PASS } from './constants.js';

const isGmail = (process.env.EMAIL_HOST || 'smtp.gmail.com') === 'smtp.gmail.com';

const transporterConfig = process.env.EMAIL_SERVICE
    ? { service: process.env.EMAIL_SERVICE }
    : isGmail
        ? { service: 'gmail' }
        : {
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT || '465'),
            secure: (process.env.EMAIL_PORT || '465') === '465',
        };

console.log('[MAIL CONFIG] Host:', process.env.EMAIL_HOST || 'smtp.gmail.com');
console.log('[MAIL CONFIG] Port:', process.env.EMAIL_PORT || '465');
console.log('[MAIL CONFIG] User:', EMAIL_USER ? 'Configured' : 'MISSING');
console.log('[MAIL CONFIG] Pass:', EMAIL_PASS ? 'Configured' : 'MISSING');

const transporter = nodemailer.createTransport({
    ...transporterConfig,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
});

export default transporter;
