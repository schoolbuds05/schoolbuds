// @ts-nocheck
// app/(registrar)/sections.tsx — Registrar/Admin section management

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, RefreshControl,
  ScrollView, StatusBar, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import api from '../../src/api';
import HeaderGradient from '../components/ui/HeaderGradient';
import SearchBar from '../components/ui/SearchBar';

const C = {
  blue: '#378ADD', blueLight: '#E6F1FB',
  green: '#1D9E75', greenLight: '#E1F5EE',
  bg: '#F4F6F9', card: '#FFFFFF', border: '#EFEFEF',
  text: '#1A1A2E', sub: '#6B7280', muted: '#B0B7C3',
};

const HEADER_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 10 : 52;
const CURRENT_SY = '2024-2025';

const EMPTY_FORM = {
  name: '',
  program_type: 'college',
  course: '',
  strand: '',
  year_level: '',
  school_year: CURRENT_SY,
  semester: '1st',
  max_students: '40',
  is_active: true,
};

const EMPTY_ASSIGNMENT = {
  subject_id: '',
  teacher_id: '',
  day: '',
  time_start: '',
  time_end: '',
  room: '',
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const MINUTES = ['00', '15', '30', '45'];
const PERIODS = ['AM', 'PM'];

function Field({ label, children }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChipGroup({ options, value, onSelect }) {
  return (
    <View style={s.chipRow}>
      {options.map(opt => {
        const key = opt.key ?? opt;
        const selectedValues = String(value || '').split(',').map(item => item.trim()).filter(Boolean);
        const active = value === key || selectedValues.includes(key);
        return (
          <TouchableOpacity
            key={key}
            style={[s.chip, active && s.chipActive]}
            onPress={() => onSelect(key)}
          >
            <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label ?? opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function normalizeValue(value) {
  return String(value ?? '').trim().toLowerCase();
}

function toggleListValue(currentValue, option) {
  const values = String(currentValue || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const next = values.includes(option)
    ? values.filter(value => value !== option)
    : [...values, option];
  return next.join(', ');
}

function formatTimeLabel(value) {
  if (!value) return 'Set time';
  const [hourValue, minute = '00'] = String(value).split(':');
  const hour = Number(hourValue);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${period}`;
}

function timeParts(value) {
  const [hourValue, minuteValue = '00'] = String(value || '08:00').split(':');
  const hour24 = Number(hourValue);
  return {
    hour: String(hour24 % 12 || 12),
    minute: MINUTES.includes(minuteValue) ? minuteValue : '00',
    period: hour24 >= 12 ? 'PM' : 'AM',
  };
}

function buildTimeValue(currentValue, key, value) {
  const parts = { ...timeParts(currentValue), [key]: value };
  let hour = Number(parts.hour);
  if (parts.period === 'PM' && hour !== 12) hour += 12;
  if (parts.period === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${parts.minute}`;
}

function TimePicker({ label, value, onChange }) {
  const parts = timeParts(value);

  return (
    <View style={s.clockBox}>
      <View style={s.clockHeader}>
        <Text style={s.clockLabel}>{label}</Text>
        <Text style={s.clockValue}>{formatTimeLabel(value)}</Text>
      </View>
      <Text style={s.clockSubLabel}>Hour</Text>
      <ChipGroup
        value={parts.hour}
        onSelect={hour => onChange(buildTimeValue(value, 'hour', hour))}
        options={HOURS}
      />
      <Text style={s.clockSubLabel}>Minute</Text>
      <ChipGroup
        value={parts.minute}
        onSelect={minute => onChange(buildTimeValue(value, 'minute', minute))}
        options={MINUTES}
      />
      <Text style={s.clockSubLabel}>AM / PM</Text>
      <ChipGroup
        value={parts.period}
        onSelect={period => onChange(buildTimeValue(value, 'period', period))}
        options={PERIODS}
      />
    </View>
  );
}

export default function Sections() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherLoadError, setTeacherLoadError] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherDropdownOpen, setTeacherDropdownOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [studentLoadError, setStudentLoadError] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [enrollingStudent, setEnrollingStudent] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [assignment, setAssignment] = useState(EMPTY_ASSIGNMENT);
  const [assigning, setAssigning] = useState(false);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const setSchedule = (key, value) => setAssignment(prev => ({ ...prev, [key]: value }));

  const fetchSections = useCallback(async () => {
    try {
      const res = await api.get('/sections', {
        params: { search: search.trim() || undefined },
      });
      setSections(res.data ?? []);
    } catch (e) {
      console.log('Sections fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  const fetchSubjects = useCallback(async () => {
    try {
      const res = await api.get('/subjects');
      setSubjects(res.data ?? []);
    } catch (e) {
      console.log('Subjects fetch error:', e.message);
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const res = await api.get('/courses', {
        params: {
          program_type: form.program_type,
          search: courseSearch.trim() || undefined,
        },
      });
      setCourses(res.data ?? []);
    } catch (e) {
      console.log('Courses fetch error:', e.message);
    } finally {
      setLoadingCourses(false);
    }
  }, [form.program_type, courseSearch]);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await api.get('/registrar/teachers');
      setTeachers(res.data ?? []);
      setTeacherLoadError('');
    } catch (e) {
      console.log('Teachers fetch error:', e.message);
      setTeachers([]);
      setTeacherLoadError(e.response?.data?.message ?? 'Could not load teachers.');
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await api.get('/registrar/section-students', {
        params: {
          grade_level: editing?.year_level || undefined,
          program_type: editing?.program_type || undefined,
          course: editing?.program_type === 'college' ? editing?.course || undefined : undefined,
          strand: editing?.program_type === 'shs' ? editing?.strand || undefined : undefined,
          search: studentSearch.trim() || undefined,
        },
      });
      setStudents(res.data ?? []);
      setStudentLoadError('');
    } catch (e) {
      console.log('Students fetch error:', e.message);
      setStudents([]);
      setStudentLoadError(e.response?.data?.message ?? 'Could not load students.');
    }
  }, [editing?.course, editing?.program_type, editing?.strand, editing?.year_level, studentSearch]);

  const refreshEditingSection = useCallback(async (sectionId) => {
    const res = await api.get(`/sections/${sectionId}`);
    setEditing({
      ...res.data,
      student_count: res.data.students?.filter(student => student.pivot?.status === 'enrolled').length ?? editing?.student_count ?? 0,
    });
  }, [editing?.student_count]);

  useEffect(() => { fetchSections(); fetchSubjects(); fetchTeachers(); }, [fetchSections, fetchSubjects, fetchTeachers]);
  useEffect(() => { fetchCourses(); }, [fetchCourses]);
  useEffect(() => { if (editing) fetchStudents(); }, [editing, fetchStudents]);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(teacher =>
      teacher.name?.toLowerCase().includes(q) || teacher.email?.toLowerCase().includes(q)
    );
  }, [teacherSearch, teachers]);

  const selectedTeacher = useMemo(
    () => teachers.find(teacher => String(teacher.id) === String(assignment.teacher_id)),
    [assignment.teacher_id, teachers]
  );

  const enrolledStudents = useMemo(() => editing?.students ?? [], [editing?.students]);

  const availableStudents = useMemo(() => {
    const enrolledIds = enrolledStudents.map(student => student.id);
    return students.filter(student => !enrolledIds.includes(student.user_id));
  }, [enrolledStudents, students]);

  const assignedSubjects = useMemo(() => editing?.section_subjects ?? [], [editing?.section_subjects]);

  const availableSubjects = useMemo(() => {
    if (!editing) return [];
    const assignedIds = assignedSubjects.map(item => item.subject_id);
    return subjects.filter(subject => {
      const sameProgram = subject.program_type === editing.program_type;
      const sameYear = normalizeValue(subject.year_level) === normalizeValue(editing.year_level);
      const sameTrack = editing.program_type === 'college'
        ? normalizeValue(subject.course) === normalizeValue(editing.course)
        : normalizeValue(subject.strand) === normalizeValue(editing.strand);
      return sameProgram && sameYear && sameTrack && !assignedIds.includes(subject.id);
    });
  }, [assignedSubjects, editing, subjects]);

  // Filtered sections for search (client-side fallback)
  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(sec =>
      sec.name?.toLowerCase().includes(q) ||
      sec.course?.toLowerCase().includes(q) ||
      sec.strand?.toLowerCase().includes(q)
    );
  }, [sections, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setAssignment(EMPTY_ASSIGNMENT);
    setCourseSearch('');
    setCourseDropdownOpen(false);
    setTeacherSearch('');
    setTeacherDropdownOpen(false);
    setStudentSearch('');
    setSelectedStudentId('');
    setShowModal(true);
  };

  const openEdit = (section) => {
    setEditing(section);
    setForm({
      name: section.name ?? '',
      program_type: section.program_type ?? 'college',
      course: section.course ?? '',
      strand: section.strand ?? '',
      year_level: section.year_level ?? '',
      school_year: section.school_year ?? CURRENT_SY,
      semester: section.semester ?? '1st',
      max_students: String(section.max_students ?? 40),
      is_active: section.is_active ?? true,
    });
    setAssignment(EMPTY_ASSIGNMENT);
    setCourseSearch('');
    setCourseDropdownOpen(false);
    setTeacherSearch('');
    setTeacherDropdownOpen(false);
    setStudentSearch('');
    setSelectedStudentId('');
    setShowModal(true);
    refreshEditingSection(section.id).catch(e => console.log('Section detail fetch error:', e.message));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return Alert.alert('Required', 'Section name is required.');
    if (!form.school_year.trim()) return Alert.alert('Required', 'School year is required.');
    if (form.program_type === 'college' && !form.course.trim()) return Alert.alert('Required', 'Select an active course.');
    if (form.program_type === 'shs' && !form.strand.trim()) return Alert.alert('Required', 'Select an active strand/program.');

    const payload = {
      name: form.name.trim(),
      program_type: form.program_type,
      course: form.program_type === 'college' ? form.course.trim() : null,
      strand: form.program_type === 'shs' ? form.strand.trim() : null,
      year_level: form.year_level,
      school_year: form.school_year.trim(),
      semester: form.semester,
      max_students: parseInt(form.max_students || '40', 10),
      is_active: form.is_active,
    };

    setSaving(true);
    try {
      if (editing) await api.put(`/sections/${editing.id}`, payload);
      else await api.post('/sections', payload);
      setShowModal(false);
      await fetchSections();
      Alert.alert('Saved', editing ? 'Section updated.' : 'Section created.');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message ?? 'Could not save section.');
    } finally {
      setSaving(false);
    }
  };

  const fillAssignment = (item) => {
    setAssignment({
      subject_id: String(item.subject_id),
      teacher_id: item.teacher_id ? String(item.teacher_id) : '',
      day: item.day ?? '',
      time_start: item.time_start ?? '',
      time_end: item.time_end ?? '',
      room: item.room ?? '',
    });
    setTeacherSearch('');
    setTeacherDropdownOpen(false);
  };

  const handleAssignSubject = async () => {
    if (!editing?.id) return Alert.alert('Save first', 'Create the section before assigning subjects.');
    if (!assignment.subject_id) return Alert.alert('Required', 'Select a subject to assign.');

    setAssigning(true);
    try {
      await api.post(`/sections/${editing.id}/subjects`, {
        subject_id: parseInt(assignment.subject_id, 10),
        teacher_id: assignment.teacher_id ? parseInt(assignment.teacher_id, 10) : null,
        day: assignment.day.trim() || null,
        time_start: assignment.time_start.trim() || null,
        time_end: assignment.time_end.trim() || null,
        room: assignment.room.trim() || null,
      });
      setAssignment(EMPTY_ASSIGNMENT);
      setTeacherSearch('');
      setTeacherDropdownOpen(false);
      await refreshEditingSection(editing.id);
      await fetchSections();
      Alert.alert('Saved', 'Subject assigned to section.');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message ?? 'Could not assign subject.');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveSubject = (item) => {
    Alert.alert('Remove Subject', `Remove ${item.subject?.code ?? 'this subject'} from ${editing.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/sections/${editing.id}/subjects/${item.subject_id}`);
          if (String(assignment.subject_id) === String(item.subject_id)) setAssignment(EMPTY_ASSIGNMENT);
          setTeacherDropdownOpen(false);
          await refreshEditingSection(editing.id);
          await fetchSections();
        } catch (e) {
          Alert.alert('Error', e.response?.data?.message ?? 'Could not remove subject.');
        }
      }},
    ]);
  };

  const handleEnrollStudent = async () => {
    if (!editing?.id) return Alert.alert('Save first', 'Create the section before enrolling students.');
    if (!selectedStudentId) return Alert.alert('Required', 'Select a student to enroll.');
    if ((editing.student_count ?? enrolledStudents.length) >= Number(editing.max_students ?? 0)) {
      return Alert.alert('Section Full', 'This section has reached its maximum students.');
    }

    setEnrollingStudent(true);
    try {
      await api.post(`/sections/${editing.id}/students`, {
        user_id: parseInt(selectedStudentId, 10),
      });
      setSelectedStudentId('');
      setStudentSearch('');
      await refreshEditingSection(editing.id);
      await fetchSections();
      await fetchStudents();
      Alert.alert('Saved', 'Student enrolled in section.');
    } catch (e) {
      const missing = e.response?.data?.missing_prerequisites;
      const message = missing?.length
        ? `${e.response?.data?.message}\n\nMissing: ${missing.map(item => item.code).join(', ')}`
        : e.response?.data?.message ?? 'Could not enroll student.';
      Alert.alert('Error', message);
    } finally {
      setEnrollingStudent(false);
    }
  };

  const handleRemoveStudent = (student) => {
    Alert.alert('Remove Student', `Remove ${student.name} from ${editing.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/sections/${editing.id}/students/${student.id}`);
          if (String(selectedStudentId) === String(student.id)) setSelectedStudentId('');
          await refreshEditingSection(editing.id);
          await fetchSections();
          await fetchStudents();
        } catch (e) {
          Alert.alert('Error', e.response?.data?.message ?? 'Could not remove student.');
        }
      }},
    ]);
  };

  return (
    <View style={s.container}>
      <HeaderGradient
        title="Sections"
        subtitle={`${sections.length} active sections`}
        initials="SC"
        stats={[
          { label: 'Sections', value: sections.length, accent: '#C7D2FE' },
          { label: 'Students', value: enrolledStudents.length, accent: '#A7F3D0' },
          { label: 'Open', value: sections.filter(sec => sec.is_open).length, accent: '#FDE68A' },
        ]}
      >
        {/* Search + Create button row */}
        <View style={s.searchRow}>
          <View style={{ flex: 1 }}>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search sections..."
              onSubmitEditing={fetchSections}
            />
          </View>
          <TouchableOpacity style={s.addBtn} onPress={openCreate}>
            <Text style={s.addBtnText}>+ Create</Text>
          </TouchableOpacity>
        </View>
      </HeaderGradient>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.blue} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchSections(); }}
            />
          }
        >
          {filteredSections.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🏫</Text>
              <Text style={s.emptyTitle}>{search ? 'No results found' : 'No sections yet'}</Text>
              <Text style={s.emptySub}>{search ? 'Try a different search term.' : 'Tap "+ Create" to add your first section.'}</Text>
            </View>
          ) : filteredSections.map(section => (
            <TouchableOpacity key={section.id} style={s.card} onPress={() => openEdit(section)}>
              <View style={s.cardTop}>
                <View style={s.sectionBadge}>
                  <Text style={s.sectionBadgeText}>{section.program_type === 'shs' ? 'SHS' : 'COL'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sectionName}>{section.name}</Text>
                  <Text style={s.sectionMeta}>
                    {section.program_type === 'shs'
                      ? `${section.strand || 'No strand'} · Grade ${section.year_level || '-'}`
                      : `${section.course || 'No course'} · Year ${section.year_level || '-'}`}
                  </Text>
                </View>
                <Text style={s.countText}>{section.student_count ?? 0}/{section.max_students}</Text>
              </View>
              {!!section.section_subjects?.length && (
                <View style={s.subjectPreview}>
                  {section.section_subjects.slice(0, 3).map(item => (
                    <Text key={item.id} style={s.subjectPill}>{item.subject?.code ?? 'Subject'}</Text>
                  ))}
                  {section.section_subjects.length > 3 && (
                    <Text style={s.morePill}>+{section.section_subjects.length - 3}</Text>
                  )}
                </View>
              )}
              <View style={s.cardFooter}>
                <Text style={s.footerText}>{section.school_year} · {section.semester} semester</Text>
                <Text style={s.editHint}>Edit →</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          {/* Modal Header */}
          <View style={s.modalHeader}>
            <View style={s.modalHeaderLeft}>
              <Text style={s.modalTitle}>{editing ? `Edit: ${editing.name}` : 'Create Section'}</Text>
              <Text style={s.modalSubtitle}>{editing ? 'Update section details' : 'Fill in the section info below'}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowModal(false)} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">

            {/* ── SECTION INFO CARD ── */}
            <View style={s.sectionCard}>
              <Text style={s.sectionCardTitle}>📋 Section Info</Text>

              <Field label="Section Name *">
                <TextInput
                  style={s.input}
                  value={form.name}
                  onChangeText={v => set('name', v)}
                  placeholder="e.g. BSIT 3A"
                  placeholderTextColor={C.muted}
                />
              </Field>

              <Field label="Program Type">
                <ChipGroup
                  value={form.program_type}
                  onSelect={v => {
                    setForm(prev => ({ ...prev, program_type: v, course: '', strand: '', year_level: '' }));
                    setCourseSearch('');
                    setCourseDropdownOpen(false);
                  }}
                  options={[
                    { key: 'college', label: '🎓 College' },
                    { key: 'shs', label: '🏫 SHS' },
                  ]}
                />
              </Field>

              {form.program_type === 'college' ? (
                <>
                  <Field label="Active Course">
                    <TouchableOpacity
                      style={[s.dropdown, form.course && s.dropdownActive]}
                      onPress={() => setCourseDropdownOpen(open => !open)}
                    >
                      <Text style={[s.dropdownLabel, !form.course && { color: C.muted }]}>
                        {form.course || 'Select active course'}
                      </Text>
                      <Text style={s.dropdownArrow}>{courseDropdownOpen ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {courseDropdownOpen && (
                      <View style={s.dropdownPanel}>
                        <TextInput
                          style={[s.input, s.courseSearchInput]}
                          value={courseSearch}
                          onChangeText={setCourseSearch}
                          placeholder="Search active courses..."
                          placeholderTextColor={C.muted}
                        />
                        {loadingCourses ? (
                          <View style={s.dropdownLoading}><ActivityIndicator color={C.blue} /></View>
                        ) : (
                          <ScrollView style={s.dropdownScroll} keyboardShouldPersistTaps="handled">
                            {courses.map(course => (
                              <TouchableOpacity
                                key={course.id}
                                style={[s.courseOption, form.course === course.name && s.courseOptionActive]}
                                onPress={() => { set('course', course.name); setCourseDropdownOpen(false); }}
                              >
                                <Text style={s.courseOptionText}>{course.acronym ? `${course.acronym} - ${course.name}` : course.name}</Text>
                              </TouchableOpacity>
                            ))}
                            {courses.length === 0 && (
                              <Text style={s.dropdownEmpty}>No active college courses found.</Text>
                            )}
                          </ScrollView>
                        )}
                      </View>
                    )}
                  </Field>
                  <Field label="Year Level">
                    <ChipGroup
                      value={form.year_level}
                      onSelect={v => set('year_level', v)}
                      options={[
                        { key: '1', label: '1st' },
                        { key: '2', label: '2nd' },
                        { key: '3', label: '3rd' },
                        { key: '4', label: '4th' },
                      ]}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Active Strand / Program">
                    <TouchableOpacity
                      style={[s.dropdown, form.strand && s.dropdownActive]}
                      onPress={() => setCourseDropdownOpen(open => !open)}
                    >
                      <Text style={[s.dropdownLabel, !form.strand && { color: C.muted }]}>
                        {form.strand || 'Select active strand/program'}
                      </Text>
                      <Text style={s.dropdownArrow}>{courseDropdownOpen ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {courseDropdownOpen && (
                      <View style={s.dropdownPanel}>
                        <TextInput
                          style={[s.input, s.courseSearchInput]}
                          value={courseSearch}
                          onChangeText={setCourseSearch}
                          placeholder="Search active SHS programs..."
                          placeholderTextColor={C.muted}
                        />
                        {loadingCourses ? (
                          <View style={s.dropdownLoading}><ActivityIndicator color={C.blue} /></View>
                        ) : (
                          <ScrollView style={s.dropdownScroll} keyboardShouldPersistTaps="handled">
                            {courses.map(course => (
                              <TouchableOpacity
                                key={course.id}
                                style={[s.courseOption, form.strand === course.name && s.courseOptionActive]}
                                onPress={() => { set('strand', course.name); setCourseDropdownOpen(false); }}
                              >
                                <Text style={s.courseOptionText}>{course.acronym ? `${course.acronym} - ${course.name}` : course.name}</Text>
                              </TouchableOpacity>
                            ))}
                            {courses.length === 0 && (
                              <Text style={s.dropdownEmpty}>No active SHS programs found.</Text>
                            )}
                          </ScrollView>
                        )}
                      </View>
                    )}
                  </Field>
                  <Field label="Grade Level">
                    <ChipGroup
                      value={form.year_level}
                      onSelect={v => set('year_level', v)}
                      options={[
                        { key: '11', label: 'Grade 11' },
                        { key: '12', label: 'Grade 12' },
                      ]}
                    />
                  </Field>
                </>
              )}
            </View>

            {/* ── SCHEDULE CARD ── */}
            <View style={s.sectionCard}>
              <Text style={s.sectionCardTitle}>📅 Schedule & Capacity</Text>

              <Field label="School Year *">
                <TextInput
                  style={s.input}
                  value={form.school_year}
                  onChangeText={v => set('school_year', v)}
                  placeholder="e.g. 2024-2025"
                  placeholderTextColor={C.muted}
                />
              </Field>

              <Field label="Semester">
                <ChipGroup
                  value={form.semester}
                  onSelect={v => set('semester', v)}
                  options={[
                    { key: '1st', label: '1st' },
                    { key: '2nd', label: '2nd' },
                    { key: 'summer', label: 'Summer' },
                  ]}
                />
              </Field>

              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <Field label="Max Students">
                    <TextInput
                      style={s.input}
                      value={form.max_students}
                      onChangeText={v => set('max_students', v.replace(/[^0-9]/g, ''))}
                      placeholder="40"
                      placeholderTextColor={C.muted}
                      keyboardType="numeric"
                    />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Status">
                    <ChipGroup
                      value={form.is_active ? 'active' : 'inactive'}
                      onSelect={v => set('is_active', v === 'active')}
                      options={[
                        { key: 'active', label: '✅ Active' },
                        { key: 'inactive', label: '⏸ Inactive' },
                      ]}
                    />
                  </Field>
                </View>
              </View>
            </View>

            {/* ── SAVE BUTTON (top-level) ── */}
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{editing ? '💾 Update Section' : '✅ Create Section'}</Text>}
            </TouchableOpacity>

            {/* ── ASSIGNED SUBJECTS (edit only) ── */}
            {editing && (
              <View style={s.managerCard}>
                <View style={s.managerCardHeader}>
                  <Text style={s.managerTitle}>📚 Assigned Subjects</Text>
                  <Text style={s.managerSub}>{assignedSubjects.length} subjects</Text>
                </View>

                {assignedSubjects.length === 0 ? (
                  <Text style={s.helperText}>No subjects assigned yet.</Text>
                ) : assignedSubjects.map(item => (
                  <View key={item.id} style={s.assignedRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.assignedTitle}>{item.subject?.code} · {item.subject?.name}</Text>
                      <Text style={s.assignedMeta}>
                        {[item.day, item.time_start && item.time_end ? `${item.time_start}-${item.time_end}` : null, item.room]
                          .filter(Boolean).join(' · ') || 'No schedule set'}
                      </Text>
                      {item.teacher?.name ? <Text style={s.assignedMeta}>👤 {item.teacher.name}</Text> : null}
                    </View>
                    <TouchableOpacity style={s.smallBtn} onPress={() => fillAssignment(item)}>
                      <Text style={s.smallBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.removeBtn} onPress={() => handleRemoveSubject(item)}>
                      <Text style={s.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={s.assignBox}>
                  <Text style={s.assignTitle}>
                    {assignment.subject_id && assignedSubjects.some(item => String(item.subject_id) === assignment.subject_id)
                      ? '✏️ Update Schedule'
                      : '➕ Add Subject'}
                  </Text>
                  <Field label="Subject">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.subjectChoices}>
                      {assignedSubjects
                        .filter(item => String(item.subject_id) === assignment.subject_id)
                        .map(item => (
                          <TouchableOpacity key={`assigned-${item.subject_id}`} style={[s.subjectChoice, s.subjectChoiceActive]} onPress={() => setSchedule('subject_id', String(item.subject_id))}>
                            <Text style={[s.subjectChoiceText, s.subjectChoiceTextActive]}>{item.subject?.code}</Text>
                          </TouchableOpacity>
                        ))}
                      {availableSubjects.map(subject => (
                        <TouchableOpacity
                          key={subject.id}
                          style={[s.subjectChoice, String(subject.id) === assignment.subject_id && s.subjectChoiceActive]}
                          onPress={() => setSchedule('subject_id', String(subject.id))}
                        >
                          <Text style={[s.subjectChoiceText, String(subject.id) === assignment.subject_id && s.subjectChoiceTextActive]}>
                            {subject.code}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      {availableSubjects.length === 0 && !assignment.subject_id && (
                        <Text style={s.helperText}>No matching unassigned subjects found.</Text>
                      )}
                    </ScrollView>
                  </Field>
                  <View style={s.twoCol}>
                    <View style={{ flex: 1 }}>
                      <Field label="Days">
                        <ChipGroup
                          value={assignment.day}
                          onSelect={v => setSchedule('day', toggleListValue(assignment.day, v))}
                          options={DAYS.map(day => ({
                            key: day,
                            label: assignment.day.split(',').map(value => value.trim()).includes(day) ? `[x] ${day}` : `[ ] ${day}`,
                          }))}
                        />
                      </Field>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label="Room">
                        <TextInput style={s.input} value={assignment.room} onChangeText={v => setSchedule('room', v)} placeholder="e.g. Room 101" placeholderTextColor={C.muted} />
                      </Field>
                    </View>
                  </View>
                  <View style={s.twoCol}>
                    <View style={{ flex: 1 }}>
                      <TimePicker
                        label="Start"
                        value={assignment.time_start}
                        onChange={value => setSchedule('time_start', value)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TimePicker
                        label="End"
                        value={assignment.time_end}
                        onChange={value => setSchedule('time_end', value)}
                      />
                    </View>
                  </View>
                  <Field label="Teacher">
                    <TouchableOpacity
                      style={[s.dropdown, assignment.teacher_id && s.dropdownActive]}
                      onPress={() => setTeacherDropdownOpen(open => !open)}
                    >
                      <Text style={[s.dropdownLabel, !selectedTeacher && { color: C.muted }]}>
                        {selectedTeacher?.name || 'Select teacher (optional)'}
                      </Text>
                      <Text style={s.dropdownArrow}>{teacherDropdownOpen ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {teacherDropdownOpen && (
                      <View style={s.dropdownPanel}>
                        <TextInput
                          style={[s.input, s.courseSearchInput]}
                          value={teacherSearch}
                          onChangeText={setTeacherSearch}
                          placeholder="Search teachers..."
                          placeholderTextColor={C.muted}
                        />
                        <ScrollView style={s.dropdownScroll} keyboardShouldPersistTaps="handled">
                          <TouchableOpacity
                            style={[s.courseOption, !assignment.teacher_id && s.courseOptionActive]}
                            onPress={() => { setSchedule('teacher_id', ''); setTeacherDropdownOpen(false); }}
                          >
                            <Text style={s.courseOptionText}>No teacher assigned</Text>
                          </TouchableOpacity>
                          {filteredTeachers.map(teacher => (
                            <TouchableOpacity
                              key={teacher.id}
                              style={[s.courseOption, String(teacher.id) === String(assignment.teacher_id) && s.courseOptionActive]}
                              onPress={() => { setSchedule('teacher_id', String(teacher.id)); setTeacherDropdownOpen(false); }}
                            >
                              <Text style={s.courseOptionText}>{teacher.name}</Text>
                              {!!teacher.email && <Text style={s.optionSubText}>{teacher.email}</Text>}
                            </TouchableOpacity>
                          ))}
                          {teacherLoadError ? (
                            <Text style={s.dropdownEmpty}>{teacherLoadError}</Text>
                          ) : filteredTeachers.length === 0 && (
                            <Text style={s.dropdownEmpty}>No teachers found.</Text>
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </Field>
                  <TouchableOpacity style={[s.assignBtn, assigning && { opacity: 0.6 }]} onPress={handleAssignSubject} disabled={assigning}>
                    {assigning ? <ActivityIndicator color="#fff" /> : <Text style={s.assignBtnText}>💾 Save Subject Schedule</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── ENROLLED STUDENTS (edit only) ── */}
            {editing && (
              <View style={s.managerCard}>
                <View style={s.managerCardHeader}>
                  <Text style={s.managerTitle}>👥 Enrolled Students</Text>
                  <Text style={s.managerSub}>
                    {enrolledStudents.length}/{editing.max_students ?? form.max_students} students
                  </Text>
                </View>

                {enrolledStudents.length === 0 ? (
                  <Text style={s.helperText}>No students enrolled yet.</Text>
                ) : enrolledStudents.map(student => (
                  <View key={student.id} style={s.assignedRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.assignedTitle}>{student.name}</Text>
                      {!!student.email && <Text style={s.assignedMeta}>{student.email}</Text>}
                      {!!student.pivot?.status && (
                        <Text style={[s.statusBadge, student.pivot.status === 'enrolled' && s.statusBadgeActive]}>
                          {student.pivot.status}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity style={s.removeBtn} onPress={() => handleRemoveStudent(student)}>
                      <Text style={s.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={s.assignBox}>
                  <Text style={s.assignTitle}>➕ Add Student</Text>
                  <Field label="Search Student">
                    <TextInput
                      style={s.input}
                      value={studentSearch}
                      onChangeText={setStudentSearch}
                      placeholder="Search by name, email, or student ID"
                      placeholderTextColor={C.muted}
                    />
                  </Field>
                  <ScrollView style={s.studentPicker} keyboardShouldPersistTaps="handled">
                    {availableStudents.map(student => (
                      <TouchableOpacity
                        key={student.user_id}
                        style={[s.studentOption, String(student.user_id) === String(selectedStudentId) && s.studentOptionActive]}
                        onPress={() => setSelectedStudentId(String(student.user_id))}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.studentName}>{student.name}</Text>
                          <Text style={s.studentMeta}>
                            {[student.student_id, student.email, student.grade_level ? `Level ${student.grade_level}` : null]
                              .filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        <Text style={[s.selectMark, String(student.user_id) === String(selectedStudentId) && s.selectMarkActive]}>
                          {String(student.user_id) === String(selectedStudentId) ? '✓ Selected' : 'Select'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {studentLoadError ? (
                      <Text style={s.dropdownEmpty}>{studentLoadError}</Text>
                    ) : availableStudents.length === 0 && (
                      <Text style={s.dropdownEmpty}>
                        No unenrolled students match this section level and {editing.program_type === 'college' ? 'course' : 'strand'}.
                      </Text>
                    )}
                  </ScrollView>
                  <TouchableOpacity
                    style={[s.assignBtn, enrollingStudent && { opacity: 0.6 }]}
                    onPress={handleEnrollStudent}
                    disabled={enrollingStudent}
                  >
                    {enrollingStudent ? <ActivityIndicator color="#fff" /> : <Text style={s.assignBtnText}>✅ Enroll Student</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: C.blue, paddingTop: HEADER_TOP, paddingHorizontal: 16, paddingBottom: 14 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  // Search + Create row
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  list: { padding: 12, paddingBottom: 24 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionBadge: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center' },
  sectionBadgeText: { color: C.blue, fontSize: 12, fontWeight: '800' },
  sectionName: { color: C.text, fontSize: 15, fontWeight: '700' },
  sectionMeta: { color: C.sub, fontSize: 12, marginTop: 3 },
  countText: { color: C.green, fontSize: 13, fontWeight: '800' },
  subjectPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  subjectPill: { backgroundColor: C.blueLight, color: C.blue, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, fontWeight: '700' },
  morePill: { backgroundColor: C.bg, color: C.sub, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.border, marginTop: 12, paddingTop: 10 },
  footerText: { color: C.muted, fontSize: 12 },
  editHint: { color: C.blue, fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyIcon: { fontSize: 48, marginBottom: 10 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  emptySub: { color: C.muted, fontSize: 13, marginTop: 4 },
  // Modal
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 52, paddingBottom: 14, backgroundColor: C.blue },
  modalHeaderLeft: { flex: 1 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  modalSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  closeBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 18, padding: 8 },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalBody: { padding: 14 },
  // Section cards inside modal
  sectionCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 12, elevation: 1 },
  sectionCardTitle: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 14 },
  managerCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 12, elevation: 1 },
  managerCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  managerTitle: { color: C.text, fontSize: 14, fontWeight: '800' },
  managerSub: { color: C.muted, fontSize: 12 },
  field: { marginBottom: 14 },
  fieldLabel: { color: C.sub, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, color: C.text, backgroundColor: '#fff', fontSize: 14 },
  dropdown: { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownActive: { borderColor: C.blue },
  dropdownLabel: { color: C.text, fontSize: 14, flex: 1 },
  dropdownArrow: { color: C.muted, fontSize: 14, marginLeft: 10 },
  dropdownPanel: { borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: '#fff', marginTop: 10, overflow: 'hidden' },
  dropdownScroll: { maxHeight: 220 },
  dropdownLoading: { padding: 18, alignItems: 'center' },
  dropdownEmpty: { color: C.muted, fontSize: 12, padding: 12 },
  courseSearchInput: { margin: 12 },
  courseOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F3' },
  courseOptionActive: { backgroundColor: C.blueLight },
  courseOptionText: { color: C.text, fontSize: 13 },
  optionSubText: { color: C.muted, fontSize: 11, marginTop: 2 },
  helperText: { color: C.muted, fontSize: 12, lineHeight: 18 },
  assignedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginBottom: 8, backgroundColor: '#F8FAFD' },
  assignedTitle: { color: C.text, fontSize: 13, fontWeight: '700' },
  assignedMeta: { color: C.muted, fontSize: 11, marginTop: 2 },
  statusBadge: { marginTop: 4, alignSelf: 'flex-start', backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, color: C.muted, overflow: 'hidden' },
  statusBadgeActive: { backgroundColor: '#E1F5EE', color: C.green },
  smallBtn: { backgroundColor: C.blueLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  smallBtnText: { color: C.blue, fontSize: 11, fontWeight: '800' },
  removeBtn: { backgroundColor: '#FCEBEB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  removeBtnText: { color: '#E24B4A', fontSize: 13, fontWeight: '800' },
  assignBox: { backgroundColor: '#F0F4FA', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E0E7F0', marginTop: 12 },
  assignTitle: { color: C.text, fontSize: 13, fontWeight: '800', marginBottom: 12 },
  subjectChoices: { gap: 8, paddingBottom: 2 },
  subjectChoice: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border },
  subjectChoiceActive: { backgroundColor: C.blueLight, borderColor: C.blue },
  subjectChoiceText: { color: C.sub, fontSize: 12, fontWeight: '700' },
  subjectChoiceTextActive: { color: C.blue },
  twoCol: { flexDirection: 'row', gap: 10 },
  clockBox: { borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: '#fff', padding: 10, marginBottom: 14 },
  clockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  clockLabel: { color: C.sub, fontSize: 12, fontWeight: '900' },
  clockValue: { color: C.blue, fontSize: 13, fontWeight: '900' },
  clockSubLabel: { color: C.muted, fontSize: 10, fontWeight: '900', marginBottom: 6, marginTop: 8, textTransform: 'uppercase' },
  studentPicker: { maxHeight: 260, marginBottom: 12 },
  studentOption: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, marginBottom: 8 },
  studentOptionActive: { borderColor: C.blue, backgroundColor: C.blueLight },
  studentName: { color: C.text, fontSize: 13, fontWeight: '800' },
  studentMeta: { color: C.muted, fontSize: 11, marginTop: 2 },
  selectMark: { color: C.muted, fontSize: 11, fontWeight: '800' },
  selectMarkActive: { color: C.blue },
  assignBtn: { backgroundColor: C.green, borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 4 },
  assignBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.blueLight, borderColor: C.blue },
  chipText: { color: C.sub, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: C.blue, fontWeight: '800' },
  saveBtn: { backgroundColor: C.blue, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
