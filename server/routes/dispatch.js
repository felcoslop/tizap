import express from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/index.js';

const router = express.Router();

// List Dispatch History
router.get('/dispatch/:userId', authenticateToken, async (req, res) => {
    try {
        const dispatches = await prisma.dispatch.findMany({
            where: { userId: parseInt(req.params.userId) },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        res.json(dispatches);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
});

// Get Dispatch Details & Logs
router.get('/dispatch/:userId/:id', authenticateToken, async (req, res) => {
    try {
        const dispatch = await prisma.dispatch.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { logs: { orderBy: { createdAt: 'desc' }, take: 50 } }
        });
        res.json(dispatch);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar detalhes' });
    }
});

// Delete Dispatch
router.delete('/dispatch/:id', authenticateToken, async (req, res) => {
    try {
        await prisma.dispatch.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao excluir campanha' });
    }
});

// Control Dispatch (pause, resume, stop)
router.post('/dispatch/:id/control', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { action } = req.body;

        const dispatch = await prisma.dispatch.findUnique({ where: { id } });
        if (!dispatch) {
            return res.status(404).json({ error: 'Disparo não encontrado' });
        }

        let newStatus;
        if (action === 'pause') {
            newStatus = 'paused';
        } else if (action === 'resume') {
            newStatus = 'running';
        } else if (action === 'stop') {
            newStatus = 'stopped';
        } else {
            return res.status(400).json({ error: 'Ação inválida' });
        }

        await prisma.dispatch.update({
            where: { id },
            data: { status: newStatus }
        });

        console.log(`[DISPATCH CONTROL] Dispatch ${id} -> ${newStatus}`);
        res.json({ success: true, status: newStatus });
    } catch (err) {
        console.error('[DISPATCH CONTROL ERROR]', err);
        res.status(500).json({ error: 'Erro ao controlar disparo' });
    }
});

export default router;
