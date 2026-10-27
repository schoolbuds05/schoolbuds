// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

const HEADER_TOP = Platform.OS === 'android'
  ? (StatusBar.currentHeight ?? 24) + 10 : 52;

const EMPTY_DASHBOARD = {
  counts: { admins: 0, registrars: 0, faculty: 0, head_teachers: 0, deans: 0, parents: 0, staff: 0, librarians: 0, property_custodians: 0, students: 0 },
  finance: { collected: 0, outstanding: 0, pending_reviews: 0 },
};

const ROLE_COLORS = ['#B20C32', '#C83D5B', '#D76C83', '#E198A8', '#E9B8C1', '#F1D1D8'];

export default function AdminDashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(EMPTY_DASHBOARD);
  const [recentActivity, setRecentActivity] = useState([]);
  const [user, setUser] = useState(null);

  const load = useCallback(async () => {
    try {
      const [dashboardRes, activityRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/activity-logs', { params: { limit: 3 } }),
      ]);
      setData(dashboardRes.data || EMPTY_DASHBOARD);
      setRecentActivity(activityRes.data?.logs || []);
    } catch (e) {
      console.log('Admin dashboard error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    AsyncStorage.getItem('user').then(value => setUser(value ? JSON.parse(value) : null)).catch(() => {});
  }, [load]);

  const counts = data.counts || {};
  const roleStats = [
    ['Faculty', counts.faculty ?? 0],
    ['Students', counts.students ?? 0],
    ['Parents', counts.parents ?? 0],
    ['Admins', counts.admins ?? 0],
    ['Registrars', counts.registrars ?? 0],
    ['Staff', counts.staff ?? 0],
  ];
  const totalUsers = roleStats.reduce((total, [, value]) => total + Number(value || 0), 0);
  const circumference = 2 * Math.PI * 39;
  let chartOffset = 0;
  const chartSegments = roleStats.map(([label, value], index) => {
    const segmentLength = totalUsers ? (circumference * Number(value || 0)) / totalUsers : 0;
    const segment = { label, value, color: ROLE_COLORS[index], length: Math.max(0, segmentLength - 3), offset: chartOffset };
    chartOffset += segmentLength;
    return segment;
  }).filter(segment => Number(segment.value) > 0);
  const finance = data.finance || EMPTY_DASHBOARD.finance;

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
      contentContainerStyle={[s.content, { paddingTop: HEADER_TOP, paddingBottom: 28 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <View style={s.welcome}>
        <View style={s.welcomeCopy}>
          <Text style={[s.kicker, { color: theme.primary }]}>Welcome back</Text>
          <Text style={[s.title, { color: theme.text }]}>{user?.name || 'Admin School'}</Text>
        </View>
        <View style={[s.userInitials, { borderColor: theme.primary }]}>
          <Text style={[s.userInitialsText, { color: theme.primary }]}>{initials(user?.name)}</Text>
        </View>
      </View>

      <View style={s.chartCard}>
        <View style={s.donutWrap}>
          <Svg width={110} height={110} viewBox="0 0 100 100">
            <Circle cx="50" cy="50" r="39" fill="none" stroke="#E9C8CE" strokeWidth="11" />
            {chartSegments.map(segment => (
              <Circle
                key={segment.label}
                cx="50"
                cy="50"
                r="39"
                fill="none"
                stroke={segment.color}
                strokeWidth="11"
                strokeDasharray={`${segment.length} ${circumference - segment.length}`}
                strokeDashoffset={-segment.offset}
                rotation={-90}
                originX={50}
                originY={50}
              />
            ))}
          </Svg>
          <View pointerEvents="none" style={s.donutCenter}>
            <Text style={[s.totalValue, { color: theme.text }]}>{totalUsers}</Text>
            <Text style={[s.totalLabel, { color: theme.textSub }]}>Total users</Text>
          </View>
        </View>
        <View style={s.legend}>
          {roleStats.map(([label, value], index) => (
            <View key={label} style={s.legendRow}>
              <View style={[s.legendDot, { backgroundColor: ROLE_COLORS[index] }]} />
              <Text style={[s.legendLabel, { color: theme.text }]}>{label}</Text>
              <Text style={[s.legendValue, { color: theme.textSub }]}>{value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.financeList}>
        <FinanceTile title="Fees Paid" subtitle="Collected" value={currency(finance.collected)} theme={theme} />
        <FinanceTile title="Fees Still Due" subtitle="Outstanding" value={currency(finance.outstanding)} theme={theme} />
        <FinanceTile title="Payments to verify" subtitle="Needs review" value={finance.pending_reviews ?? 0} theme={theme} />
      </View>

      <TouchableOpacity style={[s.primaryAction, { backgroundColor: theme.primary }]} onPress={() => router.push('/(admin)/users')} activeOpacity={0.85}>
        <Text style={[s.primaryActionText, { color: theme.card }]}>Manage staff</Text>
      </TouchableOpacity>

      <View style={s.recentSection}>
        <View style={s.panelHeader}>
          <Text style={[s.panelTitle, { color: theme.text }]}>Recent activity</Text>
          <TouchableOpacity onPress={() => router.push('/(admin)/activity')}>
            <Text style={[s.panelLink, { color: theme.primary }]}>View all</Text>
          </TouchableOpacity>
        </View>
        {recentActivity.length === 0 ? (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: theme.text }]}>No activity yet</Text>
            <Text style={[s.emptySub, { color: theme.textSub }]}>Recent account and school actions will appear here.</Text>
          </View>
        ) : (
          recentActivity.map((log, index) => (
            <View key={log.id} style={[s.userRow, { borderColor: theme.border }, index === recentActivity.length - 1 && s.lastUserRow]}>
              <View style={[s.avatar, { backgroundColor: theme.primaryLight }]}>
                <Text style={[s.avatarText, { color: theme.primary }]}>{initials(log.actor_name || 'System')}</Text>
              </View>
              <View style={s.activityCopy}>
                <Text style={[s.userName, { color: theme.text }]} numberOfLines={2}>{log.description || labelFor(log.action)}</Text>
                <Text style={[s.userMeta, { color: theme.textSub }]} numberOfLines={1}>{log.actor_name || 'System'} · {timeAgo(log.created_at)}</Text>
              </View>
              <View style={[s.roleBadge, { borderColor: theme.border }]}>
                <Text style={[s.roleText, { color: theme.textSub }]} numberOfLines={1}>{labelFor(log.action)}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function initials(name) {
  if (!name) return 'AD';
  return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

function labelFor(action) {
  if (!action) return 'Activity';
  return action.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function timeAgo(value) {
  if (!value) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

function currency(value) {
  const amount = Number(value || 0);
  return `₱ ${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
}

function FinanceTile({ title, subtitle, value, theme }) {
  return (
    <View style={s.financeTile}>
      <View style={s.financeCopy}>
        <Text style={[s.financeTitle, { color: theme.textSub }]}>{title}</Text>
        <Text style={[s.financeSubtitle, { color: theme.primary }]}>{subtitle}</Text>
      </View>
      <Text style={[s.financeValue, { color: theme.primary }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { paddingHorizontal: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },
  welcome: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  welcomeCopy: { flex: 1 },
  kicker: { fontSize: 10, fontWeight: '500' },
  title: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  userInitials: { width: 31, height: 31, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  userInitialsText: { fontSize: 10, fontWeight: '600' },
  chartCard: { minHeight: 138, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0D2D9', borderWidth: 1, borderColor: '#E7BDC6' },
  donutWrap: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  totalValue: { fontSize: 24, lineHeight: 27, fontWeight: '700' },
  totalLabel: { fontSize: 8, marginTop: 1 },
  legend: { flex: 1, marginLeft: 8, gap: 5 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendLabel: { flex: 1, fontSize: 10 },
  legendValue: { minWidth: 18, textAlign: 'right', fontSize: 10 },
  financeList: { gap: 7, marginTop: 15 },
  financeTile: { minHeight: 49, borderRadius: 15, paddingHorizontal: 15, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: '#F4DDE2', borderWidth: 1, borderColor: '#EAC8CF' },
  financeCopy: { flex: 1 },
  financeTitle: { fontSize: 10 },
  financeSubtitle: { fontSize: 9, marginTop: 1 },
  financeValue: { fontSize: 16, fontWeight: '600', maxWidth: '54%', textAlign: 'right' },
  primaryAction: { marginTop: 16, borderRadius: 9, minHeight: 36, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  secondaryAction: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  secondaryActionText: { color: '#334155', fontSize: 14, fontWeight: '800' },
  recentSection: { marginTop: 2 },
  panelHeader: { marginTop: 16, marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { fontSize: 13, fontWeight: '700' },
  panelLink: { fontSize: 11, fontWeight: '600' },
  userRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  lastUserRow: { borderBottomWidth: 0 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 11, fontWeight: '600' },
  activityCopy: { flex: 1 },
  userName: { fontSize: 12, fontWeight: '600' },
  userMeta: { fontSize: 10, marginTop: 2 },
  roleBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3, maxWidth: 78 },
  roleText: { fontSize: 8 },
  empty: { paddingVertical: 24, alignItems: 'center' },
  emptyTitle: { color: '#111827', fontSize: 13, fontWeight: '700' },
  emptySub: { color: '#64748B', fontSize: 11, marginTop: 5, textAlign: 'center' },
});
