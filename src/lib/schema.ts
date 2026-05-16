import { 
    text, 
    integer, 
    smallint, 
    time, 
    timestamp, 
    jsonb, 
    serial, 
    enumType, 
    primaryKey, 
    notNull, 
    unique, 
    defaultValue, 
    references, 
    check,
    defineTable,
    InferRow 
} from "./schemaBuilder.js";

// ENUMS

const attendanceType = enumType(["attend", "permit", "sick", "absent"] as const);

// Table definitions

const teacher = defineTable("teacher", {
    nip: primaryKey(text()),
    name: notNull(text()),
    subjectid: notNull(integer()),
    passwordhash: notNull(text()),
    email: notNull(text()),
    nickname: unique(text())
});

const student = defineTable("student", {
    nisn: unique(primaryKey(text())),
    name: notNull(text()),
    passwordhash: notNull(text()),
    email: notNull(text()),
    classid: notNull(integer()),
    nickname: unique(text())
});

const timetable = defineTable("timetable", {
    numid: primaryKey(integer()),
    sort: notNull(integer()),
    day: check(notNull(smallint()), "day BETWEEN 1 AND 7"),
    timestart: notNull(time()),
    timeend: notNull(time()),
    desctription: notNull(text())
});

const subject = defineTable("subject", {
    scheduleid: primaryKey(integer()),
    classid: notNull(integer()),
    numid: notNull(integer()),
    subjectid: notNull(integer()),
    alternativeid: notNull(integer())
});

const subjectname = defineTable("subjectname", {
    teachid: primaryKey(integer()),
    subjectid: notNull(integer()),
    name: notNull(text()),
    grade: notNull(integer()),
    alternativeid: notNull(integer())
});

const classTable = defineTable("class", {
    classid: primaryKey(integer()),
    subjectid: notNull(integer())
});

const assignmentteacher = defineTable("assignmentteacher", {
    id: primaryKey(serial()),
    nip: references(notNull(text()), "teacher", "nip"),
    title: notNull(text()),
    description: text(),
    block: jsonb(),
    date: notNull(timestamp()),
    expiry: notNull(timestamp()),
    classid: references(notNull(integer()), "class", "classid"),
    subjectid: integer(),
    created_at: defaultValue(timestamp(), "CURRENT_TIMESTAMP"),
    updated_at: defaultValue(timestamp(), "CURRENT_TIMESTAMP")
});

const assignmentsubmit = defineTable("assignmentsubmit", {
    id: primaryKey(serial()),
    nisn: references(notNull(text()), "student", "nisn"),
    assignmentid: references(notNull(integer()), "assignmentteacher", "id", "CASCADE"),
    date: notNull(timestamp()),
    block: jsonb(),
    created_at: defaultValue(timestamp(), "CURRENT_TIMESTAMP"),
    updated_at: defaultValue(timestamp(), "CURRENT_TIMESTAMP")
});

const attendance = defineTable("attendance", {
    id: primaryKey(serial()),
    nisn: references(notNull(text()), "student", "nisn"),
    type: notNull(attendanceType),
    created_at: defaultValue(notNull(timestamp()), "NOW()")
});

// Type inference

type TeacherRow = InferRow<typeof teacher>;

type StudentRow = InferRow<typeof student>;

type AttendanceRow = InferRow<typeof attendance>;

// Exporting

export type {
    TeacherRow,
    StudentRow,
    AttendanceRow
};
export {
    teacher,
    student,
    timetable,
    subject,
    subjectname,
    classTable,
    assignmentteacher,
    assignmentsubmit,
    attendance
};