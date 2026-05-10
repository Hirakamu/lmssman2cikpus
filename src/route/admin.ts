import express from 'express';
import { adminDataRoute } from './admin/data.js';

//import bcrypt from 'bcryptjs';
//import { db } from '../lib/db.js';
//import { json } from 'zod';

const router = express.Router();
/*
router.get("/guru-add", (req, res) => { // teacher
  const { name, id, nip } = req.query;
  const hashedPassword = bcrypt.hashSync('etasaha', 10);
  const email = `${name?.toString().toLowerCase().replace(/\s+/g, '').slice(0, 8)}${Math.floor(Math.random() * 900) + 100}@guru.sman2cikpus.sch.id`;

  if (!name || !id || !nip) {
    return res.status(400).send(`Missing required query parameters: ${name ? '' : 'name '} ${id ? '' : 'id'} ${nip ? '' : 'nip'}`);
  }
  db.query(`INSERT INTO teacher (name, subjectid, passwordHash, email, nip) VALUES ($1, $2, $3, $4, $5)`, [name, id, hashedPassword, email, nip])
    .then(() => res.send(`guru ${name} dengan ID ${id} dan NIP ${nip}.`))
    .catch(err => {
      console.error('Error menambahkan guru:', err);
      switch (err.code) {
        case '23505':
          return res.status(409).send(`Guru dengan ID tersebut sudah ada`);
        default:
          return res.status(500).send(`Error menambahkan guru, ${err.message}`);
      }
    });
});

router.get("/siswa-add", async (req, res) => { // student
  const { name, id, classId } = req.query;
  const hashedPassword = await bcrypt.hash('etasaha', 10);
  const email = `${name?.toString().toLowerCase().replace(/\s+/g, '').slice(0, 8)}${Math.floor(Math.random() * 900) + 100}@siswa.sman2cikpus.sch.id`;

  if (!name || !id || !classId) {
    return res.status(400).send(`Missing required query parameters${name ? '' : ', name'}${id ? '' : ', id'}${classId ? '' : ', classIdii'}`);
  }

  try {
    await db.query(
      `INSERT INTO student (name, studentId, passwordHash, email, classId) VALUES ($1, $2, $3, $4, $5)`,
      [name, id, hashedPassword, email, classId]
    );

    return res.send(`siswa ${name} dengan ID ${id}.`);
  } catch (err: any) {
    switch (err.code) {
      case '23505':
        return res.status(409).send(`Siswa dengan ID tersebut sudah ada`);
      case '23503':
        return res.status(400).send(`Kelas dengan ID ${classId} tidak ditemukan`);
      default:
        return res.status(500).send(`Error menambahkan siswa, ${err.message}`);
    }
  }
});

router.get("/jadwal-mapel-update", async (req, res) => { // schedule
  const { id, subjectId, classId, secondarySubject } = req.query;

  if (!id || !subjectId || !classId || !secondarySubject) {
    return res.status(400).send(`Missing required query parameters${id ? '' : ', id'}${subjectId ? '' : ', subjectId'}${classId ? '' : ', classId'}${secondarySubject ? '' : ', secondarySubject'}`);
  }

  try {
    const existing = await db.query(
      `SELECT 1 FROM schedule WHERE classId = $1 AND schedule = $2 LIMIT 1`,
      [classId, id]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      await db.query(
        `UPDATE schedule SET subjectId = $1, secondarySubject = $4 WHERE classId = $2 AND schedule = $3`,
        [subjectId, classId, id, secondarySubject]
      );
      return res.send(`Jadwal ID ${id} kelas ${classId} berhasil diperbarui ke mapel ${subjectId}.`);
    }

    await db.query(
      `INSERT INTO schedule (subjectId, classId, schedule, secondarySubject) VALUES ($1, $2, $3, $4)`,
      [subjectId, classId, id, secondarySubject]
    );
    return res.send(`Jadwal ID ${id} kelas ${classId} dengan mapel ${subjectId} berhasil ditambahkan.`);
  } catch (err: any) {
    return res.status(500).send(`Error menyimpan jadwal, ${err.message}`);
  }
});

router.get("/jadwal-waktu-update", async (req, res) => { // timetable
  const { id, startTime, endTime, day, ref, sortId } = req.query;

  if (!id || !startTime || !endTime || !day || !ref || !sortId) {
    return res.status(400).send(`Missing required query parameters${id ? '' : ', id'}${startTime ? '' : ', startTime'}${endTime ? '' : ', endTime'}${day ? '' : ', day'}${ref ? '' : ', ref'}${sortId ? '' : ', sortId'}`);
  }

  const startTimesstamp = startTime.toString().replace('.', ':');
  const endTimesstamp = endTime.toString().replace('.', ':');

  try {
    const existing = await db.query(
      `SELECT 1 FROM timetable WHERE numId = $1 AND day = $2 AND sort = $3 LIMIT 1`,
      [id, day, sortId]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      await db.query(
        `UPDATE timetable SET timeStart = $1, timeEnd = $2, ref = $3 WHERE numId = $4 AND day = $5 AND sort = $6`,
        [startTimesstamp, endTimesstamp, ref, id, day, sortId]
      );
      return res.send(`Jadwal mapel ke ${sortId} berubah ke jam ${startTimesstamp} - ${endTimesstamp}. hari ${day}`);
    }

    await db.query(
      `INSERT INTO timetable (numId, timeStart, timeEnd, day, ref, sort) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, startTimesstamp, endTimesstamp, day, ref, sortId]
    );
    return res.send(`Jadwal mapel ke-${sortId} hari ${day} dengan waktu ${startTimesstamp} - ${endTimesstamp} berhasil ditambahkan.`);
  } catch (err: any) {
    return res.status(500).send(`Error menyimpan jadwal waktu, ${err.message}`);
  }
});

router.get("/jadwal-namemapel-update", async (req, res) => { // subjectname
  const { id, name, secondarySubject } = req.query;

  if (!id || !name || !secondarySubject) {
    return res.status(400).send(`Missing required query parameters${id ? '' : ', id'}${name ? '' : ', name'}${secondarySubject ? '' : ', secondarySubject'}`);
  }
  try {
    const existing = await db.query(
      `SELECT 1 FROM subjectname WHERE subjectid = $1 LIMIT 1`,
      [id]);
    if (existing.rowCount && existing.rowCount > 0) {
      await db.query(
        `UPDATE subjectname SET name = $1, secondarySubject = $3 WHERE subjectid = $2`,
        [name, id, secondarySubject]
      );
      return res.send(`Nama mapel dengan ID ${id} berhasil diperbarui menjadi ${name}.`);
    } else {
      await db.query(
        `INSERT INTO subjectname (subjectid, name, secondarySubject) VALUES ($1, $2, $3)`,
        [id, name, secondarySubject]
      );
      return res.send(`Nama mapel dengan ID ${id} dan nama ${name} berhasil ditambahkan.`);
    }
  } catch (err: any) {
    return res.status(500).send(`Error menyimpan nama mapel, ${err.message}`);
  }
});

router.get("/kelas-update", async (req, res) => { // classes 
  const { id, teacherhomeId } = req.query;
  if (!id || !teacherhomeId) {
    return res.status(400).send(`Missing required query parameters${id ? '' : ', id'}${teacherhomeId ? '' : ', teacherhomeId'}`);
  }
  try {
    const existing = await db.query(
      `SELECT 1 FROM classes WHERE classId = $1 LIMIT 1`,
      [id]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      await db.query(
        `UPDATE classes SET teacherhomeId = $1 WHERE classId = $2`,
        [teacherhomeId, id]
      );
      return res.send(`Kelas ${id} berhasil diperbarui dengan wali kelas ID ${teacherhomeId}.`);
    }
    await db.query(
      `INSERT INTO classes (classId, teacherhomeId) VALUES ($1, $2)`,
      [id, teacherhomeId]
    );
    return res.send(`Kelas ${id} dengan wali kelas ID ${teacherhomeId} berhasil ditambahkan.`);
  } catch (err: any) {
    return res.status(500).send(`Error menyimpan kelas, ${err.message}`);
  }
});
*/

router.use("/data", adminDataRoute);

export const adminRoute = router;
