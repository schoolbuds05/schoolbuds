// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme-context';
import api from '../../src/api';

const BRAND = '#B51F3B';
const BORDER = '#F0E8E3';

export default function RegistrarDashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [enrollments, setEnrollments] = useState([]);
  const [studentsCount, setStudentsCount] = useState(0);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [enrollmentsResponse, studentsResponse] = await Promise.all([
        api.get('/registrar/enrollments'),
        api.get('/registrar/students'),
      ]);
      const enrollmentRows = Array.isArray(enrollmentsResponse.data)
        ? enrollmentsResponse.data
        : enrollmentsResponse.data?.data ?? [];
      const studentRows = Array.isArray(studentsResponse.data)
        ? studentsResponse.data
        : studentsResponse.data?.data ?? [];

      setEnrollments(enrollmentRows);
      setStudentsCount(studentRows.length);
      setError('');
    } catch (loadError) {
      console.log('Registrar dashboard error:', loadError.response?.data ?? loadError.message);
      setError(
        loadError.response?.data?.message
        || (loadError.request
          ? 'Could not connect to the server. Check your connection and try again.'
          : 'Could not load the Registrar dashboard. Please try again.')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('user')
      .then((value) => {
        const user = value ? JSON.parse(value) : null;
        setFullName(user?.name?.trim() ?? '');
      })
      .catch(() => setFullName(''));
    void load();
  }, [load]);

  const pendingCount = enrollments.filter((item) => item.status === 'pending').length;
  const approvedCount = enrollments.filter((item) => item.status === 'approved').length;
  const name = fullName.split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const initials = fullName
    ? fullName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    : 'RG';

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: 14 + insets.top }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={BRAND}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.greeting}>{greeting}{name ? `, ${name}` : ''}</Text>
          <Text style={styles.title}>Registrar</Text>
        </View>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => router.navigate('/(registrar)/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          activeOpacity={0.8}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </TouchableOpacity>
      </View>

      {pendingCount > 0 ? (
        <View style={styles.attentionCard}>
          <Text style={styles.attentionEyebrow}>Needs your attention</Text>
          <Text style={styles.attentionTitle}>
            {pendingCount} {pendingCount === 1 ? 'application' : 'applications'} waiting
          </Text>
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={() => router.navigate('/(registrar)/enrollments')}
            activeOpacity={0.8}
          >
            <Text style={styles.reviewButtonText}>Review now</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.attentionCard, styles.attentionCardQuiet]}>
          <Text style={styles.attentionEyebrow}>You’re all caught up</Text>
          <Text style={styles.attentionTitle}>No applications waiting</Text>
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={() => router.navigate('/(registrar)/enrollments')}
            activeOpacity={0.8}
          >
            <Text style={styles.reviewButtonText}>View enrollments</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.statsCard}>
        <Stat label="Pending" value={pendingCount} />
        <View style={styles.statDivider} />
        <Stat label="Approved" value={approvedCount} />
        <View style={styles.statDivider} />
        <Stat label="Students" value={studentsCount} />
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          <TouchableOpacity onPress={() => void load()} activeOpacity={0.75}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <QuickAction
          label="Review enrollments"
          description={`${pendingCount} pending ${pendingCount === 1 ? 'application' : 'applications'}`}
          icon="reader-outline"
          onPress={() => router.navigate('/(registrar)/enrollments')}
        />
        <QuickAction
          label="Manage students"
          description={`${studentsCount} student records`}
          icon="person-outline"
          onPress={() => router.navigate('/(registrar)/students')}
        />
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ label, description, icon, onPress }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={19} color={BRAND} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{label}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#76656A" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 50 },
  headingCopy: { flex: 1 },
  greeting: { color: '#7B5B60', fontSize: 12 },
  title: { color: '#2A171B', fontSize: 24, fontWeight: '700', fontFamily: 'serif', lineHeight: 29 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  attentionCard: { backgroundColor: BRAND, borderRadius: 16, padding: 16, gap: 7, minHeight: 124 },
  attentionCardQuiet: { backgroundColor: '#8F3749' },
  attentionEyebrow: { color: '#F9DDE2', fontSize: 11, fontWeight: '700' },
  attentionTitle: { color: '#FFFFFF', fontFamily: 'serif', fontSize: 20, fontWeight: '700' },
  reviewButton: { alignSelf: 'flex-start', marginTop: 3, backgroundColor: '#F4C85B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  reviewButtonText: { color: '#4E2C14', fontSize: 11, fontWeight: '800' },
  statsCard: { minHeight: 61, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: BORDER, paddingVertical: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statValue: { color: '#2A171B', fontFamily: 'serif', fontSize: 19, fontWeight: '700' },
  statLabel: { color: '#735D62', fontSize: 10 },
  statDivider: { width: 1, height: 34, backgroundColor: '#F1E9E6' },
  actions: { gap: 10, paddingTop: 2 },
  sectionTitle: { color: '#2A171B', fontSize: 13, fontWeight: '800', marginBottom: 1 },
  actionCard: { minHeight: 58, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, paddingVertical: 9, gap: 10 },
  actionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FBE5E9', alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, gap: 2 },
  actionTitle: { color: '#21171A', fontSize: 12, fontWeight: '700' },
  actionDescription: { color: '#806F73', fontSize: 10 },
  errorCard: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 13, gap: 9 },
  errorText: { fontSize: 12, fontWeight: '600' },
  retryText: { color: BRAND, fontSize: 12, fontWeight: '800' },
});
