// @ts-nocheck
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import api, { removeToken } from '../../src/api';
import { formatRoleAndPosition } from '../../src/user-labels';
import { useTheme } from '../../src/theme-context';

const TEACHING_ITEMS = [
  { label: 'Teaching subjects', detail: 'Manage teaching assignments', icon: 'book-outline', route: '/(leadership)/teaching-eligibility' },
  { label: 'Work', detail: 'Manage class assignments', icon: 'briefcase-outline', route: '/(leadership)/work' },
];
const ACADEMIC_ITEMS = [
  { label: 'Grades', detail: 'Review grade sheets and change requests', icon: 'school-outline', route: '/(leadership)/grades' },
  { label: 'Academic overview', detail: 'Department performance and activity', icon: 'home-outline', route: '/(leadership)/dashboard' },
];
const SECTIONS_ITEM = { label: 'Sections', detail: 'Manage department sections', icon: 'layers-outline', route: '/(leadership)/sections' };
const CAMPUS_ITEMS = [
  { label: 'Marketplace', detail: 'Browse the campus marketplace', icon: 'storefront-outline', route: '/(teacher)/market' },
];

function MenuGroup({ items, theme, onPress }) {
  return <View style={[s.group, { backgroundColor: theme.card }]}>
    {items.map((item, index) => <TouchableOpacity key={item.route} style={[s.row, index < items.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]} onPress={() => onPress(item.route)} activeOpacity={0.7}>
      <View style={[s.icon, { backgroundColor: theme.primaryLight }]}><Ionicons name={item.icon} size={19} color={theme.primary} /></View>
      <View style={s.copy}><Text style={[s.label, { color: theme.text }]}>{item.label}</Text><Text style={[s.detail, { color: theme.textSub }]}>{item.detail}</Text></View>
      <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
    </TouchableOpacity>)}
  </View>;
}

export default function LeadershipMore() {
  const router = useRouter();
  const { theme, reloadTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [canManageSections, setCanManageSections] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('user')
      .then(value => { if (value) setUser(JSON.parse(value)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    api.get('/academic-leadership/dashboard')
      .then(response => { if (active) setCanManageSections(!!response.data.can_manage_sections); })
      .catch(() => { if (active) setCanManageSections(false); });
    return () => { active = false; };
  }, []);

  const accountLabel = formatRoleAndPosition(user, 'Department Chair');
  const logout = () => Alert.alert('Log out', 'Are you sure you want to log out?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: async () => {
      await api.post('/logout').catch(() => {});
      await AsyncStorage.multiRemove(['token', 'role', 'position', 'user']);
      removeToken();
      await reloadTheme();
      router.replace('/login');
    } },
  ]);

  return <ScrollView style={[s.container, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
    <Text style={[s.title, { color: theme.text }]}>More</Text>
    <TouchableOpacity
      style={[s.profileCard, { backgroundColor: theme.card }]}
      onPress={() => router.push('/(leadership)/profile')}
      activeOpacity={0.75}
    >
      <View style={[s.avatar, { backgroundColor: theme.primary }]}>
        <Text style={s.avatarText}>{`${user?.first_name?.[0] || user?.name?.[0] || 'C'}`.toUpperCase()}</Text>
      </View>
      <View style={s.profileCopy}>
        <Text style={[s.profileName, { color: theme.text }]} numberOfLines={1}>{user?.name || 'Department Chair'}</Text>
        <Text style={[s.profileMeta, { color: theme.textSub }]} numberOfLines={1}>{accountLabel}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
    </TouchableOpacity>
    <Text style={[s.sectionLabel, { color: theme.textSub }]}>Teaching</Text>
    <MenuGroup items={TEACHING_ITEMS} theme={theme} onPress={route => router.push(route)} />
    <Text style={[s.sectionLabel, { color: theme.textSub }]}>Academic</Text>
    <MenuGroup items={[...ACADEMIC_ITEMS, ...(canManageSections ? [SECTIONS_ITEM] : [])]} theme={theme} onPress={route => router.push(route)} />
    <Text style={[s.sectionLabel, { color: theme.textSub }]}>Campus</Text>
    <MenuGroup items={CAMPUS_ITEMS} theme={theme} onPress={route => router.push(route)} />
    <TouchableOpacity style={[s.logout, { backgroundColor: theme.card, borderColor: theme.danger }]} onPress={logout}><Ionicons name="log-out-outline" size={19} color={theme.danger} /><Text style={[s.logoutText, { color: theme.danger }]}>Log out</Text></TouchableOpacity>
  </ScrollView>;
}

const s = StyleSheet.create({ container: { flex: 1 }, content: { padding: 16, paddingTop: 42, paddingBottom: 28 }, title: { fontSize: 22, fontWeight: '800', marginBottom: 12 }, profileCard: { minHeight: 72, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 18 }, avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' }, avatarText: { color: '#fff', fontSize: 17, fontWeight: '800' }, profileCopy: { flex: 1, marginLeft: 10 }, profileName: { fontSize: 14, fontWeight: '800' }, profileMeta: { fontSize: 11, fontWeight: '600', marginTop: 2 }, sectionLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6 }, group: { borderRadius: 14, overflow: 'hidden', marginBottom: 15 }, row: { minHeight: 58, paddingHorizontal: 12, alignItems: 'center', flexDirection: 'row' }, icon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1, marginLeft: 12 }, label: { fontSize: 13, fontWeight: '800' }, detail: { fontSize: 11, fontWeight: '600', marginTop: 2 }, logout: { minHeight: 46, borderRadius: 12, borderWidth: 1, marginTop: 3, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, logoutText: { fontSize: 13, fontWeight: '800' } });
