// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

export default function ChairGrades() {
  const { theme } = useTheme();
  const [view, setView] = useState('sheets');
  const [submissions, setSubmissions] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [action, setAction] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/academic-leadership/grades');
      setSubmissions(data?.submissions || []);
      setChangeRequests(data?.change_requests || []);
    } catch (error) {
      Alert.alert('Could not load grade approvals', error.response?.data?.message || 'Please refresh and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startAction = (type, item, decision) => {
    if (decision === 'approve') {
      submitAction({ type, item, decision }, '');
      return;
    }
    setNote('');
    setAction({ type, item, decision });
  };

  const submitAction = async (review = action, reviewNote = note.trim()) => {
    if (!review) return;
    if (review.decision !== 'approve' && !reviewNote) {
      Alert.alert('Note required', 'Add a note explaining this decision.');
      return;
    }

    setSaving(true);
    try {
      const endpoint = review.type === 'submission'
        ? `/academic-leadership/grades/${review.item.id}/review`
        : `/academic-leadership/grade-change-requests/${review.item.id}/review`;
      const { data } = await api.post(endpoint, { decision: review.decision, note: reviewNote || null });
      setAction(null);
      await load();
      Alert.alert('Review saved', data?.message || 'Your decision has been recorded.');
    } catch (error) {
      const errors = error.response?.data?.errors;
      Alert.alert('Could not save review', errors ? Object.values(errors).flat().join('\n') : error.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const quarterLabel = item => item?.class?.is_college
    ? ({ 1: 'Prelim', 2: 'Midterm', 3: 'Prefinal', 4: 'Final' }[Number(item.quarter)] || `Quarter ${item.quarter}`)
    : `Q${item?.quarter || '?'}`;

  const renderCard = (item, type) => {
    const isSubmission = type === 'submission';
    const classInfo = item.class || {};
    const title = [classInfo.subject || 'Class', classInfo.section].filter(Boolean).join(' · ');
    const details = [item.teacher?.name || 'Teacher unavailable', quarterLabel(item), item.school_year].filter(Boolean).join(' · ');
    const entries = isSubmission ? (item.grades || []) : (item.changes || []);

    return <View key={`${type}-${item.id}`} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={s.cardHeading}>
        <View style={{ flex: 1 }}>
          <Text style={[s.cardTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[s.meta, { color: theme.textSub }]}>{details}</Text>
        </View>
        {isSubmission && item.status === 'registrar_returned' && <Text style={[s.badge, { color: theme.warning, backgroundColor: theme.warningLight }]}>Registrar returned</Text>}
      </View>
      {!isSubmission && <Text style={[s.reason, { color: theme.textSub }]}><Text style={{ color: theme.text, fontWeight: '800' }}>Teacher’s reason: </Text>{item.reason || 'No reason provided'}</Text>}
      {entries.slice(0, 5).map((entry, index) => <View key={`${item.id}-${entry.student_id || index}`} style={[s.gradeRow, { borderTopColor: theme.border }]}>
        <Text style={[s.student, { color: theme.text }]} numberOfLines={1}>{entry.student_name || entry.student_code || `Student ${index + 1}`}</Text>
        <Text style={[s.score, { color: theme.primary }]}>{isSubmission ? entry.score ?? '—' : `${entry.old_score ?? '—'} → ${entry.new_score ?? '—'}`}</Text>
      </View>)}
      {entries.length > 5 && <Text style={[s.meta, { color: theme.textSub }]}>{entries.length - 5} more student records</Text>}
      <View style={s.actions}>
        <TouchableOpacity style={[s.returnButton, { borderColor: theme.danger }]} onPress={() => startAction(type, item, isSubmission ? 'return' : 'reject')}>
          <Text style={[s.returnText, { color: theme.danger }]}>{isSubmission ? 'Return' : 'Reject'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.approveButton, { backgroundColor: theme.success }]} onPress={() => startAction(type, item, 'approve')}>
          <Text style={s.approveText}>{isSubmission ? 'Approve' : 'Approve request'}</Text>
        </TouchableOpacity>
      </View>
    </View>;
  };

  const items = view === 'sheets' ? submissions : changeRequests;

  if (loading) return <View style={[s.loading, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color={theme.primary} /></View>;

  return <View style={[s.screen, { backgroundColor: theme.bg }]}>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <Text style={[s.title, { color: theme.text }]}>Grade approvals</Text>
      <Text style={[s.subtitle, { color: theme.textSub }]}>Review grade sheets and grade-change requests for your department.</Text>
      <View style={[s.switcher, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {[['sheets', 'Grade sheets', submissions.length], ['changes', 'Change requests', changeRequests.length]].map(([key, label, count]) => <TouchableOpacity key={key} style={[s.switchButton, view === key && { backgroundColor: theme.primary }]} onPress={() => setView(key)}>
          <Text style={[s.switchText, { color: view === key ? '#fff' : theme.textSub }]}>{label} ({count})</Text>
        </TouchableOpacity>)}
      </View>
      {items.length ? items.map(item => renderCard(item, view === 'sheets' ? 'submission' : 'change')) : <View style={[s.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="checkmark-circle-outline" size={30} color={theme.success} />
        <Text style={[s.emptyTitle, { color: theme.text }]}>Nothing awaiting review</Text>
        <Text style={[s.meta, { color: theme.textSub }]}>{view === 'sheets' ? 'Submitted grade sheets will appear here.' : 'Grade-change requests will appear here.'}</Text>
      </View>}
    </ScrollView>

    <Modal visible={!!action} transparent animationType="fade" onRequestClose={() => !saving && setAction(null)}>
      <View style={s.modalOverlay}><View style={[s.modalCard, { backgroundColor: theme.card }]}>
        <Text style={[s.modalTitle, { color: theme.text }]}>{action?.decision === 'return' ? 'Return grade sheet' : 'Reject grade-change request'}</Text>
        <Text style={[s.meta, { color: theme.textSub }]}>Add a note explaining what the teacher should address.</Text>
        <TextInput value={note} onChangeText={setNote} multiline textAlignVertical="top" placeholder="Review note" placeholderTextColor={theme.textMuted} style={[s.noteInput, { color: theme.text, borderColor: theme.border }]} />
        <View style={s.actions}>
          <TouchableOpacity style={[s.returnButton, { borderColor: theme.border }]} onPress={() => setAction(null)} disabled={saving}><Text style={[s.returnText, { color: theme.textSub }]}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={[s.approveButton, { backgroundColor: theme.danger }]} onPress={() => submitAction()} disabled={saving || !note.trim()}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.approveText}>Submit decision</Text>}
          </TouchableOpacity>
        </View>
      </View></View>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 16, paddingTop: 28, paddingBottom: 110 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '900' }, subtitle: { fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 14 },
  switcher: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 4, marginBottom: 14, gap: 4 }, switchButton: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 9, paddingHorizontal: 4 }, switchText: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  card: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 }, cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }, cardTitle: { fontSize: 13, fontWeight: '900' }, meta: { fontSize: 10, lineHeight: 15, marginTop: 3 }, badge: { fontSize: 9, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9 }, reason: { fontSize: 11, lineHeight: 17, marginBottom: 7 }, gradeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 34, borderTopWidth: StyleSheet.hairlineWidth }, student: { flex: 1, fontSize: 10, fontWeight: '700', paddingRight: 8 }, score: { fontSize: 11, fontWeight: '900' }, actions: { flexDirection: 'row', gap: 8, marginTop: 10 }, returnButton: { flex: 1, minHeight: 39, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, returnText: { fontSize: 11, fontWeight: '800' }, approveButton: { flex: 1, minHeight: 39, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }, approveText: { color: '#fff', fontSize: 11, fontWeight: '900', textAlign: 'center' }, emptyCard: { minHeight: 180, borderWidth: 1, borderRadius: 14, padding: 20, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { fontSize: 14, fontWeight: '900', marginTop: 8 }, modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(20,12,14,0.45)', padding: 20 }, modalCard: { borderRadius: 16, padding: 16 }, modalTitle: { fontSize: 16, fontWeight: '900', marginBottom: 4 }, noteInput: { minHeight: 90, borderWidth: 1, borderRadius: 11, padding: 11, marginTop: 12, fontSize: 12 },
});
