import express from "express";
import bcrypt from "bcryptjs";
import { db } from "../../lib/db.js";
import { localhostOnly } from "../../lib/localhostOnly.js";

const router = express.Router();

router.post("/add", localhostOnly, async (req, res) => {
    try {
        const data = req.body;
        const studentData = Array.isArray(data) ? data : [data];
        const isValid = studentData.every((item) => item && typeof item === 'object' && 'name' in item && 'nisn' in item && 'classid' in item);
        if (!isValid) { return res.status(400).json({ error: 'Invalid data format. Each record must have name, nisn, and classid fields.' }); }

        const results: any[] = [];
        const errors: any[] = [];
        const passwordhash = await bcrypt.hash('aingmaung', 10);

        await db.transaction(async (client) => {
            for (const student of studentData) {
                try {
                    const name = student.name?.toString();
                    const nisn = student.nisn?.toString();
                    const classid = Number(student.classid);
                    const email = `${name.toLowerCase().replace(/\s+/g, '').slice(0, 8)}${Math.floor(Math.random() * 900) + 100}@siswa.sman2cikpus.sch.id`;

                    await client.query(
                        `INSERT INTO student (nisn, name, email, passwordhash, classid)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (nisn) DO UPDATE SET
                        name = EXCLUDED.name,
                        email = EXCLUDED.email,
                        passwordhash = EXCLUDED.passwordhash,
                        classid = EXCLUDED.classid
                        RETURNING nisn, name, email, classid;`,
                        [nisn, name, email, passwordhash, classid]
                    );

                    results.push({ nisn, name, email, classid, status: 'success', password: 'aingmaung' });
                } catch (itemError: any) { errors.push({ nisn: student.nisn, error: itemError.message }); }
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

router.post("/search", async (req, res) => {
    const { query } = req.body ?? {};
    if (typeof query !== "string" || !query.trim()) { return res.status(400).json({ success: false, message: "Missing or invalid body field: query" }); }
    try {
        const result = await db.query(`SELECT name, nisn, email, classId FROM student WHERE name ILIKE $1 OR nisn ILIKE $1 ORDER BY name ASC LIMIT 50`, [`%${query.trim()}%`]);
        return res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
    } catch (error) { return res.status(500).json({ success: false, message: "No students found." }); }
});

export default {
    path: 'user',
    router
};