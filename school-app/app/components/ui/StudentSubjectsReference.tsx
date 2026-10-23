// @ts-nocheck
import { Ionicons } from '@expo/vector-icons';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const logo = require('../../../assets/images/schoolbuds-favicon.png');

export default function StudentSubjectsReference({ data, theme, filter, setFilter, onDrop, isDropPending }) {
  // Keep rendering resilient to an API payload that temporarily contains an
  // object (for example a keyed Laravel collection) instead of a JSON array.
  // The subject list is expected to be an array before calling `.map`,
  // `.filter`, or `.reduce`.
  const subjects = groupMeetings(asArray(data?.subjects));
  const sections = asArray(data?.sections);
  const section = sections[0]?.name || 'My class';
  const scheduled = subjects.filter(subject => subject.meetings.some(hasSchedule));
  const shown = filter === 'scheduled' ? scheduled : filter === 'tba' ? subjects.filter(subject => !subject.meetings.some(hasSchedule)) : subjects;
  const units = subjects.reduce((total, subject) => total + Number(subject.units_lec || 0) + Number(subject.units_lab || 0), 0);

  return (
    <ScrollView style={[s.screen, { backgroundColor: theme.bg }]} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <View style={s.headerRow}><View><Text style={s.section}>{section}</Text><Text style={[s.title, { color: theme.text }]}>My Subjects</Text></View><View style={s.logoWrap}><Image source={logo} style={s.logo} /></View></View>
        <View style={s.stats}><Metric value={subjects.length} label="Subjects" /><Metric value={units} label="Units" /><Metric value={sections.length} label="Section" last /></View>
      </View>

      <View style={s.filters}>
        <Filter label={`All ${subjects.length}`} active={filter === 'all'} onPress={() => setFilter('all')} />
        <Filter label={`Scheduled ${scheduled.length}`} active={filter === 'scheduled'} onPress={() => setFilter('scheduled')} />
        <Filter label={`TBA ${subjects.length - scheduled.length}`} active={filter === 'tba'} onPress={() => setFilter('tba')} />
      </View>

      <View style={s.list}>
        {shown.map((subject, index) => <SubjectCard key={`subject-${subject.subject_id ?? subject.id ?? 'unknown'}-${index}`} subject={subject} theme={theme} onDrop={() => onDrop(subject)} pending={isDropPending(subject)} />)}
        {!shown.length ? <View style={s.empty}><Ionicons name="book-outline" size={24} color={theme.textMuted} /><Text style={[s.emptyText, { color: theme.textSub }]}>No subjects in this view.</Text></View> : null}
      </View>
    </ScrollView>
  );
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function groupMeetings(entries) {
  const groups = new Map();
  entries.forEach((entry, index) => {
    const key = entry.subject_id != null
      ? `${entry.section_id ?? 'direct'}:${entry.subject_id}`
      : `${entry.section_id ?? 'direct'}:${entry.code || entry.name || index}`;
    if (!groups.has(key)) groups.set(key, { ...entry, meetings: [] });
    const group = groups.get(key);
    const meetingKey = [entry.day, entry.time_start, entry.time_end, entry.room, entry.teacher]
      .map(value => String(value || '').trim().toLowerCase())
      .join('|');
    if (!group.meetings.some(meeting => meeting.meetingKey === meetingKey)) {
      group.meetings.push({ ...entry, meetingKey });
    }
  });
  return [...groups.values()];
}

function Metric({ value, label, last }) { return <View style={[s.metric, !last && s.metricDivider]}><Text style={s.metricValue}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View>; }
function Filter({ label, active, onPress }) { return <TouchableOpacity onPress={onPress} style={[s.filter, active && s.filterActive]}><Text style={[s.filterText, active && s.filterTextActive]}>{label}</Text></TouchableOpacity>; }
function hasSchedule(subject) { return Boolean(subject?.day || subject?.time_start || subject?.room || subject?.teacher); }
function SubjectCard({ subject, theme, onDrop, pending }) {
  const scheduledMeetings = subject.meetings.filter(hasSchedule);
  const schedule = scheduledMeetings.length > 0;
  const units = [subject.units_lec ? `${subject.units_lec} units` : null, subject.units_lec ? 'Lec' : null, subject.units_lab ? `${subject.units_lab} Lab` : null].filter(Boolean).join(' · ');
  return <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
    <View style={[s.code, { backgroundColor: schedule ? '#F9E4E8' : '#F2EAEC' }]}><Text style={[s.codeText, { color: schedule ? theme.primary : theme.textSub }]} numberOfLines={2}>{subject.code || 'SUBJ'}</Text></View>
    <View style={s.cardBody}>
      <Text style={[s.subjectName, { color: theme.text }]} numberOfLines={2}>{subject.name}</Text>
      <Text style={[s.units, { color: theme.textSub }]}>{units || 'Units not set'}</Text>
      {schedule ? <View style={s.details}>
        {scheduledMeetings.map((meeting, index) => <View key={meeting.meetingKey || index} style={s.meeting}>
          {meeting.day || meeting.time_start ? <Detail icon="time-outline" text={[meeting.day, meeting.time_start && `${meeting.time_start}${meeting.time_end ? `–${meeting.time_end}` : ''}`].filter(Boolean).join(', ')} /> : null}
          {meeting.room ? <Detail icon="location-outline" text={meeting.room} /> : null}
          {meeting.teacher ? <Detail icon="person-outline" text={meeting.teacher} /> : null}
        </View>)}
      </View> : null}
      <View style={s.cardFooter}><View style={[s.status, { backgroundColor: schedule ? theme.successLight : '#F2EAEC' }]}><Text style={[s.statusText, { color: schedule ? theme.success : theme.textSub }]}>{schedule ? 'Scheduled' : 'Schedule TBA'}</Text></View><TouchableOpacity onPress={onDrop} disabled={pending}><Text style={[s.drop, { color: pending ? theme.textMuted : theme.primary }]}>{pending ? 'Request pending' : 'Request drop'}</Text></TouchableOpacity></View>
    </View>
  </View>;
}
function Detail({ icon, text }) { return <View style={s.detail}><Ionicons name={icon} size={13} color="#B5233D" /><Text style={s.detailText}>{text}</Text></View>; }

const s = StyleSheet.create({
  screen: { flex: 1 }, content: { paddingBottom: 24 }, header: { backgroundColor: '#F8CDD5', padding: 20, paddingTop: 42, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }, headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, section: { color: '#7A666B', fontSize: 11, fontWeight: '700' }, title: { fontSize: 22, fontWeight: '900', marginTop: 2 }, logoWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#7A666B', shadowOpacity: .12, shadowRadius: 8, elevation: 2 }, logo: { width: 35, height: 35, borderRadius: 9 },
  stats: { backgroundColor: '#FFFFFF', borderRadius: 15, paddingVertical: 11, flexDirection: 'row' }, metric: { flex: 1, alignItems: 'center' }, metricDivider: { borderRightWidth: 1, borderRightColor: '#EBDDE0' }, metricValue: { color: '#2A1B1F', fontSize: 16, fontWeight: '900' }, metricLabel: { color: '#7A666B', fontSize: 9, marginTop: 3 },
  filters: { flexDirection: 'row', marginHorizontal: 20, marginTop: 13, backgroundColor: '#F1DFE3', borderRadius: 12, padding: 4 }, filter: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 }, filterActive: { backgroundColor: '#FFFFFF', shadowColor: '#7A666B', shadowOpacity: .09, shadowRadius: 4, elevation: 1 }, filterText: { color: '#8E777D', fontSize: 10, fontWeight: '700' }, filterTextActive: { color: '#2A1B1F', fontWeight: '900' },
  list: { paddingHorizontal: 20, paddingTop: 13, gap: 10 }, card: { borderWidth: 1, borderRadius: 15, padding: 12, flexDirection: 'row', gap: 10 }, code: { width: 45, height: 45, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }, codeText: { fontSize: 10, fontWeight: '900', textAlign: 'center' }, cardBody: { flex: 1, minWidth: 0 }, subjectName: { fontSize: 13, lineHeight: 17, fontWeight: '900' }, units: { fontSize: 10, marginTop: 2, fontWeight: '600' }, details: { marginTop: 8, gap: 6 }, meeting: { gap: 4 }, detail: { flexDirection: 'row', alignItems: 'center', gap: 5 }, detailText: { color: '#453539', fontSize: 10, fontWeight: '600', flex: 1 }, cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 }, status: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 }, statusText: { fontSize: 10, fontWeight: '800' }, drop: { fontSize: 10, fontWeight: '900' }, empty: { alignItems: 'center', gap: 8, paddingVertical: 45 }, emptyText: { fontSize: 13, fontWeight: '700' },
});
