import nodemailer from 'nodemailer';
import { EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT, RESEND_API_KEY } from './constants.js';

const host = EMAIL_HOST;
const port = parseInt(EMAIL_PORT);
const secure = port === 465;

// SMTP Transporter
const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    tls: { rejectUnauthorized: false, minVersion: 'TLSv1.2' },
    connectionTimeout: 20000,
});

/**
 * Universal mail sender
 * Automatically switches between Resend API and SMTP
 */
export const sendMail = async ({ to, subject, html, text }) => {
    // 1. Try Resend if API Key exists (Bypasses SMTP blocks)
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
                    from: `tiZAP! <onboarding@resend.dev>`, // Generic test sender for Resend
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
    console.log('[MAIL] Using SMTP (Port:', port, ') for:', to);
    return transporter.sendMail({
        from: `"tiZAP!" <${EMAIL_USER}>`,
        to,
        subject,
        html,
        text
    });
};

export default transporter;
