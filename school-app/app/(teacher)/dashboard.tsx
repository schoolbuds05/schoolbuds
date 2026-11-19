// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { label, date: date.getDate(), key: label };
  });
  const teacherName = user?.name || data?.teacher || 'Teacher';
  const teacherRole = formatRoleAndPosition(user, 'Teacher');
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const selectedOffset = (['Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(selectedDay) - ((today.getDay() + 6) % 7) + 7) % 7;
  const nextLabel = new Date(today.getFullYear(), today.getMonth(), today.getDate() + selectedOffset).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return <View style={styles.container}><ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
    <View style={styles.top}><View style={styles.topCopy}><Text style={styles.date}>{today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text><Text style={styles.greeting}>{greeting}, {teacherName}</Text><Text style={styles.accountRole}>{teacherRole}</Text></View><View style={styles.brand}><Text style={styles.brandText}>SB</Text></View></View>
    <View style={styles.days}>{days.map(day => <TouchableOpacity key={day.key} style={[styles.day, day.key === selectedDay && styles.dayActive]} onPress={() => setSelectedDay(day.key)}><Text style={[styles.dayName, day.key === selectedDay && styles.dayTextActive]}>{day.label}</Text><Text style={[styles.dayNumber, day.key === selectedDay && styles.dayTextActive]}>{day.date}</Text></TouchableOpacity>)}</View>
    <View style={styles.next}><View style={styles.nextTop}><Text style={styles.nextEyebrow}>NEXT CLASS · {nextLabel.toUpperCase()}</Text>{next && <Text style={styles.countdown}>Next up</Text>}</View><Text style={styles.nextTitle}>{next?.subject || 'No class scheduled'}</Text><View style={styles.nextBottom}><View style={styles.nextDetails}><View style={styles.detailLine}><Ionicons name="time-outline" size={17} color="#fff"/><Text style={styles.nextMeta}>{next ? next.schedule || 'Time TBA' : 'Check your classes'}</Text></View><View style={styles.detailLine}><Ionicons name="location-outline" size={17} color="#fff"/><Text style={styles.nextMeta}>{next?.room || 'No room'}</Text></View></View><TouchableOpacity style={styles.attendance} onPress={() => next && router.push({ pathname: '/(teacher)/attendance', params: { classId: String(next.id), subject: next.subject } })}><Text style={styles.attendanceText}>Attendance</Text></TouchableOpacity></View></View>
    <View style={styles.stats}>{[['Classes', data?.total_classes ?? classes.length], ['Students', data?.total_students ?? 0], ['Today', data?.today_attendance ?? 0]].map(([label, value]) => <View key={label} style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}</View>
    <View style={styles.quick}><Quick icon="checkmark" label="Attendance" value="Mark today" color="#197845" bg="#E2F3E9" onPress={() => router.push('/(teacher)/attendance')} /><Quick icon="add" label="Assignment" value="Make new" color="#B31D3C" bg="#FBE3E8" onPress={() => router.push('/(teacher)/assignments')} /><Quick icon="book-outline" label="Grades" value="Enter scores" color="#956400" bg="#FFF0C2" onPress={() => router.push('/(teacher)/grades')} /><Quick icon="chatbubble-outline" label="Chat" value="Questions" color="#6540A4" bg="#EEE7FB" onPress={() => router.push('/(teacher)/chat')} /></View>
    <View style={styles.section}><Text style={styles.sectionTitle}>Recent grades</Text><TouchableOpacity onPress={() => router.push('/(teacher)/grades')}><Text style={styles.link}>View all</Text></TouchableOpacity></View>
    <View style={styles.panel}>{grades.length ? grades.slice(0, 3).map((grade, i) => <View key={grade.id ?? i} style={styles.grade}><View style={styles.avatar}><Text style={{ color: '#B5233D', fontWeight: '900' }}>{grade.student?.first_name?.[0]}{grade.student?.last_name?.[0]}</Text></View><View style={{ flex: 1 }}><Text style={styles.gradeName}>{grade.student?.first_name} {grade.student?.last_name}</Text><Text style={styles.gradeMeta}>{grade.school_class?.subject ?? 'Subject'} · Q{grade.quarter}</Text></View><Text style={[styles.score, { color: gradeColor(grade.score, theme, grade.school_class?.is_college) }]}>{grade.score}</Text></View>) : <View style={styles.emptyRow}><View><Text style={styles.emptyTitle}>No grades yet</Text><Text style={styles.empty}>Scores you enter will show up here.</Text></View><TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(teacher)/grades')}><Text style={styles.emptyButtonText}>Enter scores</Text></TouchableOpacity></View>}</View>
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
function Quick({ icon, label, value, color, bg, onPress }) { return <TouchableOpacity style={[styles.quickCard, { backgroundColor: bg }]} onPress={onPress}><View style={styles.quickIcon}><Ionicons name={icon} size={21} color={color} /></View><View><Text style={[styles.quickLabel, { color }]}>{label}</Text><Text style={[styles.quickValue, { color }]}>{value}</Text></View></TouchableOpacity>; }
function gradeColor(score, theme, college) { const value = Number(score); return college ? (value <= 2 ? theme.success : value <= 3 ? theme.warning : theme.danger) : (value >= 85 ? theme.success : value >= 75 ? theme.warning : theme.danger); }
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#FFF5F5' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, body: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 110, gap: 12 }, top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }, topCopy: { flex: 1 }, brand: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginLeft: 10, backgroundColor: '#fff', shadowColor: '#4B1822', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, brandText: { color: '#B5233D', fontWeight: '900', fontSize: 18 }, date: { color: '#7A666B', fontSize: 14, fontWeight: '700' }, greeting: { color: '#2A151B', fontSize: 25, fontWeight: '900', marginTop: 4 }, accountRole: { color: '#7A666B', fontSize: 14, fontWeight: '600', marginTop: 3 }, days: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 }, day: { flex: 1, height: 68, marginHorizontal: 3, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }, dayActive: { backgroundColor: '#B5233D' }, dayName: { color: '#7A666B', fontSize: 12, fontWeight: '700' }, dayNumber: { color: '#2A151B', fontSize: 17, fontWeight: '900', marginTop: 2 }, dayTextActive: { color: '#fff' }, next: { backgroundColor: '#B5233D', borderRadius: 24, padding: 18, minHeight: 174, justifyContent: 'space-between' }, nextTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, nextEyebrow: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 }, countdown: { color: '#fff', backgroundColor: '#C74B64', overflow: 'hidden', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6, fontSize: 11, fontWeight: '800' }, nextTitle: { color: '#fff', fontSize: 21, fontWeight: '900', lineHeight: 26, marginTop: 10 }, nextBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }, nextDetails: { flex: 1, gap: 5 }, detailLine: { flexDirection: 'row', alignItems: 'center', gap: 6 }, nextMeta: { color: '#fff', fontSize: 12, fontWeight: '700' }, attendance: { backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 17, paddingVertical: 11, marginLeft: 8 }, attendanceText: { color: '#B5233D', fontWeight: '900', fontSize: 12 }, stats: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 24, paddingVertical: 12, marginTop: 1 }, stat: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: '#F0DADD' }, statValue: { color: '#2A151B', fontSize: 24, fontWeight: '900' }, statLabel: { color: '#7A666B', fontSize: 12, fontWeight: '700', marginTop: 1 }, quick: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginTop: 1 }, quickCard: { width: '48.5%', minHeight: 80, borderRadius: 22, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 }, quickIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, quickLabel: { fontSize: 14, fontWeight: '900' }, quickValue: { fontSize: 11, fontWeight: '600', marginTop: 2 }, section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }, sectionTitle: { color: '#2A151B', fontSize: 18, fontWeight: '900' }, link: { color: '#B5233D', fontSize: 13, fontWeight: '900' }, panel: { backgroundColor: '#fff', borderRadius: 22, padding: 16 }, grade: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F0DADD' }, avatar: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9E4E8' }, gradeName: { color: '#2A151B', fontSize: 13, fontWeight: '800' }, gradeMeta: { color: '#7A666B', fontSize: 10, marginTop: 2 }, score: { fontSize: 17, fontWeight: '900' }, emptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 80 }, emptyTitle: { color: '#2A151B', fontSize: 15, fontWeight: '800' }, empty: { color: '#7A666B', fontSize: 12, marginTop: 3 }, emptyButton: { backgroundColor: '#FBE3E8', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 11 }, emptyButtonText: { color: '#B5233D', fontSize: 12, fontWeight: '900' } });
