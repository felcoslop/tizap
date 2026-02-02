import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { UPLOAD_DIR } from '../config/constants.js';
import prisma from '../db.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = pino({ level: 'silent' });
// Removed hardcoded uploadsDir - using UPLOAD_DIR from constants.js

export const sendWhatsApp = async (phone, config, templateName, components) => {
    try {
        let normalizedPhone = String(phone).replace(/\D/g, '');
        if (normalizedPhone && !normalizedPhone.startsWith('55')) {
            normalizedPhone = '55' + normalizedPhone;
        }

        const url = `https://graph.facebook.com/v21.0/${config.phoneId}/messages`;
        const finalTemplateName = String(templateName).trim();

        const metaComponents = [];

        if (components.header && components.header.length > 0) {
            metaComponents.push({
                type: "header",
                parameters: components.header.map(v => {
                    const param = { type: "text" };
                    if (typeof v === 'object' && v.name) {
                        if (isNaN(parseInt(v.name, 10))) {
                            param.parameter_name = v.name;
                        }
                        param.text = String(v.value || '').trim();
                    } else {
                        param.text = String(v || '').trim();
                    }
                    return param;
                })
            });
        }

        if (components.body && components.body.length > 0) {
            metaComponents.push({
                type: "body",
                parameters: components.body.map(v => {
                    const param = { type: "text" };
                    if (typeof v === 'object' && v.name) {
                        if (isNaN(parseInt(v.name, 10))) {
                            param.parameter_name = v.name;
                        }
                        param.text = String(v.value || '').trim();
                    } else {
                        param.text = String(v || '').trim();
                    }
                    return param;
                })
            });
        }

        const payload = {
            messaging_product: "whatsapp",
            to: normalizedPhone,
            type: "template",
            template: {
                name: finalTemplateName,
                language: { code: "pt_BR" },
                components: metaComponents
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('[WHATSAPP API ERROR]', JSON.stringify(data, null, 2));

            let errorMessage = data.error?.message || 'Erro na Meta API';
            const errorCode = data.error?.code;

            if (errorCode === 132001) {
                errorMessage = `Template '${finalTemplateName}' não existe ou não foi aprovado (Cod: 132001)`;
            } else if (errorCode === 132000) {
                errorMessage = `Número de parâmetros incorreto para o template (Cod: 132000)`;
            }

            return { success: false, error: errorMessage };
        }
        return { success: true, data };
    } catch (err) {
        console.error('[WHATSAPP SERVICE ERROR]', err);
        return { success: false, error: err.message };
    }
};

export const downloadMedia = async (mediaId, config) => {
    try {
        if (!mediaId) return null;

        const urlRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
            headers: { 'Authorization': `Bearer ${config.token}` }
        });

        if (!urlRes.ok) return null;

        const urlData = await urlRes.json();
        const mediaUrl = urlData.url;
        const mimeType = urlData.mime_type;

        if (!mediaUrl) return null;

        const response = await fetch(mediaUrl, {
            headers: { 'Authorization': `Bearer ${config.token}` }
        });

        if (!response.ok) return null;

        const buffer = await response.arrayBuffer();
        const ext = mimeType ? mimeType.split('/')[1].split(';')[0] : 'bin';
        const filename = `${mediaId}.${ext}`;
        const filepath = path.join(UPLOAD_DIR, filename);

        if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        fs.writeFileSync(filepath, Buffer.from(buffer));

        return `/uploads/${filename}`;
    } catch (err) {
        console.error('[DOWNLOAD MEDIA ERROR]', err);
        return null;
    }
};

export const uploadMediaToMeta = async (fileUrl, type, config) => {
    try {
        const filename = path.basename(fileUrl);
        const absolutePath = path.join(UPLOAD_DIR, filename);

        if (!fs.existsSync(absolutePath)) return null;

        const formData = new FormData();
        const fileBuffer = fs.readFileSync(absolutePath);
        const ext = path.extname(absolutePath).toLowerCase();
        let mimeType = 'application/octet-stream';
        if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.ogg') mimeType = 'audio/ogg';
        else if (ext === '.mp3') mimeType = 'audio/mpeg';
        else if (ext === '.webm') mimeType = 'audio/webm';
        else if (ext === '.mp4') mimeType = 'video/mp4';
        else if (ext === '.pdf') mimeType = 'application/pdf';

        const fileBlob = new Blob([fileBuffer], { type: mimeType });

        formData.append('file', fileBlob, path.basename(absolutePath));
        formData.append('type', type);
        formData.append('messaging_product', 'whatsapp');

        const url = `https://graph.facebook.com/v21.0/${config.phoneId}/media`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${config.token}` },
            body: formData
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('[UPLOAD META ERROR RESPONSE]', JSON.stringify(data, null, 2));
            return null;
        }
        return data.id;
    } catch (err) {
        console.error('[UPLOAD META EXCEPTION]', err);
        return null;
    }
};

export const downloadEvolutionMedia = async (msgData, config) => {
    try {
        if (!msgData || !msgData.message) return null;

        const messageContent = msgData.message;
        const mediaType = Object.keys(messageContent).find(key =>
            key === 'imageMessage' ||
            key === 'audioMessage' ||
            key === 'videoMessage' ||
            key === 'documentMessage' ||
            key === 'documentWithCaptionMessage' ||
            key === 'stickerMessage'
        );

        if (!mediaType) return null;

        const innerMsg = messageContent[mediaType] || messageContent.documentWithCaptionMessage?.message?.documentMessage;
        const mime = innerMsg?.mimetype || '';
        const fileNameOriginal = innerMsg?.fileName || '';

        console.log(`[DOWNLOAD MEDIA] Detected mediaType: ${mediaType}, mime: ${mime}, fileName: ${fileNameOriginal}`);

        // Determine extension
        let ext = 'bin';
        if (mime.includes('image/jpeg')) ext = 'jpg';
        else if (mime.includes('image/png')) ext = 'png';
        else if (mime.includes('image/webp')) ext = 'webp';
        else if (mime.includes('audio/ogg')) ext = 'ogg';
        else if (mime.includes('audio/mpeg')) ext = 'mp3';
        else if (mime.includes('video/mp4')) ext = 'mp4';
        else if (mime.includes('application/pdf')) ext = 'pdf';
        else if (mediaType === 'stickerMessage') ext = 'webp';

        if (fileNameOriginal.includes('.')) {
            const parts = fileNameOriginal.split('.');
            const suggestedExt = parts[parts.length - 1].toLowerCase();
            if (suggestedExt.length >= 2 && suggestedExt.length <= 4) {
                ext = suggestedExt;
            }
        }

        const fileName = `${msgData.key.id}.${ext}`;
        const relativePath = `/uploads/${fileName}`;
        const uploadsDir = path.join(__dirname, '../../uploads');
        const absolutePath = path.join(uploadsDir, fileName);

        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        // Method 1: Try Evolution API getBase64FromMediaMessage
        if (config?.evolutionApiUrl && config?.evolutionInstanceName) {
            try {
                console.log(`[DOWNLOAD MEDIA] Trying Evolution API for ${mediaType}...`);
                const evoUrl = `${config.evolutionApiUrl}/chat/getBase64FromMediaMessage/${config.evolutionInstanceName}`;
                const evoRes = await fetch(evoUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': config.evolutionApiKey || process.env.EVOLUTION_API_KEY
                    },
                    body: JSON.stringify({
                        message: {
                            key: msgData.key,
                            message: messageContent
                        },
                        convertToMp4: true
                    })
                });

                if (evoRes.ok) {
                    const evoData = await evoRes.json();
                    if (evoData.base64) {
                        const buffer = Buffer.from(evoData.base64, 'base64');
                        fs.writeFileSync(absolutePath, buffer);
                        console.log(`[DOWNLOAD MEDIA] Saved via Evolution API to ${absolutePath}`);
                        return relativePath;
                    }
                }
            } catch (evoErr) {
                console.log('[DOWNLOAD MEDIA] Evolution API failed:', evoErr.message);
            }
        }

        // Method 2: Try direct URL download if available
        const directUrl = innerMsg?.url;
        if (directUrl) {
            try {
                console.log(`[DOWNLOAD MEDIA] Trying direct URL download...`);
                const urlRes = await fetch(directUrl);
                if (urlRes.ok) {
                    const buffer = Buffer.from(await urlRes.arrayBuffer());
                    fs.writeFileSync(absolutePath, buffer);
                    console.log(`[DOWNLOAD MEDIA] Saved via direct URL to ${absolutePath}`);
                    return relativePath;
                }
            } catch (urlErr) {
                console.log('[DOWNLOAD MEDIA] Direct URL failed:', urlErr.message);
            }
        }

        // Method 3: Baileys decryption (last resort)
        try {
            console.log(`[DOWNLOAD MEDIA] Trying Baileys decryption for ${mediaType}...`);
            const messageToDownload = {
                key: msgData.key,
                message: messageContent
            };

            const buffer = await downloadMediaMessage(
                messageToDownload,
                'buffer',
                {},
                { logger }
            );

            if (buffer) {
                fs.writeFileSync(absolutePath, buffer);
                console.log(`[DOWNLOAD MEDIA] Saved via Baileys to ${absolutePath}`);
                return relativePath;
            }
        } catch (baileysErr) {
            console.error('[DOWNLOAD MEDIA] Baileys failed:', baileysErr.code || baileysErr.message);
        }

        console.error('[DOWNLOAD MEDIA] All methods failed');
        return null;

    } catch (error) {
        console.error('[DOWNLOAD MEDIA ERROR]', error.code || error.message);
        return null;
    }
};

