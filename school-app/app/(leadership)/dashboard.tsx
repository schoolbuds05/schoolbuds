// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

export default function AcademicLeadershipDashboard() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData((await api.get('/academic-leadership/dashboard')).data);
    } catch (error) {
      console.log('Academic leadership dashboard error:', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('user')
      .then((value) => setUser(value ? JSON.parse(value) : null))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loading) {
    return <View style={[styles.center, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  const summary = data?.summary ?? {};
  const isDean = data?.position === 'dean';
  const title = isDean ? 'Dean' : 'Department Chair';
  const name = user?.name?.trim()?.split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const initials = user?.name?.trim()?.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || (isDean ? 'DN' : 'DC');
  const attendance = summary.attendance_rate == null ? '—' : `${summary.attendance_rate}%`;
  const departmentTeachers = data?.department_teachers ?? [];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: 14 + insets.top }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={[styles.greeting, { color: theme.textSub }]}>{greeting}{name ? `, ${name}` : ''}</Text>
          <Text style={[styles.title, { color: theme.text }]}>{title} overview</Text>
          <Text style={[styles.subtitle, { color: theme.textSub }]} numberOfLines={1}>{data?.department || 'College-wide academic view'}</Text>
        </View>
        <TouchableOpacity
          style={[styles.avatar, { backgroundColor: theme.primaryLight }]}
          onPress={() => router.navigate('/(leadership)/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          activeOpacity={0.8}
        >
          <Text style={[styles.avatarText, { color: theme.primary }]}>{initials}</Text>
        </TouchableOpacity>
      </View>

      {data?.department_type === 'general' && (
        <View style={[styles.infoCard, { backgroundColor: theme.primaryLight }]}>
          <Ionicons name="information-circle-outline" size={19} color={theme.primary} />
          <Text style={[styles.infoText, { color: theme.text }]}>
            General subject departments manage teaching approvals and faculty. Course departments manage sections.
          </Text>
        </View>
      )}

      <View style={styles.stats}>
        <Stat label="Students" value={summary.students ?? 0} icon="people-outline" theme={theme} />
        <Stat label="Sections" value={summary.sections ?? 0} icon="grid-outline" theme={theme} />
        <Stat label="Average" value={summary.average_grade || '—'} icon="trending-up-outline" theme={theme} />
      </View>

      <View style={styles.stats}>
        <Stat label="Attendance today" value={attendance} caption={`${summary.attendance_records_today ?? 0} records`} icon="calendar-outline" theme={theme} />
        <Stat label="Class offerings" value={summary.classes ?? 0} caption={`${summary.faculty ?? 0} assigned faculty`} icon="book-outline" theme={theme} />
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick actions</Text>
      <View style={styles.actions}>
        {data?.can_manage_sections && (
          <Action label="Manage sections" icon="albums-outline" theme={theme} onPress={() => router.push('/(leadership)/sections')} />
        )}
        {!isDean && (
          <Action label="Teaching approvals" icon="checkmark-done-outline" theme={theme} onPress={() => router.push('/(leadership)/teaching-eligibility')} />
        )}
      </View>

      {!isDean && <>
        <SectionHeading title="Department teachers" theme={theme} />
        <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {departmentTeachers.length ? departmentTeachers.map((teacher, index) => (
            <View key={teacher.id} style={[styles.row, { borderColor: theme.border }, index === departmentTeachers.length - 1 && styles.lastRow]}>
              <Avatar initials={getInitials(teacher.name)} theme={theme} />
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>{teacher.name}</Text>
                <Text style={[styles.rowMeta, { color: theme.textSub }]} numberOfLines={1}>{teacher.email || 'No email provided'}</Text>
              </View>
            </View>
          )) : <Empty theme={theme} text="No teachers assigned to this department yet." />}
        </View>
      </>}

      <SectionHeading title="College sections" theme={theme} />
      <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {(data?.sections ?? []).length ? data.sections.map((section, index) => (
          <View key={section.id} style={[styles.row, { borderColor: theme.border }, index === data.sections.length - 1 && styles.lastRow]}>
            <Avatar initials={section.name?.slice(0, 2).toUpperCase() || 'S'} theme={theme} />
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>{section.name}</Text>
              <Text style={[styles.rowMeta, { color: theme.textSub }]} numberOfLines={1}>
                {[section.course, section.year_level ? `Year ${section.year_level}` : null, section.semester].filter(Boolean).join(' · ') || 'Section details unavailable'}
              </Text>
            </View>
            <View style={[styles.countBadge, { backgroundColor: theme.primaryLight }]}>
              <Text style={[styles.countText, { color: theme.primary }]}>{section.enrolled_students_count ?? 0}</Text>
            </View>
          </View>
        )) : <Empty theme={theme} text="No sections are available yet." />}
      </View>

      <SectionHeading title="Recent grade activity" theme={theme} />
      <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {(data?.recent_grades ?? []).length ? data.recent_grades.map((grade, index) => (
          <View key={grade.id ?? index} style={[styles.row, { borderColor: theme.border }, index === data.recent_grades.length - 1 && styles.lastRow]}>
            <Avatar initials={getInitials(`${grade.student?.first_name || ''} ${grade.student?.last_name || ''}`)} theme={theme} />
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>{`${grade.student?.first_name || ''} ${grade.student?.last_name || ''}`.trim() || 'Student'}</Text>
              <Text style={[styles.rowMeta, { color: theme.textSub }]} numberOfLines={1}>{grade.school_class?.subject ?? 'Subject'} · Quarter {grade.quarter}</Text>
            </View>
            <Text style={[styles.grade, { color: gradeColor(grade.score, theme, grade.school_class?.is_college) }]}>{grade.score}</Text>
          </View>
        )) : <Empty theme={theme} text="No grades have been recorded yet." />}
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, caption, icon, theme }) {
  return (
    <View style={[styles.stat, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.statTop}>
        <View style={[styles.statIcon, { backgroundColor: theme.primaryLight }]}><Ionicons name={icon} size={16} color={theme.primary} /></View>
        <Text style={[styles.statLabel, { color: theme.textSub }]} numberOfLines={2}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1}>{value}</Text>
      {caption ? <Text style={[styles.statCaption, { color: theme.textMuted }]} numberOfLines={1}>{caption}</Text> : null}
    </View>
  );
}

function Action({ label, icon, theme, onPress }) {
  return (
    <TouchableOpacity style={[styles.action, { backgroundColor: theme.primary }]} onPress={onPress} activeOpacity={0.82}>
      <Ionicons name={icon} size={19} color="#fff" />
      <Text style={styles.actionText}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color="#fff" />
    </TouchableOpacity>
  );
}

function SectionHeading({ title, theme }) {
  return <Text style={[styles.sectionTitle, styles.listHeading, { color: theme.text }]}>{title}</Text>;
}

function Avatar({ initials, theme }) {
  return <View style={[styles.rowAvatar, { backgroundColor: theme.primaryLight }]}><Text style={[styles.rowAvatarText, { color: theme.primary }]}>{initials || '—'}</Text></View>;
}

function Empty({ theme, text }) {
  return <Text style={[styles.empty, { color: theme.textSub }]}>{text}</Text>;
}

function getInitials(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function gradeColor(score, theme, college) {
  const value = Number(score);
  return college ? (value <= 2 ? theme.success : value <= 3 ? theme.warning : theme.danger) : (value >= 85 ? theme.success : value >= 75 ? theme.warning : theme.danger);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  headingCopy: { flex: 1, paddingRight: 12 },
  greeting: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 21, fontWeight: '900', marginTop: 2 },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  avatar: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '900' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 13 },
  infoText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, minWidth: 0, minHeight: 102, borderWidth: 1, borderRadius: 14, padding: 11 },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statLabel: { flex: 1, fontSize: 10, fontWeight: '800' },
  statValue: { fontSize: 21, fontWeight: '900', marginTop: 9 },
  statCaption: { fontSize: 9, fontWeight: '600', marginTop: 3 },
  sectionTitle: { fontSize: 15, fontWeight: '900' },
  listHeading: { marginTop: 7, marginBottom: -4 },
  actions: { gap: 8 },
  action: { minHeight: 48, borderRadius: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionText: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '900' },
  panel: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  lastRow: { borderBottomWidth: 0 },
  rowAvatar: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowAvatarText: { fontSize: 11, fontWeight: '900' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 12, fontWeight: '800' },
  rowMeta: { fontSize: 10, fontWeight: '600', marginTop: 3 },
  countBadge: { minWidth: 30, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { fontSize: 12, fontWeight: '900' },
  grade: { fontSize: 16, fontWeight: '900' },
  empty: { fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: 18 },
});
