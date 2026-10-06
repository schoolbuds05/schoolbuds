// @ts-nocheck
// app/(registrar)/enrollments.tsx — Registrar enrollment management screen

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Modal,
  RefreshControl, Platform, StatusBar,
} from 'react-native';
import api from '../../src/api';
import HeaderGradient from '../components/ui/HeaderGradient';
import SearchBar from '../components/ui/SearchBar';

const C = {
  blue:        '#378ADD',
  blueLight:   '#E6F1FB',
  green:       '#1D9E75',
  greenLight:  '#E1F5EE',
  danger:      '#E24B4A',
  dangerLight: '#FCEBEB',
  warning:     '#BA7517',
  warningLight:'#FFF3CD',
  bg:          '#F4F6F9',
  card:        '#FFFFFF',
  border:      '#EFEFEF',
  text:        '#1A1A2E',
  sub:         '#6B7280',
  muted:       '#B0B7C3',
};

const HEADER_TOP = Platform.OS === 'android'
  ? (StatusBar.currentHeight ?? 24) + 10 : 52;

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  bg: C.warningLight, color: C.warning, dot: '🟡' },
  approved: { label: 'Approved', bg: C.greenLight,   color: C.green,   dot: '🟢' },
  rejected: { label: 'Rejected', bg: C.dangerLight,  color: C.danger,  dot: '🔴' },
};

const FILTER_TABS = [
  { key: 'all',      label: 'All'      },
  { key: 'pending',  label: 'Pending'  },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function RegistrarEnrollments() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [filter, setFilter]             = useState('all');
  const [search, setSearch]             = useState('');
  const [selected, setSelected]         = useState(null);
  const [showAction, setShowAction]     = useState(false);
  const [actionType, setActionType]     = useState('');
  const [remarks, setRemarks]           = useState('');
  const [submitting, setSubmitting]     = useState(false);

  const fetchApplications = useCallback(async () => {
    try {
      const params = {};
      if (filter !== 'all') params.status = filter;
      if (search.trim())    params.search  = search.trim();
      const res = await api.get('/registrar/enrollments', { params });
      setApplications(res.data);
    } catch (e) {
      console.log('Enrollments fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, search]);

  useEffect(() => { fetchApplications(); }, [filter]);

  const counts = {
    all:      applications.length,
    pending:  applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  const openDetail = async (app) => {
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
        actionType === 'approve'
          ? res.data?.parent_default_password
            ? `${selected.first_name}'s application has been approved. Parent default password: ${res.data.parent_default_password}`
            : `${selected.first_name}'s application has been approved. Their account has been created.`
          : `${selected.first_name}'s application has been rejected.`
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

  const InfoRow = ({ label, value }) => value ? (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  ) : null;

  const SectionTitle = ({ children }) => (
    <Text style={s.sectionTitle}>{children}</Text>
  );

  return (
    <View style={s.container}>
      <HeaderGradient
        title="Applications"
        subtitle="Review and manage student enrollment requests"
        initials="EN"
        stats={[
          { label: 'Pending', value: counts.pending, accent: '#FBBF24' },
          { label: 'Approved', value: counts.approved, accent: '#34D399' },
          { label: 'Rejected', value: counts.rejected, accent: '#FCA5A5' },
        ]}
      >
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or email..."
          onSubmitEditing={fetchApplications}
        />
      </HeaderGradient>

      {/* Summary bar */}
      {!loading && (
        <View style={s.summaryBar}>
          {FILTER_TABS.slice(1).map(t => (
            <View key={t.key} style={s.summaryItem}>
              <Text style={[s.summaryCount, {
                color: t.key === 'pending'  ? C.warning
                     : t.key === 'approved' ? C.green
                     : C.danger
              }]}>
                {counts[t.key]}
              </Text>
              <Text style={s.summaryLabel}>{t.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Filter tabs */}
      <View style={s.tabWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabScroll}>
          {FILTER_TABS.map(tab => {
            const active = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[s.tab, active && s.tabActive]}
                onPress={() => setFilter(tab.key)}
              >
                <Text style={[s.tabText, active && s.tabTextActive]}>
                  {tab.label}
                  {tab.key !== 'all' && ` (${counts[tab.key]})`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.blue} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchApplications(); }} />
          }
        >
          {applications.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>📋</Text>
              <Text style={s.emptyTitle}>No applications found</Text>
              <Text style={s.emptySub}>
                {filter === 'pending' ? 'No pending applications at the moment.' : 'Nothing here yet.'}
              </Text>
            </View>
          ) : (
            applications.map((app, i) => {
              const cfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.pending;
              return (
                <TouchableOpacity key={i} style={s.appCard} onPress={() => openDetail(app)} activeOpacity={0.75}>
                  <View style={s.appCardTop}>
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>
                        {app.first_name?.[0]}{app.last_name?.[0]}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.appName}>{app.first_name} {app.last_name}</Text>
                      <Text style={s.appEmail} numberOfLines={1}>{app.email}</Text>
                      <Text style={s.appProgram} numberOfLines={1}>{programLabel(app)}</Text>
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
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Application Detail</Text>
              <TouchableOpacity onPress={() => setSelected(null)} style={s.modalCloseBtn}>
                <Text style={s.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalBody}>
              {/* Status banner */}
              {(() => {
                const cfg = STATUS_CONFIG[selected.status] ?? STATUS_CONFIG.pending;
                return (
                  <View style={[s.detailStatusBanner, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
                    <Text style={[s.detailStatusLabel, { color: cfg.color }]}>
                      {cfg.dot}  {cfg.label}
                    </Text>
                  </View>
                );
              })()}

              {/* ── Personal Information ── */}
              <SectionTitle>👤 Personal Information</SectionTitle>
              <View style={s.infoCard}>
                <InfoRow label="Full Name"     value={`${selected.first_name ?? ''} ${selected.middle_name ?? ''} ${selected.last_name ?? ''}`.trim()} />
                <InfoRow label="Email"         value={selected.email} />
                <InfoRow label="Birthdate"     value={selected.birthdate} />
                <InfoRow label="Gender"        value={selected.gender} />
                <InfoRow label="Religion"      value={selected.religion} />
                <InfoRow label="Civil Status"  value={selected.civil_status} />
                <InfoRow label="Citizenship"   value={selected.citizenship} />
                <InfoRow label="Place of Birth" value={selected.place_of_birth} />
                <InfoRow label="Contact No."   value={selected.contact_number} />
                <InfoRow label="Address"       value={selected.address} />
              </View>

              {/* ── Classification ── */}
              <SectionTitle>🎓 Student Classification</SectionTitle>
              <View style={s.infoCard}>
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
              <SectionTitle>📚 Academic Program</SectionTitle>
              <View style={s.infoCard}>
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
                <InfoRow label="Semester"    value={`${selected.semester} Semester`} />
              </View>

              {/* ── Previous School ── */}
              {(selected.prev_school || selected.prev_school_address) && (
                <>
                  <SectionTitle>🏫 Previous School</SectionTitle>
                  <View style={s.infoCard}>
                    <InfoRow label="School Name"    value={selected.prev_school} />
                    <InfoRow label="School Address" value={selected.prev_school_address} />
                  </View>
                </>
              )}

              {/* ── Parents / Guardian ── */}
              {(selected.father_name || selected.mother_name || selected.parent_email) && (
                <>
                  <SectionTitle>👨‍👩‍👧 Parents / Guardian</SectionTitle>
                  <View style={s.infoCard}>
                    <InfoRow label="Father's Name"       value={selected.father_name} />
                    <InfoRow label="Father's Occupation" value={selected.father_occupation} />
                    <InfoRow label="Mother's Name"       value={selected.mother_name} />
                    <InfoRow label="Mother's Occupation" value={selected.mother_occupation} />
                    <InfoRow label="Parent Email"        value={selected.parent_email} />
                  </View>
                </>
              )}

              {/* ── Subjects ── */}
              {Array.isArray(selected.subject_ids) && selected.subject_ids.length > 0 && (
                <>
                  <SectionTitle>📋 Enrolled Subjects</SectionTitle>
                  <View style={s.infoCard}>
                    <InfoRow label="Total Subjects" value={String(selected.subject_ids.length)} />
                  </View>
                </>
              )}

              {/* ── Remarks ── */}
              {selected.remarks && (
                <>
                  <SectionTitle>{"💬 Registrar's Remarks"}</SectionTitle>
                  <View style={s.infoCard}>
                    <Text style={s.remarksText}>{selected.remarks}</Text>
                  </View>
                </>
              )}

              {/* Action buttons — only for pending */}
              {selected.status === 'pending' && (
                <View style={s.actionRow}>
                  <TouchableOpacity style={s.approveBtn} onPress={() => openAction('approve')}>
                    <Text style={s.approveBtnText}>✅  Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.rejectBtn} onPress={() => openAction('reject')}>
                    <Text style={s.rejectBtnText}>❌  Reject</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: C.blue,
    paddingTop: HEADER_TOP,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerTop:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  title:       { color: '#fff', fontSize: 22, fontWeight: '700' },
  subtitle:    { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, gap: 8,
  },
  searchIcon:  { fontSize: 14 },
  searchInput: { flex: 1, color: '#fff', fontSize: 13 },

  summaryBar: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingVertical: 10,
  },
  summaryItem:  { flex: 1, alignItems: 'center' },
  summaryCount: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 11, color: C.muted, marginTop: 2 },

  tabWrapper: { backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  tabScroll:  { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, backgroundColor: C.bg,
    borderWidth: 1, borderColor: C.border,
  },
  tabActive:     { backgroundColor: C.blueLight, borderColor: C.blue },
  tabText:       { fontSize: 12, color: C.sub, fontWeight: '500' },
  tabTextActive: { color: C.blue, fontWeight: '700' },

  list: { padding: 12, gap: 10, paddingBottom: 24 },
  appCard: {
    backgroundColor: C.card,
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  appCardTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.blueLight,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText:  { fontSize: 15, fontWeight: '700', color: C.blue },
  appName:     { fontSize: 14, fontWeight: '700', color: C.text },
  appEmail:    { fontSize: 12, color: C.muted, marginTop: 1 },
  appProgram:  { fontSize: 12, color: C.sub, marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  appCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appDate:       { fontSize: 11, color: C.muted },
  quickActions:  { flexDirection: 'row', gap: 8 },
  quickApprove: {
    backgroundColor: C.greenLight, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.green,
  },
  quickApproveText: { fontSize: 12, color: C.green, fontWeight: '600' },
  quickReject: {
    backgroundColor: C.dangerLight, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.danger,
  },
  quickRejectText: { fontSize: 12, color: C.danger, fontWeight: '600' },

  emptyWrap:  { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.text },
  emptySub:   { fontSize: 13, color: C.muted, marginTop: 4 },

  modal:       { flex: 1, backgroundColor: C.card },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 52,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle:     { fontSize: 18, fontWeight: '700', color: C.text },
  modalCloseBtn:  { padding: 4 },
  modalCloseText: { fontSize: 18, color: C.muted },
  modalBody:      { padding: 16 },

  detailStatusBanner: {
    borderRadius: 12, borderWidth: 1.5,
    padding: 12, marginBottom: 16,
    alignItems: 'center',
  },
  detailStatusLabel: { fontSize: 15, fontWeight: '700' },

  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: C.sub,
    marginBottom: 8, marginTop: 4,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: C.bg, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  infoLabel: { fontSize: 13, color: C.sub, flex: 1 },
  infoValue: { fontSize: 13, color: C.text, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
  remarksText: { fontSize: 13, color: C.text, lineHeight: 20, paddingVertical: 10 },

  actionRow:     { flexDirection: 'row', gap: 10, marginTop: 8 },
  approveBtn:    { flex: 1, backgroundColor: C.green,  borderRadius: 12, padding: 15, alignItems: 'center' },
  approveBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  rejectBtn:     { flex: 1, backgroundColor: C.danger, borderRadius: 12, padding: 15, alignItems: 'center' },
  rejectBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

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
