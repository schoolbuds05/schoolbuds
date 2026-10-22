// @ts-nocheck
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import api, { removeToken } from '../../src/api';
import { useTheme } from '../../src/theme-context';

const TEACHING_ITEMS = [
  { name: 'attendance', label: 'Attendance', icon: 'calendar-outline' },
  { name: 'profile', label: 'My profile', icon: 'person-outline' },
];
const CAMPUS_ITEMS = [
  { name: 'market', label: 'Marketplace', icon: 'storefront-outline' },
  { name: 'chat', label: 'Chat', icon: 'chatbubble-outline' },
];

function MenuItem({ item, last, theme, onPress }) {
  return (
    <TouchableOpacity style={[styles.menuItem, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconWrap, { backgroundColor: theme.primaryLight }]}><Ionicons name={item.icon} size={18} color={theme.primary} /></View>
      <Text style={[styles.cardText, { color: theme.text }]}>{item.label}</Text>
      <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
    </TouchableOpacity>
  );
}

export default function TeacherMore() {
  const router = useRouter();
  const { theme, reloadTheme } = useTheme();
  const [user, setUser] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('user').then(value => setUser(value ? JSON.parse(value) : null)).catch(() => {});
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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.text }]}>More</Text>
      <TouchableOpacity style={[styles.profileCard, { backgroundColor: theme.card }]} onPress={() => router.navigate('/(teacher)/profile')} activeOpacity={0.75}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}><Text style={styles.avatarText}>{`${user?.first_name?.[0] || user?.name?.[0] || 'T'}`.toUpperCase()}</Text></View>
        <View style={styles.profileCopy}><Text style={[styles.profileName, { color: theme.text }]}>{user?.name || 'Teacher'}</Text><Text style={[styles.profileMeta, { color: theme.textSub }]}>Teacher account</Text></View>
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      </TouchableOpacity>

      <Text style={[styles.sectionLabel, { color: theme.textSub }]}>Teaching</Text>
      <View style={[styles.group, { backgroundColor: theme.card }]}>
        {TEACHING_ITEMS.map((item, index) => <MenuItem key={item.name} item={item} last={index === TEACHING_ITEMS.length - 1} theme={theme} onPress={() => router.navigate(`/(teacher)/${item.name}`)} />)}
      </View>
      <Text style={[styles.sectionLabel, { color: theme.textSub }]}>Campus</Text>
      <View style={[styles.group, { backgroundColor: theme.card }]}>
        {CAMPUS_ITEMS.map((item, index) => <MenuItem key={item.name} item={item} last={index === CAMPUS_ITEMS.length - 1} theme={theme} onPress={() => router.navigate(`/(teacher)/${item.name}`)} />)}
      </View>

      <TouchableOpacity
        style={[styles.logoutButton, { backgroundColor: theme.card, borderColor: theme.danger }]}
        onPress={handleLogout}
        activeOpacity={0.75}
      >
        <Ionicons name="log-out-outline" size={18} color={theme.danger} />
        <Text style={[styles.logoutText, { color: theme.danger }]}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 42, paddingBottom: 28 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  profileCard: { height: 72, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  profileCopy: { flex: 1, marginLeft: 10 },
  profileName: { fontSize: 14, fontWeight: '800' },
  profileMeta: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6 },
  group: { borderRadius: 14, overflow: 'hidden', marginBottom: 15 },
  menuItem: { minHeight: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, fontSize: 13, fontWeight: '700', marginLeft: 12 },
  logoutButton: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: -1,
  },
  logoutText: { fontSize: 13, fontWeight: '800' },
});
