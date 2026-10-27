// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

export default function AdminDepartments() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/admin/departments', { params: { search: search.trim() || undefined } });
      setDepartments(response.data?.departments || []);
    } catch (error) {
      Alert.alert('Could not load departments', error.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const activeCount = departments.filter(department => department.is_active).length;

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top + 14 }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>MANAGE</Text>
        <Text style={[styles.title, { color: theme.text }]}>Departments</Text>
        <Text style={[styles.subtitle, { color: theme.textSub }]}>Departments, faculty leads, and assigned courses.</Text>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Departments" value={departments.length} theme={theme} />
        <Stat label="Active" value={activeCount} theme={theme} />
        <Stat label="Inactive" value={departments.length - activeCount} theme={theme} />
      </View>

      <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="search-outline" size={18} color={theme.textSub} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search departments or chair"
          placeholderTextColor={theme.textMuted || theme.textSub}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          showsVerticalScrollIndicator={false}
        >
          {departments.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="business-outline" size={28} color={theme.textSub} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No departments found</Text>
              <Text style={[styles.emptyText, { color: theme.textSub }]}>Departments will appear here when they are added.</Text>
            </View>
          ) : departments.map(department => (
            <View key={department.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}16` }]}>
                <Ionicons name="business-outline" size={20} color={theme.primary} />
              </View>
              <View style={styles.details}>
                <View style={styles.titleRow}>
                  <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>{department.name}</Text>
                  <Text style={[styles.code, { color: theme.primary, backgroundColor: theme.primaryLight }]}>{department.code}</Text>
                </View>
                <Text style={[styles.meta, { color: theme.textSub }]}>
                  {department.chair?.name ? `Chair: ${department.chair.name}` : 'No department chair assigned'}
                </Text>
                <Text style={[styles.meta, { color: theme.textSub }]}>
                  {department.faculty_count || 0} faculty · {department.courses_count || 0} courses · {department.subjects_count || 0} subjects
                </Text>
                <View style={[styles.status, { backgroundColor: department.is_active ? '#E6F5EF' : '#F1EDEF' }]}>
                  <Text style={[styles.statusText, { color: department.is_active ? '#16805F' : theme.textSub }]}>{department.is_active ? 'Active' : 'Inactive'}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ label, value, theme }) {
  return (
    <View style={[styles.stat, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSub }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 13 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', marginTop: 2 },
  subtitle: { fontSize: 12, marginTop: 3 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 11 },
  stat: { flex: 1, minHeight: 57, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 12, borderWidth: 1 },
  statValue: { fontSize: 19, fontWeight: '800' },
  statLabel: { fontSize: 9, marginTop: 1 },
  searchBox: { minHeight: 46, marginHorizontal: 20, marginBottom: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 9 },
  card: { borderWidth: 1, borderRadius: 15, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  name: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  code: { overflow: 'hidden', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800' },
  meta: { fontSize: 10, marginTop: 4 },
  status: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 7 },
  statusText: { fontSize: 9, fontWeight: '700' },
  empty: { borderWidth: 1, borderRadius: 15, padding: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 9 },
  emptyText: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
});
