// @ts-nocheck
// app/(tabs)/today.tsx — Student dashboard (fully polished)

import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl, TouchableOpacity,
  Image, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../src/api';
import { Colors, Font, Radius, Shadow, HEADER_TOP } from '../../src/theme';
import { useTheme } from '../../src/theme-context';

function gradeColor(score, theme, isCollege) {
  if (isCollege) {
    if (score <= 2) return theme.success;
    if (score <= 3) return theme.primary;
    if (score <= 4) return theme.warning;
    return theme.danger;
  }
  if (score >= 90) return theme.success;
  if (score >= 80) return theme.primary;
  if (score >= 75) return theme.warning;
  return theme.danger;
}

export default function Today() {
  const router = useRouter();
  const { theme } = useTheme();
  const [data, setData]             = useState(null);
  const [notifications, setNotifications] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [enrollmentSettings, setEnrollmentSettings] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const openNotification = useCallback((notification) => {
    setSelectedNotification(notification);

    if (notification?.read_at) return;

    const readAt = new Date().toISOString();
    setNotifications(current => {
      if (!current?.notifications) return current;

      return {
        ...current,
        unread_count: Math.max(0, (current.unread_count ?? 0) - 1),
        notifications: current.notifications.map(item =>
          item.id === notification.id ? { ...item, read_at: readAt } : item
        ),
      };
    });

    api.post(`/notifications/${notification.id}/read`).catch(e => {
      console.log('Mark notification read error:', e.message);
    });
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashboardRes, notificationsRes, meRes, enrollmentRes] = await Promise.all([
        api.get('/dashboard/student'),
        api.get('/notifications'),
        api.get('/me'),
        api.get('/enrollment/settings').catch(() => ({ data: null })),
      ]);
      setData(dashboardRes.data);
      setNotifications(notificationsRes.data);
      setUser(meRes.data?.user || meRes.data);
      setEnrollmentSettings(enrollmentRes.data);
    } catch (e) {
      console.log('Dashboard error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.multiGet(['role', 'position']).then(pairs => {
      const role = pairs[0][1];
      const position = pairs[1][1];
      if (['head_department', 'dean'].includes(position) || ['head_department', 'dean'].includes(role)) {
        router.replace('/(leadership)/dashboard');
      } else if (['faculty', 'teacher', 'head_teacher'].includes(role)) {
        router.replace('/(teacher)/classes');
      } else if (role === 'parent') {
        router.replace('/(parent)/dashboard');
      } else if (['staff', 'librarian', 'property_custodian'].includes(role)) {
        router.replace('/(staff)/dashboard');
      } else {
        fetchDashboard();
      }
    });
  }, []);

  if (loading) return (
    <View style={[styles.center, { backgroundColor: theme.bg }]}>
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );

  const student   = data?.student;
  const allGrades = data?.grades ? Object.values(data.grades).flat() : [];
  const gwa = allGrades.length > 0
    ? (allGrades.reduce((s, g) => s + parseFloat(g.score), 0) / allGrades.length).toFixed(1)
    : '—';
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const recentNotifications = notifications?.notifications?.slice(0, 3) ?? [];
  const unreadCount = notifications?.unread_count ?? 0;
  const rewardSummary = data?.reward_summary ?? {};
  const redeemablePoints = rewardSummary.redeemable_points ?? rewardSummary.points ?? 0;
  const enrollmentApplication = data?.enrollment_application;
  const activeTerm = enrollmentSettings?.term;
  const applicationForActiveTerm = activeTerm
    && enrollmentApplication?.school_year === activeTerm.school_year
    && enrollmentApplication?.semester?.toLowerCase() === activeTerm.semester?.toLowerCase();
  const applicationAlreadySubmitted = applicationForActiveTerm
    && ['pending', 'approved'].includes(enrollmentApplication?.status);
  const enrollment = student?.enrollment;
  const yearLevelLabel = (value) => {
    const year = String(value || '').replace(/[^0-9]/g, '');
    return year ? `${year}${year === '1' ? 'st' : year === '2' ? 'nd' : year === '3' ? 'rd' : 'th'} Year` : null;
  };
  const levelLabel = enrollment?.program_type === 'college'
    ? yearLevelLabel(enrollment.year_level || student?.grade_level)
    : student?.grade_level
      ? `Grade ${student.grade_level}`
      : null;
  const sectionLabel = [
    levelLabel,
    student?.section && student.section !== 'TBA' ? student.section : 'No section',
    student?.school_year,
  ].filter(Boolean).join(' - ');

  if (!student) {
    const displayName = user?.name || data?.user?.name || 'Student';
    const hasApplication = !!enrollmentApplication;
    const status = enrollmentApplication?.status || 'pending';
    const statusLabel = status === 'approved'
      ? 'Enrollment approved'
      : status === 'rejected'
        ? 'Enrollment rejected'
        : 'Enrollment pending';
    const statusText = status === 'approved'
      ? 'Your application has been approved. Your student dashboard will update once your student record is ready.'
      : status === 'rejected'
        ? (enrollmentApplication?.remarks || 'Your application was not approved. You may review your status and submit again if needed.')
        : 'Your application has been submitted and is waiting for registrar review.';

    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.bg }]}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchDashboard(); }} />
        }
      >
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{greeting}</Text>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.section}>Account registered</Text>
            </View>
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => router.push('/(tabs)/profile')}
              accessibilityLabel="Open profile"
            >
              {user?.profile_photo_url ? (
                <Image source={{ uri: user.profile_photo_url }} style={styles.profileImage} />
              ) : (
                <Text style={styles.profileInitials}>
                  {displayName.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'ME'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.emptyStateCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
            {hasApplication ? statusLabel : 'No enrollment yet'}
          </Text>
          <Text style={[styles.emptyStateText, { color: theme.textSub }]}>
            {hasApplication
              ? statusText
              : 'Your account is active. When you are ready to apply for enrollment, start the form here.'}
          </Text>
          {hasApplication ? (
            <View style={[styles.enrollmentSummary, { borderColor: theme.border, backgroundColor: theme.bg }]}>
              <Text style={[styles.enrollmentSummaryText, { color: theme.text }]}>
                {enrollmentApplication.program_type === 'college'
                  ? enrollmentApplication.course
                  : enrollmentApplication.strand}
              </Text>
              <Text style={[styles.enrollmentSummaryMeta, { color: theme.textSub }]}>
                {enrollmentApplication.semester?.toUpperCase()} Semester - A.Y. {enrollmentApplication.school_year}
              </Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.emptyStateAction, { backgroundColor: theme.primary }]}
            onPress={() => router.push(hasApplication ? '/enrollment-status' : '/enrollment')}
          >
            <Text style={styles.emptyStateActionText}>
              {hasApplication ? 'View Status' : 'Start Enrollment'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Notifications</Text>
              {unreadCount > 0 ? (
                <Text style={[styles.notificationMeta, { color: theme.primary }]}>{unreadCount} unread</Text>
              ) : null}
            </View>
          </View>
          {recentNotifications.length > 0 ? (
            recentNotifications.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.notificationRow, { borderColor: theme.border }]}
                activeOpacity={0.75}
                onPress={() => openNotification(item)}
              >
                <View style={[styles.notificationDot, { backgroundColor: item.read_at ? theme.textMuted : theme.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notificationTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.notificationBody, { color: theme.textSub }]}>{item.body || item.type}</Text>
                  <Text style={[styles.notificationDate, { color: theme.textMuted }]}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={[styles.empty, { color: theme.textMuted }]}>No notifications yet.</Text>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={
        <RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchDashboard(); }} />
      }
    >
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}> 
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86}>
              {student?.first_name} {student?.last_name}
            </Text>
            <Text style={styles.section} numberOfLines={1}>
              {sectionLabel}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => router.push('/(tabs)/profile')}
            accessibilityLabel="Open profile"
          >
            {user?.profile_photo_url ? (
              <Image source={{ uri: user.profile_photo_url }} style={styles.profileImage} />
            ) : (
              <Text style={styles.profileInitials}>
                {`${student?.first_name?.[0] || ''}${student?.last_name?.[0] || ''}` || 'ME'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {enrollmentSettings?.enrollment_open && activeTerm ? (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Enrollment is open</Text>
          <Text style={[styles.emptyStateText, { color: theme.textSub, marginTop: 6 }]}>
            {activeTerm.semester?.toUpperCase()} Semester - A.Y. {activeTerm.school_year}
          </Text>
          <TouchableOpacity
            style={[styles.emptyStateAction, { backgroundColor: theme.primary, marginTop: 12 }]}
            onPress={() => router.push(applicationAlreadySubmitted ? '/enrollment-status' : '/enrollment')}
          >
            <Text style={styles.emptyStateActionText}>
              {applicationAlreadySubmitted ? 'View Application' : 'Enroll for This Term'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Stat cards ── */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statVal, { color: theme.text }]}>{data?.attendance_pct ?? 0}%</Text>
          <Text style={[styles.statLabel, { color: theme.textSub }]}>Attendance</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statVal, { color: theme.text }]}>{gwa}</Text>
          <Text style={[styles.statLabel, { color: theme.textSub }]}>GWA</Text>
        </View>
        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: theme.card }]}
          activeOpacity={0.75}
          onPress={() => router.push('/(tabs)/rewards')}
        >
          <Text style={[styles.statVal, { color: theme.success }]}>{redeemablePoints}</Text>
          <Text style={[styles.statLabel, { color: theme.textSub }]}>Points</Text>
        </TouchableOpacity>
        <View style={[
          styles.statCard,
          {
            backgroundColor: theme.card,
            borderBottomWidth: 3,
            borderBottomColor: (data?.pending_fees?.length ?? 0) > 0 ? theme.danger : theme.success,
          },
        ]}>
          <Text style={[styles.statVal,
            { color: (data?.pending_fees?.length ?? 0) > 0 ? theme.danger : theme.success }]}>
            {data?.pending_fees?.length ?? 0}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSub }]}>Pending fees</Text>
        </View>
      </View>

      {/* ── Outstanding fees ── */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Notifications</Text>
            {unreadCount > 0 ? (
              <Text style={[styles.notificationMeta, { color: theme.primary }]}>{unreadCount} unread</Text>
            ) : null}
          </View>
        </View>
        {recentNotifications.length > 0 ? (
          recentNotifications.map(item => {
            const opensEnrollment = item.type === 'enrollment_opened';
            return (
            <TouchableOpacity
              key={item.id}
              style={[styles.notificationRow, { borderColor: theme.border }]}
              activeOpacity={0.75}
              onPress={() => openNotification(item)}
            >
              <View style={[styles.notificationDot, { backgroundColor: item.read_at ? theme.textMuted : theme.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.notificationTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.notificationBody, { color: theme.textSub }]}>{item.body || item.type}</Text>
                <Text style={[styles.notificationDate, { color: theme.textMuted }]}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
              {opensEnrollment ? (
                <View style={[styles.notificationActionBtn, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}>
                  <Text style={[styles.notificationActionText, { color: theme.primary }]}>Open</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
          })
        ) : (
          <Text style={[styles.empty, { color: theme.textMuted }]}>No notifications yet.</Text>
        )}
      </View>

      {(data?.pending_fees?.length ?? 0) > 0 && (
        <View style={[styles.card, styles.feeCard, { backgroundColor: theme.card, borderLeftColor: theme.danger }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>⚠️ Outstanding fees</Text>
          </View>
          {data.pending_fees.map((fee, i) => (
            <View key={i} style={[styles.feeRow, { borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.feeName, { color: theme.text }]}>{fee.type}</Text>
                <Text style={[styles.feeSub, { color: theme.textMuted }]}>Q{fee.quarter} · Due {fee.due_date}</Text>
              </View>
              <View style={[styles.badge,
                { backgroundColor: fee.status === 'unpaid' ? theme.dangerLight : theme.warningLight }]}>
                <Text style={[styles.badgeText,
                  { color: fee.status === 'unpaid' ? theme.danger : theme.warning }]}>
                  ₱{Number(fee.amount).toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Latest grades ── */}
      <View style={[styles.card, { backgroundColor: theme.card }]}> 
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Latest grades (Q4)</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/grades')}>
            <Text style={[styles.seeAll, { color: theme.primary }]}>See all →</Text>
          </TouchableOpacity>
        </View>
        {data?.grades?.['4']?.length > 0
          ? data.grades['4'].map((g, i) => (
            <View key={i} style={[styles.gradeRow, { borderColor: theme.border }]}>
              <View style={[styles.gradeBar, {
                width: `${Math.max(5, Math.min(100, (g.school_class?.is_college ? ((5 - g.score) / 4) * 100 : ((g.score - 1) / 99) * 100)))}%`,
                backgroundColor: gradeColor(g.score, theme, g.school_class?.is_college),
              }]} />
              <Text style={[styles.subjectName, { color: theme.textSub }]}>{g.school_class?.subject ?? '—'}</Text>
              <Text style={[styles.gradeScore, {
                color: gradeColor(g.score, theme, g.school_class?.is_college),
              }]}>
                {g.score}
              </Text>
            </View>
          ))
          : <Text style={[styles.empty, { color: theme.textMuted }]}>No Q4 grades recorded yet.</Text>
        }
      </View>

      {/* ── Quick actions ── */}
      <View style={styles.quickRow}>
        <TouchableOpacity style={[styles.quickCard, { backgroundColor: theme.primaryLight }]}
          onPress={() => router.push('/(tabs)/study')}>
          <Text style={styles.quickIcon}>🎓</Text>
          <Text style={[styles.quickLabel, { color: theme.primary }]}>Study AI</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickCard, { backgroundColor: theme.primaryLight }]}
          onPress={() => router.push('/(tabs)/market')}>
          <Text style={styles.quickIcon}>🛍️</Text>
          <Text style={[styles.quickLabel, { color: theme.primary }]}>Marketplace</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickCard, { backgroundColor: theme.primaryLight }]}
          onPress={() => router.push('/(tabs)/grades')}>
          <Text style={styles.quickIcon}>📊</Text>
          <Text style={[styles.quickLabel, { color: theme.primary }]}>All grades</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={!!selectedNotification}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedNotification(null)}
      >
        <View style={styles.notificationModalBackdrop}>
          <View style={[styles.notificationModalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.notificationModalHeader}>
              <Text style={[styles.notificationModalTitle, { color: theme.text }]}>
                {selectedNotification?.title || 'Notification'}
              </Text>
              <TouchableOpacity
                style={[styles.notificationModalClose, { backgroundColor: theme.bg }]}
                onPress={() => setSelectedNotification(null)}
              >
                <Text style={[styles.notificationModalCloseText, { color: theme.textSub }]}>x</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.notificationModalBody, { color: theme.textSub }]}>
              {selectedNotification?.body || selectedNotification?.type || 'No notification details available.'}
            </Text>

            {selectedNotification?.created_at ? (
              <Text style={[styles.notificationModalDate, { color: theme.textMuted }]}>
                {new Date(selectedNotification.created_at).toLocaleString()}
              </Text>
            ) : null}

            {selectedNotification?.type === 'enrollment_opened' ? (
              <TouchableOpacity
                style={[styles.notificationModalAction, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setSelectedNotification(null);
                  router.push('/enrollment');
                }}
              >
                <Text style={styles.notificationModalActionText}>Open enrollment</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bg },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  // Header
  header:      {
    backgroundColor: Colors.blue,
    paddingTop: HEADER_TOP,
    paddingBottom: 36,
    paddingHorizontal: 20,
  },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerText:  { flex: 1, minWidth: 0 },
  greeting:    { color: 'rgba(255,255,255,0.8)', fontSize: Font.sm },
  name:        { color: '#fff', fontSize: Font.xl, fontWeight: '800', marginTop: 5 },
  section:     { color: 'rgba(255,255,255,0.78)', fontSize: Font.xs, marginTop: 6 },
  profileBtn:  {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  profileInitials: { color: '#fff', fontSize: 14, fontWeight: '800' },
  profileImage: { width: '100%', height: '100%', borderRadius: 23 },

  // Stats
  statsRow:    {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: -24,
    rowGap: 10,
    marginBottom: 16,
  },
  statCard:    {
    width: '48%',
    minHeight: 92,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  statVal:     { fontSize: Font.xl, fontWeight: '800', color: Colors.text },
  statLabel:   { fontSize: Font.xs, color: Colors.textSub, marginTop: 6, textAlign: 'center' },

  // Cards
  card:        {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    ...Shadow.card,
  },
  feeCard:     { borderLeftWidth: 4, borderLeftColor: Colors.danger },
  cardHeader:  {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle:   { fontSize: Font.sm, fontWeight: '600', color: Colors.text },
  seeAll:      { fontSize: Font.xs, color: Colors.blue, fontWeight: '500' },
  notificationMeta: { fontSize: Font.xs, fontWeight: '700', marginTop: 3 },
  notificationRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  notificationDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  notificationTitle: { fontSize: Font.sm, fontWeight: '700' },
  notificationBody: { fontSize: Font.xs, marginTop: 3, lineHeight: 17 },
  notificationActionBtn: {
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  notificationActionText: { fontSize: Font.xs, fontWeight: '800' },
  notificationDate: { fontSize: 10, marginTop: 5, fontWeight: '600' },
  notificationModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'center',
    padding: 22,
  },
  notificationModalCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 18,
    ...Shadow.card,
  },
  notificationModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  notificationModalTitle: {
    flex: 1,
    fontSize: Font.lg,
    fontWeight: '800',
  },
  notificationModalClose: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationModalCloseText: {
    fontSize: Font.md,
    fontWeight: '800',
    lineHeight: 20,
  },
  notificationModalBody: {
    fontSize: Font.sm,
    lineHeight: 21,
  },
  notificationModalDate: {
    fontSize: Font.xs,
    fontWeight: '700',
    marginTop: 14,
  },
  notificationModalAction: {
    borderRadius: Radius.full,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  notificationModalActionText: {
    color: '#fff',
    fontSize: Font.sm,
    fontWeight: '800',
  },

  // Fees
  feeRow:      {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  feeName:     { fontSize: Font.sm, fontWeight: '500', color: Colors.text },
  feeSub:      { fontSize: Font.xs, color: Colors.textMuted, marginTop: 2 },
  badge:       { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeRed:    { backgroundColor: Colors.dangerLight },
  badgeYellow: { backgroundColor: Colors.warningLight },
  badgeText:   { fontSize: Font.xs, fontWeight: '600' },
  badgeRedText:    { color: Colors.danger },
  badgeYellowText: { color: Colors.warning },

  // Grades
  gradeRow:    {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  gradeBar:    { height: 3, borderRadius: 2, marginBottom: 4 },
  subjectName: { fontSize: Font.sm, color: Colors.textSub, flex: 1 },
  gradeScore:  { fontSize: Font.md, fontWeight: '700' },

  // Quick actions
  quickRow:    {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  quickCard:   {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  quickIcon:   { fontSize: 24 },
  quickLabel:  { fontSize: Font.xs, fontWeight: '600' },

  empty:       { fontSize: Font.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: 16 },
  emptyStateCard: {
    marginHorizontal: 16,
    marginTop: -16,
    marginBottom: 14,
    padding: 18,
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  emptyStateTitle: {
    fontSize: Font.lg,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: Font.sm,
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyStateAction: {
    borderRadius: Radius.full,
    paddingVertical: 13,
    alignItems: 'center',
  },
  emptyStateActionText: {
    color: '#fff',
    fontSize: Font.sm,
    fontWeight: '800',
  },
  enrollmentSummary: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 16,
  },
  enrollmentSummaryText: {
    fontSize: Font.sm,
    fontWeight: '800',
  },
  enrollmentSummaryMeta: {
    fontSize: Font.xs,
    fontWeight: '600',
    marginTop: 4,
  },
});


