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
