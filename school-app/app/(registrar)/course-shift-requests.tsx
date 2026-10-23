// @ts-nocheck
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

const STATUSES = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const EMPTY_CREDIT = {
  source_subject_code: '',
  source_subject_name: '',
  target_subject_id: '',
  decision: 'credited',
  remarks: '',
};

export default function CourseShiftRequests() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [reviewRequest, setReviewRequest] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [creditRequest, setCreditRequest] = useState(null);
  const [creditForm, setCreditForm] = useState(EMPTY_CREDIT);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const response = await api.get('/registrar/course-shift-requests', {
        params: { status: status || undefined, page },
      });
      setRequests(response.data?.data ?? []);
      setLastPage(response.data?.last_page ?? 1);
    } catch (error) {
      Alert.alert('Could not load requests', error.response?.data?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, status]);

  const fetchSubjects = useCallback(async () => {
    try {
      const response = await api.get('/subjects');
      setSubjects(response.data ?? []);
    } catch (error) {
      Alert.alert('Could not load subjects', error.response?.data?.message ?? 'Subject credit options are unavailable.');
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter(request => [
      request.student?.name,
      request.student?.email,
      request.current_course?.name,
      request.requested_course?.name,
      request.school_year,
      request.semester,
      request.reason,
      request.remarks,
    ].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [requests, search]);

  const openCreditForm = request => {
    setCreditRequest(request);
    setCreditForm(EMPTY_CREDIT);
    setSubjectSearch('');
  };

  const submitCredit = async () => {
    if (!creditRequest) return;
    if (creditForm.decision === 'credited' && !creditForm.target_subject_id) {
      Alert.alert('Equivalent subject required', 'Select the subject to grant credit for.');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/registrar/course-shift-requests/${creditRequest.id}/credits`, {
        ...creditForm,
        source_subject_code: creditForm.source_subject_code.trim(),
        source_subject_name: creditForm.source_subject_name.trim(),
        target_subject_id: creditForm.decision === 'credited' ? creditForm.target_subject_id : null,
        remarks: creditForm.remarks.trim() || null,
      });
      setCreditRequest(null);
      await fetchRequests();
      Alert.alert('Evaluation recorded', 'The subject credit evaluation has been saved.');
    } catch (error) {
      Alert.alert('Could not save evaluation', error.response?.data?.message ?? 'Please check the details and try again.');
    } finally {
      setSaving(false);
    }
  };

  const submitReview = async () => {
    if (!reviewRequest) return;
    if (reviewDecision === 'reject' && !reviewRemarks.trim()) {
      Alert.alert('Remarks required', 'Please explain why the course-shift request is rejected.');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/registrar/course-shift-requests/${reviewRequest.id}/review`, {
        decision: reviewDecision,
        remarks: reviewRemarks.trim() || null,
      });
      setReviewRequest(null);
      await fetchRequests();
      Alert.alert('Request reviewed', `The course-shift request was ${reviewDecision}d.`);
    } catch (error) {
      Alert.alert('Could not review request', error.response?.data?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filteredSubjects = useMemo(() => {
    const query = subjectSearch.trim().toLowerCase();
    if (!query) return subjects.slice(0, 30);
    return subjects.filter(subject => `${subject.code} ${subject.name}`.toLowerCase().includes(query)).slice(0, 30);
  }, [subjectSearch, subjects]);

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <View style={[s.header, { paddingTop: 14 + insets.top }]}>
        <Text style={[s.title, { color: theme.text }]}>Course-Shift Requests</Text>
        <Text style={[s.subtitle, { color: theme.textSub }]}>Review course changes and subject credit evaluations.</Text>
      </View>

      <View style={[s.statusFilters, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {STATUSES.map(item => (
          <TouchableOpacity
            key={item.key || 'all'}
            style={[s.statusFilter, status === item.key && { backgroundColor: theme.primary }]}
            onPress={() => { setPage(1); setStatus(item.key); }}
          >
            <Text style={[s.statusFilterText, { color: theme.textSub }, status === item.key && s.statusFilterTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[s.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="search-outline" size={17} color={theme.textSub} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search student or course"
          placeholderTextColor={theme.textMuted}
          style={[s.searchInput, { color: theme.text }]}
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} />}
        >
          {visibleRequests.length ? visibleRequests.map(request => (
            <View key={request.id} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={s.cardHeading}>
                <View style={s.studentDetails}>
                  <Text style={[s.studentName, { color: theme.text }]}>{request.student?.name || 'Student account unavailable'}</Text>
                  <Text style={[s.meta, { color: theme.textSub }]}>{request.student?.email || '-'}</Text>
                  <Text style={[s.meta, { color: theme.textSub }]}>{request.school_year} · {formatSemester(request.semester)} semester</Text>
                </View>
                <Text style={[s.statusBadge, statusStyle(request.status, theme)]}>{capitalize(request.status)}</Text>
              </View>

              <View style={[s.courseRow, { borderTopColor: theme.border }]}>
                <View style={s.courseBlock}>
                  <Text style={[s.label, { color: theme.textSub }]}>Current course</Text>
                  <Text style={[s.courseName, { color: theme.text }]}>{request.current_course?.name || 'Not recorded'}</Text>
                </View>
                <Ionicons name="arrow-forward" size={17} color={theme.textSub} />
                <View style={s.courseBlock}>
                  <Text style={[s.label, { color: theme.textSub }]}>Requested course</Text>
                  <Text style={[s.courseName, { color: theme.text }]}>{request.requested_course?.name || 'Course unavailable'}</Text>
                </View>
              </View>

              <Text style={[s.label, { color: theme.textSub }]}>Reason</Text>
              <Text style={[s.bodyText, { color: theme.text }]}>{request.reason}</Text>
              {request.remarks ? (
                <Text style={[s.remarks, { backgroundColor: theme.bg, color: theme.textSub }]}>
                  <Text style={s.bold}>Review remarks: </Text>{request.remarks}
                </Text>
              ) : null}

              <View style={[s.creditsSection, { borderTopColor: theme.border }]}>
                <View style={s.sectionHeading}>
                  <Text style={[s.sectionTitle, { color: theme.text }]}>Subject credit evaluation</Text>
                  {request.status === 'pending' && (
                    <TouchableOpacity style={[s.smallButton, { backgroundColor: theme.primaryLight }]} onPress={() => openCreditForm(request)}>
                      <Text style={[s.smallButtonText, { color: theme.primary }]}>+ Record</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {request.credit_evaluations?.length ? request.credit_evaluations.map(evaluation => (
                  <View key={evaluation.id} style={s.evaluation}>
                    <Text style={[s.bodyText, { color: theme.text }]}>
                      <Text style={s.bold}>{evaluation.source_subject_code} · {evaluation.source_subject_name}</Text>
                      {' → '}
                      {evaluation.decision === 'credited'
                        ? `Credited as ${evaluation.target_subject?.code || 'equivalent subject'}`
                        : 'Not credited'}
                    </Text>
                    {evaluation.remarks ? <Text style={[s.meta, { color: theme.textSub }]}>{evaluation.remarks}</Text> : null}
                  </View>
                )) : <Text style={[s.meta, { color: theme.textSub }]}>No subject equivalencies recorded yet.</Text>}
              </View>

              {request.status === 'pending' && (
                <View style={s.actions}>
                  <TouchableOpacity
                    style={[s.actionButton, { backgroundColor: theme.dangerLight }]}
                    onPress={() => { setReviewRequest(request); setReviewDecision('reject'); setReviewRemarks(''); }}
                  >
                    <Text style={[s.actionText, { color: theme.danger }]}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionButton, { backgroundColor: theme.success }]}
                    onPress={() => { setReviewRequest(request); setReviewDecision('approve'); setReviewRemarks(''); }}
                  >
                    <Text style={[s.actionText, s.whiteText]}>Approve course shift</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )) : (
            <View style={s.empty}>
              <Ionicons name="checkmark-circle-outline" size={38} color={theme.textSub} />
              <Text style={[s.emptyTitle, { color: theme.text }]}>No course-shift requests found</Text>
              <Text style={[s.meta, { color: theme.textSub }]}>Try another status or search.</Text>
            </View>
          )}
          {lastPage > 1 && (
            <View style={s.pagination}>
              <TouchableOpacity
                style={[s.pageButton, { backgroundColor: theme.card, borderColor: theme.border }, page <= 1 && s.disabledButton]}
                disabled={page <= 1}
                onPress={() => setPage(current => current - 1)}
              >
                <Text style={[s.pageButtonText, { color: theme.primary }]}>Previous</Text>
              </TouchableOpacity>
              <Text style={[s.meta, { color: theme.textSub }]}>Page {page} of {lastPage}</Text>
              <TouchableOpacity
                style={[s.pageButton, { backgroundColor: theme.card, borderColor: theme.border }, page >= lastPage && s.disabledButton]}
                disabled={page >= lastPage}
                onPress={() => setPage(current => current + 1)}
              >
                <Text style={[s.pageButtonText, { color: theme.primary }]}>Next</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={!!reviewRequest} transparent animationType="fade" onRequestClose={() => setReviewRequest(null)}>
        <View style={s.backdrop}>
          <View style={[s.modal, { backgroundColor: theme.card }]}>
            <Text style={[s.modalTitle, { color: theme.text }]}>{reviewDecision === 'approve' ? 'Approve course shift' : 'Reject course shift'}</Text>
            <Text style={[s.meta, { color: theme.textSub }]}>{reviewRequest?.student?.name} · {reviewRequest?.requested_course?.name}</Text>
            <TextInput
              style={[s.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
              value={reviewRemarks}
              onChangeText={setReviewRemarks}
              placeholder={reviewDecision === 'reject' ? 'Remarks (required when rejecting)' : 'Review remarks (optional)'}
              placeholderTextColor={theme.textMuted}
              multiline
              maxLength={2000}
            />
            <ModalActions theme={theme} saving={saving} onCancel={() => setReviewRequest(null)} onSubmit={submitReview} submitLabel={reviewDecision === 'approve' ? 'Approve' : 'Reject'} destructive={reviewDecision === 'reject'} />
          </View>
        </View>
      </Modal>

      <Modal visible={!!creditRequest} transparent animationType="slide" onRequestClose={() => setCreditRequest(null)}>
        <View style={s.backdrop}>
          <View style={[s.modal, s.creditModal, { backgroundColor: theme.card }]}>
            <Text style={[s.modalTitle, { color: theme.text }]}>Record subject evaluation</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <TextInput
                style={[s.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
                value={creditForm.source_subject_code}
                onChangeText={value => setCreditForm(current => ({ ...current, source_subject_code: value }))}
                placeholder="Previous subject code"
                placeholderTextColor={theme.textMuted}
                maxLength={50}
              />
              <TextInput
                style={[s.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
                value={creditForm.source_subject_name}
                onChangeText={value => setCreditForm(current => ({ ...current, source_subject_name: value }))}
                placeholder="Previous subject name"
                placeholderTextColor={theme.textMuted}
                maxLength={255}
              />
              <Text style={[s.label, { color: theme.textSub }]}>Decision</Text>
              <View style={s.decisionRow}>
                {[
                  { key: 'credited', label: 'Credit subject' },
                  { key: 'not_credited', label: 'Do not credit' },
                ].map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[s.decisionButton, { backgroundColor: theme.bg, borderColor: theme.border }, creditForm.decision === option.key && { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
                    onPress={() => setCreditForm(current => ({ ...current, decision: option.key, target_subject_id: option.key === 'credited' ? current.target_subject_id : '' }))}
                  >
                    <Text style={[s.decisionText, { color: theme.textSub }, creditForm.decision === option.key && { color: theme.primary, fontWeight: '800' }]}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {creditForm.decision === 'credited' && (
                <>
                  <Text style={[s.label, { color: theme.textSub }]}>Equivalent subject</Text>
                  <TextInput
                    style={[s.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
                    value={subjectSearch}
                    onChangeText={setSubjectSearch}
                    placeholder="Search active subjects"
                    placeholderTextColor={theme.textMuted}
                  />
                  <View style={[s.subjectList, { borderColor: theme.border }]}>
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {filteredSubjects.map(subject => (
                        <TouchableOpacity
                          key={subject.id}
                          style={[s.subjectOption, { borderBottomColor: theme.border }, String(creditForm.target_subject_id) === String(subject.id) && { backgroundColor: theme.primaryLight }]}
                          onPress={() => setCreditForm(current => ({ ...current, target_subject_id: subject.id }))}
                        >
                          <Text style={[s.subjectCode, { color: theme.primary }]}>{subject.code}</Text>
                          <Text style={[s.subjectName, { color: theme.text }]}>{subject.name}</Text>
                        </TouchableOpacity>
                      ))}
                      {filteredSubjects.length === 0 && <Text style={[s.meta, s.noSubjects, { color: theme.textSub }]}>No matching subjects.</Text>}
                    </ScrollView>
                  </View>
                </>
              )}
              <TextInput
                style={[s.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
                value={creditForm.remarks}
                onChangeText={value => setCreditForm(current => ({ ...current, remarks: value }))}
                placeholder="Equivalency remarks (optional)"
                placeholderTextColor={theme.textMuted}
                maxLength={2000}
              />
            </ScrollView>
            <ModalActions theme={theme} saving={saving} onCancel={() => setCreditRequest(null)} onSubmit={submitCredit} submitLabel="Record evaluation" />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ModalActions({ theme, saving, onCancel, onSubmit, submitLabel, destructive = false }) {
  return (
    <View style={s.modalActions}>
      <TouchableOpacity style={[s.cancelButton, { borderColor: theme.border }]} onPress={onCancel} disabled={saving}>
        <Text style={[s.cancelText, { color: theme.textSub }]}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.confirmButton, { backgroundColor: destructive ? theme.danger : theme.primary }]} onPress={onSubmit} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={[s.actionText, s.whiteText]}>{submitLabel}</Text>}
      </TouchableOpacity>
    </View>
  );
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Pending';
}

function formatSemester(value) {
  return value === '1st' ? '1st' : value === '2nd' ? '2nd' : value ? capitalize(value) : '-';
}

function statusStyle(status, theme) {
  if (status === 'approved') return { color: theme.success, backgroundColor: theme.successLight };
  if (status === 'rejected') return { color: theme.danger, backgroundColor: theme.dangerLight };
  return { color: '#8A6700', backgroundColor: '#FEF3C7' };
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 18, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 11, marginTop: 3 },
  statusFilters: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 9, padding: 3, borderWidth: 1, borderRadius: 12, gap: 4 },
  statusFilter: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  statusFilterText: { fontSize: 10, fontWeight: '700' },
  statusFilterTextActive: { color: '#fff', fontWeight: '800' },
  searchBox: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 11, borderWidth: 1, borderRadius: 12 },
  searchInput: { flex: 1, fontSize: 12, paddingVertical: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
  card: { borderWidth: 1, borderRadius: 15, padding: 13 },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  studentDetails: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '800' },
  meta: { fontSize: 10, marginTop: 3 },
  statusBadge: { overflow: 'hidden', borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '800' },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 10, paddingTop: 10, borderTopWidth: 1 },
  courseBlock: { flex: 1 },
  label: { fontSize: 10, fontWeight: '700', marginBottom: 3 },
  courseName: { fontSize: 12, fontWeight: '800' },
  bodyText: { fontSize: 12, lineHeight: 18 },
  remarks: { padding: 9, borderRadius: 9, marginTop: 9, fontSize: 11, lineHeight: 17 },
  bold: { fontWeight: '800' },
  creditsSection: { marginTop: 12, paddingTop: 11, borderTopWidth: 1, gap: 7 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '800' },
  smallButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallButtonText: { fontSize: 10, fontWeight: '800' },
  evaluation: { gap: 2, paddingVertical: 3 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  actionButton: { minHeight: 38, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 13, borderRadius: 9 },
  actionText: { fontSize: 11, fontWeight: '800' },
  whiteText: { color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 55, gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '800' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  pageButton: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  pageButtonText: { fontSize: 11, fontWeight: '800' },
  disabledButton: { opacity: 0.4 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(20,15,15,0.45)' },
  modal: { maxHeight: '88%', padding: 17, borderRadius: 18 },
  creditModal: { maxHeight: '92%' },
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 5 },
  input: { minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, fontSize: 12, marginTop: 10 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  cancelButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderRadius: 9 },
  cancelText: { fontSize: 11, fontWeight: '700' },
  confirmButton: { minHeight: 40, minWidth: 100, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 9 },
  decisionRow: { flexDirection: 'row', gap: 8 },
  decisionButton: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  decisionText: { fontSize: 10, fontWeight: '700' },
  subjectList: { maxHeight: 170, borderWidth: 1, borderRadius: 10, overflow: 'hidden', marginTop: 8 },
  subjectOption: { flexDirection: 'row', gap: 9, paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  subjectCode: { minWidth: 60, fontSize: 10, fontWeight: '800' },
  subjectName: { flex: 1, fontSize: 10 },
  noSubjects: { padding: 12 },
});
