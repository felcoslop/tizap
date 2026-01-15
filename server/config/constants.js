import 'dotenv/config';

export const PORT = process.env.PORT || 3000;
export const WEBHOOK_VERIFY_TOKEN = 'ambev_webhook_token_2026';
export const JWT_SECRET = process.env.JWT_SECRET || 'tizap_secret_key_2026';
export const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
export const EMAIL_USER = (process.env.EMAIL_USER || '').trim();
export const EMAIL_PASS = (process.env.EMAIL_PASS || '').trim();
export const GOOGLE_CLIENT_ID = process.env.CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = process.env.CLIENT_SECRET;
