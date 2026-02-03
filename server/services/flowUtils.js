import prisma from '../db.js';
import { sendWhatsApp, uploadMediaToMeta as uploadToMeta } from './whatsapp.js';
import { sleep } from '../utils/helpers.js';

export const logAction = async (sessionId, nodeId, nodeName, action, details) => {
    try {
        await prisma.flowSessionLog.create({
            data: { sessionId, nodeId, nodeName, action, details }
        });
    } catch (e) {
        console.error('[FLOW LOG ERROR]', e);
    }
};

export const saveHistory = async (phone, body, isFromMe, phoneId, platform = 'meta', userId = null) => {
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
};

export const sendWhatsAppText = async (phone, text, config) => {
    await fetch(`https://graph.facebook.com/v21.0/${config.phoneId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: phone, type: "text", text: { body: text } })
    });
};

export const sendWhatsAppImage = async (phone, imageUrl, config) => {
    try {
        let normalizedPhone = String(phone).replace(/\D/g, '');
        if (!normalizedPhone.startsWith('55')) normalizedPhone = '55' + normalizedPhone;

        let mediaId = (imageUrl.startsWith('/') || !imageUrl.startsWith('http'))
            ? await uploadToMeta(imageUrl, 'image', config)
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
};

export const sendWhatsAppInteractive = async (phone, messageText, options, config) => {
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
};

export const sendEvolutionMessage = async (phone, body, mediaUrl, mediaType, config, options = {}) => {
    try {
        const baseUrl = process.env.EVOLUTION_API_URL || config.evolutionApiUrl;
        const apiKey = process.env.EVOLUTION_API_KEY || config.evolutionApiKey;
        const instance = config.evolutionInstanceName;

        let normalizedPhone = String(phone).replace(/\D/g, '');
        if (!normalizedPhone.startsWith('55')) normalizedPhone = '55' + normalizedPhone;
        const remoteJid = `${normalizedPhone}@s.whatsapp.net`;

        let endpoint = `/message/sendText/${instance}`;
        let payload = { number: remoteJid, text: body };

        if (options.delay) payload.delay = options.delay;
        if (options.presence) payload.presence = options.presence;

        if (mediaUrl) {
            endpoint = mediaType === 'audio' ? `/message/sendWhatsAppAudio/${instance}` : `/message/sendMedia/${instance}`;
            payload = {
                number: remoteJid,
                mediatype: mediaType || 'image',
                media: mediaUrl,
                caption: body || ''
            };
            if (options.delay) payload.delay = options.delay;
        }

        const res = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify(payload)
        });
        return await res.json();
    } catch (e) { console.error('[EVOLUTION SEND ERROR]', e); }
};

export const endSession = async (sessionId, reason = 'Fluxo concluído') => {
    await prisma.flowSession.update({ where: { id: sessionId }, data: { status: 'completed' } });
    await logAction(sessionId, null, null, 'completed', reason);
};

export const getNowGMT3 = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
};

export const isWithinHours = (start, end) => {
    const now = new Date();
    const spTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const currentHour = spTime.getHours();
    const currentMinute = spTime.getMinutes();

    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);

    const currentTotal = currentHour * 60 + currentMinute;
    const startTotal = sh * 60 + sm;
    const endTotal = eh * 60 + em;

    const isOpen = currentTotal >= startTotal && currentTotal <= endTotal;
    return isOpen;
};

export const getNextStartTime = (start) => {
    const now = getNowGMT3();
    const [sh, sm] = start.split(':').map(Number);
    const next = new Date(now); next.setHours(sh, sm, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const resumeUTC = new Date(next.getTime() + (3 * 60 * 60 * 1000));
    return resumeUTC;
};
