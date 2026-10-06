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
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import HeaderGradient from '../components/ui/HeaderGradient';
import api from '../../src/api';

const HEADER_TOP = Platform.OS === 'android'
  ? (StatusBar.currentHeight ?? 24) + 10 : 52;

const ROLES = [
  { value: 'admin', label: 'Admin', bg: '#EEF2FF', color: '#4338CA' },
  { value: 'registrar', label: 'Registrar', bg: '#E0F2FE', color: '#0369A1' },
  { value: 'faculty', label: 'Faculty', bg: '#DCFCE7', color: '#15803D' },
  { value: 'parent', label: 'Parent', bg: '#FFE4E6', color: '#BE123C' },
  { value: 'staff', label: 'Staff', bg: '#E2E8F0', color: '#334155' },
  { value: 'student', label: 'Student', bg: '#FEF3C7', color: '#92400E' },
];

const POSITION_OPTIONS = {
  faculty: [
    { value: 'teacher', label: 'Teacher / Instructor', bg: '#ECFDF5', color: '#047857' },
    { value: 'head_department', label: 'Department Chair', bg: '#EDE9FE', color: '#6D28D9' },
    { value: 'dean', label: 'Dean', bg: '#FEF3C7', color: '#92400E' },
  ],
  staff: [
    { value: 'librarian', label: 'Librarian', bg: '#CCFBF1', color: '#0F766E' },
    { value: 'property_custodian', label: 'Custodian', bg: '#FEE2E2', color: '#B91C1C' },
  ],
};

const emptyForm = { name: '', email: '', password: '', role: 'faculty', position: '', department: '' };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(ROLES);
  const [positions, setPositions] = useState(POSITION_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      const params = {};
      if (roleFilter !== 'all') params.role = roleFilter;
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/admin/users', { params });
      const payload = res.data || [];
      setUsers(Array.isArray(payload) ? payload : (payload.users || []));
      if (!Array.isArray(payload) && payload.roles?.length) {
        setRoles(payload.roles.map(option => ({
          ...option,
          ...(ROLES.find(role => role.value === option.value) || { bg: '#E2E8F0', color: '#334155' }),
        })));
      }
      if (!Array.isArray(payload) && payload.positions) {
        setPositions(Object.entries(payload.positions).reduce((acc, [role, options]) => {
          acc[role] = options.map(option => ({
            ...option,
            ...(POSITION_OPTIONS[role]?.find(position => position.value === option.value) || { bg: '#F8FAFC', color: '#475569' }),
          }));
          return acc;
        }, {}));
      }
    } catch (e) {
      console.log('Admin users error:', e.message);
      Alert.alert('Could not load users', e.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roleFilter, search]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    return roles.reduce((acc, role) => {
      acc[role.value] = users.filter(user => normalizedRole(user.role) === role.value).length;
      return acc;
    }, {});
  }, [users, roles]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: normalizedRole(user.role || 'faculty'),
      position: user.position || legacyPositionFromRole(user.role) || '',
      department: user.department || '',
    });
    setModalOpen(true);
  };

  const setField = (key, value) => setForm(current => ({
    ...current,
    [key]: value,
    ...(key === 'role' ? { position: '' } : {}),
  }));

  const saveUser = async () => {
    if (!form.name.trim() || !form.email.trim() || (!editing && !form.password.trim())) {
      Alert.alert('Missing details', 'Name, email, role, and password are required for new users.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        position: form.position || null,
        department: form.position === 'head_department' ? form.department.trim() : null,
      };
      if (form.password.trim()) payload.password = form.password.trim();

      if (editing) {
        await api.put(`/admin/users/${editing.id}`, payload);
      } else {
        await api.post('/admin/users', payload);
      }

      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (e) {
      const message = e.response?.data?.message || flattenErrors(e.response?.data?.errors) || 'Please check the user details.';
      Alert.alert('Could not save user', message);
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = (user) => {
    Alert.alert('Delete user', `Delete ${user.name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/admin/users/${user.id}`);
            await load();
          } catch (e) {
            Alert.alert('Could not delete user', e.response?.data?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <HeaderGradient
          title="Manage staff accounts"
          subtitle="Quickly review and update school user profiles."
          initials="AD"
          stats={[
            { label: 'Admins', value: totals.admin || 0, accent: '#4338CA' },
            { label: 'Registrars', value: totals.registrar || 0, accent: '#0369A1' },
            { label: 'Faculty', value: totals.faculty || 0, accent: '#15803D' },
            { label: 'Staff', value: totals.staff || 0, accent: '#334155' },
          ]}
        />

        <View style={s.searchRow}>
          <View style={s.searchCard}>
            <Feather name="search" size={18} color="#9CA3AF" style={s.searchIcon} />
            <TextInput
              style={s.searchInputCard}
              placeholder="Search by name or email"
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity style={s.addButton} onPress={openCreate}>
            <Text style={s.addButtonText}>+ Add staff</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#334155" />
        </View>
      ) : (
        <ScrollView
          style={s.list}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {users.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No users found</Text>
              <Text style={s.emptySub}>Try another filter or add a new staff account.</Text>
            </View>
          ) : users.map(user => {
            const normalized = normalizedRole(user.role);
            const role = roles.find(item => item.value === normalized) || roles[0];
            const position = positionMeta(normalized, user.position || legacyPositionFromRole(user.role), positions);
            return (
              <View key={user.id} style={s.userCard}>
                <View style={s.userTop}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{initials(user.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.userName}>{user.name}</Text>
                    <Text style={s.userEmail}>{user.email}</Text>
                    <Text style={s.userDate}>Created {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</Text>
                  </View>
                  <View style={[s.roleBadge, { backgroundColor: role.bg }]}>
                    <Text style={[s.roleText, { color: role.color }]}>{role.label}</Text>
                  </View>
                </View>
                {!!position && (
                  <View style={[s.positionBadge, { backgroundColor: position.bg }]}>
                    <Text style={[s.positionText, { color: position.color }]}>{position.label}</Text>
                  </View>
                )}
                {!!user.department && <Text style={s.departmentText}>Program: {user.department}</Text>}
                <View style={s.cardActions}>
                  <TouchableOpacity style={s.editBtn} onPress={() => openEdit(user)}>
                    <Text style={s.editText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.deleteBtn} onPress={() => deleteUser(user)}>
                    <Text style={s.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={modalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>{editing ? 'Edit user' : 'New user'}</Text>
                <Text style={s.modalSub}>{editing ? 'Update account details and role.' : 'Create a school user account.'}</Text>
              </View>
              <TouchableOpacity style={s.closeBtn} onPress={() => setModalOpen(false)}>
                <Text style={s.closeText}>X</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.form}>
              <Text style={s.label}>Name</Text>
              <TextInput
                style={s.input}
                value={form.name}
                onChangeText={value => setField('name', value)}
                placeholder="Full name"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={s.label}>Email</Text>
              <TextInput
                style={s.input}
                value={form.email}
                onChangeText={value => setField('email', value)}
                placeholder="email@school.com"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={s.label}>{editing ? 'Password (optional)' : 'Password'}</Text>
              <TextInput
                style={s.input}
                value={form.password}
                onChangeText={value => setField('password', value)}
                placeholder={editing ? 'Leave blank to keep current password' : 'Minimum 6 characters'}
                placeholderTextColor="#9CA3AF"
                secureTextEntry
              />

              <Text style={s.label}>Role</Text>
              <View style={s.rolePicker}>
                {roles.map(role => (
                  <TouchableOpacity
                    key={role.value}
                    style={[
                      s.roleOption,
                      form.role === role.value && { backgroundColor: role.bg, borderColor: role.color },
                    ]}
                    onPress={() => setField('role', role.value)}
                  >
                    <Text style={[
                      s.roleOptionText,
                      form.role === role.value && { color: role.color },
                    ]}>
                      {role.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {!!positions[form.role]?.length && (
                <>
                  <Text style={s.label}>Position</Text>
                  <View style={s.rolePicker}>
                    <TouchableOpacity
                      style={[
                        s.roleOption,
                        !form.position && {
                          backgroundColor: defaultPositionStyle(form.role).bg,
                          borderColor: defaultPositionStyle(form.role).color,
                        },
                      ]}
                      onPress={() => setField('position', '')}
                    >
                      <Text style={[s.roleOptionText, !form.position && { color: defaultPositionStyle(form.role).color }]}>
                        {defaultPositionLabel(form.role)}
                      </Text>
                    </TouchableOpacity>
                    {positions[form.role].map(position => (
                      <TouchableOpacity
                        key={position.value}
                        style={[
                          s.roleOption,
                          form.position === position.value && { backgroundColor: position.bg, borderColor: position.color },
                        ]}
                        onPress={() => setField('position', position.value)}
                      >
                        <Text style={[
                          s.roleOptionText,
                          form.position === position.value && { color: position.color },
                        ]}>
                          {position.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {form.position === 'head_department' && (
                <>
                  <Text style={s.label}>Assigned program / department</Text>
                  <TextInput
                    style={s.input}
                    value={form.department}
                    onChangeText={value => setField('department', value)}
                    placeholder="e.g. BS Information Technology"
                    placeholderTextColor="#9CA3AF"
                  />
                </>
              )}

              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={saveUser} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{editing ? 'Save changes' : 'Create user'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function initials(name) {
  if (!name) return 'US';
  return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

function normalizedRole(role) {
  if (['teacher', 'head_teacher', 'dean'].includes(role)) return 'faculty';
  if (['librarian', 'property_custodian'].includes(role)) return 'staff';
  return role;
}

function legacyPositionFromRole(role) {
  if (role === 'teacher') return 'teacher';
  if (['head_teacher', 'dean', 'librarian', 'property_custodian'].includes(role)) return role;
  return '';
}

function positionMeta(role, position, positions) {
  if ((!position || position === 'teacher') && role === 'faculty') {
    return { label: 'Teacher / Instructor', bg: '#ECFDF5', color: '#047857' };
  }
  if (!position) return null;
  return positions[role]?.find(item => item.value === position) || null;
}

function defaultPositionLabel(role) {
  return role === 'faculty' ? 'Teacher / Instructor' : 'None';
}

function defaultPositionStyle(role) {
  return role === 'faculty'
    ? { bg: '#ECFDF5', color: '#047857' }
    : { bg: '#F8FAFC', color: '#334155' };
}

function flattenErrors(errors) {
  if (!errors) return '';
  return Object.values(errors).flat().join('\n');
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: HEADER_TOP, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: 'transparent' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  searchCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, height: 50, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  searchIcon: { marginRight: 10 },
  searchInputCard: { flex: 1, color: '#0F172A', height: 50, fontSize: 14 },
  addButton: { minWidth: 110, backgroundColor: '#4F46E5', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#4F46E5', shadowOpacity: 0.18, shadowRadius: 14, elevation: 3 },
  addButtonText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  list: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  userCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  userTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#4338CA', fontWeight: '900', fontSize: 16 },
  userName: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  userEmail: { color: '#64748B', fontSize: 12, marginTop: 2 },
  userDate: { color: '#94A3B8', fontSize: 11, marginTop: 4 },
  roleBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start' },
  roleText: { fontSize: 11, fontWeight: '900' },
  positionBadge: { marginTop: 12, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start' },
  positionText: { fontSize: 11, fontWeight: '900' },
  departmentText: { marginTop: 9, fontSize: 12, color: '#64748B', fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  editBtn: { flex: 1, backgroundColor: '#EEF2FF', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  editText: { color: '#3730A3', fontWeight: '800', fontSize: 13 },
  deleteBtn: { flex: 1, backgroundColor: '#FEF3F2', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  deleteText: { color: '#B91C1C', fontWeight: '800', fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 30 },
  emptyTitle: { color: '#0F172A', fontSize: 16, fontWeight: '800' },
  emptySub: { color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '88%' },
  modalHeader: { padding: 18, borderBottomWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  modalTitle: { color: '#111827', fontSize: 18, fontWeight: '900' },
  modalSub: { color: '#64748B', fontSize: 12, marginTop: 4 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#334155', fontSize: 13, fontWeight: '900' },
  form: { padding: 18, paddingBottom: 30 },
  label: { color: '#334155', fontSize: 12, fontWeight: '900', marginBottom: 7, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 14, minHeight: 46, color: '#111827', fontSize: 14, backgroundColor: '#fff' },
  rolePicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleOption: { minWidth: '30%', flexGrow: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
  roleOptionText: { color: '#475569', fontSize: 12, fontWeight: '900' },
  saveBtn: { marginTop: 22, backgroundColor: '#0F172A', borderRadius: 14, padding: 15, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 14 },
});
