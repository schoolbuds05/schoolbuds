// @ts-nocheck
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../src/api';
import { HEADER_TOP } from '../../src/theme';
import { useTheme } from '../../src/theme-context';
import ChangePasswordCard from '../components/ChangePasswordCard';

export default function RegistrarProfile() {
  const { theme } = useTheme();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ students: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('user').then(value => {
      if (value) setUser(JSON.parse(value));
    }).catch(() => {});

    Promise.all([api.get('/me'), api.get('/registrar/students'), api.get('/registrar/enrollments')])
      .then(([meRes, studentsRes, enrollmentsRes]) => {
        const me = meRes.data?.user ?? meRes.data;
        setUser(me);
        const unwrap = value => Array.isArray(value) ? value : value?.data ?? value?.students ?? value?.enrollments ?? [];
        const enrollments = unwrap(enrollmentsRes.data);
        setStats({
          students: unwrap(studentsRes.data).length,
          pending: enrollments.filter(item => item.status === 'pending').length,
          approved: enrollments.filter(item => item.status === 'approved').length,
          rejected: enrollments.filter(item => item.status === 'rejected').length,
        });
      })
      .catch(error => console.log('Registrar profile error:', error.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={[styles.center, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color={theme.primary} /></View>;

  const initials = user?.name ? user.name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() : 'RG';
  const role = user?.role ? user.role.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : 'Registrar';
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}><Text style={styles.initials}>{initials}</Text></View>
        <Text style={[styles.name, { color: theme.text }]}>{user?.name || 'Registrar'}</Text>
        <Text style={[styles.email, { color: theme.textSub }]}>{user?.email || '—'}</Text>
        <View style={[styles.roleBadge, { backgroundColor: theme.primaryLight }]}><Text style={[styles.roleText, { color: theme.primary }]}>{role}</Text></View>
      </View>

      <View style={styles.stats}>
        <Stat value={stats.students} label="Students" theme={theme} />
        <Stat value={stats.pending} label="Pending" theme={theme} />
        <Stat value={stats.approved} label="Approved" theme={theme} />
        <Stat value={stats.rejected} label="Rejected" theme={theme} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Account</Text>
        <InfoRow label="Email" value={user?.email} theme={theme} />
        <InfoRow label="Role" value={role} theme={theme} />
        <InfoRow label="Member since" value={memberSince} theme={theme} last />
      </View>

      <ChangePasswordCard theme={theme} embedded />
    </ScrollView>
  );
}

function Stat({ value, label, theme }) {
  return <View style={[styles.stat, { backgroundColor: theme.card }]}><Text style={[styles.statValue, { color: theme.text }]}>{value}</Text><Text style={[styles.statLabel, { color: theme.textSub }]}>{label}</Text></View>;
}

function InfoRow({ label, value, theme, last }) {
  return (
    <View style={[styles.infoRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      <Text style={[styles.infoLabel, { color: theme.textSub }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 18, paddingTop: HEADER_TOP + 8, paddingBottom: 26 },
  identity: { alignItems: 'center', marginBottom: 12 },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  initials: { color: '#fff', fontSize: 20, fontWeight: '900' },
  name: { fontSize: 18, fontFamily: 'serif', fontWeight: '700' },
  email: { fontSize: 10, marginTop: 3 },
  roleBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, marginTop: 5 },
  roleText: { fontSize: 9, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  stat: { flex: 1, minWidth: 0, height: 45, borderRadius: 12, borderWidth: 1, borderColor: '#F0E8E3', alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 13, fontWeight: '800' },
  statLabel: { fontSize: 8, marginTop: 1 },
  card: { borderRadius: 14, borderWidth: 1, borderColor: '#F0E8E3', paddingHorizontal: 12, paddingTop: 11, paddingBottom: 3 },
  cardTitle: { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  infoRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoLabel: { fontSize: 10 },
  infoValue: { fontSize: 10, fontWeight: '700', maxWidth: '65%', textAlign: 'right' },
});
