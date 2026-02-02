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
        console.error('[EVOLUTION MESSAGES ERROR]', err);
        res.status(500).json({ error: 'Erro ao buscar mensagens' });
    }
});

// Mark Evolution messages as read
router.post('/evolution/messages/mark-read', authenticateToken, async (req, res) => {
    try {
        const { phones, phone } = req.body;
        const userId = req.userId;

        const targetPhones = phones || [phone];
        if (!targetPhones || !targetPhones.length || !targetPhones[0]) {
            return res.json({ success: true });
        }

        await prisma.evolutionMessage.updateMany({
            where: {
                userId,
                contactPhone: { in: targetPhones },
                isRead: false
            },
            data: { isRead: true }
        });

        // Broadcast via WebSocket
        const broadcastMessage = req.app.get('broadcastMessage');
        if (broadcastMessage) {
            broadcastMessage('evolution:message', { action: 'mark-read', phones: targetPhones }, userId);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[EVOLUTION MARK READ ERROR]', err);
        res.status(500).json({ error: 'Erro ao marcar como lido' });
    }
});

// Delete Evolution conversations
router.post('/evolution/messages/delete', authenticateToken, async (req, res) => {
    try {
        const { phones, userId } = req.body;
        if (!phones || !phones.length) {
            return res.status(400).json({ error: 'No phones provided' });
        }

        const result = await prisma.evolutionMessage.deleteMany({
            where: {
                userId: parseInt(userId),
                contactPhone: { in: phones }
            }
        });

        res.json({ success: true, count: result.count });
    } catch (err) {
        console.error('[EVOLUTION DELETE ERROR]', err);
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
        const { id, name, triggerKeywords, nodes, edges, isActive } = req.body;

        if (id) {
            // Update
            const updated = await prisma.automation.update({
                where: { id: parseInt(id) },
                data: {
                    name,
                    triggerKeywords: triggerKeywords || '',
                    nodes: JSON.stringify(nodes || []),
                    edges: JSON.stringify(edges || []),
                    isActive: isActive !== undefined ? isActive : true
                }
            });
            return res.json(updated);
        } else {
            // Create
            const created = await prisma.automation.create({
                data: {
                    userId,
                    name: name || 'Nova Automação',
                    triggerKeywords: triggerKeywords || '',
                    nodes: JSON.stringify(nodes || []),
                    edges: JSON.stringify(edges || []),
                    isActive: true
                }
            });
            return res.json(created);
        }
    } catch (err) {
        console.error('[SAVE AUTOMATION ERROR]', err);
        res.status(500).json({ error: 'Erro ao salvar automação' });
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
                if (message.conversation) {
                    messageBody = message.conversation;
                } else if (message.extendedTextMessage) {
                    messageBody = message.extendedTextMessage.text;
                } else if (message.imageMessage) {
                    messageBody = message.imageMessage.caption || '[Imagem]';
                    mediaType = 'image';
                    if (msgData.base64) mediaUrl = `data:image/jpeg;base64,${msgData.base64}`;
                } else if (message.audioMessage) {
                    messageBody = '[Áudio]';
                    mediaType = 'audio';
                    if (msgData.base64) mediaUrl = `data:audio/ogg;base64,${msgData.base64}`;
                } else if (message.videoMessage) {
                    messageBody = message.videoMessage.caption || '[Vídeo]';
                    mediaType = 'video';
                    if (msgData.base64) mediaUrl = `data:video/mp4;base64,${msgData.base64}`;
                } else if (message.stickerMessage) {
                    messageBody = '[Figurinha]';
                    mediaType = 'image'; // Treat as image for simpler preview
                    if (msgData.base64) mediaUrl = `data:image/webp;base64,${msgData.base64}`;
                } else if (message.documentMessage) {
                    messageBody = message.documentMessage.fileName || '[Documento]';
                    mediaType = 'document';
                    if (msgData.base64) {
                        const mime = message.documentMessage.mimetype || 'application/octet-stream';
                        mediaUrl = `data:${mime};base64,${msgData.base64}`;
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
        const automations = await prisma.automation.findMany({
            where: {
                userId,
                isActive: true
            }
        });

        for (const automation of automations) {
            let shouldTrigger = false;
            const keywords = automation.triggerKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);

            if (keywords.length === 0) continue; // Skip if no keywords defined

            for (const kw of keywords) {
                if (messageBody.toLowerCase().includes(kw)) {
                    shouldTrigger = true;
                    break;
                }
            }

            if (shouldTrigger) {
                // Import and trigger FlowEngine
                const FlowEngine = (await import('../services/flowEngine.js')).default;
                await FlowEngine.startFlow(null, contactPhone, userId, 'evolution', automation.id);
                console.log(`[AUTOMATION] Triggered automation ${automation.id} for ${contactPhone}`);
                break; // Only trigger one automation per message to avoid loops
            }
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

// Toggle automation status
router.patch('/evolution/automations/:id/toggle', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const auto = await prisma.automation.findUnique({ where: { id: parseInt(id) } });
        if (!auto) return res.status(404).json({ error: 'Não encontrada' });

        const updated = await prisma.automation.update({
            where: { id: parseInt(id) },
            data: { isActive: !auto.isActive }
        });
        console.log(`[AUTOMATION] Toggled active status for #${id} to ${updated.isActive}`);
        res.json(updated);
    } catch (err) {
        console.error('[TOGGLE ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
