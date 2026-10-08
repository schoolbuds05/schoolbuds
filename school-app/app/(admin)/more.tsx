// @ts-nocheck
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import api, { removeToken } from '../../src/api';
import { useTheme } from '../../src/theme-context';

const MORE_ROUTES = [
  { name: 'activity', label: 'Activity', icon: 'time-outline' },
  { name: 'market', label: 'Marketplace', icon: 'storefront-outline' },
  { name: 'controls', label: 'Controls', icon: 'settings-outline' },
  { name: 'profile', label: 'Profile', icon: 'person-outline' },
];

export default function AdminMore() {
  const router = useRouter();
  const { theme, reloadTheme } = useTheme();

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
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.text }]}>More</Text>

      <View style={styles.list}>
        {MORE_ROUTES.map((item) => (
          <TouchableOpacity
            key={item.name}
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.navigate(`/(admin)/${item.name}`)}
            activeOpacity={0.75}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}16` }]}>
              <Ionicons name={item.icon} size={22} color={theme.primary} />
            </View>
            <Text style={[styles.cardText, { color: theme.text }]} numberOfLines={1}>
              {item.label}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textSub} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.logoutButton, { backgroundColor: theme.dangerLight, borderColor: theme.danger }]}
        onPress={handleLogout}
        activeOpacity={0.75}
      >
        <View style={[styles.iconWrap, { backgroundColor: '#FFFFFF' }]}>
          <Ionicons name="log-out-outline" size={22} color={theme.danger} />
        </View>
        <Text style={[styles.logoutText, { color: theme.danger }]}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 14 },
  list: { gap: 10 },
  card: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, fontSize: 15, fontWeight: '700' },
  logoutButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    marginTop: 18,
  },
  logoutText: { flex: 1, fontSize: 15, fontWeight: '800' },
});
