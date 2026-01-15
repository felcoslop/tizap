import nodemailer from 'nodemailer';
import { EMAIL_USER, EMAIL_PASS } from './constants.js';

const transporterConfig = process.env.EMAIL_SERVICE
    ? { service: process.env.EMAIL_SERVICE }
    : {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '465'), // Default to SSL port for DO
        secure: (process.env.EMAIL_PORT || '465') === '465', // Port 465 requires SSL
    };

const transporter = nodemailer.createTransport({
    ...transporterConfig,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
});

export default transporter;
