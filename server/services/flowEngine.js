import prisma from '../db.js';
import {
    logAction,
    saveHistory,
    sendWhatsAppText,
    sendWhatsAppImage,
    sendWhatsAppInteractive,
    sendEvolutionMessage,
    isWithinHours,
    getNextStartTime,
    endSession
} from './flowUtils.js';
import { nodeHandlers } from './nodeHandlers.js';

const FlowEngine = {
    // Expose utils for external use if needed, preserving the original API
    logAction,
    saveHistory,
    sendEvolutionMessage,
    sendWhatsAppImage,
    sendWhatsAppInteractive,
    sendWhatsAppText,
    isWithinHours,
    getNextStartTime,
    endSession,

    findStartNode(nodes, edges) {
        const explicitStart = nodes.find(n => n.data?.isStart || n.type === 'start');
        if (explicitStart) return explicitStart.id;

        const targetIds = new Set(edges.map(e => String(e.target)));
        const roots = nodes.filter(n => !targetIds.has(String(n.id)));

        if (roots.length > 0) {
            const preferredRoot = roots.find(n => n.type === 'messageNode' || n.type === 'templateNode');
            return (preferredRoot || roots[0]).id;
        }
        return nodes[0]?.id;
    },

    async startFlow(flowId, contactPhone, userId, platform = 'meta', automationId = null) {
        console.log(`[FLOW ENGINE] [START] flowId: ${flowId} | phone: ${contactPhone} | userId: ${userId} | autoId: ${automationId}`);
        try {
            let flow;
            if (automationId) {
                flow = await prisma.automation.findUnique({ where: { id: automationId } });
            } else {
                flow = await prisma.flow.findUnique({ where: { id: flowId } });
            }

            if (!flow) throw new Error('Fluxo não encontrado');

            const nodes = JSON.parse(flow.nodes);
            const edges = JSON.parse(flow.edges);
            const startNodeId = this.findStartNode(nodes, edges);

            if (!startNodeId) throw new Error('Nó inicial não encontrado');

            // Force cleanup of any existing ACTIVE session for this contact
            await prisma.flowSession.updateMany({
                where: {
                    contactPhone,
                    status: { in: ['active', 'waiting_reply'] },
                    OR: [{ flow: { userId } }, { automation: { userId } }]
                },
                data: { status: 'expired' }
            });
            console.log(`[FLOW ENGINE] Cleared existing sessions for ${contactPhone} before starting new flow.`);

            // Create session
            const session = await prisma.flowSession.create({
                data: {
                    flowId: flowId || null,
                    automationId: automationId || null,
                    contactPhone,
                    currentStep: String(startNodeId),
                    status: 'active',
                    platform: platform
                }
            });

            await logAction(session.id, startNodeId, 'Início', 'flow_started', `Iniciado via ${platform}`);

            const userConfig = await prisma.userConfig.findUnique({ where: { userId } });
            await this.executeStep(session, flow, userConfig, platform);

            return session;
        } catch (err) {
            console.error('[START FLOW ERROR]', err);
            throw err;
        }
    },

    async executeStep(session, flow, userConfig, platform = 'meta') {
        try {
            if (!userConfig) {
                await logAction(session.id, session.currentStep, null, 'error', 'Configurações do usuário não encontradas');
                return;
            }

            const nodes = JSON.parse(flow.nodes);
            const edges = JSON.parse(flow.edges);
            const currentNode = nodes.find(n => String(n.id) === String(session.currentStep));

            if (!currentNode) {
                console.log(`[FLOW ENGINE ERROR] executeStep: Node ${session.currentStep} not found in Flow ${flow.id}`);
                await logAction(session.id, session.currentStep, null, 'error', `Nó ${session.currentStep} não encontrado`);
                await endSession(session.id, 'Fluxo concluído - nó não encontrado');
                return;
            }

            console.log(`[FLOW ENGINE] executeStep: Session ${session.id} - Node ${currentNode.id} (${currentNode.type}) - Platform: ${platform}`);
            const nodeName = currentNode.data?.label || currentNode.data?.templateName || `Nó ${currentNode.id}`;

            // Handlers defined in nodeHandlers.js
            const handler = nodeHandlers[currentNode.type] || nodeHandlers.messageNode;
            const result = await handler(session, currentNode, userConfig, platform);

            if (result.action === 'error') {
                await prisma.flowSession.update({ where: { id: session.id }, data: { status: 'error' } });
                return;
            }

            if (result.action === 'end') return;

            if (result.action === 'schedule') {
                await prisma.flowSession.update({
                    where: { id: session.id },
                    data: { status: 'waiting_business_hours', scheduledAt: result.scheduledAt }
                });
                return;
            }

            if (result.action === 'wait' || currentNode.data?.waitForReply) {
                let scheduledAt = null;
                const nodeWaitTimeout = result.waitTimeout || currentNode.data?.waitTimeout;

                if (nodeWaitTimeout) {
                    const globalWaitTime = userConfig?.sessionWaitTime || 1440;
                    const finalTimeout = Math.min(nodeWaitTimeout, globalWaitTime);
                    scheduledAt = new Date(Date.now() + finalTimeout * 60 * 1000);
                }

                await prisma.flowSession.update({
                    where: { id: session.id },
                    data: {
                        status: 'waiting_reply',
                        scheduledAt: scheduledAt
                    }
                });
                await logAction(session.id, currentNode.id, nodeName, 'waiting_reply', `Aguardando resposta${scheduledAt ? ` até ${scheduledAt.toLocaleTimeString()}` : ''}`);
                return;
            }

            // Default: Continue to next node
            const outboundEdges = edges.filter(e => String(e.source) === String(currentNode.id));
            const nextEdge = outboundEdges.find(e =>
                !e.sourceHandle ||
                ['source-gray', 'source-green', 'source-true', 'source-default'].includes(e.sourceHandle)
            );

            console.log(`[FLOW ENGINE] Finding Next Edge. Outbound count: ${outboundEdges.length}. NextEdge found: ${!!nextEdge}`);

            if (nextEdge) {
                const variables = JSON.parse(session.variables || '{}');
                if (variables.validation_attempts) delete variables.validation_attempts;

                const nextSession = await prisma.flowSession.update({
                    where: { id: session.id },
                    data: {
                        currentStep: nextEdge.target,
                        status: 'active',
                        variables: JSON.stringify(variables)
                    }
                });
                setTimeout(() => this.executeStep(nextSession, flow, userConfig, platform), 1000);
            } else {
                await endSession(session.id, 'Fluxo concluído');
            }

        } catch (err) {
            console.error('[FLOW EXECUTION ERROR]', err);
            await logAction(session.id, session.currentStep, null, 'error', err.message);
        }
    },

    async processMessage(contactPhone, messageBody, contextStart, targetUserId, platform = 'meta') {
        let normalizedPhone = String(contactPhone).replace(/\D/g, '');
        if (!normalizedPhone.startsWith('55')) normalizedPhone = '55' + normalizedPhone;

        const possibleNumbers = [normalizedPhone, normalizedPhone.replace('55', '')];
        if (normalizedPhone.length === 13 && normalizedPhone.startsWith('55')) {
            const withoutNine = normalizedPhone.slice(0, 4) + normalizedPhone.slice(5);
            possibleNumbers.push(withoutNine, withoutNine.replace('55', ''));
        }
        if (normalizedPhone.length === 12 && normalizedPhone.startsWith('55')) {
            const withNine = normalizedPhone.slice(0, 4) + '9' + normalizedPhone.slice(4);
            possibleNumbers.push(withNine, withNine.replace('55', ''));
        }

        const sessionWhere = { contactPhone: { in: possibleNumbers }, status: 'waiting_reply' };
        if (targetUserId) {
            sessionWhere.OR = [{ flow: { userId: targetUserId } }, { automation: { userId: targetUserId } }];
        }

        const session = await prisma.flowSession.findFirst({
            where: sessionWhere,
            include: { flow: true, automation: true }
        });

        if (!session) return false;

        const flow = session.flow || session.automation;
        if (!flow) return false;

        const userConfig = await prisma.userConfig.findUnique({ where: { userId: flow.userId } });
        if (!userConfig) return false;

        const nodes = JSON.parse(flow.nodes);
        const edges = JSON.parse(flow.edges);
        const currentNode = nodes.find(n => String(n.id) === String(session.currentStep));
        if (!currentNode) {
            console.warn(`[FLOW ENGINE] [REPLY] Current node ${session.currentStep} not found in nodes list.`);
            return false;
        }

        console.log(`[FLOW ENGINE] [REPLY] Session ${session.id} found at node ${currentNode.id} (${currentNode.type}). Processing reply: "${messageBody}"`);
        const nodeName = currentNode.data?.label || currentNode.data?.templateName || `Nó ${currentNode.id}`;
        let nextNodeId = null;
        let isValid = true;
        const outboundEdges = edges.filter(e => String(e.source) === String(currentNode.id));

        if (currentNode.type === 'optionsNode') {
            const body = messageBody.trim().toLowerCase();
            if (body.startsWith('source-')) {
                const choice = body.split('-')[1];
                const edge = outboundEdges.find(e => e.sourceHandle === `source-${choice}`);
                if (edge) nextNodeId = edge.target;
            }

            if (!nextNodeId) {
                const simpleMatch = body.match(/^\d+/) || body.match(/\d+/);
                let choice = simpleMatch ? simpleMatch[0] : null;

                if (!choice) {
                    const optIdx = (currentNode.data?.options || []).findIndex(opt => opt.toLowerCase() === body);
                    if (optIdx !== -1) choice = String(optIdx + 1);
                }
                const edge = outboundEdges.find(e => e.sourceHandle === `source-${choice}`);
                if (edge) {
                    nextNodeId = edge.target;
                } else {
                    isValid = false;
                }
            }
        } else {
            const edge = outboundEdges.find(e => ['source-green', 'source-gray'].includes(e.sourceHandle)) || outboundEdges.find(e => !['source-red', 'source-invalid'].includes(e.sourceHandle));
            if (edge) nextNodeId = edge.target;
        }

        const variables = JSON.parse(session.variables || '{}');

        if (!isValid) {
            let redEdge = outboundEdges.find(e => ['source-red', 'source-invalid'].includes(e.sourceHandle));
            if (redEdge && !nodes.find(n => String(n.id) === String(redEdge.target))) redEdge = null;

            const validateSelection = currentNode.data?.validateSelection;
            const validationAttempts = variables.validation_attempts || 0;

            if (currentNode.type === 'optionsNode' && validateSelection && validationAttempts === 0) {
                const definedOptions = currentNode.data?.options || [];
                const optionsCount = definedOptions.length;

                if (optionsCount > 0) {
                    const numbers = Array.from({ length: optionsCount }, (_, i) => i + 1);
                    const last = numbers.pop();
                    const validMsg = numbers.length === 0 ? "1" : `${numbers.join(', ')} ou ${last}`;
                    const errorMsg = `Por favor, responda apenas com ${validMsg}`;

                    if (platform === 'evolution') {
                        await sendEvolutionMessage(normalizedPhone, errorMsg, null, null, userConfig);
                    } else {
                        await sendWhatsAppText(normalizedPhone, errorMsg, userConfig);
                    }

                    variables.validation_attempts = 1;
                    await prisma.flowSession.update({
                        where: { id: session.id },
                        data: { variables: JSON.stringify(variables) }
                    });

                    await logAction(session.id, currentNode.id, nodeName, 'invalid_reply', `Validação enviada: ${errorMsg}`);
                    return true;
                }
            }

            // If we reach here, it's either not an options node, validation is off, or we've already validated once.
            if (variables.validation_attempts) delete variables.validation_attempts;

            if (redEdge) {
                const nextSession = await prisma.flowSession.update({
                    where: { id: session.id },
                    data: { currentStep: redEdge.target, status: 'active', variables: JSON.stringify(variables) }
                });
                await logAction(session.id, currentNode.id, nodeName, 'invalid_reply', `Resposta inválida: ${messageBody}`);
                await this.executeStep(nextSession, flow, userConfig, platform);
            } else {
                await logAction(session.id, currentNode.id, nodeName, 'invalid_reply', `Resposta inválida e sem caminho de erro: ${messageBody}`);
                await endSession(session.id, 'Fluxo concluído - resposta inválida');
            }
            return true;
        }

        if (nextNodeId) {
            if (variables.validation_attempts) delete variables.validation_attempts;
            await logAction(session.id, currentNode.id, nodeName, 'received_reply', `Resposta recebida: "${messageBody}"`);
            const nextSession = await prisma.flowSession.update({
                where: { id: session.id },
                data: {
                    currentStep: String(nextNodeId),
                    status: 'active',
                    variables: JSON.stringify(variables)
                }
            });
            await this.executeStep(nextSession, flow, userConfig, platform);
        } else {
            await endSession(session.id, 'Fluxo concluído');
        }
        return true;
    },

    async processScheduledFlows() {
        const now = new Date();
        const sessions = await prisma.flowSession.findMany({
            where: {
                OR: [
                    { status: 'waiting_business_hours', scheduledAt: { lte: now } },
                    { status: 'waiting_reply', scheduledAt: { lte: now } }
                ]
            },
            include: { flow: true, automation: true }
        });

        for (const session of sessions) {
            try {
                const flow = session.flow || session.automation;
                if (!flow) {
                    await prisma.flowSession.update({ where: { id: session.id }, data: { status: 'error' } });
                    continue;
                }

                const userConfig = await prisma.userConfig.findUnique({ where: { userId: flow.userId } });
                if (!userConfig) continue;

                const edges = JSON.parse(flow.edges || '[]');
                const nodes = JSON.parse(flow.nodes || '[]');
                const currentNode = nodes.find(n => String(n.id) === String(session.currentStep));
                const outboundEdges = edges.filter(e => String(e.source) === String(session.currentStep));

                let nextEdge = null;

                if (session.status === 'waiting_business_hours') {
                    nextEdge = outboundEdges.find(e => ['source-gray', 'source-green'].includes(e.sourceHandle)) || outboundEdges.find(e => !e.sourceHandle);
                } else if (session.status === 'waiting_reply') {
                    // TIMEOUT: Look for the negative path (red or invalid)
                    nextEdge = outboundEdges.find(e => ['source-red', 'source-invalid'].includes(e.sourceHandle));

                    if (nextEdge) {
                        await logAction(session.id, session.currentStep, currentNode?.data?.label, 'timeout_path', 'Tempo limite atingido, seguindo caminho negativo');
                    } else {
                        await logAction(session.id, session.currentStep, currentNode?.data?.label, 'timeout_expired', 'Tempo limite atingido, sem caminho negativo definido. Encerrando.');
                    }
                }

                if (nextEdge) {
                    const variables = JSON.parse(session.variables || '{}');
                    if (variables.validation_attempts) delete variables.validation_attempts;

                    const nextSession = await prisma.flowSession.update({
                        where: { id: session.id },
                        data: {
                            currentStep: nextEdge.target,
                            status: 'active',
                            scheduledAt: null,
                            variables: JSON.stringify(variables)
                        }
                    });
                    await this.executeStep(nextSession, flow, userConfig, session.platform);
                } else {
                    await prisma.flowSession.update({ where: { id: session.id }, data: { status: 'completed', scheduledAt: null } });
                }
            } catch (err) {
                console.error(`[FLOW ENGINE] Error processing scheduled session ${session.id}:`, err);
            }
        }

        // NEW: Check for sessions that exceeded the global sessionWaitTime since creation
        const activeSessions = await prisma.flowSession.findMany({
            where: { status: { in: ['active', 'waiting_reply', 'waiting_business_hours'] } },
            include: { flow: true, automation: true }
        });

        if (activeSessions.length > 0) {
            console.log(`[FLOW ENGINE] Checking ${activeSessions.length} active sessions for global expiration...`);
        }

        for (const session of activeSessions) {
            try {
                const automation = session.automation;
                const flow = session.flow || automation;
                if (!flow) continue;

                const userConfig = await prisma.userConfig.findUnique({ where: { userId: flow.userId } });
                if (!userConfig) continue;

                const sessionAge = Date.now() - new Date(session.createdAt).getTime();

                // Prioritize per-automation sessionWaitTime
                const waitTime = automation?.sessionWaitTime || userConfig.sessionWaitTime || 1440;
                const expirationLimit = waitTime * 60 * 1000;

                console.log(`[FLOW ENGINE] Session ${session.id}: Age=${Math.round(sessionAge / 60000)}min | Limit=${waitTime}min | Expired=${sessionAge > expirationLimit}`);

                if (sessionAge > expirationLimit) {
                    console.log(`[FLOW ENGINE] Session ${session.id} EXPIRED by ${automation ? 'automation' : 'global'} timer!`);
                    await prisma.flowSession.update({ where: { id: session.id }, data: { status: 'expired' } });
                }
            } catch (e) {
                console.error(`[FLOW ENGINE] Error checking session ${session.id} expiration:`, e);
            }
        }
    },

    async sendEvolutionPresence(phone, status, config) {
        try {
            const baseUrl = process.env.EVOLUTION_API_URL || config.evolutionApiUrl;
            const apiKey = process.env.EVOLUTION_API_KEY || config.evolutionApiKey;
            const instance = config.evolutionInstanceName;
            let normalizedPhone = String(phone).replace(/\D/g, '');
            if (!normalizedPhone.startsWith('55')) normalizedPhone = '55' + normalizedPhone;
            const remoteJid = `${normalizedPhone}@s.whatsapp.net`;

            await fetch(`${baseUrl}/chat/sendPresence/${instance}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify({ number: remoteJid, presence: status, delay: 0 })
            });
        } catch (e) { console.error('[EVOLUTION PRESENCE ERROR]', e); }
    }
};

export default FlowEngine;
