// @ts-nocheck
// app/(teacher)/dashboard.tsx - Teacher overview dashboard

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import HeaderGradient from '../components/ui/HeaderGradient';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

export default function TeacherDashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await api.get('/teacher/dashboard');
      setData(res.data);
    } catch (error) {
      console.log('Teacher dashboard error:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const classes = useMemo(() => data?.classes ?? [], [data?.classes]);
  const recentGrades = data?.recent_grades ?? [];

  const nextClass = useMemo(() => {
    return classes.find(item => item.schedule && item.schedule !== 'No schedule') ?? classes[0];
  }, [classes]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <HeaderGradient
        title="Dashboard"
        subtitle={`Welcome back, ${data?.teacher ?? 'Teacher'}`}
        initials="TD"
        stats={[
          { label: 'Classes', value: data?.total_classes ?? 0, accent: '#A7F3D0' },
          { label: 'Students', value: data?.total_students ?? 0, accent: '#FDE68A' },
          { label: 'Today', value: data?.today_attendance ?? 0, accent: '#C7D2FE' },
        ]}
      />

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadDashboard();
            }}
          />
        }
      >
        <View style={styles.quickGrid}>
          <QuickAction
            label="Classes"
            value={`${classes.length} assigned`}
            color={theme.primary}
            bg={theme.primaryLight}
            onPress={() => router.push('/(teacher)/classes')}
          />
          <QuickAction
            label="Attendance"
            value="Mark today"
            color={theme.success}
            bg={theme.successLight}
            onPress={() => router.push('/(teacher)/attendance')}
          />
          <QuickAction
            label="Grades"
            value="Enter scores"
            color={theme.orange}
            bg={theme.orangeLight}
            onPress={() => router.push('/(teacher)/grades')}
          />
          <QuickAction
            label="Chat"
            value="Student questions"
            color={theme.purple}
            bg={theme.purpleLight}
            onPress={() => router.push('/(teacher)/chat')}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Today At A Glance</Text>
        </View>

        <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {nextClass ? (
            <>
              <Text style={[styles.panelEyebrow, { color: theme.textMuted }]}>Next class</Text>
              <Text style={[styles.panelTitle, { color: theme.text }]}>{nextClass.subject}</Text>
              <Text style={[styles.panelMeta, { color: theme.textSub }]}>
                {formatClassMeta(nextClass)}
              </Text>
              <View style={styles.panelActions}>
                <TouchableOpacity
                  style={[styles.panelBtn, { backgroundColor: theme.primaryLight }]}
                  onPress={() => router.push({
                    pathname: '/(teacher)/attendance',
                    params: { classId: String(nextClass.id), subject: nextClass.subject },
                  })}
                >
                  <Text style={[styles.panelBtnText, { color: theme.primary }]}>Attendance</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.panelBtn, { backgroundColor: theme.primaryLight }]}
                  onPress={() => router.push({
                    pathname: '/(teacher)/grades',
                    params: { classId: String(nextClass.id), subject: nextClass.subject },
                  })}
                >
                  <Text style={[styles.panelBtnText, { color: theme.primary }]}>Grades</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={[styles.emptyText, { color: theme.textSub }]}>No classes assigned yet.</Text>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Grades</Text>
          <TouchableOpacity onPress={() => router.push('/(teacher)/grades')}>
            <Text style={[styles.sectionLink, { color: theme.primary }]}>View grades</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {recentGrades.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSub }]}>No grades entered yet.</Text>
          ) : (
            recentGrades.map((grade, index) => (
              <View key={grade.id ?? index} style={[styles.gradeRow, { borderColor: theme.border }]}>
                <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
                  <Text style={[styles.avatarText, { color: theme.primary }]}>
                    {grade.student?.first_name?.[0]}{grade.student?.last_name?.[0]}
                  </Text>
                </View>
                <View style={styles.gradeInfo}>
                  <Text style={[styles.gradeName, { color: theme.text }]}>
                    {grade.student?.first_name} {grade.student?.last_name}
                  </Text>
                  <Text style={[styles.gradeMeta, { color: theme.textMuted }]}>
                    {grade.school_class?.subject ?? 'Subject'} • Q{grade.quarter}
                  </Text>
                </View>
                <Text style={[styles.gradeScore, { color: gradeColor(grade.score, theme, grade.school_class?.is_college) }]}>
                  {grade.score}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function QuickAction({ label, value, color, bg, onPress }) {
  return (
    <TouchableOpacity style={[styles.quickCard, { backgroundColor: bg }]} onPress={onPress}>
      <Text style={[styles.quickLabel, { color }]}>{label}</Text>
      <Text style={[styles.quickValue, { color }]}>{value}</Text>
    </TouchableOpacity>
  );
}

function formatClassMeta(item) {
  const level = item.course ? `Year ${item.grade_level}` : `Grade ${item.grade_level}`;
  return `${level} • ${item.section || 'No section'} • ${item.room || 'No room'} • ${item.schedule || 'No schedule'}`;
}

function gradeColor(score, theme, isCollege) {
  const value = Number(score);
  if (isCollege) {
    if (value <= 2) return theme.success;
    if (value <= 3) return theme.warning;
    return theme.danger;
  }
  if (value >= 85) return theme.success;
  if (value >= 75) return theme.warning;
  return theme.danger;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, paddingBottom: 110, gap: 14 },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 14,
    padding: 14,
    minHeight: 78,
    justifyContent: 'space-between',
  },
  quickLabel: { fontSize: 14, fontWeight: '900' },
  quickValue: { fontSize: 12, fontWeight: '700', marginTop: 12 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  sectionLink: { fontSize: 12, fontWeight: '800' },
  panel: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  panelEyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  panelTitle: { fontSize: 16, fontWeight: '900', marginTop: 6 },
  panelMeta: { fontSize: 12, fontWeight: '600', marginTop: 4, lineHeight: 18 },
  panelActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  panelBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  panelBtnText: { fontSize: 12, fontWeight: '900' },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '900' },
  gradeInfo: { flex: 1 },
  gradeName: { fontSize: 13, fontWeight: '800' },
  gradeMeta: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  gradeScore: { fontSize: 18, fontWeight: '900' },
  emptyText: { fontSize: 13, fontWeight: '600', textAlign: 'center', paddingVertical: 12 },
});
