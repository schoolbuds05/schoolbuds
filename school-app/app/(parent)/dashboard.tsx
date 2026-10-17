// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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

export default function ParentDashboard() {
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/parent');
      setData(res.data);
    } catch (e) {
      console.log('Parent dashboard error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const children = data?.children ?? [];

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <HeaderGradient
        title="Parent Portal"
        subtitle="Grades, attendance, fees, and points for linked students."
        initials="PA"
        stats={[
          { label: 'Children', value: children.length, accent: '#C7D2FE' },
          { label: 'Alerts', value: 0, accent: '#FDE68A' },
        ]}
      />
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {children.length === 0 ? (
            <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[s.title, { color: theme.text }]}>No linked students</Text>
              <Text style={[s.sub, { color: theme.textSub }]}>Ask an administrator to link this parent account to a student profile.</Text>
            </View>
          ) : children.map((child, index) => {
            const section = child.student?.section && child.student.section !== 'TBA'
              ? child.student.section
              : 'No section';

            return (
              <View key={child.student?.id ?? index} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[s.title, { color: theme.text }]}>{child.student?.first_name} {child.student?.last_name}</Text>
                <Text style={[s.sub, { color: theme.textSub }]}>
                  {child.student?.student_id} - Grade/Year {child.student?.grade_level || '-'} - {section}
                </Text>
                <View style={s.grid}>
                  <AttendanceMetric
                    percentage={child.attendance_pct}
                    subjects={child.attendance_by_subject}
                    theme={theme}
                  />
                  <Metric label="Balance" value={`PHP ${Number(child.fee_summary?.balance || 0).toFixed(2)}`} theme={theme} />
                  <Metric label="Points" value={child.reward_summary?.points ?? 0} theme={theme} />
                  <Metric label="Point value" value={`PHP ${Number(child.reward_summary?.peso_value || 0).toFixed(2)}`} theme={theme} />
                </View>
                <AttendanceSummary
                  counts={child.attendance_counts}
                  history={child.attendance_history}
                  today={child.today_attendance}
                  theme={theme}
                />
                <GradesList grades={child.grades} theme={theme} />
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function AttendanceMetric({ percentage, subjects, theme }) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={[s.metric, { backgroundColor: theme.bg }]}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Show attendance percentage by subject"
      >
        <Text style={[s.metricValue, { color: theme.text }]}>{percentage ?? 0}%</Text>
        <Text style={[s.metricLabel, { color: theme.textSub }]}>Attendance · tap for subjects</Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.historyModal, { backgroundColor: theme.card }]}>
            <View style={s.modalHeader}>
              <View>
                <Text style={[s.modalTitle, { color: theme.text }]}>Attendance by subject</Text>
                <Text style={[s.modalSubtitle, { color: theme.textSub }]}>
                  Present records divided by total records
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close subject attendance percentages"
              >
                <Text style={[s.closeText, { color: theme.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={s.historyList}>
              {!subjects?.length ? (
                <Text style={[s.emptyText, { color: theme.textSub }]}>No attendance records yet.</Text>
              ) : subjects.map(item => (
                <View key={item.subject} style={[s.subjectAttendanceRow, { borderColor: theme.border }]}>
                  <View style={s.gradeInfo}>
                    <Text style={[s.historyDate, { color: theme.text }]}>{item.subject}</Text>
                    <Text style={[s.historySubject, { color: theme.textSub }]}>
                      {item.present} present of {item.total} records
                    </Text>
                  </View>
                  <Text style={[s.subjectAttendancePercentage, { color: theme.primary }]}>
                    {item.attendance_pct}%
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function AttendanceSummary({ counts, history, today, theme }) {
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedTodayStatus, setSelectedTodayStatus] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false);
  const statuses = [
    { key: 'present', label: 'Present', color: '#15803D' },
    { key: 'late', label: 'Late', color: '#B45309' },
    { key: 'absent', label: 'Absent', color: '#B91C1C' },
    { key: 'excused', label: 'Excused', color: '#0369A1' },
  ];
  const recordedStatuses = statuses.filter(status => Number(today?.counts?.[status.key] || 0) > 0);
  const subjectOptions = selectedStatus
    ? [
        { value: 'all', label: 'All subjects' },
        ...Array.from(new Set(
          (history?.[selectedStatus.key] ?? []).map(record => record.subject || 'Other')
        )).sort().map(subject => ({ value: subject, label: subject })),
      ]
    : [];
  const selectedSubjectLabel = subjectOptions.find(option => option.value === selectedSubject)?.label || 'All subjects';

  return (
    <View style={s.attendanceBlock}>
      <View style={s.attendanceHeading}>
        <Text style={[s.sectionTitle, { color: theme.text }]}>Today&apos;s attendance</Text>
        {today?.date ? (
          <Text style={[s.attendanceDate, { color: theme.textMuted }]}>{formatAttendanceDate(today.date)}</Text>
        ) : null}
      </View>
      {recordedStatuses.length > 0 ? (
        <View style={s.statusGrid}>
          {recordedStatuses.map(status => (
            <TouchableOpacity
              key={status.key}
              style={[s.statusCard, { backgroundColor: theme.bg }]}
              onPress={() => setSelectedTodayStatus(status)}
              accessibilityRole="button"
              accessibilityLabel={`Show subjects with ${status.label.toLowerCase()} attendance today`}
            >
              <Text style={[s.statusValue, { color: status.color }]}>
                {status.label}
              </Text>
              {Number(today.counts[status.key]) > 1 ? (
                <Text style={[s.statusLabel, { color: theme.textSub }]}>
                  {today.counts[status.key]} classes
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={[s.emptyText, { color: theme.textSub }]}>No attendance recorded today yet.</Text>
      )}
      <View style={[s.overallCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[s.overallTitle, { color: theme.text }]}>Overall attendance</Text>
        <View style={s.overallGrid}>
          {statuses.map(status => (
            <TouchableOpacity
              key={status.key}
              style={s.overallItem}
              onPress={() => {
                setSelectedStatus(status);
                setSelectedSubject('all');
                setSubjectDropdownOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Show ${status.label.toLowerCase()} attendance dates`}
            >
              <Text style={[s.overallValue, { color: status.color }]}>{counts?.[status.key] ?? 0}</Text>
              <Text style={[s.overallLabel, { color: theme.textSub }]}>{status.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <Modal
        visible={!!selectedStatus}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedStatus(null)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.historyModal, { backgroundColor: theme.card }]}>
            <View style={s.modalHeader}>
              <View>
                <Text style={[s.modalTitle, { color: selectedStatus?.color ?? theme.text }]}>
                  {selectedStatus?.label} attendance
                </Text>
                <Text style={[s.modalSubtitle, { color: theme.textSub }]}>Recorded dates and weekdays</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedStatus(null)}
                accessibilityRole="button"
                accessibilityLabel="Close attendance history"
              >
                <Text style={[s.closeText, { color: theme.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>
            {subjectOptions.length > 1 ? (
              <View style={s.subjectFilterContainer}>
                <TouchableOpacity
                  style={[s.subjectDropdownButton, { borderColor: theme.border, backgroundColor: theme.bg }]}
                  onPress={() => setSubjectDropdownOpen(open => !open)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: subjectDropdownOpen }}
                >
                  <Text style={[s.subjectDropdownText, { color: theme.text }]} numberOfLines={1}>
                    {selectedSubjectLabel}
                  </Text>
                  <Ionicons
                    name={subjectDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.textSub}
                  />
                </TouchableOpacity>
                {subjectDropdownOpen ? (
                  <ScrollView
                    style={[s.subjectDropdownOptions, { borderColor: theme.border }]}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {subjectOptions.map(option => {
                      const active = selectedSubject === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[s.subjectDropdownOption, { borderColor: theme.border }]}
                          onPress={() => {
                            setSelectedSubject(option.value);
                            setSubjectDropdownOpen(false);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                        >
                          <Text style={[s.subjectDropdownText, { color: active ? theme.primary : theme.text }]}>
                            {option.label}
                          </Text>
                          {active ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : null}
              </View>
            ) : null}
            <ScrollView style={s.historyList}>
              {(selectedStatus ? history?.[selectedStatus.key] ?? [] : [])
                .filter(record => selectedSubject === 'all' || (record.subject || 'Other') === selectedSubject)
                .length === 0 ? (
                <Text style={[s.emptyText, { color: theme.textSub }]}>
                  {selectedSubject === 'all'
                    ? `No ${selectedStatus?.label.toLowerCase()} records.`
                    : `No ${selectedStatus?.label.toLowerCase()} records for ${selectedSubject}.`}
                </Text>
              ) : (history?.[selectedStatus.key] ?? [])
                .filter(record => selectedSubject === 'all' || (record.subject || 'Other') === selectedSubject)
                .map((record, index) => (
                <View key={`${record.date}-${record.subject ?? 'class'}-${index}`} style={[s.historyRow, { borderColor: theme.border }]}>
                  <Text style={[s.historyDate, { color: theme.text }]}>{formatAttendanceDay(record.date)}</Text>
                  {record.subject ? (
                    <Text style={[s.historySubject, { color: theme.textSub }]}>{record.subject}</Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!selectedTodayStatus}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTodayStatus(null)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.historyModal, { backgroundColor: theme.card }]}>
            <View style={s.modalHeader}>
              <View>
                <Text style={[s.modalTitle, { color: selectedTodayStatus?.color ?? theme.text }]}>
                  Today&apos;s {selectedTodayStatus?.label.toLowerCase()} subjects
                </Text>
                <Text style={[s.modalSubtitle, { color: theme.textSub }]}>
                  {today?.date ? formatAttendanceDate(today.date) : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedTodayStatus(null)}
                accessibilityRole="button"
                accessibilityLabel="Close today's attendance subjects"
              >
                <Text style={[s.closeText, { color: theme.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={s.historyList}>
              {(selectedTodayStatus ? history?.[selectedTodayStatus.key] ?? [] : [])
                .filter(record => record.date === today?.date)
                .map((record, index) => (
                  <View
                    key={`${record.date}-${record.subject ?? 'class'}-${index}`}
                    style={[s.historyRow, { borderColor: theme.border }]}
                  >
                    <Text style={[s.historyDate, { color: theme.text }]}>
                      {record.subject || 'Other'}
                    </Text>
                    <Text style={[s.historySubject, { color: theme.textSub }]}>
                      {formatAttendanceDay(record.date)}
                    </Text>
                  </View>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatAttendanceDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}

function formatAttendanceDay(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function GradesList({ grades, theme }) {
  const quarters = Object.entries(grades || {})
    .map(([quarter, items]) => [quarter, Array.isArray(items) ? items : Object.values(items || {})])
    .filter(([, items]) => items.length > 0);

  return (
    <View style={s.gradesBlock}>
      <Text style={[s.sectionTitle, { color: theme.text }]}>Grades</Text>
      {quarters.length === 0 ? (
        <Text style={[s.emptyText, { color: theme.textSub }]}>No grades recorded yet.</Text>
      ) : quarters.map(([quarter, items]) => (
        <View key={quarter} style={s.quarterBlock}>
          <Text style={[s.quarterTitle, { color: theme.textSub }]}>Quarter {quarter}</Text>
          {items.map((grade, index) => (
            <View key={grade.id ?? `${quarter}-${index}`} style={[s.gradeRow, { borderColor: theme.border }]}>
              <View style={s.gradeInfo}>
                <Text style={[s.gradeSubject, { color: theme.text }]} numberOfLines={1}>
                  {grade.school_class?.subject || grade.subject || 'Subject'}
                </Text>
                {!!grade.remarks && (
                  <Text style={[s.gradeRemarks, { color: theme.textSub }]} numberOfLines={1}>
                    {grade.remarks}
                  </Text>
                )}
              </View>
              <Text style={[s.gradeScore, { color: scoreColor(Number(grade.score || 0), grade.school_class?.is_college) }]}>
                {grade.score ?? '-'}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function Metric({ label, value, theme }) {
  return (
    <View style={[s.metric, { backgroundColor: theme.bg }]}>
      <Text style={[s.metricValue, { color: theme.text }]}>{value}</Text>
      <Text style={[s.metricLabel, { color: theme.textSub }]}>{label}</Text>
    </View>
  );
}

function scoreColor(score, isCollege) {
  if (isCollege) {
    if (score <= 2) return '#047857';
    if (score <= 3) return '#2563EB';
    return '#DC2626';
  }
  if (score >= 90) return '#047857';
  if (score >= 75) return '#2563EB';
  return '#DC2626';
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 16, gap: 12, paddingBottom: 90 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  title: { fontSize: 17, fontWeight: '900' },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 4, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  metric: { width: '47%', borderRadius: 12, padding: 12 },
  metricValue: { fontSize: 16, fontWeight: '900' },
  metricLabel: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  attendanceBlock: { marginTop: 16 },
  attendanceHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  attendanceDate: { fontSize: 10, fontWeight: '700' },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusCard: { width: '45%', minWidth: 65, flexGrow: 1, borderRadius: 10, padding: 10 },
  statusValue: { fontSize: 18, fontWeight: '900' },
  statusLabel: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  overallCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  overallTitle: { fontSize: 12, fontWeight: '900', marginBottom: 10 },
  overallGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  overallItem: { flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 8 },
  overallValue: { fontSize: 16, fontWeight: '900' },
  overallLabel: { fontSize: 9, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(15,23,42,0.5)' },
  historyModal: { maxHeight: '75%', borderRadius: 16, padding: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '900' },
  modalSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  closeText: { fontSize: 13, fontWeight: '800', padding: 8 },
  subjectFilterContainer: { marginBottom: 12 },
  subjectDropdownButton: { minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  subjectDropdownText: { flex: 1, fontSize: 12, fontWeight: '700' },
  subjectDropdownOptions: { maxHeight: 180, marginTop: 4, borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  subjectDropdownOption: { minHeight: 40, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyList: { flexGrow: 0 },
  subjectAttendanceRow: { minHeight: 54, borderTopWidth: 1, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  subjectAttendancePercentage: { fontSize: 17, fontWeight: '900' },
  historyRow: { borderTopWidth: 1, paddingVertical: 12 },
  historyDate: { fontSize: 13, fontWeight: '800' },
  historySubject: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  gradesBlock: { marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '900', marginBottom: 8 },
  emptyText: { fontSize: 12, fontWeight: '600' },
  quarterBlock: { marginTop: 8 },
  quarterTitle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 },
  gradeRow: { minHeight: 50, borderTopWidth: 1, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  gradeInfo: { flex: 1, minWidth: 0 },
  gradeSubject: { fontSize: 13, fontWeight: '800' },
  gradeRemarks: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  gradeScore: { minWidth: 44, textAlign: 'right', fontSize: 18, fontWeight: '900' },
});
