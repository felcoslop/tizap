import express from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/index.js';
import { downloadEvolutionMedia } from '../services/whatsapp.js';

const router = express.Router();

// Helper function to make Evolution API requests
async function evolutionRequest(baseUrl, apiKey, endpoint, method = 'GET', body = null) {
    const url = `${baseUrl}${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey
        }
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    console.log(`[EVOLUTION API] ${method} ${url}`);

    try {
        const response = await fetch(url, options);
        let data;

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            data = { message: text.slice(0, 100) };
        }

        if (!response.ok) {
            console.error('[EVOLUTION API ERROR]', JSON.stringify(data, null, 2));
            throw new Error(data.message || data.error || `Erro da Evolution API: ${response.status}`);
        }

        return data;
    } catch (err) {
        console.error(`[EVOLUTION FETCH ERROR] ${url}:`, err);
        throw err;
    }
}

// Create or fetch Evolution instance for user
router.post('/evolution/instance', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const evolutionApiUrl = process.env.EVOLUTION_API_URL;
        const evolutionApiKey = process.env.EVOLUTION_API_KEY;

        if (!evolutionApiUrl || !evolutionApiKey) {
            return res.status(500).json({ error: 'Configuração da Evolution API ausente no servidor' });
        }

        // Clean URL (remove trailing slash)
        const baseUrl = evolutionApiUrl.replace(/\/+$/, '');
        const instanceName = `user_${userId}_instance`;

        // Use existing webhook token if available, otherwise generate new
        const config = await prisma.userConfig.findUnique({ where: { userId } });
        const webhookToken = config?.evolutionWebhookToken || (Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2));

        // Check if instance already exists
        try {
            const existingInstance = await evolutionRequest(
                baseUrl,
                evolutionApiKey,
                `/instance/fetchInstances?instanceName=${instanceName}`
            );

            if (existingInstance && existingInstance.length > 0) {
                // Instance exists, update config and return
                await prisma.userConfig.update({
                    where: { userId },
                    data: {
                        evolutionApiUrl: baseUrl,
                        evolutionApiKey: evolutionApiKey,
                        evolutionInstanceName: instanceName,
                        evolutionWebhookToken: webhookToken
                    }
                });

                return res.json({
                    success: true,
                    instanceName,
                    message: 'Instância já existe',
                    instance: existingInstance[0]
                });
            }
        } catch (e) {
            // Instance doesn't exist, continue to create
            console.log('[EVOLUTION] Instance not found, creating new one...');
        }

        // Create new instance
        const createPayload = {
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS'
        };

        const newInstance = await evolutionRequest(
            baseUrl,
            evolutionApiKey,
            '/instance/create',
            'POST',
            createPayload
        );

        // Set up webhook for this instance
        const host = req.get('host');
        const protocol = req.protocol;
        const webhookUrl = `${protocol}://${host}/api/evolution/webhook/${webhookToken}`;

        try {
            await evolutionRequest(
                baseUrl,
                evolutionApiKey,
                `/webhook/set/${instanceName}`,
                'POST',
                {
                    enabled: true,
                    url: webhookUrl,
                    webhookByEvents: false,
                    webhookBase64: true,
                    events: [
                        'MESSAGES_UPSERT',
                        'MESSAGES_UPDATE',
                        'MESSAGES_DELETE',
                        'CONNECTION_UPDATE',
                        'QRCODE_UPDATED',
                        'PRESENCE_UPDATE',
                        'CONTACTS_UPSERT',
                        'CHATS_UPSERT',
                        'SEND_MESSAGE'
                    ]
                }
            );
            console.log(`[EVOLUTION] Webhook configured: ${webhookUrl}`);
        } catch (webhookErr) {
            console.error('[EVOLUTION] Failed to set webhook:', webhookErr.message);
        }

        // Update user config
        await prisma.userConfig.update({
            where: { userId },
            data: {
                evolutionApiUrl: baseUrl,
                evolutionApiKey: evolutionApiKey,
                evolutionInstanceName: instanceName,
                evolutionWebhookToken: webhookToken,
                evolutionConnected: false
            }
        });

        res.json({
            success: true,
            instanceName,
            message: 'Instância criada com sucesso',
            instance: newInstance,
            webhookUrl
        });

    } catch (err) {
        console.error('[EVOLUTION CREATE ERROR]', err);
        res.status(500).json({ error: err.message || 'Erro ao criar instância' });
    }
});

// Robust Webhook Enable Route (as requested by user)
router.post('/evolution/webhook/enable', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { instanceName, webhookUrl } = req.body;

        // Try to get from .env first, fallback to user config
        let evolutionApiUrl = process.env.EVOLUTION_API_URL;
        let evolutionApiKey = process.env.EVOLUTION_API_KEY;

        const config = await prisma.userConfig.findUnique({ where: { userId } });

        if (!evolutionApiUrl && config?.evolutionApiUrl) {
            evolutionApiUrl = config.evolutionApiUrl;
        }
        if (!evolutionApiKey && config?.evolutionApiKey) {
            evolutionApiKey = config.evolutionApiKey;
        }

        if (!evolutionApiUrl || !evolutionApiKey) {
            console.error('[EVOLUTION WEBHOOK] Missing credentials for user:', userId);
            return res.status(500).json({ error: 'Configuração da Evolution API ausente no servidor. Verifique os Ajustes.' });
        }

        const baseUrl = evolutionApiUrl.replace(/\/+$/, '');
        const targetInstance = instanceName || config?.evolutionInstanceName || `user_${userId}_instance`;

        // If webhookUrl is not provided, generate the standard one
        let finalWebhookUrl = webhookUrl;
        if (!finalWebhookUrl) {
            if (!config?.evolutionWebhookToken) {
                console.error('[EVOLUTION WEBHOOK] Missing webhook token for user:', userId);
                return res.status(400).json({ error: 'Token de webhook não encontrado para este usuário. Tente "Conectar via QR Code" primeiro.' });
            }
            const host = req.get('host');
            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            // Ensure no trailing slash on host and avoid double protocol
            const cleanHost = host.replace(/\/+$/, '');
            finalWebhookUrl = `${protocol}://${cleanHost}/api/evolution/webhook/${config.evolutionWebhookToken}`;
        }

        console.log(`[EVOLUTION] Configuring robust webhook for ${targetInstance}`);
        console.log(`[EVOLUTION] Target URL: ${finalWebhookUrl}`);

        const result = await evolutionRequest(
            baseUrl,
            evolutionApiKey,
            `/webhook/set/${targetInstance}`,
            'POST',
            {
                webhook: {
                    enabled: true,
                    url: finalWebhookUrl,
                    webhookByEvents: false,
                    webhook_by_events: false, // Compatibility
                    webhookBase64: true,
                    webhook_base_64: true,    // Compatibility
                    base64: true,             // Compatibility
                    events: [
                        'MESSAGES_UPSERT',
                        'MESSAGES_UPDATE',
                        'MESSAGES_DELETE',
                        'SEND_MESSAGE',
                        'CONNECTION_UPDATE',
                        'QRCODE_UPDATED',
                        'PRESENCE_UPDATE',
                        'CONTACTS_UPSERT',
                        'CHATS_UPSERT'
                    ]
                }
            }
        );

        res.json({
            success: true,
            instance: targetInstance,
            webhookUrl: finalWebhookUrl,
            eventsEnabled: 9,
            base64Enabled: true,
            evolutionResponse: result,
            message: "✅ Webhook corrigido! Recebe/envia texto+áudio+foto"
        });

    } catch (err) {
        console.error('[EVOLUTION WEBHOOK ENABLE ERROR]', err);
        res.status(500).json({
            error: err.message || 'Erro ao habilitar webhook',
            details: err.stack?.split('\n')[0]
        });
    }
});

// Get QR Code for Evolution instance
router.get('/evolution/qr/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        const config = await prisma.userConfig.findUnique({ where: { userId } });
        if (!config || !config.evolutionApiUrl || !config.evolutionInstanceName) {
            return res.status(400).json({ error: 'Instância Evolution não configurada' });
        }

        const qrData = await evolutionRequest(
            config.evolutionApiUrl,
            config.evolutionApiKey,
            `/instance/connect/${config.evolutionInstanceName}`
        );

        res.json({
            success: true,
            instanceName: config.evolutionInstanceName,
            qrcode: qrData.base64 || qrData.qrcode?.base64 || qrData.qr || null,
            pairingCode: qrData.pairingCode || null,
            status: qrData.state || qrData.status || 'unknown'
        });

    } catch (err) {
        console.error('[EVOLUTION QR ERROR]', err);
        res.status(500).json({ error: err.message || 'Erro ao obter QR Code' });
    }
});

// Check Evolution instance connection status
router.get('/evolution/status/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        const config = await prisma.userConfig.findUnique({ where: { userId } });
        if (!config || !config.evolutionApiUrl || !config.evolutionInstanceName) {
            return res.json({ connected: false, status: 'not_configured' });
        }

        const statusData = await evolutionRequest(
            config.evolutionApiUrl,
            config.evolutionApiKey,
            `/instance/connectionState/${config.evolutionInstanceName}`
        );

        const isConnected = statusData.state === 'open' || statusData.instance?.state === 'open';

        // Update connection status in DB
        if (isConnected !== config.evolutionConnected) {
            await prisma.userConfig.update({
                where: { userId },
                data: { evolutionConnected: isConnected }
            });
        }

        res.json({
            success: true,
            connected: isConnected,
            status: statusData.state || statusData.instance?.state || 'unknown',
            instanceName: config.evolutionInstanceName
        });

    } catch (err) {
        console.error('[EVOLUTION STATUS ERROR]', err);
        res.status(500).json({ connected: false, error: err.message });
    }
});

// Disconnect Evolution instance
router.post('/evolution/disconnect/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        const config = await prisma.userConfig.findUnique({ where: { userId } });
        if (!config || !config.evolutionApiUrl || !config.evolutionInstanceName) {
            return res.status(400).json({ error: 'Instância não configurada' });
        }

        await evolutionRequest(
            config.evolutionApiUrl,
            config.evolutionApiKey,
            `/instance/logout/${config.evolutionInstanceName}`,
            'DELETE'
        );

        await prisma.userConfig.update({
            where: { userId },
            data: { evolutionConnected: false }
        });

        res.json({ success: true, message: 'Desconectado com sucesso' });

    } catch (err) {
        console.error('[EVOLUTION DISCONNECT ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// Send message via Evolution
router.post('/evolution/send-message', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { phone, body, message, mediaUrl, mediaType } = req.body;
        const messageBody = body || message;

        const config = await prisma.userConfig.findUnique({ where: { userId } });
        if (!config || !config.evolutionApiUrl || !config.evolutionInstanceName) {
            return res.status(400).json({ error: 'Instância Evolution não configurada' });
        }

        // Normalize phone number
        let normalizedPhone = String(phone).replace(/\D/g, '');
        if (!normalizedPhone.startsWith('55')) {
            normalizedPhone = '55' + normalizedPhone;
        }
        const remoteJid = `${normalizedPhone}@s.whatsapp.net`;

        let messageData;

        if (mediaUrl) {
            // Send media message
            const mediaEndpoint = mediaType === 'audio'
                ? `/message/sendWhatsAppAudio/${config.evolutionInstanceName}`
                : `/message/sendMedia/${config.evolutionInstanceName}`;

            messageData = await evolutionRequest(
                config.evolutionApiUrl,
                config.evolutionApiKey,
                mediaEndpoint,
                'POST',
                {
                    number: remoteJid,
                    mediatype: mediaType || 'image',
                    media: mediaUrl,
                    caption: messageBody || ''
                }
            );
        } else {
            // Send text message
            messageData = await evolutionRequest(
                config.evolutionApiUrl,
                config.evolutionApiKey,
                `/message/sendText/${config.evolutionInstanceName}`,
                'POST',
                {
                    number: remoteJid,
                    text: messageBody
                }
            );
        }

        // Save sent message to DB
        const savedMsg = await prisma.evolutionMessage.create({
            data: {
                userId,
                instanceName: config.evolutionInstanceName,
                contactPhone: normalizedPhone,
                contactName: 'Eu',
                messageBody: messageBody || `[${mediaType?.toUpperCase() || 'MEDIA'}]`,
                isFromMe: true,
                isRead: true,
                mediaUrl,
                mediaType
            }
        });

        // Broadcast via WebSocket
        const broadcastMessage = req.app.get('broadcastMessage');
        if (broadcastMessage) {
            broadcastMessage('evolution:message', savedMsg, userId);
        }

        res.json({ success: true, message: messageData });

    } catch (err) {
        console.error('[EVOLUTION SEND ERROR]', err);
        res.status(500).json({ error: err.message || 'Erro ao enviar mensagem' });
    }
});

// Get Evolution messages for user
router.get('/evolution/messages/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        const messages = await prisma.evolutionMessage.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        res.json(messages);

    } catch (err) {
        console.error('[GET EVOLUTION MSGS ERROR]', err);
        res.status(500).json({ error: 'Erro ao buscar mensagens' });
    }
});

// Mark messages as read for a contact
router.post('/evolution/messages/mark-read', authenticateToken, async (req, res) => {
    try {
        const { phones, phone } = req.body;
        const userId = req.userId;

        const targetPhones = Array.isArray(phones) ? phones : (phone ? [phone] : []);
        if (targetPhones.length === 0) {
            return res.json({ success: true });
        }

        const normalizedPhones = targetPhones.map(p => String(p).replace(/\D/g, ''));

        await prisma.evolutionMessage.updateMany({
            where: {
                userId,
                OR: normalizedPhones.map(p => ({
                    contactPhone: { contains: p }
                }))
            },
            data: { isRead: true }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[EVOLUTION MARK READ ERROR]', err);
        res.status(500).json({ error: 'Erro ao marcar como lido' });
    }
});

// Delete Evolution conversations
router.post('/evolution/messages/delete', authenticateToken, async (req, res) => {
    try {
        const { phones } = req.body;
        const userId = req.userId;

        if (!phones || !phones.length) {
            return res.status(400).json({ error: 'Nenhum telefone enviado' });
        }

        const normalizedPhones = phones.map(p => String(p).replace(/\D/g, ''));

        await prisma.evolutionMessage.deleteMany({
            where: {
                userId,
                OR: normalizedPhones.map(p => ({
                    contactPhone: { contains: p }
                }))
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE EVOLUTION MSGS ERROR]', err);
        res.status(500).json({ error: 'Erro ao excluir conversas' });
    }
});

// Fetch contact profile picture from Evolution
router.get('/evolution/contact/:phone/photo', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { phone } = req.params;
        const name = req.query.name || 'Cliente';

        const config = await prisma.userConfig.findUnique({ where: { userId } });

        if (config?.evolutionApiUrl && config?.evolutionInstanceName) {
            try {
                let normalizedPhone = String(phone).replace(/\D/g, '');
                if (!normalizedPhone.startsWith('55')) {
                    normalizedPhone = '55' + normalizedPhone;
                }

                const profileData = await evolutionRequest(
                    config.evolutionApiUrl,
                    config.evolutionApiKey,
                    `/chat/fetchProfilePictureUrl/${config.evolutionInstanceName}`,
                    'POST',
                    { number: `${normalizedPhone}@s.whatsapp.net` }
                );

                if (profileData.profilePictureUrl) {
                    return res.redirect(profileData.profilePictureUrl);
                }
            } catch (e) {
                console.log('[EVOLUTION] Could not fetch profile pic:', e.message);
            }
        }

        // Fallback to initials
        const initials = name
            .split(' ')
            .map(n => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

        const colors = ['#280091', '#00a276', '#ffc200', '#ff5555', '#4285F4'];
        const colorIndex = phone.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
        const bgColor = colors[colorIndex];
        const textColor = bgColor === '#ffc200' ? '#280091' : '#ffffff';

        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
                <rect width="100" height="100" fill="${bgColor}" />
                <text x="50" y="50" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="${textColor}" text-anchor="middle" dominant-baseline="central">${initials}</text>
            </svg>
        `.trim();

        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svg);

    } catch (err) {
        console.error('[EVOLUTION PHOTO ERROR]', err);
        res.status(500).send('Error');
    }
});

// --- Evolution Automations CRUD ---

// Get all automations for a user
router.get('/evolution/automations/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const automations = await prisma.automation.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(automations);
    } catch (err) {
        console.error('[GET AUTOMATIONS ERROR]', err);
        res.status(500).json({ error: 'Erro ao buscar automações' });
    }
});

// Create or update automation
router.post('/evolution/automations', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { id, name, triggerKeywords, nodes, edges, conditions, isActive, triggerType } = req.body;

        console.log(`[SAVE AUTOMATION] User: ${userId}, ID: ${id || 'NEW'}, Name: ${name}`);
        // console.log('[SAVE AUTOMATION DATA]', JSON.stringify(req.body).slice(0, 1000));

        // Helper to stringify if it's an object/array
        const ensureString = (val) => {
            if (val === null || val === undefined) return '[]';
            if (typeof val === 'string') return val;
            return JSON.stringify(val);
        };

        const data = {
            name: name || 'Nova Automação',
            triggerKeywords: ensureString(triggerKeywords || '').replace(/[\[\]"]/g, ''), // Clean if it was an array
            nodes: ensureString(nodes),
            edges: ensureString(edges),
            conditions: ensureString(conditions || []),
            isActive: isActive !== undefined ? isActive : true,
            triggerType: triggerType || 'message'
        };

        if (id) {
            // Check if automation belongs to user before updating
            const existing = await prisma.automation.findUnique({
                where: { id: parseInt(id) }
            });

            if (existing && existing.userId === userId) {
                const updated = await prisma.automation.update({
                    where: { id: parseInt(id) },
                    data
                });
                return res.json(updated);
            }
            // If ID doesn't exist or belongs to someone else, we fall through to Create
            // but we omit the ID so Prisma generates a new one
        }

        // Create new
        console.log('[SAVE AUTOMATION] Creating new automation...');
        const created = await prisma.automation.create({
            data: {
                ...data,
                userId
            }
        });
        console.log('[SAVE AUTOMATION] Successfully created:', created.id);
        return res.json(created);

    } catch (err) {
        console.error('[SAVE AUTOMATION ERROR]', err);
        res.status(500).json({ error: 'Erro ao salvar automação: ' + err.message });
    }
});

// Delete automation
router.delete('/evolution/automations/:id', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await prisma.automation.delete({
            where: { id }
        });
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE AUTOMATION ERROR]', err);
        res.status(500).json({ error: 'Erro ao excluir automação' });
    }
});

// Evolution Webhook Handler (handles incoming messages from Evolution)
router.post('/evolution/webhook/:webhookToken', async (req, res) => {
    try {
        const { webhookToken } = req.params;
        const body = req.body;

        console.log('[EVOLUTION WEBHOOK] Received:', JSON.stringify(body).slice(0, 500));

        // Find user by webhook token
        const config = await prisma.userConfig.findFirst({
            where: { evolutionWebhookToken: webhookToken }
        });

        if (!config) {
            console.error('[EVOLUTION WEBHOOK] Invalid token:', webhookToken);
            return res.sendStatus(404);
        }

        const userId = config.userId;
        const event = body.event;

        // Handle connection update
        if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
            const state = body.data?.state || body.state;
            const isConnected = state === 'open';

            await prisma.userConfig.update({
                where: { userId },
                data: { evolutionConnected: isConnected }
            });

            // Broadcast connection status via WebSocket
            const broadcastMessage = req.app.get('broadcastMessage');
            if (broadcastMessage) {
                broadcastMessage('evolution:connection', { connected: isConnected }, userId);
            }

            // Trigger connection automations
            if (event === 'CONNECTION_UPDATE' || event === 'connection.update') {
                await processEventAutomations(userId, 'connection_update', `Status: ${state}`);
            }
        }

        // Handle QR updated
        if (event === 'qrcode.updated' || event === 'QRCODE_UPDATED') {
            await processEventAutomations(userId, 'qrcode_updated', 'New QR Code generated');
        }

        // Handle Contacts
        if (event === 'contacts.upsert' || event === 'CONTACTS_UPSERT') {
            const contacts = Array.isArray(body.data) ? body.data : (body.data ? [body.data] : [body]);
            for (const c of contacts) {
                const phone = (c.id || c.key?.remoteJid || '').replace(/\D/g, '');
                if (phone) await processEventAutomations(userId, 'contacts_upsert', `New contact: ${phone}`);
            }
        }

        // Handle incoming messages
        if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
            const messages = Array.isArray(body.data) ? body.data : (body.data ? [body.data] : [body]);

            for (const msgData of messages) {
                const key = msgData.key || {};
                const message = msgData.message || {};

                // If it's a message from me, we still want to save it if it's new
                // but we label it correctly
                const isFromMe = !!key.fromMe;

                const remoteJid = key.remoteJid || '';
                const contactPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');

                // Skip status updates or group messages if not needed (currently focused on direct chat)
                if (remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') continue;

                const pushName = msgData.pushName || (isFromMe ? 'Eu' : 'Cliente');
                console.log(`[EVOLUTION WEBHOOK] Msg from ${contactPhone} (${pushName}), isFromMe: ${isFromMe}`);

                let messageBody = '';
                let mediaUrl = null;
                let mediaType = null;

                // Extract message content and media
                const content = message.ephemeralMessage?.message || message.viewOnceMessage?.message || message.viewOnceMessageV2?.message || message;

                if (content.conversation) {
                    messageBody = content.conversation;
                } else if (content.extendedTextMessage) {
                    messageBody = content.extendedTextMessage.text;
                } else if (content.imageMessage) {
                    messageBody = content.imageMessage.caption || '[Imagem]';
                    mediaType = 'image';
                    const b64 = msgData.base64 || content.imageMessage.base64;
                    if (b64) mediaUrl = `data:image/jpeg;base64,${b64}`;
                } else if (content.audioMessage) {
                    messageBody = '[Áudio]';
                    mediaType = 'audio';
                    const b64 = msgData.base64 || content.audioMessage.base64;
                    if (b64) mediaUrl = `data:audio/ogg;base64,${b64}`;
                } else if (content.videoMessage) {
                    messageBody = content.videoMessage.caption || '[Vídeo]';
                    mediaType = 'video';
                    const b64 = msgData.base64 || content.videoMessage.base64;
                    if (b64) mediaUrl = `data:video/mp4;base64,${b64}`;
                } else if (content.stickerMessage) {
                    messageBody = '[Figurinha]';
                    mediaType = 'image';
                    const b64 = msgData.base64 || content.stickerMessage.base64;
                    if (b64) mediaUrl = `data:image/webp;base64,${b64}`;
                } else if (content.documentMessage || content.documentWithCaptionMessage) {
                    const doc = content.documentMessage || content.documentWithCaptionMessage?.message?.documentMessage;
                    const mime = doc?.mimetype || '';
                    messageBody = doc?.fileName || doc?.caption || '[Documento]';

                    if (mime.includes('image/')) mediaType = 'image';
                    else if (mime.includes('audio/')) mediaType = 'audio';
                    else if (mime.includes('video/')) mediaType = 'video';
                    else mediaType = 'document';

                    const b64 = msgData.base64 || doc?.base64;
                    if (b64) {
                        const finalMime = mime || 'application/octet-stream';
                        mediaUrl = `data:${finalMime};base64,${b64}`;
                    }
                }

                // If we don't have a body but have media, use a placeholder
                if (!messageBody && mediaType) {
                    messageBody = `[${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}]`;
                }

                if (!messageBody && !mediaUrl) continue; // Nothing to save

                // If mediaUrl is missing or base64, try to download as a real file for better reliability
                if (mediaType && (!mediaUrl || mediaUrl.startsWith('data:'))) {
                    console.log(`[EVOLUTION WEBHOOK] Attempting to download media for ${key.id}`);
                    const localMediaUrl = await downloadEvolutionMedia(msgData, config);
                    if (localMediaUrl) {
                        mediaUrl = localMediaUrl;
                    }
                }

                // Save message to DB
                const savedMsg = await prisma.evolutionMessage.create({
                    data: {
                        userId,
                        instanceName: config.evolutionInstanceName,
                        contactPhone,
                        contactName: isFromMe ? 'Eu' : pushName,
                        pushName,
                        messageBody,
                        isFromMe,
                        isRead: isFromMe,
                        mediaUrl,
                        mediaType,
                        remoteJid,
                        messageId: key.id
                    }
                });

                // Broadcast via WebSocket
                const broadcastMessage = req.app.get('broadcastMessage');
                if (broadcastMessage) {
                    broadcastMessage('evolution:message', savedMsg, userId);
                }

                // Process automations ONLY for incoming messages
                if (!isFromMe) {
                    await processAutomations(userId, contactPhone, messageBody);
                    await processEventAutomations(userId, 'messages_upsert', messageBody, contactPhone);
                }
            }
        }

        res.sendStatus(200);

    } catch (err) {
        console.error('[EVOLUTION WEBHOOK ERROR]', err);
        res.sendStatus(500);
    }
});

// Process automations when a new message arrives
async function processAutomations(userId, contactPhone, messageBody) {
    try {
        const FlowEngine = (await import('../services/flowEngine.js')).default;

        // Normalize phone for consistent lookup
        let normalizedPhone = String(contactPhone).replace(/\D/g, '');
        if (!normalizedPhone.startsWith('55')) normalizedPhone = '55' + normalizedPhone;

        const possibleNumbers = [normalizedPhone, normalizedPhone.replace('55', '')];
        if (normalizedPhone.length === 13 && normalizedPhone.startsWith('55')) {
            const withoutNine = normalizedPhone.slice(0, 4) + normalizedPhone.slice(5);
            possibleNumbers.push(withoutNine, withoutNine.replace('55', ''));
        }
        if (normalizedPhone.length === 12 && normalizedPhone.startsWith('55')) {
            const withNine = normalizedPhone.slice(0, 4) + '9' + normalizedPhone.slice(4);
            possibleNumbers.push(withNine, withNine.replace('55', ''));
        }

        // Check for existing active session (waiting for reply)
        const existingSession = await prisma.flowSession.findFirst({
            where: {
                contactPhone: { in: possibleNumbers },
                status: 'waiting_reply',
                OR: [
                    { flow: { userId } },
                    { automation: { userId } }
                ]
            },
            include: { automation: true }
        });

        // If session exists, check 24h window
        if (existingSession) {
            const sessionAge = Date.now() - new Date(existingSession.updatedAt).getTime();
            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (sessionAge > twentyFourHours) {
                // Session expired - close it
                console.log(`[AUTOMATION] Session ${existingSession.id} expired (${Math.round(sessionAge / 3600000)}h old)`);
                await prisma.flowSession.update({
                    where: { id: existingSession.id },
                    data: { status: 'expired' }
                });
                // Continue to create new session below
            } else {
                // Session is valid, process the reply
                const sessionProcessed = await FlowEngine.processMessage(contactPhone, messageBody, null, userId, 'evolution');
                if (sessionProcessed) {
                    console.log(`[AUTOMATION] Message handled by active session for ${contactPhone}`);
                    return; // Stop here
                }
            }
        }

        // Check if contact has any active session (not just waiting_reply)
        const anyActiveSession = await prisma.flowSession.findFirst({
            where: {
                contactPhone: { in: possibleNumbers },
                status: { in: ['active', 'waiting_reply'] },
                OR: [
                    { flow: { userId } },
                    { automation: { userId } }
                ]
            }
        });

        if (anyActiveSession) {
            console.log(`[AUTOMATION] Contact ${contactPhone} already in an active session, skipping new triggers`);
            return;
        }

        // Fetch active automations
        const automations = await prisma.automation.findMany({
            where: { userId, isActive: true }
        });
        console.log(`[AUTOMATION] Checking ${automations.length} active automations for user ${userId}`);

        // Separate by type for priority handling
        const keywordAutomations = automations.filter(a => a.triggerType === 'keyword');
        const messageAutomations = automations.filter(a => a.triggerType === 'message' || a.triggerType === 'new_message');

        // PRIORITY 1: Check keyword automations first
        for (const automation of keywordAutomations) {
            const keywords = (automation.triggerKeywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
            if (keywords.length === 0) continue;

            for (const kw of keywords) {
                if (messageBody.toLowerCase().includes(kw)) {
                    console.log(`[AUTOMATION] Matched "${automation.name}" via keyword: ${kw}`);
                    await FlowEngine.startFlow(null, contactPhone, userId, 'evolution', automation.id);
                    console.log(`[AUTOMATION] Triggered keyword automation ${automation.id} for ${contactPhone}`);
                    return; // Stop - keyword takes priority
                }
            }
        }

        // PRIORITY 2: If no keyword matched, check message automations
        for (const automation of messageAutomations) {
            console.log(`[AUTOMATION] Matched "${automation.name}" via global message trigger`);
            await FlowEngine.startFlow(null, contactPhone, userId, 'evolution', automation.id);
            console.log(`[AUTOMATION] Triggered message automation ${automation.id} for ${contactPhone}`);
            return; // Only trigger one
        }

    } catch (err) {
        console.error('[AUTOMATION PROCESS ERROR]', err);
    }
}

// Process event-based automations (new contact, qrcode, connection)
async function processEventAutomations(userId, triggerType, context = '', contactPhone = null) {
    try {
        const automations = await prisma.automation.findMany({
            where: { userId, triggerType, isActive: true }
        });

        for (const auto of automations) {
            const FlowEngine = (await import('../services/flowEngine.js')).default;
            // For events like connection/qrcode, use a dummy or system phone if none provided
            const targetPhone = contactPhone || 'system';
            await FlowEngine.startFlow(null, targetPhone, userId, 'evolution', auto.id);
            console.log(`[EVENT] Triggered ${triggerType} automation for ${targetPhone}`);
        }
    } catch (err) {
        console.error('[EVENT PROCESS ERROR]', err);
    }
}

// Toggle automation status with exclusivity rules
router.patch('/evolution/automations/:id/toggle', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const auto = await prisma.automation.findUnique({ where: { id: parseInt(id) } });
        if (!auto) return res.status(404).json({ error: 'Não encontrada' });

        const newActiveState = !auto.isActive;

        // If activating, enforce exclusivity rules
        if (newActiveState) {
            const triggerType = auto.triggerType;

            // For qrcode_updated and connection_update: only 1 can be active
            if (triggerType === 'qrcode_updated' || triggerType === 'connection_update') {
                await prisma.automation.updateMany({
                    where: {
                        userId: auto.userId,
                        triggerType: triggerType,
                        isActive: true,
                        id: { not: parseInt(id) }
                    },
                    data: { isActive: false }
                });
                console.log(`[AUTOMATION] Deactivated other ${triggerType} automations for user ${auto.userId}`);
            }

            // For message trigger: deactivate other message automations (keyword can coexist)
            if (triggerType === 'message') {
                await prisma.automation.updateMany({
                    where: {
                        userId: auto.userId,
                        triggerType: 'message',
                        isActive: true,
                        id: { not: parseInt(id) }
                    },
                    data: { isActive: false }
                });
                console.log(`[AUTOMATION] Deactivated other message automations for user ${auto.userId}`);
            }

            // For keyword trigger: deactivate other keyword automations (message can coexist)
            if (triggerType === 'keyword') {
                await prisma.automation.updateMany({
                    where: {
                        userId: auto.userId,
                        triggerType: 'keyword',
                        isActive: true,
                        id: { not: parseInt(id) }
                    },
                    data: { isActive: false }
                });
                console.log(`[AUTOMATION] Deactivated other keyword automations for user ${auto.userId}`);
            }
        }

        const updated = await prisma.automation.update({
            where: { id: parseInt(id) },
            data: { isActive: newActiveState }
        });
        console.log(`[AUTOMATION] Toggled active status for #${id} to ${updated.isActive}`);
        res.json(updated);
    } catch (err) {
        console.error('[TOGGLE ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// Close all active automation sessions for a user
router.post('/evolution/sessions/close-all', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;

        // Find all active sessions for this user's flows or automations
        const sessions = await prisma.flowSession.findMany({
            where: {
                status: { in: ['active', 'waiting_reply', 'waiting_business_hours'] },
                OR: [
                    { flow: { userId: userId } },
                    { automation: { userId: userId } }
                ]
            },
            select: { id: true }
        });

        const sessionIds = sessions.map(s => s.id);

        if (sessionIds.length > 0) {
            await prisma.flowSession.updateMany({
                where: { id: { in: sessionIds } },
                data: { status: 'completed' }
            });
        }

        console.log(`[SESSION] Closed ${sessionIds.length} active sessions for user ${userId}`);
        res.json({ success: true, count: sessionIds.length });
    } catch (err) {
        console.error('[CLOSE ALL SESSIONS ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
