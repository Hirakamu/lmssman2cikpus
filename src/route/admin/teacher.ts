import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../lib/db.js';

const router = express.Router();

router.post("/add", async (req, res) => {
  try {
    const data = req.body;
    const teacherData = Array.isArray(data) ? data : [data];
    const isValid = teacherData.every((item) => item && typeof item === 'object' && 'name' in item && 'nip' in item && 'subjectid' in item);
    if (!isValid) { return res.status(400).json({ error: 'Invalid data format. Each record must have name, nip, and subjectid fields.' }); }

    const results: any[] = [];
    const errors: any[] = [];
    const passwordhash = await bcrypt.hash('etasaha', 10);

    await db.transaction(async (client) => {
      for (const teacher of teacherData) {
        try {
          const name = teacher.name?.toString();
          const nip = teacher.nip?.toString();
          const subjectid = Number(teacher.subjectid);

          if (!name || !nip || Number.isNaN(subjectid)) {
            errors.push({ nip: teacher.nip, error: 'Invalid teacher payload' });
            continue;
          }

          const email = `${name.toLowerCase().replace(/\s+/g, '').slice(0, 8)}${Math.floor(Math.random() * 900) + 100}@guru.sman2cikpus.sch.id`;

          await client.query(
            `INSERT INTO teacher (nip, name, email, passwordhash, subjectid)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (nip) DO UPDATE SET
               name = EXCLUDED.name,
               email = EXCLUDED.email,
               subjectid = EXCLUDED.subjectid
             RETURNING nip, name, email, subjectid;`,
            [nip, name, email, passwordhash, subjectid]
          );

          results.push({ nip, name, email, subjectid, status: 'success', password: 'etasaha' });
        } catch (itemError: any) {
          errors.push({ nip: teacher.nip, error: itemError.message });
        }
      }
    });

    res.json({
      success: errors.length === 0,
      message: `Processed ${teacherData.length} teacher record(s). Successful: ${results.length}, Failed: ${errors.length}`,
      data: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) { res.status(500).json({ error: error.message || 'Internal server error' }); }
});

export const adminTeacherRoute = router;
