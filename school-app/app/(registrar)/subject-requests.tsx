// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

const C = {
  bg: '#FBF8F5', card: '#FFFFFF', border: '#F0E8E3',
  text: '#2A1B1F', sub: '#7A666B', blue: '#B5233D', blueLight: '#F9E4E8',
  green: '#1E6B3A', red: '#B5233D', yellow: '#8A6700',
};
const HEADER_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 10 : 52;

export default function SubjectRequests({ embedded = false }) {
  const { theme } = useTheme();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('awaiting');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [showRequestFilters, setShowRequestFilters] = useState(false);
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get('/registrar/subject-change-requests');
      setRequests(res.data || []);
    } catch (e) {
      Alert.alert('Could not load requests', e.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const statusRequests = filter === 'history'
    ? requests.filter(request => request.status !== 'pending')
    : requests.filter(request => request.status === 'pending');
  const yearOptions = [...new Set(statusRequests.map(request => request.section?.school_year).filter(Boolean))].sort();
  const semesterOptions = [...new Set(statusRequests.map(request => request.section?.semester).filter(Boolean))].sort();
  const courseOptions = [...new Set(statusRequests.map(request => request.section?.course).filter(Boolean))].sort();
  const searchTerm = search.trim().toLowerCase();
  const visibleRequests = statusRequests.filter(request => {
    if (actionFilter !== 'all' && request.action !== actionFilter) return false;
    if (yearFilter !== 'all' && request.section?.school_year !== yearFilter) return false;
    if (semesterFilter !== 'all' && request.section?.semester !== semesterFilter) return false;
    if (courseFilter !== 'all' && request.section?.course !== courseFilter) return false;
    if (!searchTerm) return true;
    const searchable = [
      request.student?.name, request.student?.email,
      request.subject?.code, request.subject?.name,
      request.section?.name, request.section?.course, request.section?.school_year,
      request.section?.semester, request.action, request.reason,
      request.registrar_remarks, request.reviewer?.name,
    ].filter(Boolean).join(' ').toLowerCase();
    return searchable.includes(searchTerm);
  });
  const hasActiveFilters = actionFilter !== 'all' || yearFilter !== 'all' || semesterFilter !== 'all' || courseFilter !== 'all';

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const openReview = (request, nextAction) => {
    setSelected(request);
    setAction(nextAction);
    setRemarks('');
  };

  const submitReview = async () => {
    if (!selected) return;
    if (action === 'reject' && !remarks.trim()) {
      Alert.alert('Remarks required', 'Please explain why the request is rejected.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/registrar/subject-change-requests/${selected.id}/${action}`, {
        registrar_remarks: remarks.trim() || null,
      });
      setSelected(null);
      await fetchRequests();
      Alert.alert('Request reviewed', `The subject request was ${action}d.`);
    } catch (e) {
      Alert.alert('Could not review request', e.response?.data?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      {!embedded && <View style={[s.header, { backgroundColor: theme.bg }]}>
        <Text style={s.pageTitle}>Requests</Text>
        <Text style={s.pageSubtitle}>Approve or reject add and drop requests</Text>
      </View>}

      <View style={[s.filters, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {[
          { key: 'awaiting', label: 'Awaiting' },
          { key: 'history', label: 'History' },
        ].map(item => (
          <TouchableOpacity key={item.key} style={[s.filter, filter === item.key && { backgroundColor: theme.primary }]} onPress={() => setFilter(item.key)}>
            <Text style={[s.filterText, { color: theme.textSub }, filter === item.key && s.filterTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.searchAndFilter}>
        <View style={s.searchRow}>
          <View style={[s.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={16} color={theme.textSub} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search student, subject, or section"
              placeholderTextColor={theme.textMuted}
              style={[s.searchInput, { color: theme.text }]}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>
        <TouchableOpacity
            style={[s.filterButton, { backgroundColor: theme.card, borderColor: theme.primary }, hasActiveFilters && { backgroundColor: theme.primaryLight }]}
            onPress={() => setShowRequestFilters(true)}
          >
            <Ionicons name="options-outline" size={15} color={theme.primary} />
            <Text style={[s.filterButtonText, { color: theme.primary }]}>Filter</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showRequestFilters} transparent animationType="slide" onRequestClose={() => setShowRequestFilters(false)}>
        <View style={s.filterBackdrop}>
          <View style={[s.filterSheet, { backgroundColor: theme.bg }]}>
            <View style={[s.filterSheetHeader, { borderBottomColor: theme.border }]}>
              <View>
                <Text style={[s.filterSheetTitle, { color: theme.text }]}>Filter requests</Text>
                <Text style={[s.filterSheetSubtitle, { color: theme.textSub }]}>Choose which subject requests to show</Text>
              </View>
              <TouchableOpacity style={[s.filterClose, { backgroundColor: theme.card }]} onPress={() => setShowRequestFilters(false)} accessibilityLabel="Close filters">
                <Ionicons name="close" size={19} color={theme.textSub} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.filterSheetBody}>
              <Text style={[s.filterLabel, { color: theme.textSub }]}>Request action</Text>
              <View style={s.actionFilters}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'add', label: 'Add subject' },
                  { key: 'drop', label: 'Drop subject' },
                ].map(item => (
                  <TouchableOpacity key={item.key} style={[s.actionFilter, { backgroundColor: theme.card, borderColor: theme.border }, actionFilter === item.key && { backgroundColor: theme.primaryLight, borderColor: theme.primary }]} onPress={() => setActionFilter(item.key)}>
                    <Text style={[s.actionFilterText, { color: theme.textSub }, actionFilter === item.key && { color: theme.primary, fontWeight: '800' }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <RequestFilterGroup label="School year" options={yearOptions} value={yearFilter} onChange={setYearFilter} theme={theme} allLabel="All years" />
              <RequestFilterGroup label="Semester" options={semesterOptions} value={semesterFilter} onChange={setSemesterFilter} theme={theme} allLabel="All semesters" formatLabel={formatSemester} />
              <RequestFilterGroup label="Course" options={courseOptions} value={courseFilter} onChange={setCourseFilter} theme={theme} allLabel="All courses" />
            </ScrollView>
            <View style={[s.filterActions, { borderTopColor: theme.border }]}>
              <TouchableOpacity style={[s.filterReset, { backgroundColor: theme.card, borderColor: theme.primary }]} onPress={() => { setActionFilter('all'); setYearFilter('all'); setSemesterFilter('all'); setCourseFilter('all'); }}>
                <Text style={[s.filterResetText, { color: theme.primary }]}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.filterDone, { backgroundColor: theme.primary }]} onPress={() => setShowRequestFilters(false)}>
                <Text style={s.filterDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.blue} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.body, visibleRequests.length === 0 && s.emptyBody]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} />}
        >
          {visibleRequests.length ? visibleRequests.map(req => (
            <View key={req.id} style={s.card}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>{req.action?.toUpperCase()} {req.subject?.code}</Text>
                  <Text style={s.meta}>{req.subject?.name}</Text>
                  <Text style={s.meta}>{req.section?.name || 'Direct enrollment'}</Text>
                </View>
                <Text style={[s.status, statusStyle(req.status)]}>{req.status}</Text>
              </View>
              <Text style={s.student}>{req.student?.name} | {req.student?.email}</Text>
              {req.status !== 'pending' && req.reviewed_at ? (
                <Text style={s.meta}>Reviewed {formatReviewDate(req.reviewed_at)}{req.reviewer?.name ? ` by ${req.reviewer.name}` : ''}</Text>
              ) : null}
              <Text style={s.reason}>Reason: {req.reason}</Text>
              {req.registrar_remarks ? <Text style={s.reason}>Registrar: {req.registrar_remarks}</Text> : null}
              {req.status === 'pending' ? (
                <View style={s.actions}>
                  <TouchableOpacity style={s.approveBtn} onPress={() => openReview(req, 'approve')}>
                    <Text style={s.actionText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.rejectBtn} onPress={() => openReview(req, 'reject')}>
                    <Text style={s.actionText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )) : (
            <View style={s.emptyState}>
              <View style={s.emptyIconCircle}><Ionicons name="checkmark" size={21} color={C.blue} /></View>
              <Text style={s.emptyTitle}>{searchTerm || hasActiveFilters ? 'No matching requests' : filter === 'history' ? 'No request history yet' : 'All caught up'}</Text>
              <Text style={s.empty}>{searchTerm || hasActiveFilters ? 'Try another search or adjust your filters.' : filter === 'history' ? 'Approved and rejected add or drop requests will appear here.' : 'No pending add or drop requests right now.'}</Text>
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={!!selected} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>{action === 'approve' ? 'Approve request' : 'Reject request'}</Text>
            <Text style={s.meta}>{selected?.student?.name} requested to {selected?.action} {selected?.subject?.code}.</Text>
            <TextInput
              style={s.input}
              value={remarks}
              onChangeText={setRemarks}
              placeholder={action === 'approve' ? 'Optional registrar remarks' : 'Reason for rejection'}
              placeholderTextColor="#94A3B8"
              multiline
            />
            <View style={s.actions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setSelected(null)} disabled={submitting}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={action === 'approve' ? s.approveBtn : s.rejectBtn} onPress={submitReview} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.actionText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

}

function RequestFilterGroup({ label, options, value, onChange, theme, allLabel, formatLabel = value => value }) {
  return (
    <>
      <Text style={[s.filterLabel, { color: theme.textSub }]}>{label}</Text>
      <View style={s.actionFilters}>
        {[{ key: 'all', label: allLabel }, ...options.map(option => ({ key: option, label: formatLabel(option) }))].map(option => (
          <TouchableOpacity
            key={`${label}-${option.key}`}
            style={[s.actionFilter, { backgroundColor: theme.card, borderColor: theme.border }, value === option.key && { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
            onPress={() => onChange(option.key)}
          >
            <Text style={[s.actionFilterText, { color: theme.textSub }, value === option.key && { color: theme.primary, fontWeight: '800' }]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

function formatSemester(value) {
  const normalized = String(value).toLowerCase();
  if (normalized === '1st') return '1st semester';
  if (normalized === '2nd') return '2nd semester';
  return normalized === 'summer' ? 'Summer' : value;
}

function statusStyle(status) {
  if (status === 'approved') return { color: C.green, backgroundColor: '#DCFCE7' };
  if (status === 'rejected') return { color: C.red, backgroundColor: '#FEE2E2' };
  return { color: C.yellow, backgroundColor: '#FEF3C7' };
}

function formatReviewDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'date unavailable' : date.toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' });
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: HEADER_TOP, paddingHorizontal: 18, paddingBottom: 8 },
  pageTitle: { color: C.text, fontSize: 24, fontWeight: '700', fontFamily: 'serif' },
  pageSubtitle: { color: C.sub, fontSize: 10, marginTop: 2 },
  filters: { flexDirection: 'row', padding: 3, borderWidth: 1, borderRadius: 12, gap: 4, marginHorizontal: 16, marginBottom: 8 },
  filter: { flex: 1, flexBasis: 0, minWidth: 0, minHeight: 31, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  filterText: { fontSize: 10, fontWeight: '700' },
  filterTextActive: { color: '#fff', fontWeight: '800' },
  searchAndFilter: { paddingHorizontal: 16, marginBottom: 4 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  searchBox: { flex: 1, height: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  searchInput: { flex: 1, color: C.text, fontSize: 11, paddingVertical: 6 },
  filterButton: { minHeight: 40, paddingHorizontal: 9, borderWidth: 1, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  filterButtonText: { fontSize: 10, fontWeight: '600' },
  filterSheetBody: { paddingTop: 16, paddingBottom: 10 },
  actionFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 11 },
  actionFilter: { minHeight: 36, paddingHorizontal: 13, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actionFilterText: { fontSize: 11, fontWeight: '600' },
  filterBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(35,20,24,0.38)' },
  filterSheet: { maxHeight: '82%', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14 },
  filterSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 15, borderBottomWidth: 1 },
  filterSheetTitle: { fontSize: 17, fontWeight: '800' },
  filterSheetSubtitle: { fontSize: 11, marginTop: 3 },
  filterClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  filterLabel: { fontSize: 11, fontWeight: '800', marginTop: 16 },
  filterActions: { flexDirection: 'row', gap: 9, paddingTop: 12, marginTop: 18, borderTopWidth: 1 },
  filterReset: { flex: 1, height: 43, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  filterResetText: { fontSize: 12, fontWeight: '700' },
  filterDone: { flex: 1.5, height: 43, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  filterDoneText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  body: { paddingHorizontal: 16, paddingTop: 4, gap: 10, paddingBottom: 28 },
  emptyBody: { flexGrow: 1, justifyContent: 'center', paddingTop: 0, paddingBottom: 52 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 13, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { color: C.text, fontWeight: '800', fontSize: 13 },
  meta: { color: C.sub, fontSize: 11, marginTop: 2 },
  student: { color: C.text, fontSize: 11, fontWeight: '800' },
  reason: { color: C.sub, fontSize: 11, lineHeight: 17 },
  status: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: '900', textTransform: 'capitalize' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  approveBtn: { flex: 1, backgroundColor: C.green, borderRadius: 10, padding: 11, alignItems: 'center' },
  rejectBtn: { flex: 1, backgroundColor: C.red, borderRadius: 10, padding: 11, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '900' },
  emptyState: { alignItems: 'center', paddingHorizontal: 20 },
  emptyIconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  emptyTitle: { color: C.text, fontSize: 16, fontFamily: 'serif', fontWeight: '700', marginBottom: 4 },
  empty: { color: C.sub, textAlign: 'center', fontSize: 10, lineHeight: 15, maxWidth: 240 },
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.5)', padding: 18 },
  modal: { backgroundColor: C.card, borderRadius: 14, padding: 16 },
  modalTitle: { color: C.text, fontSize: 17, fontWeight: '900', marginBottom: 6 },
  input: { minHeight: 96, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, marginTop: 12, textAlignVertical: 'top', color: C.text },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  cancelText: { color: C.sub, fontWeight: '900' },
});
