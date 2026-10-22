// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

export default function Rewards() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadRewards = useCallback(async () => {
    try { const res = await api.get('/rewards/me'); setData(res.data); }
    catch (error) { console.log('Rewards error:', error.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { Promise.resolve().then(loadRewards); }, [loadRewards]);

  const summary = data?.summary || {};
  const rewards = data?.rewards ?? [];
  const badges = Array.isArray(summary.badges) ? summary.badges : [];
  const badgeCount = badges.filter(badge => badge.earned).length;
  const topInset = Math.max(insets.top, 24);
  const activity = rewards.slice(0, 8);
  if (loading) return <View style={[styles.center, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color={theme.primary} /></View>;

  return <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={[styles.content, { paddingTop: topInset + 12 }]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRewards(); }} tintColor={theme.primary} />}>
    <View style={styles.header}><TouchableOpacity style={[styles.back, { backgroundColor: theme.card }]} onPress={() => router.replace('/(tabs)/more')}><Ionicons name="chevron-back" size={22} color={theme.text} /></TouchableOpacity><View style={styles.headerCopy}><Text style={[styles.eyebrow, { color: theme.textSub }]}>Show up, pitch in, earn points</Text><Text style={[styles.title, { color: theme.text }]}>Rewards</Text></View><View style={[styles.logoWrap, { backgroundColor: theme.card }]}><Image source={require('../../assets/images/schoolbuds-favicon.png')} style={styles.logo} resizeMode="contain" /></View></View>
    <View style={[styles.pointsCard, { backgroundColor: theme.primary }]}><View style={styles.orbitOne} /><View style={styles.orbitTwo} /><View style={styles.pointsContent}><Text style={styles.level}>Level {summary.level ?? 1}</Text><Text style={styles.available}>Available points</Text><Text style={styles.points}>{Number(summary.points || 0).toLocaleString()}</Text><TouchableOpacity style={styles.redeem} onPress={() => router.push('/(tabs)/market')}><Text style={[styles.redeemText, { color: theme.primary }]}>Redeem in Marketplace</Text></TouchableOpacity></View></View>
    <View style={styles.sectionHead}><Text style={[styles.sectionTitle, { color: theme.text }]}>Badges</Text><Text style={[styles.sectionMeta, { color: theme.textSub }]}>{badgeCount} earned</Text></View>
    <View style={styles.badgeRow}>{badges.map(badge => <View key={badge.key} style={[styles.badgeCard, { backgroundColor: theme.card }, !badge.earned && styles.badgeLocked]}><View style={[styles.badgeIcon, { backgroundColor: theme.primaryLight }]}><Ionicons name={badge.icon} size={16} color={theme.primary} /></View><Text style={[styles.badgeLabel, { color: theme.text }]}>{badge.label}</Text></View>)}</View>
    <View style={styles.sectionHead}><Text style={[styles.sectionTitle, { color: theme.text }]}>Recent activity</Text></View>
    {activity.length ? <View style={[styles.activityGroup, { backgroundColor: theme.card }]}>{activity.map((reward, index) => <ActivityRow key={reward.id || index} reward={reward} isLast={index === activity.length - 1} theme={theme} />)}</View> : <View style={[styles.empty, { backgroundColor: theme.card }]}><Text style={[styles.emptyTitle, { color: theme.text }]}>No rewards yet</Text><Text style={[styles.emptyText, { color: theme.textSub }]}>Points from teachers and school activities will appear here.</Text></View>}
  </ScrollView>;
}

function ActivityRow({ reward, isLast, theme }) {
  const amount = Number(reward.points || 0);
  const positive = amount >= 0;
  const meta = reward.description || reward.awarded_by?.name || new Date(reward.created_at).toLocaleDateString();
  return <View style={[styles.activityRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}><View style={styles.activityCopy}><Text style={[styles.activityTitle, { color: theme.text }]} numberOfLines={1}>{reward.title || 'Reward'}</Text><Text style={[styles.activityMeta, { color: theme.textSub }]} numberOfLines={1}>{meta}</Text></View><Text style={[styles.activityPoints, { color: positive ? theme.success : theme.danger }]}>{positive ? '+' : ''}{amount}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { paddingHorizontal: 16, paddingBottom: 30 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 }, back: { width: 35, height: 35, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 }, headerCopy: { flex: 1 }, eyebrow: { fontSize: 10, fontWeight: '600', marginBottom: 1 }, title: { fontSize: 22, fontWeight: '800' }, logoWrap: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: .08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, logo: { width: 31, height: 31, borderRadius: 8 },
  pointsCard: { height: 166, borderRadius: 18, overflow: 'hidden' }, pointsContent: { padding: 16, zIndex: 1 }, orbitOne: { position: 'absolute', width: 142, height: 142, borderRadius: 71, borderWidth: 20, borderColor: 'rgba(255,255,255,0.09)', right: -38, top: -31 }, orbitTwo: { position: 'absolute', width: 117, height: 117, borderRadius: 59, borderWidth: 20, borderColor: 'rgba(255,255,255,0.07)', right: -26, top: -18 }, level: { alignSelf: 'flex-start', color: '#9E2F46', backgroundColor: '#FFF1BF', overflow: 'hidden', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, fontSize: 10, fontWeight: '900' }, available: { color: 'rgba(255,255,255,.84)', fontSize: 10, fontWeight: '800', marginTop: 11 }, points: { color: '#fff', fontSize: 35, fontWeight: '900', lineHeight: 40 }, redeem: { alignSelf: 'flex-start', marginTop: 8, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#fff' }, redeemText: { fontSize: 11, fontWeight: '900' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 17, marginBottom: 9 }, sectionTitle: { fontSize: 14, fontWeight: '800' }, sectionMeta: { fontSize: 10, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', gap: 8 }, badgeCard: { flex: 1, height: 88, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }, badgeLocked: { opacity: .45 }, badgeIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 7 }, badgeLabel: { fontSize: 9, fontWeight: '800', textAlign: 'center', lineHeight: 11 },
  activityGroup: { borderRadius: 14, overflow: 'hidden' }, activityRow: { minHeight: 55, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' }, activityCopy: { flex: 1, minWidth: 0 }, activityTitle: { fontSize: 12, fontWeight: '800' }, activityMeta: { fontSize: 10, fontWeight: '600', marginTop: 3 }, activityPoints: { fontSize: 13, fontWeight: '900', marginLeft: 10 }, empty: { borderRadius: 14, padding: 22, alignItems: 'center' }, emptyTitle: { fontSize: 14, fontWeight: '800' }, emptyText: { fontSize: 11, textAlign: 'center', marginTop: 5 },
});
