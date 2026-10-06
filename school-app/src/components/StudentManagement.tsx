// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import HeaderGradient from '../../app/components/ui/HeaderGradient';
import api from '../api';
import { useTheme } from '../theme-context';

const STATUS = [
  { value: 'active', label: 'Active', bg: '#DCFCE7', color: '#15803D' },
  { value: 'inactive', label: 'Inactive', bg: '#FEE2E2', color: '#B91C1C' },
  { value: 'graduated', label: 'Graduated', bg: '#E0F2FE', color: '#0369A1' },
];

const emptyForm = {
  student_id: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  birthdate: '',
  gender: 'male',
  address: '',
  grade_level: '',
  section: '',
  school_year: '',
  status: 'active',
};

export default function StudentManagement({ role }) {
  const { theme } = useTheme();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [password, setPassword] = useState('');
  const [fees, setFees] = useState({ fees: [], total_due: 0, total_paid: 0 });
  const [feeForm, setFeeForm] = useState({
    type: 'Tuition Fee',
    amount: '',
    due_date: '',
    school_year: '',
    semester: '',
    notes: '',
  });

  const totals = useMemo(() => ({
    active: students.filter(student => student.status === 'active').length,
    inactive: students.filter(student => student.status === 'inactive').length,
    graduated: students.filter(student => student.status === 'graduated').length,
  }), [students]);

  const load = useCallback(async () => {
    try {
      const params = {};
      if (role === 'admin' && statusFilter !== 'all') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const res = await api.get(`/${role}/students`, { params });
      setStudents(res.data || []);
    } catch (e) {
      console.log(`${role} students error:`, e.message);
      Alert.alert('Could not load students', e.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter, role]);

  useEffect(() => { load(); }, [load]);

  const filteredStudents = role === 'registrar' && search.trim()
    ? students.filter(student => {
        const term = search.trim().toLowerCase();
        return [student.first_name, student.last_name, student.email, student.student_id, student.grade_level, student.section]
          .some(value => value?.toString().toLowerCase().includes(term));
      })
    : students;

  const openStudent = (student) => {
    setSelected(student);
    setPassword('');
    setFees({ fees: [], total_due: 0, total_paid: 0 });
    setForm({
      student_id: student.student_id || '',
      first_name: student.first_name || '',
      last_name: student.last_name || '',
      email: student.email || student.user?.email || '',
      phone: student.phone || '',
      birthdate: student.birthdate || '',
      gender: student.gender || 'male',
      address: student.address || '',
      grade_level: student.grade_level || '',
      section: student.section || '',
      school_year: student.school_year || '',
      status: student.status || 'active',
    });
    setFeeForm(current => ({
      ...current,
      school_year: student.school_year || current.school_year,
    }));
    loadFees(student.id);
  };

  const setField = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const setFeeField = (key, value) => setFeeForm(current => ({ ...current, [key]: value }));

  const loadFees = async (studentId) => {
    try {
      const res = await api.get(`/students/${studentId}/fees`);
      setFees(res.data || { fees: [], total_due: 0, total_paid: 0 });
    } catch (e) {
      console.log('Student fees error:', e.message);
    }
  };

  const createFee = async () => {
    if (!selected) return;
    if (!feeForm.type.trim() || !Number(feeForm.amount) || !feeForm.due_date.trim() || !feeForm.school_year.trim()) {
      Alert.alert('Missing fee details', 'Type, amount, due date, and school year are required.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/fees', {
        student_id: selected.id,
        type: feeForm.type.trim(),
        amount: Number(feeForm.amount),
        due_date: feeForm.due_date.trim(),
        school_year: feeForm.school_year.trim(),
        semester: feeForm.semester.trim() || null,
        notes: feeForm.notes.trim() || null,
      });
      setFeeForm({
        type: 'Tuition Fee',
        amount: '',
        due_date: '',
        school_year: form.school_year || '',
        semester: '',
        notes: '',
      });
      await loadFees(selected.id);
      Alert.alert('Fee posted', 'The tuition fee is now visible to the student.');
    } catch (e) {
      Alert.alert('Could not post fee', e.response?.data?.message || flattenErrors(e.response?.data?.errors) || 'Please check the fee details.');
    } finally {
      setSaving(false);
    }
  };

  const confirmFeePaid = async (fee) => {
    if (!selected || !fee) return;
    const remaining = Math.max(0, Number(fee.amount || 0) - Number(fee.paid_amount || 0));

    setSaving(true);
    try {
      await api.post(`/fees/${fee.id}/pay`, {
        amount: remaining,
        payment_method: 'cash',
        payment_reference: null,
      });
      await loadFees(selected.id);
      Alert.alert('Payment confirmed', 'The fee was marked as paid.');
    } catch (e) {
      Alert.alert('Could not confirm payment', e.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveStudent = async () => {
    if (!selected) return;
    if (!form.student_id.trim() || !form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      Alert.alert('Missing details', 'Student ID, first name, last name, and email are required.');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/${role}/students/${selected.id}`, {
        ...form,
        student_id: form.student_id.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
      });
      setSelected(null);
      await load();
    } catch (e) {
      const message = e.response?.data?.message || flattenErrors(e.response?.data?.errors) || 'Please check the student details.';
      Alert.alert('Could not save student', message);
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!selected) return;
    if (password.trim().length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/${role}/students/${selected.id}/reset-password`, { password: password.trim() });
      setPassword('');
      Alert.alert('Password updated', 'The student can now sign in with the new password.');
    } catch (e) {
      Alert.alert('Could not reset password', e.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteStudent = () => {
    if (!selected) return;
    Alert.alert(
      'Delete student account',
      `Delete ${selected.first_name} ${selected.last_name}? This also removes the linked login account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/students/${selected.id}`);
              setSelected(null);
              await load();
            } catch (e) {
              Alert.alert('Could not delete student', e.response?.data?.message || 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const updateSelectedStudent = (student) => {
    setSelected(student);
    setStudents(current => current.map(item => item.id === student.id ? student : item));
  };

  const changeSubjectStatus = async (subject, action) => {
    if (!selected || !subject?.id) return;
    const verb = action === 'drop' ? 'Drop' : 'Restore';
    Alert.alert(
      `${verb} subject`,
      action === 'drop'
        ? `Drop ${subject.code || subject.name} for this student?`
        : `Restore ${subject.code || subject.name} to this student's study load?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb,
          style: action === 'drop' ? 'destructive' : 'default',
          onPress: async () => {
            setSaving(true);
            try {
              const res = await api.post(
                `/registrar/students/${selected.id}/subjects/${subject.id}/${action}`,
                { section_id: subject.section_id ?? null }
              );
              updateSelectedStudent(res.data.student);
            } catch (e) {
              Alert.alert('Could not update subject', e.response?.data?.message || 'Please try again.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[s.container, role === 'registrar' && { backgroundColor: theme?.bg }]}>
      <HeaderGradient
        title={role === 'admin' ? "Manage students" : "Students"}
        subtitle={role === 'admin' ? "Review student profiles, status, and classroom assignments." : "Review approved learners and student profiles."}
        initials="ST"
        stats={[
          { label: 'Active', value: totals.active, accent: role === 'admin' ? '#15803D' : '#1D9E75' },
          { label: 'Inactive', value: totals.inactive, accent: role === 'admin' ? '#B91C1C' : '#D85A30' },
          { label: 'Graduated', value: totals.graduated, accent: role === 'admin' ? '#0369A1' : '#378ADD' },
        ]}
      />

      <View style={s.searchRow}>
        <View style={s.searchCard}>
          <Feather name="search" size={18} color="#9CA3AF" style={s.searchIcon} />
          <TextInput
            style={s.searchInput}
            placeholder="Search student ID, name, email, section"
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      {role === 'admin' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters} style={s.filtersScroll}>
          <TouchableOpacity
            style={[s.filterChip, statusFilter === 'all' && s.filterChipActive]}
            onPress={() => setStatusFilter('all')}
          >
            <Text style={[s.filterText, statusFilter === 'all' && s.filterTextActive]}>All</Text>
          </TouchableOpacity>
          {STATUS.map(status => (
            <TouchableOpacity
              key={status.value}
              style={[s.filterChip, statusFilter === status.value && s.filterChipActive]}
              onPress={() => setStatusFilter(status.value)}
            >
              <Text style={[s.filterText, statusFilter === status.value && s.filterTextActive]}>{status.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#334155" />
        </View>
      ) : (
        <ScrollView
          style={[s.list, role === 'registrar' && { paddingTop: 12 }]}
          contentContainerStyle={{ paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {filteredStudents.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No students found</Text>
              <Text style={s.emptySub}>Try a different search or status filter.</Text>
            </View>
          ) : filteredStudents.map(student => {
            const status = STATUS.find(item => item.value === student.status) || STATUS[0];
            return (
              <TouchableOpacity key={student.id} style={s.card} onPress={() => openStudent(student)} activeOpacity={0.82}>
                <View style={s.cardTop}>
                  <View style={[s.avatar, role === 'registrar' && { backgroundColor: '#E1F5EE' }]}>
                    <Text style={[s.avatarText, role === 'registrar' && { color: '#1D9E75' }]}>{initials(student)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{student.first_name} {student.last_name}</Text>
                    <Text style={s.meta}>{student.student_id} · {student.email}</Text>
                    <Text style={s.program}>{student.grade_level} · {student.section} · {student.school_year}</Text>
                    {role === 'admin' && (
                      <Text style={s.program}>{student.subjects?.length || 0} subject{student.subjects?.length === 1 ? '' : 's'}</Text>
                    )}
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: role === 'registrar' ? (status.value === 'active' ? '#E1F5EE' : status.value === 'inactive' ? '#F8F0F2' : '#E8F1FF') : status.bg }]}>
                    <Text style={[s.statusText, { color: role === 'registrar' ? (status.value === 'active' ? '#1D9E75' : status.value === 'inactive' ? '#D85A30' : '#378ADD') : status.color }]}>
                      {status.label}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!selected} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>Student account</Text>
                <Text style={s.modalSub}>{selected?.user?.email || selected?.email || 'Linked student login'}</Text>
              </View>
              <TouchableOpacity style={s.closeBtn} onPress={() => setSelected(null)}>
                <Text style={s.closeText}>X</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.form}>
              <Field label="Student ID" value={form.student_id} onChangeText={value => setField('student_id', value)} />
              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <Field label="First name" value={form.first_name} onChangeText={value => setField('first_name', value)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Last name" value={form.last_name} onChangeText={value => setField('last_name', value)} />
                </View>
              </View>
              <Field label="Email" value={form.email} onChangeText={value => setField('email', value)} keyboardType="email-address" autoCapitalize="none" />
              <Field label="Phone" value={form.phone} onChangeText={value => setField('phone', value)} keyboardType="phone-pad" />

              <Text style={s.label}>Gender</Text>
              <View style={s.segment}>
                {['male', 'female'].map(gender => (
                  <TouchableOpacity
                    key={gender}
                    style={[s.segmentItem, form.gender === gender && s.segmentActive]}
                    onPress={() => setField('gender', gender)}
                  >
                    <Text style={[s.segmentText, form.gender === gender && s.segmentTextActive]}>{gender}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <Field label="Grade / Year" value={form.grade_level} onChangeText={value => setField('grade_level', value)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Section" value={form.section} onChangeText={value => setField('section', value)} />
                </View>
              </View>
              <Field label="School year" value={form.school_year} onChangeText={value => setField('school_year', value)} />
              <Field label="Birthdate" value={form.birthdate} onChangeText={value => setField('birthdate', value)} placeholder="YYYY-MM-DD" />
              <Field label="Address" value={form.address} onChangeText={value => setField('address', value)} multiline />

              <Text style={s.label}>Status</Text>
              <View style={s.statusPicker}>
                {STATUS.map(status => (
                  <TouchableOpacity
                    key={status.value}
                    style={[s.statusOption, form.status === status.value && { backgroundColor: status.bg, borderColor: status.color }]}
                    onPress={() => setField('status', status.value)}
                  >
                    <Text style={[s.statusOptionText, form.status === status.value && { color: status.color }]}>{status.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.infoPanel}>
                <Text style={s.infoTitle}>Parent / Guardian</Text>
                <InfoRow label="Father" value={selected?.enrollment?.father_name} />
                <InfoRow label="Father occupation" value={selected?.enrollment?.father_occupation} />
                <InfoRow label="Mother" value={selected?.enrollment?.mother_name} />
                <InfoRow label="Mother occupation" value={selected?.enrollment?.mother_occupation} />
              </View>

              <View style={s.infoPanel}>
                <Text style={s.infoTitle}>Previous school</Text>
                <InfoRow label="School" value={selected?.enrollment?.prev_school} />
                <InfoRow label="Address" value={selected?.enrollment?.prev_school_address} />
                <InfoRow label="Student type" value={formatValue(selected?.enrollment?.student_type)} />
                <InfoRow label="Academic status" value={selected?.enrollment?.academic_status} />
              </View>

              <View style={s.infoPanel}>
                <Text style={s.infoTitle}>Subjects</Text>
                {selected?.subjects?.length ? selected.subjects.map(subject => (
                  <View key={`${subject.source}-${subject.id}`} style={s.subjectRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.subjectName}>{subject.code ? `${subject.code} · ` : ''}{subject.name}</Text>
                      <Text style={s.subjectMeta}>
                        {subject.teacher ? `${subject.teacher} · ` : ''}
                        {subject.day ? `${subject.day} ` : ''}
                        {subject.time_start || subject.time_end ? `${subject.time_start || ''}-${subject.time_end || ''} ` : ''}
                        {subject.room || ''}
                      </Text>
                      {subject.status === 'dropped' && (
                        <Text style={s.droppedMeta}>
                          Dropped{subject.drop_reason ? `: ${subject.drop_reason}` : ''}
                        </Text>
                      )}
                    </View>
                    <View style={role === 'registrar' ? s.subjectActions : s.subjectRight}>
                      <Text style={[
                        s.subjectStatus,
                        subject.status === 'completed' ? s.subjectCompleted :
                        subject.status === 'dropped' ? s.subjectDropped :
                        s.subjectEnrolled,
                      ]}>
                        {formatValue(subject.status || 'enrolled')}
                      </Text>
                      <Text style={s.subjectUnits}>{Number(subject.units_lec || 0) + Number(subject.units_lab || 0)}u</Text>
                      
                      {role === 'registrar' && (
                        subject.status === 'dropped' ? (
                          <TouchableOpacity style={s.restoreSubjectBtn} onPress={() => changeSubjectStatus(subject, 'restore')} disabled={saving}>
                            <Text style={s.restoreSubjectText}>Restore</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity style={s.dropSubjectBtn} onPress={() => changeSubjectStatus(subject, 'drop')} disabled={saving}>
                            <Text style={s.dropSubjectText}>Drop</Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  </View>
                )) : (
                  <Text style={s.emptyInline}>No subjects found for this student.</Text>
                )}
              </View>

              <View style={s.infoPanel}>
                <View style={s.panelHeader}>
                  <Text style={s.infoTitle}>Tuition & Fees</Text>
                  <Text style={s.balanceText}>Due PHP {Number(fees.total_due || 0).toFixed(2)}</Text>
                </View>
                {(fees.fees ?? []).length ? fees.fees.map(fee => {
                  const remaining = Math.max(0, Number(fee.amount || 0) - Number(fee.paid_amount || 0));
                  return (
                    <View key={fee.id} style={s.feeRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.subjectName}>{fee.type}</Text>
                        <Text style={s.subjectMeta}>Due {fee.due_date || 'TBA'} · {fee.status}</Text>
                      </View>
                      <View style={s.feeActions}>
                        <Text style={s.subjectUnits}>PHP {remaining.toFixed(2)}</Text>
                        {fee.status !== 'paid' ? (
                          <TouchableOpacity style={s.confirmFeeBtn} onPress={() => confirmFeePaid(fee)} disabled={saving}>
                            <Text style={s.confirmFeeText}>Confirm</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                }) : (
                  <Text style={s.emptyInline}>No fees posted for this student.</Text>
                )}

                <Text style={s.infoTitle}>Post tuition fee</Text>
                <Field label="Fee type" value={feeForm.type} onChangeText={value => setFeeField('type', value)} />
                <View style={s.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Field label="Amount" value={feeForm.amount} onChangeText={value => setFeeField('amount', value)} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Due date" value={feeForm.due_date} onChangeText={value => setFeeField('due_date', value)} placeholder="YYYY-MM-DD" />
                  </View>
                </View>
                <View style={s.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Field label="School year" value={feeForm.school_year} onChangeText={value => setFeeField('school_year', value)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Semester" value={feeForm.semester} onChangeText={value => setFeeField('semester', value)} placeholder="Optional" />
                  </View>
                </View>
                <Field label="Notes" value={feeForm.notes} onChangeText={value => setFeeField('notes', value)} multiline />
                <TouchableOpacity style={[s.postFeeBtn, saving && { opacity: 0.7 }]} onPress={createFee} disabled={saving}>
                  <Text style={s.postFeeText}>Post fee</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={saveStudent} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save student</Text>}
              </TouchableOpacity>

              <View style={s.passwordBox}>
                <Text style={s.passwordTitle}>Reset login password</Text>
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="New password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                />
                <TouchableOpacity style={s.resetBtn} onPress={resetPassword} disabled={saving}>
                  <Text style={s.resetText}>Update password</Text>
                </TouchableOpacity>
              </View>

              {role === 'admin' && (
                <TouchableOpacity style={s.deleteBtn} onPress={deleteStudent}>
                  <Text style={s.deleteText}>Delete student account</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

function Field({ label, ...props }) {
  return (
    <>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, props.multiline && { minHeight: 78, textAlignVertical: 'top', paddingTop: 12 }]}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
    </>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value || '-'}</Text>
    </View>
  );
}

function initials(student) {
  return `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase() || 'ST';
}

function formatValue(value) {
  if (!value) return '-';
  return String(value).replace(/_/g, ' ');
}

function flattenErrors(errors) {
  if (!errors) return '';
  return Object.values(errors).flat().join('\n');
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchRow: { paddingHorizontal: 16, marginBottom: 16 },
  searchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, height: 52, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: '#0F172A', fontSize: 14, height: 52 },
  filtersScroll: { flexGrow: 0, maxHeight: 48, marginBottom: 12 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
  filterChip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: '#F1F5F9' },
  filterChipActive: { backgroundColor: '#334155' },
  filterText: { color: '#334155', fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: '#fff' },
  list: { flex: 1, paddingHorizontal: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#334155', fontWeight: '900', fontSize: 13 },
  name: { color: '#111827', fontSize: 15, fontWeight: '800' },
  meta: { color: '#64748B', fontSize: 12, marginTop: 2 },
  program: { color: '#94A3B8', fontSize: 11, marginTop: 3 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '900' },
  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 30 },
  emptyTitle: { color: '#111827', fontSize: 16, fontWeight: '800' },
  emptySub: { color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '90%' },
  modalHeader: { padding: 18, borderBottomWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  modalTitle: { color: '#111827', fontSize: 18, fontWeight: '900' },
  modalSub: { color: '#64748B', fontSize: 12, marginTop: 4 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#334155', fontSize: 13, fontWeight: '900' },
  form: { padding: 18, paddingBottom: 30 },
  label: { color: '#334155', fontSize: 12, fontWeight: '900', marginBottom: 7, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 11, paddingHorizontal: 13, minHeight: 46, color: '#111827', fontSize: 14, backgroundColor: '#fff' },
  twoCol: { flexDirection: 'row', gap: 10 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  segmentActive: { backgroundColor: '#F1F5F9', borderColor: '#334155' },
  segmentText: { color: '#475569', fontSize: 12, fontWeight: '900', textTransform: 'capitalize' },
  segmentTextActive: { color: '#111827' },
  statusPicker: { flexDirection: 'row', gap: 8 },
  statusOption: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  statusOptionText: { color: '#475569', fontSize: 11, fontWeight: '900' },
  saveBtn: { marginTop: 22, backgroundColor: '#334155', borderRadius: 12, padding: 15, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  passwordBox: { marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  passwordTitle: { color: '#111827', fontWeight: '900', fontSize: 14, marginBottom: 8 },
  resetBtn: { marginTop: 10, backgroundColor: '#E0F2FE', borderRadius: 10, padding: 12, alignItems: 'center' },
  resetText: { color: '#0369A1', fontWeight: '900', fontSize: 13 },
  deleteBtn: { marginTop: 14, backgroundColor: '#FEE2E2', borderRadius: 12, padding: 15, alignItems: 'center' },
  deleteText: { color: '#B91C1C', fontWeight: '900', fontSize: 14 },
  infoPanel: { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  infoTitle: { color: '#111827', fontSize: 14, fontWeight: '900', marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 7, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  infoLabel: { color: '#64748B', fontSize: 12, fontWeight: '700', flex: 1 },
  infoValue: { color: '#111827', fontSize: 12, fontWeight: '800', flex: 1.25, textAlign: 'right' },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  subjectName: { color: '#111827', fontSize: 13, fontWeight: '900' },
  subjectMeta: { color: '#64748B', fontSize: 11, marginTop: 3 },
  droppedMeta: { color: '#B91C1C', fontSize: 11, fontWeight: '800', marginTop: 4 },
  subjectRight: { alignItems: 'flex-end', gap: 6 },
  subjectActions: { alignItems: 'flex-end', gap: 6 },
  subjectStatus: { fontSize: 10, fontWeight: '900', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', textTransform: 'capitalize' },
  subjectEnrolled: { color: '#0369A1', backgroundColor: '#E0F2FE' },
  subjectCompleted: { color: '#166534', backgroundColor: '#DCFCE7' },
  subjectDropped: { color: '#B91C1C', backgroundColor: '#FEE2E2' },
  subjectUnits: { color: '#334155', fontSize: 12, fontWeight: '900', backgroundColor: '#E2E8F0', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  emptyInline: { color: '#64748B', fontSize: 12, paddingVertical: 8 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 4 },
  balanceText: { color: '#334155', fontSize: 12, fontWeight: '900' },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  feeActions: { alignItems: 'flex-end', gap: 6 },
  confirmFeeBtn: { backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  confirmFeeText: { color: '#166534', fontSize: 11, fontWeight: '900' },
  postFeeBtn: { marginTop: 14, backgroundColor: '#DCFCE7', borderRadius: 12, padding: 14, alignItems: 'center' },
  postFeeText: { color: '#166534', fontWeight: '900', fontSize: 13 },
  dropSubjectBtn: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  dropSubjectText: { color: '#B91C1C', fontSize: 11, fontWeight: '900' },
  restoreSubjectBtn: { backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  restoreSubjectText: { color: '#166534', fontSize: 11, fontWeight: '900' },
});
