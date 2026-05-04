import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import logo from './uel-logo.png';

const SERVER = 'http://localhost:3000';
const socket = io(SERVER, {
  transports: ['polling'],
  reconnection: true,
  reconnectionAttempts: 5,
});

function App() {
  const [data, setData] = useState({ session: null, count: 0, attendees: [] });
  const [sessions, setSessions] = useState([]);
  const [live, setLive] = useState(false);
  const [view, setView] = useState('dashboard');
  const [loggedIn, setLoggedIn] = useState(false);
  const [lecturer, setLecturer] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    if (!loggedIn) return;
    axios.get(`${SERVER}/api/attendance/live`).then(r => setData(r.data));
    axios.get(`${SERVER}/api/sessions`).then(r => setSessions(r.data.sessions));
    socket.on('connect', () => setLive(true));
    socket.on('disconnect', () => setLive(false));
    socket.on('connect_error', () => setLive(false));
    socket.on('new_scan', scan => {
      setData(p => ({ ...p, count: p.count + 1, attendees: [scan, ...p.attendees] }));
    });
    return () => socket.disconnect();
  }, [loggedIn]);

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      setLoginError('Please enter your email and password');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    try {
      const r = await axios.post(`${SERVER}/api/lecturer/login`, {
        email: loginEmail,
        password: loginPassword
      });
      setLecturer(r.data);
      setLoggedIn(true);
    } catch (e) {
      setLoginError('Invalid email or password');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleToggle = async (sessionId, currentlyActive) => {
    await axios.post(`${SERVER}/api/sessions/${sessionId}/toggle`, {
      activate: !currentlyActive
    });
    const r = await axios.get(`${SERVER}/api/sessions`);
    setSessions(r.data.sessions);
    const r2 = await axios.get(`${SERVER}/api/attendance/live`);
    setData(r2.data);
  };

  // LOGIN SCREEN
  if (!loggedIn) return (
    <div style={{ fontFamily:'Arial', display:'flex', justifyContent:'center',
                  alignItems:'center', minHeight:'100vh', background:'#f0f4f8' }}>
      <div style={{ background:'white', padding:40, borderRadius:12,
                    width:400, boxShadow:'0 4px 20px rgba(0,0,0,0.1)', textAlign:'center' }}>
        <img src={logo} alt='UEL Logo'
          style={{ width:100, height:100, objectFit:'contain', marginBottom:16 }} />
        <h1 style={{ color:'#1F4E79', marginBottom:8, fontSize:24 }}>UEL Attendance</h1>
        <p style={{ color:'#666', marginBottom:24 }}>Lecturer Dashboard</p>
        {loginError && <p style={{ color:'red', marginBottom:12 }}>{loginError}</p>}
        <input
          type='email'
          placeholder='Email address'
          value={loginEmail}
          onChange={e => setLoginEmail(e.target.value)}
          style={{ width:'100%', padding:12, borderRadius:8, border:'1px solid #ccc',
                   marginBottom:12, fontSize:15, boxSizing:'border-box' }}
        />
        <input
          type='password'
          placeholder='Password'
          value={loginPassword}
          onChange={e => setLoginPassword(e.target.value)}
          style={{ width:'100%', padding:12, borderRadius:8, border:'1px solid #ccc',
                   marginBottom:16, fontSize:15, boxSizing:'border-box' }}
        />
        <button onClick={handleLogin} disabled={loginLoading}
          style={{ width:'100%', padding:14, background:'#2E75B6', color:'white',
                   border:'none', borderRadius:8, fontSize:16, fontWeight:'bold',
                   cursor:'pointer' }}>
          {loginLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </div>
    </div>
  );

  // MAIN DASHBOARD
  return (
    <div style={{ fontFamily:'Arial', padding:32, background:'#f0f4f8', minHeight:'100vh' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <img src={logo} alt='UEL Logo'
            style={{ width:50, height:50, objectFit:'contain' }} />
          <div>
            <h1 style={{ color:'#1F4E79', margin:0 }}>UEL Attendance Dashboard</h1>
            <p style={{ color:'#888', margin:'4px 0 0', fontSize:13 }}>
              Welcome, {lecturer?.name}
            </p>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ background: live?'#1E7B34':'#C55A11', color:'white',
                          padding:'4px 14px', borderRadius:20, fontSize:13 }}>
            {live ? '● Live' : '○ Disconnected'}
          </span>
          <button onClick={() => { setLoggedIn(false); setLecturer(null); }}
            style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #ccc',
                     background:'white', cursor:'pointer', fontSize:13 }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display:'flex', gap:12, marginBottom:32 }}>
        <button onClick={() => setView('dashboard')}
          style={{ padding:'8px 20px', borderRadius:8, border:'none', cursor:'pointer',
                   background: view==='dashboard'?'#2E75B6':'#fff',
                   color: view==='dashboard'?'white':'#1F4E79',
                   fontWeight:'bold', fontSize:14 }}>
          Live Attendance
        </button>
        <button onClick={() => setView('sessions')}
          style={{ padding:'8px 20px', borderRadius:8, border:'none', cursor:'pointer',
                   background: view==='sessions'?'#2E75B6':'#fff',
                   color: view==='sessions'?'white':'#1F4E79',
                   fontWeight:'bold', fontSize:14 }}>
          Manage Sessions
        </button>
      </div>

      {/* LIVE ATTENDANCE VIEW */}
      {view === 'dashboard' && (
        <div>
          <p style={{ color:'#555', marginBottom:16 }}>
            Session: <strong>{data.session || 'No active session'}</strong>
          </p>
          <div style={{ background:'#2E75B6', color:'white', borderRadius:12,
                        padding:'24px 40px', display:'inline-block', marginBottom:32 }}>
            <div style={{ fontSize:72, fontWeight:'bold', lineHeight:1 }}>{data.count}</div>
            <div style={{ fontSize:18, opacity:0.85 }}>Students Present</div>
          </div>
          <h2 style={{ color:'#1F4E79' }}>Scan Log</h2>
          <table style={{ width:'100%', borderCollapse:'collapse',
                           background:'white', borderRadius:8, overflow:'hidden' }}>
            <thead>
              <tr style={{ background:'#1F4E79', color:'white' }}>
                <th style={{ padding:12, textAlign:'left' }}>Student ID</th>
                <th style={{ padding:12, textAlign:'left' }}>Name</th>
                <th style={{ padding:12, textAlign:'left' }}>Time Scanned</th>
              </tr>
            </thead>
            <tbody>
              {!data.attendees.length && (
                <tr><td colSpan={3} style={{ padding:20, color:'#999', textAlign:'center' }}>
                  Waiting for students to scan in...
                </td></tr>
              )}
              {data.attendees.map((a, i) => (
                <tr key={i} style={{ background: i%2===0?'#fff':'#f0f4f8' }}>
                  <td style={{ padding:10 }}>{a.student_id}</td>
                  <td style={{ padding:10 }}>{a.name}</td>
                  <td style={{ padding:10 }}>{new Date(a.scanned_at).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MANAGE SESSIONS VIEW */}
      {view === 'sessions' && (
        <div>
          <h2 style={{ color:'#1F4E79', marginBottom:16 }}>Manage Sessions</h2>
          <p style={{ color:'#555', marginBottom:24 }}>
            Activate a session to allow students to register their attendance.
            Only one session can be active at a time.
          </p>
          <table style={{ width:'100%', borderCollapse:'collapse',
                           background:'white', borderRadius:8, overflow:'hidden' }}>
            <thead>
              <tr style={{ background:'#1F4E79', color:'white' }}>
                <th style={{ padding:12, textAlign:'left' }}>Module</th>
                <th style={{ padding:12, textAlign:'left' }}>Room</th>
                <th style={{ padding:12, textAlign:'left' }}>Date</th>
                <th style={{ padding:12, textAlign:'left' }}>Time</th>
                <th style={{ padding:12, textAlign:'left' }}>Lecturer</th>
                <th style={{ padding:12, textAlign:'left' }}>Status</th>
                <th style={{ padding:12, textAlign:'left' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={s.id} style={{ background: i%2===0?'#fff':'#f0f4f8' }}>
                  <td style={{ padding:10, fontWeight:'bold', color:'#1F4E79' }}>{s.module_code}</td>
                  <td style={{ padding:10 }}>{s.room}</td>
                  <td style={{ padding:10 }}>{new Date(s.date).toLocaleDateString('en-GB')}</td>
                  <td style={{ padding:10 }}>{s.start_time} - {s.end_time}</td>
                  <td style={{ padding:10 }}>{s.lecturer_name}</td>
                  <td style={{ padding:10 }}>
                    <span style={{ background: s.is_active?'#1E7B34':'#ccc',
                                   color: s.is_active?'white':'#666',
                                   padding:'3px 10px', borderRadius:12, fontSize:12 }}>
                      {s.is_active ? '● Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding:10 }}>
                    <button onClick={() => handleToggle(s.id, s.is_active)}
                      style={{ padding:'6px 14px', borderRadius:6, border:'none',
                               cursor:'pointer', fontWeight:'bold', fontSize:13,
                               background: s.is_active?'#C55A11':'#2E75B6',
                               color:'white' }}>
                      {s.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;