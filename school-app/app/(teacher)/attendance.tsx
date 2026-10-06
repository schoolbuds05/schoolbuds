// @ts-nocheck
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import api from '../../src/api';

const STATUS_OPTIONS = [
  { key:'present', label:'P', color:'#1D9E75', bg:'#E1F5EE' },
  { key:'absent',  label:'A', color:'#E24B4A', bg:'#FCEBEB' },
  { key:'late',    label:'L', color:'#BA7517', bg:'#FAEEDA' },
  { key:'excused', label:'E', color:'#378ADD', bg:'#E6F1FB' },
];

export default function TeacherAttendance() {
  const [classes, setClasses]       = useState([]);
  const [selected, setSelected]     = useState(null);
  const [students, setStudents]     = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    api.get('/teacher/classes').then(res => {
      setClasses(res.data);
      if (res.data.length > 0) loadClass(res.data[0]);
    }).finally(() => setLoading(false));
  }, []);

  const loadClass = async (cls) => {
    setSelected(cls);
    setLoading(true);
    try {
      const [studRes, attRes] = await Promise.all([
        api.get(`/teacher/class/${cls.id}/students`),
        api.get(`/teacher/class/${cls.id}/attendance?date=${today}`),
      ]);
      setStudents(studRes.data.students);
      const attMap = {};
      studRes.data.students.forEach(s => { attMap[s.id] = 'present'; });
      attRes.data.attendance.forEach(a => { attMap[a.student_id] = a.status; });
      setAttendance(attMap);
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  };

  const setStatus = (studentId, status) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const markAll = (status) => {
    const all = {};
    students.forEach(s => { all[s.id] = status; });
    setAttendance(all);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/teacher/class/${selected.id}/attendance`, {
        date: today,
        attendance: students.map(s => ({
          student_id: s.id,
          status: attendance[s.id] ?? 'present',
        })),
      });
      Alert.alert('Saved!', `Attendance saved for ${today}`);
    } catch (e) {
      Alert.alert('Error', 'Could not save attendance.');
    } finally { setSaving(false); }
  };

  const presentCount = Object.values(attendance).filter(s => s === 'present').length;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1D9E75"/></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance</Text>
        <Text style={styles.sub}>{today}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.classRow} contentContainerStyle={{ paddingHorizontal:16, gap:8 }}>
        {classes.map((c, i) => (
          <TouchableOpacity key={i}
            style={[styles.classTab, selected?.id === c.id && styles.classTabActive]}
            onPress={() => loadClass(c)}>
            <Text style={[styles.classTabText, selected?.id === c.id && styles.classTabTextActive]}>
              {c.subject.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {presentCount}/{students.length} present
        </Text>
        <View style={styles.markAllRow}>
          <TouchableOpacity style={styles.markBtn} onPress={() => markAll('present')}>
            <Text style={styles.markBtnText}>All present</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.markBtn, { backgroundColor:'#FCEBEB' }]}
            onPress={() => markAll('absent')}>
            <Text style={[styles.markBtnText, { color:'#E24B4A' }]}>All absent</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16 }}>
        {students.map((s, i) => (
          <View key={i} style={styles.studentRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{s.first_name[0]}{s.last_name[0]}</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={styles.studentName}>{s.first_name} {s.last_name}</Text>
              <Text style={styles.studentId}>{s.student_id}</Text>
            </View>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.key}
                  style={[styles.statusBtn,
                    { backgroundColor: attendance[s.id] === opt.key ? opt.bg : '#f5f5f5' }]}
                  onPress={() => setStatus(s.id, opt.key)}>
                  <Text style={[styles.statusText,
                    { color: attendance[s.id] === opt.key ? opt.color : '#ccc' }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity:0.6 }]}
          onPress={save} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff"/>
            : <Text style={styles.saveBtnText}>Save attendance · {today}</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex:1, backgroundColor:'#f5f5f5' },
  center:            { flex:1, justifyContent:'center', alignItems:'center' },
  header:            { backgroundColor:'#1D9E75', padding:20, paddingTop:56 },
  title:             { color:'#fff', fontSize:20, fontWeight:'600' },
  sub:               { color:'rgba(255,255,255,0.8)', fontSize:13, marginTop:3 },
  classRow:          { maxHeight:52, backgroundColor:'#fff', borderBottomWidth:0.5, borderColor:'#eee' },
  classTab:          { paddingHorizontal:16, paddingVertical:12, borderRadius:0, borderBottomWidth:2, borderBottomColor:'transparent' },
  classTabActive:    { borderBottomColor:'#1D9E75' },
  classTabText:      { fontSize:13, color:'#888' },
  classTabTextActive:{ color:'#1D9E75', fontWeight:'600' },
  summaryRow:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingVertical:10, backgroundColor:'#fff', borderBottomWidth:0.5, borderColor:'#eee' },
  summaryText:       { fontSize:13, color:'#555', fontWeight:'500' },
  markAllRow:        { flexDirection:'row', gap:8 },
  markBtn:           { backgroundColor:'#E1F5EE', paddingHorizontal:10, paddingVertical:5, borderRadius:8 },
  markBtnText:       { fontSize:12, color:'#1D9E75', fontWeight:'500' },
  studentRow:        { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'#fff', borderRadius:12, padding:12, marginBottom:8 },
  avatar:            { width:40, height:40, borderRadius:20, backgroundColor:'#E1F5EE', justifyContent:'center', alignItems:'center' },
  avatarText:        { fontSize:14, fontWeight:'600', color:'#1D9E75' },
  studentName:       { fontSize:14, fontWeight:'500', color:'#333' },
  studentId:         { fontSize:11, color:'#999', marginTop:1 },
  statusRow:         { flexDirection:'row', gap:4 },
  statusBtn:         { width:30, height:30, borderRadius:8, justifyContent:'center', alignItems:'center' },
  statusText:        { fontSize:13, fontWeight:'700' },
  footer:            { padding:16, backgroundColor:'#fff', borderTopWidth:0.5, borderColor:'#eee' },
  saveBtn:           { backgroundColor:'#1D9E75', borderRadius:12, padding:15, alignItems:'center' },
  saveBtnText:       { color:'#fff', fontWeight:'600', fontSize:15 },
});