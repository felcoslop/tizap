import prisma from '../db.js';
import { sendWhatsApp, uploadMediaToMeta } from './whatsapp.js';
import { sendSingleEmail } from './emailEngine.js';
import { sleep } from '../utils/helpers.js';

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

            // Force cleanup of any existing ACTIVE session for this contact to prevent "double message" need failures
            // If we are starting a flow here, we mean business and want to restart.
            await prisma.flowSession.updateMany({
                where: {
                    contactPhone,
                    status: { in: ['active', 'waiting_reply'] },
                    // Make sure we only close sessions for relevant context if needed, but here we want to clear the path for the contact
                    // OR: matches flowId or automationId logic?
                    // Actually, if a contact is starting a NEW flow, they shouldn't be in another one.
                    OR: [
                        { flow: { userId } },
                        { automation: { userId } }
                    ]
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
                    platform: platform // Add platform field to session if it exists, or handle it via logic
                }
            });

            await this.logAction(session.id, startNodeId, 'Início', 'flow_started', `Iniciado via ${platform}`);

            // Execute first step
            // We need to fetch config for the user
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
                await this.logAction(session.id, session.currentStep, null, 'error', 'Configurações do usuário não encontradas');
                return;
            }

            const nodes = JSON.parse(flow.nodes);
            const edges = JSON.parse(flow.edges);
            const currentNode = nodes.find(n => String(n.id) === String(session.currentStep));

            if (!currentNode) {
                await this.logAction(session.id, session.currentStep, null, 'error', `Nó ${session.currentStep} não encontrado`);
                await this.endSession(session.id, 'Fluxo concluído - nó não encontrado');
                return;
            }

            const nodeName = currentNode.data?.label || currentNode.data?.templateName || `Nó ${currentNode.id}`;

            if (currentNode.type === 'templateNode') {
                if (platform === 'evolution') {
                    await this.logAction(session.id, currentNode.id, nodeName, 'error', 'Template Node não suportado na Evolution API');
                    // Skip or handle as text?
                } else {
                    const templateName = currentNode.data.templateName;
                    if (templateName) {
                        const sessionVars = JSON.parse(session.variables || '{}');
                        const mapping = sessionVars._mapping || {};
                        const headerParams = [];
                        const bodyParams = [];
                        const nodeVarKeys = Object.keys(mapping).filter(k => k.startsWith(`fnode_${currentNode.id}_`));

                        if (nodeVarKeys.length > 0) {
                            const nodeVars = nodeVarKeys.map(k => ({ key: k, ...mapping[k] }))
                                .sort((a, b) => (a.order || 0) - (b.order || 0));

                            nodeVars.forEach(v => {
                                let resolvedValue = v.value || '';
                                if (v.type === 'column' && v.value) {
                                    resolvedValue = String(sessionVars[v.value] || '').substring(0, 100);
                                }
                                const paramObj = { name: v.index, value: resolvedValue };
                                v.component === 'HEADER' ? headerParams.push(paramObj) : bodyParams.push(paramObj);
                            });
                        }

                        const finalComponents = (headerParams.length > 0 || bodyParams.length > 0)
                            ? { header: headerParams, body: bodyParams }
                            : (currentNode.data.params || { header: [], body: [] });

                        const res = await sendWhatsApp(session.contactPhone, userConfig, templateName, finalComponents);

                        if (res.success) {
                            await this.logAction(session.id, currentNode.id, nodeName, 'sent_message', `Template: ${templateName}`);
                            await this.saveHistory(session.contactPhone, `[Meta] Template: ${templateName}`, true, userConfig.phoneId, 'meta', userConfig.userId);
                        } else {
                            await this.logAction(session.id, currentNode.id, nodeName, 'error', res.error || 'Erro ao enviar template');
                            await prisma.flowSession.update({ where: { id: session.id }, data: { status: 'error' } });
                            return;
                        }
                    }
                }
            } else if (currentNode.type === 'imageNode') {
                const images = currentNode.data.imageUrls || (currentNode.data.imageUrl ? [currentNode.data.imageUrl] : []);
                for (const url of images) {
                    if (platform === 'evolution') {
                        await this.sendEvolutionMessage(session.contactPhone, null, url.trim(), 'image', userConfig);
                    } else {
                        await this.sendWhatsAppImage(session.contactPhone, url.trim(), userConfig);
                    }
                    await sleep(500);
                }
                await this.logAction(session.id, currentNode.id, nodeName, 'sent_message', `Enviada(s) ${images.length} imagem(ns)`);
                await this.saveHistory(session.contactPhone, `[${platform.toUpperCase()}] Enviou ${images.length} imagem(ns)`, true, userConfig.phoneId, platform, userConfig.userId);
            } else if (currentNode.type === 'optionsNode') {
                const messageText = currentNode.data.label || currentNode.data.title || 'Escolha uma opção';
                const options = currentNode.data.options || [];
                let fullSentText = messageText;

                // Typing Delay Logic
                const isAutomation = !!session.automationId;
                const typingTime = currentNode.data.typingTime !== undefined ? Number(currentNode.data.typingTime) : (isAutomation ? 5 : 0);
                const delayMs = typingTime > 0 ? typingTime * 1000 : 0;

                if (platform === 'evolution') {
                    const optionsText = options.map((opt, i) => `*${i + 1}.* ${opt}`).join('\n');
                    fullSentText = `${messageText}\n\n${optionsText}`;

                    const evolOptions = {};
                    if (delayMs > 0) {
                        evolOptions.delay = delayMs;
                        evolOptions.presence = 'composing';
                    }

                    await this.sendEvolutionMessage(session.contactPhone, fullSentText, null, null, userConfig, evolOptions);
                    await this.logAction(session.id, currentNode.id, nodeName, 'sent_message', `Opções (Evolution): ${messageText}`);
                } else {
                    if (delayMs > 0) await sleep(delayMs); // Helper sleep for Meta/others still needed
                    if (options.length > 0) {
                        await this.sendWhatsAppInteractive(session.contactPhone, messageText, options, userConfig);
                        await this.logAction(session.id, currentNode.id, nodeName, 'sent_message', `Interativo: ${messageText}`);
                    } else {
                        await this.sendWhatsAppText(session.contactPhone, messageText, userConfig);
                        await this.logAction(session.id, currentNode.id, nodeName, 'sent_message', messageText);
                    }
                }
                await this.saveHistory(session.contactPhone, `[${platform.toUpperCase()}] ${fullSentText}`, true, userConfig.phoneId, platform, userConfig.userId);
            } else if (currentNode.type === 'messageNode' || !currentNode.type) {
                const messageText = currentNode.data.label || currentNode.data.message || '';
                if (messageText) {
                    // Typing Delay Logic
                    const isAutomation = !!session.automationId;
                    const typingTime = currentNode.data.typingTime !== undefined ? Number(currentNode.data.typingTime) : (isAutomation ? 5 : 0);
                    const delayMs = typingTime > 0 ? typingTime * 1000 : 0;

                    if (platform === 'evolution') {
                        const evolOptions = {};
                        if (delayMs > 0) {
                            evolOptions.delay = delayMs;
                            evolOptions.presence = 'composing';
                        }
                        await this.sendEvolutionMessage(session.contactPhone, messageText, null, null, userConfig, evolOptions);
                    } else {
                        if (delayMs > 0) await sleep(delayMs);
                        await this.sendWhatsAppText(session.contactPhone, messageText, userConfig);
                    }
                    await this.logAction(session.id, currentNode.id, nodeName, 'sent_message', messageText.substring(0, 100));
                    await this.saveHistory(session.contactPhone, `[${platform.toUpperCase()}] ${messageText}`, true, userConfig.phoneId, platform, userConfig.userId);
                }
            } else if (currentNode.type === 'emailNode') {
                const templateId = currentNode.data.templateId;
                const sessionVars = JSON.parse(session.variables || '{}');

                // PRIORITY 1: Check for manually set recipient email in node data
                let recipientEmail = currentNode.data.recipientEmail;

                // PRIORITY 2: Check session variable mapping
                if (!recipientEmail) {
                    const mapping = sessionVars._mapping || {};
                    const emailVarKey = `enode_${currentNode.id}_email`;
                    const emailMap = mapping[emailVarKey];
                    if (emailMap) {
                        recipientEmail = emailMap.type === 'column' ? sessionVars[emailMap.value] : emailMap.value;
                    }
                }

                // PRIORITY 3: Fallback to common email field names
                if (!recipientEmail) {
                    recipientEmail = sessionVars['email'] || sessionVars['Email'] || sessionVars['E-mail'];
                }

                if (templateId && recipientEmail) {
                    try {
                        await sendSingleEmail({
                            userId: userConfig.userId,
                            to: recipientEmail,
                            templateId: templateId,
                            leadData: sessionVars
                        });
                        await this.logAction(session.id, currentNode.id, nodeName, 'sent_email', `Enviado para ${recipientEmail}`);
                    } catch (e) {
                        await this.logAction(session.id, currentNode.id, nodeName, 'error', `Falha ao enviar e-mail: ${e.message}`);
                    }
                } else {
                    await this.logAction(session.id, currentNode.id, nodeName, 'error', `E-mail não configurado ou template não selecionado`);
                }
            } else if (currentNode.type === 'alertNode') {
                const alertPhone = currentNode.data.phone;
                const alertText = currentNode.data.text || 'Alerta do sistema';
                if (alertPhone) {
                    if (platform === 'evolution') {
                        await this.sendEvolutionMessage(alertPhone, alertText, null, null, userConfig);
                    } else {
                        await this.sendWhatsAppText(alertPhone, alertText, userConfig);
                    }
                    await this.logAction(session.id, currentNode.id, nodeName, 'alert_sent', `Alerta enviado para ${alertPhone}`);
                }
            } else if (currentNode.type === 'businessHoursNode') {
                const { start, end, fallback } = currentNode.data;
                const isWithin = this.isWithinHours(start || '08:00', end || '18:00');

                if (!isWithin) {
                    // Send fallback message
                    if (platform === 'evolution') {
                        await this.sendEvolutionMessage(session.contactPhone, fallback, null, null, userConfig);
                    } else {
                        await this.sendWhatsAppText(session.contactPhone, fallback, userConfig);
                    }

                    const resumeTime = this.getNextStartTime(start || '08:00');
                    await prisma.flowSession.update({
                        where: { id: session.id },
                        data: {
                            status: 'waiting_business_hours',
                            scheduledAt: resumeTime
                        }
                    });

                    await this.logAction(session.id, currentNode.id, nodeName, 'waiting_business_hours', `Fora do horário. Agendado para ${resumeTime.toISOString()} (UTC)`);
                    console.log(`[FLOW ENGINE] Session ${session.id} scheduled for ${resumeTime.toISOString()} (UTC)`);
                    return; // Stop execution here
                }
                await this.logAction(session.id, currentNode.id, nodeName, 'within_hours', 'Dentro do horário comercial');
            } else if (currentNode.type === 'closeAutomationNode') {
                // CLOSE AUTOMATION NODE - End session immediately
                await this.logAction(session.id, currentNode.id, 'Fechar Automação', 'automation_closed', 'Sessão encerrada pelo nó de fechamento');
                await this.endSession(session.id, 'Automação encerrada pelo nó de fechamento');
                return; // Stop execution - no next node
            }

            const outboundEdges = edges.filter(e => String(e.source) === String(currentNode.id));
            const hasOptions = outboundEdges.some(e => e.sourceHandle?.startsWith('source-') && e.sourceHandle !== 'source-gray');

            if (hasOptions || currentNode.data?.waitForReply) {
                await prisma.flowSession.update({
                    where: { id: session.id },
                    data: { status: 'waiting_reply' }
                });
                await this.logAction(session.id, currentNode.id, nodeName, 'waiting_reply', 'Aguardando resposta');
            } else {
                const nextEdge = outboundEdges.find(e => e.sourceHandle === 'source-gray' || !e.sourceHandle);
                if (nextEdge) {
                    const nextSession = await prisma.flowSession.update({
                        where: { id: session.id },
                        data: { currentStep: nextEdge.target, status: 'active' }
                    });
                    setTimeout(() => this.executeStep(nextSession, flow, userConfig, platform), 1000);
                } else {
                    await this.endSession(session.id, 'Fluxo concluído');
                }
            }
        } catch (err) {
            console.error('[FLOW EXECUTION ERROR]', err);
            await this.logAction(session.id, session.currentStep, null, 'error', err.message);
        }
    },

    async saveHistory(phone, body, isFromMe, phoneId, platform = 'meta', userId = null) {
        try {
            const normalizedPhone = String(phone).replace(/\D/g, '');
            if (platform === 'evolution' && userId) {
                await prisma.evolutionMessage.create({
                    data: {
                        userId: parseInt(userId),
                        contactPhone: normalizedPhone,
                        contactName: 'Eu',
                        messageBody: body,
                        isFromMe,
                        isRead: true,
                        instanceName: 'automated'
                    }
                });
            } else {
                await prisma.receivedMessage.create({
                    data: {
                        whatsappPhoneId: String(phoneId),
                        contactPhone: normalizedPhone,
                        contactName: 'Eu',
                        messageBody: body,
                        isFromMe,
                        isRead: true
                    }
                });
            }
        } catch (e) { console.error('[SAVE HISTORY ERROR]', e); }
    },

    // Evolution Send Helper
    async sendEvolutionPresence(phone, status, config) {
        try {
            const baseUrl = process.env.EVOLUTION_API_URL || config.evolutionApiUrl;
            const apiKey = process.env.EVOLUTION_API_KEY || config.evolutionApiKey;
            const instance = config.evolutionInstanceName;

            let normalizedPhone = String(phone).replace(/\D/g, '');
            if (!normalizedPhone.startsWith('55')) normalizedPhone = '55' + normalizedPhone;
            const remoteJid = `${normalizedPhone}@s.whatsapp.net`;

            // status: 'composing' | 'recording' | 'available'
            await fetch(`${baseUrl}/chat/sendPresence/${instance}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify({ number: remoteJid, presence: status, delay: 0 })
            });
        } catch (e) { console.error('[EVOLUTION PRESENCE ERROR]', e); }
    },

    async sendEvolutionMessage(phone, body, mediaUrl, mediaType, config, options = {}) {
        try {
            const baseUrl = process.env.EVOLUTION_API_URL || config.evolutionApiUrl;
            const apiKey = process.env.EVOLUTION_API_KEY || config.evolutionApiKey;
            const instance = config.evolutionInstanceName;

            let normalizedPhone = String(phone).replace(/\D/g, '');
            if (!normalizedPhone.startsWith('55')) normalizedPhone = '55' + normalizedPhone;
            const remoteJid = `${normalizedPhone}@s.whatsapp.net`;

            let endpoint = `/message/sendText/${instance}`;
            let payload = { number: remoteJid, text: body };

            // Add typing/delay support for v2
            if (options.delay) payload.delay = options.delay;
            if (options.presence) payload.presence = options.presence; // 'composing' or 'recording'

            if (mediaUrl) {
                endpoint = mediaType === 'audio' ? `/message/sendWhatsAppAudio/${instance}` : `/message/sendMedia/${instance}`;
                payload = {
                    number: remoteJid,
                    mediatype: mediaType || 'image',
                    media: mediaUrl,
                    caption: body || ''
                };
                // Media might use different structure for delay/presence, check doc or assume generally supported
                if (options.delay) payload.delay = options.delay;
            }

            const res = await fetch(`${baseUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify(payload)
            });
            return await res.json();
        } catch (e) { console.error('[EVOLUTION SEND ERROR]', e); }
    },

    async sendWhatsAppImage(phone, imageUrl, config) {
        try {
            let normalizedPhone = String(phone).replace(/\D/g, '');
            if (!normalizedPhone.startsWith('55')) normalizedPhone = '55' + normalizedPhone;

            let mediaId = (imageUrl.startsWith('/') || !imageUrl.startsWith('http'))
                ? await uploadMediaToMeta(imageUrl, 'image', config)
                : null;

            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: normalizedPhone,
                type: "image",
                image: mediaId ? { id: mediaId } : { link: imageUrl }
            };

            await fetch(`https://graph.facebook.com/v21.0/${config.phoneId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${config.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) { console.error('[FLOW IMAGE ERROR]', e); }
    },

    async sendWhatsAppInteractive(phone, messageText, options, config) {
        let interactive = options.length <= 3 ? {
            type: "button",
            body: { text: messageText },
            action: {
                buttons: options.map((opt, i) => ({ type: "reply", reply: { id: `source-${i + 1}`, title: opt.substring(0, 20) } }))
            }
        } : {
            type: "list",
            body: { text: messageText },
            action: {
                button: "Ver opções",
                sections: [{ title: "Opções", rows: options.map((opt, i) => ({ id: `source-${i + 1}`, title: opt.substring(0, 24) })) }]
            }
        };

        await fetch(`https://graph.facebook.com/v21.0/${config.phoneId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${config.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: phone, type: "interactive", interactive })
        });
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
            // Check both flow and automation sessions
            sessionWhere.OR = [
                { flow: { userId: targetUserId } },
                { automation: { userId: targetUserId } }
            ];
        }

        const session = await prisma.flowSession.findFirst({
            where: sessionWhere,
            include: {
                flow: true,
                automation: true
            }
        });

        if (!session) return false;

        const flow = session.flow || session.automation;
        if (!flow) return false;

        const userConfig = await prisma.userConfig.findUnique({ where: { userId: flow.userId } });
        if (!userConfig) return false;

        const nodes = JSON.parse(flow.nodes);
        const edges = JSON.parse(flow.edges);
        const currentNode = nodes.find(n => String(n.id) === String(session.currentStep));
        if (!currentNode) return false;

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
                console.log(`[FLOW DEBUG] Body: "${body}", Choice (Regex): ${choice}`);

                if (!choice) {
                    const optIdx = (currentNode.data?.options || []).findIndex(opt => opt.toLowerCase() === body);
                    if (optIdx !== -1) choice = String(optIdx + 1);
                    console.log(`[FLOW DEBUG] Choice (Text Match): ${choice}`);
                }
                const edge = outboundEdges.find(e => e.sourceHandle === `source-${choice}`);
                if (edge) {
                    nextNodeId = edge.target;
                } else {
                    isValid = false;
                    console.log(`[FLOW DEBUG] Invalid Choice. IsValid set to FALSE. Choice was: ${choice}`);
                }
            }
        } else {
            const edge = outboundEdges.find(e => ['source-green', 'source-gray'].includes(e.sourceHandle)) || outboundEdges.find(e => !['source-red', 'source-invalid'].includes(e.sourceHandle));
            if (edge) nextNodeId = edge.target;
        }

        if (!isValid) {
            const redEdge = outboundEdges.find(e => ['source-red', 'source-invalid'].includes(e.sourceHandle));
            console.log(`[FLOW DEBUG] Validation Failed. RedEdge: ${!!redEdge}, Node Type: ${currentNode.type}`);

            if (currentNode.type === 'optionsNode' && !redEdge) {
                // Dynamic validation: Derive valid options from EDGES or Data
                let validNumbers = [];

                // 1. Try to get from edges first (source-truth)
                const sourceHandles = outboundEdges
                    .map(e => e.sourceHandle)
                    .filter(h => h && h.startsWith('source-') && !['source-red', 'source-invalid', 'source-green', 'source-gray'].includes(h));

                validNumbers = sourceHandles.map(h => parseInt(h.replace('source-', ''), 10)).filter(n => !isNaN(n)).sort((a, b) => a - b);

                // 2. Fallback to data.options count if edges are weird/missing but options exist
                if (validNumbers.length === 0 && currentNode.data?.options?.length > 0) {
                    validNumbers = Array.from({ length: currentNode.data.options.length }, (_, i) => i + 1);
                }

                console.log(`[FLOW DEBUG] Dynamic Validation. Valid Numbers: ${validNumbers.join(', ')}`);

                if (validNumbers.length > 0) {
                    let validMsg = "";
                    if (validNumbers.length === 1) validMsg = String(validNumbers[0]);
                    else {
                        const last = validNumbers.pop();
                        validMsg = `${validNumbers.join(', ')} ou ${last}`;
                    }
                    const errorMsg = `Por favor, responda apenas com ${validMsg}`;

                    if (platform === 'evolution') {
                        await this.sendEvolutionMessage(normalizedPhone, errorMsg, null, null, userConfig);
                    } else {
                        await this.sendWhatsAppText(normalizedPhone, errorMsg, userConfig);
                    }
                    await this.logAction(session.id, currentNode.id, nodeName, 'invalid_reply', `Validação: ${messageBody}`);
                    return true; // Keep waiting for reply on same node
                }
            }

            if (redEdge) {
                const nextSession = await prisma.flowSession.update({ where: { id: session.id }, data: { currentStep: redEdge.target, status: 'active' } });
                await this.logAction(session.id, currentNode.id, nodeName, 'invalid_reply', `Resposta inválida: ${messageBody}`);
                await this.executeStep(nextSession, flow, userConfig, platform);
            } else {
                if (platform === 'evolution') {
                    await this.sendEvolutionMessage(normalizedPhone, "Opção inválida. Por favor tente novamente.", null, null, userConfig);
                } else {
                    await this.sendWhatsAppText(normalizedPhone, "Opção inválida. Por favor tente novamente.", userConfig);
                }
            }
            return true;
        }

        if (nextNodeId) {
            await this.logAction(session.id, currentNode.id, nodeName, 'received_reply', `Resposta recebida: "${messageBody}"`);
            const nextSession = await prisma.flowSession.update({ where: { id: session.id }, data: { currentStep: String(nextNodeId), status: 'active' } });
            await this.executeStep(nextSession, flow, userConfig, platform);
        } else {
            await this.endSession(session.id, 'Fluxo concluído');
        }
        return true;
    },

    async endSession(sessionId, reason = 'Fluxo concluído') {
        await prisma.flowSession.update({ where: { id: sessionId }, data: { status: 'completed' } });
        await this.logAction(sessionId, null, null, 'completed', reason);
    },

    async sendWhatsAppText(phone, text, config) {
        await fetch(`https://graph.facebook.com/v21.0/${config.phoneId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${config.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: phone, type: "text", text: { body: text } })
        });
    },

    // Helper to get current time in GMT-3
    getNowGMT3() {
        const now = new Date();
        // UTC to GMT-3: subtract 3 hours
        return new Date(now.getTime() - (3 * 60 * 60 * 1000));
    },

    isWithinHours(start, end) {
        const now = this.getNowGMT3();
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const s = new Date(now); s.setHours(sh, sm, 0, 0);
        const e = new Date(now); e.setHours(eh, em, 0, 0);
        return now >= s && now <= e;
    },

    getNextStartTime(start) {
        const now = this.getNowGMT3();
        const [sh, sm] = start.split(':').map(Number);
        const next = new Date(now); next.setHours(sh, sm, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);

        // Convert the GMT-3 "next" back to UTC for scheduling if the system expects UTC
        // But since scheduledAt is compared with 'now' in processScheduledFlows, and that 'now' is local server time (UTC),
        // we should return the UTC equivalent of this GMT-3 time.
        const resumeUTC = new Date(next.getTime() + (3 * 60 * 60 * 1000));
        console.log(`[FLOW ENGINE] Calculate Next: 
            Human Next (GMT-3): ${next.toLocaleString('pt-BR')} 
            Stored Stamped (UTC): ${resumeUTC.toISOString()}
            Current VM Time (UTC): ${new Date().toISOString()}`);
        return resumeUTC;
    },

    async processScheduledFlows() {
        const now = new Date();
        const sessions = await prisma.flowSession.findMany({
            where: {
                status: 'waiting_business_hours',
                scheduledAt: { lte: now }
            },
            include: { flow: true, automation: true }
        });

        if (sessions.length > 0) {
            console.log(`[FLOW ENGINE] Found ${sessions.length} sessions waiting to resume at ${now.toISOString()}`);
        }

        for (const session of sessions) {
            try {
                const scheduledTime = session.scheduledAt ? session.scheduledAt.toISOString() : 'N/A';
                console.log(`[FLOW ENGINE] Resuming session ${session.id} (Current Step: ${session.currentStep}). Scheduled for: ${scheduledTime}`);

                const flow = session.flow || session.automation;
                if (!flow) {
                    console.error(`[FLOW ENGINE] Session ${session.id} has no flow or automation attached!`);
                    await prisma.flowSession.update({ where: { id: session.id }, data: { status: 'error' } });
                    continue;
                }

                const userConfig = await prisma.userConfig.findUnique({ where: { userId: flow.userId } });
                if (!userConfig) {
                    console.error(`[FLOW ENGINE] User config not found for userId: ${flow.userId}`);
                    continue;
                }

                const edges = JSON.parse(flow.edges || '[]');
                const outboundEdges = edges.filter(e => String(e.source) === String(session.currentStep));

                // Priority: gray/green handle or no handle (default path)
                const nextEdge = outboundEdges.find(e => ['source-gray', 'source-green'].includes(e.sourceHandle)) ||
                    outboundEdges.find(e => !e.sourceHandle);

                if (nextEdge) {
                    console.log(`[FLOW ENGINE] Found next edge: ${session.currentStep} -> ${nextEdge.target}`);
                    const nextSession = await prisma.flowSession.update({
                        where: { id: session.id },
                        data: { currentStep: nextEdge.target, status: 'active', scheduledAt: null }
                    });

                    await this.executeStep(nextSession, flow, userConfig, session.platform);
                } else {
                    console.warn(`[FLOW ENGINE] No outbound edge found for session ${session.id} at step ${session.currentStep}. Paths available: ${outboundEdges.map(e => e.sourceHandle).join(', ')}`);
                    // If no edge, just complete it
                    await prisma.flowSession.update({ where: { id: session.id }, data: { status: 'completed', scheduledAt: null } });
                }
            } catch (err) {
                console.error(`[FLOW ENGINE] Error processing scheduled session ${session.id}:`, err);
            }
        }
    },
};

export default FlowEngine;

