CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS teacher (
		id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
		name TEXT NOT NULL,
		NIP TEXT NOT NULL,
		subjectId INTEGER NOT NULL,
		passwordHash TEXT NOT NULL,
		email TEXT NOT NULL
	);

CREATE TABLE IF NOT EXISTS classes (
	id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
	classId INTEGER NOT NULL,
	teacherhomeId INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS student (
	id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
	name TEXT NOT NULL,
	studentId TEXT NOT NULL,
	passwordHash TEXT NOT NULL,
	email TEXT NOT NULL,
	classId INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS timetable (
	id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
	numId INTEGER NOT NULL,
	sort INTEGER NOT NULL,
	timeStart TIME NOT NULL,
	timeEnd TIME NOT NULL,
	day INTEGER NOT NULL,
	ref TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule (
	id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
	schedule INTEGER NOT NULL,
	subjectId INTEGER NOT NULL,
	secondarysubject INTEGER NOT NULL,
	classId INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subjectname (
	id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
	subjectId INTEGER NOT NULL,
	name TEXT NOT NULL,
	secondarysubject INTEGER NOT NULL,
	grade INTEGER NOT NULL,
	UNIQUE(subjectId, secondarysubject, grade)
);

CREATE TABLE IF NOT EXISTS attendance (
	id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
	studentId INTEGER NOT NULL,
	subjectId INTEGER NOT NULL,
	date DATE NOT NULL,
	status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studentscorelog (
	id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
	studentId INTEGER NOT NULL,
	score INTEGER NOT NULL,
	reason TEXT NOT NULL,
	date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS teacherclass (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    teacherId TEXT NOT NULL,
    classId INTEGER NOT NULL,
    subjectId INTEGER NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classrating (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    classId INTEGER NOT NULL,
    teacherId TEXT NOT NULL,
    studentId TEXT NOT NULL,
    rating INTEGER NOT NULL,
    review TEXT,
    createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academicevent (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    startDate DATE NOT NULL,
    endDate DATE,
    isRunning INTEGER NOT NULL DEFAULT 0,
    createdBy TEXT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teacherchallenge (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    reward TEXT,
    dueDate DATE,
    isActive INTEGER NOT NULL DEFAULT 1,
    createdBy TEXT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS studentwork (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    studentId TEXT NOT NULL,
    teacherId TEXT NOT NULL,
    classId INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    submissionDate TIMESTAMP NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL,
    grade INTEGER
);

CREATE TABLE IF NOT EXISTS assignment (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    classId INTEGER NOT NULL,
    subjectId INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    dueDate DATE,
    createdBy TEXT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    classId INTEGER NOT NULL,
    subjectId INTEGER NOT NULL,
    title TEXT NOT NULL,
    examDate DATE NOT NULL,
    createdBy TEXT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    grade INTEGER NOT NULL,
    class INTEGER NOT NULL,
    type TEXT NOT NULL,
    block JSONB NOT NULL,
    expiry TIMESTAMP NOT NULL,
    subjectId INTEGER NOT NULL,
);

CREATE TABLE IF NOT EXISTS examresult (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    examId UUID NOT NULL,
    studentId TEXT NOT NULL,
    score INTEGER,
    gradedAt TIMESTAMP
);

