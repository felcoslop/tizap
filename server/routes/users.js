import express from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/index.js';
import { generateWebhookToken } from '../utils/webhookToken.js';

const router = express.Router();

// Get Current User
router.get('/user/me', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            include: { config: true }
        });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            planType: user.planType,
            subscriptionStatus: user.subscriptionStatus,
            trialExpiresAt: user.trialExpiresAt,
            subscriptionExpiresAt: user.subscriptionExpiresAt,
            config: user.config ? {
                ...user.config,
                mapping: JSON.parse(user.config.mapping || '{}')
            } : null
        });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar dados' });
    }
});

// Update User Config
router.post('/user-config/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const { token, phoneId, wabaId, templateName, mapping, webhookVerifyToken } = req.body;

        if (token && token.trim()) {
            const cleanToken = token.trim();
            // Only check for duplicates if token is not empty
            if (cleanToken.length > 0) {
                const existingConfig = await prisma.userConfig.findFirst({
                    where: {
                        token: cleanToken,
                        userId: { not: userId }
                    }
                });

                if (existingConfig) {
                    return res.status(400).json({ error: 'Este token do WhatsApp já está sendo utilizado por outra conta.' });
                }
            }
        }

        // Generate webhook token from user email
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        const webhookToken = user ? generateWebhookToken(user.email) : '';

        await prisma.userConfig.upsert({
            where: { userId },
            update: { token: token ? token.trim() : token, phoneId, wabaId, templateName, mapping: JSON.stringify(mapping), webhookVerifyToken, webhookToken, automationDelay: req.body.automationDelay ? parseInt(req.body.automationDelay) : undefined },
            create: { userId, token: token ? token.trim() : token, phoneId, wabaId, templateName, mapping: JSON.stringify(mapping), webhookVerifyToken, webhookToken, automationDelay: req.body.automationDelay ? parseInt(req.body.automationDelay) : 1440 }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[CONFIG SAVE ERROR]', err);
        res.status(500).json({ error: 'Erro ao salvar configuração' });
    }
});

// Get User (backward compatibility or full data)
router.get('/user/:id', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { config: true }
        });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        if (user.config) {
            user.config.mapping = JSON.parse(user.config.mapping || '{}');
        }
        res.json(user);
    } catch (err) {
        console.error('[GET USER ERROR]', err);
        res.status(500).json({ error: 'Erro ao buscar usuário' });
    }
});

export default router;
