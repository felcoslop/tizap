import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import {
    EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT,
    RESEND_API_KEY, GMAIL_REFRESH_TOKEN,
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
} from './constants.js';

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
 * Automatically switches between Gmail API (HTTP), Resend API (HTTP) and SMTP
 */
export const sendMail = async ({ to, subject, html, text }) => {
    // 1. Try Gmail API (HTTP - Porta 443) if Refresh Token exists
    if (GMAIL_REFRESH_TOKEN && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
        try {
            console.log('[MAIL] Using Gmail API for:', to);
            // DEBUG LOGS (Masked for safety)
            const mask = (str) => str ? `${str.substring(0, 5)}...${str.substring(str.length - 5)}` : 'EMPTY';
            console.log('[GMAIL DEBUG] ID:', mask(GOOGLE_CLIENT_ID));
            console.log('[GMAIL DEBUG] Secret:', mask(GOOGLE_CLIENT_SECRET));
            console.log('[GMAIL DEBUG] Refresh Token:', mask(GMAIL_REFRESH_TOKEN));

            const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
            oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
            const messageParts = [
                `From: tiZAP! <${EMAIL_USER}>`,
                `To: ${to}`,
                `Content-Type: text/html; charset=utf-8`,
                `MIME-Version: 1.0`,
                `Subject: ${utf8Subject}`,
                '',
                html || text,
            ];
            const message = messageParts.join('\n');
            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            const res = await gmail.users.messages.send({
                userId: 'me',
                requestBody: { raw: encodedMessage }
            });
            return { success: true, data: res.data };
        } catch (err) {
            console.error('[GMAIL API ERROR]', err.response?.data || err.message);
            // Fallback continues...
        }
    }

    // 2. Try Resend if API Key exists
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

    // 3. Fallback to SMTP
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
