// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import HeaderGradient from '../components/ui/HeaderGradient';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

export default function AcademicLeadershipDashboard() {
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData((await api.get('/academic-leadership/dashboard')).data); }
    catch (error) { console.log('Academic leadership dashboard error:', error.response?.data?.message || error.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <View style={[s.center, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color={theme.primary} /></View>;

  const summary = data?.summary ?? {};
  const isDean = data?.position === 'dean';
  const title = isDean ? 'Dean' : 'Department Chair';
  const attendance = summary.attendance_rate == null ? '—' : `${summary.attendance_rate}%`;
  const departmentTeachers = data?.department_teachers ?? [];
  return <View style={[s.container, { backgroundColor: theme.bg }]}>
    <HeaderGradient title="Academic Overview" subtitle={`${title}${data?.department ? ` · ${data.department}` : ' · College-wide'}`} initials={isDean ? 'DN' : 'DC'} stats={[{ label: 'Students', value: summary.students ?? 0, accent: '#A7F3D0' }, { label: 'Sections', value: summary.sections ?? 0, accent: '#FDE68A' }, { label: 'Average', value: summary.average_grade || '—', accent: '#C7D2FE' }]} />
    <ScrollView contentContainerStyle={s.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <Text style={[s.note, { color: theme.textSub }]}>{isDean ? 'College-wide academic performance and activity.' : 'Academic performance for your assigned department/program.'} This portal is read-only.</Text>
      <View style={s.metrics}>
        <Metric label="Attendance today" value={attendance} detail={`${summary.attendance_records_today ?? 0} records`} theme={theme} color={theme.success} />
        <Metric label="Class offerings" value={summary.classes ?? 0} detail={`${summary.faculty ?? 0} assigned faculty`} theme={theme} color={theme.purple} />
      </View>
      {!isDean && <>
        <Text style={[s.heading, { color: theme.text }]}>Department teachers</Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {(departmentTeachers ?? []).length ? departmentTeachers.map((teacher) => <View key={teacher.id} style={[s.row, { borderColor: theme.border }]}><View style={[s.icon, { backgroundColor: theme.primaryLight }]}><Text style={{ color: theme.primary, fontWeight: '900' }}>{teacher.name?.split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'T'}</Text></View><View style={{ flex: 1 }}><Text style={[s.name, { color: theme.text }]}>{teacher.name}</Text><Text style={[s.meta, { color: theme.textSub }]}>{teacher.email || 'No email provided'}</Text></View></View>) : <Empty theme={theme} text="No teachers assigned to this department yet." />}
        </View>
      </>}
      <Text style={[s.heading, { color: theme.text }]}>College sections</Text>
      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {(data?.sections ?? []).length ? data.sections.map(section => <View key={section.id} style={[s.row, { borderColor: theme.border }]}><View style={[s.icon, { backgroundColor: theme.primaryLight }]}><Text style={{ color: theme.primary, fontWeight: '900' }}>{section.name?.slice(0, 2).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={[s.name, { color: theme.text }]}>{section.name}</Text><Text style={[s.meta, { color: theme.textSub }]}>{[section.course, section.year_level ? `Year ${section.year_level}` : null, section.semester].filter(Boolean).join(' · ')}</Text></View><Text style={[s.count, { color: theme.primary }]}>{section.enrolled_students_count ?? 0}</Text></View>) : <Empty theme={theme} text="No college sections are available yet." />}
      </View>
      <Text style={[s.heading, { color: theme.text }]}>Recent grade activity</Text>
      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {(data?.recent_grades ?? []).length ? data.recent_grades.map((grade, i) => <View key={grade.id ?? i} style={[s.row, { borderColor: theme.border }]}><View style={{ flex: 1 }}><Text style={[s.name, { color: theme.text }]}>{grade.student?.first_name} {grade.student?.last_name}</Text><Text style={[s.meta, { color: theme.textSub }]}>{grade.school_class?.subject ?? 'Subject'} · Q{grade.quarter}</Text></View><Text style={[s.grade, { color: grade.school_class?.is_college ? (Number(grade.score) <= 3 ? theme.success : theme.danger) : (Number(grade.score) >= 75 ? theme.success : theme.danger) }]}>{grade.score}</Text></View>) : <Empty theme={theme} text="No grades have been recorded yet." />}
      </View>
    </ScrollView>
  </View>;
}

function Metric({ label, value, detail, theme, color }) { return <View style={[s.metric, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={[s.metricLabel, { color: theme.textSub }]}>{label}</Text><Text style={[s.metricValue, { color }]}>{value}</Text><Text style={[s.metricDetail, { color: theme.textMuted }]}>{detail}</Text></View>; }
function Empty({ theme, text }) { return <Text style={[s.empty, { color: theme.textSub }]}>{text}</Text>; }
const s = StyleSheet.create({ container: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, body: { padding: 16, paddingBottom: 110 }, note: { fontSize: 12, fontWeight: '600', lineHeight: 18, marginBottom: 14 }, metrics: { flexDirection: 'row', gap: 10 }, metric: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14 }, metricLabel: { fontSize: 11, fontWeight: '800' }, metricValue: { fontSize: 24, fontWeight: '900', marginTop: 8 }, metricDetail: { fontSize: 11, fontWeight: '600', marginTop: 4 }, heading: { fontSize: 16, fontWeight: '900', marginTop: 22, marginBottom: 10 }, card: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1 }, icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, name: { fontSize: 13, fontWeight: '800' }, meta: { fontSize: 11, fontWeight: '600', marginTop: 3 }, count: { fontSize: 17, fontWeight: '900' }, grade: { fontSize: 18, fontWeight: '900' }, empty: { fontSize: 13, fontWeight: '600', textAlign: 'center', paddingVertical: 18 } });
