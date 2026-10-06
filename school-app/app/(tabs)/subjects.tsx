// @ts-nocheck
// app/(tabs)/subjects.tsx — Student: view enrolled subjects

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, Platform, StatusBar, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import api from '../../src/api';
import HeaderGradient from '../components/ui/HeaderGradient';
import { useTheme } from '../../src/theme-context';

const C = {
  blue: '#378ADD', blueLight: '#E6F1FB',
  green: '#1D9E75', greenLight: '#E1F5EE',
  warning: '#BA7517', warningLight: '#FFF3CD',
  bg: '#F4F6F9', card: '#FFFFFF', border: '#EFEFEF',
  text: '#1A1A2E', sub: '#6B7280', muted: '#B0B7C3',
};
const HEADER_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 10 : 52;

const DAY_COLORS = {
  MWF: { bg: C.blueLight,   text: C.blue    },
  TTH: { bg: C.greenLight,  text: C.green   },
  SAT: { bg: C.warningLight,text: C.warning },
};

export default function MySubjects() {
  const { theme } = useTheme();
  const [data, setData]         = useState(null);
  const [requests, setRequests] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestModal, setRequestModal] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSubjects = useCallback(async () => {
    try {
      const settingsRes = await api.get('/enrollment/settings').catch(() => ({ data: null }));
      const activeTerm = settingsRes.data?.term;
      const [subjectsRes, requestsRes, sectionsRes] = await Promise.all([
        api.get('/my-subjects'),
        api.get('/my-subject-change-requests'),
        api.get('/sections', {
          params: activeTerm ? {
            school_year: activeTerm.school_year,
            semester: activeTerm.semester,
          } : undefined,
        }),
      ]);
      setData(subjectsRes.data);
      setRequests(requestsRes.data || []);
      setOfferings((sectionsRes.data || []).flatMap(section =>
        (section.section_subjects || []).map(offering => ({
          ...offering.subject,
          offering_id: offering.id,
          section_id: section.id,
          section_name: section.name,
          teacher: offering.teacher?.name,
          day: offering.day,
          time_start: offering.time_start,
          time_end: offering.time_end,
          room: offering.room,
        })).filter(subject => subject?.id)
      ));
    } catch (e) { console.log(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    Promise.resolve().then(fetchSubjects);
  }, [fetchSubjects]);

  const totalUnits = data?.subjects?.reduce((sum, s) => sum + s.units_lec + s.units_lab, 0) ?? 0;
  const enrolledSubjectIds = new Set((data?.subjects || []).map(subject => subject.subject_id));
  const addableOfferings = offerings.filter(subject => !enrolledSubjectIds.has(subject.id));
  const pendingKey = (action, subjectId, sectionId) => requests.some(req =>
    req.status === 'pending'
    && req.action === action
    && Number(req.subject_id) === Number(subjectId)
    && Number(req.section_id || 0) === Number(sectionId || 0)
  );

  const openRequest = (action, subject) => {
    setRequestModal({ action, subject });
    setReason('');
  };

  const submitRequest = async () => {
    if (!requestModal?.subject) return;
    if (reason.trim().length < 5) {
      Alert.alert('Reason required', 'Please explain why you are requesting this change.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/my-subject-change-requests', {
        action: requestModal.action,
        subject_id: requestModal.action === 'add' ? requestModal.subject.id : requestModal.subject.subject_id,
        section_id: requestModal.subject.section_id ?? null,
        reason: reason.trim(),
      });
      setRequestModal(null);
      await fetchSubjects();
      Alert.alert('Request sent', 'The registrar will review your subject request.');
    } catch (e) {
      Alert.alert('Could not send request', e.response?.data?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}> 
      <HeaderGradient
        title="My Subjects"
        subtitle={data?.sections?.[0]?.name ?? 'No section assigned yet'}
        initials="MS"
        stats={[
          { label: 'Subjects', value: data?.subjects?.length ?? 0, accent: '#FDE68A' },
          { label: 'Units', value: totalUnits, accent: '#A7F3D0' },
          { label: 'Sections', value: data?.sections?.length ?? 0, accent: '#C7D2FE' },
        ]}
      />

      {loading ? (
        <View style={[s.center, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchSubjects(); }} />}>

          {/* Summary bar */}
          {data?.subjects?.length > 0 && (
            <View style={[s.summaryBar, { backgroundColor: theme.card, borderColor: theme.border }]}> 
              <View style={s.summaryItem}>
                <Text style={[s.summaryCount, { color: theme.primary }]}>{data.subjects.length}</Text>
                <Text style={[s.summaryLabel, { color: theme.textMuted }]}>Subjects</Text>
              </View>
              <View style={[s.summaryDivider, { backgroundColor: theme.border }]} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryCount, { color: theme.primary }]}>{totalUnits}</Text>
                <Text style={[s.summaryLabel, { color: theme.textMuted }]}>Total Units</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={s.summaryCount}>{data.sections?.length ?? 0}</Text>
                <Text style={s.summaryLabel}>Sections</Text>
              </View>
            </View>
          )}

          {/* Subject list */}
          {!data?.subjects?.length ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>📚</Text>
              <Text style={[s.emptyTitle, { color: theme.text }]}>No subjects yet</Text>
              <Text style={[s.emptySub, { color: theme.textSub }]}>{"You haven't been assigned to a section yet."}{'\n'}Please contact the registrar.</Text>
            </View>
          ) : (
            data.subjects.map((sub, i) => {
              const dayColor = DAY_COLORS[sub.day] ?? { bg: C.bg, text: C.sub };
              return (
                <View key={i} style={[s.subjectCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
                  <View style={s.subjectTop}>
                    <View style={[s.codeTag, { backgroundColor: theme.primaryLight }]}> 
                      <Text style={[s.codeText, { color: theme.primary }]}>{sub.code}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.subjectName, { color: theme.text }]}>{sub.name}</Text>
                      <Text style={[s.sectionName, { color: theme.textSub }]}>📍 {sub.section_name}</Text>
                    </View>
                    <View style={[s.unitsTag, { backgroundColor: theme.bg }]}> 
                      <Text style={[s.unitsText, { color: theme.text }]}>{sub.units_lec + sub.units_lab}</Text>
                      <Text style={[s.unitsLabel, { color: theme.textSub }]}>units</Text>
                    </View>
                  </View>

                  <View style={s.subjectBottom}>
                    {/* Schedule */}
                    {sub.day && (
                      <View style={[s.dayBadge, { backgroundColor: dayColor.bg }]}>
                        <Text style={[s.dayText, { color: dayColor.text }]}>{sub.day}</Text>
                      </View>
                    )}
                    {sub.time_start && (
                      <Text style={[s.schedText, { color: theme.textSub }]}> 
                        🕐 {sub.time_end ? `${sub.time_start} – ${sub.time_end}` : sub.time_start}
                      </Text>
                    )}
                    {sub.room && (
                      <Text style={[s.schedText, { color: theme.textSub }]}>🚪 {sub.room}</Text>
                    )}
                    {sub.teacher && (
                      <Text style={[s.teacherText, { color: theme.textSub }]}>👨‍🏫 {sub.teacher}</Text>
                    )}
                  </View>

                  <View style={s.unitDetailRow}>
                    <Text style={[s.unitDetailText, { color: theme.textMuted }]}>Lec: {sub.units_lec} units</Text>
                    <Text style={[s.unitDetailText, { color: theme.textMuted }]}>Lab: {sub.units_lab} units</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.requestBtn, pendingKey('drop', sub.subject_id, sub.section_id) && s.requestBtnDisabled]}
                    onPress={() => openRequest('drop', sub)}
                    disabled={pendingKey('drop', sub.subject_id, sub.section_id)}
                  >
                    <Text style={s.requestBtnText}>
                      {pendingKey('drop', sub.subject_id, sub.section_id) ? 'Drop request pending' : 'Request drop'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          <Text style={[s.blockTitle, { color: theme.text }]}>Add Subject Request</Text>
          {addableOfferings.length ? addableOfferings.slice(0, 20).map(subject => (
            <View key={subject.offering_id} style={[s.subjectCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={s.subjectTop}>
                <View style={[s.codeTag, { backgroundColor: theme.primaryLight }]}>
                  <Text style={[s.codeText, { color: theme.primary }]}>{subject.code}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.subjectName, { color: theme.text }]}>{subject.name}</Text>
                  <Text style={[s.sectionName, { color: theme.textSub }]}>{subject.section_name}</Text>
                  <Text style={[s.unitDetailText, { color: theme.textMuted }]}>
                    {[subject.day, subject.time_start && `${subject.time_start}-${subject.time_end || ''}`, subject.room].filter(Boolean).join(' | ') || 'Schedule TBA'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[s.requestBtn, pendingKey('add', subject.id, subject.section_id) && s.requestBtnDisabled]}
                onPress={() => openRequest('add', subject)}
                disabled={pendingKey('add', subject.id, subject.section_id)}
              >
                <Text style={s.requestBtnText}>
                  {pendingKey('add', subject.id, subject.section_id) ? 'Add request pending' : 'Request add'}
                </Text>
              </TouchableOpacity>
            </View>
          )) : (
            <Text style={[s.emptySub, { color: theme.textSub }]}>No additional section offerings are available right now.</Text>
          )}

          <Text style={[s.blockTitle, { color: theme.text }]}>Request History</Text>
          {requests.length ? requests.map(req => (
            <View key={req.id} style={[s.historyRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[s.subjectName, { color: theme.text }]}>{req.action?.toUpperCase()} {req.subject?.code}</Text>
              <Text style={[s.sectionName, { color: theme.textSub }]}>{req.subject?.name} | {req.section?.name || 'Direct enrollment'}</Text>
              <Text style={[s.unitDetailText, { color: theme.textMuted }]}>Status: {req.status}</Text>
              {req.registrar_remarks ? <Text style={[s.unitDetailText, { color: theme.textMuted }]}>Registrar: {req.registrar_remarks}</Text> : null}
            </View>
          )) : (
            <Text style={[s.emptySub, { color: theme.textSub }]}>No subject change requests yet.</Text>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      <Modal visible={!!requestModal} animationType="fade" transparent>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              Request {requestModal?.action} subject
            </Text>
            <Text style={s.modalSub}>
              {requestModal?.subject?.code} - {requestModal?.subject?.name}
            </Text>
            <TextInput
              style={s.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Explain your reason..."
              placeholderTextColor={C.muted}
              multiline
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setRequestModal(null)} disabled={submitting}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.submitRequestBtn} onPress={submitRequest} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitRequestText}>Send request</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: C.blue, paddingTop: HEADER_TOP, paddingHorizontal: 16, paddingBottom: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  body: { padding: 12, gap: 10, paddingBottom: 24 },
  summaryBar: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 4, borderWidth: 1, borderColor: C.border },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryCount: { fontSize: 22, fontWeight: '800', color: C.blue },
  summaryLabel: { fontSize: 11, color: C.muted, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },
  subjectCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, elevation: 2 },
  subjectTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  codeTag: { backgroundColor: C.blueLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  codeText: { color: C.blue, fontWeight: '800', fontSize: 12 },
  subjectName: { fontSize: 14, fontWeight: '700', color: C.text, lineHeight: 20 },
  sectionName: { fontSize: 11, color: C.muted, marginTop: 2 },
  unitsTag: { alignItems: 'center', backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  unitsText: { fontSize: 18, fontWeight: '800', color: C.text },
  unitsLabel: { fontSize: 9, color: C.muted },
  subjectBottom: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 },
  dayBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  dayText: { fontSize: 11, fontWeight: '700' },
  schedText: { fontSize: 12, color: C.sub },
  teacherText: { fontSize: 12, color: C.sub },
  unitDetailRow: { flexDirection: 'row', gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  unitDetailText: { fontSize: 11, color: C.muted },
  blockTitle: { fontSize: 15, fontWeight: '800', marginTop: 14, marginBottom: 4 },
  requestBtn: { marginTop: 10, backgroundColor: C.blue, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  requestBtnDisabled: { backgroundColor: C.muted },
  requestBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  historyRow: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.48)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: C.text },
  modalSub: { fontSize: 13, color: C.sub, marginTop: 6, marginBottom: 12 },
  reasonInput: { minHeight: 100, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, color: C.text, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 13, alignItems: 'center' },
  cancelText: { color: C.sub, fontWeight: '800' },
  submitRequestBtn: { flex: 1, backgroundColor: C.blue, borderRadius: 10, padding: 13, alignItems: 'center' },
  submitRequestText: { color: '#fff', fontWeight: '800' },
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.text },
  emptySub: { fontSize: 13, color: C.muted, marginTop: 4, textAlign: 'center', lineHeight: 20 },
});
