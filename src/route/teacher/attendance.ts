import express from 'express';
import { authMiddleware, type AuthenticatedRequest } from '../../lib/authMiddleware.js';
import { db } from '../../lib/db.js';

const router = express.Router();

router.post("/attend", authMiddleware(["teacher"]), async (req, res) => {
    try {
        const data = req.body;
        const attendanceData = Array.isArray(data) ? data : [data];
        const isValid = attendanceData.every((item) => item && typeof item === 'object' && 'nisn' in item && 'attendance' in item);
        if (!isValid) { return res.status(400).json({ error: 'Invalid data format. Each record must have nisn and attendance fields.' }); }

        const results: any[] = [];
        const errors: any[] = [];

        await db.transaction(async (client) => {
            for (const attendance of attendanceData) {
                try {
                    const nisn = attendance.nisn?.toString();
                    const status = attendance.attendance?.toString();

                    await client.query(
                        `INSERT INTO attendance (nisn, status)
                         VALUES ($1, $2)
                         RETURNING nisn, status;`,
                        [nisn, status]
                    );

                    results.push({ nisn, attendance: status, status: 'success' });
                } catch (itemError: any) {
                    errors.push({ nisn: attendance.nisn, error: itemError.message });
                }
            }
        });

        res.json({
            success: errors.length === 0,
            message: `Processed ${attendanceData.length} attendance record(s). Successful: ${results.length}, Failed: ${errors.length}`,
            data: results,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error: any) { res.status(500).json({ error: error.message || 'Internal server error' }); }
});

export default {
  path: 'attendance',
  router
};