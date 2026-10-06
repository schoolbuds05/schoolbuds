// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import api from '../../src/api';
import HeaderGradient from '../components/ui/HeaderGradient';

const C = {
  bg: '#F4F6F9', card: '#FFFFFF', border: '#E5E7EB',
  text: '#111827', sub: '#64748B', blue: '#378ADD',
  green: '#1D9E75', red: '#DC2626', yellow: '#BA7517',
};

export default function SubjectRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const params = filter === 'all' ? {} : { status: filter };
      const res = await api.get('/registrar/subject-change-requests', { params });
      setRequests(res.data || []);
    } catch (e) {
      Alert.alert('Could not load requests', e.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const openReview = (request, nextAction) => {
    setSelected(request);
    setAction(nextAction);
    setRemarks('');
  };

  const submitReview = async () => {
    if (!selected) return;
    if (action === 'reject' && !remarks.trim()) {
      Alert.alert('Remarks required', 'Please explain why the request is rejected.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/registrar/subject-change-requests/${selected.id}/${action}`, {
        registrar_remarks: remarks.trim() || null,
      });
      setSelected(null);
      await fetchRequests();
      Alert.alert('Request reviewed', `The subject request was ${action}d.`);
    } catch (e) {
      Alert.alert('Could not review request', e.response?.data?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.container}>
      <HeaderGradient
        title="Subject Requests"
        subtitle="Approve or reject student add/drop requests"
        initials="SR"
        stats={[
          { label: 'Visible', value: requests.length, accent: '#FDE68A' },
          { label: 'Pending', value: requests.filter(req => req.status === 'pending').length, accent: '#A7F3D0' },
        ]}
      />

      <View style={s.filters}>
        {['pending', 'approved', 'rejected', 'all'].map(item => (
          <TouchableOpacity key={item} style={[s.filter, filter === item && s.filterActive]} onPress={() => setFilter(item)}>
            <Text style={[s.filterText, filter === item && s.filterTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.blue} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} />}
        >
          {requests.length ? requests.map(req => (
            <View key={req.id} style={s.card}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>{req.action?.toUpperCase()} {req.subject?.code}</Text>
                  <Text style={s.meta}>{req.subject?.name}</Text>
                  <Text style={s.meta}>{req.section?.name || 'Direct enrollment'}</Text>
                </View>
                <Text style={[s.status, statusStyle(req.status)]}>{req.status}</Text>
              </View>
              <Text style={s.student}>{req.student?.name} | {req.student?.email}</Text>
              <Text style={s.reason}>Reason: {req.reason}</Text>
              {req.registrar_remarks ? <Text style={s.reason}>Registrar: {req.registrar_remarks}</Text> : null}
              {req.status === 'pending' ? (
                <View style={s.actions}>
                  <TouchableOpacity style={s.approveBtn} onPress={() => openReview(req, 'approve')}>
                    <Text style={s.actionText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.rejectBtn} onPress={() => openReview(req, 'reject')}>
                    <Text style={s.actionText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )) : (
            <Text style={s.empty}>No subject requests found.</Text>
          )}
        </ScrollView>
      )}

      <Modal visible={!!selected} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>{action === 'approve' ? 'Approve request' : 'Reject request'}</Text>
            <Text style={s.meta}>{selected?.student?.name} requested to {selected?.action} {selected?.subject?.code}.</Text>
            <TextInput
              style={s.input}
              value={remarks}
              onChangeText={setRemarks}
              placeholder={action === 'approve' ? 'Optional registrar remarks' : 'Reason for rejection'}
              placeholderTextColor="#94A3B8"
              multiline
            />
            <View style={s.actions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setSelected(null)} disabled={submitting}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={action === 'approve' ? s.approveBtn : s.rejectBtn} onPress={submitReview} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.actionText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function statusStyle(status) {
  if (status === 'approved') return { color: C.green, backgroundColor: '#DCFCE7' };
  if (status === 'rejected') return { color: C.red, backgroundColor: '#FEE2E2' };
  return { color: C.yellow, backgroundColor: '#FEF3C7' };
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: C.card },
  filter: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: C.bg },
  filterActive: { backgroundColor: '#E6F1FB' },
  filterText: { color: C.sub, fontWeight: '800', textTransform: 'capitalize' },
  filterTextActive: { color: C.blue },
  body: { padding: 12, gap: 10, paddingBottom: 28 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { color: C.text, fontWeight: '900', fontSize: 15 },
  meta: { color: C.sub, fontSize: 12, marginTop: 2 },
  student: { color: C.text, fontSize: 12, fontWeight: '800' },
  reason: { color: C.sub, fontSize: 12, lineHeight: 18 },
  status: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: '900', textTransform: 'capitalize' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  approveBtn: { flex: 1, backgroundColor: C.green, borderRadius: 10, padding: 12, alignItems: 'center' },
  rejectBtn: { flex: 1, backgroundColor: C.red, borderRadius: 10, padding: 12, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '900' },
  empty: { color: C.sub, textAlign: 'center', paddingVertical: 40 },
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.5)', padding: 18 },
  modal: { backgroundColor: C.card, borderRadius: 14, padding: 16 },
  modalTitle: { color: C.text, fontSize: 17, fontWeight: '900', marginBottom: 6 },
  input: { minHeight: 96, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, marginTop: 12, textAlignVertical: 'top', color: C.text },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  cancelText: { color: C.sub, fontWeight: '900' },
});
