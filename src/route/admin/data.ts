import express from 'express';
import { adminStudentRoute } from './student.js';
import { adminTeacherRoute } from './teacher.js';

const router = express.Router();

router.use("/student", adminStudentRoute);
router.use("/teacher", adminTeacherRoute);

export const adminDataRoute = router;