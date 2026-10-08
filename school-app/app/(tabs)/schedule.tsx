// @ts-nocheck
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
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
import HeaderGradient from '../components/ui/HeaderGradient';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DAY_ALIASES = {
  monday: 'Monday', mon: 'Monday', mo: 'Monday', m: 'Monday',
  tuesday: 'Tuesday', tue: 'Tuesday', tues: 'Tuesday', tu: 'Tuesday', t: 'Tuesday',
  wednesday: 'Wednesday', wed: 'Wednesday', we: 'Wednesday', w: 'Wednesday',
  thursday: 'Thursday', th: 'Thursday', thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', r: 'Thursday',
  friday: 'Friday', fri: 'Friday', f: 'Friday',
  saturday: 'Saturday', sat: 'Saturday', sa: 'Saturday',
  sunday: 'Sunday', sun: 'Sunday', su: 'Sunday', u: 'Sunday',
};

function daysForSubject(dayValue) {
  const raw = String(dayValue || '').trim();
  if (!raw) return [];

  const tokens = raw.toLowerCase().match(/[a-z]+/g) || [];
  const days = tokens.flatMap(token => {
    if (token === 'tth' || token === 'tr') return ['Tuesday', 'Thursday'];
    if (token === 'tuth' || token === 'tueth') return ['Tuesday', 'Thursday'];
    if (DAY_ALIASES[token]) return [DAY_ALIASES[token]];
    if (/^[mtwrfsu]{2,7}$/.test(token)) {
      return [...token].map(letter => DAY_ALIASES[letter]).filter(Boolean);
    }
    return [];
  });

  return [...new Set(days)].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
}

function timeLabel(subject) {
  if (!subject.day && subject.time_start && !subject.time_end) return String(subject.time_start);
  if (!subject.time_start && !subject.time_end) return 'Time TBA';
  return `${subject.time_start || 'Time TBA'}${subject.time_end ? ` - ${subject.time_end}` : ''}`;
}

function timeSortValue(subject) {
  const text = String(subject.time_start || '');
  const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hour = Number(match[1]) % 12;
  if (match[3]?.toLowerCase() === 'pm') hour += 12;
  return hour * 60 + Number(match[2] || 0);
}

export default function StudentSchedule() {
  const { theme } = useTheme();
  const [subjects, setSubjects] = useState([]);
  const [activeTerm, setActiveTerm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState('All');
  const [loadError, setLoadError] = useState('');

  const loadSchedule = useCallback(async () => {
    try {
      const response = await api.get('/my-subjects', { params: { view: 'current' } });
      setSubjects(response.data?.subjects ?? []);
      setActiveTerm(response.data?.active_term ?? null);
      setLoadError('');
    } catch (error) {
      console.log('Student schedule error:', error.message);
      setLoadError(error.response?.data?.message || 'Could not load your class schedule. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadSchedule();
  }, [loadSchedule]));

  const groups = useMemo(() => {
    const result = new Map(DAYS.map(day => [day, []]));
    const unscheduled = [];

    subjects.forEach(subject => {
      const days = daysForSubject(subject.day);
      if (!days.length) {
        unscheduled.push(subject);
        return;
      }
      days.forEach(day => result.get(day).push(subject));
    });

    result.forEach(items => items.sort((a, b) => timeSortValue(a) - timeSortValue(b)));
    unscheduled.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    return { byDay: result, unscheduled };
  }, [subjects]);

  const visibleDays = selectedDay === 'All' ? DAYS : [selectedDay];
  const scheduledCount = DAYS.reduce((count, day) => count + groups.byDay.get(day).length, 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <HeaderGradient
        title="Class Schedule"
        subtitle={activeTerm
          ? `${activeTerm.semester?.toUpperCase() || ''} Semester · A.Y. ${activeTerm.school_year || ''}`
          : 'Your enrolled classes for this term'}
        initials="SC"
        stats={[
          { label: 'Classes', value: subjects.length, accent: '#FDE68A' },
          { label: 'Scheduled', value: scheduledCount, accent: '#A7F3D0' },
          { label: 'Days', value: DAYS.filter(day => groups.byDay.get(day).length).length, accent: '#C7D2FE' },
        ]}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadSchedule();
              }}
              tintColor={theme.primary}
            />
          }
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayPicker}>
            {['All', ...DAYS].map(day => {
              const selected = selectedDay === day;
              const count = day === 'All' ? subjects.length : groups.byDay.get(day).length;
              return (
                <TouchableOpacity
                  key={day}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.dayChip,
                    { backgroundColor: selected ? theme.primary : theme.card, borderColor: selected ? theme.primary : theme.border },
                  ]}
                  onPress={() => setSelectedDay(day)}
                >
                  <Text style={[styles.dayChipText, { color: selected ? '#fff' : theme.textSub }]}>{day}</Text>
                  <Text style={[styles.dayChipCount, { color: selected ? '#fff' : theme.textMuted }]}>{count}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loadError ? (
            <View style={[styles.messageCard, { backgroundColor: theme.dangerLight, borderColor: theme.danger }]}>
              <Text style={[styles.messageTitle, { color: theme.danger }]}>Schedule unavailable</Text>
              <Text style={[styles.messageText, { color: theme.textSub }]}>{loadError}</Text>
            </View>
          ) : subjects.length === 0 ? (
            <View style={[styles.messageCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="calendar-outline" size={28} color={theme.primary} />
              <Text style={[styles.messageTitle, { color: theme.text }]}>No classes to show</Text>
              <Text style={[styles.messageText, { color: theme.textSub }]}>
                Your enrolled classes will appear here once your current study load and class times are assigned.
              </Text>
            </View>
          ) : (
            <>
              {visibleDays.map(day => {
                const classes = groups.byDay.get(day);
                if (classes.length === 0) return null;
                return (
                  <View key={day} style={styles.daySection}>
                    <View style={styles.sectionHeading}>
                      <Text style={[styles.sectionTitle, { color: theme.text }]}>{day}</Text>
                      <Text style={[styles.sectionCount, { color: theme.textSub }]}>
                        {classes.length} {classes.length === 1 ? 'class' : 'classes'}
                      </Text>
                    </View>
                    {classes.map((subject, index) => (
                      <ClassCard key={`${subject.section_id}-${subject.subject_id}-${day}-${index}`} subject={subject} theme={theme} />
                    ))}
                  </View>
                );
              })}

              {selectedDay !== 'All' && groups.byDay.get(selectedDay).length === 0 ? (
                <View style={[styles.messageCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Ionicons name="sunny-outline" size={26} color={theme.primary} />
                  <Text style={[styles.messageTitle, { color: theme.text }]}>No classes on {selectedDay}</Text>
                  <Text style={[styles.messageText, { color: theme.textSub }]}>Choose another day to view your scheduled classes.</Text>
                </View>
              ) : null}

              {selectedDay === 'All' && groups.unscheduled.length > 0 ? (
                <View style={styles.daySection}>
                  <View style={styles.sectionHeading}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Schedule to be confirmed</Text>
                    <Text style={[styles.sectionCount, { color: theme.textSub }]}>{groups.unscheduled.length}</Text>
                  </View>
                  {groups.unscheduled.map((subject, index) => (
                    <ClassCard key={`${subject.section_id}-${subject.subject_id}-tba-${index}`} subject={subject} theme={theme} />
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function ClassCard({ subject, theme }) {
  return (
    <View style={[styles.classCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.timeRail, { backgroundColor: theme.primaryLight }]}>
        <Ionicons name="time-outline" size={18} color={theme.primary} />
        <Text style={[styles.timeText, { color: theme.primary }]}>{timeLabel(subject)}</Text>
      </View>
      <View style={styles.classDetails}>
        <Text style={[styles.subjectCode, { color: theme.primary }]}>{subject.code || 'SUBJECT'}</Text>
        <Text style={[styles.subjectName, { color: theme.text }]}>{subject.name || 'Class'}</Text>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={15} color={theme.textSub} />
          <Text style={[styles.detailText, { color: theme.textSub }]}>{subject.room || 'Room TBA'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={15} color={theme.textSub} />
          <Text style={[styles.detailText, { color: theme.textSub }]}>{subject.teacher || 'Teacher TBA'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 110, gap: 14 },
  dayPicker: { gap: 8, paddingVertical: 2 },
  dayChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14 },
  dayChipText: { fontSize: 12, fontWeight: '800' },
  dayChipCount: { fontSize: 11, fontWeight: '800' },
  daySection: { gap: 9 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 3 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  sectionCount: { fontSize: 11, fontWeight: '700' },
  classCard: { borderWidth: 1, borderRadius: 13, overflow: 'hidden' },
  timeRail: { minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13 },
  timeText: { fontSize: 12, fontWeight: '800' },
  classDetails: { padding: 13, gap: 5 },
  subjectCode: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  subjectName: { fontSize: 15, fontWeight: '900', marginBottom: 3 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, fontWeight: '600' },
  messageCard: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, padding: 20 },
  messageTitle: { fontSize: 15, fontWeight: '900', textAlign: 'center' },
  messageText: { fontSize: 12, fontWeight: '600', lineHeight: 18, textAlign: 'center' },
});
