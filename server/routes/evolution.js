import express from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/index.js';
import { downloadEvolutionMedia } from '../services/whatsapp.js';
import { processAutomations, processEventAutomations } from '../services/automationService.js';
import { evolutionRequest, getStatus, fetchQR, logoutInstance } from '../services/evolutionService.js';

const router = express.Router();
const disconnectionTimeouts = new Map();

// --- Instance Management ---

router.post('/evolution/instance', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const evolutionApiUrl = process.env.EVOLUTION_API_URL;
        const evolutionApiKey = process.env.EVOLUTION_API_KEY;

        if (!evolutionApiUrl || !evolutionApiKey) {
            return res.status(500).json({ error: 'Configuração da Evolution API ausente no servidor' });
        }

        const baseUrl = evolutionApiUrl.replace(/\/+$/, '');
        const instanceName = `user_${userId}_instance`;
        const config = await prisma.userConfig.findUnique({ where: { userId } });
        const webhookToken = config?.evolutionWebhookToken || (Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2));

        try {
            const existingInstance = await evolutionRequest(baseUrl, evolutionApiKey, `/instance/fetchInstances?instanceName=${instanceName}`);
            if (existingInstance && existingInstance.length > 0) {
                await prisma.userConfig.update({
                    where: { userId },
                    data: { evolutionApiUrl: baseUrl, evolutionApiKey, evolutionInstanceName: instanceName, evolutionWebhookToken: webhookToken }
                });
                return res.json({ success: true, instanceName, message: 'Instância já existe', instance: existingInstance[0] });
            }
        } catch (e) { console.log('[EVOLUTION] Instance not found, creating new one...'); }

        const newInstance = await evolutionRequest(baseUrl, evolutionApiKey, '/instance/create', 'POST', { instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' });
        const protocol = req.protocol;
        const host = req.get('host');
        const webhookUrl = `${protocol}://${host}/api/evolution/webhook/${webhookToken}`;

        try {
            await evolutionRequest(baseUrl, evolutionApiKey, `/webhook/set/${instanceName}`, 'POST', {
                enabled: true, url: webhookUrl, webhookByEvents: false, webhookBase64: true,
                events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'MESSAGES_DELETE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED', 'PRESENCE_UPDATE', 'CONTACTS_UPSERT', 'CHATS_UPSERT', 'SEND_MESSAGE']
            });
        } catch (webhookErr) { console.error('[EVOLUTION] Failed to set webhook:', webhookErr.message); }

        await prisma.userConfig.update({
            where: { userId },
            data: { evolutionApiUrl: baseUrl, evolutionApiKey, evolutionInstanceName: instanceName, evolutionWebhookToken: webhookToken, evolutionConnected: false }
        });

        res.json({ success: true, instanceName, message: 'Instância criada com sucesso', instance: newInstance, webhookUrl });
    } catch (err) {
        console.error('[EVOLUTION CREATE ERROR]', err);
        res.status(500).json({ error: err.message || 'Erro ao criar instância' });
    }
});

router.post('/evolution/webhook/enable', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { instanceName, webhookUrl } = req.body;
        const config = await prisma.userConfig.findUnique({ where: { userId } });

        let evolutionApiUrl = process.env.EVOLUTION_API_URL || config?.evolutionApiUrl;
        let evolutionApiKey = process.env.EVOLUTION_API_KEY || config?.evolutionApiKey;

        if (!evolutionApiUrl || !evolutionApiKey) return res.status(500).json({ error: 'Configuração ausente' });

        const baseUrl = evolutionApiUrl.replace(/\/+$/, '');
        const targetInstance = instanceName || config?.evolutionInstanceName;
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const finalWebhookUrl = webhookUrl || `${protocol}://${req.get('host')}/api/evolution/webhook/${config.evolutionWebhookToken}`;

        const result = await evolutionRequest(baseUrl, evolutionApiKey, `/webhook/set/${targetInstance}`, 'POST', {
            webhook: {
                enabled: true, url: finalWebhookUrl, webhookByEvents: false, webhook_by_events: false, webhookBase64: true, webhook_base_64: true, base64: true,
                events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'MESSAGES_DELETE', 'SEND_MESSAGE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED', 'PRESENCE_UPDATE', 'CONTACTS_UPSERT', 'CHATS_UPSERT']
            }
        });
        res.json({ success: true, instance: targetInstance, webhookUrl: finalWebhookUrl, evolutionResponse: result, message: "Webhook corrigido!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/evolution/qr/:userId', authenticateToken, async (req, res) => {
    try {
        const config = await prisma.userConfig.findUnique({ where: { userId: parseInt(req.params.userId) } });
        if (!config || !config.evolutionApiUrl) return res.status(400).json({ error: 'Não configurada' });
        const qrcode = await fetchQR(config);
        res.json({ success: true, instanceName: config.evolutionInstanceName, qrcode });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/evolution/status/:userId', authenticateToken, async (req, res) => {
    try {
        const config = await prisma.userConfig.findUnique({ where: { userId: parseInt(req.params.userId) } });
        if (!config || !config.evolutionApiUrl) return res.json({ connected: false, status: 'not_configured' });
        const isConnected = await getStatus(config);
        if (isConnected !== config.evolutionConnected) await prisma.userConfig.update({ where: { userId: config.userId }, data: { evolutionConnected: isConnected } });
        res.json({ success: true, connected: isConnected, instanceName: config.evolutionInstanceName });
    } catch (err) { res.json({ connected: false, error: err.message }); }
});

router.post('/evolution/disconnect/:userId', authenticateToken, async (req, res) => {
    try {
        const config = await prisma.userConfig.findUnique({ where: { userId: parseInt(req.params.userId) } });
        if (config) await logoutInstance(config);
        await prisma.userConfig.update({ where: { userId: parseInt(req.params.userId) }, data: { evolutionConnected: false } });
        res.json({ success: true, message: 'Desconectado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Messaging ---

router.post('/evolution/send-message', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { phone, body, message, mediaUrl, mediaType } = req.body;
        const messageBody = body || message;
        const config = await prisma.userConfig.findUnique({ where: { userId } });

        let normalizedPhone = String(phone).replace(/\D/g, '');
        if (!normalizedPhone.startsWith('55')) normalizedPhone = '55' + normalizedPhone;
        const remoteJid = `${normalizedPhone}@c.us`;

        let payload = { number: remoteJid };
        let endpoint = `/message/sendText/${config.evolutionInstanceName}`;
        if (mediaUrl) {
            if (mediaType === 'audio') {
                endpoint = `/message/sendWhatsAppAudio/${config.evolutionInstanceName}`;
                payload.audio = mediaUrl; payload.delay = 1200; payload.encoding = true;
            } else if (mediaType === 'document' || String(mediaUrl).toLowerCase().endsWith('.pdf')) {
                // Evolution API v2: /message/sendMedia with FLAT structure
                endpoint = `/message/sendMedia/${config.evolutionInstanceName}`;

                payload = {
                    number: remoteJid,
                    mediatype: 'document',
                    media: mediaUrl,
                    mimetype: 'application/pdf',
                    fileName: 'documento.pdf',
                    caption: ''
                };
            } else {
                endpoint = `/message/sendMedia/${config.evolutionInstanceName}`;
                payload.mediatype = mediaType || 'image';
                payload.media = mediaUrl;
                payload.caption = messageBody || '';
            }
        } else {
            payload.text = messageBody;
        }

        console.log('[EVOLUTION SEND] Endpoint:', endpoint, '| Payload:', JSON.stringify(payload));
        const data = await evolutionRequest(config.evolutionApiUrl, config.evolutionApiKey, endpoint, 'POST', payload);
        const savedMsg = await prisma.evolutionMessage.create({
            data: { userId, instanceName: config.evolutionInstanceName, contactPhone: normalizedPhone, contactName: 'Eu', messageBody: messageBody || `[${mediaType?.toUpperCase() || 'MEDIA'}]`, isFromMe: true, isRead: true, mediaUrl, mediaType }
        });

        const broadcastMessage = req.app.get('broadcastMessage');
        if (broadcastMessage) broadcastMessage('evolution:message', savedMsg, userId);
        res.json({ success: true, message: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/evolution/messages/:userId', authenticateToken, async (req, res) => {
    const messages = await prisma.evolutionMessage.findMany({ where: { userId: parseInt(req.params.userId) }, orderBy: { createdAt: 'desc' } });
    res.json(messages);
});

router.post('/evolution/messages/mark-read', authenticateToken, async (req, res) => {
    const { phones, phone } = req.body;
    const targets = Array.isArray(phones) ? phones : (phone ? [phone] : []);
    if (targets.length) {
        const normalized = targets.map(p => String(p).replace(/\D/g, ''));
        await prisma.evolutionMessage.updateMany({ where: { userId: req.userId, OR: normalized.map(p => ({ contactPhone: { contains: p } })) }, data: { isRead: true } });
    }
    res.json({ success: true });
});

router.post('/evolution/messages/delete', authenticateToken, async (req, res) => {
    const { phones } = req.body;
    if (phones?.length) {
        const normalized = phones.map(p => String(p).replace(/\D/g, ''));
        await prisma.evolutionMessage.deleteMany({ where: { userId: req.userId, OR: normalized.map(p => ({ contactPhone: { contains: p } })) } });
    }
    res.json({ success: true });
});

// --- Public / Contact ---

router.get('/evolution/public/contact/:userId/:phone/photo', async (req, res) => {
    try {
        const { userId, phone } = req.params;
        const config = await prisma.userConfig.findUnique({ where: { userId: parseInt(userId) } });
        if (config?.evolutionApiUrl) {
            try {
                const profileData = await evolutionRequest(config.evolutionApiUrl, config.evolutionApiKey, `/chat/fetchProfilePictureUrl/${config.evolutionInstanceName}`, 'POST', { number: String(phone).replace(/\D/g, '') });
                const url = profileData.profilePictureUrl || profileData.pictureUrl || profileData.url;
                if (url) return res.redirect(url);
            } catch (e) { }
        }
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="#280091"/><text x="50%" y="50%" fill="white" font-size="40" text-anchor="middle" dominant-baseline="central">${(req.query.name || 'C').charAt(0).toUpperCase()}</text></svg>`);
    } catch (e) { res.status(500).send('Error'); }
});

// --- Automations CRUD ---

router.get('/evolution/automations', authenticateToken, async (req, res) => {
    const userId = req.userId;
    console.log(`[EVO] Fetching automations for UserID: ${userId}`);
    const autos = await prisma.automation.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    res.json(autos);
});

router.post('/evolution/automations', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { id, name, triggerKeywords, nodes, edges, conditions, isActive, triggerType, sessionWaitTime } = req.body;
        const ensureString = (v) => typeof v === 'string' ? v : JSON.stringify(v || []);
        const data = {
            name: name || 'Nova Automação',
            triggerKeywords: ensureString(triggerKeywords || '').replace(/[\[\]"]/g, ''),
            nodes: ensureString(nodes),
            edges: ensureString(edges),
            conditions: ensureString(conditions),
            isActive: isActive ?? false,
            triggerType: triggerType || 'message',
            sessionWaitTime: parseInt(sessionWaitTime) || 1440
        };

        if (id && id !== 'new') {
            const existing = await prisma.automation.findUnique({ where: { id: parseInt(id) } });
            if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Automação não encontrada' });

            // Validation: Keyword mandatory for keyword type
            if (data.triggerType === 'keyword' && !data.triggerKeywords) {
                return res.status(400).json({ error: 'Palavra-chave é obrigatória para este tipo de gatilho.' });
            }

            // Uniqueness check for keywords
            if (data.triggerType === 'keyword') {
                const keywords = data.triggerKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
                const otherAutos = await prisma.automation.findMany({
                    where: { userId, triggerType: 'keyword', id: { not: parseInt(id) } }
                });

                for (const auto of otherAutos) {
                    const existingKeywords = auto.triggerKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
                    const collision = keywords.find(k => existingKeywords.includes(k));
                    if (collision) {
                        return res.status(400).json({ error: `A palavra-chave "${collision}" já está em uso em outra automação.` });
                    }
                }
            }

            return res.json(await prisma.automation.update({ where: { id: parseInt(id) }, data }));
        }

        // Validation for new automation
        if (data.triggerType === 'keyword' && !data.triggerKeywords) {
            return res.status(400).json({ error: 'Palavra-chave é obrigatória para este tipo de gatilho.' });
        }

        // Uniqueness check for new automation
        if (data.triggerType === 'keyword') {
            const keywords = data.triggerKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
            const otherAutos = await prisma.automation.findMany({
                where: { userId, triggerType: 'keyword' }
            });

            for (const auto of otherAutos) {
                const existingKeywords = auto.triggerKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
                const collision = keywords.find(k => existingKeywords.includes(k));
                if (collision) {
                    return res.status(400).json({ error: `A palavra-chave "${collision}" já está em uso em outra automação.` });
                }
            }
        }

        console.log('[EVO] Creating new automation for user:', userId);
        res.json(await prisma.automation.create({ data: { ...data, userId } }));
    } catch (err) {
        console.error('[AUTO SAVE ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/evolution/automations/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const id = parseInt(req.params.id);
        const existing = await prisma.automation.findUnique({ where: { id } });
        if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Automação não encontrada' });

        await prisma.automation.delete({ where: { id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/evolution/automations/:id/toggle', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const userId = req.userId;
        console.log(`[EVO] Toggling automation ${id} for user ${userId}`);
        const auto = await prisma.automation.findUnique({ where: { id } });

        if (!auto) {
            console.error(`[EVO] Automation ${id} not found`);
            return res.status(404).json({ error: 'Automação não encontrada' });
        }

        if (auto.userId !== userId) {
            console.error(`[EVO] User ${userId} tried to toggle automation ${id} belonging to user ${auto.userId}`);
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const newState = !auto.isActive;
        if (newState && auto.triggerType === 'message') {
            // Se for ativado um do tipo 'message' (Qualquer Mensagem), 
            // desativa outros 'message' para evitar conflito de fallback.
            await prisma.automation.updateMany({
                where: {
                    userId,
                    triggerType: 'message',
                    isActive: true,
                    id: { not: id }
                },
                data: { isActive: false }
            });
            console.log(`[EVO] Deactivated other 'message' automations for user ${userId} because ID ${id} was activated.`);
        }

        const updated = await prisma.automation.update({ where: { id }, data: { isActive: newState } });
        console.log(`[EVO] Automation ${id} toggled to ${newState} for user ${userId}`);
        res.json(updated);
    } catch (err) {
        console.error('[TOGGLE ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// --- Webhook ---

router.post('/evolution/webhook/:webhookToken', async (req, res) => {
    try {
        const { webhookToken } = req.params;
        const body = req.body;
        const event = body.event || 'unknown';
        const config = await prisma.userConfig.findFirst({ where: { evolutionWebhookToken: webhookToken } });
        if (!config) return res.sendStatus(404);
        const userId = config.userId;

        if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
            const state = body.data?.state || body.state;
            const isConnected = state === 'open';
            if (disconnectionTimeouts.has(userId)) clearTimeout(disconnectionTimeouts.get(userId));
            await prisma.userConfig.update({ where: { userId }, data: { evolutionConnected: isConnected } });
            const broadcastMessage = req.app.get('broadcastMessage');
            if (broadcastMessage) broadcastMessage('evolution:connection', { connected: isConnected }, userId);

            if (isConnected) await processEventAutomations(userId, 'connection_update', `Status: ${state}`);
            else {
                const timeout = setTimeout(async () => {
                    const current = await prisma.userConfig.findUnique({ where: { userId } });
                    if (current && !current.evolutionConnected) await processEventAutomations(userId, 'connection_update', 'Offline (Persistent)');
                }, 1800000);
                disconnectionTimeouts.set(userId, timeout);
            }
        }

        if (event === 'qrcode.updated' || event === 'QRCODE_UPDATED') await processEventAutomations(userId, 'qrcode_updated');

        if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT' || event === 'SEND_MESSAGE') {
            const messages = Array.isArray(body.data) ? body.data : [body.data || body];
            for (const msgData of messages) {
                const key = msgData.key || {};
                const message = msgData.message || {};
                if (key.remoteJid?.includes('@g.us')) continue;
                const contactPhone = (key.remoteJid || '').replace(/\D/g, '');
                const isFromMe = !!key.fromMe;
                const content = message.ephemeralMessage?.message || message.viewOnceMessage?.message || message;

                let bodyText = content.conversation || content.extendedTextMessage?.text || (content.imageMessage ? '[Imagem]' : content.audioMessage ? '[Áudio]' : content.documentMessage ? (content.documentMessage.fileName || '[Documento]') : '');
                let mediaUrl = null, mediaType = null;
                if (content.imageMessage) mediaType = 'image';
                if (content.audioMessage) mediaType = 'audio';
                if (content.documentMessage) mediaType = 'document';

                if (mediaType) mediaUrl = await downloadEvolutionMedia(msgData, config);

                const saved = await prisma.evolutionMessage.create({
                    data: { userId, instanceName: config.evolutionInstanceName, contactPhone, contactName: isFromMe ? 'Eu' : (msgData.pushName || 'Cliente'), messageBody: bodyText || `[${mediaType?.toUpperCase()}]`, isFromMe, isRead: isFromMe, mediaUrl, mediaType, remoteJid: key.remoteJid, messageId: key.id }
                });
                const broadcastMessage = req.app.get('broadcastMessage');
                if (broadcastMessage) broadcastMessage('evolution:message', saved, userId);

                const isAutomated = !!(key.id?.startsWith('BAE5') || key.id?.startsWith('3EB0')); // BAE5 is Baileys, 3EB0 often used for self-sent

                if (!isFromMe || (isFromMe && !isAutomated)) {
                    await processAutomations(userId, contactPhone, bodyText, isFromMe, isAutomated);
                    if (!isFromMe) await processEventAutomations(userId, 'messages_upsert', bodyText, contactPhone);
                }
            }
        }
        res.sendStatus(200);
    } catch (err) { res.sendStatus(500); }
});

router.get('/evolution/sessions', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const sessions = await prisma.flowSession.findMany({
            where: {
                status: { in: ['active', 'waiting_reply', 'waiting_business_hours'] },
                OR: [
                    { flow: { userId } },
                    { automation: { userId } }
                ]
            },
            orderBy: { updatedAt: 'desc' },
            include: { flow: true, automation: true }
        });

        const enriched = sessions.map(s => ({
            id: s.id,
            contactPhone: s.contactPhone,
            status: s.status,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            type: s.flowId ? 'Fluxo' : 'Automação',
            name: s.flow?.name || s.automation?.name || 'Desconhecido',
            currentStep: s.currentStep
        }));

        res.json(enriched);
    } catch (err) {
        console.error('[EVO SESSIONS ERROR]', err);
        res.status(500).json({ error: 'Erro ao buscar sessões ativas' });
    }
});

router.post('/evolution/sessions/:id/close', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const userId = req.userId;

        const session = await prisma.flowSession.findUnique({
            where: { id },
            include: { flow: true, automation: true }
        });

        if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });

        const ownerId = session.flow?.userId || session.automation?.userId;
        if (ownerId !== userId) return res.status(403).json({ error: 'Acesso negado' });

        await prisma.flowSession.update({
            where: { id },
            data: { status: 'stopped' }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[EVO SESSION CLOSE ERROR]', err);
        res.status(500).json({ error: 'Erro ao fechar sessão' });
    }
});

router.post('/evolution/sessions/close-all', authenticateToken, async (req, res) => {
    const sessions = await prisma.flowSession.findMany({ where: { status: { in: ['active', 'waiting_reply', 'waiting_business_hours'] }, OR: [{ flow: { userId: req.userId } }, { automation: { userId: req.userId } }] } });
    if (sessions.length) await prisma.flowSession.updateMany({ where: { id: { in: sessions.map(s => s.id) } }, data: { status: 'stopped' } });
    res.json({ success: true, count: sessions.length });
});

export default router;
