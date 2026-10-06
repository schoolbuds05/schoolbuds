// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
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
import HeaderGradient from '../components/ui/HeaderGradient';
import api from '../../src/api';

const EMPTY_TERM = {
  school_year: '2024-2025',
  semester: '1st',
  exam_date: '',
  grade_finalization_deadline: '',
  enrollment_opens_at: '',
  enrollment_closes_at: '',
  is_active: false,
};

export default function RegistrarControls() {
  const [terms, setTerms] = useState([]);
  const [events, setEvents] = useState([]);
  const [termForm, setTermForm] = useState(EMPTY_TERM);
  const [enrollmentStatus, setEnrollmentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingTerm, setSavingTerm] = useState(false);

  const load = useCallback(async () => {
    try {
      const [termRes, eventRes] = await Promise.all([
        api.get('/admin/academic-terms'),
        api.get('/registrar/event-participations'),
      ]);
      const statusRes = await api.get('/enrollment/settings');
      setTerms(termRes.data ?? []);
      setEvents(eventRes.data ?? []);
      setEnrollmentStatus(statusRes.data ?? null);
    } catch (e) {
      Alert.alert('Could not load controls', e.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveTerm = async () => {
    setSavingTerm(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(termForm).map(([key, value]) => [key, value === '' ? null : value])
      );
      await api.post('/admin/academic-terms', payload);
      await load();
      Alert.alert('Saved', 'Academic term rules updated.');
    } catch (e) {
      Alert.alert('Could not save', e.response?.data?.message || 'Check the dates and try again.');
    } finally {
      setSavingTerm(false);
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

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#378ADD" />
      </View>
    );
  }

  const pendingEvents = events.filter(event => event.status === 'pending');
  const enrollmentOpen = enrollmentStatus?.enrollment_open === true;
  const activeTerm = enrollmentStatus?.term;

  return (
    <View style={s.container}>
      <HeaderGradient
        title="Controls"
        subtitle="Manage school year, semester, exam date, and enrollment access"
        initials="CT"
        stats={[
          { label: 'Terms', value: terms.length, accent: '#C7D2FE' },
          { label: 'Enrollment', value: enrollmentOpen ? 'Open' : 'Closed', accent: enrollmentOpen ? '#A7F3D0' : '#FECACA' },
          { label: 'Pending events', value: pendingEvents.length, accent: '#FDE68A' },
        ]}
      />

      <ScrollView
        contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={[s.statusCard, enrollmentOpen ? s.statusCardOpen : s.statusCardClosed]}>
          <View style={s.statusHeader}>
            <View style={[s.statusDot, enrollmentOpen ? s.statusDotOpen : s.statusDotClosed]} />
            <View style={{ flex: 1 }}>
              <Text style={s.statusTitle}>Enrollment is {enrollmentOpen ? 'Open' : 'Closed'}</Text>
              <Text style={s.statusMessage}>
                {enrollmentOpen
                  ? 'Students can open and submit enrollment applications.'
                  : 'Students cannot open the enrollment form right now.'}
              </Text>
            </View>
          </View>
          <Text style={s.statusDetail}>{enrollmentStatus?.message || 'Enrollment status is unavailable.'}</Text>
          {activeTerm ? (
            <Text style={s.statusDetail}>
              {activeTerm.school_year} - {activeTerm.semester?.toUpperCase()} | {activeTerm.enrollment_opens_at || 'Anytime'} to {activeTerm.enrollment_closes_at || 'No close date'}
            </Text>
          ) : null}
        </View>

        <View style={s.card}>
          <Text style={s.title}>Academic Settings</Text>
          <Field label="School year" value={termForm.school_year} onChangeText={value => setTermForm(current => ({ ...current, school_year: value }))} />
          <Text style={s.label}>Semester</Text>
          <View style={s.pillRow}>
            {['1st', '2nd', 'summer'].map(semester => (
              <TouchableOpacity
                key={semester}
                style={[s.pill, termForm.semester === semester && s.pillActive]}
                onPress={() => setTermForm(current => ({ ...current, semester }))}
              >
                <Text style={[s.pillText, termForm.semester === semester && s.pillTextActive]}>{semester.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Field label="Exam date" placeholder="YYYY-MM-DD HH:mm" value={termForm.exam_date} onChangeText={value => setTermForm(current => ({ ...current, exam_date: value }))} />
          <Field label="Grade finalization deadline" placeholder="YYYY-MM-DD HH:mm" value={termForm.grade_finalization_deadline} onChangeText={value => setTermForm(current => ({ ...current, grade_finalization_deadline: value }))} />
          <Field label="Enrollment opens" placeholder="YYYY-MM-DD HH:mm" value={termForm.enrollment_opens_at} onChangeText={value => setTermForm(current => ({ ...current, enrollment_opens_at: value }))} />
          <Field label="Enrollment closes" placeholder="YYYY-MM-DD HH:mm" value={termForm.enrollment_closes_at} onChangeText={value => setTermForm(current => ({ ...current, enrollment_closes_at: value }))} />
          <TouchableOpacity
            style={[s.toggleRow, termForm.is_active && s.toggleRowActive]}
            onPress={() => setTermForm(current => ({ ...current, is_active: !current.is_active }))}
          >
            <View style={[s.toggleDot, termForm.is_active && s.toggleDotActive]} />
            <View style={{ flex: 1 }}>
              <Text style={s.toggleTitle}>{termForm.is_active ? 'Enrollment open' : 'Enrollment closed'}</Text>
              <Text style={s.toggleSub}>{termForm.is_active ? 'Students can submit applications when the date window allows it.' : 'Students cannot submit applications for this term.'}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={s.primaryBtn} onPress={saveTerm} disabled={savingTerm}>
            {savingTerm ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Save term rules</Text>}
          </TouchableOpacity>
        </View>

        <Text style={s.sectionTitle}>Configured Terms</Text>
        {terms.length === 0 ? (
          <View style={s.card}><Text style={s.sub}>No academic terms configured yet.</Text></View>
        ) : terms.map(term => (
          <TouchableOpacity key={term.id} style={s.card} onPress={() => setTermForm({
            school_year: term.school_year,
            semester: term.semester,
            exam_date: term.exam_date || '',
            grade_finalization_deadline: term.grade_finalization_deadline || '',
            enrollment_opens_at: term.enrollment_opens_at || '',
            enrollment_closes_at: term.enrollment_closes_at || '',
            is_active: term.is_active,
          })}>
            <Text style={s.title}>{term.school_year} - {term.semester.toUpperCase()}</Text>
            <Text style={s.sub}>Enrollment: {term.is_active ? 'Open' : 'Closed'}</Text>
            <Text style={s.sub}>Exam date: {term.exam_date || 'Not set'}</Text>
            <Text style={s.sub}>Grades final: {term.grade_finalization_deadline || 'Not set'}</Text>
            <Text style={s.sub}>Enrollment: {term.enrollment_opens_at || 'Anytime'} to {term.enrollment_closes_at || 'No close date'}</Text>
          </TouchableOpacity>
        ))}

        <Text style={s.sectionTitle}>Event Participation Approvals</Text>
        {events.length === 0 ? (
          <View style={s.card}><Text style={s.sub}>No event participation records yet.</Text></View>
        ) : events.map(event => (
          <View key={event.id} style={s.card}>
            <Text style={s.title}>{event.event_name}</Text>
            <Text style={s.sub}>{event.student?.first_name} {event.student?.last_name} - {event.points} pts - {event.status}</Text>
            <Text style={s.sub}>Verified by {event.verifier?.name || 'Faculty'}</Text>
            {event.status === 'pending' ? (
              <View style={s.actionRow}>
                <TouchableOpacity style={[s.actionBtn, s.approveBtn]} onPress={() => reviewEvent(event, 'approve')}>
                  <Text style={s.actionText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, s.rejectBtn]} onPress={() => reviewEvent(event, 'reject')}>
                  <Text style={s.actionText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder }) {
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F9' },
  body: { padding: 16, gap: 12, paddingBottom: 100 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 15 },
  statusCard: { borderRadius: 14, borderWidth: 1, padding: 15 },
  statusCardOpen: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  statusCardClosed: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusDot: { width: 14, height: 14, borderRadius: 7 },
  statusDotOpen: { backgroundColor: '#1D9E75' },
  statusDotClosed: { backgroundColor: '#E24B4A' },
  statusTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  statusMessage: { fontSize: 12, color: '#374151', marginTop: 3, lineHeight: 17, fontWeight: '700' },
  statusDetail: { fontSize: 12, color: '#4B5563', marginTop: 10, lineHeight: 18, fontWeight: '600' },
  title: { fontSize: 15, fontWeight: '900', color: '#111827' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 5, lineHeight: 18, fontWeight: '600' },
  sectionTitle: { fontSize: 13, color: '#374151', fontWeight: '900', marginTop: 4 },
  label: { fontSize: 12, color: '#6B7280', fontWeight: '900', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', borderRadius: 12, paddingHorizontal: 12, minHeight: 46, fontSize: 14, color: '#111827' },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#F9FAFB' },
  pillActive: { borderColor: '#378ADD', backgroundColor: '#E6F1FB' },
  pillText: { color: '#6B7280', fontSize: 12, fontWeight: '900' },
  pillTextActive: { color: '#378ADD' },
  primaryBtn: { backgroundColor: '#378ADD', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, backgroundColor: '#F9FAFB' },
  toggleRowActive: { borderColor: '#1D9E75', backgroundColor: '#E1F5EE' },
  toggleDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#D1D5DB' },
  toggleDotActive: { backgroundColor: '#1D9E75' },
  toggleTitle: { color: '#111827', fontSize: 13, fontWeight: '900' },
  toggleSub: { color: '#6B7280', fontSize: 11, fontWeight: '600', marginTop: 3, lineHeight: 16 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  approveBtn: { backgroundColor: '#1D9E75' },
  rejectBtn: { backgroundColor: '#E24B4A' },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
