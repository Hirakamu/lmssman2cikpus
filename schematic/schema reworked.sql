-- Active: 1776947878337@@192.168.18.2@5432
CREATE TABLE IF NOT EXISTS teacher (
    nip TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subjectid INTEGER NOT NULL,
    passwordhash TEXT NOT NULL,
    email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student (
    nisn TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    passwordhash TEXT NOT NULL,
    email TEXT NOT NULL,
    classid INTEGER NOT NULL
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

CREATE TABLE IF NOT EXISTS subject (
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