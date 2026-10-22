// @ts-nocheck
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { removeToken } from '../../src/api';
import { useTheme } from '../../src/theme-context';

const ACADEMIC_ITEMS = [
  { name: 'schedule', label: 'Class schedule', icon: 'calendar-outline' },
  { name: 'study-load', label: 'Study load', icon: 'briefcase-outline' },
  { name: 'assignments', label: 'Assignments', icon: 'document-text-outline' },
  { name: 'grades', label: 'Grades', icon: 'bar-chart-outline' },
];
const CAMPUS_ITEMS = [
  { name: 'rewards', label: 'Rewards', icon: 'gift-outline' },
  { name: 'market', label: 'Marketplace', icon: 'bag-handle-outline' },
];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const todayName = DAY_NAMES[new Date().getDay()];

function hasClassToday(subject) {
  const day = String(subject?.day || '').toLowerCase();
  const short = todayName.slice(0, 3).toLowerCase();
  return day.includes(todayName.toLowerCase()) || day.split(/[^a-z]+/).includes(short);
}

export default function More() {
  const router = useRouter();
  const { theme, reloadTheme } = useTheme();
  const [dashboard, setDashboard] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [rewardSummary, setRewardSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dashboardRes, subjectsRes, assignmentsRes, rewardsRes] = await Promise.all([
        api.get('/dashboard/student'),
        api.get('/my-subjects', { params: { view: 'current' } }),
        api.get('/assignments'),
        api.get('/rewards/me'),
      ]);
      setDashboard(dashboardRes.data);
      setSubjects(subjectsRes.data?.subjects ?? []);
      setAssignments(assignmentsRes.data ?? []);
      setRewardSummary(rewardsRes.data?.summary ?? null);
    } catch (error) {
      console.log('More screen error:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const details = useMemo(() => {
    const student = dashboard?.student || {};
    const units = subjects.reduce((total, subject) => total + Number(subject.units_lec || 0) + Number(subject.units_lab || 0), 0);
    const openAssignments = assignments.filter(item => !['submitted', 'graded'].includes(item?.submission?.status) && !item?.submission?.submitted_at).length;
    return { student, todayClasses: subjects.filter(hasClassToday).length, units, openAssignments, rewardLevel: rewardSummary?.level ?? 1 };
  }, [assignments, dashboard, rewardSummary, subjects]);

  const metaByRoute = {
    schedule: `${details.todayClasses} today`,
    'study-load': `${details.units} units`,
    assignments: `${details.openAssignments} open`,
    grades: '',
    rewards: `Level ${details.rewardLevel}`,
    market: '',
  };
  const initials = `${details.student?.first_name?.[0] || ''}${details.student?.last_name?.[0] || ''}`.toUpperCase() || 'S';
  const studentName = [details.student?.first_name, details.student?.last_name].filter(Boolean).join(' ') || 'Student';

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => {
        await api.post('/logout').catch(() => {});
        await AsyncStorage.multiRemove(['token', 'role', 'position', 'user']);
        removeToken();
        await reloadTheme();
        router.replace('/login');
      } },
    ]);
  };

  const renderItem = (item, isLast) => (
    <TouchableOpacity key={item.name} style={[styles.menuItem, !isLast && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]} onPress={() => router.push(`/(tabs)/${item.name}`)} activeOpacity={0.7}>
      <View style={[styles.iconWrap, { backgroundColor: theme.primaryLight }]}><Ionicons name={item.icon} size={18} color={theme.primary} /></View>
      <Text style={[styles.itemLabel, { color: theme.text }]}>{item.label}</Text>
      {!!metaByRoute[item.name] && <Text style={[styles.itemMeta, { color: theme.textSub }]}>{metaByRoute[item.name]}</Text>}
      <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}>
      <Text style={[styles.title, { color: theme.text }]}>More</Text>
      <TouchableOpacity style={[styles.profileCard, { backgroundColor: theme.card }]} onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.75}>
        <View style={[styles.avatar, { backgroundColor: theme.primary, borderColor: '#FFF1BF' }]}><Text style={styles.avatarText}>{initials}</Text></View>
        <View style={styles.profileCopy}><Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>{studentName}</Text><Text style={[styles.studentId, { color: theme.textSub }]} numberOfLines={1}>{details.student?.student_id || 'Student account'}</Text></View>
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      </TouchableOpacity>
      {loading ? <ActivityIndicator style={styles.loader} color={theme.primary} /> : null}
      <Text style={[styles.sectionLabel, { color: theme.textSub }]}>Academics</Text>
      <View style={[styles.group, { backgroundColor: theme.card }]}>{ACADEMIC_ITEMS.map((item, index) => renderItem(item, index === ACADEMIC_ITEMS.length - 1))}</View>
      <Text style={[styles.sectionLabel, { color: theme.textSub }]}>Campus</Text>
      <View style={[styles.group, { backgroundColor: theme.card }]}>{CAMPUS_ITEMS.map((item, index) => renderItem(item, index === CAMPUS_ITEMS.length - 1))}</View>
      <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: theme.card, borderColor: theme.danger }]} onPress={handleLogout} activeOpacity={0.75}><Ionicons name="log-out-outline" size={18} color={theme.danger} /><Text style={[styles.logoutText, { color: theme.danger }]}>Log out</Text></TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: 16, paddingTop: 42, paddingBottom: 28 }, title: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  profileCard: { height: 72, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, justifyContent: 'center', alignItems: 'center' }, avatarText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  profileCopy: { flex: 1, marginLeft: 10 }, studentName: { fontSize: 14, fontWeight: '800' }, studentId: { fontSize: 11, fontWeight: '600', marginTop: 2 }, loader: { marginBottom: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6 }, group: { borderRadius: 14, overflow: 'hidden', marginBottom: 15 },
  menuItem: { minHeight: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }, iconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { flex: 1, fontSize: 13, fontWeight: '700', marginLeft: 12 }, itemMeta: { fontSize: 10, fontWeight: '700', marginRight: 8 },
  logoutBtn: { height: 40, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: -1 }, logoutText: { fontSize: 13, fontWeight: '800' },
});
