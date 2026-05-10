import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db.js';
import { jwtService } from '../lib/jwtService.js';
import { authMiddleware } from '../lib/authMiddleware.js';

const router = express.Router();

router.post('/login', async (req, res) => {
    const { identifier , password } = req.body ?? {};

    if (typeof identifier !== 'string' || !identifier.trim() || typeof password !== 'string' || !password) {
        return res.status(400).json({
            message: 'Missing or invalid body fields: identifier, password'
        });
    }

    const loginId = identifier.trim();

    // Try student first
    let studentResult = await db.query(
        `SELECT * FROM student WHERE studentId = $1 OR email = $1`,
        [loginId]
    );

    if (studentResult.rows.length > 0) {
        const student = studentResult.rows[0];
        const passwordHash = student.passwordHash;

        if (typeof passwordHash !== 'string' || !passwordHash) {
            return res.status(500).send('Data password siswa tidak valid');
        }

        const hashMatch = await bcrypt.compare(password, passwordHash);
        if (!hashMatch) {
            return res.status(401).send('Password salah');
        }

        const token = jwtService.sign({
            userId: student.studentid ?? student.studentId,
            role: 'student',
            name: student.name,
            email: student.email,
            classId: student.classid ?? student.classId
        });

        return res.json({
            type: 'student',
            message: `Login berhasil untuk siswa ${student.name} dengan ID ${loginId}`,
            token
        });
    }

    // Try teacher
    let teacherResult = await db.query(
        `SELECT * FROM teacher WHERE nip = $1 OR email = $1`,
        [loginId]
    );

    if (teacherResult.rows.length > 0) {
        const teacher = teacherResult.rows[0];
        const passwordHash = teacher.passwordHash;

        if (typeof passwordHash !== 'string' || !passwordHash) {
            return res.status(500).send('Data password guru tidak valid');
        }

        const hashMatch = await bcrypt.compare(password, passwordHash);
        if (!hashMatch) {
            return res.status(401).send('Password salah');
        }

        const token = jwtService.sign({
            userId: teacher.nip ?? teacher.nip,
            role: 'teacher',
            name: teacher.name,
            email: teacher.email
        });

        return res.json({
            type: 'teacher',
            message: `Login berhasil untuk guru ${teacher.name} dengan ID ${loginId}`,
            token
        });
    }

    return res.status(404).json({
        message: `User dengan ID ${loginId} tidak ditemukan`
    });
});

export const authRoute = router;
