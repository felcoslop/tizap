import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/index.js';
import { UPLOAD_DIR } from '../config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log('[UPLOAD] Saving to:', UPLOAD_DIR);
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const name = uniqueSuffix + path.extname(file.originalname);
        cb(null, name);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
}).array('images');

// Multi-image upload route
router.post('/upload-image', authenticateToken, (req, res, next) => {
    upload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('[MULTER ERROR]', err);
            return res.status(400).json({ error: `Erro no Multer: ${err.message}` });
        } else if (err) {
            console.error('[UPLOAD UNKNOWN ERROR]', err);
            return res.status(500).json({ error: `Erro desconhecido no upload: ${err.message}` });
        }

        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
            }

            const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
            const host = req.get('host');
            const urls = req.files.map(file => `${protocol}://${host}/uploads/${file.filename}`);

            console.log('[UPLOAD SUCCESS] URLs:', urls);
            res.json({ success: true, urls });
        } catch (err) {
            console.error('[UPLOAD CONTROLLER ERROR]', err);
            res.status(500).json({ error: 'Erro ao processar URLs de upload.' });
        }
    });
});

export default router;
