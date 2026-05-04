CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    programme VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(100),
    qr_token TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    module_code VARCHAR(20) NOT NULL,
    room VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    lecturer_name VARCHAR(100),
    is_active BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    session_id INTEGER REFERENCES sessions(id),
    scanned_at TIMESTAMP DEFAULT NOW(),
    scanner_id VARCHAR(50) DEFAULT 'station-01',
    UNIQUE(student_id, session_id)
);

CREATE TABLE IF NOT EXISTS module_registrations (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    module_code VARCHAR(20) NOT NULL,
    UNIQUE(student_id, module_code)
);

CREATE TABLE IF NOT EXISTS pending_scans (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL,
    scanned_at TIMESTAMP DEFAULT NOW(),
    claimed BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS lecturers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL
);

