import express from "express";
import { authMiddleware, type AuthenticatedRequest } from "../../lib/authMiddleware.js";
import { db } from "../../lib/db.js";

const formatClassLabel = (rawClassId: unknown): string => {
  const classId = Number(rawClassId);
  if (!Number.isFinite(classId) || classId < 10) {return `Class-${rawClassId}`;}
  const gradeCode = Math.trunc(classId / 10);
  const gradeMap: Record<number, string> = {1: "X",2: "XI",3: "XII"};
  const grade = gradeMap[gradeCode] ?? `Grade-${gradeCode}`;
  return `${grade}-${gradeCode === 1 ? "E" : "F"}${classId % 10}`;
};
const getMondayBasedDay = (date: Date): number => {
    return ((date.getDay() + 6) % 7) + 1;
};

const router = express.Router();

router.post("/beranda", authMiddleware(["student"]), async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const result = await db.transaction(async (client) => {
      const studentRes = await client.query(`SELECT name, nisn, classId FROM student WHERE nisn = $1`, [user.userId]);
      const student = studentRes.rows[0];

      // Schedule from timetable (may not include class filter)
      let scheduleRows: any[] = [];
      try {
        const scheduleRes = await client.query(`SELECT day, timestart, timeend, sort FROM timetable ORDER BY day, sort`);
        scheduleRows = scheduleRes.rows;
      } catch (e) {
        scheduleRows = [];
      }

      // Attendance counts grouped by type (fall back to empty)
      let attendanceRows: any[] = [];
      try {
        const attendanceRes = await client.query(`SELECT type, COUNT(*) AS total FROM attendance WHERE nisn = $1 GROUP BY type`, [user.userId]);
        attendanceRows = attendanceRes.rows;
      } catch (e) {
        attendanceRows = [];
      }

      // Upcoming assignments for student's class (graceful fallback if tables missing)
      let upcomingAssignments: any[] = [];
      let submittedIds = new Set<number>();
      try {
        if (student && student.classid != null) {
          const assignRes = await client.query(
            `SELECT id, title, date, expiry, classid, subjectid FROM assignmentteacher WHERE classid = $1 AND expiry >= NOW() ORDER BY date LIMIT 10`,
            [student.classid]
          );
          upcomingAssignments = assignRes.rows;

          // fetch submissions by this student for those assignments
          if (upcomingAssignments.length > 0) {
            const ids = upcomingAssignments.map((r: any) => r.id);
            const submitRes = await client.query(`SELECT assignmentid FROM assignmentsubmit WHERE nisn = $1 AND assignmentid = ANY($2::int[])`, [user.userId, ids]);
            for (const s of submitRes.rows) submittedIds.add(Number(s.assignmentid));
          }
        }
      } catch (e) {
        upcomingAssignments = [];
        submittedIds = new Set();
      }

      return { student, schedule: scheduleRows, attendance: attendanceRows, assignments: upcomingAssignments, submittedIds };
    });

    if (!result.student){return res.status(404).json({success: false, message: "Student not found"});}

    const attendanceMap = {attended: 0, permit: 0, sick: 0, absent: 0};

    for (const row of result.attendance) {
      const key = String(row.type ?? row.status).toLowerCase() as keyof typeof attendanceMap;
      if (attendanceMap[key] !== undefined) { attendanceMap[key] = parseInt(String(row.total)); }
    }

    const attendanceTotal =
      attendanceMap.attended +
      attendanceMap.permit +
      attendanceMap.sick +
      attendanceMap.absent;

    const weeklyMap = new Map<number, any[]>();

    const today = new Date();
    const todayDay = getMondayBasedDay(today);

    for (const row of result.schedule) {
      const day = Number(row.day);
      if (!Number.isFinite(day)) continue;
      if (!weeklyMap.has(day)) weeklyMap.set(day, []);

      const ts = String(row.timestart ?? row.timestart ?? row.timeStart ?? row.timeStart ?? "");
      const te = String(row.timeend ?? row.timeend ?? row.timeEnd ?? row.timeEnd ?? "");
      const [sh, sm, ss] = ts.split(":").map(Number);
      const [eh, em, es] = te.split(":").map(Number);

      const start = new Date();
      const end = new Date();
      start.setHours(sh || 0, sm || 0, ss || 0, 0);
      end.setHours(eh || 0, em || 0, es || 0, 0);

      weeklyMap.get(day)!.push({
        name: `Period ${row.sort ?? "?"}`,
        time: { start: start.getTime(), end: end.getTime() }
      });
    }

    const weekly = Array.from(weeklyMap.entries()).map(([day, subjects]) => ({
      day,
      subjects
    }));

    const todaySubjects = weeklyMap.get(todayDay) || [];

    res.status(200).json({
      success: true,
      data: {
        name: result.student.name,
        studentId: String(result.student.studentid ?? result.student.studentId ?? user.userId),
        class: formatClassLabel(result.student.classid ?? result.student.classId),
        subjectCount: Array.isArray(result.assignments) ? result.assignments.length : 0,
        attendanceTotal,

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
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});
router.post("/kelas", authMiddleware(["student"]), async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const rawDay = req.body?.day;

    let selectedDay = getMondayBasedDay(new Date());
    if (rawDay !== undefined) {
      const parsedDay = Number(rawDay);
      if (!Number.isFinite(parsedDay) || parsedDay < 1 || parsedDay > 7) {
        return res.status(400).json({
          success: false,
          message: "Invalid query parameter: day must be between 1 and 7"
        });
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
    return res.status(500).json({ success: false });
  }
});
router.post("/profile", authMiddleware(["student"]), async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const result = await db.query(
      `SELECT name, nisn, email, classId FROM student WHERE nisn = $1`,
      [user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
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
});

export default {
  path: 'dashboard',
  router
};