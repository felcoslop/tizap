import express from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/index.js';

const router = express.Router();

// Get Received Messages (History)
router.get('/messages/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        // Find user config to get phoneId
        const config = await prisma.userConfig.findUnique({
            where: { userId }
        });

        if (!config || !config.phoneId) {
            return res.json([]); // No config, no messages
        }

        const messages = await prisma.receivedMessage.findMany({
            where: { whatsappPhoneId: String(config.phoneId) },
            orderBy: { createdAt: 'desc' }
        });
        res.json(messages);
    } catch (err) {
        console.error('[MESSAGES ERROR]', err);
        res.status(500).json({ error: 'Erro ao buscar mensagens' });
    }
});

// Delete Received Message
router.delete('/messages/:id', authenticateToken, async (req, res) => {
    try {
        await prisma.receivedMessage.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao excluir mensagem' });
    }
});

// Send Single Message (Manual)
router.post('/send-message', authenticateToken, async (req, res) => {
    try {
        const { phone, body, config, mediaUrl, mediaType } = req.body;
        // This is a placeholder for manual individual sending if needed
        // For now, it's used in the frontend to trigger messages.
        // We'll use the same logic as flow engine but exposed here.

        let normalizedPhone = String(phone).replace(/\D/g, '');
        if (!normalizedPhone.startsWith('55')) normalizedPhone = '55' + normalizedPhone;

        const url = `https://graph.facebook.com/v21.0/${config.phoneId}/messages`;
        let payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: normalizedPhone,
        };

        if (mediaUrl) {
            payload.type = mediaType === 'image' ? 'image' : 'document';
            payload[payload.type] = { link: mediaUrl };
        } else {
            payload.type = 'text';
            payload.text = { body };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${config.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            await prisma.receivedMessage.create({
                data: {
                    whatsappPhoneId: String(config.phoneId),
                    contactPhone: normalizedPhone,
                    contactName: 'Eu',
                    messageBody: body || `[Arquivo: ${mediaType}]`,
                    isFromMe: true,
                    isRead: true,
                    mediaUrl,
                    mediaType
                }
            });
            res.json({ success: true });
        } else {
            const errData = await response.json();
            res.status(response.status).json(errData);
        }
    } catch (err) {
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

export default router;
