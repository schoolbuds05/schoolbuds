// @ts-nocheck
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const activeClassId = selectedClass?.id || classId;
  const activeSubject = selectedClass?.subject || subject;

  useEffect(() => {
    api.get('/teacher/classes').then(res => {
      const list = res.data ?? [];
      setClasses(list);
      if (list.length > 0) {
        setSelectedClass(list.find(item => String(item.id) === String(classId)) ?? list[0]);
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
      setData(current => current ? {
        ...current,
        grade_submissions: {
          ...current.grade_submissions,
          [quarter]: {
            ...current.grade_submissions?.[quarter],
            status: 'chair_review',
            grades,
          },
        },
      } : current);
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
        <View style={styles.headerCopy}>
          <Text style={styles.sub}>{activeSubject}</Text>
          <Text style={styles.title}>Enter grades</Text>
        </View>
        <View style={styles.headerIcon}><Ionicons name="leaf" size={24} color="#65BA35" /></View>
      </View>

      {classes.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.classRow} contentContainerStyle={styles.classRowContent}>
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

      <Text style={styles.gradeHint}>{data?.class?.is_college ? 'Grades run from 1 to 5, where 1 is the highest.' : 'Enter a score from 1 to 100 for each student.'}</Text>
      <ScrollView style={{ flex:1 }} contentContainerStyle={styles.studentList}>
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
  container:       { flex:1, backgroundColor:'#F9E9EC' },
  center:          { flex:1, justifyContent:'center', alignItems:'center', gap:12 },
  noClass:         { fontSize:15, color:'#888' },
  backLink:        { fontSize:14, color:'#378ADD' },
  header:          { minHeight:82, backgroundColor:'#F2C8D0', paddingHorizontal:16, paddingTop:39, paddingBottom:9, flexDirection:'row', alignItems:'center', gap:10 },
  backBtn:         { width:32, height:32, borderRadius:16, backgroundColor:'#FFF', alignItems:'center', justifyContent:'center' },
  backBtnText:     { color:'#745D63', fontSize:11 },
  headerCopy:      { flex:1 },
  title:           { color:'#2A1B1F', fontSize:20, fontWeight:'900', lineHeight:23 },
  sub:             { color:'#765B61', fontSize:10, marginBottom:1 },
  headerIcon:      { width:36, height:36, borderRadius:11, backgroundColor:'#FFF', alignItems:'center', justifyContent:'center', elevation:2 },
  classRow:        { maxHeight:43, marginTop:4 },
  classRowContent: { paddingHorizontal:16, gap:8, alignItems:'center' },
  classTab:        { minWidth:55, paddingHorizontal:12, paddingVertical:8, borderRadius:999, alignItems:'center', backgroundColor:'#FFF' },
  classTabActive:  { backgroundColor:'#B5233D' },
  classTabText:    { fontSize:10, color:'#806E73', fontWeight:'900' },
  classTabTextActive:{ color:'#FFF', fontWeight:'900' },
  quarterRow:      { flexDirection:'row', marginHorizontal:16, marginTop:7, padding:4, gap:0, backgroundColor:'#F0E5E7', borderRadius:12 },
  qBtn:            { flex:1, paddingVertical:9, borderRadius:9, alignItems:'center' },
  qBtnActive:      { backgroundColor:'#FFF' },
  qText:           { fontSize:10, color:'#806E73', fontWeight:'700' },
  qTextActive:     { color:'#B5233D', fontWeight:'900' },
  gradeHint:       { color:'#806E73', fontSize:10, marginHorizontal:16, marginTop:12, marginBottom:6 },
  studentList:     { paddingHorizontal:16, paddingTop:5, paddingBottom:16 },
  studentRow:      { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:'#FFF', borderRadius:12, padding:12, marginBottom:8 },
  avatar:          { width:36, height:36, borderRadius:18, backgroundColor:'#E3EFFD', justifyContent:'center', alignItems:'center' },
  avatarText:      { fontSize:11, fontWeight:'900', color:'#3180DC' },
  studentName:     { fontSize:12, fontWeight:'900', color:'#2A1B1F' },
  studentId:       { fontSize:9, color:'#806E73', marginTop:2 },
  scoreInput:      { width:48, borderWidth:1, borderColor:'#E7DADD', borderRadius:10, padding:9, fontSize:15, fontWeight:'900', textAlign:'center', color:'#2A1B1F', backgroundColor:'#F9F0F2' },
  footer:          { padding:16, backgroundColor:'#FFF', borderTopWidth:1, borderColor:'#F0DFE2' },
  lockedNotice:    { color:'#8a5a00', fontSize:12, fontWeight:'600', marginBottom:10, textAlign:'center' },
  saveBtn:         { backgroundColor:'#B5233D', borderRadius:12, padding:13, alignItems:'center' },
  saveBtnDisabled: { opacity:0.6 },
  saveBtnText:     { color:'#fff', fontWeight:'600', fontSize:15 },
  empty:           { textAlign:'center', color:'#999', fontSize:13, paddingVertical:20 },
});
