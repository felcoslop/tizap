import nodemailer from 'nodemailer';
import {
    EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT,
    RESEND_API_KEY, GMAIL_REFRESH_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
} from './constants.js';

const host = EMAIL_HOST;
const port = parseInt(EMAIL_PORT);
const secure = port === 465;

// SMTP Transporter
// Uses robust configuration with fallback for service 'gmail'
// SMTP Transporter
// Uses robust configuration with fallback for service 'gmail'
const transporterConfig = {};

if (GMAIL_REFRESH_TOKEN && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    console.log('[MAIL] Configuring Gmail API (OAuth2)');
    transporterConfig.service = 'gmail';
    transporterConfig.auth = {
        type: 'OAuth2',
        user: EMAIL_USER,
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        refreshToken: GMAIL_REFRESH_TOKEN
    };
} else if (process.env.EMAIL_SERVICE) {
    transporterConfig.service = process.env.EMAIL_SERVICE;
    transporterConfig.auth = { user: EMAIL_USER, pass: EMAIL_PASS };
} else {
    transporterConfig.host = host || 'smtp.gmail.com';
    transporterConfig.port = port || 587;
    transporterConfig.secure = port === 465;
    transporterConfig.auth = { user: EMAIL_USER, pass: EMAIL_PASS };
}

const transporter = nodemailer.createTransport({
    ...transporterConfig,
    tls: { rejectUnauthorized: false }
});

/**
 * Universal mail sender
 * Simplified to prioritize SMTP which is what the user configured
 */
export const sendMail = async ({ to, subject, html, text }) => {
    // 1. Try Resend if API Key exists (and no SMTP host defined explicitly maybe? No, let's keep it as option)
    if (RESEND_API_KEY) {
        try {
            console.log('[MAIL] Using Resend API for:', to);
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: `tiZAP! <onboarding@resend.dev>`,
                    to,
                    subject,
                    html: html || text
                })
            });
            const data = await res.json();
            if (res.ok) return { success: true, data };
            console.error('[RESEND ERROR]', data);
        } catch (err) {
            console.error('[RESEND FETCH ERROR]', err);
        }
    }

    // 2. Fallback to SMTP
    console.log('[MAIL] Using SMTP (Host:', transporterConfig.host || transporterConfig.service, 'Port:', port, ') for:', to);
    return transporter.sendMail({
        from: `"tiZAP!" <${EMAIL_USER}>`,
        to,
        subject,
        html,
        text
    });
};

export default transporter;
