import express from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/index.js';
import { checkSubscription, isMaster } from '../middleware/subscription.js';

const router = express.Router();

// Middleware: Verify Token -> Check Sub (Sets isMaster) -> Verify Master
// Routes with administrative protection
// List All Users with Metrics
router.get('/admin/users', authenticateToken, checkSubscription, isMaster, async (req, res) => {
    try {
        console.log('[ADMIN] Fetching users list. Requester:', req.userId);
        const users = await prisma.user.findMany({
            include: {
                _count: {
                    select: {
                        automations: true,
                        flows: true,
                        dispatches: true
                    }
                }
            }
        });
        console.log(`[ADMIN] Found ${users.length} users.`);

        const formattedUsers = users.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            planType: u.planType,
            subscriptionStatus: u.subscriptionStatus,
            subscriptionExpiresAt: u.subscriptionExpiresAt,
            trialExpiresAt: u.trialExpiresAt,
            createdAt: u.createdAt,
            metrics: {
                automations: u._count.automations,
                flows: u._count.flows,
                dispatches: u._count.dispatches
            }
        }));

        res.json(formattedUsers);
    } catch (err) {
        console.error('Admin List Users Error:', err);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
});

// Get User Stats (Sends by Year)
router.get('/admin/users/:id/stats', authenticateToken, checkSubscription, isMaster, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { year } = req.query;
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        const startDate = new Date(`${targetYear}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${targetYear}-12-31T23:59:59.999Z`);

        // 1. Official API Stats
        // A. Dispatches (Bulk)
        const officialDispatches = await prisma.dispatch.aggregate({
            where: {
                userId,
                createdAt: { gte: startDate, lte: endDate },
                dispatchType: { in: ['template', 'waba'] } // broader check
            },
            _sum: { successCount: true }
        });

        // B. Manual Messages (ReceivedMessage where isFromMe=true)
        // We need the phoneId from userConfig
        const userConfig = await prisma.userConfig.findUnique({ where: { userId } });
        let manualOfficialCount = 0;

        if (userConfig?.phoneId) {
            manualOfficialCount = await prisma.receivedMessage.count({
                where: {
                    whatsappPhoneId: String(userConfig.phoneId),
                    isFromMe: true,
                    createdAt: { gte: startDate, lte: endDate }
                }
            });
        }

        const totalOfficial = (officialDispatches._sum.successCount || 0) + manualOfficialCount;

        // 2. Evolution API (EvolutionMessage)
        const evolutionMessages = await prisma.evolutionMessage.count({
            where: {
                userId,
                isFromMe: true,
                createdAt: { gte: startDate, lte: endDate }
            }
        });

        // 3. Email Campaigns (EmailCampaign)
        const emailCampaigns = await prisma.emailCampaign.aggregate({
            where: {
                userId,
                createdAt: { gte: startDate, lte: endDate }
            },
            _sum: { successCount: true }
        });

        const stats = [
            { id: 'official', name: 'WhatsApp Oficial (Meta)', count: totalOfficial, color: '#25D366' },
            { id: 'evolution', name: 'WhatsApp Evolution', count: evolutionMessages || 0, color: '#00a884' },
            { id: 'email', name: 'E-mail Marketing', count: emailCampaigns._sum.successCount || 0, color: '#EA4335' }
        ];

        res.json({ year: targetYear, stats });

    } catch (err) {
        console.error('Admin Get Stats Error:', err);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

// Update User Plan
router.post('/admin/users/:id/plan', authenticateToken, checkSubscription, isMaster, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { planType, trialDays, subscriptionStatus } = req.body;

        const data = {};
        if (planType) data.planType = planType;
        if (subscriptionStatus) {
            data.subscriptionStatus = subscriptionStatus;
            // If master manually activates, set a default 30 days if not set
            if (subscriptionStatus === 'active') {
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + 30);
                data.subscriptionExpiresAt = expiry;
                data.trialExpiresAt = expiry; // Match trial for consistency
            }
        }

        if (trialDays !== undefined && trialDays !== '') {
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + parseInt(trialDays));
            data.trialExpiresAt = expiry;
        }

        await prisma.user.update({
            where: { id: userId },
            data
        });

        res.json({ success: true, message: 'Usuário atualizado com sucesso' });
    } catch (err) {
        console.error('Admin Update User Error:', err);
        res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
});

export default router;
