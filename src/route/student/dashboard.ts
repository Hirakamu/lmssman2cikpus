import { Router } from "express";
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
const router = Router();

router.post("/beranda", authMiddleware(["student"]), async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const result = await db.transaction(async (client) => {
      const [studentRes,subjectCountRes,attendanceRes,scheduleRes] = await Promise.all([
        client.query(`SELECT name, studentId, classId FROM student WHERE studentId = $1`, [user.userId]),
        client.query(`SELECT COUNT(DISTINCT subjectId) FROM schedule WHERE classId = $1`, [user.classId]),
        client.query(`SELECT status, COUNT(*) as total FROM attendance WHERE studentId = $1 GROUP BY status`, [user.userId]),
        client.query(`SELECT t.day, t.timeStart, t.timeEnd, t.sort, sc.subjectId, sc.secondarysubject, sn.name AS subjectName FROM schedule sc JOIN timetable t ON sc.schedule = t.numId LEFT JOIN subjectname sn ON sn.subjectId = sc.subjectId AND sn.secondarysubject = sc.secondarysubject WHERE sc.classId = $1 ORDER BY t.day, t.sort`, [user.classId])]);
      return { student: studentRes.rows[0], subjectCount: parseInt(subjectCountRes.rows[0].count), attendance: attendanceRes.rows, schedule: scheduleRes.rows };
    });

    if (!result.student){return res.status(404).json({success: false, message: "Student not found"});}

    const attendanceMap = {attended: 0, permit: 0, sick: 0, absent: 0};

    for (const row of result.attendance) {
      const key = String(row.status).toLowerCase() as keyof typeof attendanceMap;
      if (attendanceMap[key] !== undefined){attendanceMap[key] = parseInt(String(row.total));}
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

      if (!Number.isFinite(day)) {
        continue;
      }

      if (!weeklyMap.has(day)) {
        weeklyMap.set(day, []);
      }

      const [sh, sm, ss] = row.timestart.split(":").map(Number);
      const [eh, em, es] = row.timeend.split(":").map(Number);

      const start = new Date();
      const end = new Date();

      start.setHours(sh, sm, ss || 0, 0);
      end.setHours(eh, em, es || 0, 0);

      const name = String(row.subjectname ?? `Subject-${row.subjectid}`);

      weeklyMap.get(day)!.push({
        name,
        time: {
          start: start.getTime(),
          end: end.getTime()
        }
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
        subjectCount: result.subjectCount,
        attendanceTotal,

        schedule: {
          todayTotal: todaySubjects.length,
          today: {
            day: todayDay,
            subjects: todaySubjects
          }
        },

        attendance: attendanceMap,
        assignment: { name: "upcoming system"
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

    const scheduleRes = await db.query(
      `SELECT 
          t.day,
          t.timeStart,
          t.timeEnd,
          t.sort,
          sc.subjectId,
          sc.secondarysubject,
          sn.name AS subjectName
       FROM schedule sc
       JOIN timetable t 
         ON sc.schedule = t.numId
       LEFT JOIN subjectname sn
         ON sn.subjectId = sc.subjectId
        AND sn.secondarysubject = sc.secondarysubject
       WHERE sc.classId = $1
       ORDER BY t.day, t.sort`,
      [user.classId]
    );

    const subjects: Array<{ name: string; time: { start: number; end: number } }> = [];

    for (const row of scheduleRes.rows) {
      if (Number(row.day) !== selectedDay) {
        continue;
      }

      const [sh, sm, ss] = String(row.timestart ?? row.timeStart).split(":").map(Number);
      const [eh, em, es] = String(row.timeend ?? row.timeEnd).split(":").map(Number);

      const start = new Date();
      const end = new Date();

      start.setHours(sh, sm, ss || 0, 0);
      end.setHours(eh, em, es || 0, 0);

      subjects.push({
        name: String(row.subjectname ?? row.subjectName ?? `Subject-${row.subjectid}`),
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
      `SELECT name, studentId, email, classId FROM student WHERE studentId = $1`,
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
        studentId: String(student.studentid ?? student.studentId ?? user.userId),
        email: student.email,
        class: formatClassLabel(student.classid ?? student.classId)
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false });
  }
});
router.post("/list", async (req, res) => {
    const { query } = req.body ?? {};
    
    if (typeof query !== "string" || !query.trim()) {
        return res.status(400).json({
            success: false,
            message: "Missing or invalid body field: query"
        });
    }

    try {
        const result = await db.query(
            `SELECT name, studentId, email, classId FROM student WHERE name ILIKE $1 OR studentId ILIKE $1 ORDER BY name ASC LIMIT 50`,
            [`%${query.trim()}%`]
        );
        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "No students found."
        });
    }
});

export const studentDashboardRoute = router;