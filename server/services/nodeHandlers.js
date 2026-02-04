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
import { sendWhatsApp } from './whatsapp.js';
import { sendSingleEmail } from './emailEngine.js';
import { sleep } from '../utils/helpers.js';

export const nodeHandlers = {
    templateNode: async (session, node, userConfig, platform) => {
        if (platform === 'evolution') {
            await logAction(session.id, node.id, node.data.label, 'error', 'Template Node não suportado na Evolution API');
            return { action: 'continue' };
        }

        const templateName = node.data.templateName;
        if (!templateName) return { action: 'continue' };

        const sessionVars = JSON.parse(session.variables || '{}');
        const mapping = sessionVars._mapping || {};
        const headerParams = [];
        const bodyParams = [];
        const nodeVarKeys = Object.keys(mapping).filter(k => k.startsWith(`fnode_${node.id}_`));

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
            : (node.data.params || { header: [], body: [] });

        const res = await sendWhatsApp(session.contactPhone, userConfig, templateName, finalComponents);
        if (res.success) {
            await logAction(session.id, node.id, node.data.label, 'sent_message', `Template: ${templateName}`);
            await saveHistory(session.contactPhone, `[Meta] Template: ${templateName}`, true, userConfig.phoneId, 'meta', userConfig.userId);
            return { action: 'continue' };
        } else {
            await logAction(session.id, node.id, node.data.label, 'error', res.error || 'Erro ao enviar template');
            return { action: 'error', error: res.error };
        }
    },

    imageNode: async (session, node, userConfig, platform) => {
        const images = node.data.imageUrls || (node.data.imageUrl ? [node.data.imageUrl] : []);
        for (const url of images) {
            if (platform === 'evolution') {
                await sendEvolutionMessage(session.contactPhone, null, url.trim(), 'image', userConfig);
            } else {
                await sendWhatsAppImage(session.contactPhone, url.trim(), userConfig);
            }
            await sleep(500);
        }
        await logAction(session.id, node.id, node.data.label, 'sent_message', `Enviada(s) ${images.length} imagem(ns)`);
        await saveHistory(session.contactPhone, `[${platform.toUpperCase()}] Enviou ${images.length} imagem(ns)`, true, userConfig.phoneId, platform, userConfig.userId);
        return { action: 'continue' };
    },

    optionsNode: async (session, node, userConfig, platform) => {
        const messageText = node.data.label || node.data.title || 'Escolha uma opção';
        const options = node.data.options || [];
        let fullSentText = messageText;

        const isAutomation = !!session.automationId;
        const typingTime = node.data.typingTime !== undefined ? Number(node.data.typingTime) : (isAutomation ? 2 : 0);
        const delayMs = typingTime > 0 ? typingTime * 1000 : 0;

        if (platform === 'evolution') {
            const optionsText = options.map((opt, i) => `*${i + 1}.* ${opt}`).join('\n');
            fullSentText = `${messageText}\n\n${optionsText}`;
            const evolOptions = delayMs > 0 ? { delay: delayMs, presence: 'composing' } : {};
            await sendEvolutionMessage(session.contactPhone, fullSentText, null, null, userConfig, evolOptions);
        } else {
            if (delayMs > 0) await sleep(delayMs);
            if (options.length > 0) {
                await sendWhatsAppInteractive(session.contactPhone, messageText, options, userConfig);
            } else {
                await sendWhatsAppText(session.contactPhone, messageText, userConfig);
            }
        }
        await logAction(session.id, node.id, node.data.label, 'sent_message', `Opções: ${messageText.substring(0, 50)}...`);
        await saveHistory(session.contactPhone, `[${platform.toUpperCase()}] ${fullSentText}`, true, userConfig.phoneId, platform, userConfig.userId);
        return { action: 'wait', waitTimeout: node.data.waitTimeout };
    },

    messageNode: async (session, node, userConfig, platform) => {
        const messageText = node.data.label || node.data.message || '';
        if (!messageText) return { action: 'continue' };

        const isAutomation = !!session.automationId;
        const typingTime = node.data.typingTime !== undefined ? Number(node.data.typingTime) : (isAutomation ? 5 : 0);
        const delayMs = typingTime > 0 ? typingTime * 1000 : 0;

        if (platform === 'evolution') {
            const evolOptions = delayMs > 0 ? { delay: delayMs, presence: 'composing' } : {};
            await sendEvolutionMessage(session.contactPhone, messageText, null, null, userConfig, evolOptions);
        } else {
            if (delayMs > 0) await sleep(delayMs);
            await sendWhatsAppText(session.contactPhone, messageText, userConfig);
        }
        await logAction(session.id, node.id, node.data.label, 'sent_message', messageText.substring(0, 100));
        await saveHistory(session.contactPhone, `[${platform.toUpperCase()}] ${messageText}`, true, userConfig.phoneId, platform, userConfig.userId);

        if (node.data.waitForReply) {
            return { action: 'wait', waitTimeout: node.data.waitTimeout };
        }
        return { action: 'continue' };
    },

    emailNode: async (session, node, userConfig) => {
        const templateId = node.data.templateId;
        const sessionVars = JSON.parse(session.variables || '{}');

        let recipientEmail = node.data.recipientEmail;
        if (!recipientEmail) {
            const mapping = sessionVars._mapping || {};
            const emailVarKey = `enode_${node.id}_email`;
            const emailMap = mapping[emailVarKey];
            if (emailMap) {
                recipientEmail = emailMap.type === 'column' ? sessionVars[emailMap.value] : emailMap.value;
            }
        }
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
                await logAction(session.id, node.id, node.data.label, 'sent_email', `Enviado para ${recipientEmail}`);
            } catch (e) {
                await logAction(session.id, node.id, node.data.label, 'error', `Falha ao enviar e-mail: ${e.message}`);
            }
        } else {
            await logAction(session.id, node.id, node.data.label, 'error', `Configuração de e-mail insuficiente`);
        }
        return { action: 'continue' };
    },

    alertNode: async (session, node, userConfig, platform) => {
        const alertPhone = node.data.phone;
        const alertText = node.data.text || 'Alerta do sistema';
        if (alertPhone) {
            if (platform === 'evolution') {
                await sendEvolutionMessage(alertPhone, alertText, null, null, userConfig);
            } else {
                await sendWhatsAppText(alertPhone, alertText, userConfig);
            }
            await logAction(session.id, node.id, node.data.label, 'alert_sent', `Alerta enviado para ${alertPhone}`);
        }
        return { action: 'continue' };
    },

    businessHoursNode: async (session, node, userConfig, platform) => {
        const { start, end, fallback } = node.data;
        const isWithin = isWithinHours(start || '08:00', end || '18:00');

        if (!isWithin) {
            if (platform === 'evolution') {
                await sendEvolutionMessage(session.contactPhone, fallback, null, null, userConfig);
            } else {
                await sendWhatsAppText(session.contactPhone, fallback, userConfig);
            }
            const resumeTime = getNextStartTime(start || '08:00');
            await logAction(session.id, node.id, node.data.label, 'waiting_business_hours', `Agendado para ${resumeTime.toISOString()}`);
            return { action: 'schedule', scheduledAt: resumeTime };
        }
        await logAction(session.id, node.id, node.data.label, 'within_hours', 'Dentro do horário comercial');
        return { action: 'continue' };
    },

    closeAutomationNode: async (session, node) => {
        await logAction(session.id, node.id, 'Fechar Automação', 'automation_closed', 'Sessão encerrada pelo nó de fechamento');
        await endSession(session.id, 'Automação encerrada pelo nó de fechamento');
        return { action: 'end' };
    }
};
