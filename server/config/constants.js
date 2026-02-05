import 'dotenv/config';

export const PORT = process.env.PORT || 3000;
export const WEBHOOK_VERIFY_TOKEN = 'ambev_webhook_token_2026';
export const JWT_SECRET = process.env.JWT_SECRET || 'tizap_secret_key_2026';

// Better FRONTEND_URL detection
const getFrontendUrl = () => {
    // If explicitly set to localhost, ignore Ngrok to avoid offline tunnel errors
    if (process.env.FRONTEND_URL === 'localhost') {
        return 'http://localhost:5173';
    }

    // Priority 1: explicitly set FRONTEND_URL (not 'localhost')
    if (process.env.FRONTEND_URL) {
        return process.env.FRONTEND_URL.startsWith('http')
            ? process.env.FRONTEND_URL
            : `https://${process.env.FRONTEND_URL}`;
    }

    // Priority 2: URL_NGROK (useful for local dev with webhooks)
    if (process.env.URL_NGROK) return process.env.URL_NGROK;

    // Fallback: Localhost
    return 'http://localhost:5173';
};

export const FRONTEND_URL = getFrontendUrl().replace(/\/$/, '');

// Backend URL for callbacks
export const BACKEND_URL = (process.env.BACKEND_URL || (process.env.NODE_ENV === 'production' ? FRONTEND_URL : 'http://localhost:3000')).replace(/\/$/, '');

export const EMAIL_USER = (process.env.EMAIL_USER || process.env.MAIL_USERNAME || '').trim();
export const EMAIL_PASS = (process.env.EMAIL_PASS || process.env.MAIL_PASSWORD || '').trim();
export const EMAIL_HOST = (process.env.EMAIL_SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
export const EMAIL_PORT = (process.env.EMAIL_SMTP_PORT || process.env.EMAIL_PORT || '587').trim();
export const RESEND_API_KEY = process.env.RESEND_API_KEY;
export const GMAIL_REFRESH_TOKEN = (process.env.GMAIL_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN || '').trim();
export const GOOGLE_CLIENT_ID = (process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_ID || '').trim();
export const GOOGLE_CLIENT_SECRET = (process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_SECRET || '').trim();

// Centralized Uploads directory
import path from 'path';
import fs from 'fs';
const dataPath = '/data/uploads';
export const UPLOAD_DIR = fs.existsSync('/data') ? dataPath : path.join(process.cwd(), 'uploads');
// Ensure it exists
if (!fs.existsSync(UPLOAD_DIR)) {
    try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch (e) { }
}
