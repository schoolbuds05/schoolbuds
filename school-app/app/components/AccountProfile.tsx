// @ts-nocheck
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
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
  const { theme, reloadTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [notificationPrefs, setNotificationPrefs] = useState([]);
  const [passwordExpanded, setPasswordExpanded] = useState(false);

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
    const existing = notificationPrefs.find(pref => pref.category === category);
    const next = notificationPrefs.map(pref => (
      pref.category === category ? { ...pref, [key]: !pref[key] } : pref
    ));
    if (!existing) next.push({ category, in_app: key === 'in_app' ? false : true, email: true, push: true });
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

  if (user?.position === 'property_custodian') {
    const preferenceRows = [
      { category: 'marketplace', label: 'Marketplace orders' },
      { category: 'low_stock', label: 'Low stock' },
      { category: 'general', label: 'General' },
    ].map(item => ({
      ...item,
      preference: notificationPrefs.find(pref => pref.category === item.category) ?? { category: item.category, in_app: true },
    }));

    return (
      <ScrollView style={s.custodianContainer} contentContainerStyle={s.custodianBody}>
        <View style={s.custodianIdentity}>
          <View style={s.custodianAvatar}><Text style={s.custodianInitial}>{initials[0]}</Text></View>
          <Text style={s.custodianName}>{user?.name ?? 'Staff'}</Text>
          <Text style={s.custodianEmail}>{user?.email ?? ''}</Text>
          <View style={s.custodianRole}><Text style={s.custodianRoleText}>{roleLabel}</Text></View>
        </View>

        <Text style={s.custodianSectionTitle}>NOTIFICATIONS</Text>
        <View style={s.custodianCard}>
          {preferenceRows.map((item, index) => (
            <View key={item.category} style={[s.custodianPrefRow, index < preferenceRows.length - 1 && s.custodianPrefBorder]}>
              <View style={s.custodianPrefCopy}>
                <Text style={s.custodianPrefTitle}>{item.label}</Text>
                <Text style={s.custodianPrefMeta}>In-app alerts</Text>
              </View>
              <Switch
                value={!!item.preference.in_app}
                onValueChange={() => togglePreference(item.category, 'in_app')}
                trackColor={{ false: '#E8DCE0', true: '#B5233D' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E8DCE0"
              />
            </View>
          ))}
        </View>

        <Text style={s.custodianSectionTitle}>SECURITY</Text>
        <TouchableOpacity accessibilityRole="button" style={s.custodianAction} onPress={() => setPasswordExpanded(value => !value)}>
          <Text style={s.custodianActionText}>Change password</Text>
          <Feather name={passwordExpanded ? 'chevron-up' : 'chevron-right'} size={23} color="#7A666B" />
        </TouchableOpacity>
        {passwordExpanded && <ChangePasswordCard embedded theme={{ ...theme, bg: '#FCF6F7', card: '#FFFFFF', border: '#EDD3D8', text: '#2A1B1F', textSub: '#7A666B', textMuted: '#AD999E', primary: '#B5233D' }} />}

        <TouchableOpacity accessibilityRole="button" style={s.custodianLogout} onPress={handleLogout}>
          <Feather name="log-out" size={24} color="#B5233D" />
          <Text style={s.custodianLogoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

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
  custodianContainer: { flex: 1, backgroundColor: '#FCF6F7' },
  custodianBody: { paddingHorizontal: 20, paddingTop: 72, paddingBottom: 32 },
  custodianIdentity: { alignItems: 'center', marginBottom: 50 },
  custodianAvatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#F7DDE3', alignItems: 'center', justifyContent: 'center' },
  custodianInitial: { fontSize: 31, fontWeight: '900', color: '#B5233D' },
  custodianName: { color: '#2A1B1F', fontSize: 22, fontWeight: '900', marginTop: 16 },
  custodianEmail: { color: '#7A666B', fontSize: 15, fontWeight: '500', marginTop: 4 },
  custodianRole: { backgroundColor: '#F7DDE3', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5, marginTop: 10 },
  custodianRoleText: { color: '#B5233D', fontSize: 13, fontWeight: '800' },
  custodianSectionTitle: { color: '#B5233D', fontSize: 13, fontWeight: '900', letterSpacing: 0.7, marginBottom: 8 },
  custodianCard: { backgroundColor: '#FFFFFF', borderColor: '#EDD3D8', borderWidth: 1, borderRadius: 18, overflow: 'hidden', marginBottom: 22 },
  custodianPrefRow: { minHeight: 66, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  custodianPrefBorder: { borderBottomColor: '#EDD3D8', borderBottomWidth: 1 },
  custodianPrefCopy: { flex: 1, paddingRight: 12 },
  custodianPrefTitle: { color: '#2A1B1F', fontSize: 16, fontWeight: '800' },
  custodianPrefMeta: { color: '#7A666B', fontSize: 12, fontWeight: '500', marginTop: 2 },
  custodianAction: { minHeight: 62, backgroundColor: '#FFFFFF', borderColor: '#EDD3D8', borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  custodianActionText: { color: '#2A1B1F', fontSize: 16, fontWeight: '800' },
  custodianLogout: { minHeight: 62, backgroundColor: '#FFFFFF', borderColor: '#EDD3D8', borderWidth: 1, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 },
  custodianLogoutText: { color: '#B5233D', fontSize: 17, fontWeight: '900' },
});
