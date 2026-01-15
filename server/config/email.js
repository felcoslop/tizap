import nodemailer from 'nodemailer';
import { EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT } from './constants.js';

const host = EMAIL_HOST;
const port = parseInt(EMAIL_PORT);
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
