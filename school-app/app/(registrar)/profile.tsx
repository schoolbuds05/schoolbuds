// @ts-nocheck
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import api, { removeToken } from '../../src/api';
import { useTheme } from '../../src/theme-context';
import ChangePasswordCard from '../components/ChangePasswordCard';

export default function RegistrarProfile() {
  const router = useRouter();
  const { theme } = useTheme();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalStudents: 0,
    pendingApplications: 0,
    approvedApplications: 0,
    rejectedApplications: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('user').then(u => {
      if (u) setUser(JSON.parse(u));
    });

    const load = async () => {
      try {
        const [meRes, studentsRes, enrollmentsRes] = await Promise.all([
          api.get('/me'),
          api.get('/students'),
          api.get('/registrar/enrollments'),
        ]);

        const me = meRes.data?.user ?? meRes.data;
        setUser(me);

        const students = studentsRes.data || [];
        const enrollments = enrollmentsRes.data || [];
        setStats({
          totalStudents: students.length,
          pendingApplications: enrollments.filter(e => e.status === 'pending').length,
          approvedApplications: enrollments.filter(e => e.status === 'approved').length,
          rejectedApplications: enrollments.filter(e => e.status === 'rejected').length,
        });
      } catch (e) {
        console.log('Registrar profile error:', e.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const logout = async () => {
    await api.post('/logout').catch(() => {});
    await AsyncStorage.multiRemove(['token', 'role', 'position', 'user']);
    removeToken();
    router.replace('/login');
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) {
        logout();
      }
      return;
    }

    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#378ADD" />
      </View>
    );
  }

  const initials = user?.name
    ? user.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()
    : 'RG';
  const roleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Registrar';

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.hero}>
        <View style={s.avatar}>
          <Text style={s.initials}>{initials}</Text>
        </View>
        <Text style={s.name}>{user?.name ?? 'Registrar'}</Text>
        <Text style={s.email}>{user?.email ?? 'registrar@school.com'}</Text>
        <View style={s.roleBadge}>
          <Text style={s.roleText}>🛂 {roleLabel}</Text>
        </View>
      </View>

      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statValue}>{stats.totalStudents}</Text>
          <Text style={s.statLabel}>Students</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statValue}>{stats.pendingApplications}</Text>
          <Text style={s.statLabel}>Pending apps</Text>
        </View>
      </View>

      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statValue}>{stats.approvedApplications}</Text>
          <Text style={s.statLabel}>Approved</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statValue}>{stats.rejectedApplications}</Text>
          <Text style={s.statLabel}>Rejected</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Account information</Text>
        {[
          ['Name', user?.name ?? 'Registrar'],
          ['Email', user?.email ?? '—'],
          ['Role', roleLabel],
          ['Member since', user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'],
        ].map(([label, value]) => (
          <View key={label} style={s.infoRow}>
            <Text style={s.infoLabel}>{label}</Text>
            <Text style={s.infoValue}>{value}</Text>
          </View>
        ))}
      </View>

      <ChangePasswordCard theme={theme} />

      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F6F9' },
  hero: { backgroundColor: '#378ADD', paddingTop: 50, paddingBottom: 24, paddingHorizontal: 20, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.24)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  initials: { color: '#fff', fontSize: 28, fontWeight: '700' },
  name: { color: '#fff', fontSize: 20, fontWeight: '700' },
  email: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  roleBadge: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)' },
  roleText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 16, gap: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  statValue: { fontSize: 24, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 6 },
  card: { margin: 16, backgroundColor: '#fff', borderRadius: 18, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#EFF2F7' },
  infoLabel: { fontSize: 13, color: '#6B7280' },
  infoValue: { fontSize: 13, color: '#111827', fontWeight: '600', textAlign: 'right', maxWidth: '55%' },
  logoutBtn: { marginHorizontal: 16, marginTop: 10, backgroundColor: '#FCEBEB', borderRadius: 14, padding: 16, alignItems: 'center' },
  logoutText: { color: '#D14343', fontWeight: '700', fontSize: 14 },
});
