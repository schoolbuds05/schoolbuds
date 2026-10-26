// @ts-nocheck
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import api, { removeToken } from '../../src/api';
import { useTheme } from '../../src/theme-context';

const ITEMS = [
  { label: 'My profile', detail: 'Account and preferences', icon: 'person-outline', route: '/(parent)/profile' },
  { label: 'My children', detail: 'Grades, attendance, fees, and points', icon: 'people-outline', route: '/(parent)/dashboard' },
];

export default function ParentMore() {
  const router = useRouter();
  const { theme, reloadTheme } = useTheme();
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
    <Text style={[s.subtitle, { color: theme.textSub }]}>Parent account</Text>
    <View style={[s.group, { backgroundColor: theme.card }]}>
      {ITEMS.map((item, index) => <TouchableOpacity key={item.route} style={[s.row, index < ITEMS.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]} onPress={() => router.navigate(item.route)}>
        <View style={[s.icon, { backgroundColor: theme.primaryLight }]}><Ionicons name={item.icon} size={19} color={theme.primary} /></View>
        <View style={s.copy}><Text style={[s.label, { color: theme.text }]}>{item.label}</Text><Text style={[s.detail, { color: theme.textSub }]}>{item.detail}</Text></View>
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      </TouchableOpacity>)}
    </View>
    <TouchableOpacity style={[s.logout, { backgroundColor: theme.card, borderColor: theme.danger }]} onPress={logout}><Ionicons name="log-out-outline" size={19} color={theme.danger} /><Text style={[s.logoutText, { color: theme.danger }]}>Log out</Text></TouchableOpacity>
  </ScrollView>;
}

const s = StyleSheet.create({ container: { flex: 1 }, content: { padding: 16, paddingTop: 42, paddingBottom: 28 }, title: { fontSize: 22, fontWeight: '800' }, subtitle: { fontSize: 12, fontWeight: '700', marginTop: 3, marginBottom: 16 }, group: { borderRadius: 14, overflow: 'hidden' }, row: { minHeight: 68, paddingHorizontal: 12, alignItems: 'center', flexDirection: 'row' }, icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1, marginLeft: 12 }, label: { fontSize: 14, fontWeight: '800' }, detail: { fontSize: 11, fontWeight: '600', marginTop: 2 }, logout: { minHeight: 46, borderRadius: 12, borderWidth: 1, marginTop: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, logoutText: { fontSize: 13, fontWeight: '800' } });
