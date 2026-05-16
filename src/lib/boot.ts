import { db } from "./db.js";
import { CDB } from "./cdb.js";
import { logger } from "./logger.js";
import {
    classTable,
    teacher,
    student,
    timetable,
    subjectname,
    subject,
    assignmentteacher,
    assignmentsubmit,
    attendance
} from "./schema.js";
import { defineTable, notNull, primaryKey, text } from "./schemaBuilder.js";

export const cdb = new CDB(db);

export const app_meta = defineTable("app_meta", {
    key: primaryKey(text()),
    value: notNull(text())
});

const createAllTables = async () => {
    // Order matters: referenced tables must be created before their dependents.
    //
    // Dependency chain:
    //   classTable           (no deps)
    //   teacher              (no deps)
    //   timetable            (no deps)
    //   subjectname          (no deps)
    //   student       → classTable
    //   subject       → classTable, timetable, subjectname
    //   assignmentteacher → teacher, classTable
    //   assignmentsubmit  → student, assignmentteacher
    //   attendance        → student

    const orderedTables = [
        classTable,
        teacher,
        timetable,
        subjectname,
        student,
        subject,
        assignmentteacher,
        assignmentsubmit,
        attendance,
    ];

    for (const table of orderedTables) {
        await cdb.createTable(table);
        logger.info(`Table "${table.name}" ready`);
    }
};

const firstRunCheck = async () => {
    const firstRunCompleted = await cdb.select(app_meta).where({ key: "first_run_completed", value: "true" }).execute();
    if (firstRunCompleted.length > 0) {
        return;
    }

    logger.info("Starting first run setup...");
    await createAllTables();

    await cdb.insert(app_meta, { key: "first_run_completed", value: "true" }, { force: "ignore", conflictTarget: "key" });

    logger.info("First run complete.");
};

export const boot = async () => {
    const healthy = await db.healthCheck();
    if (!healthy) throw new Error("Database unreachable on boot");
    await cdb.createTable(app_meta);
    await firstRunCheck();
};