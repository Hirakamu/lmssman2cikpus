import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../lib/db.js';
import { localhostOnly } from '../../lib/localhostOnly.js';

const router = express.Router();

router.post("/add", localhostOnly, async (req, res, next) => {
    try {
        const data = req.body;
        const teacherData = Array.isArray(data) ? data : [data];
        const isValid = teacherData.every((item) => item && typeof item === 'object' && 'name' in item && 'nip' in item && 'subjectid' in item);
        if (!isValid) { return res.status(400).json({ error: 'Invalid data format. Each record must have name, nip, and subjectid fields.' }); }

        const results: any[] = [];
        const errors: any[] = [];
        const passwordhash = await bcrypt.hash('aingmaung', 10);

        await db.transaction(async (client) => {
            for (const teacher of teacherData) {
                try {
                    const name = teacher.name?.toString();
                    const nip = teacher.nip?.toString();
                    const subjectid = Number(teacher.subjectid);
                    const email = `${name.toLowerCase().replace(/\s+/g, '').slice(0, 8)}${Math.floor(Math.random() * 900) + 100}@guru.sman2cikpus.sch.id`;

                    await client.query(
                        `INSERT INTO teacher (nip, name, email, passwordhash, subjectid)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (nip) DO UPDATE SET
                        name = EXCLUDED.name,
                        email = EXCLUDED.email,
                        passwordhash = EXCLUDED.passwordhash,
                        subjectid = EXCLUDED.subjectid
                        RETURNING nip, name, email, subjectid;`,
                        [nip, name, email, passwordhash, subjectid]
                    );

                    results.push({ nip, name, email, subjectid, status: 'success', password: 'aingmaung' });
                } catch (itemError: any) { errors.push({ nip: teacher.nip, error: itemError.message }); }
            }
        });

        res.json({
            success: errors.length === 0,
            message: `Processed ${teacherData.length} teacher record(s). Successful: ${results.length}, Failed: ${errors.length}`,
            data: results,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error: any) { next(error); }
});

router.post("/search", async (req, res, next) => {
    const { query }  = req.body ?? {};
    if (typeof query !== "string" || !query.trim()) { return res.status(400).json({ success: false, message: "Missing or invalid body field: query" }); }
    try {
        const result = await db.query(`SELECT name, nip, email, subjectId FROM teacher WHERE name ILIKE $1 OR nip ILIKE $1 ORDER BY name ASC LIMIT 50`, [`%${query.trim()}%`]);
        return res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
    } catch (error) { next(error); }
});

export default {
    path: 'user',
    router
};                                              