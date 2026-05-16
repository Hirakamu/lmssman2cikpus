import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";
import { cdb } from "./boot.js";
import { logger } from "./logger.js";
import {
    teacher,
    student,
    classTable,
    subjectname,
    timetable,
    subject,
} from "./schema.js";
import type { Table } from "./schemaBuilder.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Resolves to <project-root>/data/seed/ regardless of where the process runs
const SEED_DIR = join(process.cwd(), "data", "seed");

// ---------------------------------------------------------------------------
// Generic CSV → table seeder
// ---------------------------------------------------------------------------

/**
 * Reads a CSV file and inserts each row into the given table.
 * Skips the file silently if it doesn't exist.
 * Uses force:"ignore" so re-running seeds never causes duplicate key errors.
 */
async function seedTable(table: Table<any>, filename: string): Promise<void> {
    const filepath = join(SEED_DIR, filename);

    if (!existsSync(filepath)) {
        logger.warn(`Seed file not found, skipping: ${filepath}`);
        return;
    }

    const raw = await readFile(filepath, "utf-8");

    // csv-parse/sync returns an array of objects when columns:true
    const rows: Record<string, string>[] = parse(raw, {
        columns: true,          // first row = column headers
        skip_empty_lines: true,
        trim: true,             // strip whitespace from values
    });

    if (rows.length === 0) {
        logger.warn(`Seed file is empty: ${filename}`);
        return;
    }

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
        const result = await cdb
            .insert(table, row, {
                force: "ignore",          // skip if row already exists
                conflictTarget: getPrimaryKey(table),
            })
            .catch((err) => {
                logger.error(`Failed to seed row in ${table.name}:`, { row, err });
                return null;
            });

        if (result) inserted++;
        else skipped++;
    }

    logger.info(`Seeded "${table.name}": ${inserted} inserted, ${skipped} skipped`);
}

// ---------------------------------------------------------------------------
// Helper: extract primary key column name from a table definition
// ---------------------------------------------------------------------------

function getPrimaryKey(table: Table<any>): string {
    for (const [colName, col] of Object.entries(table.columns)) {
        if ((col as any).primaryKey) return colName;
    }
    throw new Error(`No primary key found on table "${table.name}"`);
}

// ---------------------------------------------------------------------------
// Seed order — same dependency rule as createAllTables:
// referenced tables must be seeded before their dependents
// ---------------------------------------------------------------------------

export const runSeeds = async (): Promise<void> => {
    logger.info("Running seed files from data/seed/...");

    // Independent tables first
    await seedTable(classTable,  "class.csv");
    await seedTable(teacher,     "teacher.csv");
    await seedTable(timetable,   "timetable.csv");
    await seedTable(subjectname, "subjectname.csv");

    // Dependents after
    await seedTable(student,  "student.csv");   // needs class
    await seedTable(subject,  "subject.csv");   // needs class, timetable, subjectname

    logger.info("Seeding complete.");
};