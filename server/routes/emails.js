import express from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/index.js';
import { startEmailCampaign, stopEmailCampaign } from '../services/emailEngine.js';

const router = express.Router();

// Get Templates
router.get('/email-templates/:userId', authenticateToken, async (req, res) => {
    try {
        const templates = await prisma.emailTemplate.findMany({
            where: { userId: parseInt(req.params.userId) },
            orderBy: { createdAt: 'desc' }
        });
        res.json(templates);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar templates' });
    }
});

// Save/Update Template
router.post('/email-templates', authenticateToken, async (req, res) => {
    try {
        const { id, name, subject, html, userId } = req.body;
        let template;
        if (id) {
            template = await prisma.emailTemplate.update({
                where: { id: parseInt(id) },
                data: { name, subject, html }
            });
        } else {
            template = await prisma.emailTemplate.create({
                data: { name, subject, html, userId: parseInt(userId) }
            });
        }
        res.json(template);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao salvar template' });
    }
});

// Delete Template
router.delete('/email-templates/:id', authenticateToken, async (req, res) => {
    try {
        await prisma.emailTemplate.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao excluir template' });
    }
});

// Create Campaign
router.post('/email-campaigns', authenticateToken, async (req, res) => {
    try {
        const { name, subject, userId, templateId, leadsData } = req.body;
        const campaign = await prisma.emailCampaign.create({
            data: {
                name,
                subject: subject || name,
                userId: parseInt(userId),
                templateId: templateId ? parseInt(templateId) : null,
                leadsData: JSON.stringify(leadsData),
                totalLeads: leadsData.length
            }
        });

        // Start campaign immediately
        const broadcast = req.app.get('broadcastMessage');
        startEmailCampaign(campaign.id, broadcast);

        res.json({ success: true, campaignId: campaign.id });
    } catch (err) {
        console.error('[EMAIL CAMPAIGN CREATE ERROR]', err);
        res.status(500).json({ error: 'Erro ao criar campanha' });
    }
});

// Get Campaigns
router.get('/email-campaigns/:userId', authenticateToken, async (req, res) => {
    try {
        const campaigns = await prisma.emailCampaign.findMany({
            where: { userId: parseInt(req.params.userId) },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        res.json(campaigns);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar campanhas' });
    }
});

// Control Campaign
router.post('/email-campaigns/:id/control', authenticateToken, async (req, res) => {
    try {
        const { action } = req.body;
        const id = parseInt(req.params.id);

        if (action === 'stop' || action === 'pause') {
            stopEmailCampaign(id);
            await prisma.emailCampaign.update({
                where: { id },
                data: { status: action === 'stop' ? 'stopped' : 'paused' }
            });
        } else if (action === 'resume') {
            const broadcast = req.app.get('broadcastMessage');
            startEmailCampaign(id, broadcast);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao controlar campanha' });
    }
});

// Get Campaign Logs
router.get('/email-campaign-logs/:campaignId', authenticateToken, async (req, res) => {
    try {
        const logs = await prisma.emailCampaignLog.findMany({
            where: { campaignId: parseInt(req.params.campaignId) },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar logs' });
    }
});

export default router;
