// @ts-nocheck
// app/(tabs)/grades.tsx — Student grades screen (fully polished)

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import api from '../../src/api';
import { Colors, Font, Radius, Shadow, HEADER_TOP } from '../../src/theme';
import { useTheme } from '../../src/theme-context';

const QUARTERS = ['1', '2', '3', '4'];
const getQuarterLabel = (quarter, isCollege) => {
  const labels = isCollege ? ['Prelim', 'Midterm', 'Prefinal', 'Final'] : ['Q1', 'Q2', 'Q3', 'Q4'];
  return labels[Number(quarter) - 1] ?? `Q${quarter}`;
};

function getRemark(score, theme, isCollege) {
  if (isCollege) {
    if (score <= 1.5) return { text: 'Outstanding', color: theme.green };
    if (score <= 2) return { text: 'Very Satisfactory', color: theme.primary };
    if (score <= 2.5) return { text: 'Satisfactory', color: theme.textSub };
    if (score <= 3) return { text: 'Fairly Satisfactory', color: theme.warning };
    if (score <= 4) return { text: 'Conditional', color: theme.warning };
    return { text: 'Did Not Meet', color: theme.danger };
  }
  if (score >= 90) return { text: 'Outstanding',         color: theme.green   };
  if (score >= 85) return { text: 'Very Satisfactory',   color: theme.primary };
  if (score >= 80) return { text: 'Satisfactory',        color: theme.textSub };
  if (score >= 75) return { text: 'Fairly Satisfactory', color: theme.warning };
  return               { text: 'Did Not Meet',           color: theme.danger  };
}

export default function Grades() {
  const router    = useRouter();
  const { theme } = useTheme();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeQ, setActiveQ] = useState('4');
  const [view, setView] = useState('current');
  const ACCENT = [theme.green, theme.primary, theme.orange, theme.purple];

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.multiGet(['role', 'position']).then(pairs => {
      const role = pairs[0][1];
      const position = pairs[1][1];
      if (['head_department', 'dean'].includes(position) || ['head_department', 'dean'].includes(role)) {
        router.replace('/(leadership)/dashboard');
        return;
      }
      if (role === 'faculty' || role === 'teacher') {
        router.replace('/(teacher)/grades');
        return;
      }
      Promise.all([
        api.get('/my-grades', { params: { view } }),
        api.get('/dashboard/student'),
      ])
        .then(([gradesRes, dashboardRes]) => {
          if (!cancelled) setData({ ...gradesRes.data, student: dashboardRes.data?.student });
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => { cancelled = true; };
  }, [router, view]);

  if (loading) return (
    <View style={[styles.center, { backgroundColor: theme.bg }]}> 
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );

  const grades    = data?.grades?.[activeQ] ?? [];
  const allGrades = data?.grades ? Object.values(data.grades).flat() : [];
  const isCollege = data?.student?.enrollment?.program_type === 'college';
  const gwa = allGrades.length > 0
    ? (allGrades.reduce((s, g) => s + parseFloat(g.score), 0) / allGrades.length).toFixed(1)
    : '—';

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={{ paddingBottom: 32 }}>

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}> 
        <Text style={styles.title}>My Grades</Text>
        <Text style={styles.sub}>
          {view === 'current'
            ? `${data?.active_term?.semester?.toUpperCase() || ''} Semester · A.Y. ${data?.active_term?.school_year || data?.student?.school_year || ''}`
            : 'Past grade records'}
        </Text>
        <View style={styles.gwaRow}>
          <View>
            <Text style={styles.gwaNum}>{gwa}</Text>
            <Text style={styles.gwaLabel}>General Weighted Average</Text>
          </View>
          <View style={styles.gwaBadge}>
            <Text style={styles.gwaBadgeText}>
              {(isCollege ? parseFloat(gwa) <= 1.5 : parseFloat(gwa) >= 90) ? '🏆 Outstanding'
                : (isCollege ? parseFloat(gwa) <= 2 : parseFloat(gwa) >= 85) ? '⭐ Very Good'
                : (isCollege ? parseFloat(gwa) <= 3 : parseFloat(gwa) >= 80) ? '✅ Good'
                : '📚 Keep going'}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.viewTabs, { borderColor: theme.border, backgroundColor: theme.card }]}>
        {[
          { value: 'current', label: 'Current' },
          { value: 'past', label: 'Past' },
        ].map(option => (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === option.value }}
            style={[styles.viewTab, view === option.value && { backgroundColor: theme.primary }]}
            onPress={() => {
              if (view === option.value) return;
              setLoading(true);
              setView(option.value);
            }}
          >
            <Text style={[styles.viewTabText, { color: view === option.value ? '#fff' : theme.textSub }]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Quarter tabs ── */}
      <View style={styles.tabs}>
        {QUARTERS.map(q => (
          <TouchableOpacity
            key={q}
            style={[styles.tab, activeQ === q && { backgroundColor: theme.primary, borderColor: theme.primary }]}
            onPress={() => setActiveQ(q)}
          >
            <Text style={[styles.tabText, activeQ === q && styles.tabTextActive]}>
              {getQuarterLabel(q, isCollege)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Subject cards ── */}
      <View style={styles.section}>
        {grades.length === 0
          ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No grades for {getQuarterLabel(activeQ, isCollege)} yet.</Text>
            </View>
          )
          : grades.map((g, i) => {
            const collegeGrade = Boolean(g.school_class?.is_college);
            const rem = getRemark(parseFloat(g.score), theme, collegeGrade);
            const pct = collegeGrade
              ? Math.max(5, Math.min(100, ((5 - parseFloat(g.score)) / 4) * 100))
              : Math.max(5, Math.min(100, ((parseFloat(g.score) - 70) / 30) * 100));
            return (
              <View key={i} style={[styles.subjectCard, { backgroundColor: theme.card }]}> 
                <View style={[styles.accentBar, { backgroundColor: ACCENT[i % ACCENT.length] }]} />
                <View style={styles.subjectBody}>
                  <View style={styles.subjectTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subjectName}>{g.school_class?.subject ?? '—'}</Text>
                      {view === 'past' ? (
                        <Text style={[styles.termMeta, { color: theme.textSub }]}>
                          {g.school_class?.semester?.toUpperCase() || 'Past'} Semester · A.Y. {g.school_year}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.score, { color: rem.color }]}>{g.score}</Text>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: theme.border }]}> 
                    <View style={[styles.barFill, {
                      width: `${pct}%`,
                      backgroundColor: ACCENT[i % ACCENT.length],
                    }]} />
                  </View>
                  <Text style={[styles.remark, { color: rem.color }]}>{rem.text}</Text>
                </View>
              </View>
            );
          })
        }
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  header:         {
    backgroundColor: Colors.green,
    paddingTop: HEADER_TOP,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  title:          { color: '#fff', fontSize: Font.xl, fontWeight: '700' },
  sub:            { color: 'rgba(255,255,255,0.7)', fontSize: Font.xs, marginTop: 4 },
  gwaRow:         {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  gwaNum:         { color: '#fff', fontSize: 48, fontWeight: '800', lineHeight: 52 },
  gwaLabel:       { color: 'rgba(255,255,255,0.7)', fontSize: Font.xs, marginTop: 2 },
  gwaBadge:       {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 4,
  },
  gwaBadgeText:   { color: '#fff', fontSize: Font.xs, fontWeight: '600' },
  viewTabs:       { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, marginBottom: 0, borderWidth: 1, borderRadius: Radius.md, padding: 4, gap: 4 },
  viewTab:        { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: Radius.sm },
  viewTabText:    { fontSize: Font.sm, fontWeight: '700' },
  termMeta:       { fontSize: Font.xs, marginTop: 4 },

  tabs:           {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    gap: 8,
    marginBottom: 16,
  },
  tab:            {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  tabText:        { fontSize: Font.sm, color: Colors.textSub, fontWeight: '600' },
  tabTextActive:  { color: '#fff' },

  section:        { paddingHorizontal: 16, gap: 10 },

  subjectCard:    {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.card,
  },
  accentBar:      { width: 5 },
  subjectBody:    { flex: 1, padding: 14 },
  subjectTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  subjectName:    { fontSize: Font.sm, fontWeight: '600', color: Colors.text, flex: 1 },
  score:          { fontSize: Font.xl, fontWeight: '800' },
  barTrack:       { height: 5, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden', marginBottom: 6 },
  barFill:        { height: '100%', borderRadius: Radius.full },
  remark:         { fontSize: Font.xs, fontWeight: '500' },

  emptyCard:      {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 32,
    alignItems: 'center',
    ...Shadow.card,
  },
  emptyIcon:      { fontSize: 40, marginBottom: 10 },
  emptyText:      { fontSize: Font.sm, color: Colors.textMuted, textAlign: 'center' },
});
