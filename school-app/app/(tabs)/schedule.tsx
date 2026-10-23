// @ts-nocheck
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ALIASES = { monday: 'Monday', mon: 'Monday', mo: 'Monday', m: 'Monday', tuesday: 'Tuesday', tue: 'Tuesday', tues: 'Tuesday', tu: 'Tuesday', t: 'Tuesday', wednesday: 'Wednesday', wed: 'Wednesday', we: 'Wednesday', w: 'Wednesday', thursday: 'Thursday', thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', th: 'Thursday', r: 'Thursday', friday: 'Friday', fri: 'Friday', f: 'Friday', saturday: 'Saturday', sat: 'Saturday', sa: 'Saturday' };
const currentDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
const currentDay = DAYS.includes(currentDayName) ? currentDayName : 'Monday';

function daysForSubject(value) {
  const tokens = String(value || '').toLowerCase().match(/[a-z]+/g) || [];
  const values = tokens.flatMap(token => {
    if (token === 'tth' || token === 'tr' || token === 'tuth' || token === 'tueth') return ['Tuesday', 'Thursday'];
    if (DAY_ALIASES[token]) return [DAY_ALIASES[token]];
    return /^[mtwrfs]{2,6}$/.test(token) ? [...token].map(letter => DAY_ALIASES[letter]).filter(Boolean) : [];
  });
  return [...new Set(values)];
}
function parseTimeMinutes(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const second = Number(match[3] || 0);
  const suffix = match[4]?.toLowerCase();
  if (minute > 59 || second > 59) return null;
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    if (suffix === 'pm' && hour < 12) hour += 12;
    if (suffix === 'am' && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  return hour * 60 + minute;
}
function timeSortValue(subject) {
  return parseTimeMinutes(subject.time_start) ?? Number.MAX_SAFE_INTEGER;
}
function formatTime12(value) {
  if (!value) return '';
  const totalMinutes = parseTimeMinutes(value);
  if (totalMinutes === null) return String(value);
  const hour24 = Math.floor(totalMinutes / 60);
  const hour12 = hour24 % 12 || 12;
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hour12}:${minutes} ${hour24 >= 12 ? 'PM' : 'AM'}`;
}
function timeFor(subject) { return subject.time_start || subject.time_end ? `${formatTime12(subject.time_start) || 'Time TBA'}${subject.time_end ? `–${formatTime12(subject.time_end)}` : ''}` : 'Time TBA'; }

export default function StudentSchedule() {
  const { theme } = useTheme();
  const [subjects, setSubjects] = useState([]);
  const [activeTerm, setActiveTerm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(currentDay);
  const [loadError, setLoadError] = useState('');

  const loadSchedule = useCallback(async () => {
    try {
      const response = await api.get('/my-subjects', { params: { view: 'current' } });
      setSubjects(response.data?.subjects ?? []);
      setActiveTerm(response.data?.active_term ?? null);
      setLoadError('');
    } catch (error) {
      setLoadError(error.response?.data?.message || 'Could not load your class schedule. Pull down to try again.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { loadSchedule(); }, [loadSchedule]));

  const groups = useMemo(() => {
    const byDay = new Map(DAYS.map(day => [day, []]));
    const unscheduled = [];
    subjects.forEach(subject => {
      const days = daysForSubject(subject.day);
      if (!days.length) unscheduled.push(subject);
      else days.forEach(day => byDay.get(day)?.push(subject));
    });
    byDay.forEach(items => items.sort((a, b) => timeSortValue(a) - timeSortValue(b)));
    return { byDay, unscheduled: unscheduled.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))) };
  }, [subjects]);
  const selectedClasses = groups.byDay.get(selectedDay) || [];
  const termLabel = activeTerm ? `${activeTerm.semester?.replace(/^./, char => char.toUpperCase()) || ''} Semester · A.Y. ${activeTerm.school_year || ''}` : 'Current term';

  return <View style={[styles.container, { backgroundColor: theme.bg }]}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSchedule(); }} tintColor={theme.primary} />}>
      <View style={styles.header}><View><Text style={[styles.term, { color: theme.textSub }]}>{termLabel}</Text><Text style={[styles.title, { color: theme.text }]}>Class Schedule</Text></View><View style={[styles.logoWrap, { backgroundColor: theme.card }]}><Image source={require('../../assets/images/schoolbuds-favicon.png')} style={styles.logo} resizeMode="contain" /></View></View>
      <View style={styles.dayTabs}>{DAYS.map(day => <TouchableOpacity key={day} style={[styles.dayTab, { backgroundColor: selectedDay === day ? theme.primary : theme.card }]} onPress={() => setSelectedDay(day)}><Text style={[styles.dayName, { color: selectedDay === day ? '#fff' : theme.textSub }]}>{day.slice(0, 3)}</Text>{selectedDay === day && <View style={styles.dayDot} />}</TouchableOpacity>)}</View>
      {loading ? <View style={styles.loading}><ActivityIndicator size="large" color={theme.primary} /></View> : loadError ? <Message title="Schedule unavailable" detail={loadError} theme={theme} /> : subjects.length === 0 ? <Message title="No classes to show" detail="Your enrolled classes will appear here once class times are assigned." theme={theme} /> : <>
        <Section title={selectedDay} count={selectedClasses.length} theme={theme} />
        {selectedClasses.length ? selectedClasses.map((subject, index) => <ClassCard key={`${subject.id || subject.subject_id}-${index}`} subject={subject} theme={theme} />) : <Text style={[styles.noClasses, { color: theme.textSub }]}>No scheduled classes for this day.</Text>}
        <Section title="To be confirmed" count={groups.unscheduled.length} theme={theme} />
        {groups.unscheduled.length ? <View style={[styles.tbaGroup, { backgroundColor: theme.card }]}>{groups.unscheduled.map((subject, index) => <TbaRow key={`${subject.id || subject.subject_id}-${index}`} subject={subject} isLast={index === groups.unscheduled.length - 1} theme={theme} />)}</View> : <Text style={[styles.noClasses, { color: theme.textSub }]}>All enrolled subjects have a class time.</Text>}
      </>}
    </ScrollView>
  </View>;
}

function Section({ title, count, theme }) { return <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text><Text style={[styles.sectionCount, { color: theme.textSub }]}>{count} {count === 1 ? 'class' : 'classes'}</Text></View>; }
function ClassCard({ subject, theme }) {
  const [start, end] = timeFor(subject).split('–');
  return <View style={styles.scheduledRow}><View style={styles.timeCol}><Text style={[styles.startTime, { color: theme.text }]}>{start}</Text>{end && <Text style={[styles.endTime, { color: theme.textSub }]}>{end}</Text>}</View><View style={[styles.scheduledCard, { backgroundColor: theme.card, borderLeftColor: theme.primary }]}><Text style={[styles.subjectName, { color: theme.text }]} numberOfLines={1}>{subject.name || 'Class'}</Text><Text style={[styles.subjectCode, { color: theme.textSub }]}>{subject.code || 'SUBJECT'}</Text><View style={styles.detailLine}><Ionicons name="location-outline" size={12} color={theme.textSub} /><Text style={[styles.detailText, { color: theme.textSub }]}>{subject.room || 'Room TBA'}</Text><Ionicons name="person-outline" size={12} color={theme.textSub} /><Text style={[styles.detailText, { color: theme.textSub }]} numberOfLines={1}>{subject.teacher || 'Teacher TBA'}</Text></View></View></View>;
}
function TbaRow({ subject, isLast, theme }) { return <View style={[styles.tbaRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}><View style={styles.tbaCopy}><Text style={[styles.subjectName, { color: theme.text }]} numberOfLines={1}>{subject.name || 'Class'}</Text><Text style={[styles.subjectCode, { color: theme.textSub }]}>{subject.code || 'SUBJECT'}</Text></View><View style={[styles.tbaBadge, { backgroundColor: theme.primaryLight }]}><Text style={[styles.tbaBadgeText, { color: theme.textSub }]}>Time TBA</Text></View></View>; }
function Message({ title, detail, theme }) { return <View style={[styles.message, { backgroundColor: theme.card }]}><Text style={[styles.messageTitle, { color: theme.text }]}>{title}</Text><Text style={[styles.messageText, { color: theme.textSub }]}>{detail}</Text></View>; }

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: 16, paddingTop: 42, paddingBottom: 30 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }, term: { fontSize: 11, fontWeight: '600', marginBottom: 1 }, title: { fontSize: 22, fontWeight: '800' },
  logoWrap: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, logo: { width: 31, height: 31, borderRadius: 8 },
  dayTabs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }, dayTab: { width: 40, height: 37, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, dayName: { fontSize: 10, fontWeight: '800' }, dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFF1BF', marginTop: 3 },
  loading: { height: 300, justifyContent: 'center', alignItems: 'center' }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 5, marginBottom: 8 }, sectionTitle: { fontSize: 14, fontWeight: '800' }, sectionCount: { fontSize: 10, fontWeight: '700' },
  scheduledRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }, timeCol: { width: 53, paddingTop: 1 }, startTime: { fontSize: 14, fontWeight: '900' }, endTime: { fontSize: 10, marginTop: 3 }, scheduledCard: { flex: 1, minHeight: 77, borderRadius: 14, borderLeftWidth: 4, padding: 11 }, subjectName: { fontSize: 12, fontWeight: '800' }, subjectCode: { fontSize: 9, fontWeight: '600', marginTop: 2 }, detailLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }, detailText: { fontSize: 10, fontWeight: '600', marginRight: 5 },
  tbaGroup: { borderRadius: 14, overflow: 'hidden' }, tbaRow: { minHeight: 55, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, tbaCopy: { flex: 1, minWidth: 0 }, tbaBadge: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 }, tbaBadgeText: { fontSize: 9, fontWeight: '800' },
  noClasses: { fontSize: 11, textAlign: 'center', marginBottom: 16 }, message: { borderRadius: 14, padding: 22, alignItems: 'center', marginTop: 8 }, messageTitle: { fontSize: 14, fontWeight: '800' }, messageText: { fontSize: 11, textAlign: 'center', marginTop: 5 },
});
