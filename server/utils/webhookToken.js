import crypto from 'crypto';

/**
 * Generates a unique webhook token from user email
 * @param {string} email - User email
 * @returns {string} - 16-character hex token
 */
export function generateWebhookToken(email) {
    return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex').substring(0, 16);
}
