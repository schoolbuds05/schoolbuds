// @ts-nocheck
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api, { removeToken } from '../../src/api';
import { useTheme } from '../../src/theme-context';

const MORE_ROUTES = [
  { section: 'Registrar tools', items: [
    { name: 'teaching-eligibility', label: 'Subject departments', icon: 'book-outline' },
    { name: 'grades', label: 'Grades', icon: 'school-outline' },
    { name: 'tuition', label: 'Post tuition', icon: 'wallet-outline' },
    { name: 'course-shift-requests', label: 'Course-shift requests', icon: 'swap-horizontal-outline' },
    { name: 'subjects', label: 'Subjects', icon: 'book-outline' },
    { name: 'reports', label: 'Reports', icon: 'bar-chart-outline' },
  ] },
];

export default function RegistrarMore() {
  const router = useRouter();
  const { theme, reloadTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('user').then(value => {
      if (value) setUser(JSON.parse(value));
    }).catch(() => {});
  }, []);

  const logout = async () => {
    await api.post('/logout').catch(() => {});
    await AsyncStorage.multiRemove(['token', 'role', 'position', 'user']);
    removeToken();
    await reloadTheme();
    router.replace('/login');
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) logout();
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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: 14 + insets.top }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heading}>
        <Text style={[styles.title, { color: theme.text }]}>More</Text>
      </View>

      <TouchableOpacity
        style={[styles.profileCard, { backgroundColor: theme.card }]}
        onPress={() => router.push('/(registrar)/profile')}
        activeOpacity={0.75}
      >
        <View style={[styles.profileAvatar, { backgroundColor: theme.primaryLight }]}>
          <Text style={[styles.profileInitials, { color: theme.primary }]}>{user?.name ? user.name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() : 'RG'}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>{user?.name || 'Registrar'}</Text>
          <Text style={[styles.profileMeta, { color: theme.textSub }]} numberOfLines={1}>{user?.email || 'View your profile'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={19} color={theme.textSub} />
      </TouchableOpacity>

      {MORE_ROUTES.map(group => (
        <View key={group.section} style={styles.group}>
          <Text style={[styles.sectionLabel, { color: theme.textSub }]}>{group.section}</Text>
          <View style={[styles.menuGroup, { backgroundColor: theme.card }]}>
            {group.items.map((item, index) => (
              <TouchableOpacity
                key={item.name}
                style={[styles.menuRow, index < group.items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}
                onPress={() => router.push(`/(registrar)/${item.name}`)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconWrap, { backgroundColor: theme.primaryLight }]}>
                  <Ionicons name={item.icon} size={18} color={theme.primary} />
                </View>
                <Text style={[styles.cardText, { color: theme.text }]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={theme.textSub} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.logoutButton, { backgroundColor: theme.card, borderColor: theme.danger }]}
        onPress={handleLogout}
        activeOpacity={0.75}
      >
        <Ionicons name="log-out-outline" size={19} color={theme.danger} />
        <Text style={[styles.logoutText, { color: theme.danger }]}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 34 },
  heading: { marginBottom: 18 },
  title: { fontSize: 25, fontWeight: '800' },
  profileCard: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 20,
  },
  profileAvatar: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  profileInitials: { fontSize: 17, fontWeight: '900' },
  profileCopy: { flex: 1, gap: 3 },
  profileName: { fontSize: 14, fontWeight: '800' },
  profileMeta: { fontSize: 11 },
  group: { marginBottom: 17 },
  sectionLabel: { fontSize: 11, fontWeight: '700', marginBottom: 8, marginLeft: 1 },
  menuGroup: { borderRadius: 16, overflow: 'hidden' },
  menuRow: {
    minHeight: 61,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, fontSize: 13, fontWeight: '700' },
  logoutButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginTop: 1,
  },
  logoutText: { fontSize: 13, fontWeight: '800' },
});
