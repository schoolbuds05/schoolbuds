// @ts-nocheck
// app/(registrar)/enrollments.tsx — Registrar enrollment management screen

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Modal,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

const C = {
  brand:       '#B51F3B',
  brandLight:  '#FBE5E9',
  green:       '#1D9E75',
  greenLight:  '#E1F5EE',
  danger:      '#B51F3B',
  dangerLight: '#FBE5E9',
  warning:     '#9A6900',
  warningLight:'#F9EAC4',
  bg:          '#FBF8F5',
  card:        '#FFFFFF',
  border:      '#F0E8E3',
  text:        '#2A171B',
  sub:         '#735D62',
  muted:       '#89777B',
};

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  bg: C.warningLight, color: C.warning, dot: '🟡' },
  approved: { label: 'Approved', bg: C.greenLight,   color: C.green,   dot: '🟢' },
  rejected: { label: 'Rejected', bg: C.dangerLight,  color: C.danger,  dot: '🔴' },
};

export default function RegistrarEnrollments() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [filter, setFilter]             = useState('all');
  const [showFilters, setShowFilters]   = useState(false);
  const [search, setSearch]             = useState('');
  const [selected, setSelected]         = useState(null);
  const [showSubjectCount, setShowSubjectCount] = useState(false);
  const [showAction, setShowAction]     = useState(false);
  const [actionType, setActionType]     = useState('');
  const [remarks, setRemarks]           = useState('');
  const [submitting, setSubmitting]     = useState(false);

  const fetchApplications = useCallback(async () => {
    try {
      const res = await api.get('/registrar/enrollments');
      setApplications(Array.isArray(res.data) ? res.data : res.data?.data ?? []);
    } catch (e) {
      console.log('Enrollments fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const counts = {
    all:      applications.length,
    pending:  applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  const visibleApplications = applications.filter((application) => {
    const matchesFilter = filter === 'all' || application.status === filter;
    const query = search.trim().toLowerCase();
    const fullName = `${application.first_name ?? ''} ${application.middle_name ?? ''} ${application.last_name ?? ''}`.toLowerCase();
    return matchesFilter && (!query || fullName.includes(query) || String(application.email ?? '').toLowerCase().includes(query));
  });

  const openDetail = async (app) => {
    setShowSubjectCount(false);
    try {
      const res = await api.get(`/registrar/enrollments/${app.id}`);
      setSelected(res.data);
    } catch {
      setSelected(app);
    }
  };

  const openAction = (type) => {
    setActionType(type);
    setRemarks('');
    setShowAction(true);
  };

  const handleAction = async () => {
    if (actionType === 'reject' && !remarks.trim()) {
      Alert.alert('Required', 'Please provide a reason for rejection.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/registrar/enrollments/${selected.id}/${actionType}`, { remarks });
      const newStatus = actionType === 'approve' ? 'approved' : 'rejected';
      setApplications(prev =>
        prev.map(a => a.id === selected.id ? { ...a, status: newStatus } : a)
      );
      setSelected(prev => ({ ...prev, status: newStatus, remarks }));
      setShowAction(false);
      Alert.alert(
        actionType === 'approve' ? '✅ Approved' : '❌ Rejected',
        res.data?.message || (
          actionType === 'approve'
            ? `${selected.first_name}'s application has been approved. Their account has been created.`
            : `${selected.first_name}'s application has been rejected.`
        )
      );
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message ?? 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const programLabel = (app) => {
    if (app.program_type === 'shs')
      return `SHS Grade ${app.grade_level} — ${app.strand}`;
    return `${app.course} (${app.year_level}${['st','nd','rd','th'][app.year_level - 1] ?? 'th'} Year)`;
  };

  const InfoRow = ({ label, value }) => value !== null && value !== undefined && value !== '' ? (
    <View style={[s.infoRow, { borderBottomColor: theme.border }]}>
      <Text style={[s.infoLabel, { color: theme.textSub }]}>{label}</Text>
      <Text style={[s.infoValue, { color: theme.text }]}>{String(value)}</Text>
    </View>
  ) : null;

  const SectionTitle = ({ children, icon }) => (
    <View style={s.sectionTitleRow}>
      <View style={[s.sectionIcon, { backgroundColor: theme.primaryLight }]}><Ionicons name={icon} size={15} color={theme.primary} /></View>
      <Text style={[s.sectionTitle, { color: theme.text }]}>{children}</Text>
    </View>
  );
  const subjectCount = selected?.subjects?.length || selected?.subject_ids?.length || 0;

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <View style={[s.heading, { paddingTop: 12 + insets.top }]}>
        <Text style={s.title}>Applications</Text>
        <Text style={s.subtitle}>Review student enrollment requests</Text>
      </View>

      <View style={s.searchAndFilter}>
        <View style={[s.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={17} color={theme.textSub} />
          <TextInput
            style={[s.searchInput, { color: theme.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or email"
            placeholderTextColor={theme.textMuted}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={17} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[s.filterToggleBtn, { backgroundColor: theme.card, borderColor: theme.primary }, filter !== 'all' && { backgroundColor: theme.primaryLight }]}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="options-outline" size={15} color={theme.primary} />
          <Text style={[s.filterToggleText, { color: theme.primary }]}>Filter</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <View style={s.filterBackdrop}>
          <View style={[s.filterSheet, { backgroundColor: theme.bg }]}>
            <View style={[s.filterSheetHeader, { borderBottomColor: theme.border }]}>
              <View>
                <Text style={[s.filterSheetTitle, { color: theme.text }]}>Filter applications</Text>
                <Text style={[s.filterSheetSubtitle, { color: theme.textSub }]}>Choose application status</Text>
              </View>
              <TouchableOpacity style={[s.filterClose, { backgroundColor: theme.card }]} onPress={() => setShowFilters(false)} accessibilityLabel="Close filters">
                <Ionicons name="close" size={19} color={theme.textSub} />
              </TouchableOpacity>
            </View>
            <Text style={[s.filterLabel, { color: theme.textSub }]}>Status</Text>
            <View style={s.filterOptions}>
              {[
                { key: 'all', label: 'All', count: counts.all },
                { key: 'pending', label: 'Pending', count: counts.pending },
                { key: 'approved', label: 'Approved', count: counts.approved },
                { key: 'rejected', label: 'Rejected', count: counts.rejected },
              ].map(option => (
                <TouchableOpacity key={option.key} style={[s.filterOption, { backgroundColor: theme.card, borderColor: theme.border }, filter === option.key && { backgroundColor: theme.primaryLight, borderColor: theme.primary }]} onPress={() => setFilter(option.key)}>
                  <Text style={[s.filterOptionText, { color: theme.textSub }, filter === option.key && { color: theme.primary, fontWeight: '800' }]}>{option.label} {option.count}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[s.filterActions, { borderTopColor: theme.border }]}>
              <TouchableOpacity style={[s.filterReset, { backgroundColor: theme.card, borderColor: theme.primary }]} onPress={() => setFilter('all')}>
                <Text style={[s.filterResetText, { color: theme.primary }]}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.filterDone, { backgroundColor: theme.primary }]} onPress={() => setShowFilters(false)}>
                <Text style={s.filterDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.brand} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchApplications(); }} />
          }
        >
          {visibleApplications.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>📋</Text>
              <Text style={s.emptyTitle}>No applications found</Text>
              <Text style={s.emptySub}>
                {filter === 'pending' ? 'No pending applications at the moment.' : 'Nothing here yet.'}
              </Text>
            </View>
          ) : (
            visibleApplications.map((app) => {
              const cfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.pending;
              return (
                <TouchableOpacity key={app.id} style={s.appCard} onPress={() => openDetail(app)} activeOpacity={0.75}>
                  <View style={s.appCardTop}>
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>
                        {app.first_name?.[0]}{app.last_name?.[0]}
                      </Text>
                    </View>
                    <View style={s.appCopy}>
                      <Text style={s.appName}>{app.first_name} {app.last_name}</Text>
                      <Text style={s.appEmail} numberOfLines={1}>{app.email}</Text>
                      <Text style={s.appProgram} numberOfLines={2}>{programLabel(app)}</Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[s.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>

                  <View style={s.appCardBottom}>
                    <Text style={s.appDate}>
                      Applied {new Date(app.created_at).toLocaleDateString('en-PH', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </Text>
                    {app.status === 'pending' && (
                      <View style={s.quickActions}>
                        <TouchableOpacity
                          style={s.quickApprove}
                          onPress={() => { openDetail(app); setTimeout(() => openAction('approve'), 300); }}
                        >
                          <Text style={s.quickApproveText}>✓ Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.quickReject}
                          onPress={() => { openDetail(app); setTimeout(() => openAction('reject'), 300); }}
                        >
                          <Text style={s.quickRejectText}>✕ Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ── Detail Modal ── */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={[s.modal, { backgroundColor: theme.bg }]}>
            <View style={[s.modalHeader, { paddingTop: 16 + insets.top, backgroundColor: theme.card, borderBottomColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalTitle, { color: theme.text }]}>Application</Text>
                <Text style={[s.modalSubtitle, { color: theme.textSub }]}>Enrollment request details</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} style={[s.modalCloseBtn, { backgroundColor: theme.bg }]} accessibilityLabel="Close application details">
                <Ionicons name="close" size={21} color={theme.textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={[s.modalBody, { paddingBottom: selected.status === 'pending' ? 24 : 34 }]}>
              {/* Applicant summary */}
              {(() => {
                const cfg = STATUS_CONFIG[selected.status] ?? STATUS_CONFIG.pending;
                const initials = `${selected.first_name?.[0] ?? ''}${selected.last_name?.[0] ?? ''}`.toUpperCase();
                return (
                  <View style={[s.applicantSummary, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={[s.summaryAvatar, { backgroundColor: theme.primaryLight }]}>
                      <Text style={[s.summaryInitials, { color: theme.primary }]}>{initials || 'S'}</Text>
                    </View>
                    <View style={s.summaryCopy}>
                      <Text style={[s.summaryName, { color: theme.text }]} numberOfLines={1}>{`${selected.first_name ?? ''} ${selected.middle_name ?? ''} ${selected.last_name ?? ''}`.trim()}</Text>
                      <Text style={[s.summaryEmail, { color: theme.textSub }]} numberOfLines={1}>{selected.email}</Text>
                    </View>
                    <View style={[s.detailStatusBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[s.detailStatusLabel, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                );
              })()}

              {/* ── Personal Information ── */}
              <SectionTitle icon="person-outline">Personal information</SectionTitle>
              <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <InfoRow label="Birthdate"     value={formatBirthdate(selected.birthdate)} />
                <InfoRow label="Gender"        value={selected.gender} />
                <InfoRow label="Religion"      value={selected.religion} />
                <InfoRow label="Civil Status"  value={selected.civil_status} />
                <InfoRow label="Citizenship"   value={selected.citizenship} />
                <InfoRow label="Place of Birth" value={selected.place_of_birth} />
                <InfoRow label="Contact No."   value={selected.contact_number} />
                <InfoRow label="Address"       value={selected.address} />
              </View>

              {/* ── Classification ── */}
              <SectionTitle icon="school-outline">Student classification</SectionTitle>
              <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <InfoRow label="Student Type"    value={selected.student_type?.replace('_', ' ')} />
                <InfoRow label="Academic Status" value={selected.academic_status} />
                <InfoRow label="Student ID"      value={selected.id_no} />
                {selected.shiftee_from && (
                  <InfoRow label="Shiftee From" value={selected.shiftee_from} />
                )}
                {selected.shiftee_to && (
                  <InfoRow label="Shiftee To" value={selected.shiftee_to} />
                )}
              </View>

              {/* ── Program ── */}
              <SectionTitle icon="book-outline">Academic program</SectionTitle>
              <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <InfoRow label="Program Type" value={selected.program_type === 'shs' ? 'Senior High School' : 'College'} />
                {selected.program_type === 'shs' && (
                  <>
                    <InfoRow label="Grade Level" value={`Grade ${selected.grade_level}`} />
                    <InfoRow label="Strand"      value={selected.strand} />
                  </>
                )}
                {selected.program_type === 'college' && (
                  <>
                    <InfoRow label="Course"     value={selected.course} />
                    <InfoRow label="Year Level" value={`Year ${selected.year_level}`} />
                  </>
                )}
                <InfoRow label="School Year" value={selected.school_year} />
                <InfoRow label="Semester"    value={selected.semester ? `${selected.semester} Semester` : null} />
              </View>

              {/* ── Previous School ── */}
              {(selected.prev_school || selected.prev_school_address) && (
                <>
                  <SectionTitle icon="business-outline">Previous school</SectionTitle>
                  <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <InfoRow label="School Name"    value={selected.prev_school} />
                    <InfoRow label="School Address" value={selected.prev_school_address} />
                  </View>
                </>
              )}

              {/* ── Parents / Guardian ── */}
              {(selected.father_name || selected.mother_name || selected.parent_email) && (
                <>
                  <SectionTitle icon="people-outline">Parents / guardian</SectionTitle>
                  <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <InfoRow label="Father's Name"       value={selected.father_name} />
                    <InfoRow label="Father's Occupation" value={selected.father_occupation} />
                    <InfoRow label="Mother's Name"       value={selected.mother_name} />
                    <InfoRow label="Mother's Occupation" value={selected.mother_occupation} />
                    <InfoRow label="Parent Email"        value={selected.parent_email} />
                  </View>
                </>
              )}

              {/* ── Subjects ── */}
              {subjectCount > 0 && (
                <>
                  <TouchableOpacity
                    style={[s.subjectCountToggle, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => setShowSubjectCount(value => !value)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showSubjectCount }}
                  >
                    <View style={s.subjectCountHeading}>
                      <View style={[s.sectionIcon, { backgroundColor: theme.primaryLight }]}><Ionicons name="library-outline" size={15} color={theme.primary} /></View>
                      <View>
                        <Text style={[s.subjectCountTitle, { color: theme.text }]}>Enrolled subjects</Text>
                        <Text style={[s.subjectCountSubtitle, { color: theme.textSub }]}>{subjectCount} subject{subjectCount === 1 ? '' : 's'}</Text>
                      </View>
                    </View>
                    <Ionicons name={showSubjectCount ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSub} />
                  </TouchableOpacity>
                  {showSubjectCount && <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 8 }]}>
                    {selected.subjects?.length ? selected.subjects.map(subject => (
                      <View key={subject.id} style={[s.subjectDetailRow, { borderBottomColor: theme.border }]}>
                        <View style={[s.subjectCodeTag, { backgroundColor: theme.primaryLight }]}>
                          <Text style={[s.subjectCodeText, { color: theme.primary }]}>{subject.code || 'Subject'}</Text>
                        </View>
                        <View style={s.subjectDetailCopy}>
                          <Text style={[s.subjectDetailName, { color: theme.text }]}>{subject.name}</Text>
                          <Text style={[s.subjectCountSubtitle, { color: theme.textSub }]}>{Number(subject.units_lec || 0) + Number(subject.units_lab || 0)} units</Text>
                        </View>
                      </View>
                    )) : <Text style={[s.subjectUnavailable, { color: theme.textSub }]}>Subject details are unavailable for this application.</Text>}
                  </View>}
                </>
              )}

              {/* ── Remarks ── */}
              {selected.remarks && (
                <>
                  <SectionTitle icon="chatbubble-ellipses-outline">Registrar's remarks</SectionTitle>
                  <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[s.remarksText, { color: theme.text }]}>{selected.remarks}</Text>
                  </View>
                </>
              )}

              {/* Action buttons — only for pending */}
            </ScrollView>
            {selected.status === 'pending' && <View style={[s.detailFooter, { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: 12 + insets.bottom }]}>
              <TouchableOpacity style={[s.rejectBtn, { backgroundColor: theme.card, borderColor: theme.danger }]} onPress={() => openAction('reject')}>
                <Text style={[s.rejectBtnText, { color: theme.danger }]}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.approveBtn, { backgroundColor: theme.primary }]} onPress={() => openAction('approve')}>
                <Text style={s.approveBtnText}>Approve</Text>
              </TouchableOpacity>
            </View>}
          </View>
        )}
      </Modal>

      {/* ── Approve / Reject Confirmation Modal ── */}
      <Modal visible={showAction} animationType="fade" transparent>
        <View style={s.overlay}>
          <View style={s.actionModal}>
            <Text style={s.actionModalTitle}>
              {actionType === 'approve' ? '✅ Approve Application' : '❌ Reject Application'}
            </Text>
            <Text style={s.actionModalSub}>
              {actionType === 'approve'
                ? `Approving will create a student account for ${selected?.first_name}. This cannot be undone.`
                : `Please provide a reason so the student knows what to fix.`}
            </Text>

            <Text style={s.actionRemarksLabel}>
              Remarks {actionType === 'reject' && <Text style={{ color: C.danger }}>*</Text>}
            </Text>
            <TextInput
              style={[s.actionRemarksInput, { height: 80, textAlignVertical: 'top' }]}
              placeholder={
                actionType === 'approve'
                  ? 'Optional note for the student...'
                  : 'Reason for rejection (required)...'
              }
              placeholderTextColor={C.muted}
              value={remarks}
              onChangeText={setRemarks}
              multiline
            />

            <View style={s.actionBtnRow}>
              <TouchableOpacity
                style={s.actionCancelBtn}
                onPress={() => setShowAction(false)}
                disabled={submitting}
              >
                <Text style={s.actionCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  actionType === 'approve' ? s.actionConfirmApprove : s.actionConfirmReject,
                  submitting && { opacity: 0.6 },
                ]}
                onPress={handleAction}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.actionConfirmText}>
                      {actionType === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatBirthdate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { paddingHorizontal: 16, paddingBottom: 2 },
  title:       { color: C.text, fontSize: 23, fontWeight: '700', fontFamily: 'serif' },
  subtitle:    { color: C.sub, fontSize: 11, marginTop: 2 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 13, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, height: 42, gap: 8,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 12, paddingVertical: 0 },
  searchAndFilter: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, gap: 7 },
  filterToggleBtn: { height: 42, paddingHorizontal: 10, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1 },
  filterToggleText: { fontSize: 10, fontWeight: '600' },
  filterBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(35,20,24,0.38)' },
  filterSheet: { maxHeight: '82%', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14 },
  filterSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 15, borderBottomWidth: 1 },
  filterSheetTitle: { fontSize: 17, fontWeight: '800' },
  filterSheetSubtitle: { fontSize: 11, marginTop: 3 },
  filterClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  filterLabel: { fontSize: 11, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  filterOption: { minHeight: 36, paddingHorizontal: 13, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  filterOptionText: { fontSize: 11, fontWeight: '600' },
  filterActions: { flexDirection: 'row', gap: 9, paddingTop: 12, borderTopWidth: 1 },
  filterReset: { flex: 1, height: 43, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  filterResetText: { fontSize: 12, fontWeight: '700' },
  filterDone: { flex: 1.5, height: 43, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  filterDoneText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  list: { paddingHorizontal: 16, paddingTop: 2, gap: 10, paddingBottom: 24 },
  appCard: {
    backgroundColor: C.card,
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 12,
  },
  appCardTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 8 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.brandLight,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText:  { fontSize: 12, fontWeight: '700', color: C.brand },
  appCopy:     { flex: 1, minWidth: 0 },
  appName:     { fontSize: 12, fontWeight: '700', color: C.text },
  appEmail:    { fontSize: 10, color: C.sub, marginTop: 1 },
  appProgram:  { fontSize: 10, color: C.text, marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  statusBadgeText: { fontSize: 9, fontWeight: '700' },

  appCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  appDate:       { flex: 1, fontSize: 9, color: C.sub },
  quickActions:  { flexDirection: 'row', gap: 6 },
  quickApprove: {
    backgroundColor: C.brand, borderRadius: 9,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  quickApproveText: { fontSize: 10, color: '#FFFFFF', fontWeight: '700' },
  quickReject: {
    backgroundColor: C.card, borderRadius: 9,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.brand,
  },
  quickRejectText: { fontSize: 10, color: C.brand, fontWeight: '700' },

  emptyWrap:  { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.text },
  emptySub:   { fontSize: 13, color: C.muted, marginTop: 4 },

  modal:       { flex: 1, backgroundColor: C.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingBottom: 13,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle:     { fontSize: 20, fontWeight: '800', color: C.text },
  modalSubtitle:  { fontSize: 12, marginTop: 2 },
  modalCloseBtn:  { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  modalBody:      { padding: 16, paddingBottom: 28 },

  applicantSummary: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, borderWidth: 1, padding: 13, marginBottom: 18 },
  summaryAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  summaryInitials: { fontSize: 14, fontWeight: '800' },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryName: { fontSize: 14, fontWeight: '800' },
  summaryEmail: { fontSize: 11, marginTop: 3 },
  detailStatusBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  detailStatusLabel: { fontSize: 10, fontWeight: '800' },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7, marginTop: 3 },
  sectionIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: C.text,
  },
  subjectCountToggle: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, marginTop: 3 },
  subjectCountHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  subjectCountTitle: { fontSize: 12, fontWeight: '800' },
  subjectCountSubtitle: { fontSize: 10, marginTop: 2 },
  subjectDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  subjectCodeTag: { minWidth: 58, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, alignItems: 'center' },
  subjectCodeText: { fontSize: 9, fontWeight: '800' },
  subjectDetailCopy: { flex: 1 },
  subjectDetailName: { fontSize: 11, fontWeight: '700' },
  subjectUnavailable: { fontSize: 11, paddingVertical: 12 },
  infoCard: {
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  infoLabel: { fontSize: 11, color: C.sub, flex: 1 },
  infoValue: { fontSize: 11, color: C.text, fontWeight: '700', flex: 1.2, textAlign: 'right', lineHeight: 16 },
  remarksText: { fontSize: 13, color: C.text, lineHeight: 20, paddingVertical: 12 },

  detailFooter: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  approveBtn:    { flex: 1, backgroundColor: C.green, borderRadius: 12, padding: 14, alignItems: 'center' },
  approveBtnText:{ color: '#fff', fontWeight: '800', fontSize: 13 },
  rejectBtn:     { flex: 1, backgroundColor: C.danger, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center' },
  rejectBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    padding: 20,
  },
  actionModal: {
    backgroundColor: C.card, borderRadius: 16,
    padding: 20, width: '100%',
  },
  actionModalTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 6 },
  actionModalSub:   { fontSize: 13, color: C.sub, marginBottom: 16, lineHeight: 18 },
  actionRemarksLabel: { fontSize: 13, fontWeight: '600', color: C.sub, marginBottom: 6 },
  actionRemarksInput: {
    borderWidth: 1, borderColor: C.border,
    borderRadius: 10, padding: 12,
    fontSize: 14, color: C.text, backgroundColor: C.bg,
    marginBottom: 16,
  },
  actionBtnRow:         { flexDirection: 'row', gap: 10 },
  actionCancelBtn:      { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 13, alignItems: 'center' },
  actionCancelText:     { color: C.sub, fontWeight: '600' },
  actionConfirmApprove: { flex: 1, backgroundColor: C.green,  borderRadius: 10, padding: 13, alignItems: 'center' },
  actionConfirmReject:  { flex: 1, backgroundColor: C.danger, borderRadius: 10, padding: 13, alignItems: 'center' },
  actionConfirmText:    { color: '#fff', fontWeight: '700' },
});
