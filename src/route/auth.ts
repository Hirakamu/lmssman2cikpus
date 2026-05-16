import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db.js';
import { jwtService } from '../lib/jwtService.js';
import { ApiResponse, asyncHandler, ApiError } from '../lib/routeHandler.js';
import { nextTick } from 'process';

const router = express.Router();

router.post('/login', asyncHandler(async (req, res, next) => {
    const { identifier, password } = req.body ?? {};

    if (typeof identifier !== 'string' || !identifier.trim() || typeof password !== 'string' || !password) {
        next(new ApiError(400, 'Missing or invalid body fields: identifier, password'));
    }

    const loginId = identifier.trim();

    // Try student first
    let studentResult = await db.query(
        `SELECT * FROM student WHERE nisn = $1 OR email = $1`,
        [loginId]
    );

    if (studentResult.rows.length > 0) {
        const student = studentResult.rows[0];
        const passwordhash = student.passwordhash;

        if (typeof passwordhash !== 'string' || !passwordhash) {
            return res.status(500).send('Data password siswa tidak valid');
        }

        const hashMatch = await bcrypt.compare(password, passwordhash);
        if (!hashMatch) {
            return res.status(401).send('Password salah');
        }

        const token = jwtService.sign({
            userId: student.nisn,
            role: 'student',
            name: student.name,
            email: student.email,
            classId: student.classid
        });

        next(new ApiResponse(200, `Login berhasil untuk siswa ${student.name} dengan ID ${loginId}`, { token }));
    }

    // Try teacher
    let teacherResult = await db.query(
        `SELECT * FROM teacher WHERE nip = $1 OR email = $1 OR nickname = $1`,
        [loginId]
    );

    if (teacherResult.rows.length > 0) {
        const teacher = teacherResult.rows[0];
        const passwordhash = teacher.passwordhash;

        if (typeof passwordhash !== 'string' || !passwordhash) {
            return res.status(500).send('Data password guru tidak valid');
        }

        const hashMatch = await bcrypt.compare(password, passwordhash);
        if (!hashMatch) {
            return res.status(401).send('Password salah');
        }
        
        const user = {
            userId: teacher.nip,
            role: 'teacher',
            name: teacher.name,
            email: teacher.email
        };

        const token = jwtService.sign({ user });

        next(new ApiResponse(200, `Login berhasil untuk guru ${teacher.name} dengan ID ${loginId}`, { token }));
    }

    next(new ApiError(404, `User dengan ID ${loginId} tidak ditemukan`));
}));



export default {
    path: '/auth',
    router
};
