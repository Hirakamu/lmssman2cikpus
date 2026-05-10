import express, { query } from "express";
import {
  authMiddleware,
  type AuthenticatedRequest,
} from "../lib/authMiddleware.js";
import { db } from "../lib/db.js";
import { upload } from "../lib/upload.js";

const router = express.Router();
type AttendanceStatus = "attended" | "permit" | "sick" | "absent";
type AttendanceInput = { studentId: number; status: AttendanceStatus };
const ATTENDANCE_STATUSES = new Set<AttendanceStatus>([
  "attended",
  "permit",
  "sick",
  "absent",
]);
const parseAttendance = (
  rawStudentId: unknown,
  rawStatus: unknown,
  errorPrefix = "Invalid attendance payload",
): AttendanceInput => {
  const studentId = Number(rawStudentId);
  const status = String(rawStatus ?? "").toLowerCase().trim();

  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new Error(`${errorPrefix}: studentId must be a positive integer.`);
  }
  if (!ATTENDANCE_STATUSES.has(status as AttendanceStatus)) {
    throw new Error(
      `${errorPrefix}: status must be one of attended, permit, sick, absent.`,
    );
  }

  return { studentId, status: status as AttendanceStatus };
};
const insertTeacherAttendance = async (
  userId: string,
  rows: AttendanceInput[],
): Promise<{ subjectId: number; attendanceIds: number[] } | null> => {
  const studentIds = rows.map((row) => row.studentId);
  const statuses = rows.map((row) => row.status);

  const inserted = await db.query<{ id: number; subjectid: number }>(
    `WITH teacher_subject AS (
       SELECT subjectId
       FROM teacher
       WHERE nip = $1 OR email = $1
       LIMIT 1
     ),
     payload AS (
       SELECT *
       FROM unnest($2::int[], $3::text[]) AS p(studentId, status)
     ),
     inserted AS (
       INSERT INTO attendance (studentId, subjectId, date, status)
       SELECT payload.studentId, teacher_subject.subjectId, CURRENT_DATE, payload.status
       FROM payload
       CROSS JOIN teacher_subject
       RETURNING id, subjectId
     )
     SELECT id, subjectId AS subjectid
     FROM inserted`,
    [userId, studentIds, statuses],
  );

  if (!inserted.rows.length) {
    return null;
  }

  return {
    subjectId: Number(inserted.rows[0].subjectid),
    attendanceIds: inserted.rows.map((row) => Number(row.id)),
  };
};
const parseGradeCode = (rawGrade: unknown): string | null => {
  const gradeMap: Record<number, string> = { 1: "X", 2: "XI", 3: "XII" };
  return gradeMap[Number(rawGrade)] ?? null;
};

router.all("/", (req, res) => {res.status(200).json({success: true, route: ["POST /beranda", "GET /list", "POST /attend", "GET /attends", "POST /disciplinescore"],});});
router.post("/beranda", authMiddleware(["teacher"]), async (req, res) => {
  try {
    const authTeacherId = (req as AuthenticatedRequest).user?.userId;
    if (!authTeacherId) {return res.status(401).json({ success: false, message: "Unauthorized" });}
    const dashboardData = await db.transaction(async (client) => {
      const teacherResult = await client.query(`SELECT subjectId, name, nip AS "teacherId" FROM teacher WHERE nip = $1 OR email = $1 LIMIT 1`, [authTeacherId]);
      if (teacherResult.rows.length === 0) {return null;}
      const teacher = teacherResult.rows[0] as any;
      const [subjectResult, statsResult, taskResult] = await Promise.all([
        client.query(
          `SELECT DISTINCT source.name, source.grade FROM ( SELECT sn.name, sn.grade FROM teacherclass tc LEFT JOIN subjectname sn ON sn.subjectId = tc.subjectId WHERE tc.teacherId = $1 UNION ALL SELECT sn2.name, sn2.grade FROM subjectname sn2 WHERE sn2.subjectId = $2) source WHERE source.name IS NOT NULL AND source.grade IS NOT NULL`,
          [teacher.teacherId, teacher.subjectid ?? teacher.subjectId],
        ),
        client.query(
          `SELECT COUNT(DISTINCT tc.classId) AS "totalClass", COALESCE(COUNT(s.id), 0) AS "totalStudent" FROM teacherclass tc LEFT JOIN student s ON s.classId = tc.classId WHERE tc.teacherId = $1`,
          [teacher.teacherId],
        ),
        client.query(
          `SELECT task.title, task.description, task.ongoing, task.type, sn.name AS subject FROM (SELECT a.title, a.description, a.subjectId, CASE WHEN a.dueDate IS NULL THEN FALSE ELSE a.dueDate >= CURRENT_DATE
          END AS ongoing, 'assignment'::TEXT AS type, a.createdAt AS createdAt FROM assignment a WHERE a.createdBy = $1 UNION ALL SELECT e.title, NULL::TEXT AS description, e.subjectId, e.examDate >= CURRENT_DATE AS ongoing,
          'exam'::TEXT AS type, e.createdAt AS createdAt FROM exam e WHERE e.createdBy = $1) task LEFT JOIN subjectname sn ON sn.subjectId = task.subjectId ORDER BY task.createdAt DESC LIMIT 5`, [teacher.teacherId],
        ),
      ]);
      return {
        teacher,
        subjectRows: subjectResult.rows,
        stats: statsResult.rows[0] ?? { totalStudent: 0, totalClass: 0 },
        taskRows: taskResult.rows,
      };
    });
    if (!dashboardData) {
      res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
      return;
    }
    const { teacher, subjectRows, stats, taskRows } = dashboardData;
    const subjects = Array.isArray(subjectRows)
      ? Array.from(
        new Map(
          subjectRows.map((row: any) => {
            const subjectName = String(
              row.name ?? `Subject-${teacher.subjectid ?? teacher.subjectId}`,
            );
            const grade = parseGradeCode(row.grade);
            const dedupeKey = `${subjectName}-${grade ?? "unknown"}`;
            return [
              dedupeKey,
              {
                name: subjectName,
                grade,
              },
            ];
          }),
        ).values(),
      )
      : [];
    res.status(200).json({
      success: true,
      data: {
        name: teacher.name,
        teacherId: teacher.teacherId,
        subjects,
        teach: {
          totalStudent: Number(stats.totalStudent) || 0,
          totalClass: Number(stats.totalClass) || 0,
          quickTask: Array.isArray(taskRows)
            ? taskRows.map((task: any) => ({
              title: task.title,
              description: task.description,
              ongoing: Boolean(task.ongoing),
              subject: task.subject,
              type: task.type,
            }))
            : [],
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch teacher dashboard data",
    });
  }
});
router.post("/list", async (req, res) => {
  try {
    const { query } = req.body;
    if (typeof query !== "string" || query.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Required query parameter is missing or invalid.",
      });
    }

    const result = await db.query(
      `SELECT name, nip, subjectId, email
             FROM teacher
             WHERE name ILIKE $1
             ORDER BY name`,
      [`%${query}%`],
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "No teacher found.",
    });
  }
});
router.post("/attend", authMiddleware(["teacher"]), async (req, res) => {
  try {
    // Get the data
    const authTeacherId = (req as AuthenticatedRequest).user?.userId;
    const { studentid, status, force } = req.body;

    // Verification
    if (!authTeacherId) { return res.status(401).json({ success: false, message: "Unauthorized" }); }
    if (typeof studentid === "undefined" || typeof status === "undefined") { return res.status(400).send(`Missing required body parameters${typeof studentid === "undefined" ? ", studentid" : ""}${typeof status === "undefined" ? ", status" : ""}`); }
    if (!force && !(await db.query(`SELECT 1 FROM timetable WHERE day = EXTRACT(DOW FROM CURRENT_DATE)::int`)).rows.length) { return res.status(400).json({ success: false, reason: "You are not scheduled to teach today.", }); }

    // Attendance recording
    const attendance = parseAttendance(studentid, status, "Invalid attendance data");
    const inserted = await insertTeacherAttendance(authTeacherId, [attendance]);
    if (!inserted) { return res.status(404).json({ success: false, message: "Teacher not found." }); }

    // Response
    return res.status(200).json({
      success: true,
      message: `Attendance recorded successfully for student ${attendance.studentId} in subject ${inserted.subjectId}.`,
      data: {
        attendanceId: inserted.attendanceIds[0],
        subjectId: inserted.subjectId,
      },
    });

  } catch (error: any) {return res.status(400).json({ success: false, message: error?.message || "Failed to save bulk attendance." });}
});
router.post("/attends", authMiddleware(["teacher"]), async (req, res) => {
  try {
    // Get the data
    const userId = (req as AuthenticatedRequest).user?.userId;
    const payload = req.body?.data;
    if (!userId) { return res.status(401).json({ success: false, message: "Unauthorized" }); }

    // Validation
    if (!Array.isArray(payload) || payload.length === 0) { return res.status(400).json({ success: false, message: "Body must contain a non-empty `data` array.", }); }
    if (!(req.query?.force === "true") && !(await db.query(`SELECT 1 FROM timetable WHERE day = EXTRACT(DOW FROM CURRENT_DATE)::int`)).rows.length) { return res.status(400).json({ success: false, message: "You are not scheduled to teach today.", }); }

    // Attendance recording
    const parsed = payload.map((item: any, index: number) => parseAttendance(item?.siswa, item?.status, `Invalid item at index ${index}`));
    const inserted = await insertTeacherAttendance(userId, parsed);
    if (!inserted) { return res.status(404).json({ success: false, message: "Teacher not found." }); }

    // Response
    return res.status(200).json({
      success: true,
      message: "Bulk attendance saved.",
      data: {
        subjectId: inserted.subjectId,
        attendanceIds: inserted.attendanceIds,
        total: inserted.attendanceIds.length,
      },
    });

  } catch (error: any) { return res.status(400).json({ success: false, message: error?.message || "Failed to save bulk attendance." }); }
});
router.post("/disciplinescorelog", authMiddleware(["teacher"]), async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.userId;
    const { studentid } = req.body;
    if (!userId) { return res.status(401).json({ success: false, message: "Unauthorized" }); }
    if (typeof studentid === "undefined") { return res.status(400).json({ success: false, message: "Missing required body parameter: studentid", }); }

    return res.status(501).json({
      success: false,
      message: "Discipline score logging is not implemented yet.",
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to save discipline score.",
    });
  }
});

router.use(upload);

export const teacherRoute = router;