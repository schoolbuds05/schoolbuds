// @ts-nocheck
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import api, { removeToken } from '../../src/api';
import { useTheme } from '../../src/theme-context';

const ADMIN_TOOLS = [
  { name: 'activity', label: 'Activity', description: 'Audit trail of every action', icon: 'time-outline' },
  { name: 'controls', label: 'Controls', description: 'Enrollment, terms and deadlines', icon: 'sunny-outline', status: true },
  { name: 'archived', label: 'Archive', description: 'Restore hidden records', icon: 'archive-outline' },
  { name: 'reports', label: 'Reports', description: 'School summaries and activity reports', icon: 'bar-chart-outline' },
];

const ACADEMIC_TOOLS = [
  { name: 'courses', label: 'Courses', description: 'Manage available programs', icon: 'school-outline' },
  { name: 'subject-departments', label: 'Subject departments', description: 'Manage subject ownership', icon: 'book-outline' },
];

export default function AdminMore() {
  const router = useRouter();
  const { theme, reloadTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [enrollmentOpen, setEnrollmentOpen] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('user').then(value => {
      if (value) setUser(JSON.parse(value));
    }).catch(() => {});

    api.get('/enrollment/settings')
      .then(response => setEnrollmentOpen(response.data?.enrollment_open === true))
      .catch(() => setEnrollmentOpen(null));
  }, []);

  const logout = async () => {
    await api.post('/logout').catch(() => {});
    await AsyncStorage.multiRemove(['token', 'role', 'position', 'user']);
    removeToken();
    await reloadTheme();
    router.replace('/login');
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const name = user?.name || 'Admin School';
  const email = user?.email || 'admin@school.com';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.pageTitle, { color: theme.text }]}>More</Text>

      <TouchableOpacity
        style={[styles.accountCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => router.push('/(admin)/profile')}
        activeOpacity={0.78}
      >
        <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
          <Text style={[styles.avatarText, { color: theme.primary }]}>{initials(name)}</Text>
        </View>
        <View style={styles.accountDetails}>
          <Text style={[styles.accountName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.accountEmail, { color: theme.textSub }]} numberOfLines={1}>{email}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={theme.textSub} />
      </TouchableOpacity>

      <Text style={[styles.sectionLabel, { color: theme.primary }]}>ADMIN TOOLS</Text>
      <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {ADMIN_TOOLS.map((item, index) => (
          <MenuRow
            key={item.name}
            item={item}
            last={index === ADMIN_TOOLS.length - 1}
            theme={theme}
            enrollmentOpen={enrollmentOpen}
            onPress={() => router.push(`/(admin)/${item.name}`)}
          />
        ))}
      </View>

      <Text style={[styles.sectionLabel, styles.academicLabel, { color: theme.primary }]}>ACADEMIC MANAGEMENT</Text>
      <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {ACADEMIC_TOOLS.map((item, index) => (
          <MenuRow
            key={item.name}
            item={item}
            last={index === ACADEMIC_TOOLS.length - 1}
            theme={theme}
            onPress={() => router.push(`/(admin)/${item.name}`)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.signedIn, { color: theme.textSub }]} numberOfLines={1}>Signed in as {email}</Text>
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={handleLogout}
          activeOpacity={0.78}
        >
          <Ionicons name="log-out-outline" size={17} color={theme.danger} />
          <Text style={[styles.logoutText, { color: theme.danger }]}>Log out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function MenuRow({ item, last, theme, enrollmentOpen, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Ionicons name={item.icon} size={19} color={theme.primary} style={styles.menuIcon} />
      <View style={styles.menuCopy}>
        <Text style={[styles.menuTitle, { color: theme.text }]}>{item.label}</Text>
        <Text style={[styles.menuDescription, { color: theme.textSub }]} numberOfLines={1}>{item.description}</Text>
      </View>
      {item.status && enrollmentOpen !== null && (
        <View style={[styles.statusPill, { backgroundColor: enrollmentOpen ? '#DDF2E8' : theme.bg }]}>
          <Text style={[styles.statusText, { color: enrollmentOpen ? '#16804E' : theme.textSub }]}>{enrollmentOpen ? 'Open' : 'Closed'}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color={theme.textSub} />
    </TouchableOpacity>
  );
}

function initials(name) {
  return String(name || 'Admin School')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, padding: 20, paddingBottom: 20 },
  pageTitle: { fontSize: 27, fontWeight: '800', marginBottom: 12 },
  accountCard: { minHeight: 73, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16, borderWidth: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '800' },
  accountDetails: { flex: 1, minWidth: 0, marginLeft: 11 },
  accountName: { fontSize: 14, fontWeight: '700' },
  accountEmail: { fontSize: 11, marginTop: 1 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.9, marginTop: 19, marginBottom: 7 },
  academicLabel: { marginTop: 17 },
  group: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  menuRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9 },
  menuIcon: { width: 24, marginRight: 9, textAlign: 'center' },
  menuCopy: { flex: 1, minWidth: 0 },
  menuTitle: { fontSize: 14, fontWeight: '700' },
  menuDescription: { fontSize: 10, marginTop: 1 },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, marginHorizontal: 9 },
  statusText: { fontSize: 9, fontWeight: '700' },
  footer: { marginTop: 'auto', paddingTop: 26 },
  signedIn: { textAlign: 'center', fontSize: 10, marginBottom: 8 },
  logoutButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 14 },
  logoutText: { fontSize: 13, fontWeight: '700' },
});
