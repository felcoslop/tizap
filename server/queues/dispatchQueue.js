import { Queue, Worker } from 'bullmq';
import connection from '../config/redis.js';
import prisma from '../db.js';
import { sendWhatsApp } from '../services/whatsapp.js';
import FlowEngine from '../services/flowEngine.js';
import { sleep } from '../utils/helpers.js';

const QUEUE_NAME = 'dispatch_queue';

// Define the Queue
export const dispatchQueue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false
    }
});

// Broadcast helper (will be injected or imported)
let broadcastProgress = null;
export const setBroadcastCallback = (cb) => { broadcastProgress = cb; };

// Define the Worker
const workerHandler = async (job) => {
    const { dispatchId, lead, userConfig, dispatchType, flowId, templateName, variables, index, total } = job.data;

    // Check if dispatch is still running (circuit breaker)
    const dispatch = await prisma.dispatch.findUnique({ where: { id: dispatchId }, select: { status: true } });
    if (!dispatch || dispatch.status !== 'running') {
        return; // Stop processing this job if dispatch was stopped/paused
    }

    let phone = lead['Tel. Promax'] || lead['TELEFONE'] || lead['telefone'] || lead['Phone'] || lead['phone'];

    // Magic Pattern Finder
    if (!phone) {
        const values = Object.values(lead);
        for (const val of values) {
            if (val && (typeof val === 'string' || typeof val === 'number')) {
                const sVal = String(val).replace(/\D/g, '');
                if (sVal.startsWith('55') && (sVal.length === 12 || sVal.length === 13)) {
                    phone = sVal;
                    break;
                }
            }
        }
    }

    const log = async (ph, status, msg) => {
        await prisma.dispatchLog.create({ data: { dispatchId, phone: String(ph || 'N/A'), status, message: msg } });
        // Update counters
        const field = status === 'success' ? 'successCount' : 'errorCount';
        await prisma.dispatch.update({
            where: { id: dispatchId },
            data: {
                [field]: { increment: 1 },
                currentIndex: index + 1 // Approximate progress logic
            }
        });

        if (broadcastProgress) {
            broadcastProgress({
                dispatchId,
                currentIndex: index + 1,
                lastLog: { phone: ph, status, message: msg }
            });
        }
    };

    if (!phone) {
        await log('N/A', 'error', `Telefone não encontrado. Chaves: [${Object.keys(lead).join(', ')}]`);
        return;
    }

    try {
        if (dispatchType === 'flow' && flowId) {
            const flow = await prisma.flow.findUnique({ where: { id: flowId } });
            if (flow) {
                const nodes = JSON.parse(flow.nodes);
                const edges = JSON.parse(flow.edges);
                const startNodeId = FlowEngine.findStartNode(nodes, edges);
                const initialVars = { ...lead };
                const mappingVars = typeof variables === 'string' ? JSON.parse(variables || '{}') : (variables || {});

                let normalizedPhone = String(phone).replace(/\D/g, '');
                if (!normalizedPhone.startsWith('55')) normalizedPhone = '55' + normalizedPhone;

                const session = await prisma.flowSession.create({
                    data: {
                        flowId: flow.id,
                        contactPhone: normalizedPhone,
                        currentStep: String(startNodeId),
                        status: 'active',
                        variables: JSON.stringify({ ...initialVars, _mapping: mappingVars })
                    }
                });
                await FlowEngine.executeStep(session, flow, userConfig);
                await log(phone, 'success', 'Fluxo iniciado');
            }
        } else {
            // Template Mode
            const components = { header: [], body: [] };
            const mapping = JSON.parse(userConfig.mapping || '{}');

            Object.keys(mapping).forEach(key => {
                const col = mapping[key];
                if (lead[col]) {
                    const param = { name: key, value: String(lead[col]) };
                    if (key.includes('header')) components.header.push(param);
                    else components.body.push(param);
                }
            });

            const res = await sendWhatsApp(phone, userConfig, templateName, components);
            await log(phone, res.success ? 'success' : 'error', res.error || 'Mensagem enviada');
        }
    } catch (e) {
        await log(phone, 'error', e.message);
        throw e; // Throw to trigger BullMQ retry if needed
    }

    // Rate Limit/Pacing is handled by Worker configuration options, not sleep()
};

export const dispatchWorker = new Worker(QUEUE_NAME, workerHandler, {
    connection,
    concurrency: 5, // Start conservative
    limiter: {
        max: 10,      // Max jobs
        duration: 1000 // per second
    }
});

dispatchWorker.on('completed', job => {
    console.log(`[WORKER] Job ${job.id} completed`);
});

dispatchWorker.on('failed', (job, err) => {
    console.error(`[WORKER] Job ${job.id} failed: ${err.message}`);
});
