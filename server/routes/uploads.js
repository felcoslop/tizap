import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Prefer /data/uploads for persistence in Docker (Easypanel)
        // Fallback to local uploads folder
        const possiblePaths = [
            '/data/uploads',
            path.join(process.cwd(), 'uploads')
        ];

        let uploadPath = '';
        for (const p of possiblePaths) {
            try {
                if (!fs.existsSync(p)) {
                    fs.mkdirSync(p, { recursive: true });
                }
                // Test writability
                fs.accessSync(p, fs.constants.W_OK);
                uploadPath = p;
                break;
            } catch (err) {
                console.warn(`[UPLOAD] Cannot use path ${p}:`, err.message);
            }
        }

        if (!uploadPath) {
            console.error('[UPLOAD ERROR] No writable directory found!');
            return cb(new Error('Nenhum diretório com permissão de escrita encontrado para uploads.'));
        }

        console.log('[UPLOAD] Selected Destination:', uploadPath);
        cb(null, uploadPath);
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
