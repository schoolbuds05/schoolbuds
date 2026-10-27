// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Modal,
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

const EMPTY_FILTERS = { subject_type: '', department_id: '' };

export default function AdminDepartments() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
  const [owners, setOwners] = useState({});
  const [search, setSearch] = useState('');
  const [pageInput, setPageInput] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterDraft, setFilterDraft] = useState(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [departmentSubject, setDepartmentSubject] = useState(null);
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async (page = pagination.current_page) => {
    try {
      const params = { page, search: search.trim() || undefined };
      if (filters.subject_type) params.subject_type = filters.subject_type;
      if (filters.department_id) params.department_id = filters.department_id;
      const response = await api.get('/teaching-eligibility/subject-departments', { params });
      const data = response.data;
      setRows(data?.rows?.data || []);
      setDepartments(data?.departments || []);
      setPagination({
        current_page: data?.rows?.current_page || 1,
        last_page: data?.rows?.last_page || 1,
        total: data?.rows?.total || 0,
        from: data?.rows?.from || 0,
        to: data?.rows?.to || 0,
      });
      setOwners({});
    } catch (error) {
      Alert.alert('Could not load subjects', error.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, pagination.current_page, search]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => load(1), search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [filters, search]);

  const ownerFor = subject => {
    if (!subject) return null;
    return Object.prototype.hasOwnProperty.call(owners, subject.id) ? owners[subject.id] : subject.department_id ?? null;
  };
  const isDirty = subject => Boolean(subject) && Number(ownerFor(subject) ?? 0) !== Number(subject.department_id ?? 0);

  const saveOwner = async subject => {
    setSavingId(subject.id);
    try {
      const departmentId = ownerFor(subject);
      const response = await api.put(`/teaching-eligibility/subject-departments/${subject.id}`, { department_id: departmentId });
      setRows(current => current.map(row => row.id === subject.id ? { ...row, department_id: departmentId, department: departments.find(item => item.id === departmentId) || null } : row));
      setOwners(current => { const next = { ...current }; delete next[subject.id]; return next; });
      Alert.alert('Saved', response.data?.message || 'Managing department updated.');
    } catch (error) {
      Alert.alert('Could not save department', error.response?.data?.message || 'Please try again.');
    } finally {
      setSavingId(null);
    }
  };

  const applyFilters = () => {
    setFilters(filterDraft);
    setFilterOpen(false);
  };

  const visibleDepartments = departments.filter(department => department.name.toLowerCase().includes(departmentSearch.toLowerCase()));
  const pageNumbers = Array.from({ length: pagination.last_page }, (_, index) => index + 1)
    .filter(page => page === 1 || page === pagination.last_page || Math.abs(page - pagination.current_page) <= 1);
  const jumpToPage = () => {
    const requestedPage = Number.parseInt(pageInput, 10);
    if (!Number.isFinite(requestedPage) || requestedPage < 1 || requestedPage > pagination.last_page) {
      Alert.alert('Invalid page', `Enter a page from 1 to ${pagination.last_page}.`);
      return;
    }
    setPageInput('');
    load(requestedPage);
  };
  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: Math.max(insets.top, 14) + 8 }]}>
        <View style={s.titleRow}>
          <View style={s.titleCopy}>
            <Text style={s.eyebrow}>ACADEMICS</Text>
            <Text style={s.title}>Subject departments</Text>
            <Text style={s.subtitle}>Choose who manages each subject</Text>
          </View>
          <TouchableOpacity style={s.refreshButton} onPress={() => { setRefreshing(true); load(1); }} accessibilityLabel="Refresh subjects">
            <Feather name="rotate-cw" size={19} color="#AE1234" />
          </TouchableOpacity>
        </View>
        <View style={s.searchRow}>
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={value => { setSearch(value); setPagination(current => ({ ...current, current_page: 1 })); }}
            placeholder="Search code, subject, department"
            placeholderTextColor="#89767A"
            returnKeyType="search"
          />
          <TouchableOpacity style={[s.filterButton, (filters.subject_type || filters.department_id) && s.filterButtonActive]} onPress={() => { setFilterDraft(filters); setFilterOpen(true); }} accessibilityLabel="Filter subjects">
            <Feather name="sliders" size={19} color={filters.subject_type || filters.department_id ? '#fff' : '#AE1234'} />
          </TouchableOpacity>
        </View>
        <Text style={s.resultCount}>Showing {pagination.from || (rows.length ? 1 : 0)}–{pagination.to || rows.length} of {pagination.total} subjects</Text>
      </View>

      {loading && !refreshing ? (
        <View style={s.loading}><ActivityIndicator size="large" color="#AE1234" /></View>
      ) : (
        <ScrollView
          style={s.list}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1); }} tintColor="#AE1234" />}
          keyboardShouldPersistTaps="handled"
        >
          {rows.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>No subjects found</Text>
              <Text style={s.emptyText}>Try a different search or filter.</Text>
            </View>
          ) : rows.map(subject => {
            const currentOwner = ownerFor(subject);
            const selectedDepartment = departments.find(item => item.id === Number(currentOwner));
            const dirty = isDirty(subject);
            return (
              <View key={subject.id} style={s.subjectCard}>
                <View style={s.subjectHeading}>
                  <Text style={s.codeBadge}>{subject.code}</Text>
                  {dirty ? <Text style={s.unsavedBadge}>Unsaved change</Text> : null}
                </View>
                <Text style={s.subjectName}>{subject.name}</Text>
                <Text style={s.subjectMeta}>{subject.course || subject.strand || 'General'} · currently {subject.department?.name || 'Unassigned'}</Text>
                <Text style={s.fieldLabel}>Managing department</Text>
                <TouchableOpacity
                  style={s.departmentSelect}
                  onPress={() => { setDepartmentSubject(subject); setDepartmentSearch(''); }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.departmentSelectText, !selectedDepartment && s.departmentPlaceholder]} numberOfLines={1}>{selectedDepartment?.name || '[Select department]'}</Text>
                  <Feather name="chevron-down" size={16} color="#806D72" />
                </TouchableOpacity>
                {dirty ? (
                  <>
                    <Text style={s.changeHint}>Changing ownership requires new teaching approvals.</Text>
                    <TouchableOpacity style={[s.saveDepartmentButton, savingId === subject.id && s.disabledButton]} onPress={() => saveOwner(subject)} disabled={savingId !== null}>
                      {savingId === subject.id ? <ActivityIndicator color="#fff" /> : <Text style={s.saveDepartmentText}>Save department</Text>}
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            );
          })}
          {pagination.last_page > 1 ? (
            <View style={s.paginationWrap}>
              <View style={s.pagination}>
                <TouchableOpacity style={[s.pageButton, pagination.current_page === 1 && s.pageDisabled]} disabled={pagination.current_page === 1} onPress={() => load(pagination.current_page - 1)} accessibilityLabel="Previous page">
                  <Feather name="chevron-left" size={18} color={pagination.current_page === 1 ? '#B9A8AC' : '#AE1234'} />
                </TouchableOpacity>
                {pageNumbers.map((page, index) => (
                  <View key={page} style={s.pageSlot}>
                    {index > 0 && pageNumbers[index - 1] < page - 1 ? <Text style={s.pageEllipsis}>…</Text> : null}
                    <TouchableOpacity onPress={() => load(page)} style={[s.pageButton, pagination.current_page === page && s.pageButtonActive]} accessibilityState={{ selected: pagination.current_page === page }}>
                      <Text style={[s.pageNumber, pagination.current_page === page && s.pageNumberActive]}>{page}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={[s.pageButton, pagination.current_page === pagination.last_page && s.pageDisabled]} disabled={pagination.current_page === pagination.last_page} onPress={() => load(pagination.current_page + 1)} accessibilityLabel="Next page">
                  <Feather name="chevron-right" size={18} color={pagination.current_page === pagination.last_page ? '#B9A8AC' : '#AE1234'} />
                </TouchableOpacity>
              </View>
              <View style={s.pageJumpRow}>
                <Text style={s.pageJumpLabel}>Go to page</Text>
                <TextInput
                  style={s.pageJumpInput}
                  value={pageInput}
                  onChangeText={value => setPageInput(value.replace(/[^0-9]/g, ''))}
                  placeholder={String(pagination.current_page)}
                  placeholderTextColor="#89767A"
                  keyboardType="number-pad"
                  returnKeyType="go"
                  onSubmitEditing={jumpToPage}
                />
                <TouchableOpacity style={s.pageJumpButton} onPress={jumpToPage}><Text style={s.pageJumpText}>Go</Text></TouchableOpacity>
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={Boolean(departmentSubject)} transparent animationType="slide" onRequestClose={() => setDepartmentSubject(null)}>
        <View style={s.modalOverlay}>
          <View style={s.departmentModal}>
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>Select department</Text>
                <Text style={s.modalSubtitle} numberOfLines={1}>{departmentSubject?.code} · {departmentSubject?.name}</Text>
              </View>
              <TouchableOpacity style={s.modalClose} onPress={() => setDepartmentSubject(null)} accessibilityLabel="Close department selector">
                <Feather name="x" size={19} color="#806D72" />
              </TouchableOpacity>
            </View>
            <TextInput style={s.modalSearch} value={departmentSearch} onChangeText={setDepartmentSearch} placeholder="Search departments" placeholderTextColor="#89767A" />
            <ScrollView keyboardShouldPersistTaps="handled">
              <TouchableOpacity style={s.departmentOption} onPress={() => { setOwners(current => ({ ...current, [departmentSubject.id]: null })); setDepartmentSubject(null); }}>
                <Text style={s.departmentOptionText}>[Select department]</Text>
                {ownerFor(departmentSubject) == null ? <Feather name="check" size={17} color="#AE1234" /> : null}
              </TouchableOpacity>
              {visibleDepartments.map(department => (
                <TouchableOpacity key={department.id} style={s.departmentOption} onPress={() => { setOwners(current => ({ ...current, [departmentSubject.id]: department.id })); setDepartmentSubject(null); }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.departmentOptionText}>{department.name}</Text>
                    {!department.is_active ? <Text style={s.inactiveNote}>Inactive</Text> : null}
                  </View>
                  {Number(ownerFor(departmentSubject)) === department.id ? <Feather name="check" size={17} color="#AE1234" /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.filterModal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Filter subjects</Text>
              <TouchableOpacity style={s.modalClose} onPress={() => setFilterOpen(false)}><Feather name="x" size={19} color="#806D72" /></TouchableOpacity>
            </View>
            <Text style={s.fieldLabel}>Subject type</Text>
            {[
              ['', 'All subjects'],
              ['general', 'General subjects'],
              ['course', 'Course-specific subjects'],
            ].map(([value, label]) => (
              <TouchableOpacity key={value || 'all'} style={s.filterOption} onPress={() => setFilterDraft(current => ({ ...current, subject_type: value }))}>
                <Text style={s.departmentOptionText}>{label}</Text>
                {filterDraft.subject_type === value ? <Feather name="check" size={17} color="#AE1234" /> : null}
              </TouchableOpacity>
            ))}
            <Text style={[s.fieldLabel, { marginTop: 12 }]}>Department</Text>
            <ScrollView style={{ maxHeight: 190 }}>
              {[[ '', 'All departments'], ['unassigned', 'Unassigned'], ...departments.map(item => [String(item.id), item.name])].map(([value, label]) => (
                <TouchableOpacity key={value || 'all-departments'} style={s.filterOption} onPress={() => setFilterDraft(current => ({ ...current, department_id: value }))}>
                  <Text style={s.departmentOptionText}>{label}</Text>
                  {filterDraft.department_id === value ? <Feather name="check" size={17} color="#AE1234" /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={s.filterActions}>
              <TouchableOpacity style={s.clearFilters} onPress={() => setFilterDraft(EMPTY_FILTERS)}><Text style={s.clearFiltersText}>Clear</Text></TouchableOpacity>
              <TouchableOpacity style={s.applyFilters} onPress={applyFilters}><Text style={s.applyFiltersText}>Apply filters</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBF3F4' },
  header: { paddingHorizontal: 20, paddingBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleCopy: { flex: 1, minWidth: 0, marginRight: 10 },
  eyebrow: { color: '#AE1234', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: '#301A20', fontSize: 27, lineHeight: 32, fontWeight: '800', marginTop: 2 },
  subtitle: { color: '#806D72', fontSize: 12, marginTop: 3 },
  refreshButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F0D9DE', backgroundColor: '#fff' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 11 },
  searchInput: { flex: 1, height: 48, borderWidth: 1, borderColor: '#F0D9DE', borderRadius: 12, backgroundColor: '#fff', paddingHorizontal: 14, color: '#301A20', fontSize: 13 },
  filterButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F0D9DE', borderRadius: 12, backgroundColor: '#fff' },
  filterButtonActive: { backgroundColor: '#AE1234', borderColor: '#AE1234' },
  resultCount: { color: '#806D72', fontSize: 12, marginTop: 13 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 18 },
  subjectCard: { borderWidth: 1, borderColor: '#F0D9DE', borderRadius: 16, padding: 16, backgroundColor: '#fff', marginBottom: 11 },
  subjectHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 22 },
  codeBadge: { overflow: 'hidden', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#F7DFE4', color: '#AE1234', fontSize: 10, fontWeight: '800' },
  unsavedBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, color: '#966400', backgroundColor: '#FFF0CC', fontSize: 10, fontWeight: '700' },
  subjectName: { color: '#301A20', fontSize: 15, lineHeight: 19, fontWeight: '700', marginTop: 10 },
  subjectMeta: { color: '#806D72', fontSize: 12, marginTop: 4 },
  fieldLabel: { color: '#301A20', fontSize: 12, fontWeight: '700', marginTop: 15, marginBottom: 6 },
  departmentSelect: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#F0D9DE', borderRadius: 12, backgroundColor: '#fff', paddingHorizontal: 14 },
  departmentSelectText: { flex: 1, color: '#301A20', fontSize: 13, marginRight: 10 },
  departmentPlaceholder: { color: '#806D72' },
  changeHint: { color: '#806D72', fontSize: 11, marginTop: 7 },
  saveDepartmentButton: { minHeight: 47, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#AE1234', marginTop: 10 },
  saveDepartmentText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  disabledButton: { opacity: 0.65 },
  emptyCard: { alignItems: 'center', padding: 24, borderRadius: 15, borderWidth: 1, borderColor: '#F0D9DE', backgroundColor: '#fff' },
  emptyTitle: { color: '#301A20', fontSize: 15, fontWeight: '800' },
  emptyText: { color: '#806D72', fontSize: 12, marginTop: 5 },
  paginationWrap: { alignItems: 'center', paddingVertical: 8 },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  pageSlot: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pageButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F0D9DE', borderRadius: 10, backgroundColor: '#fff' },
  pageButtonActive: { backgroundColor: '#AE1234', borderColor: '#AE1234' },
  pageDisabled: { backgroundColor: '#F7EFF1' },
  pageNumber: { color: '#806D72', fontSize: 12, fontWeight: '700' },
  pageNumberActive: { color: '#fff' },
  pageEllipsis: { width: 12, color: '#806D72', textAlign: 'center' },
  pageJumpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  pageJumpLabel: { color: '#806D72', fontSize: 11 },
  pageJumpInput: { width: 54, height: 34, borderRadius: 9, borderWidth: 1, borderColor: '#F0D9DE', backgroundColor: '#fff', paddingHorizontal: 8, textAlign: 'center', color: '#301A20', fontSize: 12 },
  pageJumpButton: { height: 34, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#F7DFE4', paddingHorizontal: 10 },
  pageJumpText: { color: '#AE1234', fontSize: 12, fontWeight: '800' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#301A2066', padding: 14 },
  departmentModal: { maxHeight: '78%', borderRadius: 18, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  filterModal: { maxHeight: '84%', borderRadius: 18, backgroundColor: '#fff', padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  modalTitle: { color: '#301A20', fontSize: 16, fontWeight: '800' },
  modalSubtitle: { color: '#806D72', fontSize: 11, marginTop: 3, maxWidth: 270 },
  modalClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBF3F4' },
  modalSearch: { height: 44, borderWidth: 1, borderColor: '#F0D9DE', borderRadius: 11, paddingHorizontal: 12, color: '#301A20', fontSize: 13, marginBottom: 5 },
  departmentOption: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F3E5E8', paddingVertical: 8 },
  departmentOptionText: { color: '#301A20', fontSize: 13 },
  inactiveNote: { color: '#806D72', fontSize: 10, marginTop: 2 },
  filterOption: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F3E5E8' },
  filterActions: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14 },
  clearFilters: { minHeight: 44, minWidth: 80, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F0D9DE', borderRadius: 11 },
  clearFiltersText: { color: '#806D72', fontSize: 13, fontWeight: '700' },
  applyFilters: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#AE1234', borderRadius: 11 },
  applyFiltersText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
