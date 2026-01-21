import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Multi-image upload route
router.post('/upload-image', authenticateToken, upload.array('images'), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
        }

        const protocol = req.protocol;
        const host = req.get('host');
        const urls = req.files.map(file => `${protocol}://${host}/uploads/${file.filename}`);

        res.json({ success: true, urls });
    } catch (err) {
        console.error('[UPLOAD ERROR]', err);
        res.status(500).json({ error: 'Erro ao processar upload.' });
    }
});

export default router;
