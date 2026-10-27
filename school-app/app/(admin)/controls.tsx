// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/api';

const EMPTY_TERM = {
  school_year: '2026-2027', semester: '1st', exam_date: '',
  grade_finalization_deadline: '', enrollment_opens_at: '',
  enrollment_closes_at: '', is_active: false,
};

const DATE_FIELDS = [
  ['Exam date', 'exam_date'],
  ['Grade deadline', 'grade_finalization_deadline'],
  ['Enrollment opens', 'enrollment_opens_at'],
  ['Enrollment closes', 'enrollment_closes_at'],
];

const POINT_SECTIONS = [
  ['Earning caps', [
    ['semester_cap', 'Semester cap'], ['grade_cap', 'Grade cap'],
    ['attendance_cap', 'Attendance cap'], ['event_cap', 'Event cap'],
  ]],
  ['SHS grade awards', [
    ['shs_grade_high_threshold', 'High score threshold'], ['shs_grade_high_points', 'High score points'],
    ['shs_grade_mid_threshold', 'Mid score threshold'], ['shs_grade_mid_points', 'Mid score points'],
    ['shs_grade_pass_threshold', 'Passing threshold'], ['shs_grade_pass_points', 'Passing points'],
  ]],
  ['College grade awards', [
    ['college_grade_top_max', 'Top grade maximum'], ['college_grade_top_points', 'Top grade points'],
    ['college_grade_mid_max', 'Mid grade maximum'], ['college_grade_mid_points', 'Mid grade points'],
    ['college_grade_pass_max', 'Pass grade maximum'], ['college_grade_pass_points', 'Pass grade points'],
  ]],
  ['Attendance and events', [
    ['attendance_daily_points', 'Points per present day'], ['attendance_monthly_points', 'Perfect attendance bonus'],
    ['event_default_points', 'Default event points'], ['event_points_per_event_max', 'Maximum per event'],
  ]],
  ['Enrollment and payment', [
    ['early_enrollment_points', 'Early enrollment bonus'], ['early_payment_regular_points', 'Regular payment bonus'],
    ['early_payment_early_points', 'Early payment bonus'],
  ]],
  ['Redemption and levels', [
    ['redemption_cap', 'Redemption cap per semester'], ['redemption_rate', 'PHP per point'],
    ['max_redemption_percent', 'Maximum checkout percent'], ['redemption_min_points', 'Minimum checkout points'],
    ['redemption_max_points', 'Maximum checkout points'], ['points_per_level', 'Points per level'],
  ]],
];
const DECIMAL_POINT_KEYS = new Set([
  'shs_grade_high_threshold', 'shs_grade_mid_threshold', 'shs_grade_pass_threshold',
  'college_grade_top_max', 'college_grade_mid_max', 'college_grade_pass_max',
  'redemption_rate', 'max_redemption_percent',
]);

export default function AdminControls() {
  const insets = useSafeAreaInsets();
  const [terms, setTerms] = useState([]);
  const [events, setEvents] = useState([]);
  const [points, setPoints] = useState(null);
  const [termForm, setTermForm] = useState(EMPTY_TERM);
  const [enrollmentStatus, setEnrollmentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPoints, setSavingPoints] = useState(false);
  const [pointsExpanded, setPointsExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [termRes, statusRes, eventRes, pointsRes] = await Promise.all([
        api.get('/admin/academic-terms'),
        api.get('/enrollment/settings'),
        api.get('/registrar/event-participations').catch(() => ({ data: [] })),
        api.get('/admin/points-configuration'),
      ]);
      const nextTerms = termRes.data ?? [];
      const activeTerm = statusRes.data?.term || nextTerms.find(term => term.is_active) || nextTerms[0];
      setTerms(nextTerms);
      setEvents(eventRes.data ?? []);
      setPoints(pointsRes.data ?? null);
      setEnrollmentStatus(statusRes.data ?? null);
      if (activeTerm) setTermForm(toForm(activeTerm));
    } catch (e) {
      Alert.alert('Could not load controls', e.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveTerm = async (values = termForm, showConfirmation = true) => {
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === '' ? null : value]));
      await api.post('/admin/academic-terms', payload);
      await load();
      if (showConfirmation) Alert.alert('Saved', 'Academic term rules updated.');
      return true;
    } catch (e) {
      Alert.alert('Could not save', e.response?.data?.message || 'Check the dates and try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleEnrollment = () => {
    const next = { ...termForm, is_active: !termForm.is_active };
    setTermForm(next);
    saveTerm(next, false);
  };

  const savePoints = async () => {
    setSavingPoints(true);
    try {
      const response = await api.put('/admin/points-configuration', points);
      if (response.data?.points) setPoints(response.data.points);
      Alert.alert('Saved', 'Points configuration updated.');
    } catch (e) {
      const validationErrors = e.response?.data?.errors;
      const firstError = validationErrors ? Object.values(validationErrors)[0]?.[0] : null;
      Alert.alert('Could not save points', firstError || e.response?.data?.message || 'Check the values and try again.');
    } finally {
      setSavingPoints(false);
    }
  };

  const reviewEvent = async (event, action) => {
    try {
      await api.post(`/registrar/event-participations/${event.id}/${action}`, {});
      await load();
      Alert.alert(action === 'approve' ? 'Approved' : 'Rejected', 'Event participation has been reviewed.');
    } catch (e) {
      Alert.alert('Review failed', e.response?.data?.message || 'Please try again.');
    }
  };

  const enrollmentOpen = enrollmentStatus?.enrollment_open === true;
  const activeTerm = enrollmentStatus?.term;
  const pendingEvents = events.filter(event => event.status === 'pending');

  if (loading) {
    return <View style={s.loading}><ActivityIndicator size="large" color="#AE1234" /></View>;
  }

  return (
    <View style={s.screen}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#AE1234" />}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.eyebrow}>MANAGE</Text>
        <Text style={s.pageTitle}>Controls</Text>

        <View style={s.enrollmentCard}>
          <View style={s.enrollmentHeading}>
            <View style={[s.statusDot, enrollmentOpen ? s.statusOpen : s.statusClosed]} />
            <Text style={s.enrollmentTitle}>Enrollment is {enrollmentOpen ? 'open' : 'closed'}</Text>
          </View>
          <Text style={s.enrollmentMeta}>
            {activeTerm ? `${activeTerm.school_year} · ${semesterLabel(activeTerm.semester)} semester · ${activeTerm.enrollment_closes_at ? `closes ${formatDate(activeTerm.enrollment_closes_at)}` : 'no close date'}` : 'No active academic term'}
          </Text>
          <TouchableOpacity style={s.enrollmentButton} onPress={toggleEnrollment} disabled={saving || !termForm.school_year} activeOpacity={0.8}>
            {saving ? <ActivityIndicator color="#AE1234" /> : <Text style={s.enrollmentButtonText}>{termForm.is_active ? 'Close enrollment' : 'Open enrollment'}</Text>}
          </TouchableOpacity>
        </View>

        <Text style={s.sectionHeading}>TERM SETTINGS</Text>
        <View style={s.termCard}>
          <View style={s.schoolYearRow}>
            <Text style={s.rowLabel}>School year</Text>
            <View style={s.schoolYearInputWrap}>
              <TextInput
                style={s.schoolYearInput}
                value={termForm.school_year}
                onChangeText={value => setTermForm(current => ({ ...current, school_year: value }))}
                placeholder="2026-2027"
                placeholderTextColor="#806D72"
                textAlign="right"
              />
              <Feather name="chevron-down" size={15} color="#301A20" />
            </View>
          </View>
          <View style={s.semesterSection}>
            <Text style={s.rowLabel}>Semester</Text>
            <View style={s.semesterRow}>
              {['1st', '2nd', 'summer'].map(semester => {
                const selected = termForm.semester === semester;
                return (
                  <TouchableOpacity key={semester} onPress={() => setTermForm(current => ({ ...current, semester }))} style={[s.semesterButton, selected && s.semesterButtonActive]}>
                    <Text style={[s.semesterText, selected && s.semesterTextActive]}>{semesterLabel(semester)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          {DATE_FIELDS.map(([label, key]) => (
            <View key={key} style={s.dateRow}>
              <Text style={s.rowLabel}>{label}</Text>
              <TextInput
                style={s.dateInput}
                value={termForm[key]}
                onChangeText={value => setTermForm(current => ({ ...current, [key]: value }))}
                placeholder={key === 'enrollment_closes_at' ? 'No close date' : 'Set'}
                placeholderTextColor="#806D72"
                textAlign="right"
              />
              <Feather name="calendar" size={17} color="#806D72" />
            </View>
          ))}
        </View>

        {terms.length > 1 ? (
          <View style={s.otherTerms}>
            <Text style={s.sectionHeading}>OTHER TERMS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.termChips}>
              {terms.map(term => {
                const selected = termForm.school_year === term.school_year && termForm.semester === term.semester;
                return (
                  <TouchableOpacity key={term.id} style={[s.termChip, selected && s.termChipActive]} onPress={() => setTermForm(toForm(term))}>
                    <Text style={[s.termChipText, selected && s.termChipTextActive]}>{term.school_year} · {semesterLabel(term.semester)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={s.pointsSection}>
          <TouchableOpacity style={s.pointsHeader} onPress={() => setPointsExpanded(open => !open)} activeOpacity={0.8}>
            <View style={s.pointsHeaderCopy}>
              <Text style={s.pointsTitle}>Point configuration</Text>
              <Text style={s.pointsDescription}>Set earning limits, awards, and redemption rules</Text>
            </View>
            <Feather name={pointsExpanded ? 'chevron-up' : 'chevron-down'} size={19} color="#806D72" />
          </TouchableOpacity>
          {pointsExpanded ? (
            <View style={s.pointsBody}>
              {!points ? <Text style={s.pointsDescription}>Point settings could not be loaded.</Text> : POINT_SECTIONS.map(([sectionTitle, fields]) => (
                <View key={sectionTitle} style={s.pointGroup}>
                  <Text style={s.pointGroupTitle}>{sectionTitle}</Text>
                  {fields.map(([key, label]) => (
                    <View key={key} style={s.pointField}>
                      <Text style={s.pointLabel}>{label}</Text>
                      <View style={s.pointInputShell}>
                        <TextInput
                          style={s.pointInput}
                          value={String(points[key] ?? '')}
                          onChangeText={value => setPoints(current => ({ ...current, [key]: value }))}
                          keyboardType={DECIMAL_POINT_KEYS.has(key) ? 'decimal-pad' : 'number-pad'}
                          selectTextOnFocus
                          textAlign="right"
                          textAlignVertical="center"
                          includeFontPadding
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ))}
              <Text style={s.pointsFootnote}>Changes apply to future point awards and checkouts. Existing reward records stay unchanged.</Text>
              <TouchableOpacity
                style={s.pointsSaveButton}
                onPress={savePoints}
                disabled={savingPoints || !points}
                activeOpacity={0.85}
              >
                {savingPoints ? <ActivityIndicator color="#AE1234" /> : <Text style={s.pointsSaveText}>Save point configuration</Text>}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {events.length > 0 ? (
          <View style={s.eventsSection}>
            <Text style={s.sectionHeading}>EVENT PARTICIPATION APPROVALS · {pendingEvents.length} PENDING</Text>
            {events.map(event => (
              <View key={event.id} style={s.eventCard}>
                <Text style={s.eventTitle}>{event.event_name}</Text>
                <Text style={s.eventSub}>{event.student?.first_name} {event.student?.last_name} · {event.points} pts · {event.status}</Text>
                {event.status === 'pending' ? (
                  <View style={s.eventActions}>
                    <TouchableOpacity style={s.approveButton} onPress={() => reviewEvent(event, 'approve')}><Text style={s.approveText}>Approve</Text></TouchableOpacity>
                    <TouchableOpacity style={s.rejectButton} onPress={() => reviewEvent(event, 'reject')}><Text style={s.rejectText}>Reject</Text></TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        <View style={{ height: 18 }} />
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TouchableOpacity
          style={s.saveButton}
          onPress={() => saveTerm()}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save term rules</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function toForm(term) {
  const dateValue = value => value ? String(value).replace('T', ' ').slice(0, 16) : '';
  return {
    school_year: term.school_year || '',
    semester: term.semester || '1st',
    exam_date: dateValue(term.exam_date),
    grade_finalization_deadline: dateValue(term.grade_finalization_deadline),
    enrollment_opens_at: dateValue(term.enrollment_opens_at),
    enrollment_closes_at: dateValue(term.enrollment_closes_at),
    is_active: Boolean(term.is_active),
  };
}

function semesterLabel(value) {
  return value === 'summer' ? 'Summer' : value;
}

function formatDate(value) {
  if (!value) return 'no close date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBF3F4' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 10 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBF3F4' },
  eyebrow: { color: '#AE1234', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  pageTitle: { color: '#301A20', fontSize: 28, lineHeight: 34, fontWeight: '800', marginTop: 2 },
  enrollmentCard: { marginTop: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0D9DE', borderRadius: 16, padding: 16 },
  enrollmentHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusOpen: { backgroundColor: '#24845B' },
  statusClosed: { backgroundColor: '#AE1234' },
  enrollmentTitle: { color: '#301A20', fontSize: 15, fontWeight: '800' },
  enrollmentMeta: { color: '#806D72', fontSize: 12, marginLeft: 20, marginTop: 5 },
  enrollmentButton: { height: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#AE1234', backgroundColor: '#fff', marginTop: 13 },
  enrollmentButtonText: { color: '#AE1234', fontSize: 13, fontWeight: '800' },
  sectionHeading: { color: '#AE1234', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  termCard: { borderRadius: 16, borderWidth: 1, borderColor: '#F0D9DE', backgroundColor: '#fff', overflow: 'hidden' },
  schoolYearRow: { minHeight: 55, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3E5E8' },
  rowLabel: { color: '#301A20', fontSize: 13 },
  schoolYearInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  schoolYearInput: { minWidth: 105, color: '#301A20', fontSize: 13, fontWeight: '800', paddingVertical: 8 },
  semesterSection: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3E5E8' },
  semesterRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  semesterButton: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: '#F0D9DE', backgroundColor: '#fff' },
  semesterButtonActive: { backgroundColor: '#AE1234', borderColor: '#AE1234' },
  semesterText: { color: '#806D72', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  semesterTextActive: { color: '#fff' },
  dateRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3E5E8', gap: 10 },
  dateInput: { flex: 1, color: '#806D72', fontSize: 13, paddingVertical: 10 },
  otherTerms: { marginTop: 2 },
  termChips: { gap: 8, paddingBottom: 4 },
  termChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: '#F0D9DE', backgroundColor: '#fff' },
  termChipActive: { backgroundColor: '#F7DFE4', borderColor: '#EDBBC5' },
  termChipText: { color: '#806D72', fontSize: 11, fontWeight: '700' },
  termChipTextActive: { color: '#AE1234' },
  pointsSection: { marginTop: 18, borderWidth: 1, borderColor: '#F0D9DE', borderRadius: 16, backgroundColor: '#fff', overflow: 'hidden' },
  pointsHeader: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  pointsHeaderCopy: { flex: 1, marginRight: 8 },
  pointsTitle: { color: '#301A20', fontSize: 14, fontWeight: '800' },
  pointsDescription: { color: '#806D72', fontSize: 11, lineHeight: 15, marginTop: 3 },
  pointsBody: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: '#F3E5E8' },
  pointGroup: { paddingTop: 13 },
  pointGroupTitle: { color: '#AE1234', fontSize: 11, fontWeight: '800', marginBottom: 5 },
  pointField: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F6ECEE', gap: 8 },
  pointLabel: { flex: 1, color: '#806D72', fontSize: 12 },
  pointInputShell: { width: 86, height: 42, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#F0D9DE', backgroundColor: '#FBF3F4', paddingHorizontal: 9 },
  pointInput: { width: '100%', minHeight: 0, paddingHorizontal: 0, paddingVertical: 0, color: '#301A20', fontSize: 15, fontWeight: '700' },
  pointsFootnote: { color: '#806D72', fontSize: 10, lineHeight: 14, marginTop: 12 },
  pointsSaveButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: '#AE1234', marginTop: 12 },
  pointsSaveText: { color: '#AE1234', fontSize: 12, fontWeight: '800' },
  eventsSection: { marginTop: 2 },
  eventCard: { padding: 14, marginBottom: 8, borderRadius: 14, borderWidth: 1, borderColor: '#F0D9DE', backgroundColor: '#fff' },
  eventTitle: { color: '#301A20', fontSize: 14, fontWeight: '800' },
  eventSub: { color: '#806D72', fontSize: 12, marginTop: 4 },
  eventActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveButton: { backgroundColor: '#24845B', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10 },
  approveText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  rejectButton: { backgroundColor: '#F7DFE4', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10 },
  rejectText: { color: '#AE1234', fontSize: 12, fontWeight: '800' },
  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0D9DE' },
  saveButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#AE1234' },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
