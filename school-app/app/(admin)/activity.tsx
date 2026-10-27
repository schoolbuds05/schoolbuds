// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
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
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

const FILTERS = ['All', 'Created', 'Deleted', 'Updated', 'Login', 'Logout'];

const ACTION_META = {
  login: { label: 'Login', color: '#24845B', bg: '#DDF2E8', category: 'Login' },
  auth_login: { label: 'Login', color: '#24845B', bg: '#DDF2E8', category: 'Login' },
  logout: { label: 'Logout', color: '#786A6D', bg: '#F0E9EA', category: 'Logout' },
  profile_photo_updated: { label: 'Updated', color: '#8B6819', bg: '#F8EECF', category: 'Updated' },
  admin_user_created: { label: 'Created', color: '#24845B', bg: '#DDF2E8', category: 'Created' },
  admin_user_updated: { label: 'Updated', color: '#8B6819', bg: '#F8EECF', category: 'Updated' },
  admin_user_deleted: { label: 'Deleted', color: '#AE1234', bg: '#F7DFE4', category: 'Deleted' },
  marketplace_payment_verified: { label: 'Payment', color: '#24845B', bg: '#DDF2E8', category: 'Updated' },
  marketplace_order_cancelled: { label: 'Cancelled', color: '#AE1234', bg: '#F7DFE4', category: 'Deleted' },
  marketplace_refund_requested: { label: 'Refund', color: '#8B6819', bg: '#F8EECF', category: 'Created' },
  marketplace_order_refunded: { label: 'Refunded', color: '#AE1234', bg: '#F7DFE4', category: 'Updated' },
  marketplace_refund_rejected: { label: 'Refund Rejected', color: '#AE1234', bg: '#F7DFE4', category: 'Updated' },
  marketplace_checkout_started: { label: 'Checkout', color: '#5E5CA8', bg: '#EAE9F7', category: 'Created' },
  marketplace_message_sent: { label: 'Message', color: '#5E5CA8', bg: '#EAE9F7', category: 'Created' },
  teacher_chat_message_sent: { label: 'Message', color: '#5E5CA8', bg: '#EAE9F7', category: 'Created' },
};

export default function AdminActivity() {
  const { theme } = useTheme();
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = { limit: 100 };
      if (search.trim()) params.search = search.trim();
      const res = await api.get('/admin/activity-logs', { params });
      setLogs(res.data?.logs || []);
    } catch (e) {
      console.log('Activity logs error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  const visibleLogs = useMemo(() => filter === 'All'
    ? logs
    : logs.filter(log => categoryFor(log.action) === filter), [logs, filter]);
  const summary = useMemo(() => [
    { label: 'Logs', value: logs.length },
    { label: 'Users', value: new Set(logs.map(log => log.user_id).filter(Boolean)).size },
    { label: 'Types', value: new Set(logs.map(log => log.action).filter(Boolean)).size },
  ], [logs]);
  const groupedLogs = useMemo(() => groupByDay(visibleLogs), [visibleLogs]);

  return (
    <ScrollView
      style={[s.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#AE1234" />}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.header}>
        <Text style={s.eyebrow}>AUDIT</Text>
        <Text style={s.title}>Activity logs</Text>
        <View style={s.statsRow}>
          {summary.map(item => (
            <View key={item.label} style={s.stat}>
              <Text style={s.statValue}>{item.value}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        <TextInput
          style={s.searchInput}
          placeholder="Search activity"
          placeholderTextColor="#89767A"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {FILTERS.map(item => (
            <TouchableOpacity key={item} onPress={() => setFilter(item)} style={[s.filterChip, filter === item && s.filterChipActive]}>
              <Text style={[s.filterText, filter === item && s.filterTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.loading}><ActivityIndicator size="large" color="#AE1234" /></View>
      ) : groupedLogs.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No activity found</Text>
          <Text style={s.emptyText}>Try another search or activity filter.</Text>
        </View>
      ) : groupedLogs.map(group => (
        <View key={group.key} style={s.dayGroup}>
          <Text style={s.dayHeading}>{group.label}</Text>
          {group.logs.map(log => <ActivityCard key={log.id} log={log} />)}
        </View>
      ))}
      <View style={{ height: 18 }} />
    </ScrollView>
  );
}

function ActivityCard({ log }) {
  const meta = ACTION_META[log.action] || { label: labelFor(log.action), color: '#786A6D', bg: '#F0E9EA' };
  const name = log.actor_name || 'System';
  const event = log.action === 'login' || log.action === 'auth_login'
    ? `${name} logged in`
    : log.action === 'logout'
      ? `${name} logged out`
      : log.description || `${name} · ${meta.label.toLowerCase()}`;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={s.card}
      onPress={() => Alert.alert(event, [log.actor_email, log.description, log.ip_address ? `IP ${log.ip_address}` : null].filter(Boolean).join('\n\n'))}
      accessibilityRole="button"
    >
      <View style={s.avatar}><Text style={s.avatarText}>{initials(name)}</Text></View>
      <View style={s.cardCopy}>
        <Text style={s.eventText} numberOfLines={2}>{event}</Text>
        <Text style={s.timeText}>{formatTime(log.created_at)}</Text>
      </View>
      <View style={[s.badge, { backgroundColor: meta.bg }]}><Text style={[s.badgeText, { color: meta.color }]}>{meta.label}</Text></View>
      <Feather name="chevron-right" size={17} color="#89767A" style={s.chevron} />
    </TouchableOpacity>
  );
}

function categoryFor(action) {
  return ACTION_META[action]?.category || 'Updated';
}

function labelFor(action) {
  return ACTION_META[action]?.label || String(action || 'Activity').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function initials(name) {
  return String(name || 'SY').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function formatTime(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Time not recorded';
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function groupByDay(logs) {
  const groups = new Map();
  logs.forEach(log => {
    const date = log.created_at ? new Date(log.created_at) : null;
    const key = date && !Number.isNaN(date.getTime()) ? date.toDateString() : 'unknown';
    if (!groups.has(key)) {
      const today = new Date().toDateString() === key;
      const dateLabel = key === 'unknown' ? 'DATE NOT RECORDED' : date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
      groups.set(key, { key, label: today ? `TODAY · ${dateLabel}` : dateLabel, logs: [] });
    }
    groups.get(key).logs.push(log);
  });
  return Array.from(groups.values());
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: 28, paddingBottom: 18 },
  header: { paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#FBF3F4' },
  eyebrow: { color: '#AE1234', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: '#301A20', fontSize: 28, lineHeight: 34, fontWeight: '800', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 13 },
  stat: { flex: 1, minHeight: 58, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#F0D9DE', backgroundColor: '#fff' },
  statValue: { color: '#301A20', fontSize: 21, lineHeight: 24, fontWeight: '800' },
  statLabel: { color: '#806D72', fontSize: 12, marginTop: 1 },
  searchInput: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#F0D9DE', backgroundColor: '#fff', paddingHorizontal: 14, color: '#301A20', fontSize: 14 },
  filters: { gap: 8, paddingTop: 12, paddingRight: 20 },
  filterChip: { minHeight: 43, borderRadius: 23, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F0D9DE', backgroundColor: '#fff' },
  filterChipActive: { borderColor: '#AE1234', backgroundColor: '#AE1234' },
  filterText: { color: '#806D72', fontSize: 13, fontWeight: '700' },
  filterTextActive: { color: '#fff' },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  dayGroup: { paddingHorizontal: 20, paddingTop: 16 },
  dayHeading: { color: '#AE1234', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  card: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingLeft: 13, paddingRight: 10, marginBottom: 9, borderRadius: 15, borderWidth: 1, borderColor: '#F0D9DE', backgroundColor: '#fff' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7DFE4', marginRight: 11 },
  avatarText: { color: '#AE1234', fontSize: 12, fontWeight: '800' },
  cardCopy: { flex: 1, minWidth: 0, marginRight: 7 },
  eventText: { color: '#301A20', fontSize: 13, lineHeight: 17, fontWeight: '700' },
  timeText: { color: '#806D72', fontSize: 11, marginTop: 1 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginRight: 8 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  chevron: { marginLeft: 0 },
  empty: { marginHorizontal: 20, marginTop: 20, padding: 28, alignItems: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#F0D9DE', backgroundColor: '#fff' },
  emptyTitle: { color: '#301A20', fontSize: 15, fontWeight: '800' },
  emptyText: { color: '#806D72', fontSize: 12, marginTop: 5, textAlign: 'center' },
});
