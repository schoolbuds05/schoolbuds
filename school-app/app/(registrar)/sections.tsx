// @ts-nocheck
// app/(registrar)/sections.tsx — Registrar/Admin section management

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import SectionGeneration from '../../src/components/SectionGeneration';
import { useTheme } from '../../src/theme-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const C = {
  blue: '#B51F3B', blueLight: '#FBE5E9',
  green: '#1D9E75', greenLight: '#E1F5EE',
  bg: '#FBF8F5', card: '#FFFFFF', border: '#F0E8E3',
  text: '#2A171B', sub: '#735D62', muted: '#89777B',
};

const CURRENT_SY = '2024-2025';
const SECTION_SEMESTERS = [
  { key: '', label: 'All semesters' },
  { key: '1st', label: '1st' },
  { key: '2nd', label: '2nd' },
  { key: 'summer', label: 'Summer' },
];

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
  subject_ids: [],
  teacher_id: '',
  day: '',
  time_start: '',
  time_end: '',
  room: '',
  schedules: [],
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

function DaySelector({ value, onChange, multiple = true, label = 'Days' }) {
  const [open, setOpen] = useState(false);
  const selectedDays = String(value || '').split(',').map(day => day.trim()).filter(Boolean);
  const displayValue = selectedDays.length
    ? selectedDays.map(formatDaySummary).join(', ')
    : multiple ? 'Choose one or more days' : 'Choose a day';

  const selectDay = day => {
    if (!multiple) {
      onChange(day);
      setOpen(false);
      return;
    }
    onChange(selectedDays.includes(day)
      ? selectedDays.filter(item => item !== day).join(', ')
      : [...selectedDays, day].join(', '));
  };

  return (
    <View style={s.daySelector}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TouchableOpacity style={[s.dropdown, selectedDays.length > 0 && s.dropdownActive]} onPress={() => setOpen(current => !current)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={[s.dropdownLabel, selectedDays.length === 0 && { color: C.muted }]} numberOfLines={1}>{displayValue}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={17} color={C.sub} />
      </TouchableOpacity>
      {open && <View style={s.daySelectorPanel}>
        <View style={s.daySelectorGrid}>
          {DAYS.map(day => {
            const active = selectedDays.includes(day);
            return (
              <TouchableOpacity key={day} style={[s.daySelectorOption, active && s.daySelectorOptionActive]} onPress={() => selectDay(day)}>
                <View style={[s.dayCheckbox, active && s.dayCheckboxActive]}>
                  {active && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <Text style={[s.dayOptionText, active && s.dayOptionTextActive]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {multiple && <TouchableOpacity style={s.daySelectorDone} onPress={() => setOpen(false)}><Text style={s.daySelectorDoneText}>Done</Text></TouchableOpacity>}
      </View>}
    </View>
  );
}

function normalizeValue(value) {
  return String(value ?? '').trim().toLowerCase();
}

function formatTimeLabel(value) {
  if (!value) return 'Set time';
  const normalized = normalizeScheduleTime(value);
  if (!normalized) return String(value);
  const [hourValue, minute = '00'] = normalized.split(':');
  const hour = Number(hourValue);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${period}`;
}

function normalizeScheduleTime(value) {
  if (value == null || value === '') return '';
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return '';
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (minute > 59) return '';
  if (period) {
    if (hour < 1 || hour > 12) return '';
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
  } else if (hour > 23) {
    return '';
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function sameScheduleMeeting(meeting, main) {
  const normalizedTime = value => normalizeScheduleTime(value);
  return String(meeting.day || '').trim().toLowerCase() === String(main.day || '').trim().toLowerCase()
    && normalizedTime(meeting.time_start) === normalizedTime(main.time_start)
    && normalizedTime(meeting.time_end) === normalizedTime(main.time_end)
    && String(meeting.room || '').trim().toLowerCase() === String(main.room || '').trim().toLowerCase();
}

function getScheduleMeetings(item) {
  const mainMeeting = {
    day: item.day ?? '',
    time_start: item.time_start ?? '',
    time_end: item.time_end ?? '',
    room: item.room ?? '',
  };
  const hasMainMeeting = Boolean(mainMeeting.day || mainMeeting.time_start || mainMeeting.time_end || mainMeeting.room);
  const storedMeetings = (item.schedules ?? [])
    .map(meeting => ({
      ...meeting,
      time_start: normalizeScheduleTime(meeting.time_start),
      time_end: normalizeScheduleTime(meeting.time_end),
    }))
    .filter((meeting, index, meetings) => meetings.findIndex(candidate => sameScheduleMeeting(candidate, meeting)) === index)
    .filter(meeting => !hasMainMeeting || !sameScheduleMeeting(meeting, mainMeeting));

  return hasMainMeeting ? [mainMeeting, ...storedMeetings] : storedMeetings;
}

function formatDaySummary(value) {
  if (!value) return null;
  const shortDays = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };
  return String(value).split(',').map(day => shortDays[day.trim()] || day.trim()).filter(Boolean).join(', ');
}

function formatWorkflowLabel(status) {
  const labels = {
    draft: 'Draft',
    pending: 'Pending approval',
    approved: 'Approved',
    rejected: 'Rejected',
    closed: 'Closed',
  };
  return labels[status] || String(status || 'draft').replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function timeParts(value) {
  const [hourValue, minuteValue = '00'] = (normalizeScheduleTime(value) || '08:00').split(':');
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
  const [expanded, setExpanded] = useState(false);
  const parts = timeParts(value);

  return (
    <View style={s.clockBox}>
      <TouchableOpacity style={s.clockCompact} onPress={() => setExpanded(current => !current)} accessibilityRole="button" accessibilityState={{ expanded }}>
        <View style={s.clockCompactCopy}>
          <Text style={s.clockLabel}>{label}</Text>
          <Text style={s.clockValue}>{formatTimeLabel(value)}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={C.sub} />
      </TouchableOpacity>
      {expanded && <View style={s.clockPickerPanel}>
        <View style={s.clockPickerHeader}>
          <Text style={s.clockSubLabel}>Hour</Text>
          <ChipGroup value={parts.hour} onSelect={hour => onChange(buildTimeValue(value, 'hour', hour))} options={HOURS} />
        </View>
        <View style={s.clockPickerHeader}>
          <Text style={s.clockSubLabel}>Minute</Text>
          <ChipGroup value={parts.minute} onSelect={minute => onChange(buildTimeValue(value, 'minute', minute))} options={MINUTES} />
        </View>
        <View style={s.clockPickerHeader}>
          <Text style={s.clockSubLabel}>AM / PM</Text>
          <ChipGroup value={parts.period} onSelect={period => onChange(buildTimeValue(value, 'period', period))} options={PERIODS} />
        </View>
        <TouchableOpacity style={s.clockDone} onPress={() => setExpanded(false)}><Text style={s.clockDoneText}>Done</Text></TouchableOpacity>
      </View>}
    </View>
  );
}

export default function Sections() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ program_type: '', course: '', school_year: '', semester: '', is_active: '' });
  const [draftFilters, setDraftFilters] = useState(filters);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [modalTab, setModalTab] = useState('details');
  const [userRole, setUserRole] = useState('');
  const [workflowRemarks, setWorkflowRemarks] = useState('');
  const [workflowBusy, setWorkflowBusy] = useState(false);
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
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const setSchedule = (key, value) => setAssignment(prev => ({ ...prev, [key]: value }));
  const addMeeting = () => setAssignment(prev => ({ ...prev, schedules: [...(prev.schedules || []), { day: '', time_start: '', time_end: '', room: '' }] }));
  const updateMeeting = (index, key, value) => setAssignment(prev => ({ ...prev, schedules: (prev.schedules || []).map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const removeMeeting = index => setAssignment(prev => ({ ...prev, schedules: (prev.schedules || []).filter((_, i) => i !== index) }));

  const fetchSections = useCallback(async () => {
    try {
      const res = await api.get('/registrar/sections', {
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

  useEffect(() => {
    api.get('/me')
      .then(res => {
        const user = res.data?.user ?? res.data;
        setUserRole(user?.position === 'head_department' ? 'head_department' : user?.role ?? '');
      })
      .catch(error => console.log('Current user role load error:', error.message));
  }, []);

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

  const handleWorkflowAction = async (action, decision = null) => {
    if (!editing?.id || workflowBusy) return;
    if (action === 'review' && decision === 'reject' && !workflowRemarks.trim()) {
      return Alert.alert('Remarks required', 'Add a short reason before rejecting this section.');
    }

    const endpoint = action === 'review'
      ? `/sections/${editing.id}/review`
      : `/sections/${editing.id}/${action}`;
    const payload = action === 'review'
      ? { decision, remarks: workflowRemarks.trim() || null }
      : {};

    setWorkflowBusy(true);
    try {
      const res = await api.post(endpoint, payload);
      setWorkflowRemarks('');
      await refreshEditingSection(editing.id);
      await fetchSections();
      Alert.alert('Section updated', res.data?.message ?? 'Section status updated.');
    } catch (error) {
      Alert.alert('Could not update section', error.response?.data?.message ?? 'Please try again.');
    } finally {
      setWorkflowBusy(false);
    }
  };

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
  const workflowStatus = editing?.workflow_status || (editing?.is_active ? 'approved' : 'draft');
  const canReviewSections = ['admin', 'registrar'].includes(userRole);
  const isDepartmentChair = userRole === 'head_department';

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
    return sections.filter(sec => {
      const matchesSearch = !q ||
        sec.name?.toLowerCase().includes(q) ||
        sec.course?.toLowerCase().includes(q) ||
        sec.strand?.toLowerCase().includes(q);
      return matchesSearch &&
        (!filters.program_type || sec.program_type === filters.program_type) &&
        (!filters.course || sec.course === filters.course) &&
        (!filters.school_year || sec.school_year === filters.school_year) &&
        (!filters.semester || sec.semester === filters.semester) &&
        (filters.is_active === '' || String(sec.is_active === true || sec.is_active === 1 || sec.is_active === '1' ? 1 : 0) === filters.is_active);
    });
  }, [sections, search, filters]);

  const sectionCourseOptions = useMemo(
    () => [...new Set(sections.map(section => section.course).filter(Boolean))].sort(),
    [sections]
  );
  const sectionSchoolYearOptions = useMemo(
    () => [...new Set(sections.map(section => section.school_year).filter(Boolean))].sort().reverse(),
    [sections]
  );
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const openCreate = () => {
    setEditing(null);
    setModalTab('details');
    setShowAssignmentForm(false);
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
    setModalTab('details');
    setShowAssignmentForm(false);
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
      is_active: editing ? editing.is_active : form.is_active,
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
    const [mainMeeting = { day: '', time_start: '', time_end: '', room: '' }, ...additionalMeetings] = getScheduleMeetings(item);
    setAssignment({
      subject_id: String(item.subject_id),
      subject_ids: [],
      teacher_id: item.teacher_id ? String(item.teacher_id) : '',
      day: mainMeeting.day,
      time_start: normalizeScheduleTime(mainMeeting.time_start),
      time_end: normalizeScheduleTime(mainMeeting.time_end),
      room: mainMeeting.room,
      schedules: additionalMeetings,
    });
    setTeacherSearch('');
    setTeacherDropdownOpen(false);
    setShowAssignmentForm(true);
  };

  const toggleAssignmentSubject = (subjectId) => {
    const id = String(subjectId);
    setAssignment(prev => {
      const selectedIds = prev.subject_id ? [] : prev.subject_ids;
      return {
        ...EMPTY_ASSIGNMENT,
        subject_ids: selectedIds.includes(id)
          ? selectedIds.filter(selectedId => selectedId !== id)
          : [...selectedIds, id],
      };
    });
  };

  const handleAssignSubject = async () => {
    if (!editing?.id) return Alert.alert('Save first', 'Create the section before assigning subjects.');
    if (!assignment.subject_id && assignment.subject_ids.length === 0) {
      return Alert.alert('Required', 'Select one or more subjects to assign.');
    }

    setAssigning(true);
    try {
      const subjectSelection = assignment.subject_id
        ? { subject_id: parseInt(assignment.subject_id, 10) }
        : { subject_ids: assignment.subject_ids.map(id => parseInt(id, 10)) };
      await api.post(`/sections/${editing.id}/subjects`, {
        ...subjectSelection,
        teacher_id: assignment.teacher_id ? parseInt(assignment.teacher_id, 10) : null,
        day: assignment.day.trim() || null,
        time_start: assignment.time_start.trim() || null,
        time_end: assignment.time_end.trim() || null,
        room: assignment.room.trim() || null,
        schedules: (assignment.schedules || []).filter(item => item.day).map(item => ({
          day: item.day,
          time_start: item.time_start || null,
          time_end: item.time_end || null,
          room: item.room || null,
        })),
      });
      setAssignment(EMPTY_ASSIGNMENT);
      setShowAssignmentForm(false);
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
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <View style={[s.pageHeader, { paddingTop: 12 + insets.top }]}>
        <View style={s.headingRow}>
          <View style={s.headingCopy}>
            <Text style={s.pageTitle}>Sections</Text>
            <Text style={s.pageSubtitle}>
              {sections.length} active{sections[0]?.school_year ? ` · ${sections[0].school_year}` : ''}{sections[0]?.semester ? `, ${sections[0].semester} semester` : ''}
            </Text>
          </View>
        </View>
        <SectionGeneration onSaved={fetchSections} />
        <View style={s.searchRow}>
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={17} color={C.sub} />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search sections"
              placeholderTextColor={C.sub}
              returnKeyType="search"
              onSubmitEditing={fetchSections}
            />
          </View>
          <TouchableOpacity
            style={[s.filterBtn, (showFilters || hasActiveFilters) && s.filterBtnActive]}
            onPress={() => {
              setDraftFilters(filters);
              setShowFilters(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Filter sections"
          >
            <Ionicons name="options-outline" size={17} color={C.blue} />
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.8}>
            <Text style={s.addBtnText}>+ Create</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <View style={s.filterBackdrop}>
          <View style={[s.filterSheet, { backgroundColor: theme.bg }]}>
            <View style={s.filterSheetHeader}>
              <View>
                <Text style={[s.filterSheetTitle, { color: theme.text }]}>Filter sections</Text>
                <Text style={[s.filterSheetSubtitle, { color: theme.textSub }]}>Narrow by section details and academic period.</Text>
              </View>
              <TouchableOpacity style={s.filterClose} onPress={() => setShowFilters(false)} accessibilityLabel="Close filters">
                <Ionicons name="close" size={19} color={C.sub} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.filterSheetBody} keyboardShouldPersistTaps="handled">
              {[
                { key: 'program_type', label: 'Program', options: [{ key: '', label: 'All programs' }, { key: 'college', label: 'College' }, { key: 'shs', label: 'SHS' }] },
                { key: 'course', label: 'Course', options: [{ key: '', label: 'All courses' }, ...sectionCourseOptions.map(course => ({ key: course, label: course }))] },
                { key: 'school_year', label: 'School year', options: [{ key: '', label: 'All school years' }, ...sectionSchoolYearOptions.map(year => ({ key: year, label: year }))] },
                { key: 'semester', label: 'Semester', options: SECTION_SEMESTERS },
                { key: 'is_active', label: 'Status', options: [{ key: '', label: 'All status' }, { key: '1', label: 'Active' }, { key: '0', label: 'Inactive' }] },
              ].map(group => (
                <View key={group.key}>
                  <Text style={s.filterLabel}>{group.label}</Text>
                  <View style={s.filterOptions}>
                    {group.options.map(option => (
                      <TouchableOpacity
                        key={`${group.key}-${option.key}`}
                        style={[s.filterOption, draftFilters[group.key] === option.key && s.filterOptionActive]}
                        onPress={() => setDraftFilters(current => ({ ...current, [group.key]: option.key }))}
                        accessibilityRole="button"
                        accessibilityState={{ selected: draftFilters[group.key] === option.key }}
                      >
                        <Text style={[s.filterOptionText, draftFilters[group.key] === option.key && s.filterOptionTextActive]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={s.filterActions}>
              <TouchableOpacity
                style={s.filterReset}
                onPress={() => {
                  const clearedFilters = { program_type: '', course: '', school_year: '', semester: '', is_active: '' };
                  setDraftFilters(clearedFilters);
                  setFilters(clearedFilters);
                  setShowFilters(false);
                }}
              >
                <Text style={s.filterResetText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.filterApply}
                onPress={() => {
                  setFilters(draftFilters);
                  setShowFilters(false);
                }}
              >
                <Text style={s.filterApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              <Text style={s.emptyTitle}>{search || hasActiveFilters ? 'No matching sections' : 'No sections yet'}</Text>
              <Text style={s.emptySub}>{search || hasActiveFilters ? 'Try a different search or filter.' : 'Tap "+ Create" to add your first section.'}</Text>
            </View>
          ) : filteredSections.map(section => (
            <TouchableOpacity key={section.id} style={s.card} onPress={() => openEdit(section)} activeOpacity={0.8}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.sectionName}>{section.name}</Text>
                  <Text style={s.sectionMeta}>
                    {section.program_type === 'shs'
                      ? `${section.strand || 'No strand'} · Grade ${section.year_level || '-'}`
                      : `${section.course || 'No course'} · Year ${section.year_level || '-'}`}
                  </Text>
                </View>
                <View style={s.cardStatusColumn}>
                  {(() => {
                    const status = section.workflow_status || (section.is_active ? 'approved' : 'draft');
                    return <View style={[s.workflowBadge, s.cardWorkflowBadge, status === 'approved' ? s.workflowApproved : status === 'pending' ? s.workflowPending : status === 'rejected' ? s.workflowRejected : status === 'closed' ? s.workflowClosed : s.workflowDraft]}>
                      <Text style={[s.workflowBadgeText, status === 'approved' ? s.workflowApprovedText : status === 'pending' ? s.workflowPendingText : status === 'rejected' ? s.workflowRejectedText : status === 'closed' ? s.workflowClosedText : s.workflowDraftText]}>{formatWorkflowLabel(status)}</Text>
                    </View>;
                  })()}
                  <Text style={s.countText}>{section.student_count ?? 0} / {section.max_students}</Text>
                </View>
              </View>
              <View style={s.capacityTrack}>
                <View style={[s.capacityFill, { width: `${Math.min(100, Math.max(0, (Number(section.student_count ?? 0) / Math.max(1, Number(section.max_students ?? 40))) * 100))}%` }]} />
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
                <View style={{ flex: 1 }} />
                <Text style={s.editHint}>Edit</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={[s.modal, { backgroundColor: theme.bg }]}>
          <View style={[s.modalHeader, { paddingTop: 12 + insets.top, backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <View style={s.modalHeaderLeft}>
              <Text style={[s.modalTitle, { color: theme.text }]}>{editing ? 'Edit section' : 'Create section'}</Text>
              <Text style={[s.modalSubtitle, { color: theme.textSub }]}>{editing ? editing.name : 'Add section details'}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowModal(false)} style={[s.closeBtn, { backgroundColor: theme.bg }]} accessibilityLabel="Close section editor">
              <Ionicons name="close" size={20} color={theme.textSub} />
            </TouchableOpacity>
          </View>

          {editing && <View style={[s.modalTabs, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {[
              { key: 'details', label: 'Details', icon: 'options-outline' },
              { key: 'subjects', label: `Subjects ${assignedSubjects.length}`, icon: 'library-outline' },
              { key: 'students', label: `Students ${enrolledStudents.length}`, icon: 'people-outline' },
            ].map(tab => (
              <TouchableOpacity key={tab.key} style={[s.modalTab, modalTab === tab.key && { backgroundColor: theme.primary }]} onPress={() => setModalTab(tab.key)}>
                <Ionicons name={tab.icon} size={14} color={modalTab === tab.key ? '#fff' : theme.textSub} />
                <Text style={[s.modalTabText, { color: theme.textSub }, modalTab === tab.key && s.modalTabTextActive]} numberOfLines={1}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>}

          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">

            {(!editing || modalTab === 'details') && <>
            {/* ── SECTION INFO CARD ── */}
            <View style={s.sectionCard}>
              <Text style={s.sectionCardTitle}>Section details</Text>

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
              <Text style={s.sectionCardTitle}>Schedule & capacity</Text>

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
                  {!editing ? <Field label="Enrollment status">
                    <ChipGroup value={form.is_active ? 'active' : 'inactive'} onSelect={v => set('is_active', v === 'active')} options={[
                      { key: 'active', label: 'Open' }, { key: 'inactive', label: 'Closed' },
                    ]} />
                  </Field> : <Field label="Enrollment status">
                    <View style={s.readOnlyStatus}><Text style={s.readOnlyStatusText}>{editing.is_active ? 'Open' : 'Closed'}</Text></View>
                  </Field>}
                </View>
              </View>
            </View>

            {editing && <View style={s.sectionCard}>
              <Text style={s.sectionCardTitle}>Approval & enrollment</Text>
              <View style={s.workflowSummary}>
                <View style={[s.workflowBadge, workflowStatus === 'approved' ? s.workflowApproved : workflowStatus === 'pending' ? s.workflowPending : workflowStatus === 'rejected' ? s.workflowRejected : workflowStatus === 'closed' ? s.workflowClosed : s.workflowDraft]}>
                  <Text style={[s.workflowBadgeText, workflowStatus === 'approved' ? s.workflowApprovedText : workflowStatus === 'pending' ? s.workflowPendingText : workflowStatus === 'rejected' ? s.workflowRejectedText : workflowStatus === 'closed' ? s.workflowClosedText : s.workflowDraftText]}>
                    {formatWorkflowLabel(workflowStatus)}
                  </Text>
                </View>
                <Text style={s.workflowOpenState}>Enrollment {editing.is_active ? 'open' : 'closed'}</Text>
              </View>
              {!!editing.workflow_remarks && <Text style={s.workflowRemarks}>Registrar remarks: {editing.workflow_remarks}</Text>}
              {!!editing.submitted_at && <Text style={s.workflowMeta}>Submitted {new Date(editing.submitted_at).toLocaleString()}</Text>}
              {!!editing.reviewed_at && <Text style={s.workflowMeta}>Reviewed {new Date(editing.reviewed_at).toLocaleString()}</Text>}

              {isDepartmentChair && ['draft', 'rejected'].includes(workflowStatus) && <TouchableOpacity style={[s.workflowButton, s.workflowSubmit]} onPress={() => handleWorkflowAction('submit')} disabled={workflowBusy}>
                {workflowBusy ? <ActivityIndicator color="#fff" /> : <Text style={s.workflowSubmitText}>Submit for registrar review</Text>}
              </TouchableOpacity>}
              {canReviewSections && workflowStatus === 'pending' && <>
                <TextInput style={[s.input, s.workflowRemarksInput]} value={workflowRemarks} onChangeText={setWorkflowRemarks} placeholder="Remarks (required to reject)" placeholderTextColor={C.muted} multiline />
                <View style={s.workflowActions}>
                  <TouchableOpacity style={[s.workflowButton, s.workflowApprove]} onPress={() => handleWorkflowAction('review', 'approve')} disabled={workflowBusy}>
                    <Text style={s.workflowApproveText}>Approve & open</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.workflowButton, s.workflowReject]} onPress={() => handleWorkflowAction('review', 'reject')} disabled={workflowBusy}>
                    <Text style={s.workflowRejectText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </>}
              {canReviewSections && workflowStatus === 'approved' && <TouchableOpacity style={[s.workflowButton, s.workflowClose]} onPress={() => handleWorkflowAction('close')} disabled={workflowBusy}>
                <Text style={s.workflowCloseText}>Close section</Text>
              </TouchableOpacity>}
              {canReviewSections && workflowStatus === 'closed' && <TouchableOpacity style={[s.workflowButton, s.workflowApprove]} onPress={() => handleWorkflowAction('reopen')} disabled={workflowBusy}>
                <Text style={s.workflowApproveText}>Reopen enrollment</Text>
              </TouchableOpacity>}
            </View>}

            {/* ── SAVE BUTTON (top-level) ── */}
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{editing ? '💾 Update Section' : '✅ Create Section'}</Text>}
            </TouchableOpacity>
            </>}

            {/* ── ASSIGNED SUBJECTS (edit only) ── */}
            {editing && modalTab === 'subjects' && (
              <View style={s.managerCard}>
                <View style={s.managerCardHeader}>
                  <View>
                    <Text style={s.managerTitle}>Assigned subjects</Text>
                    <Text style={s.managerSub}>{assignedSubjects.length} subject{assignedSubjects.length === 1 ? '' : 's'} in this section</Text>
                  </View>
                  {!showAssignmentForm && <TouchableOpacity style={s.addSubjectBtn} onPress={() => { setAssignment(EMPTY_ASSIGNMENT); setShowAssignmentForm(true); }}>
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text style={s.addSubjectBtnText}>Add</Text>
                  </TouchableOpacity>}
                </View>

                {assignedSubjects.length > 0 && assignedSubjects.map(item => (
                  <View key={item.id} style={s.assignedRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.assignedTitle}>{item.subject?.code} · {item.subject?.name}</Text>
                      {getScheduleMeetings(item).length > 0 ? getScheduleMeetings(item).map((meeting, index) => (
                        <View key={`summary-meeting-${index}`} style={s.meetingSummary}>
                          <Text style={s.assignedMeta}>
                            {[formatDaySummary(meeting.day), meeting.time_start && meeting.time_end ? `${formatTimeLabel(meeting.time_start)} – ${formatTimeLabel(meeting.time_end)}` : null]
                              .filter(Boolean).join(' · ') || 'Meeting time not set'}
                          </Text>
                          {meeting.room ? <Text style={s.assignedMeta}>Room: {meeting.room}</Text> : null}
                        </View>
                      )) : <Text style={s.assignedMeta}>Schedule not set</Text>}
                      {item.teacher?.name ? <Text style={s.assignedMeta}>Teacher: {item.teacher.name}</Text> : null}
                    </View>
                    <TouchableOpacity style={s.smallBtn} onPress={() => fillAssignment(item)}>
                      <Text style={s.smallBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.removeBtn} onPress={() => handleRemoveSubject(item)}>
                      <Text style={s.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {!showAssignmentForm && assignedSubjects.length === 0 && <Text style={s.emptySubjectsHint}>No subjects are assigned yet. Tap Add to choose subjects and set their schedule.</Text>}

                {showAssignmentForm && <Modal visible={showAssignmentForm} transparent animationType="slide" onRequestClose={() => { setAssignment(EMPTY_ASSIGNMENT); setShowAssignmentForm(false); setTeacherDropdownOpen(false); }}>
                  <View style={s.assignmentModalBackdrop}>
                    <View style={s.assignmentModal}>
                      <ScrollView contentContainerStyle={s.assignmentModalBody} keyboardShouldPersistTaps="handled">
                        <View style={s.assignBox}>
                  <View style={s.assignFormHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.assignTitle}>{assignment.subject_id ? 'Edit subject schedule' : 'Add subjects'}</Text>
                      <Text style={s.assignSub}>{assignment.subject_id ? 'Update meeting times, room, or teacher.' : 'Choose subjects, then add their shared schedule.'}</Text>
                    </View>
                    <TouchableOpacity style={s.assignCloseBtn} onPress={() => { setAssignment(EMPTY_ASSIGNMENT); setShowAssignmentForm(false); setTeacherDropdownOpen(false); }} accessibilityLabel="Cancel subject schedule editing">
                      <Ionicons name="close" size={18} color={C.sub} />
                    </TouchableOpacity>
                  </View>
                  <Field label="Subject">
                    {assignment.subject_id ? (() => {
                      const selectedSubject = assignedSubjects.find(item => String(item.subject_id) === assignment.subject_id);
                      return (
                        <View style={s.subjectEditCard}>
                          <View style={s.subjectEditCode}><Text style={s.subjectEditCodeText}>{selectedSubject?.subject?.code || 'Subject'}</Text></View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.subjectEditName}>{selectedSubject?.subject?.name || 'Selected subject'}</Text>
                            <Text style={s.subjectEditHint}>Editing this subject’s schedule</Text>
                          </View>
                        </View>
                      );
                    })() : (
                      <>
                        <Text style={s.helperText}>Select one or more subjects.</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.subjectChoices}>
                          {availableSubjects.map(subject => (
                            <TouchableOpacity
                              key={subject.id}
                              style={[s.subjectChoice, assignment.subject_ids.includes(String(subject.id)) && s.subjectChoiceActive]}
                              onPress={() => toggleAssignmentSubject(subject.id)}
                            >
                              <Text style={[s.subjectChoiceText, assignment.subject_ids.includes(String(subject.id)) && s.subjectChoiceTextActive]}>
                                {subject.code}
                              </Text>
                            </TouchableOpacity>
                          ))}
                          {availableSubjects.length === 0 && <Text style={s.helperText}>No matching unassigned subjects found.</Text>}
                        </ScrollView>
                      </>
                    )}
                  </Field>
                  <DaySelector value={assignment.day} onChange={value => setSchedule('day', value)} />
                  <Field label="Room">
                    <TextInput style={s.input} value={assignment.room} onChangeText={v => setSchedule('room', v)} placeholder="e.g. Room 101" placeholderTextColor={C.muted} />
                  </Field>
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
                  {(assignment.schedules || []).map((meeting, index) => (
                    <View key={`meeting-${index}`} style={s.extraMeeting}>
                      <View style={s.extraMeetingHeader}>
                        <Text style={s.fieldLabel}>Additional meeting {index + 1}</Text>
                        <TouchableOpacity onPress={() => removeMeeting(index)}><Text style={s.removeText}>Remove</Text></TouchableOpacity>
                      </View>
                      <DaySelector label="Meeting day" value={meeting.day} onChange={value => updateMeeting(index, 'day', value)} multiple={false} />
                      <View style={s.twoCol}>
                        <View style={{ flex: 1 }}><TimePicker label="Start" value={meeting.time_start} onChange={value => updateMeeting(index, 'time_start', value)} /></View>
                        <View style={{ flex: 1 }}><TimePicker label="End" value={meeting.time_end} onChange={value => updateMeeting(index, 'time_end', value)} /></View>
                      </View>
                      <TextInput style={s.input} value={meeting.room} onChangeText={value => updateMeeting(index, 'room', value)} placeholder="Room" placeholderTextColor={C.muted} />
                    </View>
                  ))}
                  <TouchableOpacity style={s.addMeetingBtn} onPress={addMeeting}><Ionicons name="add" size={15} color={C.blue} /><Text style={s.addMeetingText}>Add another meeting</Text></TouchableOpacity>
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
                    {assigning ? <ActivityIndicator color="#fff" /> : <Text style={s.assignBtnText}>{assignment.subject_id ? 'Save schedule' : 'Assign subjects'}</Text>}
                  </TouchableOpacity>
                        </View>
                      </ScrollView>
                    </View>
                  </View>
                </Modal>}
              </View>
            )}

            {/* ── ENROLLED STUDENTS (edit only) ── */}
            {editing && modalTab === 'students' && (
              <View style={s.managerCard}>
                <View style={s.managerCardHeader}>
                  <Text style={s.managerTitle}>Enrolled students</Text>
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
  pageHeader: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headingCopy: { flex: 1 },
  pageTitle: { color: C.text, fontSize: 23, fontWeight: '700', fontFamily: 'serif' },
  pageSubtitle: { color: C.sub, fontSize: 10, marginTop: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtn: { width: 40, height: 40, borderWidth: 1, borderColor: C.border, borderRadius: 11, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { borderColor: C.blue, backgroundColor: C.blueLight },
  addBtn: { height: 40, backgroundColor: C.blue, borderRadius: 11, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  searchBox: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 13, paddingHorizontal: 11 },
  searchInput: { flex: 1, color: C.text, fontSize: 11, paddingVertical: 0 },
  filterBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(35,20,24,0.38)' },
  filterSheet: { maxHeight: '82%', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14 },
  filterSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: C.border },
  filterSheetTitle: { fontSize: 17, fontWeight: '800' },
  filterSheetSubtitle: { fontSize: 11, marginTop: 3 },
  filterClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  filterSheetBody: { paddingTop: 12, paddingBottom: 10 },
  filterLabel: { color: C.sub, fontSize: 11, fontWeight: '800', marginBottom: 8, marginTop: 7 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  filterOption: { minHeight: 36, paddingHorizontal: 13, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  filterOptionActive: { backgroundColor: C.blueLight, borderColor: C.blue },
  filterOptionText: { color: C.sub, fontSize: 11, fontWeight: '600' },
  filterOptionTextActive: { color: C.blue, fontWeight: '800' },
  filterActions: { flexDirection: 'row', gap: 9, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  filterReset: { flex: 1, height: 43, borderRadius: 11, borderWidth: 1, borderColor: C.blue, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  filterResetText: { color: C.blue, fontSize: 12, fontWeight: '700' },
  filterApply: { flex: 1.5, height: 43, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.blue },
  filterApplyText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  list: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardStatusColumn: { alignItems: 'flex-end', gap: 7 },
  cardWorkflowBadge: { alignSelf: 'flex-end' },
  sectionName: { color: C.text, fontSize: 16, fontWeight: '700', fontFamily: 'serif' },
  sectionMeta: { color: C.sub, fontSize: 10, marginTop: 1 },
  countText: { color: C.text, fontSize: 11, fontWeight: '800' },
  capacityTrack: { height: 6, borderRadius: 4, backgroundColor: '#F1E6E1', marginTop: 10, overflow: 'hidden' },
  capacityFill: { height: '100%', borderRadius: 4, backgroundColor: C.blue },
  subjectPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9 },
  subjectPill: { backgroundColor: C.blueLight, color: C.blue, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, fontSize: 9, fontWeight: '700' },
  morePill: { backgroundColor: C.bg, color: C.sub, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, fontSize: 9, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 7 },
  footerText: { color: C.muted, fontSize: 10 },
  editHint: { color: C.blue, fontSize: 10, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyIcon: { fontSize: 48, marginBottom: 10 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  emptySub: { color: C.muted, fontSize: 13, marginTop: 4 },
  // Modal
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 13, borderBottomWidth: 1 },
  modalHeaderLeft: { flex: 1 },
  modalTitle: { color: C.text, fontSize: 20, fontWeight: '800' },
  modalSubtitle: { color: C.sub, fontSize: 11, marginTop: 3 },
  closeBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  modalTabs: { flexDirection: 'row', gap: 4, marginHorizontal: 16, marginTop: 12, marginBottom: 4, padding: 4, borderRadius: 13, borderWidth: 1 },
  modalTab: { flex: 1, minWidth: 0, minHeight: 36, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 },
  modalTabText: { fontSize: 9, fontWeight: '700' },
  modalTabTextActive: { color: '#fff', fontWeight: '800' },
  modalBody: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  // Section cards inside modal
  sectionCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  sectionCardTitle: { fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 13 },
  managerCard: { backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  managerCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  managerTitle: { color: C.text, fontSize: 13, fontWeight: '800' },
  managerSub: { color: C.muted, fontSize: 10 },
  field: { marginBottom: 12 },
  fieldLabel: { color: C.sub, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 11, color: C.text, backgroundColor: '#fff', fontSize: 13 },
  readOnlyStatus: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: C.border, borderRadius: 11, backgroundColor: '#fff' },
  readOnlyStatusText: { color: C.text, fontSize: 13, fontWeight: '700' },
  workflowSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  workflowBadge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  workflowBadgeText: { fontSize: 11, fontWeight: '800' },
  workflowApproved: { backgroundColor: '#E1F5EE' },
  workflowApprovedText: { color: '#13795B' },
  workflowPending: { backgroundColor: '#FFF3D6' },
  workflowPendingText: { color: '#9A6700' },
  workflowRejected: { backgroundColor: '#FCE8E8' },
  workflowRejectedText: { color: '#B42336' },
  workflowClosed: { backgroundColor: '#ECEFF2' },
  workflowClosedText: { color: '#59636E' },
  workflowDraft: { backgroundColor: C.blueLight },
  workflowDraftText: { color: C.blue },
  workflowOpenState: { color: C.sub, fontSize: 11, fontWeight: '700' },
  workflowMeta: { color: C.muted, fontSize: 10, marginTop: 8 },
  workflowRemarks: { color: '#A12A3E', fontSize: 11, lineHeight: 16, marginTop: 10, padding: 10, borderRadius: 9, backgroundColor: '#FCE8E8' },
  workflowRemarksInput: { minHeight: 70, textAlignVertical: 'top', marginTop: 12 },
  workflowActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  workflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: 42, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginTop: 12 },
  workflowApprove: { flex: 1, backgroundColor: '#1D9E75' },
  workflowApproveText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  workflowReject: { flex: 1, backgroundColor: '#FCE8E8', borderWidth: 1, borderColor: '#E8AFB8' },
  workflowRejectText: { color: '#B42336', fontSize: 12, fontWeight: '800' },
  workflowClose: { alignSelf: 'flex-start', backgroundColor: '#ECEFF2' },
  workflowCloseText: { color: '#4B5563', fontSize: 12, fontWeight: '800' },
  workflowSubmit: { alignSelf: 'stretch', backgroundColor: C.blue },
  workflowSubmitText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  dropdown: { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownActive: { borderColor: C.blue },
  dropdownLabel: { color: C.text, fontSize: 14, flex: 1 },
  daySelector: { marginBottom: 12 },
  daySelectorPanel: { borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: '#fff', marginTop: 8, padding: 10 },
  daySelectorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  daySelectorOption: { width: '31%', minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: C.border, borderRadius: 9, paddingHorizontal: 8 },
  daySelectorOptionActive: { borderColor: C.blue, backgroundColor: C.blueLight },
  dayCheckbox: { width: 16, height: 16, borderRadius: 5, borderWidth: 1, borderColor: C.muted, alignItems: 'center', justifyContent: 'center' },
  dayCheckboxActive: { borderColor: C.blue, backgroundColor: C.blue },
  dayOptionText: { color: C.sub, fontSize: 11, fontWeight: '600' },
  dayOptionTextActive: { color: C.blue, fontWeight: '800' },
  daySelectorDone: { alignSelf: 'flex-end', marginTop: 9, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, backgroundColor: C.blueLight },
  daySelectorDoneText: { color: C.blue, fontSize: 11, fontWeight: '800' },
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
  assignedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderWidth: 1, borderColor: C.border, borderRadius: 13, marginBottom: 8, backgroundColor: '#fff' },
  assignedTitle: { color: C.text, fontSize: 12, fontWeight: '800' },
  assignedMeta: { color: C.muted, fontSize: 10, marginTop: 4, lineHeight: 14 },
  meetingSummary: { marginTop: 2, marginBottom: 2 },
  statusBadge: { marginTop: 4, alignSelf: 'flex-start', backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, color: C.muted, overflow: 'hidden' },
  statusBadgeActive: { backgroundColor: '#E1F5EE', color: C.green },
  smallBtn: { backgroundColor: C.blueLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  smallBtnText: { color: C.blue, fontSize: 11, fontWeight: '800' },
  extraMeeting: { marginTop: 8, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff' },
  extraMeetingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  removeText: { color: '#C0394D', fontSize: 11, fontWeight: '800' },
  addMeetingBtn: { marginTop: 5, paddingVertical: 10, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff' },
  addMeetingText: { color: C.blue, fontSize: 11, fontWeight: '800' },
  removeBtn: { backgroundColor: '#FCEBEB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  removeBtnText: { color: '#E24B4A', fontSize: 13, fontWeight: '800' },
  addSubjectBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.blue, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  addSubjectBtnText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  emptySubjectsHint: { color: C.muted, fontSize: 11, lineHeight: 17, paddingVertical: 8 },
  assignmentModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(35,20,24,0.42)' },
  assignmentModal: { maxHeight: '92%', backgroundColor: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  assignmentModalBody: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 },
  assignBox: { backgroundColor: C.bg, borderRadius: 14, padding: 0, marginTop: 0 },
  assignFormHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  assignTitle: { color: C.text, fontSize: 13, fontWeight: '800' },
  assignSub: { color: C.muted, fontSize: 10, marginTop: 3 },
  assignCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  subjectChoices: { gap: 6, paddingBottom: 2 },
  subjectChoice: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border },
  subjectChoiceActive: { backgroundColor: C.blueLight, borderColor: C.blue },
  subjectChoiceText: { color: C.sub, fontSize: 12, fontWeight: '700' },
  subjectChoiceTextActive: { color: C.blue },
  subjectEditCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff' },
  subjectEditCode: { minWidth: 58, alignItems: 'center', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, backgroundColor: C.blueLight },
  subjectEditCodeText: { color: C.blue, fontSize: 11, fontWeight: '800' },
  subjectEditName: { color: C.text, fontSize: 12, fontWeight: '800' },
  subjectEditHint: { color: C.muted, fontSize: 10, marginTop: 3 },
  twoCol: { flexDirection: 'row', gap: 8 },
  clockBox: { borderWidth: 1, borderColor: C.border, borderRadius: 11, backgroundColor: '#fff', marginBottom: 10, overflow: 'hidden' },
  clockCompact: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 11 },
  clockCompactCopy: { gap: 3 },
  clockLabel: { color: C.sub, fontSize: 10, fontWeight: '700' },
  clockValue: { color: C.blue, fontSize: 13, fontWeight: '800' },
  clockPickerPanel: { padding: 10, borderTopWidth: 1, borderTopColor: C.border, gap: 8 },
  clockPickerHeader: { gap: 5 },
  clockSubLabel: { color: C.muted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  clockDone: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.blueLight, borderRadius: 9 },
  clockDoneText: { color: C.blue, fontSize: 10, fontWeight: '800' },
  studentPicker: { maxHeight: 260, marginBottom: 12 },
  studentOption: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, marginBottom: 8 },
  studentOptionActive: { borderColor: C.blue, backgroundColor: C.blueLight },
  studentName: { color: C.text, fontSize: 13, fontWeight: '800' },
  studentMeta: { color: C.muted, fontSize: 11, marginTop: 2 },
  selectMark: { color: C.muted, fontSize: 11, fontWeight: '800' },
  selectMarkActive: { color: C.blue },
  assignBtn: { backgroundColor: C.green, borderRadius: 11, padding: 12, alignItems: 'center', marginTop: 8 },
  assignBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.blueLight, borderColor: C.blue },
  chipText: { color: C.sub, fontSize: 10, fontWeight: '600' },
  chipTextActive: { color: C.blue, fontWeight: '800' },
  saveBtn: { backgroundColor: C.blue, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 12 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
