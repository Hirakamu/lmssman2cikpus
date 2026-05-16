import express from "express";
import bcrypt from "bcryptjs";
import { db } from "../../lib/db.js";
import { localhostOnly } from "../../lib/localhostOnly.js";
import { asyncHandler, ApiResponse, ApiError } from "../../lib/routeHandler.js";

const router = express.Router();

router.post("/add", localhostOnly, asyncHandler(async (req, res, next) => {
    const data = req.body;
    const studentData = Array.isArray(data) ? data : [data];
    const isValid = studentData.every((item) => item && typeof item === 'object' && 'name' in item && 'nisn' in item && 'classid' in item);
    if (!isValid) { return next(new Error('Invalid data format. Each record must have name, nisn, and classid fields.')); }

    const results: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];
    const passwordhash = await bcrypt.hash('aingmaung', 10);

    await db.transaction(async (client) => {
        for (const student of studentData) {

            const name = student.name?.toString();
            const nisn = student.nisn?.toString();
            const classid = Number(student.classid);
            const email = `${name.toLowerCase().replace(/\s+/g, '').slice(0, 8)}${Math.floor(Math.random() * 900) + 100}@siswa.sman2cikpus.sch.id`;

            const insertResult = await client.query(
                `INSERT INTO student (nisn, name, email, passwordhash, classid)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (nisn) DO NOTHING
                        RETURNING nisn, name, email, classid;`,
                [nisn, name, email, passwordhash, classid]
            );

            if (insertResult.rowCount === 0) {
                skipped.push({ nisn, name, classid, status: 'skipped', reason: 'Student already exists' });
                continue;
            }
            results.push({ nisn, name, email, classid, status: 'success', password: 'aingmaung' });
        }
    });

    return new ApiResponse(200, 'Students added successfully', {
        success: errors.length === 0,
        message: `Processed ${studentData.length} student record(s). Added: ${results.length}, Skipped: ${skipped.length}, Failed: ${errors.length}`,
        data: results,
        skipped: skipped.length > 0 ? skipped : undefined,
        errors: errors.length > 0 ? errors : undefined
    });
}));

router.post("/update", localhostOnly, asyncHandler(async (req, res, next) => {
    const data = req.body;
    const studentData = data;
    const name = studentData.name?.toString();
    const nisn = studentData.nisn?.toString();
    const classid = Number(studentData.classid);
    const email = `${name.toLowerCase().replace(/\s+/g, '').slice(0, 8)}${Math.floor(Math.random() * 900) + 100}@siswa.sman2cikpus.sch.id`;

    const update = await db.query(
        `UPDATE student
        SET name = $2,
        email = $3,
        classid = $4
        WHERE nisn = $1
        RETURNING nisn, name, email, classid;`,
        [nisn, name, email, classid]
    );
    if (update.rowCount === 0) { return next(new ApiError(404, `Student with NISN ${nisn} not found`)); }
    next(new ApiResponse(200, 'Student updated successfully', update.rows));
}));

router.post("/search", asyncHandler(async (req, res, next) => {
    const { query } = req.body ?? {};
    if (typeof query !== "string" || !query.trim()) { return next(new ApiError(400, "Missing or invalid body field: query")); }
    const result = await db.query(`SELECT name, nisn, email, classId FROM student WHERE name ILIKE $1 OR nisn ILIKE $1 ORDER BY name ASC LIMIT 50`, [`%${query.trim()}%`]);
    next(new ApiResponse(200, 'Students found', { success: true, count: result.rows.length, data: result.rows }));
}));

export default {
    path: 'user',
    router
};