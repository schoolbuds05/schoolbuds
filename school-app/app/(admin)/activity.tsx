// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import HeaderGradient from '../components/ui/HeaderGradient';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

const ACTION_META = {
  login: { label: 'Login', color: '#15803D', bg: '#DCFCE7' },
  logout: { label: 'Logout', color: '#475569', bg: '#F1F5F9' },
  profile_photo_updated: { label: 'Profile', color: '#0369A1', bg: '#E0F2FE' },
  admin_user_created: { label: 'Created', color: '#4338CA', bg: '#EEF2FF' },
  admin_user_updated: { label: 'Updated', color: '#B45309', bg: '#FEF3C7' },
  admin_user_deleted: { label: 'Deleted', color: '#B91C1C', bg: '#FEE2E2' },
  marketplace_payment_verified: { label: 'Payment', color: '#047857', bg: '#ECFDF5' },
  marketplace_order_cancelled: { label: 'Cancelled', color: '#B91C1C', bg: '#FEE2E2' },
  marketplace_refund_requested: { label: 'Refund Request', color: '#B45309', bg: '#FEF3C7' },
  marketplace_order_refunded: { label: 'Refunded', color: '#B91C1C', bg: '#FEE2E2' },
  marketplace_refund_rejected: { label: 'Refund Rejected', color: '#B91C1C', bg: '#FEE2E2' },
  marketplace_checkout_started: { label: 'Checkout', color: '#0369A1', bg: '#E0F2FE' },
  marketplace_message_sent: { label: 'Market Chat', color: '#7C3AED', bg: '#F3E8FF' },
  teacher_chat_message_sent: { label: 'Class Chat', color: '#0F766E', bg: '#CCFBF1' },
};

export default function AdminActivity() {
  const { theme } = useTheme();
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (action) params.action = action;

      const res = await api.get('/admin/activity-logs', { params });
      setLogs(res.data?.logs || []);
      setActions(res.data?.actions || []);
    } catch (e) {
      console.log('Activity logs error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [action, search]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  const summary = useMemo(() => {
    const uniqueUsers = new Set(logs.map(log => log.user_id).filter(Boolean)).size;
    return [
      { label: 'Logs', value: logs.length, accent: theme.primary },
      { label: 'Users', value: uniqueUsers, accent: theme.green },
      { label: 'Types', value: actions.length, accent: theme.orange },
    ];
  }, [logs, actions, theme]);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[s.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={{ paddingBottom: 110 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <HeaderGradient
        title="Activity Logs"
        subtitle="Review user sign-ins, account changes, and marketplace actions."
        initials="AL"
        stats={summary}
      />

      <View style={[s.filterPanel, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TextInput
          style={[s.searchInput, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
          placeholder="Search activity"
          placeholderTextColor={theme.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          <TouchableOpacity
            style={[s.chip, { borderColor: theme.border }, action === '' && { backgroundColor: theme.primary, borderColor: theme.primary }]}
            onPress={() => setAction('')}
          >
            <Text style={[s.chipText, { color: action === '' ? '#fff' : theme.textSub }]}>All</Text>
          </TouchableOpacity>
          {actions.map(item => {
            const active = action === item;
            return (
              <TouchableOpacity
                key={item}
                style={[s.chip, { borderColor: theme.border }, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                onPress={() => setAction(item)}
              >
                <Text style={[s.chipText, { color: active ? '#fff' : theme.textSub }]}>{labelFor(item)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={s.list}>
        {logs.length === 0 ? (
          <View style={[s.empty, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[s.emptyTitle, { color: theme.text }]}>No activity yet</Text>
            <Text style={[s.emptySub, { color: theme.textSub }]}>User actions will appear here once recorded.</Text>
          </View>
        ) : logs.map(log => (
          <ActivityCard key={log.id} log={log} theme={theme} />
        ))}
      </View>
    </ScrollView>
  );
}

function ActivityCard({ log, theme }) {
  const meta = ACTION_META[log.action] || { label: labelFor(log.action), color: theme.textSub, bg: theme.bg };

  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={s.cardTop}>
        <View style={[s.actorAvatar, { backgroundColor: meta.bg }]}>
          <Text style={[s.actorInitials, { color: meta.color }]}>{initials(log.actor_name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.actorName, { color: theme.text }]}>{log.actor_name || 'System'}</Text>
          <Text style={[s.actorMeta, { color: theme.textSub }]}>{log.actor_email || log.actor_role || 'Activity'}</Text>
        </View>
        <View style={[s.badge, { backgroundColor: meta.bg }]}>
          <Text style={[s.badgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
      <Text style={[s.description, { color: theme.text }]}>{log.description}</Text>
      <View style={s.cardBottom}>
        <Text style={[s.timeText, { color: theme.textMuted }]}>{formatDate(log.created_at)}</Text>
        {log.ip_address ? <Text style={[s.timeText, { color: theme.textMuted }]}>IP {log.ip_address}</Text> : null}
      </View>
    </View>
  );
}

function labelFor(action) {
  return (ACTION_META[action]?.label || String(action || 'Activity').replace(/_/g, ' '))
    .replace(/\b\w/g, char => char.toUpperCase());
}

function initials(name) {
  if (!name) return 'SY';
  return String(name).split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterPanel: { marginHorizontal: 14, marginBottom: 12, borderRadius: 12, padding: 12, borderWidth: 1 },
  searchInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  chips: { gap: 8, paddingTop: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 12, fontWeight: '800' },
  list: { paddingHorizontal: 14, gap: 10 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actorAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  actorInitials: { fontSize: 13, fontWeight: '900' },
  actorName: { fontSize: 14, fontWeight: '900' },
  actorMeta: { fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { fontSize: 10, fontWeight: '900' },
  description: { fontSize: 13, lineHeight: 19, marginTop: 12, fontWeight: '600' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  timeText: { fontSize: 11, fontWeight: '700' },
  empty: { borderWidth: 1, borderRadius: 12, padding: 28, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '900' },
  emptySub: { fontSize: 12, marginTop: 5, textAlign: 'center' },
});
