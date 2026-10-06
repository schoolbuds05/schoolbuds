// @ts-nocheck
// app/(registrar)/courses.tsx — Registrar course management

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Modal,
  RefreshControl, Platform, StatusBar,
} from 'react-native';
import api from '../../src/api';
import HeaderGradient from '../components/ui/HeaderGradient';
import SearchBar from '../components/ui/SearchBar';
import { useTheme } from '../../src/theme-context';

const C = {
  blue: '#378ADD', blueLight: '#E6F1FB',
  green: '#1D9E75', danger: '#E24B4A',
  bg: '#F4F6F9', card: '#FFFFFF', border: '#EFEFEF',
  text: '#1A1A2E', sub: '#6B7280', muted: '#B0B7C3',
};
const HEADER_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 10 : 52;

const EMPTY_FORM = {
  name: '', acronym: '', description: '', program_type: 'college', is_active: true,
};

function Field({ label, children }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Input({ value, onChangeText, placeholder, keyboardType = 'default', multiline = false }) {
  return (
    <TextInput
      style={[s.input, multiline && { height: 90, textAlignVertical: 'top' }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={C.muted}
      keyboardType={keyboardType}
      multiline={multiline}
    />
  );
}

function ChipGroup({ options, value, onSelect }) {
  return (
    <View style={s.chipRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.key ?? opt}
          style={[s.chip, value === (opt.key ?? opt) && s.chipActive]}
          onPress={() => onSelect(opt.key ?? opt)}
        >
          <Text style={[s.chipText, value === (opt.key ?? opt) && s.chipTextActive]}>
            {opt.label ?? opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function RegistrarCourses() {
  const { theme } = useTheme();
  const [courses, setCourses]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [search, setSearch]               = useState('');
  const [showModal, setShowModal]         = useState(false);
  const [editing, setEditing]             = useState(null);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [saving, setSaving]               = useState(false);

  const set = useCallback((key, value) => setForm(prev => ({ ...prev, [key]: value })), []);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await api.get('/courses', { params: { search: search.trim() || undefined } });
      setCourses(res.data || []);
    } catch (e) {
      console.log('Could not fetch courses', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (course) => {
    setEditing(course);
    setForm({
      name: course.name,
      acronym: course.acronym ?? '',
      description: course.description ?? '',
      program_type: course.program_type,
      is_active: course.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Required', 'Course name is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        acronym: form.acronym.trim().toUpperCase() || null,
        description: form.description.trim() || null,
        program_type: form.program_type,
        is_active: form.is_active,
      };

      if (editing) {
        await api.put(`/courses/${editing.id}`, payload);
      } else {
        await api.post('/courses', payload);
      }

      setShowModal(false);
      fetchCourses();
      Alert.alert('Saved!', editing ? 'Course updated.' : 'Course created.');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message ?? 'Could not save course.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (course) => {
    Alert.alert('Delete Course', `Remove "${course.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/courses/${course.id}`);
            setCourses(prev => prev.filter(item => item.id !== course.id));
          } catch {
            Alert.alert('Error', 'Could not delete course.');
          }
        },
      },
    ]);
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}> 
      <HeaderGradient
        title="Courses"
        subtitle={`${courses.length} available courses`}
        initials="CR"
        stats={[
          { label: 'Courses', value: courses.length, accent: '#FDE68A' },
          { label: 'Active', value: courses.filter(c => c.is_active).length, accent: '#A7F3D0' },
          { label: 'Search', value: search ? 'Filtered' : 'All', accent: '#C7D2FE' },
        ]}
      >
        <View style={s.headerActions}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search courses..."
            onSubmitEditing={fetchCourses}
          />
          <TouchableOpacity style={s.addBtn} onPress={openAdd}>
            <Text style={s.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </HeaderGradient>

      {loading ? (
        <View style={[s.center, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCourses(); }} />}
        >
          {courses.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>🎓</Text>
              <Text style={s.emptyTitle}>No courses found</Text>
              <Text style={s.emptySub}>Add courses to allow students to select them during enrollment.</Text>
            </View>
          ) : courses.map(course => (
            <View key={course.id} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}> 
              <View style={s.cardRow}>
                <View style={s.cardInfo}>
                  <View style={s.courseTitleRow}>
                    <Text style={[s.courseName, { color: theme.text }]}>{course.name}</Text>
                    {course.acronym ? <Text style={s.acronymBadge}>{course.acronym}</Text> : null}
                  </View>
                  <Text style={s.courseMeta}>{course.program_type === 'shs' ? 'SHS' : 'College'} • {course.is_active ? 'Active' : 'Inactive'}</Text>
                </View>
                <View style={s.actionsRow}>
                  <TouchableOpacity style={[s.editBtn, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]} onPress={() => openEdit(course)}>
                    <Text style={[s.editBtnText, { color: theme.primary }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.deleteBtn, { backgroundColor: theme.dangerLight, borderColor: theme.danger }]} onPress={() => handleDelete(course)}>
                    <Text style={[s.deleteBtnText, { color: theme.danger }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {course.description ? <Text style={[s.courseDesc, { color: theme.textSub }]}>{course.description}</Text> : null}
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="formSheet">
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{editing ? 'Edit Course' : 'New Course'}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
            <Field label="Course Name *">
              <Input value={form.name} onChangeText={v => set('name', v)} placeholder="e.g. BS Information Technology" />
            </Field>
            <Field label="Acronym">
              <Input value={form.acronym} onChangeText={v => set('acronym', v)} placeholder="e.g. BSIT" />
            </Field>
            <Field label="Description">
              <Input value={form.description} onChangeText={v => set('description', v)} placeholder="Optional description" multiline />
            </Field>
            <Field label="Program Type">
              <ChipGroup
                options={[
                  { key: 'college', label: 'College' },
                  { key: 'shs', label: 'SHS' },
                ]}
                value={form.program_type}
                onSelect={v => set('program_type', v)}
              />
            </Field>
            <Field label="Status">
              <ChipGroup
                options={[
                  { key: true, label: 'Active' },
                  { key: false, label: 'Inactive' },
                ]}
                value={form.is_active}
                onSelect={v => set('is_active', v)}
              />
            </Field>

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{editing ? 'Update Course' : 'Create Course'}</Text>}
            </TouchableOpacity>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: HEADER_TOP, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: C.blue },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  searchWrapper: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchInput: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.border },
  list: { padding: 16, paddingBottom: 28 },
  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardInfo: { flex: 1, marginRight: 12 },
  courseTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  courseName: { fontSize: 16, fontWeight: '700', color: C.text },
  acronymBadge: { overflow: 'hidden', borderRadius: 8, backgroundColor: C.blueLight, color: C.blue, fontSize: 11, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 3 },
  courseMeta: { fontSize: 12, color: C.sub, marginTop: 4 },
  courseDesc: { color: C.sub, marginTop: 10, fontSize: 13, lineHeight: 18 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editBtn: { minWidth: 64, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.blueLight, borderWidth: 1, alignItems: 'center' },
  editBtnText: { color: C.blue, fontWeight: '900', fontSize: 13 },
  deleteBtn: { minWidth: 76, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.danger, borderWidth: 1, alignItems: 'center' },
  deleteBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 64 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 14 },
  emptySub: { fontSize: 13, color: C.sub, textAlign: 'center', marginTop: 8, lineHeight: 18, maxWidth: 260 },
  modalContainer: { flex: 1, backgroundColor: C.bg, paddingTop: HEADER_TOP, paddingHorizontal: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: C.text },
  modalClose: { fontSize: 24, color: C.sub },
  modalBody: { paddingBottom: 40 },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, color: C.sub, marginBottom: 6, fontWeight: '700' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: C.text, fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, marginRight: 8, marginBottom: 8, backgroundColor: '#fff' },
  chipActive: { borderColor: C.blue, backgroundColor: C.blueLight },
  chipText: { color: C.text, fontSize: 13 },
  chipTextActive: { color: C.blue, fontWeight: '700' },
  saveBtn: { backgroundColor: C.blue, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
