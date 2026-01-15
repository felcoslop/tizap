console.log('[STARTUP] Starting server process...');
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB limit

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const prisma = new PrismaClient();

const PORT = process.env.PORT || 3000;
const WEBHOOK_VERIFY_TOKEN = 'ambev_webhook_token_2026';

// --- API: Upload Media ---
app.post('/api/upload-media', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        // Return relative URL
        const fileUrl = `/uploads/${req.file.filename}`;

        // Determine type based on mimetype
        let type = 'document';
        if (req.file.mimetype.startsWith('image/')) type = 'image';
        else if (req.file.mimetype.startsWith('audio/')) type = 'audio';
        else if (req.file.mimetype.startsWith('video/')) type = 'video';

        res.json({ url: fileUrl, type: type, filename: req.file.originalname });
    } catch (err) {
        console.error('Buffer upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// --- API: Messages Management ---
const clients = new Map(); // userId -> Set of WebSocket connections

wss.on('connection', (ws, req) => {
    console.log('[WS] New connection');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'auth' && data.userId) {
                const userIdStr = String(data.userId);
                // Associate this connection with a user
                if (!clients.has(userIdStr)) {
                    clients.set(userIdStr, new Set());
                }
                clients.get(userIdStr).add(ws);
                ws.userId = userIdStr;
                console.log(`[WS] Client authenticated for user ${userIdStr}`);
            }
        } catch (e) {
            console.error('[WS] Parse error:', e);
        }
    });

    ws.on('close', () => {
        if (ws.userId) {
            const userIdStr = String(ws.userId);
            if (clients.has(userIdStr)) {
                clients.get(userIdStr).delete(ws);
                if (clients.get(userIdStr).size === 0) {
                    clients.delete(userIdStr);
                }
            }
        }
        console.log('[WS] Client disconnected');
    });
});

// Broadcast to all connections of a specific user
function broadcast(userId, event, data) {
    const targetUserId = String(userId);
    if (clients.has(targetUserId)) {
        const message = JSON.stringify({ event, data });
        clients.get(targetUserId).forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        });
    }
}

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));

// --- Debug Middleware ---
app.use((req, res, next) => {
    if (req.path === '/webhook') {
        console.log(`[DEBUG] ${req.method} ${req.path} - ${new Date().toISOString()}`);
    }
    next();
});

// --- Health Check ---
app.get('/health', (req, res) => res.send('OK'));

// --- AUTH ROUTES ---

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { email, name, password } = req.body;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(400).json({ error: 'E-mail já cadastrado' });
        }

        const user = await prisma.user.create({
            data: { email, name, password }
        });

        // Create empty config
        await prisma.userConfig.create({
            data: { userId: user.id }
        });

        res.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
    } catch (err) {
        console.error('[REGISTER ERROR]', err);
        res.status(500).json({ error: 'Erro ao cadastrar usuário' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({
            where: { email },
            include: { config: true }
        });

        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'E-mail ou senha incorretos' });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                config: user.config ? {
                    token: user.config.token,
                    phoneId: user.config.phoneId,
                    wabaId: user.config.wabaId,
                    templateName: user.config.templateName,
                    mapping: JSON.parse(user.config.mapping || '{}'),
                    webhookVerifyToken: user.config.webhookVerifyToken
                } : null
            }
        });
    } catch (err) {
        console.error('[LOGIN ERROR]', err);
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// --- USER ROUTES ---

// Get user with config
app.get('/api/user/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { config: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            config: user.config ? {
                token: user.config.token,
                phoneId: user.config.phoneId,
                wabaId: user.config.wabaId,
                templateName: user.config.templateName,
                mapping: JSON.parse(user.config.mapping || '{}'),
                webhookVerifyToken: user.config.webhookVerifyToken
            } : null
        });
    } catch (err) {
        console.error('[GET USER ERROR]', err);
        res.status(500).json({ error: 'Erro ao buscar usuário' });
    }
});

// Update config
app.put('/api/config/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const { token, phoneId, wabaId, templateName, mapping, webhookVerifyToken } = req.body;
        console.log(`[CONFIG] Updating User ${userId} with:`, JSON.stringify(req.body, null, 2));

        const config = await prisma.userConfig.upsert({
            where: { userId },
            update: {
                token: token ?? undefined,
                phoneId: phoneId ?? undefined,
                wabaId: wabaId ?? undefined,
                templateName: templateName ?? undefined,
                mapping: mapping ? JSON.stringify(mapping) : undefined,
                webhookVerifyToken: webhookVerifyToken ?? undefined
            },
            create: {
                userId,
                token: token || '',
                phoneId: phoneId || '',
                wabaId: wabaId || '',
                templateName: templateName || '',
                mapping: JSON.stringify(mapping || {}),
                webhookVerifyToken: webhookVerifyToken || ''
            }
        });

        res.json({ success: true, config });
    } catch (err) {
        console.error('[CONFIG ERROR]', err);
        res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
});

// --- DISPATCH ROUTES ---

// Get all dispatches for user
app.get('/api/dispatch/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        const dispatches = await prisma.dispatch.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { logs: true } }
            }
        });

        res.json(dispatches.map(d => ({
            ...d,
            leadsData: undefined, // Don't send full leads data in list
            logCount: d._count.logs
        })));
    } catch (err) {
        console.error('[GET DISPATCHES ERROR]', err);
        res.status(500).json({ error: 'Erro ao buscar disparos' });
    }
});

// Get specific dispatch with logs
app.get('/api/dispatch/:userId/:dispatchId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const dispatchId = parseInt(req.params.dispatchId);

        const dispatch = await prisma.dispatch.findFirst({
            where: { id: dispatchId, userId },
            include: {
                logs: {
                    orderBy: { createdAt: 'desc' },
                    take: 100
                }
            }
        });

        if (!dispatch) {
            return res.status(404).json({ error: 'Disparo não encontrado' });
        }

        res.json(dispatch);
    } catch (err) {
        console.error('[GET DISPATCH ERROR]', err);
        res.status(500).json({ error: 'Erro ao buscar disparo' });
    }
});

// --- ACTIVE JOBS MAP ---
const activeJobs = new Map(); // dispatchId -> { intervalId, shouldStop }

// --- HELPER: SLEEP ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- HELPER: SEND WHATSAPP ---
const sendWhatsApp = async (phone, config, templateName, components) => {
    try {
        let normalizedPhone = String(phone).replace(/\D/g, '');
        if (normalizedPhone && !normalizedPhone.startsWith('55')) {
            normalizedPhone = '55' + normalizedPhone;
        }

        const url = `https://graph.facebook.com/v21.0/${config.phoneId}/messages`;
        const finalTemplateName = String(templateName).trim();

        const metaComponents = [];

        if (components.header && components.header.length > 0) {
            metaComponents.push({
                type: "header",
                parameters: components.header.map(v => {
                    const param = { type: "text" };
                    if (typeof v === 'object' && v.name) {
                        // Only add parameter_name if it's not a simple number
                        if (isNaN(parseInt(v.name, 10))) {
                            param.parameter_name = v.name;
                        }
                        param.text = String(v.value || '').trim();
                    } else {
                        param.text = String(v || '').trim();
                    }
                    return param;
                })
            });
        }

        if (components.body && components.body.length > 0) {
            metaComponents.push({
                type: "body",
                parameters: components.body.map(v => {
                    const param = { type: "text" };
                    if (typeof v === 'object' && v.name) {
                        // Only add parameter_name if it's not a simple number
                        if (isNaN(parseInt(v.name, 10))) {
                            param.parameter_name = v.name;
                        }
                        param.text = String(v.value || '').trim();
                    } else {
                        param.text = String(v || '').trim();
                    }
                    return param;
                })
            });
        }

        const payload = {
            messaging_product: "whatsapp",
            to: normalizedPhone,
            type: "template",
            template: {
                name: finalTemplateName,
                language: { code: "pt_BR" },
                components: metaComponents
            }
        };

        console.log(`[META] Sending to ${normalizedPhone} using PhoneId: ${config.phoneId}`);
        console.log(`[META] Payload Preview:`, JSON.stringify(payload, null, 2));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('[META ERROR]', JSON.stringify(data, null, 2));
            return { success: false, error: data.error?.message || 'Erro no Meta' };
        }

        return { success: true, phone: normalizedPhone };
    } catch (err) {
        return { success: false, error: err.message };
    }
};



// --- PROCESS DISPATCH (Background Worker) ---
async function processDispatch(dispatchId) {
    console.log(`[JOB ${dispatchId}] Starting...`);

    try {
        const dispatch = await prisma.dispatch.findUnique({
            where: { id: dispatchId },
            include: { user: { include: { config: true } } }
        });

        console.log(`[JOB ${dispatchId}] User Config:`, dispatch?.user?.config ? 'Found' : 'Missing');

        if (!dispatch || !dispatch.user.config) {
            console.error(`[JOB ${dispatchId}] No dispatch or config found`);
            return;
        }

        const config = dispatch.user.config;

        console.log(`[JOB ${dispatchId}] DEBUG CONFIG:`, JSON.stringify(config, null, 2));

        if (!config || !config.token || !config.phoneId) {
            console.error(`[JOB ${dispatchId}] MISSING CREDENTIALS. Token: ${!!config?.token}, PhoneId: ${!!config?.phoneId}`);
        }
        const leads = JSON.parse(dispatch.leadsData);
        const userId = dispatch.userId;

        // Ensure status is running if it was idle or paused
        if (dispatch.status !== 'running') {
            await prisma.dispatch.update({
                where: { id: dispatchId },
                data: { status: 'running' }
            });
            broadcast(userId, 'dispatch:status', { dispatchId, status: 'running' });
        }

        for (let i = dispatch.currentIndex; i < leads.length; i++) {
            // Check if job should stop
            const job = activeJobs.get(dispatchId);
            if (!job || job.shouldStop) {
                console.log(`[JOB ${dispatchId}] Paused at index ${i}`);
                await prisma.dispatch.update({
                    where: { id: dispatchId },
                    data: { status: 'paused', currentIndex: i }
                });
                broadcast(userId, 'dispatch:status', { dispatchId, status: 'paused' });
                activeJobs.delete(dispatchId);
                return;
            }

            const lead = leads[i];
            const phone = lead['Tel. Promax'] || lead['phone'] || lead['telefone'] || lead['Tel.'];

            console.log(`[JOB ${dispatchId}] Processing lead ${i}/${leads.length} - Phone: ${phone || 'NONE'}`);

            if (!phone) {
                console.warn(`[JOB ${dispatchId}] Skipping lead at index ${i} - No phone found`);
                await prisma.dispatch.update({
                    where: { id: dispatchId },
                    data: { currentIndex: i + 1 }
                });
                continue;
            }

            // Resolve variables for this lead
            const variableMapping = JSON.parse(dispatch.variables || "{}");
            const headerParams = [];
            const bodyParams = [];

            // Sort variables by their 'order' property captured in the frontend.
            // This ensures parameters are sent in the exact sequence they appear in the template text.
            console.log(`[DEBUG] Received variables from UI: ${dispatch.variables}`);
            const sortedKeys = Object.keys(variableMapping).sort((a, b) => {
                const orderA = variableMapping[a].order !== undefined ? variableMapping[a].order : 999;
                const orderB = variableMapping[b].order !== undefined ? variableMapping[b].order : 999;
                return orderA - orderB;
            });

            sortedKeys.forEach(key => {
                const info = variableMapping[key];
                const value = info.type === 'column' ? lead[info.value] : info.value;
                const finalValue = String(value || '').substring(0, 100);

                const paramObj = { name: info.index, value: finalValue };
                if (info.component === 'HEADER') {
                    headerParams.push(paramObj);
                } else if (info.component === 'BODY') {
                    bodyParams.push(paramObj);
                }
            });

            console.log(`[DEBUG] Final Header Params: ${JSON.stringify(headerParams)}`);
            console.log(`[DEBUG] Final Body Params: ${JSON.stringify(bodyParams)}`);

            let result;
            if (dispatch.dispatchType === 'flow' && dispatch.flowId) {
                try {
                    // Normalize phone
                    let normalized = String(phone).replace(/\D/g, '');
                    if (!normalized.startsWith('55')) normalized = '55' + normalized;

                    // Fetch flow info
                    const flow = await prisma.flow.findUnique({ where: { id: dispatch.flowId } });
                    if (flow) {
                        const nodes = JSON.parse(flow.nodes);
                        const edges = JSON.parse(flow.edges);
                        const initialNodeId = FlowEngine.findStartNode(nodes, edges);

                        // NEW: Build lead-specific variables based on mapping
                        // We store the full info (value, index, order, component) so FlowEngine can reconstruct parameters correctly.
                        const leadVariables = {};
                        Object.keys(variableMapping).forEach(key => {
                            const info = variableMapping[key];
                            const val = info.type === 'column' ? lead[info.value] : info.value;
                            leadVariables[key] = {
                                value: val,
                                index: info.index,
                                order: info.order,
                                component: info.component
                            };
                        });

                        // Clean up existing sessions for this phone and flow to avoid duplicates in the history
                        await prisma.flowSession.deleteMany({
                            where: {
                                contactPhone: normalized,
                                flowId: dispatch.flowId
                            }
                        });

                        const session = await prisma.flowSession.create({
                            data: {
                                flowId: dispatch.flowId,
                                contactPhone: normalized,
                                currentStep: initialNodeId,
                                status: 'active',
                                variables: JSON.stringify(leadVariables)
                            }
                        });

                        // Start flow
                        await FlowEngine.executeStep(session, flow, config);
                        result = { success: true, phone: normalized };
                    } else {
                        result = { success: false, error: 'Fluxo não encontrado' };
                    }
                } catch (flowErr) {
                    result = { success: false, error: flowErr.message };
                }
            } else {
                console.log(`[JOB ${dispatchId}] Sending WhatsApp template "${dispatch.templateName}" to ${phone}`);
                const resultTemp = await sendWhatsApp(phone, config, dispatch.templateName, { header: headerParams, body: bodyParams });
                result = resultTemp;
            }

            console.log(`[JOB ${dispatchId}] Result for ${phone}:`, result.success ? 'Success' : `Error: ${result.error}`);

            // Create log
            await prisma.dispatchLog.create({
                data: {
                    dispatchId,
                    phone: String(result.phone || phone || ''),
                    status: result.success ? 'success' : 'error',
                    message: result.success ? null : result.error
                }
            });

            if (result.success) {
                try {
                    // Unified History: Fallback to dynamic description
                    const clientName = String(lead['Nome fantasia'] || lead['fantasy_name'] || lead['nome'] || 'Eu').substring(0, 100);
                    const unifiedBody = `Template: ${dispatch.templateName} enviado com sucesso.`;

                    await prisma.receivedMessage.create({
                        data: {
                            whatsappPhoneId: String(config.phoneId),
                            contactPhone: String(result.phone || phone).replace(/\D/g, ''),
                            contactName: clientName,
                            messageBody: unifiedBody,
                            isFromMe: true,
                            isRead: true
                        }
                    });

                    // Trigger UI to fetch messages immediately
                    broadcast(userId, 'message:received', {});
                } catch (histErr) {
                    console.error('[UNIFIED HISTORY ERROR]', histErr);
                }
            }

            // Update database state
            const updateData = {
                currentIndex: i + 1,
            };
            if (result.success) {
                updateData.successCount = { increment: 1 };
            } else {
                updateData.errorCount = { increment: 1 };
            }

            const updated = await prisma.dispatch.update({
                where: { id: dispatchId },
                data: updateData
            });

            // Broadcast progress to UI
            broadcast(userId, 'dispatch:progress', {
                dispatchId,
                currentIndex: i + 1,
                totalLeads: leads.length,
                successCount: updated.successCount,
                errorCount: updated.errorCount,
                status: 'running',
                lastLog: {
                    phone: result.phone || phone,
                    status: result.success ? 'success' : 'error',
                    message: result.error || null
                }
            });

            // Rate limit (approx 5 msgs per second)
            await sleep(200);
        }

        // Loop finished naturally
        console.log(`[JOB ${dispatchId}] Loop finished. Checking final counts...`);

        const finalDispatch = await prisma.dispatch.findUnique({
            where: { id: dispatchId },
            select: { successCount: true, errorCount: true }
        });

        const finalStatus = finalDispatch.errorCount > 0 ? 'error' : 'completed';

        console.log(`[JOB ${dispatchId}] Final Status: ${finalStatus} (S:${finalDispatch.successCount}, E:${finalDispatch.errorCount})`);

        await prisma.dispatch.update({
            where: { id: dispatchId },
            data: { status: finalStatus, currentIndex: leads.length }
        });

        // Force 100% progress update with final status
        broadcast(userId, 'dispatch:progress', {
            dispatchId,
            currentIndex: leads.length,
            totalLeads: leads.length,
            successCount: finalDispatch.successCount,
            errorCount: finalDispatch.errorCount,
            status: finalStatus,
            lastLog: { status: finalStatus, message: finalStatus === 'completed' ? 'Finalizado com sucesso' : 'Finalizado com erros' }
        });

        broadcast(userId, 'dispatch:status', {
            dispatchId,
            status: finalStatus,
            successCount: finalDispatch.successCount,
            errorCount: finalDispatch.errorCount
        });

        broadcast(userId, 'dispatch:complete', { dispatchId });
        activeJobs.delete(dispatchId);

    } catch (err) {
        console.error(`[JOB ${dispatchId}] Fatal error:`, err);
        // Attempt to set status to error so it's not stuck 'running'
        try {
            await prisma.dispatch.update({
                where: { id: dispatchId },
                data: { status: 'error' }
            });
            // We don't have direct access to userId in some catch paths, 
            // but we can try to find it or just let the polling handle it.
        } catch (subErr) {
            console.error('[CRITICAL] Failed to update job status to error:', subErr);
        }
    }
}


// Create and start dispatch
app.post('/api/dispatch/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const { templateName, dateOld, dateNew, leads } = req.body;

        if (!leads || !leads.length) {
            return res.status(400).json({ error: 'Nenhum lead fornecido' });
        }

        // Check for existing running dispatch for this user
        const running = await prisma.dispatch.findFirst({
            where: { userId, status: { in: ['running', 'idle'] } }
        });

        if (running) {
            return res.status(400).json({ error: 'Já existe um disparo em andamento' });
        }

        // Create dispatch
        const dispatch = await prisma.dispatch.create({
            data: {
                userId,
                templateName: templateName || "Fluxo",
                dispatchType: req.body.dispatchType || 'template',
                flowId: req.body.flowId ? parseInt(req.body.flowId) : null,
                dateOld: dateOld || "",
                dateNew: dateNew || "",
                variables: JSON.stringify(req.body.variables || []),
                totalLeads: leads.length,
                leadsData: JSON.stringify(leads),
                status: 'running'
            }
        });

        // Register job
        activeJobs.set(dispatch.id, { shouldStop: false });

        // IMPORTANT: Start processing in next tick to avoid blocking the request
        setImmediate(() => {
            processDispatch(dispatch.id).catch(err => {
                console.error(`[CRITICAL] Background job ${dispatch.id} failed:`, err);
            });
        });

        res.json({ success: true, dispatchId: dispatch.id });
    } catch (err) {
        console.error('[CREATE DISPATCH ERROR]', err);
        res.status(500).json({ error: 'Erro ao criar disparo' });
    }
});

// Control dispatch (pause/resume/stop)
app.post('/api/dispatch/:dispatchId/control', async (req, res) => {
    try {
        const dispatchId = parseInt(req.params.dispatchId);
        const { action } = req.body; // pause, resume, stop

        const dispatch = await prisma.dispatch.findUnique({
            where: { id: dispatchId }
        });

        if (!dispatch) {
            return res.status(404).json({ error: 'Disparo não encontrado' });
        }

        if (action === 'pause') {
            const job = activeJobs.get(dispatchId);
            if (job) job.shouldStop = true;
            await prisma.dispatch.update({
                where: { id: dispatchId },
                data: { status: 'paused' }
            });
            broadcast(dispatch.userId, 'dispatch:status', { dispatchId, status: 'paused' });
        } else if (action === 'resume') {
            // Check if another job is running
            const running = await prisma.dispatch.findFirst({
                where: { userId: dispatch.userId, status: 'running' }
            });

            if (running && running.id !== dispatchId) {
                return res.status(400).json({ error: 'Já existe um outro disparo em andamento.' });
            }

            activeJobs.set(dispatchId, { shouldStop: false });
            processDispatch(dispatchId);
            // status update is handled inside processDispatch
        } else if (action === 'stop') {
            const job = activeJobs.get(dispatchId);
            if (job) job.shouldStop = true;
            await prisma.dispatch.update({
                where: { id: dispatchId },
                data: { status: 'stopped' }
            });
            broadcast(dispatch.userId, 'dispatch:status', { dispatchId, status: 'stopped' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[CONTROL DISPATCH ERROR]', err);
        res.status(500).json({ error: 'Erro ao controlar disparo' });
    }
});

// Retry failed leads only
app.post('/api/dispatch/:dispatchId/retry', async (req, res) => {
    try {
        const dispatchId = parseInt(req.params.dispatchId);

        const dispatch = await prisma.dispatch.findUnique({
            where: { id: dispatchId },
            include: { logs: { orderBy: { createdAt: 'desc' } } }
        });

        if (!dispatch) return res.status(404).json({ error: 'Disparo não encontrado' });

        // Get leads that failed (status 'error')
        // We match by phone number in logs
        const failedLogs = dispatch.logs.filter(l => l.status === 'error');
        if (failedLogs.length === 0) {
            return res.status(400).json({ error: 'Não há envios com erro para reintentar.' });
        }

        const allLeads = JSON.parse(dispatch.leadsData);

        // Helper to normalize phone numbers consistently
        const normalize = (p) => {
            let n = String(p || '').replace(/\D/g, '');
            if (n && !n.startsWith('55')) n = '55' + n;
            return n;
        };

        const failedPhones = new Set(failedLogs.map(l => normalize(l.phone)));

        const leadsToRetry = allLeads.filter(lead => {
            const p = normalize(lead['Tel. Promax'] || lead['phone'] || lead['telefone'] || lead['Tel.']);
            return p && failedPhones.has(p);
        });

        if (leadsToRetry.length === 0) {
            console.error('[RETRY] Could not map failed phones back to leads. Failed phones:', Array.from(failedPhones));
            return res.status(400).json({ error: 'Não foi possível mapear os erros para os leads originais.' });
        }


        // Create a NEW dispatch for these retries (easier to track)
        const newDispatch = await prisma.dispatch.create({
            data: {
                userId: dispatch.userId,
                templateName: dispatch.templateName,
                dateOld: dispatch.dateOld,
                dateNew: dispatch.dateNew,
                totalLeads: leadsToRetry.length,
                leadsData: JSON.stringify(leadsToRetry),
                status: 'running'
            }
        });

        activeJobs.set(newDispatch.id, { shouldStop: false });
        processDispatch(newDispatch.id);

        res.json({ success: true, dispatchId: newDispatch.id, message: `Iniciado reenvio para ${leadsToRetry.length} leads.` });

    } catch (err) {
        console.error('[RETRY ERROR]', err);
        res.status(500).json({ error: 'Erro ao reintentar disparos' });
    }
});


// --- MESSAGES ROUTES ---
// Fetch templates from Meta for a specific user Configuration
app.get('/api/meta/templates/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const { templateName } = req.query;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { config: true }
        });

        if (!user || !user.config || !user.config.token || !user.config.wabaId) {
            return res.status(400).json({ error: 'Configuração de WABA/Token incompleta' });
        }

        const { token, wabaId } = user.config;

        // Meta Graph API URL to fetch templates
        // We filter by name in the query to be efficient
        let url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates`;
        if (templateName) {
            url += `?name=${encodeURIComponent(templateName)}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[META TEMPLATE FETCH ERROR]', data);
            throw new Error(data.error?.message || 'Erro ao buscar templates no Meta');
        }

        // Return the specific template data
        res.json(data);
    } catch (err) {
        console.error('[GET META TEMPLATES ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});
const validatePhoneAccess = async (phoneId, token) => {
    if (!phoneId || !token) return false;
    const config = await prisma.userConfig.findFirst({
        where: { phoneId: String(phoneId), token: String(token) }
    });
    return !!config;
};

// Get received messages
app.get('/api/messages', async (req, res) => {
    try {
        const { phoneId, token } = req.query;
        if (!phoneId) return res.status(400).json({ error: 'phoneId é obrigatório' });

        const hasAccess = await validatePhoneAccess(phoneId, token);
        if (!hasAccess) return res.status(403).json({ error: 'Acesso negado. Token inválido para este Phone ID.' });

        const messages = await prisma.receivedMessage.findMany({
            where: { whatsappPhoneId: String(phoneId) },
            orderBy: { createdAt: 'desc' },
            take: 200
        });
        res.json(messages);
    } catch (err) {
        console.error('[GET MESSAGES ERROR]', err);
        res.status(500).json({ error: 'Erro ao buscar mensagens' });
    }
});

// Mark messages as read
app.post('/api/messages/mark-read', async (req, res) => {
    try {
        const { phone, phones, phoneId, token } = req.body;
        const targetPhones = phones || [phone];

        if (!phoneId) return res.status(400).json({ error: 'phoneId é obrigatório' });

        const hasAccess = await validatePhoneAccess(phoneId, token);
        if (!hasAccess) return res.status(403).json({ error: 'Acesso negado.' });

        await prisma.receivedMessage.updateMany({
            where: {
                whatsappPhoneId: String(phoneId),
                contactPhone: { in: targetPhones },
                isRead: false
            },
            data: { isRead: true }
        });
        res.json({ success: true });
    } catch (err) {
        console.error('[MARK READ ERROR]', err);
        res.status(500).json({ error: 'Erro ao marcar como lida' });
    }
});

// Delete messages
app.post('/api/messages/delete', async (req, res) => {
    try {
        const { phones, phoneId, token } = req.body;
        if (!phoneId) return res.status(400).json({ error: 'phoneId é obrigatório' });

        const hasAccess = await validatePhoneAccess(phoneId, token);
        if (!hasAccess) return res.status(403).json({ error: 'Acesso negado.' });

        if (!phones || !Array.isArray(phones) || phones.length === 0) {
            return res.status(400).json({ error: 'Nenhum telefone fornecido' });
        }
        await prisma.receivedMessage.deleteMany({
            where: {
                whatsappPhoneId: String(phoneId),
                contactPhone: { in: phones }
            }
        });
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE MESSAGES ERROR]', err);
        res.status(500).json({ error: 'Erro ao excluir mensagens' });
    }
});

// Proxy route for contact profile photos
app.get('/api/contacts/:phone/photo', async (req, res) => {
    try {
        const { phone } = req.params;
        const name = req.query.name || 'Contact';

        // NOTE: Official WhatsApp Cloud API does NOT provide an endpoint to fetch contact profile pictures.
        // To get real photos, you would normally use a third-party API like Whapi.Cloud or similar.
        // For now, we provide a consistent route that returns a styled avatar.

        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=280091&color=fff&size=500`;

        // Redirect to the avatar service (or fetch and pipe if you want to mask it)
        res.redirect(avatarUrl);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao processar foto' });
    }
});

// Send individual message
app.post('/api/send-message', async (req, res) => {
    try {
        const { userId, phone, text, mediaUrl, mediaType } = req.body;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { config: true }
        });

        if (!user || !user.config) {
            return res.status(400).json({ error: 'Configuração não encontrada' });
        }

        const config = user.config;
        let normalizedPhone = String(phone).replace(/\D/g, '');
        if (!normalizedPhone.startsWith('55')) {
            normalizedPhone = '55' + normalizedPhone;
        }

        const url = `https://graph.facebook.com/v21.0/${config.phoneId}/messages`;
        let payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: normalizedPhone,
        };

        if (mediaUrl && mediaType) {
            console.log(`[SEND MESSAGE] Uploading media to Meta for User ${userId}. URL: ${mediaUrl}, Type: ${mediaType}`);
            const mediaId = await uploadMediaToMeta(mediaUrl, mediaType, config);

            if (!mediaId) {
                return res.status(500).json({ error: 'Erro ao processar mídia para o WhatsApp' });
            }

            payload.type = mediaType;
            payload[mediaType] = { id: mediaId };
            if (mediaType === 'image' && text) {
                payload.image.caption = text;
            }
        } else {
            console.log(`[SEND MESSAGE] Sending text message for User ${userId}.`);
            payload.type = "text";
            payload.text = { body: text };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || 'Erro ao enviar mensagem');
        }

        // Log sent message
        await prisma.receivedMessage.create({
            data: {
                whatsappPhoneId: String(config.phoneId),
                contactPhone: normalizedPhone,
                contactName: 'Eu',
                messageBody: text || `[${mediaType?.toUpperCase()}]`,
                mediaUrl: mediaUrl || null,
                mediaType: mediaType || null,
                isFromMe: true,
                isRead: true
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[SEND MESSAGE ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// --- FLOWS ROUTES ---

// Get all flows for user
app.get('/api/flows/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const flows = await prisma.flow.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(flows);
    } catch (err) {
        console.error('[GET FLOWS ERROR]', err);
        res.status(500).json({ error: 'Erro ao buscar fluxos' });
    }
});

// Get specific flow
app.get('/api/flows/:userId/:flowId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const flowId = parseInt(req.params.flowId);
        const flow = await prisma.flow.findFirst({
            where: { id: flowId, userId }
        });
        if (!flow) return res.status(404).json({ error: 'Fluxo não encontrado' });
        res.json(flow);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar fluxo' });
    }
});

// Create flow
app.post('/api/flows/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const { name, nodes, edges } = req.body;
        const flow = await prisma.flow.create({
            data: {
                userId,
                name,
                nodes: JSON.stringify(nodes || []),
                edges: JSON.stringify(edges || [])
            }
        });
        res.json({ success: true, flow });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao criar fluxo' });
    }
});

// Update flow
app.put('/api/flows/:userId/:flowId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const flowId = parseInt(req.params.flowId);
        const { name, nodes, edges } = req.body;

        const flow = await prisma.flow.updateMany({
            where: { id: flowId, userId },
            data: {
                name,
                nodes: JSON.stringify(nodes),
                edges: JSON.stringify(edges)
            }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar fluxo' });
    }
});

// Delete flow
app.delete('/api/flows/:userId/:flowId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const flowId = parseInt(req.params.flowId);
        await prisma.flow.deleteMany({
            where: { id: flowId, userId }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao excluir fluxo' });
    }
});

// Start flow for contacts
app.post('/api/flows/:flowId/start', async (req, res) => {
    try {
        const flowId = parseInt(req.params.flowId);
        const { phones } = req.body; // Array of phone numbers

        const flow = await prisma.flow.findUnique({
            where: { id: flowId },
            include: { user: { include: { config: true } } }
        });

        if (!flow) return res.status(404).json({ error: 'Fluxo não encontrado' });

        const nodes = JSON.parse(flow.nodes);
        const edges = JSON.parse(flow.edges);
        const startNode = nodes.find(n => n.type === 'start' || n.data?.isStart);
        // Use robust start node detection
        const initialNodeId = FlowEngine.findStartNode(nodes, edges);

        if (!initialNodeId) return res.status(400).json({ error: 'Fluxo vazio' });

        let count = 0;
        for (let phone of phones) {
            let normalized = String(phone).replace(/\D/g, '');
            if (!normalized.startsWith('55')) normalized = '55' + normalized;

            // Create or update session
            // We terminate old session if exists for this specific flow and phone
            await prisma.flowSession.deleteMany({
                where: { contactPhone: normalized, flowId: flowId }
            });

            const session = await prisma.flowSession.create({
                data: {
                    flowId,
                    contactPhone: normalized,
                    currentStep: initialNodeId,
                    status: 'active',
                    variables: '{}'
                }
            });

            // Trigger first step execution immediately
            await FlowEngine.executeStep(session, flow, flow.user.config);
            count++;
        }

        res.json({ success: true, count });
    } catch (err) {
        console.error('[START FLOW ERROR]', err);
        res.status(500).json({ error: 'Erro ao iniciar fluxo' });
    }
});

// Get flow sessions for history
app.get('/api/flow-sessions/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        // Get all flows for this user
        const flows = await prisma.flow.findMany({
            where: { userId },
            select: { id: true, name: true, nodes: true }
        });

        const flowIds = flows.map(f => f.id);

        // Get all sessions for these flows
        const sessions = await prisma.flowSession.findMany({
            where: { flowId: { in: flowIds } },
            orderBy: { updatedAt: 'desc' },
            take: 100
        });

        // Enrich sessions with flow name and current step name
        const enrichedSessions = sessions.map(session => {
            const flow = flows.find(f => f.id === session.flowId);
            let currentStepName = 'Desconhecido';

            if (flow && session.currentStep) {
                try {
                    const nodes = JSON.parse(flow.nodes);
                    const node = nodes.find(n => String(n.id) === String(session.currentStep));
                    if (node) {
                        currentStepName = node.data?.label || node.data?.templateName || `Nó ${node.id}`;
                    }
                } catch (e) { }
            }

            return {
                ...session,
                flowName: flow?.name || 'Fluxo removido',
                currentStepName
            };
        });

        res.json(enrichedSessions);
    } catch (err) {
        console.error('[GET FLOW SESSIONS ERROR]', err);
        res.status(500).json({ error: 'Erro ao buscar sessões' });
    }
});

// Stop/Cancel flow session
app.post('/api/flow-sessions/:id/stop', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.id);
        await prisma.flowSession.update({
            where: { id: sessionId },
            data: { status: 'stopped' }
        });

        // Log the cancellation
        await prisma.flowSessionLog.create({
            data: {
                sessionId: sessionId,
                action: 'stopped',
                details: 'Fluxo interrompido pelo usuário'
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao interromper fluxo' });
    }
});

// Get logs for a specific flow session
app.get('/api/flow-session-logs/:sessionId', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.sessionId);

        const logs = await prisma.flowSessionLog.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'asc' }
        });

        res.json(logs);
    } catch (err) {
        console.error('[GET SESSION LOGS ERROR]', err);
        res.status(500).json({ error: 'Erro ao buscar logs' });
    }
});

// Check if there's any active flow campaign or individual session
app.get('/api/flow-sessions/active-check/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        // 1. Check for running campaigns (Dispatches)
        const activeDispatch = await prisma.dispatch.findFirst({
            where: { userId, status: { in: ['running', 'idle'] } }
        });

        // 2. Check for active individual flow sessions
        const activeSessions = await prisma.flowSession.count({
            where: {
                flow: { userId: userId },
                status: { in: ['active', 'waiting_reply'] }
            }
        });

        res.json({
            isBusy: !!activeDispatch || activeSessions > 0,
            hasActiveDispatch: !!activeDispatch,
            activeDispatchId: activeDispatch?.id,
            activeSessionCount: activeSessions
        });
    } catch (err) {
        console.error('[ACTIVE CHECK ERROR]', err);
        res.status(500).json({ error: 'Erro ao verificar atividades' });
    }
});

// --- FLOW ENGINE LOGIC ---
const FlowEngine = {
    async logAction(sessionId, nodeId, nodeName, action, details) {
        try {
            await prisma.flowSessionLog.create({
                data: { sessionId, nodeId, nodeName, action, details }
            });
        } catch (e) {
            console.error('[FLOW LOG ERROR]', e);
        }
    },

    // Robust start node detection: finds the visual root of a flow
    findStartNode(nodes, edges) {
        // 1. Look for explicit start node (type or data property)
        const explicitStart = nodes.find(n => n.data?.isStart || n.type === 'start');
        if (explicitStart) {
            console.log(`[FLOW] Found explicit start node: ${explicitStart.id}`);
            return explicitStart.id;
        }

        // 2. Find nodes with no incoming edges (visual roots)
        const targetIds = new Set(edges.map(e => String(e.target)));
        const roots = nodes.filter(n => !targetIds.has(String(n.id)));

        if (roots.length > 0) {
            // Prefer messageNode or templateNode if multiple roots exist
            const preferredRoot = roots.find(n =>
                n.type === 'messageNode' || n.type === 'templateNode'
            );
            const selectedRoot = preferredRoot || roots[0];
            console.log(`[FLOW] Found root node (no incoming edges): ${selectedRoot.id} (type: ${selectedRoot.type})`);
            return selectedRoot.id;
        }

        // 3. Fallback to first node
        console.log(`[FLOW] No root found, falling back to nodes[0]: ${nodes[0]?.id}`);
        return nodes[0]?.id;
    },

    async executeStep(session, flow, configInput) {
        try {
            // Always fetch the freshest config from DB to ensure updates are reflected
            const userConfig = await prisma.userConfig.findUnique({
                where: { userId: flow.userId }
            });

            if (!userConfig || !userConfig.token || !userConfig.phoneId) {
                console.error(`[FLOW] No valid config found for user ${flow.userId}`);
                await this.logAction(session.id, session.currentStep, null, 'error', 'Configurações de WhatsApp (Token/Phone ID) não encontradas');
                return;
            }

            const config = userConfig;
            const nodes = JSON.parse(flow.nodes);
            const edges = JSON.parse(flow.edges);
            // Use loose comparison for node ID to handle string/number discrepancy
            const currentNode = nodes.find(n => String(n.id) === String(session.currentStep));

            if (!currentNode) {
                console.log(`[FLOW ERROR] Node ${session.currentStep} not found in nodes list. Number of nodes: ${nodes.length}`);
                console.log(`[FLOW ERROR] Target IDs in flow: ${nodes.map(n => n.id).join(', ')}`);
                await this.logAction(session.id, session.currentStep, null, 'error', `Nó ${session.currentStep} não encontrado no fluxo`);
                await this.endSession(session.id, 'Fluxo concluído - nó não encontrado');
                return;
            }

            const nodeName = currentNode.data?.label || currentNode.data?.templateName || `Nó ${currentNode.id}`;
            console.log(`[FLOW DEBUG] Executing node ${currentNode.id} (${currentNode.type}) for ${session.contactPhone}`);
            console.log(`[FLOW DEBUG] Node Data: ${JSON.stringify(currentNode.data)}`);

            // Handle Node Logic based on Type
            if (currentNode.type === 'templateNode') {
                const templateName = currentNode.data.templateName;
                if (templateName) {
                    // NEW: Resolve template variables from session variable store
                    const sessionVars = JSON.parse(session.variables || '{}');

                    const headerParams = [];
                    const bodyParams = [];

                    // Extract variables for this node and sort by their explicit order
                    const nodeVars = Object.keys(sessionVars)
                        .filter(k => k.startsWith(`fnode_${currentNode.id}_`))
                        .map(k => ({ key: k, ...sessionVars[k] }))
                        .sort((a, b) => (a.order || 0) - (b.order || 0));

                    nodeVars.forEach(v => {
                        const val = String(v.value || '').substring(0, 100);
                        const paramObj = { name: v.index, value: val };

                        if (v.component === 'HEADER') {
                            headerParams.push(paramObj);
                        } else {
                            // Default to BODY if component is missing or explicitly BODY
                            bodyParams.push(paramObj);
                        }
                    });

                    // If headerParams or bodyParams exist, we use them. Otherwise fallback to static params.
                    const finalComponents = (headerParams.length > 0 || bodyParams.length > 0)
                        ? { header: headerParams, body: bodyParams }
                        : (currentNode.data.params || { header: [], body: [] });

                    const result = await sendWhatsApp(session.contactPhone, config, templateName, finalComponents);
                    await this.logAction(session.id, currentNode.id, nodeName, 'sent_message', `Template: ${templateName}`);

                    // Unified History
                    await prisma.receivedMessage.create({
                        data: {
                            whatsappPhoneId: String(config.phoneId),
                            contactPhone: String(session.contactPhone).replace(/\D/g, ''),
                            contactName: 'Eu',
                            messageBody: `[Fluxo] Template: ${templateName}`,
                            isFromMe: true,
                            isRead: true
                        }
                    });
                }
            } else if (currentNode.type === 'imageNode') {
                const imageUrl = currentNode.data.imageUrl;
                const imageUrls = currentNode.data.imageUrls;

                if (imageUrls && Array.isArray(imageUrls)) {
                    for (const url of imageUrls) {
                        await this.sendWhatsAppImage(session.contactPhone, url.trim(), config);
                        await sleep(500); // Small delay between multiple images
                    }
                    await this.logAction(session.id, currentNode.id, nodeName, 'sent_message', `Enviadas ${imageUrls.length} imagens`);
                } else if (imageUrl) {
                    await this.sendWhatsAppImage(session.contactPhone, imageUrl.trim(), config);
                    await this.logAction(session.id, currentNode.id, nodeName, 'sent_message', `Imagem: ${imageUrl}`);
                }
            } else if (currentNode.type === 'optionsNode') {
                const messageText = currentNode.data.label || currentNode.data.message || 'Escolha uma opção:';
                const options = currentNode.data.options || [];
                if (options.length > 0) {
                    await this.sendWhatsAppInteractive(session.contactPhone, messageText, options, config);
                    await this.logAction(session.id, currentNode.id, nodeName, 'sent_message', `Interativo: ${messageText}`);
                } else {
                    await this.sendWhatsAppText(session.contactPhone, messageText, config);
                    await this.logAction(session.id, currentNode.id, nodeName, 'sent_message', messageText);
                }
            } else if (currentNode.type === 'messageNode' || !currentNode.type) {
                const messageText = currentNode.data.label || currentNode.data.message || '';
                if (messageText) {
                    await this.sendWhatsAppText(session.contactPhone, messageText, config);
                    await this.logAction(session.id, currentNode.id, nodeName, 'sent_message', messageText.substring(0, 100));

                    // Unified History
                    await prisma.receivedMessage.create({
                        data: {
                            whatsappPhoneId: String(config.phoneId),
                            contactPhone: String(session.contactPhone).replace(/\D/g, ''),
                            contactName: 'Eu',
                            messageBody: `[Fluxo] ${messageText}`,
                            isFromMe: true,
                            isRead: true
                        }
                    });
                }
            } else if (currentNode.type === 'variableNode') {
                // Future implementation for variable assignment nodes
            }

            // Determine next state
            const outboundEdges = edges.filter(e => String(e.source) === String(currentNode.id));
            console.log(`[FLOW] Node ${currentNode.id}: Found ${outboundEdges.length} outbound edges.`);

            // Check for specific handles that imply waiting for reply
            const hasOptions = outboundEdges.some(e => e.sourceHandle?.startsWith('source-') && e.sourceHandle !== 'source-gray');
            const waitForReply = currentNode.data?.waitForReply;

            console.log(`[FLOW] Node ${currentNode.id} logic: hasOptions=${hasOptions}, waitForReply=${waitForReply}`);

            if (hasOptions || currentNode.data?.waitForReply) {
                await prisma.flowSession.update({
                    where: { id: session.id },
                    data: { status: 'waiting_reply' }
                });
                await this.logAction(session.id, currentNode.id, nodeName, 'waiting_reply', 'Aguardando resposta do cliente');
            } else {
                // "Gray" or default path -> Move immediately
                const nextEdge = outboundEdges.find(e => e.sourceHandle === 'source-gray' || e.sourceHandle === 'source-gray' || !e.sourceHandle);
                if (nextEdge) {
                    await prisma.flowSession.update({
                        where: { id: session.id },
                        data: { currentStep: nextEdge.target }
                    });
                    // Recursive call for next step
                    setTimeout(() => this.executeStep({ ...session, currentStep: nextEdge.target }, flow, config), 1000);
                } else {
                    await this.endSession(session.id, 'Fluxo concluído com sucesso');
                }
            }
        } catch (err) {
            console.error('[FLOW EXECUTION ERROR]', err);
            await this.logAction(session.id, session.currentStep, null, 'error', err.message);
        }
    },

    async sendWhatsAppImage(phone, imageUrl, config) {
        try {
            // Normalize phone
            let normalizedPhone = String(phone).replace(/\D/g, '');
            if (!normalizedPhone.startsWith('55')) normalizedPhone = '55' + normalizedPhone;

            const url = `https://graph.facebook.com/v21.0/${config.phoneId}/messages`;

            // Process image: Upload to Meta if it's a local path
            let mediaId = null;
            const isLocal = imageUrl.startsWith('/') || !imageUrl.startsWith('http');

            if (isLocal) {
                console.log(`[FLOW IMAGE] Local image detected: ${imageUrl}. Uploading to Meta...`);
                mediaId = await uploadMediaToMeta(imageUrl, 'image', config);
            }

            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: normalizedPhone,
                type: "image"
            };

            if (mediaId) {
                payload.image = { id: mediaId };
            } else {
                console.log(`[FLOW IMAGE] External/Link image detected (or upload failed): ${imageUrl}`);
                payload.image = { link: imageUrl };
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const data = await response.json();
                console.error('[FLOW IMAGE SEND ERROR]', JSON.stringify(data, null, 2));
            }
        } catch (e) {
            console.error('[FLOW IMAGE SEND ERROR EXCEPTION]', e);
        }
    },

    async sendWhatsAppInteractive(phone, messageText, options, config) {
        const url = `https://graph.facebook.com/v21.0/${config.phoneId}/messages`;

        let interactive = {};

        if (options.length <= 3) {
            // Use buttons
            interactive = {
                type: "button",
                body: { text: messageText },
                action: {
                    buttons: options.map((opt, index) => ({
                        type: "reply",
                        reply: {
                            id: `source-${index + 1}`,
                            title: opt.substring(0, 20)
                        }
                    }))
                }
            };
        } else {
            // Use list
            interactive = {
                type: "list",
                body: { text: messageText },
                action: {
                    button: "Ver opções",
                    sections: [{
                        title: "Opções",
                        rows: options.map((opt, index) => ({
                            id: `source-${index + 1}`,
                            title: opt.substring(0, 24),
                            description: ""
                        }))
                    }]
                }
            };
        }

        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: phone,
            type: "interactive",
            interactive: interactive
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const data = await response.json();
                console.error('[FLOW INTERACTIVE ERROR]', JSON.stringify(data, null, 2));
            }
        } catch (e) {
            console.error('[FLOW INTERACTIVE ERROR]', e);
        }
    },

    async processMessage(contactPhone, messageBody, contextStart, targetUserId) {
        fs.appendFileSync('debug_output.txt', `[PROCESS_MSG] Phone: ${contactPhone}, TargetUser: ${targetUserId}\n`);
        // Normalize phone number
        let normalizedPhone = String(contactPhone).replace(/\D/g, '');
        if (!normalizedPhone.startsWith('55')) {
            normalizedPhone = '55' + normalizedPhone;
        }

        console.log(`[FLOW] Processing response from ${normalizedPhone}: "${messageBody}"`);

        // Generate variations for Brazil 9-digit heuristic (55 + 2 digit DDD + 9 or 8 digits)
        const possibleNumbers = [normalizedPhone, normalizedPhone.replace('55', '')];

        // If it's a Brazil mobile (13 digits: 55 + 11 + 9...), try version without 9 (12 digits)
        if (normalizedPhone.length === 13 && normalizedPhone.startsWith('55')) {
            // 55 11 98888-8888 -> 55 11 8888-8888
            const withoutNine = normalizedPhone.slice(0, 4) + normalizedPhone.slice(5);
            possibleNumbers.push(withoutNine);
            possibleNumbers.push(withoutNine.replace('55', ''));
        }
        // If it's a Brazil old mobile/landline (12 digits), try version WITH 9
        if (normalizedPhone.length === 12 && normalizedPhone.startsWith('55')) {
            // 55 11 8888-8888 -> 55 11 98888-8888
            const withNine = normalizedPhone.slice(0, 4) + '9' + normalizedPhone.slice(4);
            possibleNumbers.push(withNine);
            possibleNumbers.push(withNine.replace('55', ''));
        }

        // Find active session matching ANY variation AND matching the target user (if provided)
        const sessionWhere = {
            contactPhone: { in: possibleNumbers },
            status: 'waiting_reply'
        };

        if (targetUserId) {
            sessionWhere.flow = { userId: targetUserId };
        }

        fs.appendFileSync('debug_output.txt', `[PROCESS_MSG] Where Clause: ${JSON.stringify(sessionWhere)}\n`);

        const session = await prisma.flowSession.findFirst({
            where: sessionWhere,
            include: { flow: { include: { user: { include: { config: true } } } } }
        });

        if (!session) {
            console.log(`[FLOW] No active session found for ${normalizedPhone} (checked: ${possibleNumbers.join(', ')}).`);
            return;
        }

        console.log(`[FLOW] Session found: ID ${session.id}, Step: ${session.currentStep}, Status: ${session.status}`);

        const flow = session.flow;
        // Fetch freshest config
        const userConfig = await prisma.userConfig.findUnique({
            where: { userId: flow.userId }
        });

        if (!userConfig || !userConfig.token || !userConfig.phoneId) {
            console.error(`[FLOW] No valid config found for user ${flow.userId} during reply processing`);
            return;
        }

        const config = userConfig;
        const nodes = JSON.parse(flow.nodes);
        const edges = JSON.parse(flow.edges);
        // Use loose comparison for node ID
        const currentNode = nodes.find(n => String(n.id) === String(session.currentStep));

        if (!currentNode) {
            console.error(`[FLOW] Current step ${session.currentStep} not found in nodes.`);
            return;
        }

        const nodeName = currentNode.data?.label || currentNode.data?.templateName || `Nó ${currentNode.id}`;

        // Validation Logic
        let nextNodeId = null;
        let isValid = true;

        const outboundEdges = edges.filter(e => String(e.source) === String(currentNode.id));

        // Strict Validation: Only check for numeric options if it is explicitly an 'optionsNode'
        const isOptionsNode = currentNode.type === 'optionsNode';
        const hasNumericOptions = isOptionsNode && outboundEdges.some(e => e.sourceHandle?.startsWith('source-') && /^\d+$/.test(e.sourceHandle.split('-')[1]));

        if (hasNumericOptions) {
            const body = messageBody.trim().toLowerCase();

            // 0. Handle interactive button/list IDs directly
            if (body.startsWith('source-')) {
                const choice = body.split('-')[1];
                const chosenEdge = outboundEdges.find(e => e.sourceHandle === `source-${choice}`);
                if (chosenEdge) {
                    nextNodeId = chosenEdge.target;
                }
            }

            if (!nextNodeId) {
                // 1. Try exact numeric match
                const match = body.match(/^\d+$/);
                let choice = match ? match[0] : null;

                // 2. Try matching by option text
                const options = currentNode.data?.options || [];
                if (!choice) {
                    const optIndex = options.findIndex(opt => opt.toLowerCase() === body);
                    if (optIndex !== -1) {
                        choice = String(optIndex + 1);
                    }
                }

                // 3. Try matching "1." or "Option 1" (extract first number if simple)
                if (!choice && body.length < 10) {
                    const simpleMatch = body.match(/\d+/);
                    if (simpleMatch) choice = simpleMatch[0];
                }

                if (choice) {
                    const chosenEdge = outboundEdges.find(e => e.sourceHandle === `source-${choice}`);
                    if (chosenEdge) {
                        nextNodeId = chosenEdge.target;
                    } else {
                        isValid = false;
                    }
                } else {
                    isValid = false;
                }
            }
        } else {
            // Check for Green/Red generic validation
            // Loose match in case of handle discrepancies, or fallback to single outbound if it's the only path
            const greenEdge = outboundEdges.find(e =>
                e.sourceHandle === 'source-green' ||
                e.sourceHandle === 'source-gray' ||
                e.sourceHandle?.includes('green')
            ) || outboundEdges.find(e =>
                e.sourceHandle !== 'source-red' &&
                e.sourceHandle !== 'source-invalid'
            );

            console.log(`[FLOW] Checking generic 'source-green' edge. matchFound=${!!greenEdge}`);
            if (greenEdge) {
                nextNodeId = greenEdge.target;
                console.log(`[FLOW] Transitioning to generic next node: ${nextNodeId}`);
            } else {
                console.log(`[FLOW] No generic edge found. Outbound Edges: ${JSON.stringify(outboundEdges)}`);
            }
        }

        if (!isValid) {
            const redEdge = outboundEdges.find(e => e.sourceHandle === 'source-red' || e.sourceHandle === 'source-invalid');
            if (redEdge) {
                await prisma.flowSession.update({
                    where: { id: session.id },
                    data: { currentStep: redEdge.target, status: 'active' }
                });
                await this.logAction(session.id, currentNode.id, nodeName, 'invalid_reply', `Resposta inválida: ${messageBody}`);
                await this.executeStep({ ...session, currentStep: redEdge.target }, flow, config);
                return;
            } else {
                await this.sendWhatsAppText(normalizedPhone, "Opção inválida. Por favor tente novamente.", config);
                await this.logAction(session.id, currentNode.id, nodeName, 'invalid_reply', `"${messageBody}" - pedido para repetir`);
                return;
            }
        }

        if (nextNodeId) {
            // Verify nextNodeId exists in nodes to avoid orphaned edge errors
            const nextNode = nodes.find(n => String(n.id) === String(nextNodeId));
            if (!nextNode) {
                console.log(`[FLOW ERROR] Transition target ${nextNodeId} not found in nodes for flow ${flow.id}`);
                await this.logAction(session.id, currentNode.id, nodeName, 'error', `Próximo nó (${nextNodeId}) não encontrado no fluxo`);
                await this.endSession(session.id, 'Fluxo concluído - desenho inconsistente');
                return;
            }

            console.log(`[FLOW] Next node determined: ${nextNodeId}. Updating session ${session.id}.`);
            await this.logAction(session.id, currentNode.id, nodeName, 'received_reply', `Resposta recebida: "${messageBody}"`);
            await prisma.flowSession.update({
                where: { id: session.id },
                data: { currentStep: String(nextNodeId), status: 'active' }
            });
            await this.executeStep({ ...session, currentStep: String(nextNodeId) }, flow, config);
        } else {
            console.log(`[FLOW] No next node found for session ${session.id}. Ending.`);
            await this.endSession(session.id, 'Fluxo concluído - fim das opções');
        }
    },

    async endSession(sessionId, reason = 'Fluxo concluído') {
        await prisma.flowSession.update({
            where: { id: sessionId },
            data: { status: 'completed' }
        });
        await this.logAction(sessionId, null, null, 'completed', reason);
    },

    async sendWhatsAppText(phone, text, config) {
        const url = `https://graph.facebook.com/v21.0/${config.phoneId}/messages`;
        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: phone,
            type: "text",
            text: { body: text }
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const data = await response.json();
                console.error('[FLOW SEND ERROR]', JSON.stringify(data, null, 2));
            }
        } catch (e) {
            console.error('[FLOW SEND ERROR]', e);
        }
    }
};

// --- WEBHOOK ---

app.get('/webhook/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log(`[WEBHOOK] Validation request for User ${userId}. Mode: ${mode}, Token: ${token}`);

    if (mode && token) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { config: true }
            });

            if (mode === 'subscribe' && user?.config?.webhookVerifyToken === token) {
                console.log(`[WEBHOOK] Verified for User ${userId}`);
                res.status(200).send(challenge);
            } else {
                console.warn(`[WEBHOOK] Verification failed for User ${userId}. Expected: ${user?.config?.webhookVerifyToken}, Received: ${token}`);
                res.sendStatus(403);
            }
        } catch (err) {
            console.error('[WEBHOOK VERIFY ERROR]', err);
            res.sendStatus(500);
        }
    } else {
        res.sendStatus(400);
    }
});

app.post('/webhook/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    return handleIncomingWebhook(req, res, userId);
});

// Backward compatibility (old webhook)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// --- HELPER: DOWNLOAD MEDIA ---
const downloadMedia = async (mediaId, config) => {
    try {
        if (!mediaId) return null;

        const log = (msg) => {
            try { fs.appendFileSync('debug_output.txt', `[DOWNLOAD ${mediaId}] ${msg}\n`); } catch (e) { }
            console.log(`[DOWNLOAD] ${msg}`);
        };

        log(`Starting download with token prefix ${config.token?.substring(0, 10)}...`);

        // 1. Get Media URL
        log(`Fetching URL from Graph API...`);
        const urlRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
            headers: { 'Authorization': `Bearer ${config.token}` }
        });

        if (!urlRes.ok) {
            const errText = await urlRes.text();
            log(`Failed to get media URL. Status: ${urlRes.status} ${urlRes.statusText}. Response: ${errText}`);
            return null;
        }

        const urlData = await urlRes.json();
        const mediaUrl = urlData.url;
        const mimeType = urlData.mime_type;

        log(`Got URL: ${mediaUrl} (Mime: ${mimeType})`);

        if (!mediaUrl) return null;

        // 2. Download Binary
        log(`Downloading binary...`);
        const response = await fetch(mediaUrl, {
            headers: { 'Authorization': `Bearer ${config.token}` }
        });

        if (!response.ok) {
            log(`Failed to download binary. Status: ${response.status} ${response.statusText}`);
            return null;
        }

        const buffer = await response.arrayBuffer();

        // 3. Save to disk
        const ext = mimeType ? mimeType.split('/')[1].split(';')[0] : 'bin';
        const filename = `${mediaId}.${ext}`;
        const filepath = path.join(uploadsDir, filename);

        fs.writeFileSync(filepath, Buffer.from(buffer));
        log(`Media saved to ${filepath}`);

        return `/uploads/${filename}`;
    } catch (err) {
        fs.appendFileSync('debug_output.txt', `[DOWNLOAD ERROR] ${err.message}\n`);
        console.error('[DOWNLOAD MEDIA ERROR]', err);
        return null;
    }
};

// --- HELPER: UPLOAD MEDIA TO META ---
const uploadMediaToMeta = async (fileUrl, type, config) => {
    try {
        // Strip leading slash if present
        const relativePath = fileUrl.startsWith('/') ? fileUrl.substring(1) : fileUrl;
        const absolutePath = path.join(__dirname, relativePath);

        if (!fs.existsSync(absolutePath)) {
            console.error(`[UPLOAD META] File not found: ${absolutePath}`);
            return null;
        }

        const formData = new FormData();
        const fileBuffer = fs.readFileSync(absolutePath);
        const fileBlob = new Blob([fileBuffer], { type: type === 'image' ? 'image/jpeg' : 'audio/mpeg' });

        formData.append('file', fileBlob, path.basename(absolutePath));
        formData.append('type', type);
        formData.append('messaging_product', 'whatsapp');

        const url = `https://graph.facebook.com/v21.0/${config.phoneId}/media`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.token}`
            },
            body: formData
        });

        const data = await response.json();
        if (!response.ok) {
            console.error(`[UPLOAD META ERROR]`, JSON.stringify(data, null, 2));
            return null;
        }

        console.log(`[UPLOAD META SUCCESS] Media uploaded, ID: ${data.id}`);
        return data.id;
    } catch (err) {
        console.error('[UPLOAD META EXCEPTION]', err);
        return null;
    }
};



async function handleIncomingWebhook(req, res, targetUserId = null) {
    try {
        const body = req.body;

        // Basic validation
        if (!body.object) return res.sendStatus(404);

        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const metadata = value?.metadata;

        if (!value) return res.sendStatus(200);

        // Status update?
        if (value.statuses) {
            console.log('[WEBHOOK] Status update received:', value.statuses[0].status);
            return res.sendStatus(200);
        }

        const phone_number_id = metadata?.phone_number_id;
        const contact = value.contacts?.[0];
        const message = value.messages?.[0];

        if (!message) return res.sendStatus(200);

        const from = message.from;
        // Note: 'from' in message is the sender's phone. 'wa_id' in contacts is also usually the same.
        const name = contact?.profile?.name || from;

        let text = '';
        if (message.type === 'text') {
            text = message.text?.body || '';
        } else if (message.type === 'interactive') {
            const reply = message.interactive.button_reply || message.interactive.list_reply;
            text = reply?.id || reply?.title || '';
        } else if (message.type === 'button') {
            text = message.button?.text || '';
        } else {
            text = `[${message.type.toUpperCase()}]`;
        }

        console.log(`[WEBHOOK] Payload from ${from} (Name: ${name}) to PhoneID: ${phone_number_id}`);
        console.log(`[WEBHOOK] Content: "${text}"`);

        // Check user config logic
        let userConfig = null;
        if (targetUserId) {
            userConfig = await prisma.userConfig.findUnique({ where: { userId: targetUserId } });
            if (userConfig) console.log(`[WEBHOOK] Matched via targetUserId ${targetUserId} -> Config PhoneId: ${userConfig.phoneId}`);
        } else {
            userConfig = await prisma.userConfig.findFirst({ where: { phoneId: String(phone_number_id) } });
            if (userConfig) console.log(`[WEBHOOK] Matched via PhoneID ${phone_number_id} -> User ${userConfig.userId}`);
        }

        fs.appendFileSync('debug_output.txt', `[WEBHOOK] PhoneId: ${phone_number_id}, TargetUserParam: ${targetUserId}, ResolvedConfigOwner: ${userConfig?.userId}\n`);

        if (!userConfig) {
            console.warn(`[WEBHOOK] WARNING: No user config found for PhoneID ${phone_number_id}. Media download may fail.`);
        }

        let mediaUrl = null;
        let mediaType = message.type;
        let mediaId = null;

        if (['image', 'audio', 'video', 'document', 'sticker'].includes(message.type) && userConfig) {
            const mediaObj = message[message.type];
            mediaId = mediaObj.id;
            console.log(`[WEBHOOK] Downloading media ${mediaId} (${message.type})...`);
            const localUrl = await downloadMedia(mediaId, userConfig);
            if (localUrl) {
                mediaUrl = localUrl;
                // Add caption to text if image
                if (mediaObj.caption) text = mediaObj.caption;
            }
        }

        // Save to Database (using the ID from payload as the 'owner' ID for storage)
        await prisma.receivedMessage.create({
            data: {
                whatsappPhoneId: String(phone_number_id),
                contactPhone: from,
                contactName: name,
                messageBody: text || `[${message.type.toUpperCase()}]`,
                isFromMe: false,
                isRead: false,
                mediaUrl: mediaUrl,
                mediaType: mediaType,
                mediaId: mediaId
            }
        });

        // Trigger Flow Engine
        if (text) {
            const contextStart = message.context ? { id: message.context.id, from: message.context.from } : null;
            // Pass the resolved userConfig.userId to ensure we match the session for the correct account
            await FlowEngine.processMessage(from, text, contextStart, userConfig?.userId);
        }

        // Real-time Broadcast
        wss.clients.forEach(async (client) => {
            if (client.readyState === WebSocket.OPEN && client.userId) {
                // Check if this client belongs to the user who owns this phoneId
                const u = await prisma.user.findUnique({
                    where: { id: parseInt(client.userId) },
                    include: { config: true }
                });

                if (u?.config?.phoneId === String(phone_number_id)) {
                    client.send(JSON.stringify({
                        event: 'message:received',
                        data: { from, name, text, phoneId: String(phone_number_id), mediaUrl, mediaType }
                    }));
                }
            }
        });

        res.sendStatus(200);

    } catch (err) {
        console.error('[WEBHOOK ERROR]', err);
        res.sendStatus(500);
    }
}

// --- LEGACY COMPAT: /api/status for polling fallback ---
app.get('/api/status/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        const dispatch = await prisma.dispatch.findFirst({
            where: {
                userId,
                status: { in: ['running', 'paused'] }
            },
            include: {
                logs: {
                    orderBy: { createdAt: 'desc' },
                    take: 50
                }
            }
        });

        if (!dispatch) {
            return res.json({ status: 'idle', progress: { current: 0, total: 0 }, logs: [], errors: [] });
        }

        res.json({
            dispatchId: dispatch.id,
            status: dispatch.status,
            progress: {
                current: dispatch.currentIndex,
                total: dispatch.totalLeads
            },
            successCount: dispatch.successCount,
            errorCount: dispatch.errorCount,
            logs: dispatch.logs.map(l => ({
                phone: l.phone,
                status: l.status,
                message: l.message,
                time: l.createdAt.toLocaleTimeString()
            })),
            errors: dispatch.logs.filter(l => l.status === 'error')
        });
    } catch (err) {
        console.error('[STATUS ERROR]', err);
        res.status(500).json({ error: 'Erro ao buscar status' });
    }
});

// --- IMAGE UPLOAD ---
// Updated to support multiple images
app.post('/api/upload-image', upload.array('images', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            // Fallback for single 'image' field if needed for old clients
            if (req.file) {
                const url = `/uploads/${req.file.filename}`;
                return res.json({ success: true, url, filename: req.file.filename });
            }
            return res.status(400).json({ error: 'Nenhuma imagem enviada' });
        }

        // Generate public URLs for all uploaded files
        const urls = req.files.map(file => `/uploads/${file.filename}`);
        res.json({
            success: true,
            urls,
            url: urls[0], // Fallback for single image expectation
            filenames: req.files.map(f => f.filename)
        });
    } catch (err) {
        console.error('[UPLOAD ERROR]', err);
        res.status(500).json({ error: 'Erro ao fazer upload' });
    }
});

// --- SERVE STATIC FILES ---
app.use('/uploads', express.static(uploadsDir));
app.use('/politics', express.static(path.join(__dirname, 'politics')));
app.use(express.static(path.join(__dirname, 'dist')));

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- START SERVER ---
const FINAL_PORT = process.env.PORT || 3000;
server.listen(FINAL_PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${FINAL_PORT} `);
    console.log(`📡 WebSocket ready on port ${FINAL_PORT} `);
});


// --- GRACEFUL SHUTDOWN ---
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await prisma.$disconnect();
    process.exit(0);
});
