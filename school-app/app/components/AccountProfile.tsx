// @ts-nocheck
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import api, { removeToken } from '../../src/api';
import { useTheme } from '../../src/theme-context';
import ChangePasswordCard from './ChangePasswordCard';

const ROLE_LABELS = {
  parent: 'Parent',
  staff: 'Staff',
};

const POSITION_LABELS = {
  teacher: 'Teacher / Instructor',
  head_department: 'Department Chair',
  head_teacher: 'Head Teacher',
  dean: 'Dean',
  librarian: 'Librarian',
  property_custodian: 'Property Custodian',
};

export default function AccountProfile() {
  const router = useRouter();
  const { theme, themeName, setThemeName, reloadTheme, themes } = useTheme();
  const [user, setUser] = useState(null);
  const [notificationPrefs, setNotificationPrefs] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem('user').then(value => {
      if (value) setUser(JSON.parse(value));
    });
    api.get('/notifications/preferences')
      .then(res => setNotificationPrefs(res.data?.preferences ?? []))
      .catch(() => {});
  }, []);

  const togglePreference = async (category, key) => {
    const previous = notificationPrefs;
    const next = notificationPrefs.map(pref => (
      pref.category === category ? { ...pref, [key]: !pref[key] } : pref
    ));
    setNotificationPrefs(next);

    try {
      await api.put('/notifications/preferences', { preferences: next });
    } catch (e) {
      setNotificationPrefs(previous);
      Alert.alert('Update failed', e.response?.data?.message || 'Could not save notification preferences.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await api.post('/logout').catch(() => {});
          await AsyncStorage.multiRemove(['token', 'role', 'position', 'user']);
          removeToken();
          await reloadTheme();
          router.replace('/login');
        },
      },
    ]);
  };

  const roleLabel = POSITION_LABELS[user?.position] ?? ROLE_LABELS[user?.role] ?? user?.role ?? 'Account';
  const initials = user?.name
    ? user.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()
    : 'AC';

  return (
    <ScrollView style={[s.container, { backgroundColor: theme.bg }]} contentContainerStyle={s.body}>
      <View style={[s.hero, { backgroundColor: theme.primary }]}>
        <View style={s.avatar}>
          <Text style={s.initials}>{initials}</Text>
        </View>
        <Text style={s.name}>{user?.name ?? 'Account'}</Text>
        <Text style={s.role}>{roleLabel}</Text>
        <Text style={s.email}>{user?.email ?? ''}</Text>
      </View>

      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[s.title, { color: theme.text }]}>Color Theme</Text>
        <View style={s.paletteRow}>
          {Object.values(themes).map((palette) => (
            <TouchableOpacity
              key={palette.name}
              style={[
                s.paletteOption,
                { backgroundColor: theme.bg, borderColor: theme.border },
                themeName === palette.name && { borderColor: theme.primary },
              ]}
              onPress={() => setThemeName(palette.name)}
            >
              <View style={[s.paletteDot, { backgroundColor: palette.primary }]} />
              <Text style={[
                s.paletteLabel,
                { color: themeName === palette.name ? theme.primary : theme.textSub },
              ]}>
                {palette.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[s.title, { color: theme.text }]}>Notifications</Text>
        {notificationPrefs.map(pref => (
          <View key={pref.category} style={[s.prefRow, { borderColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.prefTitle, { color: theme.text }]}>{pref.category.replace('_', ' ').toUpperCase()}</Text>
              <Text style={[s.prefMeta, { color: theme.textSub }]}>In-app alerts</Text>
            </View>
            <Switch
              value={!!pref.in_app}
              onValueChange={() => togglePreference(pref.category, 'in_app')}
              trackColor={{ false: theme.border, true: theme.primaryLight }}
              thumbColor={pref.in_app ? theme.primary : '#f4f3f4'}
            />
          </View>
        ))}
      </View>

      <ChangePasswordCard theme={theme} />

      <TouchableOpacity style={[s.logoutBtn, { backgroundColor: theme.dangerLight, borderColor: theme.danger }]} onPress={handleLogout}>
        <Text style={[s.logoutText, { color: theme.danger }]}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  body: { paddingBottom: 40 },
  hero: { paddingTop: 64, paddingBottom: 28, paddingHorizontal: 20, alignItems: 'center' },
  avatar: { width: 78, height: 78, borderRadius: 39, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)' },
  initials: { color: '#fff', fontSize: 26, fontWeight: '900' },
  name: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 12 },
  role: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: '800', marginTop: 4 },
  email: { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 6 },
  card: { margin: 16, borderRadius: 14, borderWidth: 1, padding: 16 },
  title: { fontSize: 15, fontWeight: '900', marginBottom: 12 },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paletteOption: { flex: 1, minWidth: 86, borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
  paletteDot: { width: 28, height: 28, borderRadius: 14, marginBottom: 8 },
  paletteLabel: { fontSize: 11, fontWeight: '900' },
  prefRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1 },
  prefTitle: { fontSize: 13, fontWeight: '900' },
  prefMeta: { fontSize: 11, marginTop: 3 },
  logoutBtn: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, padding: 16, alignItems: 'center' },
  logoutText: { fontSize: 14, fontWeight: '900' },
});
