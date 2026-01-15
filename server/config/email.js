import nodemailer from 'nodemailer';
import { EMAIL_USER, EMAIL_PASS } from './constants.js';

const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
const port = parseInt(process.env.EMAIL_PORT || '587'); // 587 is often more reliable on DO
const secure = port === 465;

console.log('[MAIL CONFIG] Attempting connection to:', host, 'on port:', port, '(Secure:', secure, ')');
console.log('[MAIL CONFIG] User:', EMAIL_USER ? 'Configured' : 'MISSING');

const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
    },
    logger: true, // Log to console
    debug: true,  // Include debug output
    connectionTimeout: 20000,
    greetingTimeout: 20000,
});

export default transporter;
