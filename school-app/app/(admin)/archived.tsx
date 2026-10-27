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

export default function AdminArchived() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (targetPage = 1, append = false) => {
    try {
      const response = await api.get('/admin/archive', {
        params: { search: search.trim() || undefined, page: targetPage },
      });
      const payload = response.data;
      setItems(current => append ? [...current, ...(payload.data || [])] : (payload.data || []));
      setPage(payload.current_page || targetPage);
      setLastPage(payload.last_page || 1);
    } catch (error) {
      Alert.alert('Could not load archive', error.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [search]);

  useEffect(() => {
    setLoading(true);
    load(1, false);
  }, [load]);

  const restore = item => {
    Alert.alert('Restore record?', `Restore ${item.label || item.record_type}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: async () => {
          try {
            await api.post(`/admin/archive/${item.id}/restore`);
            await load(1, false);
            Alert.alert('Restored', `${item.record_type} was restored.`);
          } catch (error) {
            Alert.alert('Could not restore record', error.response?.data?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top + 14 }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>MANAGE</Text>
        <Text style={[styles.title, { color: theme.text }]}>Archived</Text>
        <Text style={[styles.subtitle, { color: theme.textSub }]}>Review and restore removed records.</Text>
      </View>

      <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="search-outline" size={18} color={theme.textSub} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search archived records"
          placeholderTextColor={theme.textSub}
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1, false); }} />}
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="archive-outline" size={28} color={theme.textSub} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No archived records</Text>
              <Text style={[styles.emptyText, { color: theme.textSub }]}>Records removed by administrators will appear here.</Text>
            </View>
          ) : items.map(item => (
            <View key={item.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.icon, { backgroundColor: `${theme.primary}16` }]}>
                <Ionicons name="archive-outline" size={19} color={theme.primary} />
              </View>
              <View style={styles.details}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>{item.label || 'Archived record'}</Text>
                <Text style={[styles.meta, { color: theme.textSub }]}>{item.record_type}{item.record_id ? ` · #${item.record_id}` : ''}</Text>
                <Text style={[styles.meta, { color: theme.textSub }]}>
                  {item.deleted_at ? `Removed ${new Date(item.deleted_at).toLocaleDateString()}` : 'Removal date unavailable'}
                  {item.deleted_by?.name ? ` · by ${item.deleted_by.name}` : ''}
                </Text>
                {item.restored_at ? (
                  <Text style={[styles.restored, { color: theme.success || '#14805E' }]}>Restored</Text>
                ) : (
                  <TouchableOpacity style={[styles.restoreButton, { borderColor: theme.primary }]} onPress={() => restore(item)}>
                    <Text style={[styles.restoreText, { color: theme.primary }]}>Restore</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {page < lastPage && (
            <TouchableOpacity
              style={[styles.moreButton, { borderColor: theme.border }]}
              onPress={() => { setLoadingMore(true); load(page + 1, true); }}
              disabled={loadingMore}
            >
              {loadingMore ? <ActivityIndicator color={theme.primary} /> : <Text style={[styles.moreText, { color: theme.primary }]}>Load more</Text>}
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 14 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', marginTop: 2 },
  subtitle: { fontSize: 12, marginTop: 3 },
  searchBox: { minHeight: 48, marginHorizontal: 20, marginBottom: 14, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, height: 46, fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 28, gap: 9 },
  card: { borderWidth: 1, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1 },
  name: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  meta: { fontSize: 11, marginTop: 2 },
  restored: { fontSize: 11, fontWeight: '700', marginTop: 7 },
  restoreButton: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8 },
  restoreText: { fontSize: 11, fontWeight: '700' },
  empty: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 4 },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 9 },
  emptyText: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  moreButton: { minHeight: 42, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  moreText: { fontSize: 12, fontWeight: '800' },
});
