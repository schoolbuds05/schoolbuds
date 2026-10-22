// @ts-nocheck
import { Ionicons } from '@expo/vector-icons';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const logo = require('../../../assets/images/schoolbuds-favicon.png');

export default function StudentHomeReference({
  student, user, data, greeting, sectionLabel, gwa, points, notifications,
  theme, refreshing, onRefresh, onProfile, onGrades, onNotification,
  enrollmentAction, enrollmentLabel, enrollmentMessage,
}) {
  const localCurrentClass = findCurrentClass(data?.today_classes);
  const isClassNow = Boolean(localCurrentClass || data?.current_class);
  const nextClass = localCurrentClass || data?.current_class || data?.next_class || data?.today_classes?.[0] || data?.schedule?.[0];
  const upcomingClass = isClassNow
    ? findUpcomingClass(data?.today_classes, localCurrentClass || data?.current_class)
    : null;
  const grades = data?.grades?.['4'] || data?.grades?.['1'] || [];
  const unread = notifications?.unread_count || 0;
  const name = `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || user?.name || 'Student';
  const course = sectionLabel || 'Student account';
  const time = formatTime12(nextClass?.time_start || nextClass?.start_time) || 'No class';
  const endTime = formatTime12(nextClass?.time_end || nextClass?.end_time);
  const subject = nextClass?.subject?.name || nextClass?.subject_name || nextClass?.name || 'No class scheduled today';
  const teacher = nextClass?.teacher?.name || nextClass?.teacher_name;
  const room = nextClass?.room;

  return (
    <ScrollView
      style={[s.screen, { backgroundColor: theme.bg }]}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.hero}>
        <Text style={[s.pageTitle, { color: theme.primary }]}>Home</Text>
        <View style={s.brandRow}>
          <Image source={logo} style={s.logo} resizeMode="contain" />
          <View style={s.identity}>
            <Text style={[s.greeting, { color: theme.textSub }]}>{greeting}</Text>
            <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>{name}</Text>
          </View>
          <TouchableOpacity style={s.profileButton} onPress={onProfile} accessibilityLabel="Open profile">
            {user?.profile_photo_url ? <Image source={{ uri: user.profile_photo_url }} style={s.profileImage} /> : <Ionicons name="person-outline" size={20} color={theme.text} />}
          </TouchableOpacity>
        </View>
        <View style={s.chips}>
          <View style={[s.chip, { backgroundColor: '#FFF4F5' }]}><Text style={[s.chipText, { color: theme.primary }]}>{course}</Text></View>
          {points > 0 ? <View style={[s.chip, s.pointsChip]}><Ionicons name="star-outline" size={13} color="#6B5200" /><Text style={s.pointsText}>{points.toLocaleString()} points</Text></View> : null}
        </View>
        <View style={s.nextClass}>
          <View style={s.nextTag}><Text style={s.nextTagText}>{isClassNow ? 'Class now' : 'Next class is'}{nextClass?.day ? ` · ${nextClass.day}` : ''}</Text></View>
          <Text style={s.time}>{time}{endTime ? <Text style={s.endTime}> · {endTime}</Text> : null}</Text>
          <Text style={s.subject} numberOfLines={2}>{subject}</Text>
          {(room || teacher) ? <View style={s.meta}>{room ? <Text style={s.metaText}>{room}</Text> : null}{teacher ? <Text style={s.metaText}>{teacher}</Text> : null}</View> : null}
          {upcomingClass ? <Text style={s.upcoming}>Next class is {formatTime12(upcomingClass.time_start)} · {upcomingClass.subject_name || upcomingClass.name || 'Scheduled class'}</Text> : null}
        </View>
      </View>

      <View style={[s.stats, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <Stat value={`${data?.attendance_pct ?? 0}%`} label="Attendance" color={theme.text} />
        <Stat value={gwa} label="GWA" color={theme.text} />
        <Stat value={data?.units_total ?? 0} label="Units" color={theme.success} />
        <Stat value={`₱${data?.pending_fees?.length ?? 0}`} label="Fees due" color={theme.text} />
      </View>

      {enrollmentAction ? <TouchableOpacity style={[s.enrollment, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={enrollmentAction}>
        <View style={[s.enrollmentIcon, { backgroundColor: theme.primaryLight }]}><Ionicons name="school-outline" size={20} color={theme.primary} /></View>
        <View style={s.flex}><Text style={[s.noteTitle, { color: theme.text }]}>{enrollmentLabel}</Text><Text style={[s.noteBody, { color: theme.textSub }]}>{enrollmentMessage}</Text></View>
        <Ionicons name="chevron-forward" size={19} color={theme.textMuted} />
      </TouchableOpacity> : null}

      <View style={s.sectionTitle}><Text style={[s.sectionHeading, { color: theme.text }]}>Notifications</Text>{unread ? <Text style={[s.sectionLink, { color: theme.primary }]}>{unread} unread</Text> : null}</View>
      {notifications?.notifications?.slice(0, 2).map(item => (
        <TouchableOpacity key={item.id} style={[s.notification, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => onNotification(item)}>
          <View style={[s.dot, { backgroundColor: item.read_at ? theme.textMuted : theme.primary }]} />
          <View style={s.flex}><Text style={[s.noteTitle, { color: theme.text }]}>{item.title}</Text><Text style={[s.noteBody, { color: theme.textSub }]} numberOfLines={2}>{item.body || item.type}</Text><Text style={[s.noteDate, { color: theme.textMuted }]}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</Text></View>
        </TouchableOpacity>
      ))}
      {!notifications?.notifications?.length ? <View style={[s.empty, { borderColor: theme.border }]}><Ionicons name="notifications-outline" size={22} color={theme.textMuted} /><Text style={[s.emptyText, { color: theme.textSub }]}>You’re all caught up.</Text></View> : null}

      <View style={s.sectionTitle}><Text style={[s.sectionHeading, { color: theme.text }]}>Latest grades</Text><TouchableOpacity onPress={onGrades}><Text style={[s.sectionLink, { color: theme.primary }]}>See all</Text></TouchableOpacity></View>
      {grades.length ? grades.slice(0, 4).map((grade, index) => <View key={index} style={[s.grade, { backgroundColor: theme.card, borderColor: theme.border }]}><View style={[s.gradeCode, { backgroundColor: theme.successLight }]}><Text style={[s.gradeCodeText, { color: theme.success }]}>{grade.school_class?.code || 'SUBJ'}</Text></View><Text style={[s.gradeName, { color: theme.text }]} numberOfLines={1}>{grade.school_class?.subject || 'Subject'}</Text><Text style={[s.gradeValue, { color: theme.success }]}>{grade.score}</Text></View>) : <View style={[s.empty, { borderColor: theme.border }]}><Ionicons name="bar-chart-outline" size={22} color={theme.textMuted} /><View style={s.flex}><Text style={[s.noteTitle, { color: theme.text }]}>No grades posted yet</Text><Text style={[s.noteBody, { color: theme.textSub }]}>They’ll show here as soon as your teachers post them.</Text></View></View>}
    </ScrollView>
  );
}

function findCurrentClass(classes) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return (classes || []).find(item => {
    const start = timeMinutes(item?.time_start || item?.start_time);
    const end = timeMinutes(item?.time_end || item?.end_time);
    return start !== null && end !== null && start <= currentMinutes && currentMinutes < end;
  });
}

function findUpcomingClass(classes, currentClass) {
  const currentEnd = timeMinutes(currentClass?.time_end || currentClass?.end_time) ?? -1;
  return (classes || []).find(item => (timeMinutes(item?.time_start || item?.start_time) ?? -1) >= currentEnd);
}

function timeMinutes(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const suffix = (match[3] || '').toLowerCase();
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  return (hour % 24) * 60 + minute;
}

function formatTime12(value) {
  if (!value) return '';
  const match = String(value).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return String(value);
  let hour = Number(match[1]);
  const minutes = match[2] || '00';
  const suffix = match[3]?.toUpperCase() || (hour >= 12 ? 'PM' : 'AM');
  hour %= 12;
  return `${hour || 12}:${minutes} ${suffix}`;
}

function Stat({ value, label, color }) { return <View style={s.stat}><Text style={[s.statValue, { color }]}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>; }

const s = StyleSheet.create({
  screen: { flex: 1 }, content: { paddingBottom: 28 }, flex: { flex: 1 },
  hero: { margin: 4, padding: 16, paddingTop: 12, paddingBottom: 14, borderRadius: 23, backgroundColor: '#F8CDD5' }, pageTitle: { fontSize: 12, fontWeight: '800', marginBottom: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, logo: { width: 42, height: 42, borderRadius: 12 }, identity: { flex: 1, minWidth: 0 },
  profileButton: { width: 37, height: 37, borderRadius: 19, borderWidth: 1, borderColor: '#E5B5C0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, profileImage: { width: '100%', height: '100%' },
  greeting: { fontSize: 11, fontWeight: '600' }, name: { fontSize: 18, fontWeight: '900', marginTop: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12, marginBottom: 12 }, chip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99 }, chipText: { fontSize: 10, fontWeight: '800' }, pointsChip: { backgroundColor: '#FFF1BF', flexDirection: 'row', alignItems: 'center', gap: 4 }, pointsText: { color: '#6B5200', fontSize: 10, fontWeight: '800' },
  nextClass: { backgroundColor: '#AD1933', borderRadius: 16, padding: 15, overflow: 'hidden' }, nextTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(255,255,255,.18)' }, nextTagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' }, time: { color: '#FFFFFF', fontSize: 29, fontWeight: '900', marginTop: 10 }, endTime: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,.88)' }, subject: { color: '#EE8497', fontSize: 15, fontWeight: '800', marginTop: 4 }, meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 }, metaText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' }, upcoming: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', marginTop: 11, paddingTop: 9, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.25)' },
  stats: { marginHorizontal: 20, marginTop: 10, borderWidth: 1, borderRadius: 14, paddingVertical: 10, flexDirection: 'row' }, stat: { flex: 1, alignItems: 'center', paddingHorizontal: 4, borderRightWidth: 1, borderRightColor: '#EBDDDF' }, statValue: { fontSize: 16, fontWeight: '900' }, statLabel: { color: '#7A666B', fontSize: 9, marginTop: 3, textAlign: 'center' },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 18, marginTop: 23, marginBottom: 9 }, sectionHeading: { fontSize: 16, fontWeight: '800' }, sectionLink: { fontSize: 12, fontWeight: '800' },
  enrollment: { marginHorizontal: 16, marginTop: 14, borderWidth: 1, borderRadius: 13, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 }, enrollmentIcon: { width: 39, height: 39, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  notification: { marginHorizontal: 16, borderWidth: 1, borderRadius: 13, padding: 13, flexDirection: 'row', gap: 10, marginBottom: 8 }, dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 }, noteTitle: { fontSize: 13, fontWeight: '800' }, noteBody: { fontSize: 12, lineHeight: 17, marginTop: 3 }, noteDate: { fontSize: 10, marginTop: 6 },
  grade: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, marginHorizontal: 16, padding: 11, gap: 10, marginBottom: 8 }, gradeCode: { minWidth: 43, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }, gradeCodeText: { fontSize: 9, fontWeight: '900' }, gradeName: { flex: 1, fontSize: 13, fontWeight: '700' }, gradeValue: { fontSize: 18, fontWeight: '900' },
  empty: { marginHorizontal: 16, borderWidth: 1, borderStyle: 'dashed', borderRadius: 13, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11 }, emptyText: { fontSize: 13, fontWeight: '600' },
});
