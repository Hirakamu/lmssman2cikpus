-- Active: 1776947878337@@192.168.18.2@5432
CREATE TABLE IF NOT EXISTS teacher (
    nip TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subjectid INTEGER NOT NULL,
    passwordhash TEXT NOT NULL,
    email TEXT NOT NULL,
    nickname TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS student (
    nisn TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    passwordhash TEXT NOT NULL,
    email TEXT NOT NULL,
    classid INTEGER NOT NULL,
    nickname TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS timetable (
    numid INTEGER PRIMARY KEY,
    sort INTEGER NOT NULL,
    day INTEGER NOT NULL,
    timestart time NOT NULL, 
    timeend time NOT NULL,
    desctription TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subject (
    scheduleid INTEGER PRIMARY KEY,
    classid INTEGER NOT NULL,
    numid INTEGER NOT NULL,
    subjectid INTEGER NOT NULL,
    alternativeid INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subjectname (
    teachid INTEGER PRIMARY KEY,
    subjectid INTEGER NOT NULL,
    name TEXT NOT NULL,
    grade INTEGER NOT NULL,
    alternativeid INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS class (
    classid INTEGER PRIMARY KEY,
    subjectid INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assignmentteacher (
    id SERIAL PRIMARY KEY,
    nip TEXT NOT NULL REFERENCES teacher(nip),
    title TEXT NOT NULL,
    desc TEXT,
    block JSONB,
    date TIMESTAMP NOT NULL,
    expiry TIMESTAMP NOT NULL,
    classid INTEGER NOT NULL REFERENCES class(classid),
    subjectid INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assignmentsubmit (
    id SERIAL PRIMARY KEY,
    nisn TEXT NOT NULL REFERENCES student(nisn),
    assignmentid INTEGER NOT NULL REFERENCES assignmentteacher(id) ON DELETE CASCADE,
    date TIMESTAMP NOT NULL,
    block JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE attendance_type AS ENUM ('attend', 'permit', 'sick', 'absent');

CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    nisn TEXT NOT NULL REFERENCES student(nisn),
    type attendance_type NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);