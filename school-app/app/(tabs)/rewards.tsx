// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import api from '../../src/api';
import { Colors, Font, Radius, Shadow, HEADER_TOP } from '../../src/theme';
import { useTheme } from '../../src/theme-context';

const CATEGORY = {
  participation: { label: 'Participation', color: '#378ADD', bg: '#E6F1FB' },
  academic: { label: 'Academic', color: '#1D9E75', bg: '#E1F5EE' },
  attendance: { label: 'Attendance', color: '#BA7517', bg: '#FAEEDA' },
  helpfulness: { label: 'Helpfulness', color: '#7C3AED', bg: '#F3E8FF' },
  conduct: { label: 'Conduct', color: '#334155', bg: '#E2E8F0' },
  donations: { label: 'Donation', color: '#1D9E75', bg: '#E1F5EE' },
  events: { label: 'Event', color: '#7C3AED', bg: '#F3E8FF' },
  early_enrollment: { label: 'Early enrollment', color: '#378ADD', bg: '#E6F1FB' },
  early_payment: { label: 'Early payment', color: '#BA7517', bg: '#FAEEDA' },
  manual_adjustment: { label: 'Verified adjustment', color: '#334155', bg: '#E2E8F0' },
  custom: { label: 'Reward', color: '#8B1A1A', bg: '#FEE2E2' },
};

export default function Rewards() {
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRewards = useCallback(async () => {
    try {
      const res = await api.get('/rewards/me');
      setData(res.data);
    } catch (e) {
      console.log('Rewards error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadRewards(); }, [loadRewards]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const summary = data?.summary || {};
  const progress = Math.min(100, ((summary.current_level_points || 0) / 100) * 100);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={{ paddingBottom: 28 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRewards(); }} />
      }
    >
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <Text style={styles.headerLabel}>Reward points</Text>
        <Text style={styles.points}>{summary.points ?? 0}</Text>
        <Text style={styles.level}>Level {summary.level ?? 1}</Text>
        <Text style={styles.value}>Value: PHP {Number(summary.peso_value || 0).toFixed(2)}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.nextText}>{summary.semester_cap_remaining ?? 200} points remaining this semester</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statVal, { color: theme.text }]}>{summary.rewards_count ?? 0}</Text>
          <Text style={[styles.statLabel, { color: theme.textSub }]}>Awards</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statVal, { color: theme.success }]}>{summary.current_level_points ?? 0}</Text>
          <Text style={[styles.statLabel, { color: theme.textSub }]}>This level</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textSub }]}>Recent rewards</Text>
      </View>

      {data?.rewards?.length ? data.rewards.map(reward => {
        const category = CATEGORY[reward.category] || CATEGORY.custom;
        return (
          <View key={reward.id} style={[styles.rewardCard, { backgroundColor: theme.card }]}>
            <View style={[styles.categoryPill, { backgroundColor: category.bg }]}>
              <Text style={[styles.categoryText, { color: category.color }]}>{category.label}</Text>
            </View>
            <View style={styles.rewardBody}>
              <Text style={[styles.rewardTitle, { color: theme.text }]}>{reward.title}</Text>
              <Text style={[styles.rewardMeta, { color: theme.textMuted }]}>
                {reward.awarded_by?.name || 'School'} · {new Date(reward.created_at).toLocaleDateString()}
              </Text>
              {reward.description ? (
                <Text style={[styles.rewardDescription, { color: theme.textSub }]}>{reward.description}</Text>
              ) : null}
            </View>
            <Text style={[styles.rewardPoints, { color: theme.success }]}>+{reward.points}</Text>
          </View>
        );
      }) : (
        <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No rewards yet</Text>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>Points from teachers will appear here.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: HEADER_TOP, paddingHorizontal: 20, paddingBottom: 24 },
  headerLabel: { color: 'rgba(255,255,255,0.78)', fontSize: Font.sm, fontWeight: '600' },
  points: { color: '#fff', fontSize: 44, fontWeight: '800', marginTop: 6 },
  level: { color: '#fff', fontSize: Font.md, fontWeight: '700', marginTop: 2 },
  value: { color: 'rgba(255,255,255,0.84)', fontSize: Font.sm, marginTop: 4 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 16, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: '#fff' },
  nextText: { color: 'rgba(255,255,255,0.78)', fontSize: Font.xs, marginTop: 8 },
  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: -16, gap: 10, marginBottom: 18 },
  statCard: { flex: 1, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', ...Shadow.card },
  statVal: { fontSize: Font.xl, fontWeight: '800' },
  statLabel: { fontSize: Font.xs, marginTop: 4 },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: Font.sm, fontWeight: '800', textTransform: 'uppercase' },
  rewardCard: { marginHorizontal: 16, marginBottom: 10, borderRadius: Radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...Shadow.card },
  categoryPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  categoryText: { fontSize: 10, fontWeight: '800' },
  rewardBody: { flex: 1 },
  rewardTitle: { fontSize: Font.sm, fontWeight: '800' },
  rewardMeta: { fontSize: Font.xs, marginTop: 3 },
  rewardDescription: { fontSize: Font.xs, marginTop: 6 },
  rewardPoints: { fontSize: Font.lg, fontWeight: '900' },
  emptyCard: { marginHorizontal: 16, borderRadius: Radius.lg, padding: 24, alignItems: 'center', ...Shadow.card },
  emptyTitle: { fontSize: Font.md, fontWeight: '800' },
  emptyText: { fontSize: Font.sm, marginTop: 6, textAlign: 'center' },
});
