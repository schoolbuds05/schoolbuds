// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
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
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

const HEADER_TOP = Platform.OS === 'android'
  ? 5 : 44;

const ROLES = [
  { value: 'admin', label: 'Admin', bg: '#EEF2FF', color: '#4338CA' },
  { value: 'registrar', label: 'Registrar', bg: '#E0F2FE', color: '#0369A1' },
  { value: 'faculty', label: 'Faculty', bg: '#DCFCE7', color: '#15803D' },
  { value: 'staff', label: 'Staff', bg: '#E2E8F0', color: '#334155' },
];

const STAFF_ROLE_VALUES = ['admin', 'registrar', 'faculty', 'staff'];

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
  const { theme } = useTheme();
  const [users, setUsers] = useState([]);
  const [dashboardCounts, setDashboardCounts] = useState({});
  const [roles, setRoles] = useState(ROLES);
  const [positions, setPositions] = useState(POSITION_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();

      const [res, dashboardRes] = await Promise.all([
        api.get('/admin/users', { params }),
        api.get('/admin/dashboard'),
      ]);
      setDashboardCounts(dashboardRes.data?.counts || {});
      const payload = res.data || [];
      const userRows = Array.isArray(payload) ? payload : (payload.users || []);
      setUsers(userRows.filter(user => STAFF_ROLE_VALUES.includes(normalizedRole(user.role))));
      if (!Array.isArray(payload) && payload.roles?.length) {
        setRoles(payload.roles.filter(option => STAFF_ROLE_VALUES.includes(option.value)).map(option => ({
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
      Alert.alert('Could not load staff', e.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setCurrentPage(1); }, [roleFilter, search]);

  const totals = {
    admin: dashboardCounts.admins ?? 0,
    registrar: dashboardCounts.registrars ?? 0,
    faculty: (dashboardCounts.faculty ?? 0) + (dashboardCounts.head_teachers ?? 0) + (dashboardCounts.deans ?? 0),
    staff: (dashboardCounts.staff ?? 0) + (dashboardCounts.librarians ?? 0) + (dashboardCounts.property_custodians ?? 0),
  };
  const filteredUsers = roleFilter === 'all'
    ? users
    : users.filter(user => normalizedRole(user.role) === roleFilter);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / 15));
  const page = Math.min(currentPage, totalPages);
  const visibleUsers = filteredUsers.slice((page - 1) * 15, page * 15);
  const pageNumbers = totalPages <= 5
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : page <= 3
      ? [1, 2, 3, 'start-gap', totalPages]
      : page >= totalPages - 2
        ? [1, 'end-gap', totalPages - 2, totalPages - 1, totalPages]
        : [1, 'start-gap', page - 1, page, page + 1, 'end-gap', totalPages];
  const totalStaff = totals.admin + totals.registrar + totals.faculty + totals.staff;
  const totalForCurrentFilter = search.trim()
    ? filteredUsers.length
    : roleFilter === 'all' ? totalStaff : (totals[roleFilter] ?? filteredUsers.length);

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
      Alert.alert('Missing details', 'Name, email, role, and password are required for new staff accounts.');
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
      const message = e.response?.data?.message || flattenErrors(e.response?.data?.errors) || 'Please check the staff account details.';
      Alert.alert('Could not save staff account', message);
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = (user) => {
    Alert.alert('Delete staff account', `Delete ${user.name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/admin/users/${user.id}`);
            await load();
          } catch (e) {
            Alert.alert('Could not delete staff account', e.response?.data?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const showUserActions = (user) => Alert.alert(user.name, 'Choose an account action.', [
    { text: 'Edit', onPress: () => openEdit(user) },
    { text: 'Delete', style: 'destructive', onPress: () => deleteUser(user) },
    { text: 'Cancel', style: 'cancel' },
  ]);

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <View style={s.header}>
        <Text style={[s.kicker, { color: theme.primary }]}>Manage</Text>
        <Text style={[s.title, { color: theme.text }]}>Manage Staff Users</Text>

        <View style={s.roleTotals}>
          {roles.map(role => (
            <View key={role.value} style={[s.roleTotal, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[s.roleTotalValue, { color: theme.text }]}>{totals[role.value] || 0}</Text>
              <Text style={[s.roleTotalLabel, { color: theme.textSub }]}>{role.value === 'faculty' || role.value === 'staff' ? role.label : `${role.label}s`}</Text>
            </View>
          ))}
        </View>

        <View style={s.searchRow}>
          <View style={[s.searchCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Feather name="search" size={16} color={theme.textMuted} style={s.searchIcon} />
            <TextInput
              style={[s.searchInputCard, { color: theme.text }]}
              placeholder="Search name or email"
              placeholderTextColor={theme.textMuted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity
            accessibilityLabel="Add staff account"
            style={[s.addButton, { backgroundColor: theme.primary }]}
            onPress={openCreate}
          >
            <Text style={s.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {[
            { value: 'all', label: 'All' },
            { value: 'admin', label: 'Admins' },
            { value: 'registrar', label: 'Registrar' },
            { value: 'faculty', label: 'Faculty' },
            { value: 'staff', label: 'Staff' },
          ].map(filter => {
            const active = roleFilter === filter.value;
            return (
              <TouchableOpacity
                key={filter.value}
                style={[s.filterChip, { borderColor: theme.border, backgroundColor: theme.card }, active && { borderColor: theme.primary, backgroundColor: theme.primary }]}
                onPress={() => setRoleFilter(filter.value)}
              >
                <Text style={[s.filterChipText, { color: theme.textSub }, active && { color: '#fff' }]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          style={s.list}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {filteredUsers.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No staff accounts found</Text>
              <Text style={s.emptySub}>Try another filter or add a staff account.</Text>
            </View>
          ) : visibleUsers.map(user => {
            const normalized = normalizedRole(user.role);
            const role = roles.find(item => item.value === normalized) || roles[0];
            const rawPosition = user.position || legacyPositionFromRole(user.role);
            const position = positionMeta(normalized, rawPosition, positions);
            const showPosition = !!position && !(normalized === 'faculty' && (!rawPosition || rawPosition === 'teacher'));
            return (
              <View key={user.id} style={[s.userCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={s.userTop}>
                  <View style={[s.avatar, { borderColor: theme.primary, backgroundColor: theme.card }]}>
                    <Text style={[s.avatarText, { color: theme.primary }]}>{initials(user.name)}</Text>
                  </View>
                  <View style={s.userDetails}>
                    <View style={s.nameRow}>
                      <Text style={[s.userName, { color: theme.text }]} numberOfLines={2}>{user.name}</Text>
                      <View style={[s.roleBadge, { backgroundColor: theme.primaryLight }]}>
                        <Text style={[s.roleText, { color: theme.primary }]}>{role.label}</Text>
                      </View>
                    </View>
                    <Text style={[s.userEmail, { color: theme.textSub }]} numberOfLines={1}>{user.email}</Text>
                    {showPosition && <Text style={[s.positionText, { color: theme.textSub }]}>{normalized === 'faculty' ? 'Faculty account' : `${position.label} account`}</Text>}
                    <Text style={[s.userDate, { color: theme.textSub }]}>Created {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</Text>
                  </View>
                  <TouchableOpacity accessibilityLabel={`Actions for ${user.name}`} style={s.moreButton} onPress={() => showUserActions(user)}>
                    <Feather name="more-vertical" size={19} color={theme.textSub} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          {filteredUsers.length > 0 && (
            <View style={s.loadMoreRow}>
              <Text style={[s.loadMoreText, { color: theme.textSub }]}>Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, filteredUsers.length)} of {totalForCurrentFilter}</Text>
              {totalPages > 1 && (
                <View style={s.pagination}>
                  <TouchableOpacity accessibilityLabel="Previous page" disabled={page === 1} onPress={() => setCurrentPage(page - 1)} style={s.pageControl}>
                    <Feather name="chevron-left" size={16} color={page === 1 ? theme.textMuted : theme.primary} />
                  </TouchableOpacity>
                  {pageNumbers.map((pageItem, index) => pageItem === 'start-gap' || pageItem === 'end-gap' ? (
                    <Text key={`${pageItem}-${index}`} style={[s.pageEllipsis, { color: theme.textSub }]}>…</Text>
                  ) : (
                    <TouchableOpacity key={pageItem} accessibilityLabel={`Page ${pageItem}`} onPress={() => setCurrentPage(pageItem)} style={[s.pageNumber, pageItem === page && { backgroundColor: theme.primary }]}>
                      <Text style={[s.pageNumberText, { color: pageItem === page ? '#fff' : theme.textSub }]}>{pageItem}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity accessibilityLabel="Next page" disabled={page === totalPages} onPress={() => setCurrentPage(page + 1)} style={s.pageControl}>
                    <Feather name="chevron-right" size={16} color={page === totalPages ? theme.textMuted : theme.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
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
                <Text style={s.modalTitle}>{editing ? 'Edit staff account' : 'New staff account'}</Text>
                <Text style={s.modalSub}>{editing ? 'Update account details and role.' : 'Create a school staff account.'}</Text>
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
                        (!form.position || form.position === defaultPositionValue(form.role)) && {
                          backgroundColor: defaultPositionStyle(form.role).bg,
                          borderColor: defaultPositionStyle(form.role).color,
                        },
                      ]}
                      onPress={() => setField('position', '')}
                    >
                      <Text style={[
                        s.roleOptionText,
                        (!form.position || form.position === defaultPositionValue(form.role)) && { color: defaultPositionStyle(form.role).color },
                      ]}>
                        {defaultPositionLabel(form.role)}
                      </Text>
                    </TouchableOpacity>
                    {positions[form.role]
                      .filter(position => position.value !== defaultPositionValue(form.role))
                      .map(position => (
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

              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.7 }]}
                onPress={saveUser}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{editing ? 'Save changes' : 'Create staff account'}</Text>}
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

function defaultPositionValue(role) {
  return role === 'faculty' ? 'teacher' : '';
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
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: HEADER_TOP, paddingHorizontal: 20, paddingBottom: 0, backgroundColor: 'transparent' },
  kicker: { fontSize: 9, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 20, fontWeight: '700', marginTop: 1, marginBottom: 8 },
  roleTotals: { flexDirection: 'row', gap: 7, marginBottom: 10 },
  roleTotal: { minWidth: 0, flex: 1, minHeight: 54, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 7, borderRadius: 12, borderWidth: 1 },
  roleTotalValue: { fontSize: 18, fontWeight: '700', lineHeight: 21 },
  roleTotalLabel: { fontSize: 8, marginTop: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 },
  searchCard: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, height: 43 },
  searchIcon: { marginRight: 7 },
  searchInputCard: { flex: 1, height: 43, fontSize: 12 },
  addButton: { minWidth: 78, height: 43, borderRadius: 11, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  filterRow: { gap: 7, paddingBottom: 10 },
  filterChip: { minHeight: 34, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  filterChipText: { fontSize: 11, fontWeight: '600' },
  list: { flex: 1, paddingHorizontal: 20, paddingTop: 0 },
  listContent: { paddingBottom: 20 },
  userCard: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 10, marginBottom: 9 },
  userTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 0, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', fontSize: 10 },
  userDetails: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  userName: { flexShrink: 1, fontSize: 11, fontWeight: '700' },
  userEmail: { fontSize: 10, marginTop: 1 },
  userDate: { fontSize: 9, marginTop: 0 },
  roleBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'center' },
  roleText: { fontSize: 8, fontWeight: '600' },
  positionText: { fontSize: 9, marginTop: 1 },
  moreButton: { width: 22, height: 32, alignItems: 'center', justifyContent: 'center' },
  departmentText: { marginTop: 9, fontSize: 12, color: '#64748B', fontWeight: '700' },
  loadMoreRow: { flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 5, paddingVertical: 8 },
  loadMoreText: { fontSize: 10 },
  pagination: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageControl: { width: 27, height: 27, alignItems: 'center', justifyContent: 'center' },
  pageEllipsis: { width: 18, textAlign: 'center', fontSize: 13 },
  pageNumber: { minWidth: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  pageNumberText: { fontSize: 10, fontWeight: '700' },
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
  saveBtn: { marginTop: 22, borderRadius: 14, padding: 15, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 14 },
});
