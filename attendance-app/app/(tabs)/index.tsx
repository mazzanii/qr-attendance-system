import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const SERVER = 'http://192.168.0.161:3000';

export default function App() {
  const [screen, setScreen] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [student, setStudent] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedModule, setSelectedModule] = useState(null);
  const [history, setHistory] = useState([]);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    checkExistingLogin();
  }, []);

  const checkExistingLogin = async () => {
    try {
      const stored = await SecureStore.getItemAsync('student_data');
      if (stored) {
        const data = JSON.parse(stored);
        setStudent(data);
        fetchModules(data.student_id);
        setScreen('qr');
      }
    } catch (e) {}
  };

  const fetchModules = async (studentId) => {
    try {
      const r = await axios.get(`${SERVER}/api/student/${studentId}/modules`);
      setModules(r.data.modules);
    } catch (e) {}
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await axios.post(`${SERVER}/api/login`, { email, password });
      const data = r.data;
      await SecureStore.setItemAsync('student_data', JSON.stringify(data));
      setStudent(data);
      fetchModules(data.student_id);
      setScreen('qr');
    } catch (e) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleModuleSelect = async (moduleCode) => {
    setLoading(true);
    try {
      const r = await axios.post(`${SERVER}/api/attendance/register`, {
        student_id: student.student_id,
        module_code: moduleCode
      });
      if (r.data.status === 'recorded') {
        setSelectedModule({ code: moduleCode, ...r.data });
        setScreen('success');
      } else {
        Alert.alert('Already Registered', `You have already registered attendance for ${moduleCode} today.`);
      }
    } catch (e) {
      if (e.response?.data?.error === 'Please scan your QR code at the door first') {
        Alert.alert('Scan Required', 'Please scan your QR code at the door before registering attendance.');
      } else if (e.response?.data?.error === 'No active session for this module') {
        Alert.alert('No Active Session', `There is no active session for ${moduleCode} right now.`);
      } else {
        Alert.alert('Error', 'Could not register attendance. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewHistory = async (moduleCode) => {
    setLoading(true);
    try {
      const r = await axios.get(`${SERVER}/api/student/${student.student_id}/attendance/${moduleCode}`);
      setHistory(r.data.history);
      setSelectedModule({ code: moduleCode });
      setScreen('history');
    } catch (e) {
      Alert.alert('Error', 'Could not load attendance history.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('student_data');
    setStudent(null);
    setEmail('');
    setPassword('');
    setScreen('login');
  };

  // LOGIN SCREEN
  if (screen === 'login') return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' />
      <Image
        source={require('../../assets/images/uel-logo.png')}
        style={{ width:120, height:120, marginBottom:24, resizeMode:'contain' }}
      />
      <Text style={styles.title}>UEL Attendance</Text>
      <Text style={styles.sub}>Sign in with your university email</Text>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder='u1234567@uel.ac.uk'
        value={email}
        onChangeText={setEmail}
        keyboardType='email-address'
        autoCapitalize='none'
      />
      <TextInput
        style={styles.input}
        placeholder='Password'
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
        {loading
          ? <ActivityIndicator color='white' />
          : <Text style={styles.btnText}>Sign In</Text>
        }
      </TouchableOpacity>
    </View>
  );

  // QR SCREEN
  if (screen === 'qr') return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' />
      <Image
        source={require('../../assets/images/uel-logo.png')}
        style={{ width:80, height:80, marginBottom:12, resizeMode:'contain' }}
      />
      <Text style={styles.title}>Hello, {student?.name?.split(' ')[0]}!</Text>
      <Text style={styles.sub}>Scan this QR code at the door, then tap your module below</Text>
      <View style={styles.qrBox}>
        <QRCode value={student?.qr_token} size={220} backgroundColor='white' />
      </View>
      <Text style={styles.sectionTitle}>Your Modules</Text>
      {modules.map(mod => (
        <View key={mod} style={styles.moduleRow}>
          <TouchableOpacity style={styles.moduleBtn} onPress={() => handleModuleSelect(mod)}>
            <Text style={styles.moduleBtnText}>{mod}</Text>
            <Text style={styles.moduleSubText}>Tap to register attendance</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.historyBtn} onPress={() => handleViewHistory(mod)}>
            <Text style={styles.historyBtnText}>History</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );

  // SUCCESS SCREEN
  if (screen === 'success') return (
    <View style={styles.container}>
      <Text style={styles.successIcon}>✅</Text>
      <Text style={styles.title}>Attendance Registered!</Text>
      <Text style={styles.sub}>Module: {selectedModule?.module_code}</Text>
      <Text style={styles.sub}>Date: {new Date(selectedModule?.date).toLocaleDateString('en-GB')}</Text>
      <Text style={styles.sub}>Time: {selectedModule?.start_time}</Text>
      <Text style={styles.sub}>Room: {selectedModule?.room}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => setScreen('qr')}>
        <Text style={styles.btnText}>Back to My QR</Text>
      </TouchableOpacity>
    </View>
  );

  // HISTORY SCREEN
  if (screen === 'history') return (
    <View style={styles.container}>
      <Text style={styles.title}>{selectedModule?.code} Attendance</Text>
      <Text style={styles.sub}>{history.length} session{history.length !== 1 ? 's' : ''} attended</Text>
      {history.length === 0
        ? <Text style={styles.empty}>No attendance recorded yet</Text>
        : <FlatList
            data={history}
            keyExtractor={(_, i) => i.toString()}
            style={{ width: '100%', marginTop: 16 }}
            renderItem={({ item }) => (
              <View style={styles.historyItem}>
                <Text style={styles.historyDate}>
                  {new Date(item.date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
                <Text style={styles.historyTime}>
                  {item.start_time} — Room {item.room}
                </Text>
              </View>
            )}
          />
      }
      <TouchableOpacity style={styles.btn} onPress={() => setScreen('qr')}>
        <Text style={styles.btnText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#fff', alignItems:'center',
               justifyContent:'center', padding:24 },
  title: { fontSize:24, fontWeight:'bold', color:'#1F4E79', marginBottom:8 },
  sub: { fontSize:14, color:'#666', marginBottom:12, textAlign:'center' },
  err: { fontSize:14, color:'red', marginBottom:12, textAlign:'center' },
  input: { width:'100%', borderWidth:1, borderColor:'#ccc', borderRadius:8,
           padding:12, marginBottom:12, fontSize:15 },
  btn: { width:'100%', backgroundColor:'#2E75B6', padding:14,
         borderRadius:8, alignItems:'center', marginTop:8 },
  btnText: { color:'white', fontWeight:'bold', fontSize:16 },
  qrBox: { padding:16, backgroundColor:'white', borderRadius:12,
           shadowColor:'#000', shadowOpacity:0.1, shadowRadius:8,
           elevation:4, marginBottom:24 },
  sectionTitle: { fontSize:16, fontWeight:'bold', color:'#1F4E79',
                  marginBottom:12, alignSelf:'flex-start' },
  moduleRow: { flexDirection:'row', width:'100%', marginBottom:10, alignItems:'center' },
  moduleBtn: { flex:1, backgroundColor:'#f0f4f8', padding:14,
               borderRadius:8, marginRight:8 },
  moduleBtnText: { fontSize:16, fontWeight:'bold', color:'#1F4E79' },
  moduleSubText: { fontSize:12, color:'#888', marginTop:2 },
  historyBtn: { backgroundColor:'#E8F4FD', padding:14, borderRadius:8 },
  historyBtnText: { fontSize:13, color:'#2E75B6', fontWeight:'bold' },
  logoutBtn: { marginTop:24 },
  logoutText: { color:'#999', fontSize:14 },
  successIcon: { fontSize:64, marginBottom:16 },
  historyItem: { width:'100%', backgroundColor:'#f0f4f8', padding:14,
                 borderRadius:8, marginBottom:8 },
  historyDate: { fontSize:15, fontWeight:'bold', color:'#1F4E79' },
  historyTime: { fontSize:13, color:'#666', marginTop:4 },
  empty: { fontSize:15, color:'#999', marginTop:24 },
});