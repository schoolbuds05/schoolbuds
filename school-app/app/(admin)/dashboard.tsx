// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import HeaderGradient from '../components/ui/HeaderGradient';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

const HEADER_TOP = Platform.OS === 'android'
  ? (StatusBar.currentHeight ?? 24) + 10 : 52;

const roleLabels = {
  admin: 'Admin',
  registrar: 'Registrar',
  faculty: 'Faculty',
  teacher: 'Faculty',
  parent: 'Parent',
  staff: 'Staff',
  student: 'Student',
};

const positionLabels = {
  head_teacher: 'Head Teacher',
  dean: 'Dean',
  librarian: 'Librarian',
  property_custodian: 'Custodian',
};

const EMPTY_DASHBOARD = {
  counts: { admins: 0, registrars: 0, faculty: 0, head_teachers: 0, deans: 0, parents: 0, staff: 0, librarians: 0, property_custodians: 0, students: 0 },
  recent_users: [],
};

export default function AdminDashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(EMPTY_DASHBOARD);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/dashboard');
      setData(res.data || EMPTY_DASHBOARD);
    } catch (e) {
      console.log('Admin dashboard error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = data.counts || {};
  const stats = [
    ['Admins', counts.admins ?? 0, '#EEF2FF', '#4338CA'],
    ['Registrars', counts.registrars ?? 0, '#E0F2FE', '#0369A1'],
    ['Faculty', counts.faculty ?? 0, '#DCFCE7', '#15803D'],
    ['Staff', counts.staff ?? 0, '#E2E8F0', '#334155'],
    ['Parents', counts.parents ?? 0, '#FFE4E6', '#BE123C'],
    ['Students', counts.students ?? 0, '#FEF3C7', '#B45309'],
  ];

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}> 
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[s.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={{ paddingBottom: 110 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <HeaderGradient
        title="Dashboard"
        subtitle="Monitor school roles and manage the most important admin actions."
        initials="AD"
        stats={[
          { label: 'Admins', value: counts.admins ?? 0, accent: theme.primary },
          { label: 'Registrars', value: counts.registrars ?? 0, accent: theme.green },
          { label: 'Faculty', value: counts.faculty ?? 0, accent: theme.purple },
          { label: 'Staff', value: counts.staff ?? 0, accent: theme.orange },
          { label: 'Students', value: counts.students ?? 0, accent: theme.orange },
        ]}
      />

      <View style={s.statsGrid}>
        {stats.map(([label, value, bg, color]) => (
          <View key={label} style={[s.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
            <View style={[s.statIcon, { backgroundColor: bg }]}>
              <Text style={[s.statIconText, { color }]}>{label.slice(0, 2).toUpperCase()}</Text>
            </View>
            <Text style={[s.statValue, { color: theme.text }]}>{value}</Text>
            <Text style={[s.statLabel, { color: theme.textSub }]}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={s.actions}>
        <TouchableOpacity style={[s.primaryAction, { backgroundColor: theme.primary }]} onPress={() => router.push('/(admin)/users')}>
          <Text style={[s.primaryActionText, { color: theme.card }]}>Manage users</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.secondaryAction, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.push('/(admin)/market')}>
          <Text style={[s.secondaryActionText, { color: theme.text }]}>Review marketplace</Text>
        </TouchableOpacity>
      </View>

      <View style={[s.panel, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <View style={[s.panelHeader, { borderBottomColor: theme.border }]}> 
          <Text style={[s.panelTitle, { color: theme.text }]}>Recent staff accounts</Text>
          <TouchableOpacity onPress={() => router.push('/(admin)/users')}>
            <Text style={[s.panelLink, { color: theme.primary }]}>View all</Text>
          </TouchableOpacity>
        </View>

        {(data.recent_users || []).length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No staff accounts yet</Text>
            <Text style={s.emptySub}>Create admin, registrar, faculty, parent, or staff accounts from Users.</Text>
          </View>
        ) : (
          data.recent_users.map(user => (
            <View key={user.id} style={s.userRow}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initials(user.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.userName}>{user.name}</Text>
                <Text style={s.userMeta}>{user.email}</Text>
              </View>
              <View style={s.roleBadge}>
                <Text style={s.roleText}>{positionLabels[user.position] || roleLabels[user.role] || user.role}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function initials(name) {
  if (!name) return 'AD';
  return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },
  header: { backgroundColor: '#334155', paddingTop: HEADER_TOP, paddingHorizontal: 18, paddingBottom: 22 },
  kicker: { color: 'rgba(255,255,255,0.68)', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 5 },
  subtitle: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 320 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  statCard: { flexBasis: '48%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  statIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statIconText: { fontSize: 11, fontWeight: '900' },
  statValue: { color: '#111827', fontSize: 24, fontWeight: '800' },
  statLabel: { color: '#64748B', fontSize: 12, fontWeight: '700', marginTop: 3 },
  actions: { paddingHorizontal: 16, gap: 10 },
  primaryAction: { backgroundColor: '#334155', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  primaryActionText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  secondaryAction: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  secondaryActionText: { color: '#334155', fontSize: 14, fontWeight: '800' },
  panel: { margin: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  panelHeader: { padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#F1F5F9' },
  panelTitle: { color: '#111827', fontSize: 15, fontWeight: '800' },
  panelLink: { color: '#0369A1', fontSize: 12, fontWeight: '800' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#334155', fontSize: 13, fontWeight: '900' },
  userName: { color: '#111827', fontSize: 14, fontWeight: '800' },
  userMeta: { color: '#64748B', fontSize: 12, marginTop: 2 },
  roleBadge: { backgroundColor: '#F1F5F9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  roleText: { color: '#334155', fontSize: 11, fontWeight: '800' },
  empty: { padding: 24, alignItems: 'center' },
  emptyTitle: { color: '#111827', fontSize: 14, fontWeight: '800' },
  emptySub: { color: '#64748B', fontSize: 12, marginTop: 5, textAlign: 'center' },
});
