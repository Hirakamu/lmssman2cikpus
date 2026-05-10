import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../lib/db.js';

const router = express.Router();

router.post("/add", async (req, res) => {
  try {
    const data = req.body;
    const studentData = Array.isArray(data) ? data : [data];

    const isValid = studentData.every((item) => item && typeof item === 'object' && 'name' in item && 'nisn' in item && 'classid' in item);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid data format. Each record must have name, nisn, and classid fields.' });
    }

    const results: any[] = [];
    const errors: any[] = [];
    const passwordhash = await bcrypt.hash('etasaha', 10);

    await db.transaction(async (client) => {
      for (const student of studentData) {
        try {
          const name = student.name?.toString();
          const nisn = student.nisn?.toString();
          const classid = Number(student.classid);

          if (!name || !nisn || Number.isNaN(classid)) {
            errors.push({ nisn: student.nisn, error: 'Invalid student payload' });
            continue;
          }

          const email = `${name.toLowerCase().replace(/\s+/g, '').slice(0, 8)}${Math.floor(Math.random() * 900) + 100}@siswa.sman2cikpus.sch.id`;

          await client.query(
            `INSERT INTO student (nisn, name, email, passwordhash, classid)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (nisn) DO UPDATE SET
               name = EXCLUDED.name,
               email = EXCLUDED.email,
               classid = EXCLUDED.classid
             RETURNING nisn, name, email, classid;`,
            [nisn, name, email, passwordhash, classid]
          );

          results.push({ nisn, name, email, classid, status: 'success', password: 'etasaha' });
        } catch (itemError: any) {
          errors.push({ nisn: student.nisn, error: itemError.message });
        }
      }
    });

    res.json({
      success: errors.length === 0,
      message: `Processed ${studentData.length} student record(s). Successful: ${results.length}, Failed: ${errors.length}`,
      data: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) { res.status(500).json({ error: error.message || 'Internal server error' }); }
});

export const adminStudentRoute = router;