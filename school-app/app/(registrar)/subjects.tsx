// @ts-nocheck
// app/(registrar)/subjects.tsx â€” Registrar: manage subjects

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Modal,
  RefreshControl, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';
import SubjectRequests from './subject-requests';

const C = {
  blue: '#B5233D', blueLight: '#F9E4E8',
  green: '#1D9E75', greenLight: '#E1F5EE',
  danger: '#B5233D', dangerLight: '#F9E4E8',
  bg: '#FBF8F5', card: '#FFFFFF', border: '#F0E8E3',
  text: '#2A1B1F', sub: '#7A666B', muted: '#8D7C80',
};
const HEADER_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 10 : 52;

const EMPTY_FORM = {
  code: '', name: '', description: '',
  units_lec: '3', units_lab: '0',
  program_type: 'college', scope: 'course', course: '', year_level: '', strand: '',
  semester: '1st',
  prerequisite_ids: [],
};

function Field({ label, children }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Input({ value, onChangeText, placeholder, keyboardType = 'default' }) {
  return (
    <TextInput style={s.input} value={value} onChangeText={onChangeText}
      placeholder={placeholder} placeholderTextColor={C.muted}
      keyboardType={keyboardType} />
  );
}

function ChipGroup({ options, value, onSelect }) {
  return (
    <View style={s.chipRow}>
      {options.map(opt => (
        <TouchableOpacity key={opt.key ?? opt}
          style={[s.chip, value === (opt.key ?? opt) && s.chipActive]}
          onPress={() => onSelect(opt.key ?? opt)}>
          <Text style={[s.chipText, value === (opt.key ?? opt) && s.chipTextActive]}>
            {opt.label ?? opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function SubjectCatalog({ embedded = false }) {
  const { theme } = useTheme();
  const [subjects, setSubjects]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [courses, setCourses]       = useState([]);
  const [subjectFilterOptions, setSubjectFilterOptions] = useState([]);
  const [courseFilterOptions, setCourseFilterOptions] = useState([]);
  const [courseSearch, setCourseSearch]         = useState('');
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // â”€â”€ FILTER STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [filterProgram, setFilterProgram]   = useState('');
  const [filterCourse, setFilterCourse]     = useState('');
  const [filterYear, setFilterYear]         = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [showFilters, setShowFilters]       = useState(false);

  const hasActiveFilters = !!(filterProgram || filterCourse || filterYear || filterSemester);

  const clearFilters = () => {
    setFilterProgram('');
    setFilterCourse('');
    setFilterYear('');
    setFilterSemester('');
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // â”€â”€ FETCH SUBJECTS â€” primitive deps, no object reference issue â”€â”€
  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/subjects', {
        params: {
          search:       search.trim() || undefined,
          program_type: filterProgram  || undefined,
          scope:        filterCourse   || undefined,
          year_level:   filterYear     || undefined,
          semester:     filterSemester || undefined,
        },
      });
      setSubjects(res.data);
    } catch (e) { console.log(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [search, filterProgram, filterCourse, filterYear, filterSemester]);

  const fetchSubjectFilterOptions = useCallback(async () => {
    try {
      const [subjectsRes, coursesRes] = await Promise.all([
        api.get('/subjects'),
        api.get('/courses'),
      ]);
      setSubjectFilterOptions(Array.isArray(subjectsRes.data) ? subjectsRes.data : []);
      setCourseFilterOptions(Array.isArray(coursesRes.data) ? coursesRes.data : []);
    } catch (e) {
      console.log('Could not fetch subject filter options', e.message);
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await api.get('/courses', {
        params: {
          program_type: form.program_type,
          search: courseSearch.trim() || undefined,
        },
      });
      setCourses(res.data || []);
    } catch (e) { console.log('Could not fetch courses', e.message); }
  }, [form.program_type, courseSearch]);

  // â”€â”€ Split effects so filters don't interfere with course fetching â”€â”€
  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);
  useEffect(() => { fetchCourses(); },  [fetchCourses]);
  useEffect(() => { fetchSubjectFilterOptions(); }, [fetchSubjectFilterOptions]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setCourseDropdownOpen(false);
    setShowModal(true);
  };

  const openEdit = (sub) => {
    setEditing(sub);
    setForm({
      code: sub.code, name: sub.name, description: sub.description ?? '',
      units_lec: String(sub.units_lec), units_lab: String(sub.units_lab),
      program_type: sub.program_type,
      scope: (sub.course || sub.strand) ? 'course' : 'general',
      course: sub.course ?? '',
      year_level: sub.year_level ?? '', strand: sub.strand ?? '',
      semester: sub.semester ?? '1st',
      prerequisite_ids: sub.prerequisites?.map(p => p.id) ?? [],
    });
    setCourseDropdownOpen(false);
    setShowModal(true);
  };

  const togglePrerequisite = useCallback((id) => {
    setForm(prev => ({
      ...prev,
      prerequisite_ids: prev.prerequisite_ids?.includes(id)
        ? prev.prerequisite_ids.filter(pid => pid !== id)
        : [...(prev.prerequisite_ids || []), id],
    }));
  }, []);

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      Alert.alert('Required', 'Code and name are required.'); return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        description: form.description,
        units_lec: parseFloat(form.units_lec),
        units_lab: parseFloat(form.units_lab),
        program_type: form.program_type,
        course: form.scope === 'course' ? form.course : '',
        strand: form.scope === 'course' ? form.strand : '',
        year_level: form.year_level,
        semester: form.semester,
        prerequisite_ids: form.prerequisite_ids || [],
      };
      if (editing) {
        await api.put(`/subjects/${editing.id}`, payload);
      } else {
        await api.post('/subjects', payload);
      }
      setShowModal(false);
      fetchSubjects();
      Alert.alert('Saved!', editing ? 'Subject updated.' : 'Subject created.');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message ?? 'Could not save subject.');
    } finally { setSaving(false); }
  };

  const handleDelete = (sub = editing) => {
    if (!sub?.id) return;
    Alert.alert('Remove Subject', `Remove ${sub.name}? This will also remove it from assigned sections.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/subjects/${sub.id}`);
          setSubjects(prev => prev.filter(s => s.id !== sub.id));
          setShowModal(false);
          setEditing(null);
          Alert.alert('Removed', 'Subject removed successfully.');
        } catch (e) {
          Alert.alert('Error', e.response?.data?.message || 'Could not remove subject.');
        }
      }},
    ]);
  };

  // â”€â”€ Year level options driven by program filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const yearLevelOptions = filterProgram === 'shs'
    ? [
        { key: '', label: 'All' },
        { key: '11', label: 'Grade 11' },
        { key: '12', label: 'Grade 12' },
      ]
    : [
        { key: '', label: 'All' },
        { key: '1', label: '1st Year' },
        { key: '2', label: '2nd Year' },
        { key: '3', label: '3rd Year' },
        { key: '4', label: '4th Year' },
      ];

  const courseOptions = [
    ...['college', 'shs'].flatMap(programType => {
      if (filterProgram && filterProgram !== programType) return [];
      const field = programType === 'shs' ? 'strand' : 'course';
      const catalogOptions = [...new Map(courseFilterOptions
        .filter(course => course.program_type === programType)
        .map(course => ({
          key: `${programType}|${course.acronym || course.name}`,
          label: course.acronym || course.name,
        }))
        .map(option => [option.key.toLowerCase(), option])).values()];
      const representedCourseValues = new Set(courseFilterOptions
        .filter(course => course.program_type === programType)
        .flatMap(course => [course.name, course.acronym].filter(Boolean).map(value => value.trim().toLowerCase())));
      const subjectOptions = [...new Set(subjectFilterOptions
        .filter(subject => subject.program_type === programType)
        .map(subject => subject[field])
        .filter(Boolean))]
        .filter(name => !representedCourseValues.has(name.trim().toLowerCase()))
        .map(name => ({ key: `${programType}|${name}`, label: name }));
      return [...catalogOptions, ...subjectOptions];
    }),
    ...(filterProgram === 'shs' || !filterProgram
      ? [{ key: 'shs|__general__', label: 'General SHS' }]
      : []),
    ...(filterProgram === 'college' || !filterProgram
      ? [{ key: 'college|__general__', label: 'General college' }]
      : []),
  ];

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <View style={[s.pageHeader, embedded && s.embeddedHeader, { backgroundColor: theme.bg }]}>
        {!embedded && <>
          <Text style={s.pageTitle}>Subjects</Text>
          <Text style={s.pageSubtitle}>{subjects.length} subjects · {courses.length} course{courses.length !== 1 ? 's' : ''}</Text>
        </>}
        <View style={s.searchRow}>
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={16} color={C.sub} />
            <TextInput value={search} onChangeText={setSearch} onSubmitEditing={fetchSubjects} placeholder="Search subjects" placeholderTextColor={C.sub} style={s.searchInput} returnKeyType="search" />
          </View>
          <TouchableOpacity style={[s.filterToggleBtn, hasActiveFilters && s.filterToggleBtnActive]} onPress={() => setShowFilters(value => !value)}>
            <Ionicons name="options-outline" size={15} color={C.blue} />
            <Text style={s.filterToggleText}>Filter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={openAdd}><Text style={s.addBtnText}>+ Add</Text></TouchableOpacity>
        </View>
      </View>

      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <View style={s.filterBackdrop}>
          <View style={[s.filterSheet, { backgroundColor: theme.bg }]}>
            <View style={s.filterSheetHeader}>
              <View>
                <Text style={s.filterSheetTitle}>Filter subjects</Text>
                <Text style={s.filterSheetSubtitle}>Choose program, course, year, and semester</Text>
              </View>
              <TouchableOpacity style={s.filterClose} onPress={() => setShowFilters(false)} accessibilityLabel="Close filters">
                <Ionicons name="close" size={19} color={C.sub} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.filterSheetBody}>
              <Text style={s.filterLabel}>Program type</Text>
              <View style={s.filterOptions}>
                {[{ key: '', label: 'All' }, { key: 'college', label: 'College' }, { key: 'shs', label: 'Senior High' }].map(opt => (
                  <TouchableOpacity key={opt.key || 'all-programs'} style={[s.filterOption, filterProgram === opt.key && s.filterOptionActive]} onPress={() => { setFilterProgram(opt.key); setFilterCourse(''); setFilterYear(''); }}>
                    <Text style={[s.filterOptionText, filterProgram === opt.key && s.filterOptionTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.filterLabel}>Course / strand</Text>
              <View style={s.filterOptions}>
                <TouchableOpacity
                  style={[s.filterOption, !filterCourse && s.filterOptionActive]}
                  onPress={() => setFilterCourse('')}
                >
                  <Text style={[s.filterOptionText, !filterCourse && s.filterOptionTextActive]}>All courses</Text>
                </TouchableOpacity>
                {courseOptions.map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[s.filterOption, filterCourse === option.key && s.filterOptionActive]}
                    onPress={() => {
                      setFilterCourse(option.key);
                      if (!filterProgram) setFilterProgram(option.key.split('|')[0]);
                    }}
                  >
                    <Text style={[s.filterOptionText, filterCourse === option.key && s.filterOptionTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.filterLabel}>Year level</Text>
              <View style={s.filterOptions}>
                {yearLevelOptions.map(opt => (
                  <TouchableOpacity key={opt.key || 'all-years'} style={[s.filterOption, filterYear === opt.key && s.filterOptionActive]} onPress={() => setFilterYear(opt.key)}>
                    <Text style={[s.filterOptionText, filterYear === opt.key && s.filterOptionTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.filterLabel}>Semester</Text>
              <View style={s.filterOptions}>
                {[{ key: '', label: 'All' }, { key: '1st', label: '1st semester' }, { key: '2nd', label: '2nd semester' }, { key: 'summer', label: 'Summer' }].map(opt => (
                  <TouchableOpacity key={opt.key || 'all-semesters'} style={[s.filterOption, filterSemester === opt.key && s.filterOptionActive]} onPress={() => setFilterSemester(opt.key)}>
                    <Text style={[s.filterOptionText, filterSemester === opt.key && s.filterOptionTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={s.filterActions}>
              <TouchableOpacity style={s.filterReset} onPress={clearFilters}><Text style={s.filterResetText}>Reset</Text></TouchableOpacity>
              <TouchableOpacity style={s.filterDone} onPress={() => setShowFilters(false)}><Text style={s.filterDoneText}>Done</Text></TouchableOpacity>
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
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchSubjects(); }} />
          }
        >
          {subjects.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name={hasActiveFilters ? 'search-outline' : 'book-outline'} size={34} color={C.muted} style={s.emptyIcon} />
              <Text style={s.emptyTitle}>
                {hasActiveFilters ? 'No subjects match filters' : 'No subjects yet'}
              </Text>
              <Text style={s.emptySub}>
                {hasActiveFilters
                  ? 'Try adjusting or clearing your filters.'
                  : 'Tap "+ Add" to create your first subject.'}
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity style={s.emptyResetBtn} onPress={clearFilters}>
                  <Text style={s.emptyResetBtnText}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : subjects.map((sub, i) => {
            const isExpanded = expandedId === sub.id;
            return (
            <TouchableOpacity
              key={i}
              style={s.subjectCard}
              activeOpacity={0.7}
              onPress={() => setExpandedId(isExpanded ? null : sub.id)}
            >
              <View style={s.subjectCardTop}>
                <View style={s.codeTag}>
                  <Text style={s.codeTagText}>{sub.code}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.subjectName}>{sub.name}</Text>
                  {!isExpanded && (
                    <Text style={s.subjectMeta}>
                      {(sub.course || sub.strand) ? (sub.course || sub.strand) : 'General'} · {Number(sub.units_lec || 0) + Number(sub.units_lab || 0)} units
                    </Text>
                  )}
                </View>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-forward'} size={17} color={C.sub} />
              </View>

              {isExpanded && (
                <View style={{ marginTop: 8 }}>
                  <Text style={s.subjectMeta}>
                    {(sub.course || sub.strand) ? (sub.course || sub.strand) : 'General'} · Year {sub.year_level ?? '-'}
                  </Text>
                  {sub.semester ? (
                    <Text style={s.subjectMeta}>{sub.semester} Semester</Text>
                  ) : null}
                  {sub.description ? (
                    <Text style={[s.subjectDesc, { marginTop: 8 }]}>{sub.description}</Text>
                  ) : null}
                  {sub.prerequisites?.length ? (
                    <View style={s.prereqGroup}>
                      <Text style={s.prereqLabel}>Prerequisites:</Text>
                      <View style={s.prereqList}>
                        {sub.prerequisites.map(pr => (
                          <Text key={pr.id} style={s.prereqChip}>{pr.code}</Text>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  <View style={s.subjectActions}>
                    <Text style={s.unitDetail}>Lecture: {sub.units_lec}  Lab: {sub.units_lab} · Total: {Number(sub.units_lec || 0) + Number(sub.units_lab || 0)} units</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={s.editBtn} onPress={() => openEdit(sub)}>
                        <Text style={s.editBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(sub)}>
                        <Ionicons name="trash-outline" size={15} color={C.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );})}
        </ScrollView>
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{editing ? 'Edit Subject' : 'New Subject'}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={20} color={C.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
            <Field label="Subject Code *">
              <Input value={form.code} onChangeText={v => set('code', v)} placeholder="e.g. IT101" />
            </Field>
            <Field label="Subject Name *">
              <Input value={form.name} onChangeText={v => set('name', v)} placeholder="e.g. Introduction to Programming" />
            </Field>
            <Field label="Description">
              <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]}
                value={form.description} onChangeText={v => set('description', v)}
                placeholder="Optional description" placeholderTextColor={C.muted} multiline />
            </Field>
            <Field label="Program Type">
              <ChipGroup
                options={[{ key: 'college', label: 'College' }, { key: 'shs', label: 'Senior High' }]}
                value={form.program_type}
                onSelect={v => { set('program_type', v); set('course', ''); set('strand', ''); }}
              />
            </Field>
            <Field label="Subject Scope">
              <ChipGroup
                options={[
                  { key: 'course', label: 'Course-specific' },
                  { key: 'general', label: 'General (all courses)' },
                ]}
                value={form.scope}
                onSelect={v => {
                  set('scope', v);
                  if (v === 'general') { set('course', ''); set('strand', ''); }
                }}
              />
            </Field>
            {form.scope === 'course' ? (
              <Field label="Course / Strand">
                {form.program_type === 'college' ? (
                  <>
                    <TouchableOpacity
                      style={[s.dropdown, form.course && s.dropdownActive]}
                      onPress={() => setCourseDropdownOpen(open => !open)}
                    >
                      <Text style={s.dropdownLabel}>{form.course || 'Select course'}</Text>
                      <Ionicons name={courseDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.sub} />
                    </TouchableOpacity>
                    {courseDropdownOpen && (
                      <View style={s.dropdownPanel}>
                        <TextInput
                          style={[s.input, s.courseSearchInput]}
                          value={courseSearch}
                          onChangeText={setCourseSearch}
                          placeholder="Search courses..."
                          placeholderTextColor={C.muted}
                        />
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
                            <Text style={s.helperText}>No courses available for the selected program.</Text>
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </>
                ) : (
                  <Input value={form.strand} onChangeText={v => set('strand', v)} placeholder="e.g. STEM" />
                )}
              </Field>
            ) : (
              <Field label="General Subject">
                <Text style={s.scopeNote}>
                  This subject applies to any {form.program_type === 'shs' ? 'SHS strand' : 'college course'} at the selected year level.
                </Text>
              </Field>
            )}
            <Field label="Year Level">
              <ChipGroup
                options={form.program_type === 'shs'
                  ? [{ key: '11', label: 'G11' }, { key: '12', label: 'G12' }]
                  : [{ key: '1', label: '1st' }, { key: '2', label: '2nd' }, { key: '3', label: '3rd' }, { key: '4', label: '4th' }]}
                value={form.year_level}
                onSelect={v => set('year_level', v)}
              />
            </Field>
            <Field label="Semester">
              <ChipGroup
                options={[
                  { key: '1st', label: '1st Semester' },
                  { key: '2nd', label: '2nd Semester' },
                  { key: 'summer', label: 'Summer' },
                ]}
                value={form.semester}
                onSelect={v => set('semester', v)}
              />
            </Field>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Lecture Units">
                  <Input value={form.units_lec} onChangeText={v => set('units_lec', v)} keyboardType="numeric" placeholder="3" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Lab Units">
                  <Input value={form.units_lab} onChangeText={v => set('units_lab', v)} keyboardType="numeric" placeholder="0" />
                </Field>
              </View>
            </View>
            <Field label="Prerequisites">
              <Text style={s.helperText}>Select subjects that must be completed before this one.</Text>
              {subjects.filter(s => s.id !== editing?.id && s.program_type === form.program_type).map(pr => (
                <TouchableOpacity
                  key={pr.id}
                  style={[s.prereqRow, form.prerequisite_ids?.includes(pr.id) && s.prereqRowActive]}
                  onPress={() => togglePrerequisite(pr.id)}
                >
                  <Text style={s.prereqText}>{pr.code} — {pr.name}</Text>
                </TouchableOpacity>
              ))}
              {subjects.filter(s => s.id !== editing?.id && s.program_type === form.program_type).length === 0 && (
                <Text style={s.helperText}>No existing subjects found for this program.</Text>
              )}
            </Field>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.saveBtnText}>{editing ? 'Update Subject' : 'Create Subject'}</Text>}
            </TouchableOpacity>
            {editing ? (
              <TouchableOpacity style={s.removeSubjectBtn} onPress={() => handleDelete(editing)} disabled={saving}>
                <Text style={s.removeSubjectText}>Remove Subject</Text>
              </TouchableOpacity>
            ) : null}
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
  pageHeader: { paddingTop: HEADER_TOP, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: C.bg },
  embeddedHeader: { paddingTop: 0 },
  pageTitle: { color: C.text, fontSize: 24, fontWeight: '700', fontFamily: 'serif' },
  pageSubtitle: { color: C.sub, fontSize: 10, marginTop: 2 },
  header: { backgroundColor: C.bg, paddingTop: HEADER_TOP, paddingHorizontal: 16, paddingBottom: 14 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  title: { color: C.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: C.sub, fontSize: 12, marginTop: 2 },

  // Search row
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  addBtn: { backgroundColor: C.blue, borderRadius: 11, paddingHorizontal: 13, minHeight: 39, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, height: 40, gap: 7 },
  searchInput: { flex: 1, color: C.text, fontSize: 11, paddingVertical: 6 },

  // Filter toggle
  filterToggleBtn: { backgroundColor: C.card, borderRadius: 11, paddingHorizontal: 9, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: C.blue },
  filterToggleBtnActive: { backgroundColor: C.blueLight },
  filterToggleText: { color: C.blue, fontWeight: '600', fontSize: 10 },

  // Filter sheet
  filterBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(35,20,24,0.38)' },
  filterSheet: { maxHeight: '82%', backgroundColor: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14 },
  filterSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: C.border },
  filterSheetTitle: { color: C.text, fontSize: 17, fontWeight: '800' },
  filterSheetSubtitle: { color: C.sub, fontSize: 11, marginTop: 3 },
  filterClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  filterSheetBody: { paddingTop: 16, paddingBottom: 10 },
  filterLabel: { color: C.sub, fontSize: 11, fontWeight: '800', marginBottom: 8, marginTop: 7 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 11 },
  filterOption: { minHeight: 36, paddingHorizontal: 13, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  filterOptionActive: { backgroundColor: C.blueLight, borderColor: C.blue },
  filterOptionText: { color: C.sub, fontSize: 11, fontWeight: '600' },
  filterOptionTextActive: { color: C.blue, fontWeight: '800' },
  filterActions: { flexDirection: 'row', gap: 9, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  filterReset: { flex: 1, height: 43, borderRadius: 11, borderWidth: 1, borderColor: C.blue, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  filterResetText: { color: C.blue, fontSize: 12, fontWeight: '700' },
  filterDone: { flex: 1.5, height: 43, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.blue },
  filterDoneText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // List
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 9, paddingBottom: 24 },
  subjectCard: { backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 11, borderWidth: 1, borderColor: C.border },
  subjectCardTop: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 0 },
  codeTag: { backgroundColor: C.blueLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, minWidth: 60, alignItems: 'center' },
  codeTagText: { color: C.blue, fontWeight: '700', fontSize: 9 },
  subjectName: { fontSize: 11, fontWeight: '700', color: C.text },
  subjectMeta: { fontSize: 9, color: C.sub, marginTop: 2 },
  unitsTag: { backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  unitsText: { fontSize: 11, color: C.sub, fontWeight: '600' },
  subjectDesc: { fontSize: 12, color: C.muted, marginBottom: 8, lineHeight: 17 },
  subjectActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  unitDetail: { fontSize: 11, color: C.muted },
  prereqGroup: { marginTop: 10 },
  prereqLabel: { fontSize: 11, color: C.muted, marginBottom: 6 },
  prereqList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prereqChip: { backgroundColor: '#EEF4FF', color: C.blue, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, fontSize: 11 },
  prereqRow: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, marginBottom: 8 },
  prereqRowActive: { borderColor: C.blue, backgroundColor: '#E8F1FF' },
  prereqText: { color: C.text, fontSize: 13 },
  editBtn: { backgroundColor: C.blueLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { fontSize: 12, color: C.blue, fontWeight: '600' },
  deleteBtn: { backgroundColor: C.dangerLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  deleteBtnText: { fontSize: 14 },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.text },
  emptySub: { fontSize: 13, color: C.muted, marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },
  emptyResetBtn: { marginTop: 16, backgroundColor: C.blueLight, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  emptyResetBtnText: { color: C.blue, fontWeight: '700', fontSize: 13 },

  // Modal
  modal: { flex: 1, backgroundColor: C.card },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  modalClose: { fontSize: 18, color: C.muted, padding: 4 },
  modalBody: { padding: 16 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: C.sub, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 14, color: C.text, backgroundColor: C.bg },
  scopeNote: { color: C.text, fontSize: 13, lineHeight: 20, padding: 12, backgroundColor: '#F7F9FC', borderRadius: 10, borderWidth: 1, borderColor: '#E5E9F2' },
  helperText: { color: C.muted, fontSize: 12, marginBottom: 8 },
  dropdown: { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownActive: { borderColor: C.blue },
  dropdownLabel: { color: C.text, fontSize: 14 },
  dropdownArrow: { color: C.muted, fontSize: 16 },
  dropdownPanel: { borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: '#fff', marginTop: 10, overflow: 'hidden' },
  dropdownScroll: { maxHeight: 220 },
  courseSearchInput: { margin: 12 },
  courseOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F3' },
  courseOptionActive: { backgroundColor: '#EEF4FF' },
  courseOptionText: { color: C.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.blueLight, borderColor: C.blue },
  chipText: { fontSize: 12, color: C.sub, fontWeight: '500' },
  chipTextActive: { color: C.blue, fontWeight: '700' },
  saveBtn: { backgroundColor: C.blue, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  removeSubjectBtn: { backgroundColor: C.dangerLight, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  removeSubjectText: { color: C.danger, fontWeight: '800', fontSize: 15 },
  combinedHeader: { paddingTop: HEADER_TOP, paddingHorizontal: 16, paddingBottom: 8 },
  combinedTabs: { flexDirection: 'row', padding: 3, borderWidth: 1, borderRadius: 12, gap: 4, marginTop: 12 },
  combinedTab: { flex: 1, minHeight: 35, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  combinedTabText: { fontSize: 10, fontWeight: '700' },
});

export default function RegistrarSubjects() {
  const { theme } = useTheme();
  const [tab, setTab] = useState('catalog');

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <View style={[s.combinedHeader, { backgroundColor: theme.bg }]}>
        <Text style={[s.pageTitle, { color: theme.text }]}>Subjects</Text>
        <Text style={[s.pageSubtitle, { color: theme.textSub }]}>Browse the catalog and review add/drop requests</Text>
        <View style={[s.combinedTabs, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {[
            { key: 'catalog', label: 'Catalog' },
            { key: 'requests', label: 'Requests' },
          ].map(item => (
            <TouchableOpacity
              key={item.key}
              style={[s.combinedTab, tab === item.key && { backgroundColor: theme.primary }]}
              onPress={() => setTab(item.key)}
            >
              <Text style={[s.combinedTabText, { color: theme.textSub }, tab === item.key && { color: '#fff', fontWeight: '800' }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {tab === 'catalog' ? <SubjectCatalog embedded /> : <SubjectRequests embedded />}
    </View>
  );
}
