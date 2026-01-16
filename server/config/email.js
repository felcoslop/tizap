import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import {
    EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT,
    RESEND_API_KEY, GMAIL_REFRESH_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
} from './constants.js';

const OAuth2 = google.auth.OAuth2;

const createTransporter = async () => {
    // 1. Resend API (HTTP - Port 443) - Preferred if key exists
    if (RESEND_API_KEY) {
        return { type: 'resend' };
    }

    // 2. Gmail REST API (HTTP - Port 443) - Bypass SMTP ports
    if (GMAIL_REFRESH_TOKEN && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
        console.log('[MAIL] Configured Gmail REST API (HTTPS) - Port 443');
        const oauth2Client = new OAuth2(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            "https://developers.google.com/oauthplayground" // Fallback redirect
        );
        oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
        return { type: 'gmail_api', client: oauth2Client };
    }

    // 3. SMTP Fallback (Port 587/465) - Likely blocked in cloud
    return {
        type: 'smtp',
        transport: nodemailer.createTransport({
            host: EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(EMAIL_PORT) || 587,
            secure: parseInt(EMAIL_PORT) === 465,
            auth: { user: EMAIL_USER, pass: EMAIL_PASS },
            tls: { rejectUnauthorized: false }
        })
    };
};

// Helper to encode message for Gmail API
const makeBody = (to, from, subject, message) => {
    const str = [
        `To: ${to}`,
        `From: ${from}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=utf-8`,
        ``,
        message
    ].join('\n');

    return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const sendMail = async ({ to, subject, html, text }) => {
    try {
        const config = await createTransporter();
        const content = html || text;

        if (config.type === 'resend') {
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
                    html: content
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Resend API Error');
            return { success: true, data };
        }

        if (config.type === 'gmail_api') {
            const gmail = google.gmail({ version: 'v1', auth: config.client });
            const raw = makeBody(to, `tiZAP! <${EMAIL_USER}>`, subject, content);
            const res = await gmail.users.messages.send({
                userId: 'me',
                requestBody: { raw }
            });
            console.log('[MAIL] Sent via Gmail REST API:', res.data.id);
            return { success: true, id: res.data.id };
        }

        // SMTP
        console.log('[MAIL] Sending via SMTP...');
        return config.transport.sendMail({
            from: `"tiZAP!" <${EMAIL_USER}>`,
            to,
            subject,
            html: content,
            text
        });

    } catch (err) {
        console.error('[MAIL ERROR]', err);
        throw err; // Propagate for handling
    }
};

// Validates connection (Polyfill for custom types)
export default {
    verify: async (cb) => {
        try {
            const config = await createTransporter();
            if (config.type === 'smtp') {
                config.transport.verify(cb);
            } else if (config.type === 'gmail_api') {
                // Test token validity
                await config.client.getAccessToken();
                cb(null, true);
            } else {
                cb(null, true); // Resend always ready
            }
        } catch (err) {
            cb(err, false);
        }
    }
};
