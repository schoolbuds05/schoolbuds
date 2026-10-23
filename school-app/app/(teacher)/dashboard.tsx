// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';
import { formatRoleAndPosition } from '../../src/user-labels';

export default function TeacherDashboard() {
  const router = useRouter(); const { theme } = useTheme(); const [data, setData] = useState(null); const [user, setUser] = useState(null); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'short' }); const [selectedDay, setSelectedDay] = useState(currentDay);
  const load = useCallback(async () => { try { setData((await api.get('/teacher/dashboard')).data); } catch (e) { console.log(e.message); } finally { setLoading(false); setRefreshing(false); } }, []);
  useEffect(() => {
    AsyncStorage.getItem('user')
      .then(value => { if (value) setUser(JSON.parse(value)); })
      .catch(error => console.log('Teacher account load error:', error.message));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  const classes = useMemo(() => data?.classes ?? [], [data?.classes]); const grades = data?.recent_grades ?? [];
  const selectedClasses = useMemo(() => classes.map(item => {
    const meetings = Array.isArray(item.meetings) ? item.meetings : [];
    if (!meetings.length) {
      const day = item.day || item.weekday || item.day_of_week || item.schedule;
      return dayMatches(day, selectedDay) ? item : null;
    }
    const matching = meetings.filter(meeting => dayMatches(meeting.day, selectedDay));
    if (!matching.length) return null;
    const rooms = [...new Map(matching.map(meeting => [String(meeting.room || '').trim().toLowerCase(), String(meeting.room || '').trim()]).filter(([key]) => key)).values()];
    return { ...item, day: selectedDay, schedule: matching.map(meeting => `${meeting.time_start || 'Time TBA'}${meeting.time_end ? `-${meeting.time_end}` : ''}`).join(' · '), room: rooms.join(', ') || item.room };
  }).filter(Boolean), [classes, selectedDay]);
  const next = selectedClasses.find(item => item.schedule && item.schedule !== 'No schedule') ?? selectedClasses[0] ?? null;
  if (loading) return <View style={[styles.center, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const teacherName = user?.name || data?.teacher || 'Teacher';
  const teacherRole = formatRoleAndPosition(user, 'Teacher');
  return <View style={[styles.container, { backgroundColor: theme.bg }]}><ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flex: 1 }}><Text style={[styles.date, { color: theme.textSub }]}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text><Text style={[styles.greeting, { color: theme.text }]}>Good morning, {teacherName}</Text><Text style={[styles.accountRole, { color: theme.textSub }]}>{teacherRole}</Text></View><View style={{ width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginLeft: 10, backgroundColor: theme.card }}><Image source={require('../../assets/images/schoolbuds-favicon.png')} style={{ width: 30, height: 30 }} resizeMode="contain" accessibilityLabel="SchoolBuds logo" /></View></View>
    <View style={styles.days}>{days.map(day => <TouchableOpacity key={day} style={[styles.day, { backgroundColor: day === selectedDay ? theme.primary : theme.card }]} onPress={() => setSelectedDay(day)}><Text style={{ color: day === selectedDay ? '#fff' : theme.textSub, fontWeight: '800', fontSize: 11 }}>{day}</Text>{day === selectedDay && <View style={styles.dot} />}</TouchableOpacity>)}</View>
    <View style={[styles.next, { backgroundColor: theme.primary }]}><View style={{ flex: 1 }}><Text style={styles.nextEyebrow}>Next class · {selectedDay}</Text><Text style={styles.nextTitle}>{next?.subject || 'No class scheduled'}</Text><Text style={styles.nextMeta}>{next ? `${next.schedule || 'No schedule'} · ${next.room || 'No room'}` : 'Check your classes'}</Text></View><TouchableOpacity style={styles.attendance} onPress={() => next && router.push({ pathname: '/(teacher)/attendance', params: { classId: String(next.id), subject: next.subject } })}><Text style={{ color: theme.primary, fontWeight: '900', fontSize: 12 }}>Attendance</Text></TouchableOpacity></View>
    <View style={styles.stats}>{[['Classes', data?.total_classes ?? classes.length], ['Students', data?.total_students ?? 0], ['Today', data?.today_attendance ?? 0]].map(([label, value]) => <View key={label} style={[styles.stat, { backgroundColor: theme.card }]}><Text style={[styles.statValue, { color: theme.text }]}>{value}</Text><Text style={[styles.statLabel, { color: theme.textSub }]}>{label}</Text></View>)}</View>
    <View style={styles.quick}>{<Quick icon="calendar-outline" label="Attendance" value="Mark today" color={theme.success} bg={theme.successLight} onPress={() => router.push('/(teacher)/attendance')} />}<Quick icon="briefcase-outline" label="Assignment" value="Make new" color={theme.danger} bg={theme.dangerLight} onPress={() => router.push('/(teacher)/assignments')} /><Quick icon="book-outline" label="Grades" value="Enter scores" color={theme.warning} bg={theme.warningLight} onPress={() => router.push('/(teacher)/grades')} /><Quick icon="chatbubble-outline" label="Chat" value="Questions" color={theme.purple} bg={theme.purpleLight} onPress={() => router.push('/(teacher)/chat')} /></View>
    <View style={styles.section}><Text style={[styles.sectionTitle, { color: theme.text }]}>Recent grades</Text><TouchableOpacity onPress={() => router.push('/(teacher)/grades')}><Text style={[styles.link, { color: theme.primary }]}>View grades</Text></TouchableOpacity></View>
    <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>{grades.length ? grades.slice(0, 3).map((grade, i) => <View key={grade.id ?? i} style={[styles.grade, { borderColor: theme.border }]}><View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}><Text style={{ color: theme.primary, fontWeight: '900' }}>{grade.student?.first_name?.[0]}{grade.student?.last_name?.[0]}</Text></View><View style={{ flex: 1 }}><Text style={[styles.gradeName, { color: theme.text }]}>{grade.student?.first_name} {grade.student?.last_name}</Text><Text style={[styles.gradeMeta, { color: theme.textMuted }]}>{grade.school_class?.subject ?? 'Subject'} · Q{grade.quarter}</Text></View><Text style={[styles.score, { color: gradeColor(grade.score, theme, grade.school_class?.is_college) }]}>{grade.score}</Text></View>) : <Text style={[styles.empty, { color: theme.textSub }]}>No grades entered yet.</Text>}</View>
  </ScrollView></View>;
}
function dayMatches(value, selected) {
  const daysByShortName = {
    mon: ['mon', 'monday'],
    tue: ['tue', 'tues', 'tuesday'],
    wed: ['wed', 'wednesday'],
    thu: ['thu', 'thur', 'thurs', 'thursday'],
    fri: ['fri', 'friday'],
    sat: ['sat', 'saturday'],
    sun: ['sun', 'sunday'],
  };
  const selectedKey = selected.toLowerCase().slice(0, 3);
  const aliases = daysByShortName[selectedKey];
  if (!aliases) return false;

  const tokens = String(value || '').toLowerCase().match(/[a-z]+/g) || [];
  const compactDays = { m: 'mon', t: 'tue', w: 'wed', r: 'thu', f: 'fri', s: 'sat', u: 'sun' };
  return tokens.some(token => {
    if (aliases.includes(token)) return true;
    if (['tth', 'tr', 'tuth', 'tueth'].includes(token)) return ['tue', 'thu'].includes(selectedKey);
    if (/^[mtwrfsu]+$/.test(token)) return [...token].some(day => compactDays[day] === selectedKey);
    return false;
  });
}
function Quick({ icon, label, value, color, bg, onPress }) { return <TouchableOpacity style={[styles.quickCard, { backgroundColor: bg }]} onPress={onPress}><Ionicons name={icon} size={18} color={color} /><Text style={[styles.quickLabel, { color }]}>{label}</Text><Text style={[styles.quickValue, { color }]}>{value}</Text></TouchableOpacity>; }
function gradeColor(score, theme, college) { const value = Number(score); return college ? (value <= 2 ? theme.success : value <= 3 ? theme.warning : theme.danger) : (value >= 85 ? theme.success : value >= 75 ? theme.warning : theme.danger); }
const styles = StyleSheet.create({ container: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, body: { padding: 20, paddingTop: 28, paddingBottom: 110, gap: 10 }, date: { fontSize: 12, fontWeight: '600' }, greeting: { fontSize: 22, fontWeight: '900', marginTop: -4 }, accountRole: { fontSize: 12, fontWeight: '700', marginTop: 2 }, days: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 }, day: { width: 43, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FDE047', marginTop: 3 }, next: { borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'center' }, nextEyebrow: { color: '#fff', fontSize: 11, fontWeight: '800' }, nextTitle: { color: '#fff', fontSize: 15, fontWeight: '900', marginTop: 4 }, nextMeta: { color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 2 }, attendance: { backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10 }, stats: { flexDirection: 'row', gap: 10 }, stat: { flex: 1, borderRadius: 13, padding: 10 }, statValue: { fontSize: 20, fontWeight: '900' }, statLabel: { fontSize: 10, fontWeight: '700' }, quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, quickCard: { width: '48%', minHeight: 68, borderRadius: 14, padding: 12 }, quickLabel: { fontSize: 13, fontWeight: '900', marginTop: 3 }, quickValue: { fontSize: 10, fontWeight: '700' }, section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { fontSize: 15, fontWeight: '900' }, link: { fontSize: 11, fontWeight: '900' }, panel: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12 }, grade: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 }, avatar: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, gradeName: { fontSize: 13, fontWeight: '800' }, gradeMeta: { fontSize: 10, marginTop: 2 }, score: { fontSize: 17, fontWeight: '900' }, empty: { fontSize: 13, textAlign: 'center', paddingVertical: 14 } });
