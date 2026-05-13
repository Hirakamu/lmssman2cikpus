import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db.js';
import { jwtService } from '../lib/jwtService.js';
import { authMiddleware } from '../lib/authMiddleware.js';

const router = express.Router();

async function studentLogin(loginId: string, password: string, res: express.Response) {
    let studentResult = await db.query(
        `SELECT * FROM student WHERE nisn = $1 OR email = $1 OR nickname = $1`,
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

        return res.json({
            type: 'student',
            message: `Login berhasil untuk siswa ${student.name} dengan ID ${loginId}`,
            token
        });
    }
}

async function teacherLogin(loginId: string, password: string, res: express.Response) {
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
}

router.post('/login', async (req, res) => {
    const { identifier , password } = req.body ?? {};

    if (typeof identifier !== 'string' || !identifier.trim() || typeof password !== 'string' || !password) {
        return res.status(400).json({
            message: 'Missing or invalid body fields: identifier, password'
        });
    }

    const loginId = identifier.trim();

    // Try student first
    const studentLoginResult = await studentLogin(loginId, password, res);
    if (studentLoginResult) {
        return studentLoginResult;
    }

    // Try teacher
    const teacherLoginResult = await teacherLogin(loginId, password, res);
    if (teacherLoginResult) {
        return teacherLoginResult;
    }
 
});



export const authRoute = router;
