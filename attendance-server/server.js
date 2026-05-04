require('dotenv').config({ quiet: true });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(cors());
app.use(express.json());

// Pi scans a QR code
app.post('/api/attendance/scan', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'No token' });
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }

  try {
    const sr = await db.query('SELECT * FROM students WHERE student_id=$1', [payload.student_id]);
    if (!sr.rows.length) return res.status(404).json({ error: 'Student not found' });
    const student = sr.rows[0];

    const sess = await db.query('SELECT * FROM sessions WHERE is_active=TRUE LIMIT 1');
    if (!sess.rows.length) return res.status(400).json({ error: 'No active session' });
    const session = sess.rows[0];

    const ins = await db.query(
      `INSERT INTO attendance_records (student_id, session_id)
       VALUES ($1,$2) ON CONFLICT (student_id,session_id) DO NOTHING RETURNING *`,
      [student.id, session.id]
    );

    // Save pending scan so student can register via app
await db.query(
  `INSERT INTO pending_scans (student_id) VALUES ($1)`,
  [student.student_id]
);

    const isNew = ins.rows.length > 0;
    if (isNew) {
      io.emit('new_scan', {
        student_id: student.student_id,
        name: student.name,
        scanned_at: new Date().toISOString()
      });
    }
    return res.json({
      status: isNew ? 'recorded' : 'already_recorded',
      student_name: student.name
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// Lecturer dashboard fetches current session
app.get('/api/attendance/live', async (req, res) => {
  try {
    const sess = await db.query('SELECT * FROM sessions WHERE is_active=TRUE LIMIT 1');
    if (!sess.rows.length) return res.json({ session: null, count: 0, attendees: [] });
    const session = sess.rows[0];
    const rec = await db.query(
      `SELECT s.student_id, s.name, ar.scanned_at
       FROM attendance_records ar
       JOIN students s ON ar.student_id=s.id
       WHERE ar.session_id=$1
       ORDER BY ar.scanned_at DESC`,
      [session.id]
    );
    res.json({
      session: `${session.module_code} - ${session.room}`,
      count: rec.rows.length,
      attendees: rec.rows
    });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// Serve a student's QR token to the mobile app
app.get('/api/student/:id/token', async (req, res) => {
  const r = await db.query(
    'SELECT qr_token FROM students WHERE student_id=$1',
    [req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ token: r.rows[0].qr_token });
});

// Student login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const r = await db.query(
      'SELECT * FROM students WHERE email=$1 AND password=$2',
      [email, password]
    );
    if (!r.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const student = r.rows[0];
    res.json({
      student_id: student.student_id,
      name: student.name,
      qr_token: student.qr_token
    });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// Get modules for a student
app.get('/api/student/:id/modules', async (req, res) => {
  try {
    const r = await db.query(
      'SELECT module_code FROM module_registrations mr JOIN students s ON mr.student_id=s.id WHERE s.student_id=$1',
      [req.params.id]
    );
    res.json({ modules: r.rows.map(r => r.module_code) });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// Student registers attendance for a module
app.post('/api/attendance/register', async (req, res) => {
  const { student_id, module_code } = req.body;
  try {
    // Check if student has a recent pending scan (within last 10 minutes)
    const scanCheck = await db.query(
      `SELECT * FROM pending_scans 
       WHERE student_id=$1 
       AND scanned_at > NOW() - INTERVAL '10 minutes'
       ORDER BY scanned_at DESC LIMIT 1`,
      [student_id]
    );

    if (!scanCheck.rows.length) {
      return res.status(403).json({ 
        error: 'Please scan your QR code at the door first' 
      });
    }

    const studentResult = await db.query(
      'SELECT * FROM students WHERE student_id=$1', [student_id]
    );
    if (!studentResult.rows.length) return res.status(404).json({ error: 'Student not found' });
    const student = studentResult.rows[0];

    const sessionResult = await db.query(
      'SELECT * FROM sessions WHERE module_code=$1 AND is_active=TRUE LIMIT 1',
      [module_code]
    );
    if (!sessionResult.rows.length) return res.status(400).json({ error: 'No active session for this module' });
    const session = sessionResult.rows[0];

    const ins = await db.query(
      `INSERT INTO attendance_records (student_id, session_id)
       VALUES ($1,$2) ON CONFLICT (student_id,session_id) DO NOTHING RETURNING *`,
      [student.id, session.id]
    );
    const isNew = ins.rows.length > 0;

    if (isNew) {
      // Clear pending scan after successful registration
      await db.query('DELETE FROM pending_scans WHERE student_id=$1', [student_id]);
      io.emit('new_scan', {
        student_id: student.student_id,
        name: student.name,
        module_code,
        scanned_at: new Date().toISOString()
      });
    }

    res.json({
      status: isNew ? 'recorded' : 'already_recorded',
      module_code,
      date: session.date,
      start_time: session.start_time,
      room: session.room
    });
  } catch (e) { 
    console.error(e);
    res.status(500).json({ error: 'Server error' }); 
  }
});

// Get attendance history for a student per module
app.get('/api/student/:id/attendance/:module', async (req, res) => {
  try {
    const r = await db.query(
      `SELECT ar.scanned_at, s.date, s.start_time, s.room
       FROM attendance_records ar
       JOIN sessions s ON ar.session_id=s.id
       JOIN students st ON ar.student_id=st.id
       WHERE st.student_id=$1 AND s.module_code=$2
       ORDER BY ar.scanned_at DESC`,
      [req.params.id, req.params.module]
    );
    res.json({ history: r.rows });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// Get all sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM sessions ORDER BY date DESC, start_time DESC');
    res.json({ sessions: r.rows });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// Activate/deactivate a session
app.post('/api/sessions/:id/toggle', async (req, res) => {
  try {
    // Deactivate all sessions first
    await db.query('UPDATE sessions SET is_active=FALSE');
    // Activate the selected one if it wasn't already active
    const { activate } = req.body;
    if (activate) {
      await db.query('UPDATE sessions SET is_active=TRUE WHERE id=$1', [req.params.id]);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// Lecturer login
app.post('/api/lecturer/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const r = await db.query(
      'SELECT * FROM lecturers WHERE email=$1 AND password=$2',
      [email, password]
    );
    if (!r.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ name: r.rows[0].name, email: r.rows[0].email });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
module.exports = { app, server };