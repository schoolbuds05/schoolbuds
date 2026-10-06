// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import HeaderGradient from '../components/ui/HeaderGradient';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

export default function ParentDashboard() {
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/parent');
      setData(res.data);
    } catch (e) {
      console.log('Parent dashboard error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const children = data?.children ?? [];

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <HeaderGradient
        title="Parent Portal"
        subtitle="Grades, attendance, fees, and points for linked students."
        initials="PA"
        stats={[
          { label: 'Children', value: children.length, accent: '#C7D2FE' },
          { label: 'Alerts', value: 0, accent: '#FDE68A' },
        ]}
      />
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {children.length === 0 ? (
            <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[s.title, { color: theme.text }]}>No linked students</Text>
              <Text style={[s.sub, { color: theme.textSub }]}>Ask an administrator to link this parent account to a student profile.</Text>
            </View>
          ) : children.map((child, index) => {
            const section = child.student?.section && child.student.section !== 'TBA'
              ? child.student.section
              : 'No section';

            return (
              <View key={child.student?.id ?? index} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[s.title, { color: theme.text }]}>{child.student?.first_name} {child.student?.last_name}</Text>
                <Text style={[s.sub, { color: theme.textSub }]}>
                  {child.student?.student_id} - Grade/Year {child.student?.grade_level || '-'} - {section}
                </Text>
                <View style={s.grid}>
                  <Metric label="Attendance" value={`${child.attendance_pct ?? 0}%`} theme={theme} />
                  <Metric label="Balance" value={`PHP ${Number(child.fee_summary?.balance || 0).toFixed(2)}`} theme={theme} />
                  <Metric label="Points" value={child.reward_summary?.points ?? 0} theme={theme} />
                  <Metric label="Point value" value={`PHP ${Number(child.reward_summary?.peso_value || 0).toFixed(2)}`} theme={theme} />
                </View>
                <GradesList grades={child.grades} theme={theme} />
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function GradesList({ grades, theme }) {
  const quarters = Object.entries(grades || {})
    .map(([quarter, items]) => [quarter, Array.isArray(items) ? items : Object.values(items || {})])
    .filter(([, items]) => items.length > 0);

  return (
    <View style={s.gradesBlock}>
      <Text style={[s.sectionTitle, { color: theme.text }]}>Grades</Text>
      {quarters.length === 0 ? (
        <Text style={[s.emptyText, { color: theme.textSub }]}>No grades recorded yet.</Text>
      ) : quarters.map(([quarter, items]) => (
        <View key={quarter} style={s.quarterBlock}>
          <Text style={[s.quarterTitle, { color: theme.textSub }]}>Quarter {quarter}</Text>
          {items.map((grade, index) => (
            <View key={grade.id ?? `${quarter}-${index}`} style={[s.gradeRow, { borderColor: theme.border }]}>
              <View style={s.gradeInfo}>
                <Text style={[s.gradeSubject, { color: theme.text }]} numberOfLines={1}>
                  {grade.school_class?.subject || grade.subject || 'Subject'}
                </Text>
                {!!grade.remarks && (
                  <Text style={[s.gradeRemarks, { color: theme.textSub }]} numberOfLines={1}>
                    {grade.remarks}
                  </Text>
                )}
              </View>
              <Text style={[s.gradeScore, { color: scoreColor(Number(grade.score || 0), grade.school_class?.is_college) }]}>
                {grade.score ?? '-'}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function Metric({ label, value, theme }) {
  return (
    <View style={[s.metric, { backgroundColor: theme.bg }]}>
      <Text style={[s.metricValue, { color: theme.text }]}>{value}</Text>
      <Text style={[s.metricLabel, { color: theme.textSub }]}>{label}</Text>
    </View>
  );
}

function scoreColor(score, isCollege) {
  if (isCollege) {
    if (score <= 2) return '#047857';
    if (score <= 3) return '#2563EB';
    return '#DC2626';
  }
  if (score >= 90) return '#047857';
  if (score >= 75) return '#2563EB';
  return '#DC2626';
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 16, gap: 12, paddingBottom: 90 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  title: { fontSize: 17, fontWeight: '900' },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 4, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  metric: { width: '47%', borderRadius: 12, padding: 12 },
  metricValue: { fontSize: 16, fontWeight: '900' },
  metricLabel: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  gradesBlock: { marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '900', marginBottom: 8 },
  emptyText: { fontSize: 12, fontWeight: '600' },
  quarterBlock: { marginTop: 8 },
  quarterTitle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 },
  gradeRow: { minHeight: 50, borderTopWidth: 1, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  gradeInfo: { flex: 1, minWidth: 0 },
  gradeSubject: { fontSize: 13, fontWeight: '800' },
  gradeRemarks: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  gradeScore: { minWidth: 44, textAlign: 'right', fontSize: 18, fontWeight: '900' },
});
