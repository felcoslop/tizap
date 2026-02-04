import prisma from '../db.js';
import { dispatchQueue } from '../queues/dispatchQueue.js';

// No longer needed as state is managed by BullMQ/Redis
// const activeJobs = new Map(); 

export const stopDispatch = async (id) => {
    // With queues, "stopping" is trickier. 
    // We update the status in DB to 'stopped'.
    // The Worker checks this status before processing each job.
    await prisma.dispatch.update({
        where: { id: parseInt(id) },
        data: { status: 'stopped' }
    });
    // We could also pause the queue or remove jobs, but the "Check DB status" pattern is robust enough.
};

export const startDispatch = async (req, res, broadcastProgress) => {
    try {
        const { userId, templateName, leadsData, dispatchType, flowId, variables } = req.body;

        // 1. Create the Dispatch Record
        const dispatch = await prisma.dispatch.create({
            data: {
                userId,
                templateName: templateName || 'N/A',
                status: 'running',
                totalLeads: leadsData.length,
                leadsData: JSON.stringify(leadsData), // Backup only
                dispatchType: dispatchType || 'template',
                flowId: flowId ? parseInt(flowId) : null,
                variables: variables ? JSON.stringify(variables) : '[]',
                dateOld: '',
                dateNew: ''
            },
            include: {
                user: {
                    include: { config: true }
                }
            }
        });

        const userConfig = dispatch.user.config;

        // 2. Add Jobs to Queue (Bulk Add)
        const jobs = leadsData.map((lead, index) => ({
            name: 'send-whatsapp',
            data: {
                dispatchId: dispatch.id,
                lead,
                userConfig, // Pass snapshot of config
                dispatchType,
                flowId: flowId ? parseInt(flowId) : null,
                templateName,
                variables,
                index,
                total: leadsData.length
            },
            opts: {
                removeOnComplete: true,
                removeOnFail: false // Keep failed jobs for manual inspection
            }
        }));

        await dispatchQueue.addBulk(jobs);

        res.json({ success: true, dispatchId: dispatch.id, message: 'Campanha enfileirada com sucesso!' });

        // Broadcast start
        broadcastProgress({ event: 'dispatch:start', data: { dispatchId: dispatch.id } });

    } catch (err) {
        console.error('[START DISPATCH ERROR]', err);
        res.status(500).json({ error: 'Erro ao iniciar campanha' });
    }
};
