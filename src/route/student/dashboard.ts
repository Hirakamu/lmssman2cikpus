import express from "express";
import { authMiddleware, type AuthenticatedRequest } from "../../lib/authMiddleware.js";
import { db } from "../../lib/db.js";
import { ApiResponse, asyncHandler, ApiError } from "../../lib/routeHandler.js";

const formatClassLabel = (rawClassId: unknown): string => {
  const classId = Number(rawClassId);
  if (!Number.isFinite(classId) || classId < 10) { return `Class-${rawClassId}`; }
  const gradeCode = Math.trunc(classId / 10);
  const gradeMap: Record<number, string> = { 1: "X", 2: "XI", 3: "XII" };
  const grade = gradeMap[gradeCode] ?? `Grade-${gradeCode}`;
  return `${grade}-${gradeCode === 1 ? "E" : "F"}${classId % 10}`;
};
const getMondayBasedDay = (date: Date): number => {
  return ((date.getDay() + 6) % 7) + 1;
};

const router = express.Router();

router.post("/beranda", authMiddleware(["student"]), asyncHandler(async (req, res, next) => {
  const user = (req as AuthenticatedRequest).user;
  const result = await db.transaction(async (client) => {
    const student = await client.query(
      `SELECT name, nisn, classid FROM student WHERE nisn = $1`,
      [user.userId]
    );
    const scheduleToday = await client.query(
      `SELECT day, timeStart, timeEnd, sort FROM timetable WHERE day = $1 ORDER BY sort`,
      [student.rows[0].classid]
    );
    const attendance = await client.query(
      `SELECT date, status FROM attendance WHERE studentid = $1 ORDER BY date DESC LIMIT 100`,
      [user.userId]
    );

    return { student: student.rows[0], schedule: scheduleToday.rows, attendance: { map: attendanceMap, total: attendanceTotal } };
  });

  next(new ApiResponse(200, 'Dashboard data retrieved', {
    success: true,
    data: {
      name: result.student.name,
      studentId: String(result.student.studentid ?? result.student.studentId ?? user.userId),
      class: formatClassLabel(result.student.classid ?? result.student.classId),
      subjectCount: Array.isArray(result.schedule) ? result.schedule.length : 0,
      attendanceTotal: result.attendance.total,

      schedule: {
        todayTotal: todaySubjects.length,
        today: {
          day: todayDay,
          subjects: todaySubjects
        }
      },

      attendance: attendanceMap,
      assignment: {
        upcoming: (result.assignments ?? []).map((a: any) => ({
          id: a.id,
          title: a.title,
          date: a.date ?? null,
          expiry: a.expiry ?? null,
          submitted: (result.submittedIds && result.submittedIds.has && result.submittedIds.has(Number(a.id))) || false
        }))
      },
      exams: {
        upcoming: [
          {
            title: "upcoming system",
            date: null
          }
        ],
        completed: [
          {
            title: "upcoming system",
            date: null,
            score: null
          }
        ]
      }
    }
  }));
}));

router.post("/kelas", authMiddleware(["student"]), asyncHandler(async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const rawDay = req.body?.day;

    let selectedDay = getMondayBasedDay(new Date());
    if (rawDay !== undefined) {
      const parsedDay = Number(rawDay);
      if (!Number.isFinite(parsedDay) || parsedDay < 1 || parsedDay > 7) {
        return next(new ApiError(400, "Invalid query parameter: day must be between 1 and 7"));
      }
      selectedDay = parsedDay;
    }

    // Query timetable directly (schedule table doesn't exist in new schema)
    let scheduleRes = { rows: [] };
    try {
      scheduleRes = await db.query(
        `SELECT 
            day,
            timeStart,
            timeEnd,
            sort
         FROM timetable
         WHERE day = $1
         ORDER BY sort`,
        [selectedDay]
      );
    } catch (e) {
      // timetable query failed, return empty schedule
    }

    const subjects: Array<{ name: string; time: { start: number; end: number } }> = [];

    for (const row of scheduleRes.rows) {
      const [sh, sm, ss] = String(row.timestart ?? row.timeStart).split(":").map(Number);
      const [eh, em, es] = String(row.timeend ?? row.timeEnd).split(":").map(Number);

      const start = new Date();
      const end = new Date();

      start.setHours(sh, sm, ss || 0, 0);
      end.setHours(eh, em, es || 0, 0);

      subjects.push({
        name: `Period ${row.sort}`,
        time: {
          start: start.getTime(),
          end: end.getTime()
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        schedule: {
          day: selectedDay,
          subjects
        }
      }
    });
  } catch (err) {
    console.error(err);
    return next(new ApiError(500, "Internal server error"));
  }
}));

router.post("/profile", authMiddleware(["student"]), asyncHandler(async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const result = await db.query(
      `SELECT name, nisn, email, classId FROM student WHERE nisn = $1`,
      [user.userId]
    );
    if (result.rows.length === 0) {
      return next(new ApiError(404, "Student not found"));
    }
    const student = result.rows[0];
    return res.status(200).json({
      success: true,
      data: {
        name: student.name,
        nisn: String(student.nisn),
        email: student.email,
        class: formatClassLabel(student.classid ?? student.classId)
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false });
  }
}));

export default {
  path: 'dashboard',
  router
};