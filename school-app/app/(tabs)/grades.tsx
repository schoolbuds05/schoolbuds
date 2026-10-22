// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

const QUARTERS = ['1', '2', '3', '4'];
const quarterLabel = (quarter, college) => (college ? ['Prelim', 'Midterm', 'Prefinal', 'Final'] : ['Q1', 'Q2', 'Q3', 'Q4'])[Number(quarter) - 1] || `Q${quarter}`;
const subjectCode = (grade) => grade.school_class?.subject_code || grade.school_class?.code || String(grade.school_class?.subject || 'SUBJ').split(/\s+/).map(word => word[0]).join('').slice(0, 7).toUpperCase();

export default function Grades() {
  const router = useRouter();
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeQ, setActiveQ] = useState('1');
  const [view, setView] = useState('current');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.multiGet(['role', 'position']).then(pairs => {
      const role = pairs[0][1]; const position = pairs[1][1];
      if (['head_department', 'dean'].includes(position) || ['head_department', 'dean'].includes(role)) return router.replace('/(leadership)/dashboard');
      if (['faculty', 'teacher'].includes(role)) return router.replace('/(teacher)/grades');
      Promise.all([api.get('/my-grades', { params: { view } }), api.get('/dashboard/student')]).then(([gradesRes, dashboardRes]) => {
        if (!cancelled) setData({ ...gradesRes.data, student: dashboardRes.data?.student });
      }).finally(() => { if (!cancelled) setLoading(false); });
    });
    return () => { cancelled = true; };
  }, [router, view]);

  const isCollege = data?.student?.enrollment?.program_type === 'college';
  const grades = data?.grades?.[activeQ] ?? [];
  const totalSubjects = useMemo(() => Math.max(0, ...Object.values(data?.grades || {}).map(list => list.length)), [data?.grades]);
  const gwa = grades.length ? (grades.reduce((sum, grade) => sum + Number(grade.score || 0), 0) / grades.length).toFixed(2) : '—';
  const term = data?.active_term;
  const termLabel = view === 'past' ? 'Past grade records' : term ? `${term.semester?.replace(/^./, char => char.toUpperCase()) || ''} Semester · A.Y. ${term.school_year || ''}` : `A.Y. ${data?.student?.school_year || ''}`;
  const highest = grades.length ? (isCollege ? Math.min(...grades.map(g => Number(g.score))) : Math.max(...grades.map(g => Number(g.score)))) : null;

  if (loading) return <View style={[styles.center, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color={theme.primary} /></View>;

  return <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}>
      <TouchableOpacity style={[styles.back, { backgroundColor: theme.card }]} onPress={() => router.back()}><Ionicons name="chevron-back" size={22} color={theme.text} /></TouchableOpacity>
      <View style={styles.headerCopy}><Text style={[styles.term, { color: theme.textSub }]}>{termLabel}</Text><Text style={[styles.title, { color: theme.text }]}>Grades</Text></View>
      <View style={[styles.logoWrap, { backgroundColor: theme.card }]}><Image source={require('../../assets/images/schoolbuds-favicon.png')} style={styles.logo} resizeMode="contain" /></View>
    </View>
    <View style={[styles.quarterTabs, { backgroundColor: theme.primaryLight }]}>{QUARTERS.map(q => <TouchableOpacity key={q} style={[styles.quarterTab, activeQ === q && { backgroundColor: theme.card }]} onPress={() => setActiveQ(q)}><Text style={[styles.quarterText, { color: activeQ === q ? theme.text : theme.textSub }]}>{quarterLabel(q, isCollege)}</Text></TouchableOpacity>)}</View>
    <View style={[styles.gwaCard, { backgroundColor: theme.primary }]}>
      <View><Text style={styles.gwaLabel}>{quarterLabel(activeQ, isCollege)} GWA</Text><Text style={styles.gwa}>{gwa}</Text></View>
      <View style={styles.gwaCopy}><Text style={styles.gwaDescription}>{grades.length} of {totalSubjects || grades.length} subjects posted.</Text><Text style={styles.gwaDescription}>{highest === null ? 'Grades will appear once posted.' : `${highest.toFixed(2)} is the ${isCollege ? 'highest' : 'top'} grade.`}</Text></View>
    </View>
    <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: theme.text }]}>By subject</Text><Text style={[styles.sectionMeta, { color: theme.textSub }]}>{quarterLabel(activeQ, isCollege)}</Text></View>
    {grades.length ? <View style={[styles.gradeGroup, { backgroundColor: theme.card }]}>{grades.map((grade, index) => <GradeRow key={grade.id || index} grade={grade} isLast={index === grades.length - 1} college={isCollege} theme={theme} />)}</View> : <View style={[styles.emptyCard, { backgroundColor: theme.card }]}><Text style={[styles.emptyTitle, { color: theme.text }]}>No grades posted yet</Text><Text style={[styles.emptyText, { color: theme.textSub }]}>Your teacher will post grades here when they are ready.</Text></View>}
    {totalSubjects > grades.length && <Text style={[styles.waiting, { color: theme.textSub }]}>{totalSubjects - grades.length} subject{totalSubjects - grades.length === 1 ? '' : 's'} are waiting for teachers to post grades.</Text>}
    <TouchableOpacity style={styles.pastLink} onPress={() => { setLoading(true); setView(view === 'current' ? 'past' : 'current'); }}><Text style={[styles.pastLinkText, { color: theme.primary }]}>{view === 'current' ? 'View past grade records' : 'View current grades'}</Text></TouchableOpacity>
  </ScrollView>;
}

function GradeRow({ grade, isLast, college, theme }) {
  const score = Number(grade.score || 0);
  const good = college ? score <= 2 : score >= 80;
  const caution = college ? score > 2 && score <= 3 : score >= 75 && score < 80;
  const color = good ? theme.green : caution ? theme.warning : theme.danger;
  const percent = college ? Math.max(5, Math.min(100, ((5 - score) / 4) * 100)) : Math.max(5, Math.min(100, ((score - 70) / 30) * 100));
  return <View style={[styles.gradeRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}><View style={[styles.codePill, { backgroundColor: theme.primaryLight }]}><Text style={[styles.codeText, { color: theme.primary }]} numberOfLines={1}>{subjectCode(grade)}</Text></View><View style={styles.gradeCopy}><Text style={[styles.subjectName, { color: theme.text }]} numberOfLines={2}>{grade.school_class?.subject || 'Subject'}</Text><View style={[styles.track, { backgroundColor: theme.border }]}><View style={[styles.fill, { backgroundColor: color, width: `${percent}%` }]} /></View></View><Text style={[styles.score, { color }]}>{score.toFixed(2)}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: 16, paddingTop: 28, paddingBottom: 30 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 }, back: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 }, headerCopy: { flex: 1 }, term: { fontSize: 10, fontWeight: '600', marginBottom: 1 }, title: { fontSize: 22, fontWeight: '800' }, logoWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, logo: { width: 31, height: 31, borderRadius: 8 },
  quarterTabs: { height: 36, borderRadius: 11, padding: 3, flexDirection: 'row', marginBottom: 12 }, quarterTab: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8 }, quarterText: { fontSize: 10, fontWeight: '800' },
  gwaCard: { minHeight: 96, borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }, gwaLabel: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '800' }, gwa: { color: '#fff', fontSize: 34, fontWeight: '900', lineHeight: 40 }, gwaCopy: { flex: 1, marginLeft: 22 }, gwaDescription: { color: '#fff', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 8 }, sectionTitle: { fontSize: 14, fontWeight: '800' }, sectionMeta: { fontSize: 10, fontWeight: '700' },
  gradeGroup: { borderRadius: 14, overflow: 'hidden' }, gradeRow: { minHeight: 61, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }, codePill: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 }, codeText: { fontSize: 8, fontWeight: '900' }, gradeCopy: { flex: 1, minWidth: 0 }, subjectName: { fontSize: 12, fontWeight: '800', lineHeight: 16 }, track: { height: 4, borderRadius: 2, marginTop: 7, overflow: 'hidden', marginRight: 8 }, fill: { height: '100%', borderRadius: 2 }, score: { width: 43, textAlign: 'right', fontSize: 15, fontWeight: '900' },
  emptyCard: { padding: 22, borderRadius: 14, alignItems: 'center' }, emptyTitle: { fontSize: 14, fontWeight: '800' }, emptyText: { fontSize: 11, marginTop: 5, textAlign: 'center' }, waiting: { fontSize: 10, marginTop: 10, marginLeft: 4 }, pastLink: { alignItems: 'center', padding: 14 }, pastLinkText: { fontSize: 11, fontWeight: '800' },
});
