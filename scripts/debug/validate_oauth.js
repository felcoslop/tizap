
import 'dotenv/config';
import {
    GMAIL_REFRESH_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
} from './server/config/constants.js';

console.log('--- OAUTH TOKEN VALIDATION ---');
console.log('CLIENT_ID:', GOOGLE_CLIENT_ID);
console.log('REFRESH_TOKEN:', GMAIL_REFRESH_TOKEN);

async function checkToken() {
    if (!GMAIL_REFRESH_TOKEN || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        console.error('❌ MISSING CREDENTIALS');
        return;
    }

    const params = new URLSearchParams();
    params.append('client_id', GOOGLE_CLIENT_ID);
    params.append('client_secret', GOOGLE_CLIENT_SECRET);
    params.append('refresh_token', GMAIL_REFRESH_TOKEN);
    params.append('grant_type', 'refresh_token');

    try {
        console.log('Sending request to https://oauth2.googleapis.com/token...');
        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const data = await res.json();

        if (res.ok) {
            console.log('✅ TOKEN IS VALID!');
            console.log('Access Token Received:', data.access_token ? 'YES (Hidden)' : 'NO');
            console.log('Expires In:', data.expires_in);
        } else {
            console.error('❌ TOKEN IS INVALID / REVOKED / BAD REQUEST');
            console.error('Status:', res.status);
            console.error('Error:', data);
        }
    } catch (err) {
        console.error('❌ NETWORK/FETCH ERROR:', err);
    }
}

checkToken();
