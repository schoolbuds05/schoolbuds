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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme-context';
import api from '../../src/api';
import HeaderGradient from '../components/ui/HeaderGradient';

export default function RegistrarDashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const [enrollments, setEnrollments] = useState([]);
  const [studentsCount, setStudentsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [enrollmentsResponse, studentsResponse] = await Promise.all([
        api.get('/registrar/enrollments'),
        api.get('/registrar/students'),
      ]);
      setError('');
      setEnrollments(enrollmentsResponse.data);
      setStudentsCount(studentsResponse.data.length);
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
    void Promise.resolve().then(load);
  }, [load]);

  const counts = {
    pending: enrollments.filter((item) => item.status === 'pending').length,
    approved: enrollments.filter((item) => item.status === 'approved').length,
    rejected: enrollments.filter((item) => item.status === 'rejected').length,
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      <HeaderGradient
        title="Registrar Dashboard"
        subtitle="Enrollment overview and student records"
        initials="RG"
        stats={[
          { label: 'Pending', value: counts.pending, accent: '#BA7517' },
          { label: 'Approved', value: counts.approved, accent: '#1D9E75' },
          { label: 'Students', value: studentsCount, accent: theme.primary },
        ]}
      />

      {error ? (
        <View style={[styles.errorCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          <TouchableOpacity onPress={load} activeOpacity={0.75}>
            <Text style={[styles.retryText, { color: theme.primary }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actions}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick actions</Text>
          <QuickAction
            label="Review enrollments"
            description={`${counts.pending} pending applications`}
            icon="clipboard-outline"
            theme={theme}
            onPress={() => router.navigate('/(registrar)/enrollments')}
          />
          <QuickAction
            label="Manage students"
            description={`${studentsCount} student records`}
            icon="people-outline"
            theme={theme}
            onPress={() => router.navigate('/(registrar)/students')}
          />
          <QuickAction
            label="Browse courses"
            description="Manage courses and programs"
            icon="library-outline"
            theme={theme}
            onPress={() => router.navigate('/(registrar)/courses')}
          />
        </View>
      )}
    </ScrollView>
  );
}

function QuickAction({ label, description, icon, theme, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.actionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}16` }]}>
        <Ionicons name={icon} size={22} color={theme.primary} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.actionDescription, { color: theme.textSub }]}>{description}</Text>
      </View>
      <Text style={{ color: theme.textSub, fontSize: 20 }}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  actionCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: { flex: 1, gap: 3 },
  actionTitle: { fontSize: 14, fontWeight: '700' },
  actionDescription: { fontSize: 12 },
  errorCard: { margin: 16, padding: 16, borderRadius: 12, borderWidth: 1, gap: 12 },
  errorText: { fontSize: 14, fontWeight: '600' },
  retryText: { fontSize: 14, fontWeight: '800' },
});
