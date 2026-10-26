// @ts-nocheck
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { removeToken, resolveApiAssetUrl } from '../../../src/api';
import { useTheme } from '../../../src/theme-context';

const ACADEMIC_ITEMS = [
  { name: 'schedule', label: 'Class schedule', icon: 'calendar-outline' }, { name: 'study-load', label: 'Study load', icon: 'briefcase-outline' },
  { name: 'assignments', label: 'Assignments', icon: 'document-text-outline' }, { name: 'grades', label: 'Grades', icon: 'bar-chart-outline' },
];
const CAMPUS_ITEMS = [{ name: 'rewards', label: 'Rewards', icon: 'gift-outline' }, { name: 'market', label: 'Marketplace', icon: 'bag-handle-outline' }];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const todayName = DAY_NAMES[new Date().getDay()];
const hasClassToday = subject => { const day = String(subject?.day || '').toLowerCase(); return day.includes(todayName.toLowerCase()) || day.split(/[^a-z]+/).includes(todayName.slice(0, 3).toLowerCase()); };

export default function More() {
  const router = useRouter();
  const { theme, reloadTheme } = useTheme();
  const [dashboard, setDashboard] = useState(null); const [subjects, setSubjects] = useState([]); const [assignments, setAssignments] = useState([]); const [rewardSummary, setRewardSummary] = useState(null); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { const [dashboardRes, subjectsRes, assignmentsRes, rewardsRes] = await Promise.all([api.get('/dashboard/student'), api.get('/my-subjects', { params: { view: 'current' } }), api.get('/assignments'), api.get('/rewards/me')]); setDashboard(dashboardRes.data); setSubjects(subjectsRes.data?.subjects ?? []); setAssignments(assignmentsRes.data ?? []); setRewardSummary(rewardsRes.data?.summary ?? null); }
    catch (error) { console.log('More screen error:', error.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const details = useMemo(() => ({ student: dashboard?.student || {}, todayClasses: subjects.filter(hasClassToday).length, units: subjects.reduce((total, subject) => total + Number(subject.units_lec || 0) + Number(subject.units_lab || 0), 0), openAssignments: assignments.filter(item => !['submitted', 'graded'].includes(item?.submission?.status) && !item?.submission?.submitted_at).length, rewardLevel: rewardSummary?.level ?? 1 }), [assignments, dashboard, rewardSummary, subjects]);
  const meta = { schedule: `${details.todayClasses} today`, 'study-load': `${details.units} units`, assignments: `${details.openAssignments} open`, grades: '', rewards: `Level ${details.rewardLevel}`, market: '' };
  const studentName = [details.student?.first_name, details.student?.last_name].filter(Boolean).join(' ') || 'Student';
  const initials = `${details.student?.first_name?.[0] || ''}${details.student?.last_name?.[0] || ''}`.toUpperCase() || 'S';
  const photo = resolveApiAssetUrl(details.student?.profile_photo_url || dashboard?.user?.profile_photo_url);
  const logout = () => Alert.alert('Log out', 'Are you sure you want to log out?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: async () => { await api.post('/logout').catch(() => {}); await AsyncStorage.multiRemove(['token', 'role', 'position', 'user']); removeToken(); await reloadTheme(); router.replace('/login'); } }]);
  const item = (entry, last) => <TouchableOpacity key={entry.name} style={[s.row, !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]} onPress={() => router.push(`/(tabs)/more/${entry.name}`)}><View style={[s.icon, { backgroundColor: theme.primaryLight }]}><Ionicons name={entry.icon} size={18} color={theme.primary} /></View><Text style={[s.label, { color: theme.text }]}>{entry.label}</Text>{!!meta[entry.name] && <Text style={[s.meta, { color: theme.textSub }]}>{meta[entry.name]}</Text>}<Ionicons name="chevron-forward" size={17} color={theme.textMuted} /></TouchableOpacity>;
  return <ScrollView style={[s.container, { backgroundColor: theme.bg }]} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}>
    <Text style={[s.title, { color: theme.text }]}>More</Text>
    <TouchableOpacity style={[s.profile, { backgroundColor: theme.card }]} onPress={() => router.push('/(tabs)/more/profile')}><View style={[s.avatar, { backgroundColor: theme.primary }]}>{photo ? <Image source={{ uri: photo }} style={s.image} /> : <Text style={s.initials}>{initials}</Text>}</View><View style={s.profileCopy}><Text style={[s.name, { color: theme.text }]}>{studentName}</Text><Text style={[s.id, { color: theme.textSub }]}>{details.student?.student_id || 'Student account'}</Text></View><Ionicons name="chevron-forward" size={18} color={theme.textMuted} /></TouchableOpacity>
    {loading && <ActivityIndicator style={s.loader} color={theme.primary} />}<Text style={[s.section, { color: theme.textSub }]}>Academics</Text><View style={[s.group, { backgroundColor: theme.card }]}>{ACADEMIC_ITEMS.map((entry, index) => item(entry, index === ACADEMIC_ITEMS.length - 1))}</View><Text style={[s.section, { color: theme.textSub }]}>Campus</Text><View style={[s.group, { backgroundColor: theme.card }]}>{CAMPUS_ITEMS.map((entry, index) => item(entry, index === CAMPUS_ITEMS.length - 1))}</View><TouchableOpacity style={[s.logout, { backgroundColor: theme.card, borderColor: theme.danger }]} onPress={logout}><Ionicons name="log-out-outline" size={18} color={theme.danger} /><Text style={[s.logoutText, { color: theme.danger }]}>Log out</Text></TouchableOpacity>
  </ScrollView>;
}
const s = StyleSheet.create({ container: { flex: 1 }, content: { padding: 16, paddingTop: 42, paddingBottom: 28 }, title: { fontSize: 22, fontWeight: '800', marginBottom: 12 }, profile: { height: 72, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 16 }, avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }, image: { width: '100%', height: '100%' }, initials: { color: '#fff', fontSize: 17, fontWeight: '800' }, profileCopy: { flex: 1, marginLeft: 10 }, name: { fontSize: 14, fontWeight: '800' }, id: { fontSize: 11, fontWeight: '600', marginTop: 2 }, loader: { marginBottom: 4 }, section: { fontSize: 11, fontWeight: '700', marginBottom: 6 }, group: { borderRadius: 14, overflow: 'hidden', marginBottom: 15 }, row: { minHeight: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }, icon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, label: { flex: 1, fontSize: 13, fontWeight: '700', marginLeft: 12 }, meta: { fontSize: 10, fontWeight: '700', marginRight: 8 }, logout: { height: 40, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, logoutText: { fontSize: 13, fontWeight: '800' } });
