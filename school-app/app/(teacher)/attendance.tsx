// @ts-nocheck
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

  const statusCounts = STATUS_OPTIONS.reduce((counts, option) => ({
    ...counts,
    [option.key]: Object.values(attendance).filter(status => status === option.key).length,
  }), {});
  const displayDate = new Date(`${today}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1D9E75"/></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sub}>{displayDate}</Text>
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>Attendance</Text>
          <View style={styles.headerIcon}><Ionicons name="leaf" size={24} color="#65BA35" /></View>
        </View>
      </View>

      <ScrollView style={{ flex:1 }} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.classPicker} activeOpacity={0.8} onPress={() => classes.length > 1 && loadClass(classes[(classes.findIndex(c => c.id === selected?.id) + 1) % classes.length])}>
          <View style={styles.classCode}><Text style={styles.classCodeText}>{selected?.subject?.split(' ')[0] || 'Class'}</Text></View>
          <View style={styles.classPickerCopy}><Text style={styles.classPickerLabel}>Class</Text><Text style={styles.classPickerTitle}>{selected?.subject || 'Select a class'}</Text></View>
          <Ionicons name="chevron-forward" size={17} color="#A88F95" />
        </TouchableOpacity>

        <View style={styles.statsRow}>
          {STATUS_OPTIONS.map(option => (
            <View key={option.key} style={[styles.statusStat, { backgroundColor: option.bg }]}>
              <Text style={[styles.statusStatValue, { color: option.color }]}>{statusCounts[option.key]}</Text>
              <Text style={[styles.statusStatLabel, { color: option.color }]}>{option.key[0].toUpperCase() + option.key.slice(1)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.markAllRow}>
          <TouchableOpacity style={styles.markPresentBtn} onPress={() => markAll('present')}><Text style={styles.markPresentText}>Mark all present</Text></TouchableOpacity>
          <TouchableOpacity style={styles.markAbsentBtn} onPress={() => markAll('absent')}><Text style={styles.markAbsentText}>Mark all absent</Text></TouchableOpacity>
        </View>
        <View style={styles.studentsHeading}><Text style={styles.studentsTitle}>Students</Text><Text style={styles.studentsCount}>{students.length} {students.length === 1 ? 'student' : 'students'}</Text></View>
        {students.map((s, i) => (
          <View key={i} style={styles.studentRow}>
            <View style={styles.studentTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{s.first_name[0]}{s.last_name[0]}</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={styles.studentName}>{s.first_name} {s.last_name}</Text>
              <Text style={styles.studentId}>{s.student_id}</Text>
            </View>
            </View>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.key}
                  style={[styles.statusBtn,
                    { backgroundColor: attendance[s.id] === opt.key ? '#207A43' : '#F1E6E8' }]}
                  onPress={() => setStatus(s.id, opt.key)}>
                  <Text style={[styles.statusText,
                    { color: attendance[s.id] === opt.key ? '#fff' : '#806E73' }]}>
                    {opt.key[0].toUpperCase() + opt.key.slice(1)}
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
            : <Text style={styles.saveBtnText}>Save attendance</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex:1, backgroundColor:'#F9E9EC' },
  center:            { flex:1, justifyContent:'center', alignItems:'center' },
  header:            { backgroundColor:'#F2C8D0', paddingHorizontal:16, paddingTop:39, paddingBottom:10 },
  headerTitleRow:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  title:             { color:'#2A1B1F', fontSize:20, fontWeight:'900' },
  sub:               { color:'#765B61', fontSize:10, marginBottom:1 },
  headerIcon:        { width:36, height:36, borderRadius:11, backgroundColor:'#fff', alignItems:'center', justifyContent:'center', elevation:2 },
  content:           { paddingHorizontal:16, paddingTop:7, paddingBottom:16 },
  classPicker:       { backgroundColor:'#fff', minHeight:53, borderRadius:13, padding:10, flexDirection:'row', alignItems:'center', gap:10 },
  classCode:         { backgroundColor:'#DDF0E3', borderRadius:10, paddingHorizontal:8, height:33, alignItems:'center', justifyContent:'center' },
  classCodeText:     { color:'#207A43', fontSize:9, fontWeight:'900' },
  classPickerCopy:   { flex:1 },
  classPickerLabel:  { color:'#806E73', fontSize:9 },
  classPickerTitle:  { color:'#2A1B1F', fontSize:12, fontWeight:'900', marginTop:1 },
  statsRow:          { flexDirection:'row', gap:7, marginTop:10 },
  statusStat:        { flex:1, minHeight:51, borderRadius:11, alignItems:'center', justifyContent:'center' },
  statusStatValue:   { fontSize:14, fontWeight:'900' },
  statusStatLabel:   { fontSize:9, fontWeight:'700', marginTop:2 },
  classRow:          { maxHeight:52, backgroundColor:'#fff', borderBottomWidth:0.5, borderColor:'#eee' },
  classTab:          { paddingHorizontal:16, paddingVertical:12, borderRadius:0, borderBottomWidth:2, borderBottomColor:'transparent' },
  classTabActive:    { borderBottomColor:'#1D9E75' },
  classTabText:      { fontSize:13, color:'#888' },
  classTabTextActive:{ color:'#1D9E75', fontWeight:'600' },
  markAllRow:        { flexDirection:'row', gap:8, marginTop:9 },
  markPresentBtn:    { flex:1, backgroundColor:'#DDF0E3', paddingVertical:10, borderRadius:11, alignItems:'center' },
  markPresentText:   { fontSize:10, color:'#207A43', fontWeight:'900' },
  markAbsentBtn:     { flex:1, backgroundColor:'#fff', paddingVertical:10, borderRadius:11, alignItems:'center' },
  markAbsentText:    { fontSize:10, color:'#6B5157', fontWeight:'900' },
  studentsHeading:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:18, marginBottom:7 },
  studentsTitle:     { color:'#2A1B1F', fontSize:14, fontWeight:'900' },
  studentsCount:     { color:'#806E73', fontSize:10, fontWeight:'700' },
  studentRow:        { backgroundColor:'#fff', borderRadius:12, padding:12, marginBottom:8 },
  studentTop:        { flexDirection:'row', alignItems:'center', gap:10 },
  avatar:            { width:36, height:36, borderRadius:18, backgroundColor:'#DDF0E3', justifyContent:'center', alignItems:'center' },
  avatarText:        { fontSize:11, fontWeight:'900', color:'#207A43' },
  studentName:       { fontSize:12, fontWeight:'900', color:'#2A1B1F' },
  studentId:         { fontSize:9, color:'#806E73', marginTop:2 },
  statusRow:         { flexDirection:'row', gap:3, marginTop:10 },
  statusBtn:         { flex:1, height:30, borderRadius:8, justifyContent:'center', alignItems:'center' },
  statusText:        { fontSize:9, fontWeight:'900' },
  footer:            { padding:16, backgroundColor:'#fff', borderTopWidth:1, borderColor:'#F0DFE2' },
  saveBtn:           { backgroundColor:'#207A43', borderRadius:12, padding:13, alignItems:'center' },
  saveBtnText:       { color:'#fff', fontWeight:'600', fontSize:15 },
});
