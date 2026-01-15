import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../db.js';
import transporter from '../config/email.js';
import { JWT_SECRET, FRONTEND_URL, EMAIL_USER } from '../config/constants.js';

const router = express.Router();

// Helper: Send Verification Email
const sendVerificationEmail = async (email, token) => {
    const verificationUrl = `${FRONTEND_URL}/verify?token=${token}`;
    try {
        await transporter.sendMail({
            from: `"tiZAP!" <${EMAIL_USER}>`,
            to: email,
            subject: 'Confirme seu cadastro no tiZAP!',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #280091;">Olá! Confirme seu e-mail</h2>
                    <p>Faltam poucos passos para você começar a usar o tiZAP!. Clique no botão abaixo para ativar sua conta:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationUrl}" style="background-color: #ffc200; color: #280091; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                            Confirmar E-mail
                        </a>
                    </div>
                    <p style="color: #666; font-size: 14px;">Este link é válido por 24 horas.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #888;">Se você não solicitou este cadastro, pode ignorar este e-mail.</p>
                </div>
            `
        });
        return { success: true };
    } catch (err) {
        console.error('[EMAIL ERROR]', err);
        return { success: false, error: err.message };
    }
};

// Helper: Send Reset Password Email
const sendResetEmail = async (email, token) => {
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
    try {
        await transporter.sendMail({
            from: `"tiZAP!" <${EMAIL_USER}>`,
            to: email,
            subject: 'Redefinição de Senha - tiZAP!',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #280091;">Redefinição de Senha</h2>
                    <p>Você solicitou a redefinição de sua senha no tiZAP!. Clique no botão abaixo para escolher uma nova senha:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="background-color: #ffc200; color: #280091; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                            Redefinir Senha
                        </a>
                    </div>
                    <p style="color: #666; font-size: 14px;">Este link é válido por 1 hora.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #888;">Se você não solicitou isso, ignore este e-mail.</p>
                </div>
            `
        });
        return { success: true };
    } catch (err) {
        console.error('[EMAIL ERROR]', err);
        return { success: false, error: err.message };
    }
};

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, name, password } = req.body;
        const normalizedEmail = email.trim().toLowerCase();

        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) {
            return res.status(400).json({ error: 'E-mail já cadastrado' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const user = await prisma.user.create({
            data: {
                email: normalizedEmail,
                name,
                password: hashedPassword,
                isVerified: false,
                verificationToken: token,
                verificationExpires: expiresAt
            }
        });

        await prisma.userConfig.create({ data: { userId: user.id } });

        const mailResult = await sendVerificationEmail(normalizedEmail, token);
        if (!mailResult.success) {
            console.error('[REGISTER] Failed to send email:', mailResult.error);
        }

        res.json({ success: true, message: 'Cadastro realizado! Verifique seu e-mail para ativar a conta.' });
    } catch (err) {
        console.error('[REGISTER ERROR]', err);
        res.status(500).json({ error: 'Erro ao cadastrar usuário' });
    }
});

// Verify Email
router.get('/verify/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const user = await prisma.user.findFirst({
            where: {
                verificationToken: token,
                verificationExpires: { gt: new Date() }
            }
        });

        if (!user) {
            return res.status(400).json({ error: 'Token inválido ou expirado' });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                isVerified: true,
                verificationToken: null,
                verificationExpires: null
            }
        });

        res.json({ success: true, message: 'Conta ativada com sucesso! Você já pode fazer login.' });
    } catch (err) {
        console.error('[VERIFY ERROR]', err);
        res.status(500).json({ error: 'Erro ao verificar e-mail' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email.trim().toLowerCase();

        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            include: { config: true }
        });

        if (!user) {
            return res.status(401).json({ error: 'E-mail ou senha incorretos' });
        }

        const isMatch = user.password.startsWith('$2')
            ? await bcrypt.compare(password, user.password)
            : user.password === password;

        if (!isMatch) {
            return res.status(401).json({ error: 'E-mail ou senha incorretos' });
        }

        if (!user.isVerified) {
            return res.status(401).json({ error: 'Sua conta ainda não foi verificada. Verifique seu e-mail.' });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
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

// Forgot Password
router.post('/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const normalizedEmail = email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

        if (!user) {
            return res.json({ success: true, message: 'Se o e-mail existir no sistema, enviamos um link para redefinir a senha.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetPasswordToken: token,
                resetPasswordExpires: expires
            }
        });

        const mailResult = await sendResetEmail(normalizedEmail, token);
        if (!mailResult.success) {
            return res.status(500).json({ error: 'Erro ao enviar e-mail de redefinição' });
        }

        res.json({ success: true, message: 'E-mail de redefinição enviado!' });
    } catch (err) {
        console.error('[FORGOT ERROR]', err);
        res.status(500).json({ error: 'Erro ao processar solicitação' });
    }
});

// Reset Password
router.post('/auth/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        const user = await prisma.user.findFirst({
            where: {
                resetPasswordToken: token,
                resetPasswordExpires: { gt: new Date() }
            }
        });

        if (!user) {
            return res.status(400).json({ error: 'Link de redefinição inválido ou expirado' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpires: null
            }
        });

        res.json({ success: true, message: 'Senha atualizada com sucesso!' });
    } catch (err) {
        console.error('[RESET ERROR]', err);
        res.status(500).json({ error: 'Erro ao redefinir senha' });
    }
});

export default router;
