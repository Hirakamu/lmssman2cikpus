import express from 'express';
import multer from 'multer';
import { authMiddleware, type AuthenticatedRequest } from './authMiddleware.js';
import { db } from './db.js';
import { lms } from './lms.js';


const router = express.Router();
const uploadHandler = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
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

router.post('/upload', uploadHandler.single('file'), async (req, res) => {
    const category = req.body.category as string;
    if (!req.file) {return res.status(400).json({ error: 'No file uploaded' }); }
    if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) { return res.status(400).json({ error: `File type not allowed: ${req.file.mimetype}` }); }
    if (!category || !lms.getCategories().includes(category)) { return res.status(400).json({ error: 'Invalid category', allowed: lms.getCategories() });}
    const result = await lms.new(category, req.file.buffer);
    if (!result.status) {return res.status(500).json({ error: 'Failed to store file' }); }
    res.status(201).json({
        uuid: result.uuid,
        accesslink: result.accesslink,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
    });
});

router.post('/upload/chunk', uploadHandler.single('chunk'), async (req, res) => {
    if (!req.file) { return res.status(400).json({ error: 'No chunk data' }); }
    const tempId = req.body.tempId as string;
    const chunkIndex = parseInt(req.body.chunkIndex, 10);
    const totalChunks = parseInt(req.body.totalChunks, 10);
    if (!tempId || isNaN(chunkIndex) || isNaN(totalChunks) || chunkIndex < 0 || chunkIndex >= totalChunks) { return res.status(400).json({ error: 'Invalid chunk metadata' });}
    const result = await lms.tmpWrite(tempId, chunkIndex, req.file.buffer);
    if (!result.status) { return res.status(500).json({ error: 'Failed to store chunk' });}
    res.json({ received: true, chunkIndex });
  }
);

router.post(
  '/upload/assemble',
  express.json(),
  async (req, res) => {
    const { tempId, totalChunks, category, filename } = req.body as {
      tempId: string;
      totalChunks: number;
      category: string;
      filename: string;
    };
 
    if (!tempId || !totalChunks || !category || !filename) { return res.status(400).json({ error: 'Missing required fields: tempId, totalChunks, category, filename' }); }
    if (!lms.getCategories().includes(category)) { return res.status(400).json({ error: 'Invalid category', allowed: lms.getCategories() }); }
    const assembled = await lms.tmpAssemble(tempId, totalChunks);
    if (!assembled.status) { await lms.tmpClean(tempId); return res.status(500).json({ error: 'Failed to assemble chunks' });}
    const result = await lms.new(category, {type: 'tmplink', accesslink: assembled.accesslink});
    await lms.tmpClean(tempId);
    if (!result.status) { return res.status(500).json({ error: 'Failed to store assembled file' });}
 
    res.status(201).json({
      uuid: result.uuid,
      accesslink: result.accesslink,
      filename,
    });
  }
);

router.delete(
  '/upload/chunk/:tempId', async (req, res) => {
    const { tempId } = req.params;
    const result = await lms.tmpClean(tempId);
    res.json({ cleaned: result.status });
  }
);
export const upload = router;

