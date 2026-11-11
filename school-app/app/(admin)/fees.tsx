// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme-context';
import api from '../../src/api';

const FILTERS = [
  { key: 'due', label: 'Due' },
  { key: 'pending', label: 'To verify' },
  { key: 'paid', label: 'Paid' },
  { key: 'all', label: 'All' },
];

export default function AdminFees() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [fees, setFees] = useState([]);
  const [filter, setFilter] = useState('due');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await api.get('/fees');
      setFees(Array.isArray(response.data) ? response.data : response.data?.data ?? []);
      setError('');
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Could not load fees. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const filteredFees = useMemo(() => fees.filter((fee) => {
    if (filter === 'pending') return fee.payment_verification_status === 'pending';
    if (filter === 'paid') return Number(fee.paid_amount || 0) > 0;
    if (filter === 'due') return Number(fee.amount || 0) > Number(fee.paid_amount || 0);
    return true;
  }), [fees, filter]);

  const total = useMemo(() => filteredFees.reduce((sum, fee) => {
    if (filter === 'pending') return sum + Number(fee.pending_payment_amount || 0);
    if (filter === 'paid') return sum + Number(fee.paid_amount || 0);
    return sum + Math.max(0, Number(fee.amount || 0) - Number(fee.paid_amount || 0));
  }, 0), [filteredFees, filter]);

  const reviewPayment = (fee, approved) => {
    const studentName = fee.student?.first_name
      ? `${fee.student.first_name} ${fee.student.last_name || ''}`.trim()
      : fee.student?.name || 'this student';
    Alert.alert(
      approved ? 'Verify payment' : 'Reject payment',
      `${approved ? 'Apply' : 'Reject'} the pending payment of ${currency(fee.pending_payment_amount)} for ${studentName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approved ? 'Verify' : 'Reject',
          style: approved ? 'default' : 'destructive',
          onPress: async () => {
            setReviewingId(fee.id);
            try {
              await api.post(`/fees/${fee.id}/verify-payment`, { approved });
              await load();
            } catch (reviewError) {
              Alert.alert('Could not save review', reviewError.response?.data?.message || 'Please try again.');
            } finally {
              setReviewingId(null);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return <View style={[styles.center, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: 14 + insets.top }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.kicker, { color: theme.primary }]}>ADMIN FINANCE</Text>
      <Text style={[styles.title, { color: theme.text }]}>Fees</Text>
      <Text style={[styles.subtitle, { color: theme.textSub }]}>Review balances and verify student payments.</Text>

      <View style={[styles.totalCard, { backgroundColor: theme.primary }]}>
        <Text style={styles.totalLabel}>{filter === 'pending' ? 'Payments awaiting review' : filter === 'paid' ? 'Payments recorded' : 'Outstanding balance'}</Text>
        <Text style={styles.totalValue}>{currency(total)}</Text>
        <Text style={styles.totalFoot}>{filteredFees.length} {filteredFees.length === 1 ? 'fee record' : 'fee records'}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => setFilter(item.key)}
            style={[styles.filter, { backgroundColor: filter === item.key ? theme.primary : theme.card, borderColor: filter === item.key ? theme.primary : theme.border }]}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === item.key }}
          >
            <Text style={[styles.filterText, { color: filter === item.key ? '#fff' : theme.textSub }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {error ? (
        <View style={[styles.errorCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load(); }}><Text style={[styles.retry, { color: theme.primary }]}>Retry</Text></TouchableOpacity>
        </View>
      ) : filteredFees.length ? filteredFees.map((fee) => (
        <FeeCard key={fee.id} fee={fee} theme={theme} reviewing={reviewingId === fee.id} onReview={reviewPayment} />
      )) : (
        <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="checkmark-circle-outline" size={28} color={theme.success} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Nothing to show</Text>
          <Text style={[styles.emptyText, { color: theme.textSub }]}>There are no fee records in this category.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function FeeCard({ fee, theme, reviewing, onReview }) {
  const amount = Number(fee.amount || 0);
  const paid = Number(fee.paid_amount || 0);
  const pending = fee.payment_verification_status === 'pending';
  const student = fee.student;
  const studentName = student?.first_name
    ? `${student.first_name} ${student.last_name || ''}`.trim()
    : student?.name || `Student #${fee.student_id}`;
  const status = pending ? 'Pending verification' : paid >= amount ? 'Paid' : paid > 0 ? 'Partially paid' : 'Due';
  const statusColor = pending ? theme.warning : paid >= amount ? theme.success : theme.danger;

  return (
    <View style={[styles.feeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.feeHeader}>
        <View style={styles.feeCopy}>
          <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>{studentName}</Text>
          <Text style={[styles.feeType, { color: theme.textSub }]} numberOfLines={1}>{fee.type || 'School fee'} · #{fee.id}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
        </View>
      </View>

      <View style={[styles.amountRow, { borderColor: theme.border }]}>
        <Amount label="Amount" value={currency(amount)} theme={theme} />
        <Amount label="Paid" value={currency(paid)} theme={theme} />
        <Amount label="Balance" value={currency(Math.max(0, amount - paid))} theme={theme} />
      </View>

      <Text style={[styles.details, { color: theme.textSub }]}>
        Due {fee.due_date ? formatDate(fee.due_date) : 'date not set'}{fee.school_year ? ` · ${fee.school_year}` : ''}{fee.semester ? ` · ${fee.semester}` : ''}
      </Text>
      {pending && <View style={[styles.pendingBox, { backgroundColor: theme.bg }]}>
        <Text style={[styles.pendingText, { color: theme.text }]}>Submitted: {currency(fee.pending_payment_amount)}{fee.payment_method ? ` · ${label(fee.payment_method)}` : ''}</Text>
        {fee.payment_reference ? <Text style={[styles.reference, { color: theme.textSub }]}>Reference: {fee.payment_reference}</Text> : null}
        <View style={styles.reviewActions}>
          <TouchableOpacity disabled={reviewing} style={[styles.reviewButton, { backgroundColor: theme.success }]} onPress={() => onReview(fee, true)}>
            {reviewing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.reviewButtonText}>Verify payment</Text>}
          </TouchableOpacity>
          <TouchableOpacity disabled={reviewing} style={[styles.rejectButton, { borderColor: theme.danger }]} onPress={() => onReview(fee, false)}>
            <Text style={[styles.rejectText, { color: theme.danger }]}>Reject</Text>
          </TouchableOpacity>
        </View>
      </View>}
    </View>
  );
}

function Amount({ label: title, value, theme }) {
  return <View style={styles.amountCell}><Text style={[styles.amountLabel, { color: theme.textSub }]}>{title}</Text><Text style={[styles.amountValue, { color: theme.text }]} numberOfLines={1}>{value}</Text></View>;
}

function currency(value) {
  return `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function label(value) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { fontSize: 25, fontWeight: '900', marginTop: -7 },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: -6 },
  totalCard: { borderRadius: 16, padding: 16, marginTop: 4 },
  totalLabel: { color: '#fff', fontSize: 11, fontWeight: '800', opacity: 0.9 },
  totalValue: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 5 },
  totalFoot: { color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 3, opacity: 0.85 },
  filters: { gap: 8, paddingVertical: 2 },
  filter: { borderWidth: 1, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15 },
  filterText: { fontSize: 11, fontWeight: '800' },
  feeCard: { borderWidth: 1, borderRadius: 15, padding: 13, marginTop: 2 },
  feeHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  feeCopy: { flex: 1, minWidth: 0 },
  studentName: { fontSize: 13, fontWeight: '900' },
  feeType: { fontSize: 10, fontWeight: '600', marginTop: 3 },
  statusPill: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 8 },
  statusText: { fontSize: 9, fontWeight: '800' },
  amountRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 11, marginTop: 5, gap: 5 },
  amountCell: { flex: 1, minWidth: 0 },
  amountLabel: { fontSize: 9, fontWeight: '700' },
  amountValue: { fontSize: 11, fontWeight: '900', marginTop: 3 },
  details: { fontSize: 10, fontWeight: '600', marginTop: 9 },
  pendingBox: { borderRadius: 11, padding: 10, marginTop: 10 },
  pendingText: { fontSize: 11, fontWeight: '800' },
  reference: { fontSize: 10, marginTop: 4 },
  reviewActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  reviewButton: { flex: 1, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  reviewButtonText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  rejectButton: { minWidth: 72, minHeight: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rejectText: { fontSize: 10, fontWeight: '900' },
  errorCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  errorText: { fontSize: 12, fontWeight: '700' },
  retry: { fontSize: 12, fontWeight: '900', marginTop: 10 },
  emptyCard: { borderWidth: 1, borderRadius: 15, alignItems: 'center', padding: 24, marginTop: 4 },
  emptyTitle: { fontSize: 14, fontWeight: '900', marginTop: 8 },
  emptyText: { textAlign: 'center', fontSize: 11, fontWeight: '600', marginTop: 4 },
});
