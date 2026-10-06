// @ts-nocheck
// app/(registrar)/subjects.tsx — Registrar: manage subjects

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
  blue: '#378ADD', blueLight: '#E6F1FB',
  green: '#1D9E75', greenLight: '#E1F5EE',
  danger: '#E24B4A', dangerLight: '#FCEBEB',
  bg: '#F4F6F9', card: '#FFFFFF', border: '#EFEFEF',
  text: '#1A1A2E', sub: '#6B7280', muted: '#B0B7C3',
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

export default function RegistrarSubjects() {
  const [subjects, setSubjects]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [courses, setCourses]       = useState([]);
  const [courseSearch, setCourseSearch]         = useState('');
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // ── FILTER STATE ──────────────────────────────────────────
  const [filterProgram, setFilterProgram]   = useState('');
  const [filterYear, setFilterYear]         = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [showFilters, setShowFilters]       = useState(false);

  const hasActiveFilters = !!(filterProgram || filterYear || filterSemester);

  const clearFilters = () => {
    setFilterProgram('');
    setFilterYear('');
    setFilterSemester('');
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── FETCH SUBJECTS — primitive deps, no object reference issue ──
  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/subjects', {
        params: {
          search:       search.trim() || undefined,
          program_type: filterProgram  || undefined,
          year_level:   filterYear     || undefined,
          semester:     filterSemester || undefined,
        },
      });
      setSubjects(res.data);
    } catch (e) { console.log(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [search, filterProgram, filterYear, filterSemester]);

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

  // ── Split effects so filters don't interfere with course fetching ──
  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);
  useEffect(() => { fetchCourses(); },  [fetchCourses]);

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

  // ── Year level options driven by program filter ───────────
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

  return (
    <View style={s.container}>
      <HeaderGradient
        title="Subjects"
        subtitle={`${subjects.length} subject${subjects.length !== 1 ? 's' : ''} ${hasActiveFilters ? 'matched' : 'in the system'}`}
        initials="SB"
        stats={[
          { label: 'Subjects', value: subjects.length, accent: '#FEF08A' },
          { label: 'Courses',  value: courses.length,  accent: '#BFDBFE' },
          { label: 'Status',   value: hasActiveFilters ? 'Filtered' : 'All', accent: '#FBCFE8' },
        ]}
      >
        {/* ── Search + Filter toggle + Add ── */}
        <View style={s.searchRow}>
          <View style={{ flex: 1 }}>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search subjects..."
              onSubmitEditing={fetchSubjects}
            />
          </View>
          <TouchableOpacity
            style={[s.filterToggleBtn, (showFilters || hasActiveFilters) && s.filterToggleBtnActive]}
            onPress={() => setShowFilters(v => !v)}
          >
            <Text style={s.filterToggleText}>
              {hasActiveFilters ? '🔽 Filtered' : '⚙️ Filter'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={openAdd}>
            <Text style={s.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* ── Filter panel ── */}
        {showFilters && (
          <View style={s.filterPanel}>

            {/* Program Type */}
            <Text style={s.filterLabel}>Program Type</Text>
            <View style={s.chipRow}>
              {[
                { key: '', label: 'All' },
                { key: 'college', label: '🎓 College' },
                { key: 'shs', label: '🏫 SHS' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.chip, s.chipLight, filterProgram === opt.key && s.chipActive]}
                  onPress={() => {
                    setFilterProgram(opt.key);
                    setFilterYear(''); // reset year when program changes
                  }}
                >
                  <Text style={[s.chipText, filterProgram === opt.key && s.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Year Level */}
            <Text style={[s.filterLabel, { marginTop: 10 }]}>Year Level</Text>
            <View style={s.chipRow}>
              {yearLevelOptions.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.chip, s.chipLight, filterYear === opt.key && s.chipActive]}
                  onPress={() => setFilterYear(opt.key)}
                >
                  <Text style={[s.chipText, filterYear === opt.key && s.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Semester */}
            <Text style={[s.filterLabel, { marginTop: 10 }]}>Semester</Text>
            <View style={s.chipRow}>
              {[
                { key: '', label: 'All' },
                { key: '1st', label: '1st Sem' },
                { key: '2nd', label: '2nd Sem' },
                { key: 'summer', label: '☀️ Summer' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.chip, s.chipLight, filterSemester === opt.key && s.chipActive]}
                  onPress={() => setFilterSemester(opt.key)}
                >
                  <Text style={[s.chipText, filterSemester === opt.key && s.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <TouchableOpacity style={s.clearFiltersBtn} onPress={clearFilters}>
                <Text style={s.clearFiltersBtnText}>✕ Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </HeaderGradient>

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
              <Text style={s.emptyIcon}>{hasActiveFilters ? '🔍' : '📚'}</Text>
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
                      {(sub.course || sub.strand) ? (sub.course || sub.strand) : 'General'} · {sub.units_lec + sub.units_lab} units
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: C.muted }}>{isExpanded ? '▲' : '▼'}</Text>
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
                    <Text style={s.unitDetail}>Lec: {sub.units_lec}  Lab: {sub.units_lab}  ·  Total: {sub.units_lec + sub.units_lab} units</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={s.editBtn} onPress={() => openEdit(sub)}>
                        <Text style={s.editBtnText}>✏️ Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(sub)}>
                        <Text style={s.deleteBtnText}>🗑</Text>
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
              <Text style={s.modalClose}>✕</Text>
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
                options={[{ key: 'college', label: '🎓 College' }, { key: 'shs', label: '🏫 SHS' }]}
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
                      <Text style={s.dropdownArrow}>{courseDropdownOpen ? '▲' : '▼'}</Text>
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
                  { key: 'summer', label: '☀️ Summer' },
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
  header: { backgroundColor: C.blue, paddingTop: HEADER_TOP, paddingHorizontal: 16, paddingBottom: 14 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },

  // Search row
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 13 },

  // Filter toggle
  filterToggleBtn: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  filterToggleBtnActive: { backgroundColor: 'rgba(255,255,255,0.45)' },
  filterToggleText: { color: '#fff', fontWeight: '600', fontSize: 12 },

  // Filter panel
  filterPanel: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 12 },
  filterLabel: { color: 'rgba(255,255,255,0.80)', fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipLight: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)' },
  clearFiltersBtn: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  clearFiltersBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // List
  list: { padding: 12, gap: 10, paddingBottom: 24 },
  subjectCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, elevation: 2 },
  subjectCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  codeTag: { backgroundColor: C.blueLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  codeTagText: { color: C.blue, fontWeight: '700', fontSize: 12 },
  subjectName: { fontSize: 14, fontWeight: '600', color: C.text },
  subjectMeta: { fontSize: 11, color: C.muted, marginTop: 2 },
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
});
