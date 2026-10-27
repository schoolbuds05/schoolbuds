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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(role === 'registrar' || role === 'admin' ? 'active' : 'all');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ yearLevel: '', schoolYear: '', course: '' });
  const [draftFilters, setDraftFilters] = useState({ yearLevel: '', schoolYear: '', course: '' });
  const [filterModalVisible, setFilterModalVisible] = useState(false);
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
      const res = await api.get(`/${role}/students`, { params });
      setStudents(res.data || []);
    } catch (e) {
      console.log(`${role} students error:`, e.message);
      Alert.alert('Could not load students', e.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

  const filterOptions = useMemo(() => ({
    yearLevels: [...new Set(students.map(student => String(student.grade_level ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    schoolYears: [...new Set(students.map(student => String(student.school_year ?? '').trim()).filter(Boolean))].sort().reverse(),
    courses: [...new Set(students.flatMap(student => [student.course, student.strand]).map(value => String(value ?? '').trim()).filter(Boolean))].sort(),
  }), [students]);

  const filteredStudents = role === 'registrar'
    ? students.filter(student => {
        const term = search.trim().toLowerCase();
        const matchesSearch = !term || [student.first_name, student.last_name, student.email, student.student_id, student.grade_level, student.section, student.course, student.strand]
          .some(value => value?.toString().toLowerCase().includes(term));
        const matchesAcademicFilters = (!filters.yearLevel || String(student.grade_level) === filters.yearLevel)
          && (!filters.schoolYear || String(student.school_year) === filters.schoolYear)
          && (!filters.course || [student.course, student.strand].some(value => String(value ?? '') === filters.course));
        return matchesSearch && matchesAcademicFilters && (statusFilter === 'all' || student.status === statusFilter);
      })
    : role === 'admin'
      ? students.filter(student => {
          const term = search.trim().toLowerCase();
          const matchesSearch = !term || [student.student_id, student.first_name, student.last_name, student.email, student.grade_level, student.section]
            .some(value => value?.toString().toLowerCase().includes(term));
          return matchesSearch && (statusFilter === 'all' || student.status === statusFilter);
        })
      : students;

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / 15));
  const page = Math.min(currentPage, totalPages);
  const visibleStudents = filteredStudents.slice((page - 1) * 15, page * 15);
  const pageNumbers = totalPages <= 5
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : page <= 3
      ? [1, 2, 3, 'start-gap', totalPages]
      : page >= totalPages - 2
        ? [1, 'end-gap', totalPages - 2, totalPages - 1, totalPages]
        : [1, 'start-gap', page - 1, page, page + 1, 'end-gap', totalPages];

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

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

  const adminTermStudent = students.find(student => student.school_year || student.enrollment?.semester);
  const adminSchoolYear = adminTermStudent?.school_year;
  const adminSemester = adminTermStudent?.enrollment?.semester;
  const adminTermLabel = adminSchoolYear
    ? `Term ${adminSchoolYear}${adminSemester ? ` · ${adminSemester.replace(/^./, value => value.toUpperCase())} semester` : ''}`
    : 'Current academic term';

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
    <View style={[s.container, (role === 'registrar' || role === 'admin') && { backgroundColor: theme?.bg }]}>
      {role === 'admin' ? (
        <View style={[s.adminContent, { paddingTop: Math.max(insets.top, 10) + 10 }]}>
          <Text style={s.adminEyebrow}>MANAGE</Text>
          <Text style={s.adminTitle}>Students</Text>
          <Text style={s.adminSubtitle}>{adminTermLabel}</Text>
        </View>
      ) : role === 'registrar' ? (
        <View style={[s.registrarHeader, { paddingTop: 12 + insets.top }]}>
          <Text style={s.registrarTitle}>Students</Text>
          <Text style={s.registrarSubtitle}>
            Approved learners{students[0]?.school_year ? ` · ${students[0].school_year}` : ''}
          </Text>
        </View>
      ) : (
        <HeaderGradient
          title="Manage students"
          subtitle="Review student profiles, status, and classroom assignments."
          initials="ST"
          stats={[
            { label: 'Active', value: totals.active, accent: '#15803D' },
            { label: 'Inactive', value: totals.inactive, accent: '#B91C1C' },
            { label: 'Graduated', value: totals.graduated, accent: '#0369A1' },
          ]}
        />
      )}

      {role === 'admin' && (
        <View style={s.adminStatusRow}>
          {STATUS.map(status => {
            const active = statusFilter === status.value;
            return (
              <TouchableOpacity
                key={status.value}
                style={[s.adminStatusTile, active && s.adminStatusTileActive]}
                onPress={() => setStatusFilter(status.value)}
                activeOpacity={0.82}
              >
                <Text style={[s.adminStatusCount, active && s.adminStatusCountActive]}>{totals[status.value]}</Text>
                <Text style={[s.adminStatusLabel, active && s.adminStatusLabelActive]}>{status.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={[s.searchRow, role === 'registrar' && s.registrarSearchRow, role === 'admin' && s.adminSearchRow]}>
        <View style={[s.searchCard, role === 'registrar' && s.registrarSearchCard, role === 'admin' && s.adminSearchCard]}>
          {role !== 'admin' && <Feather name="search" size={18} color="#9CA3AF" style={s.searchIcon} />}
          <TextInput
            style={[s.searchInput, role === 'admin' && s.adminSearchInput]}
            placeholder={role === 'registrar' ? 'Search ID, name, email or section' : 'Search ID, name, email, section'}
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>
        {role === 'registrar' && (
          <TouchableOpacity
            style={[s.filterButton, activeFilterCount > 0 && s.filterButtonActive]}
            onPress={() => {
              setDraftFilters(filters);
              setFilterModalVisible(true);
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Filter students"
          >
            <Feather name="sliders" size={15} color={activeFilterCount > 0 ? '#FFFFFF' : '#B51F3B'} />
            <Text style={[s.filterButtonText, activeFilterCount > 0 && s.filterButtonTextActive]}>
              Filters{activeFilterCount > 0 ? ` ${activeFilterCount}` : ''}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {role === 'registrar' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters} style={s.filtersScroll}>
          {STATUS.map(status => {
            const active = statusFilter === status.value;
            return (
              <TouchableOpacity
                key={status.value}
                style={[s.filterChip, s.registrarFilterChip, active && s.registrarFilterChipActive]}
                onPress={() => setStatusFilter(status.value)}
              >
                <Text style={[s.filterText, s.registrarFilterText, active && s.filterTextActive]}>
                  {status.label} {totals[status.value]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : role !== 'admin' ? (
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
      ) : null}

      {role === 'registrar' && (
        <Modal
          visible={filterModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setFilterModalVisible(false)}
        >
          <View style={s.filterOverlay}>
            <TouchableOpacity style={s.filterBackdrop} activeOpacity={1} onPress={() => setFilterModalVisible(false)} />
            <View style={s.filterSheet}>
              <View style={s.filterSheetHeader}>
                <View>
                  <Text style={s.filterSheetTitle}>Filter students</Text>
                  <Text style={s.filterSheetSubtitle}>Narrow the list by academic details.</Text>
                </View>
                <TouchableOpacity onPress={() => setFilterModalVisible(false)} style={s.filterClose} accessibilityLabel="Close filters">
                  <Feather name="x" size={18} color="#735D62" />
                </TouchableOpacity>
              </View>

              <ScrollView style={s.filterGroups} showsVerticalScrollIndicator={false}>
                {[
                  { key: 'yearLevel', label: 'Year level', options: filterOptions.yearLevels },
                  { key: 'schoolYear', label: 'School year', options: filterOptions.schoolYears },
                  { key: 'course', label: 'Course / strand', options: filterOptions.courses },
                ].map(group => (
                  <View key={group.key} style={s.filterGroup}>
                    <Text style={s.filterGroupTitle}>{group.label}</Text>
                    <View style={s.filterOptions}>
                      {['', ...group.options].map((option, index) => {
                        const selectedOption = draftFilters[group.key] === option;
                        return (
                          <TouchableOpacity
                            key={`${group.key}-${option || 'all'}-${index}`}
                            style={[s.filterOption, selectedOption && s.filterOptionActive]}
                            onPress={() => setDraftFilters(current => ({ ...current, [group.key]: option }))}
                          >
                            <Text style={[s.filterOptionText, selectedOption && s.filterOptionTextActive]}>
                              {option || `All ${group.label.toLowerCase()}s`}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={s.filterActions}>
                <TouchableOpacity
                  style={s.filterResetButton}
                  onPress={() => {
                    const emptyFilters = { yearLevel: '', schoolYear: '', course: '' };
                    setDraftFilters(emptyFilters);
                    setFilters(emptyFilters);
                    setFilterModalVisible(false);
                  }}
                >
                  <Text style={s.filterResetText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.filterApplyButton}
                  onPress={() => {
                    setFilters(draftFilters);
                    setFilterModalVisible(false);
                  }}
                >
                  <Text style={s.filterApplyText}>Apply filters</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#334155" />
        </View>
      ) : (
        <ScrollView
          style={[s.list, role === 'registrar' && { paddingHorizontal: 16, paddingTop: 4 }, role === 'admin' && s.adminList]}
          contentContainerStyle={{ paddingBottom: role === 'admin' ? 104 : 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {filteredStudents.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No students found</Text>
              <Text style={s.emptySub}>Try a different search or status filter.</Text>
            </View>
          ) : visibleStudents.map(student => {
            const status = STATUS.find(item => item.value === student.status) || STATUS[0];
            return (
              <TouchableOpacity key={student.id} style={[s.card, role === 'registrar' && s.registrarCard, role === 'admin' && s.adminCard]} onPress={() => openStudent(student)} activeOpacity={0.82}>
                <View style={s.cardTop}>
                  <View style={[s.avatar, role === 'registrar' && s.registrarAvatar, role === 'admin' && s.adminAvatar]}>
                    <Text style={[s.avatarText, role === 'registrar' && s.registrarAvatarText]}>{initials(student)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {role === 'admin' && (
                      <View style={s.adminNameIdRow}>
                        <Text style={[s.name, s.adminName]} numberOfLines={1}>{student.first_name} {student.last_name}</Text>
                        <Text style={s.adminYearSection} numberOfLines={1}>
                          {student.grade_level ? (/^year\s/i.test(String(student.grade_level)) ? student.grade_level : `Year ${student.grade_level}`) : 'Year not set'}
                          {student.section ? ` · ${student.section}` : ''}
                        </Text>
                      </View>
                    )}
                    {role !== 'admin' && <Text style={[s.name, role === 'registrar' && s.registrarName]}>{student.first_name} {student.last_name}</Text>}
                    <Text style={[s.meta, role === 'registrar' && s.registrarMeta, role === 'admin' && s.adminMeta]} numberOfLines={1}>{student.email}</Text>
                    {role === 'admin' && <Text style={s.adminStudentId} numberOfLines={1}>{student.student_id || 'No ID'}</Text>}
                    {role === 'admin' && (
                      <Text style={s.adminCreatedAt} numberOfLines={1}>
                        Created {student.created_at ? new Date(student.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'date unavailable'}
                      </Text>
                    )}
                    {role === 'registrar' ? (
                      <View style={s.registrarStudentDetails}>
                        <Text style={s.registrarStudentId}>{student.student_id || 'No student ID'}</Text>
                        <Text style={s.registrarProgram} numberOfLines={2}>
                          {student.section || 'No section'}{student.grade_level ? ` · ${student.grade_level}` : ''}
                        </Text>
                      </View>
                    ) : role !== 'admin' ? (
                      <Text style={s.program}>{student.grade_level} · {student.section} · {student.school_year}</Text>
                    ) : null}
                  </View>
                  {role === 'admin' ? (
                    <View style={s.adminSubjectCount}>
                      <Text style={s.adminSubjectNumber}>{student.subjects?.length || 0}</Text>
                      <Text style={s.adminSubjectLabel}>subjects</Text>
                    </View>
                  ) : <View style={[s.statusBadge, role === 'registrar' && s.registrarStatusBadge, { backgroundColor: role === 'registrar' ? (status.value === 'active' ? '#DDF1E8' : status.value === 'inactive' ? '#F8F0F2' : '#E8F1FF') : status.bg }]}>
                    <Text style={[s.statusText, role === 'registrar' && s.registrarStatusText, { color: role === 'registrar' ? (status.value === 'active' ? '#1D8062' : status.value === 'inactive' ? '#D85A30' : '#378ADD') : status.color }]}>
                      {status.label}
                    </Text>
                  </View>}
                </View>
              </TouchableOpacity>
            );
          })}
          {role === 'admin' && filteredStudents.length > 0 && (
            <View style={s.adminPagination}>
              <Text style={s.adminPaginationCount}>
                Showing {(page - 1) * 15 + 1}-{Math.min(page * 15, filteredStudents.length)} of {filteredStudents.length}
              </Text>
              {totalPages > 1 && (
                <View style={s.adminPageControls}>
                  <TouchableOpacity accessibilityLabel="Previous page" disabled={page === 1} onPress={() => setCurrentPage(page - 1)} style={s.adminPageControl}>
                    <Feather name="chevron-left" size={16} color={page === 1 ? '#C8B9BC' : '#B01236'} />
                  </TouchableOpacity>
                  {pageNumbers.map((pageItem, index) => pageItem === 'start-gap' || pageItem === 'end-gap' ? (
                    <Text key={`${pageItem}-${index}`} style={s.adminPageEllipsis}>...</Text>
                  ) : (
                    <TouchableOpacity key={pageItem} accessibilityLabel={`Page ${pageItem}`} onPress={() => setCurrentPage(pageItem)} style={[s.adminPageNumber, pageItem === page && s.adminPageNumberActive]}>
                      <Text style={[s.adminPageNumberText, pageItem === page && s.adminPageNumberTextActive]}>{pageItem}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity accessibilityLabel="Next page" disabled={page === totalPages} onPress={() => setCurrentPage(page + 1)} style={s.adminPageControl}>
                    <Feather name="chevron-right" size={16} color={page === totalPages ? '#C8B9BC' : '#B01236'} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {role === 'admin' && !loading && (
        <TouchableOpacity
          style={[s.adminFab, { bottom: 18 }]}
          onPress={() => Alert.alert('Add a student', 'New student profiles are created through the enrollment process.')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Add student"
        >
          <Feather name="plus" size={25} color="#FFFFFF" />
        </TouchableOpacity>
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

              {role === 'admin' && selected && (
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
  adminContent: { paddingHorizontal: 20, paddingBottom: 10 },
  adminEyebrow: { color: '#B01236', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  adminTitle: { color: '#29191D', fontSize: 28, fontWeight: '800', marginTop: 2, lineHeight: 34 },
  adminSubtitle: { color: '#806D71', fontSize: 12, marginTop: 3 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  registrarHeader: { paddingHorizontal: 20, paddingBottom: 10 },
  registrarTitle: { color: '#2A171B', fontSize: 23, fontWeight: '700', fontFamily: 'serif' },
  registrarSubtitle: { color: '#735D62', fontSize: 10, marginTop: 2 },
  searchRow: { paddingHorizontal: 16, marginBottom: 16 },
  searchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, height: 52, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  registrarSearchRow: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  adminSearchRow: { paddingHorizontal: 20, marginTop: 2, marginBottom: 14 },
  adminSearchCard: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#F0DDE1', paddingHorizontal: 13, elevation: 0, shadowOpacity: 0 },
  adminSearchInput: { fontSize: 14, height: 46 },
  registrarSearchCard: { flex: 1, borderRadius: 13, height: 40, borderWidth: 1, borderColor: '#F0E8E3', elevation: 0, shadowOpacity: 0 },
  adminStatusRow: { flexDirection: 'row', gap: 9, paddingHorizontal: 20, marginBottom: 12 },
  adminStatusTile: { flex: 1, minHeight: 66, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0DDE1' },
  adminStatusTileActive: { backgroundColor: '#B01236', borderColor: '#B01236' },
  adminStatusCount: { color: '#29191D', fontSize: 23, lineHeight: 26, fontWeight: '800' },
  adminStatusCountActive: { color: '#FFFFFF' },
  adminStatusLabel: { color: '#59484C', fontSize: 11, marginTop: 1 },
  adminStatusLabelActive: { color: '#FFFFFF', fontWeight: '700' },
  filterButton: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#F0E8E3' },
  filterButtonActive: { backgroundColor: '#B51F3B', borderColor: '#B51F3B' },
  filterButtonText: { color: '#B51F3B', fontSize: 10, fontWeight: '800' },
  filterButtonTextActive: { color: '#FFFFFF' },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: '#0F172A', fontSize: 14, height: 52 },
  filtersScroll: { flexGrow: 0, maxHeight: 48, marginBottom: 12 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
  registrarFilterChip: { paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0E8E3' },
  registrarFilterChipActive: { backgroundColor: '#B51F3B', borderColor: '#B51F3B' },
  registrarFilterText: { color: '#2A171B', fontSize: 10, fontWeight: '700' },
  filterChip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: '#F1F5F9' },
  filterChipActive: { backgroundColor: '#334155' },
  filterText: { color: '#334155', fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: '#fff' },
  list: { flex: 1, paddingHorizontal: 12 },
  adminList: { paddingHorizontal: 20, paddingTop: 1 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  adminCard: { borderRadius: 15, paddingHorizontal: 11, paddingVertical: 9, marginBottom: 8, borderColor: '#F0DDE1', elevation: 0, shadowOpacity: 0 },
  registrarCard: { borderRadius: 14, padding: 12, marginBottom: 10, borderColor: '#F0E8E3' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  registrarAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FBE5E9' },
  adminAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F7DDE2' },
  adminNameIdRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  adminName: { flex: 1, minWidth: 0, color: '#301D22', fontSize: 13, fontWeight: '700' },
  adminYearSection: { maxWidth: 125, color: '#806D71', fontSize: 9, fontWeight: '600', textAlign: 'right' },
  adminStudentId: { color: '#806D71', fontSize: 10, marginTop: 1 },
  adminCreatedAt: { color: '#806D71', fontSize: 9, marginTop: 1 },
  adminMeta: { color: '#806D71', fontSize: 11, marginTop: 1 },
  adminSubjectCount: { minWidth: 40, alignItems: 'flex-end', marginLeft: 4 },
  adminSubjectNumber: { color: '#806D71', fontSize: 12 },
  adminSubjectLabel: { color: '#806D71', fontSize: 11 },
  adminPagination: { alignItems: 'center', gap: 7, paddingVertical: 12 },
  adminPaginationCount: { color: '#806D71', fontSize: 11 },
  adminPageControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  adminPageControl: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  adminPageEllipsis: { width: 18, textAlign: 'center', color: '#806D71', fontSize: 13 },
  adminPageNumber: { minWidth: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  adminPageNumberActive: { backgroundColor: '#B01236' },
  adminPageNumberText: { color: '#806D71', fontSize: 11, fontWeight: '700' },
  adminPageNumberTextActive: { color: '#FFFFFF' },
  adminFab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#B01236', alignItems: 'center', justifyContent: 'center', elevation: 7, shadowColor: '#6E0920', shadowOpacity: 0.22, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } },
  registrarAvatarText: { color: '#B51F3B' },
  avatarText: { color: '#334155', fontWeight: '900', fontSize: 13 },
  name: { color: '#111827', fontSize: 15, fontWeight: '800' },
  registrarName: { color: '#21171A', fontSize: 12, fontWeight: '700' },
  meta: { color: '#64748B', fontSize: 12, marginTop: 2 },
  registrarMeta: { color: '#806F73', fontSize: 10, marginTop: 1 },
  program: { color: '#94A3B8', fontSize: 11, marginTop: 3 },
  registrarStudentDetails: { flexDirection: 'row', gap: 8, marginTop: 4 },
  registrarStudentId: { flex: 1, color: '#21171A', fontSize: 10, fontWeight: '600' },
  registrarProgram: { flex: 1, color: '#735D62', fontSize: 10 },
  filterOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(36,20,25,0.36)' },
  filterBackdrop: { ...StyleSheet.absoluteFillObject },
  filterSheet: { maxHeight: '82%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 24 },
  filterSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F0E8E3' },
  filterSheetTitle: { color: '#2A171B', fontSize: 17, fontWeight: '800' },
  filterSheetSubtitle: { color: '#735D62', fontSize: 11, marginTop: 3 },
  filterClose: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#FBF8F5' },
  filterGroups: { flexGrow: 0, paddingTop: 4 },
  filterGroup: { paddingTop: 14 },
  filterGroupTitle: { color: '#735D62', fontSize: 11, fontWeight: '800', marginBottom: 8 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterOption: { borderWidth: 1, borderColor: '#F0E8E3', borderRadius: 18, backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 7 },
  filterOptionActive: { borderColor: '#B51F3B', backgroundColor: '#FBE5E9' },
  filterOptionText: { color: '#735D62', fontSize: 10, fontWeight: '600' },
  filterOptionTextActive: { color: '#B51F3B', fontWeight: '800' },
  filterActions: { flexDirection: 'row', gap: 9, borderTopWidth: 1, borderTopColor: '#F0E8E3', paddingTop: 14, marginTop: 14 },
  filterResetButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#B51F3B', borderRadius: 11, minHeight: 43 },
  filterResetText: { color: '#B51F3B', fontSize: 12, fontWeight: '800' },
  filterApplyButton: { flex: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B51F3B', borderRadius: 11, minHeight: 43 },
  filterApplyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  registrarStatusBadge: { paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '900' },
  registrarStatusText: { fontSize: 9, fontWeight: '700' },
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
