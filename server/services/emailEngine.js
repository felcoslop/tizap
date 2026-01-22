import nodemailer from 'nodemailer';
import prisma from '../db.js';
import { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } from '../config/constants.js';
import { sleep } from '../utils/helpers.js';

const activeCampaigns = new Map();

/**
 * Sends a single email using a template and optional lead data for variable replacement.
 */
export async function sendSingleEmail({ userId, to, templateId, leadData = {}, subject: overrideSubject = null }) {
    const template = await prisma.emailTemplate.findUnique({
        where: { id: parseInt(templateId) }
    });

    if (!template) throw new Error('Template não encontrado');

    const transporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: parseInt(EMAIL_PORT),
        secure: parseInt(EMAIL_PORT) === 465,
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
        logger: true,
        debug: true
    });

    // Replace variables in HTML
    let html = template.html || '';
    Object.keys(leadData).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'gi');
        html = html.replace(regex, leadData[key] || '');
    });

    try {
        await transporter.sendMail({
            from: `"tiZAP! Automação" <${EMAIL_USER}>`,
            to: to,
            subject: overrideSubject || template.subject || template.name,
            html: html
        });
        return { success: true };
    } catch (err) {
        console.error('[SINGLE EMAIL ERROR]', err);
        throw err;
    }
}

export async function startEmailCampaign(campaignId, broadcast) {
    if (activeCampaigns.has(campaignId)) return;

    const campaign = await prisma.emailCampaign.findUnique({
        where: { id: campaignId },
        include: { template: true }
    });

    if (!campaign) return;

    activeCampaigns.set(campaignId, true);

    const leads = JSON.parse(campaign.leadsData);
    let currentIndex = campaign.currentIndex;

    try {
        await prisma.emailCampaign.update({
            where: { id: campaignId },
            data: { status: 'running' }
        });

        while (currentIndex < leads.length && activeCampaigns.has(campaignId)) {
            const lead = leads[currentIndex];
            const recipientEmail = lead.email || lead['E-mail'] || lead.Email || lead['email'] || lead['EMAIL'];

            if (!recipientEmail) {
                await logEmail(campaignId, 'N/A', 'error', 'Email não encontrado no lead');
                currentIndex++;
                continue;
            }

            try {
                await sendSingleEmail({
                    userId: campaign.userId,
                    to: recipientEmail,
                    templateId: campaign.templateId,
                    leadData: lead,
                    subject: campaign.subject
                });

                await logEmail(campaignId, recipientEmail, 'success', 'Enviado com sucesso');
                await prisma.emailCampaign.update({
                    where: { id: campaignId },
                    data: {
                        currentIndex: currentIndex + 1,
                        successCount: { increment: 1 }
                    }
                });
            } catch (err) {
                console.error(`[EMAIL ERROR] Fail to send to ${recipientEmail}:`, err);
                await logEmail(campaignId, recipientEmail, 'error', err.message);
                await prisma.emailCampaign.update({
                    where: { id: campaignId },
                    data: {
                        currentIndex: currentIndex + 1,
                        errorCount: { increment: 1 }
                    }
                });
            }

            currentIndex++;
            broadcast('email:progress', {
                campaignId,
                currentIndex,
                totalLeads: leads.length
            }, campaign.userId);

            // Anti-spam delay: batch of 5 every 2 seconds
            if (currentIndex % 5 === 0) {
                await sleep(2000);
            } else {
                await sleep(500);
            }
        }

        if (currentIndex >= leads.length && activeCampaigns.has(campaignId)) {
            await prisma.emailCampaign.update({
                where: { id: campaignId },
                data: { status: 'completed' }
            });
        }

    } catch (err) {
        console.error('[EMAIL CAMPAIGN ERROR]', err);
        await prisma.emailCampaign.update({
            where: { id: campaignId },
            data: { status: 'error' }
        });
    } finally {
        activeCampaigns.delete(campaignId);
    }
}

async function logEmail(campaignId, email, status, message) {
    try {
        await prisma.emailCampaignLog.create({
            data: { campaignId, email, status, message }
        });
    } catch (e) {
        console.error('Error logging email:', e);
    }
}

export function stopEmailCampaign(campaignId) {
    activeCampaigns.delete(campaignId);
}
