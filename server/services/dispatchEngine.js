import prisma from '../db.js';
import { sendWhatsApp } from './whatsapp.js';
import FlowEngine from './flowEngine.js';
import { sleep } from '../utils/helpers.js';

const activeJobs = new Map();

export const stopDispatch = (id) => activeJobs.delete(parseInt(id));

export const processDispatch = async (dispatchId, broadcastProgress) => {
    try {
        const dispatch = await prisma.dispatch.findUnique({
            where: { id: dispatchId },
            include: { user: { include: { config: true } } }
        });

        if (!dispatch || dispatch.status !== 'running') return;

        activeJobs.set(dispatchId, true);
        const leads = JSON.parse(dispatch.leadsData || '[]');
        const userConfig = dispatch.user.config;

        const log = async (phone, status, message) => {
            await prisma.dispatchLog.create({ data: { dispatchId, phone: String(phone), status, message } });
            broadcastProgress({ dispatchId, currentIndex: jobs.currentIndex, successCount: jobs.successCount, errorCount: jobs.errorCount, lastLog: { phone, status, message } });
        };

        let jobs = {
            currentIndex: dispatch.currentIndex,
            successCount: dispatch.successCount,
            errorCount: dispatch.errorCount
        };

        for (let i = jobs.currentIndex; i < leads.length; i++) {
            if (!activeJobs.has(dispatchId)) {
                await prisma.dispatch.update({ where: { id: dispatchId }, data: { status: 'stopped', ...jobs } });
                return;
            }

            const lead = leads[i];
            let phone = lead['Tel. Promax'] || lead['TELEFONE'] || lead['telefone'] || lead['Phone'] || lead['phone'];

            // Magic Pattern Finder: If no phone found by key, search in values
            if (!phone) {
                const values = Object.values(lead);
                for (const val of values) {
                    if (val && (typeof val === 'string' || typeof val === 'number')) {
                        const sVal = String(val).replace(/\D/g, '');
                        // Check for BR format: 55 + (2 digits DDD) + (8 or 9 digits) = 12 or 13 chars
                        if (sVal.startsWith('55') && (sVal.length === 12 || sVal.length === 13)) {
                            phone = sVal;
                            break;
                        }
                    }
                }
            }

            if (!phone) {
                jobs.errorCount++;
                const availableKeys = Object.keys(lead).join(', ');
                await log('N/A', 'error', `Telefone não encontrado. Chaves disponíveis: [${availableKeys}]`);
                continue;
            }

            try {
                if (dispatch.dispatchType === 'flow' && dispatch.flowId) {
                    const flow = await prisma.flow.findUnique({ where: { id: dispatch.flowId } });
                    if (flow) {
                        const nodes = JSON.parse(flow.nodes);
                        const edges = JSON.parse(flow.edges);
                        const startNodeId = FlowEngine.findStartNode(nodes, edges);

                        // Merge static lead data with dynamic variables mapping
                        const initialVars = { ...lead };
                        const mappingVars = JSON.parse(dispatch.variables || '{}');

                        const session = await prisma.flowSession.create({
                            data: {
                                flowId: flow.id,
                                contactPhone: String(phone),
                                currentStep: String(startNodeId),
                                status: 'active',
                                variables: JSON.stringify({ ...initialVars, _mapping: mappingVars })
                            }
                        });
                        await FlowEngine.executeStep(session, flow, userConfig);
                    }
                } else {
                    // Template mode
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

                    const res = await sendWhatsApp(phone, userConfig, dispatch.templateName, components);
                    if (res.success) jobs.successCount++; else jobs.errorCount++;
                    await log(phone, res.success ? 'success' : 'error', res.error || 'Mensagem enviada');
                }
            } catch (e) {
                jobs.errorCount++;
                await log(phone, 'error', e.message);
            }

            jobs.currentIndex = i + 1;
            await prisma.dispatch.update({ where: { id: dispatchId }, data: { ...jobs } });
            await sleep(2000); // Anti-spam delay
        }

        await prisma.dispatch.update({ where: { id: dispatchId }, data: { status: 'completed', ...jobs } });
        activeJobs.delete(dispatchId);
        broadcastProgress({ event: 'dispatch:complete', data: { dispatchId } });

    } catch (err) {
        console.error('[PROCESS DISPATCH ERROR]', err);
        activeJobs.delete(dispatchId);
    }
};

export const startDispatch = async (req, res, broadcastProgress) => {
    try {
        const { userId, templateName, leadsData, dispatchType, flowId, variables } = req.body;
        const dispatch = await prisma.dispatch.create({
            data: {
                userId,
                templateName: templateName || 'N/A',
                status: 'running',
                totalLeads: leadsData.length,
                leadsData: JSON.stringify(leadsData),
                dispatchType: dispatchType || 'template',
                flowId: flowId ? parseInt(flowId) : null,
                variables: variables ? JSON.stringify(variables) : '[]',
                dateOld: '',
                dateNew: ''
            }
        });

        res.json({ success: true, dispatchId: dispatch.id });
        processDispatch(dispatch.id, broadcastProgress);
    } catch (err) {
        console.error('[START DISPATCH ERROR]', err);
        res.status(500).json({ error: 'Erro ao iniciar campanha' });
    }
};
