// @ts-nocheck
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import api from '../../src/api';

const QUARTERS = ['1','2','3','4'];
const getQuarterLabel = (quarter, isCollege) => {
  const labels = isCollege ? ['Prelim', 'Midterm', 'Prefinal', 'Final'] : ['Q1', 'Q2', 'Q3', 'Q4'];
  return labels[Number(quarter) - 1] ?? `Q${quarter}`;
};

export default function TeacherGrades() {
  const { classId, subject } = useLocalSearchParams();
  const router = useRouter();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [quarter, setQuarter] = useState('1');
  const [scores, setScores]   = useState({});
  const activeClassId = classId || selectedClass?.id;
  const activeSubject = subject || selectedClass?.subject;

  useEffect(() => {
    if (classId) return;

    api.get('/teacher/classes').then(res => {
      const list = res.data ?? [];
      setClasses(list);
      if (list.length > 0) {
        setSelectedClass(list[0]);
      } else {
        setLoading(false);
      }
    }).catch(e => {
      console.log('Teacher classes error:', e.message);
      setLoading(false);
    });
  }, [classId]);

  useEffect(() => {
    if (!activeClassId) { setLoading(false); return; }
    setLoading(true);
    api.get(`/teacher/class/${activeClassId}/students`).then(res => {
      setData(res.data);
      const initial = {};
      res.data.students.forEach(s => {
        const submission = res.data.grade_submissions?.['1'];
        const submittedGrade = submission?.grades?.find(g => Number(g.student_id) === Number(s.id));
        const officialGrade = res.data.grades[s.id]?.find(g => g.quarter === '1');
        initial[s.id] = (submittedGrade?.score ?? officialGrade?.score)?.toString() ?? '';
      });
      setScores(initial);
    }).catch(e => console.log('Error:', e.message))
    .finally(() => setLoading(false));
  }, [activeClassId]);

  useEffect(() => {
    if (!data) return;
    const updated = {};
    data.students.forEach(s => {
      const submission = data.grade_submissions?.[quarter];
      const submittedGrade = submission?.grades?.find(g => Number(g.student_id) === Number(s.id));
      const officialGrade = data.grades[s.id]?.find(g => g.quarter === quarter);
      updated[s.id] = (submittedGrade?.score ?? officialGrade?.score)?.toString() ?? '';
    });
    setScores(updated);
  }, [quarter, data]);

  const save = async () => {
    setSaving(true);
    try {
      const grades = data.students
        .map(s => ({
          student_id: s.id,
          quarter,
          score: scores[s.id] === '' ? null : parseFloat(scores[s.id]),
        }));

      const maxScore = data.class?.is_college ? 5 : 100;
      const invalidCollegeIncrement = data.class?.is_college && grades.some(g => g.score !== null && Math.abs((g.score * 4) - Math.round(g.score * 4)) > 0.00001);
      if (grades.some(g => g.score === null || g.score < 1 || g.score > maxScore) || invalidCollegeIncrement) {
        Alert.alert('Complete the grade sheet', data.class?.is_college
          ? 'Enter a quarter-step college grade from 1.00 to 5.00 for every student. 1.00 is highest.'
          : 'Enter a score from 1 to 100 for every student.');
        return;
      }

      await api.post(`/teacher/class/${activeClassId}/grades`, { grades });
      Alert.alert('Submitted', `Grades for ${getQuarterLabel(quarter, data?.class?.is_college)} were submitted to the Department Chair.`);
    } catch (e) {
      Alert.alert('Error', 'Could not save grades. Please try again.');
      console.log(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!activeClassId) return (
    <View style={styles.center}>
      <Text style={styles.noClass}>No class selected</Text>
      <TouchableOpacity onPress={() => router.push('/(teacher)/classes')}>
        <Text style={styles.backLink}>← Go to Classes</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#378ADD"/>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Classes</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Enter grades {data?.class?.is_college ? '(1-5, 1 highest)' : '(1-100)'}</Text>
        <Text style={styles.sub}>{activeSubject}</Text>
      </View>

      {classes.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.classRow} contentContainerStyle={{ paddingHorizontal:12, gap:8 }}>
          {classes.map(cls => (
            <TouchableOpacity
              key={String(cls.id)}
              style={[styles.classTab, String(selectedClass?.id) === String(cls.id) && styles.classTabActive]}
              onPress={() => setSelectedClass(cls)}
            >
              <Text style={[styles.classTabText, String(selectedClass?.id) === String(cls.id) && styles.classTabTextActive]}>
                {cls.subject?.split(' ')[0] || 'Class'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.quarterRow}>
        {QUARTERS.map(q => (
          <TouchableOpacity key={q}
            style={[styles.qBtn, quarter === q && styles.qBtnActive]}
            onPress={() => setQuarter(q)}>
            <Text style={[styles.qText, quarter === q && styles.qTextActive]}>{getQuarterLabel(q, data?.class?.is_college)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16 }}>
        {data?.students?.length === 0 && (
          <Text style={styles.empty}>No students found for this class.</Text>
        )}
        {data?.students?.map((s, i) => (
          <View key={i} style={styles.studentRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {s.first_name[0]}{s.last_name[0]}
              </Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={styles.studentName}>{s.first_name} {s.last_name}</Text>
              <Text style={styles.studentId}>{s.student_id} · {s.reward_points ?? 0} pts</Text>
            </View>
            <TextInput
              style={styles.scoreInput}
              value={scores[s.id] ?? ''}
              onChangeText={val => setScores(prev => ({ ...prev, [s.id]: val }))}
              keyboardType="numeric"
              placeholder="—"
              placeholderTextColor="#ccc"
              editable={!data?.grade_submissions?.[quarter] || ['draft', 'teacher_revision'].includes(data.grade_submissions[quarter].status)}
              maxLength={5}/>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {data?.grade_submissions?.[quarter] && !['draft', 'teacher_revision'].includes(data.grade_submissions[quarter].status) && (
          <Text style={styles.lockedNotice}>Submitted for approval. Grade entry is locked while it is under review.</Text>
        )}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={save}
          disabled={saving || (data?.grade_submissions?.[quarter] && !['draft', 'teacher_revision'].includes(data.grade_submissions[quarter].status))}>
          {saving
            ? <ActivityIndicator color="#fff"/>
            : <Text style={styles.saveBtnText}>Submit {getQuarterLabel(quarter, data?.class?.is_college)} grades to Chair</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex:1, backgroundColor:'#f5f5f5' },
  center:          { flex:1, justifyContent:'center', alignItems:'center', gap:12 },
  noClass:         { fontSize:15, color:'#888' },
  backLink:        { fontSize:14, color:'#378ADD' },
  header:          { backgroundColor:'#378ADD', padding:20, paddingTop:52 },
  backBtn:         { marginBottom:8 },
  backBtnText:     { color:'rgba(255,255,255,0.8)', fontSize:13 },
  title:           { color:'#fff', fontSize:20, fontWeight:'600' },
  sub:             { color:'rgba(255,255,255,0.8)', fontSize:13, marginTop:3 },
  classRow:        { maxHeight:52, backgroundColor:'#fff', borderBottomWidth:0.5, borderColor:'#eee' },
  classTab:        { paddingHorizontal:16, paddingVertical:12, borderBottomWidth:2, borderBottomColor:'transparent' },
  classTabActive:  { borderBottomColor:'#378ADD' },
  classTabText:    { fontSize:13, color:'#888' },
  classTabTextActive:{ color:'#378ADD', fontWeight:'600' },
  quarterRow:      { flexDirection:'row', padding:12, gap:8, backgroundColor:'#fff', borderBottomWidth:0.5, borderColor:'#eee' },
  qBtn:            { flex:1, paddingVertical:8, borderRadius:10, alignItems:'center', backgroundColor:'#f5f5f5' },
  qBtnActive:      { backgroundColor:'#378ADD' },
  qText:           { fontSize:13, color:'#888', fontWeight:'500' },
  qTextActive:     { color:'#fff' },
  studentRow:      { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:'#fff', borderRadius:12, padding:12, marginBottom:8 },
  avatar:          { width:40, height:40, borderRadius:20, backgroundColor:'#E6F1FB', justifyContent:'center', alignItems:'center' },
  avatarText:      { fontSize:14, fontWeight:'600', color:'#378ADD' },
  studentName:     { fontSize:14, fontWeight:'500', color:'#333' },
  studentId:       { fontSize:11, color:'#999', marginTop:1 },
  scoreInput:      { width:64, borderWidth:0.5, borderColor:'#ddd', borderRadius:10, padding:10, fontSize:16, textAlign:'center', color:'#333', backgroundColor:'#fafafa' },
  footer:          { padding:16, backgroundColor:'#fff', borderTopWidth:0.5, borderColor:'#eee' },
  lockedNotice:    { color:'#8a5a00', fontSize:12, fontWeight:'600', marginBottom:10, textAlign:'center' },
  saveBtn:         { backgroundColor:'#378ADD', borderRadius:12, padding:15, alignItems:'center' },
  saveBtnDisabled: { opacity:0.6 },
  saveBtnText:     { color:'#fff', fontWeight:'600', fontSize:15 },
  empty:           { textAlign:'center', color:'#999', fontSize:13, paddingVertical:20 },
});
