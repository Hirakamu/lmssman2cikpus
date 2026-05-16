import express from 'express';
import multer from 'multer';
import { lmsfs } from '../lib/filesystem.js';


const router = express.Router();
const uploadHandler = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
});

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

router.post('/', uploadHandler.single('file'), async (req, res, next) => {
    const category = req.body.category as string;
    if (!req.file) { return res.status(400).json({ error: 'No file uploaded' }); }
    if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) { return res.status(400).json({ error: `File type not allowed: ${req.file.mimetype}` }); }
    if (!category || !lmsfs.getCategories().includes(category)) { return res.status(400).json({ error: 'Invalid category', allowed: lmsfs.getCategories() });}
    const result = await lmsfs.new(category, req.file.buffer);
    if (!result.status) { next(new Error('Failed to store file')); }
    res.status(201).json({
        uuid: result.uuid,
        accesslink: result.accesslink,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
    });
});

router.post('/chunk', uploadHandler.single('chunk'), async (req, res, next) => {
    if (!req.file) { return res.status(400).json({ error: 'No chunk data' }); }
    const tempId = req.body.tempId as string;
    const chunkIndex = parseInt(req.body.chunkIndex, 10);
    const totalChunks = parseInt(req.body.totalChunks, 10);
    if (!tempId || isNaN(chunkIndex) || isNaN(totalChunks) || chunkIndex < 0 || chunkIndex >= totalChunks) { return res.status(400).json({ error: 'Invalid chunk metadata' });}
    const result = await lmsfs.tmpWrite(tempId, chunkIndex, req.file.buffer);
    if (!result.status) { next(new Error('Failed to write chunk')); }
    res.json({ received: true, chunkIndex });
  }
);

router.post(
  '/assemble',
  express.json(),
  async (req, res, next) => {
    const { tempId, totalChunks, category, filename } = req.body as {
      tempId: string;
      totalChunks: number;
      category: string;
      filename: string;
    };

    if (!tempId || !totalChunks || !category || !filename) { return res.status(400).json({ error: 'Missing required fields: tempId, totalChunks, category, filename' }); }
    if (!lmsfs.getCategories().includes(category)) { return res.status(400).json({ error: 'Invalid category', allowed: lmsfs.getCategories() }); }
    const assembled = await lmsfs.tmpAssemble(tempId, totalChunks);
    if (!assembled.status) { await lmsfs.tmpClean(tempId); return res.status(500).json({ error: 'Failed to assemble chunks' });}
    const result = await lmsfs.new(category, {type: 'tmplink', accesslink: assembled.accesslink});
    await lmsfs.tmpClean(tempId);
    if (!result.status) { next(new Error('Failed to store assembled file')); }
 
    res.status(201).json({
      uuid: result.uuid,
      accesslink: result.accesslink,
      filename,
    });
  }
);

router.delete(
  '/chunk/:tempId', async (req, res) => {
    const { tempId } = req.params;
    const result = await lmsfs.tmpClean(tempId);
    res.json({ cleaned: result.status });
  }
);
export default {
  path: '/upload',
  router
};
