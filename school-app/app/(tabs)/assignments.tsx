// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
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

export default function StudentAssignments() {
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [violations, setViolations] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/assignments');
      setItems(res.data ?? []);
    } catch (e) {
      console.log('Assignments error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = async (item) => {
    try {
      const res = await api.get(`/assignments/${item.id}`);
      const assignment = { ...res.data, submission: item.submission };
      setSelected(assignment);
      setAnswerText(item.submission?.answer_text ?? '');
      const existing = {};
      (item.submission?.answers ?? []).forEach((value, index) => { existing[index] = value; });
      setAnswers(existing);
      setViolations(item.submission?.violations ?? []);
    } catch (e) {
      Alert.alert('Could not open', e.response?.data?.message || 'Please try again.');
    }
  };

  const submit = async (overrideViolations = null) => {
    if (!selected) return;
    const activeViolations = overrideViolations ?? violations;
    setSubmitting(true);
    try {
      await api.post(`/assignments/${selected.id}/submit`, {
        answer_text: selected.type === 'quiz' ? null : answerText,
        answers: selected.type === 'quiz' ? Object.keys(answers).sort().map(key => answers[key]) : null,
        violation_count: activeViolations.length,
        violations: activeViolations,
        auto_submit: selected.type === 'quiz' && activeViolations.length >= 3,
      });
      setSelected(null);
      await load();
      Alert.alert('Submitted', 'Your work has been submitted.');
    } catch (e) {
      Alert.alert('Could not submit', e.response?.data?.message || 'Please add your answer and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!selected || selected.type !== 'quiz') return undefined;

    const subscription = AppState.addEventListener('change', async (state) => {
      if (state !== 'background') return;

      const violation = {
        type: 'app_switch',
        details: { app_state: state },
        recorded_at: new Date().toISOString(),
      };
      const nextViolations = [...violations, violation];
      setViolations(nextViolations);

      try {
        await api.post(`/assignments/${selected.id}/violation`, {
          type: violation.type,
          details: violation.details,
        });
      } catch (e) {
        console.log('Quiz violation report failed:', e.message);
      }

      if (nextViolations.length >= 3) {
        Alert.alert('Quiz flagged', 'This quiz was auto-submitted for teacher review after repeated app switching.');
        await submit(nextViolations);
      } else {
        Alert.alert('Stay in quiz', `App switching is recorded during quizzes. Warning ${nextViolations.length}/3.`);
      }
    });

    return () => subscription.remove();
  }, [selected, violations]);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const submitted = items.filter(item => item.submission).length;

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <HeaderGradient
        title="Assignments"
        subtitle="Submit class work and view graded quizzes."
        initials="AS"
        stats={[
          { label: 'Open', value: items.length - submitted, accent: '#FDE68A' },
          { label: 'Done', value: submitted, accent: '#A7F3D0' },
        ]}
      />
      <ScrollView
        contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {items.length === 0 ? (
          <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[s.title, { color: theme.text }]}>No assignments yet</Text>
            <Text style={[s.sub, { color: theme.textSub }]}>Class work from your teachers will appear here.</Text>
          </View>
        ) : items.map(item => (
          <TouchableOpacity key={item.id} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => open(item)}>
            <View style={s.row}>
              <View style={[s.badge, { backgroundColor: item.submission ? '#E1F5EE' : '#FAEEDA' }]}>
                <Text style={[s.badgeText, { color: item.submission ? theme.success : theme.warning }]}>
                  {item.submission ? item.submission.status.toUpperCase() : 'OPEN'}
                </Text>
              </View>
              <Text style={[s.points, { color: theme.textSub }]}>{Number(item.points_possible).toFixed(0)} pts</Text>
            </View>
            <Text style={[s.title, { color: theme.text }]}>{item.title}</Text>
            <Text style={[s.sub, { color: theme.textSub }]}>
              {item.section_subject?.subject?.code || 'Subject'} · {item.teacher?.name || 'Teacher'} · {item.due_at ? new Date(item.due_at).toLocaleString() : 'No due date'}
            </Text>
            {item.submission?.score !== null && item.submission?.score !== undefined ? (
              <Text style={[s.score, { color: theme.success }]}>Score: {item.submission.score}/{item.points_possible}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!selected} animationType="slide">
        <View style={[s.detail, { backgroundColor: theme.bg }]}>
          <View style={[s.detailHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.modalTitle, { color: theme.text }]}>{selected?.title}</Text>
              <Text style={[s.sub, { color: theme.textSub }]}>{selected?.type} · {Number(selected?.points_possible || 0).toFixed(0)} pts</Text>
            </View>
            <TouchableOpacity style={[s.closeBtn, { backgroundColor: theme.bg }]} onPress={() => setSelected(null)}>
              <Text style={[s.closeText, { color: theme.text }]}>X</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.body}>
            {selected?.type === 'quiz' && violations.length ? (
              <View style={[s.warningCard, { borderColor: theme.warning }]}>
                <Text style={[s.warningText, { color: theme.warning }]}>Quiz warnings: {violations.length}/3</Text>
              </View>
            ) : null}
            <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[s.sub, { color: theme.textSub }]}>{selected?.instructions || 'No instructions provided.'}</Text>
            </View>

            {selected?.submission?.feedback ? (
              <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[s.title, { color: theme.text }]}>Feedback</Text>
                <Text style={[s.sub, { color: theme.textSub }]}>{selected.submission.feedback}</Text>
              </View>
            ) : null}

            {selected?.type === 'quiz' ? (
              (selected?.questions ?? []).map((question, index) => (
                <View key={index} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[s.title, { color: theme.text }]}>{index + 1}. {question.question}</Text>
                  {(question.choices ?? []).map(choice => (
                    <TouchableOpacity
                      key={choice}
                      style={[s.choice, { borderColor: answers[index] === choice ? theme.primary : theme.border, backgroundColor: answers[index] === choice ? theme.primaryLight : theme.bg }]}
                      onPress={() => setAnswers(current => ({ ...current, [index]: choice }))}
                    >
                      <Text style={[s.choiceText, { color: answers[index] === choice ? theme.primary : theme.textSub }]}>{choice}</Text>
                    </TouchableOpacity>
                  ))}
                  {(question.choices ?? []).length === 0 ? (
                    <TextInput
                      style={[s.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg }]}
                      value={answers[index] ?? ''}
                      onChangeText={value => setAnswers(current => ({ ...current, [index]: value }))}
                      placeholder="Your answer"
                      placeholderTextColor={theme.textMuted}
                    />
                  ) : null}
                </View>
              ))
            ) : (
              <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[s.title, { color: theme.text }]}>Your answer</Text>
                <TextInput
                  style={[s.input, s.textarea, { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg }]}
                  value={answerText}
                  onChangeText={setAnswerText}
                  placeholder="Write your submission here"
                  placeholderTextColor={theme.textMuted}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            )}

            <TouchableOpacity style={[s.submitBtn, { backgroundColor: theme.primary }]} onPress={submit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>{selected?.submission ? 'Resubmit' : 'Submit'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 16, gap: 12, paddingBottom: 100 },
  card: { borderWidth: 1, borderRadius: 14, padding: 15 },
  warningCard: { borderWidth: 1, borderRadius: 12, padding: 12, backgroundColor: '#FFF7ED' },
  warningText: { fontSize: 12, fontWeight: '900' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 10, fontWeight: '900' },
  points: { fontSize: 11, fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '900' },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 5, lineHeight: 18 },
  score: { fontSize: 12, fontWeight: '900', marginTop: 10 },
  detail: { flex: 1 },
  detailHeader: { paddingTop: 48, paddingBottom: 14, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '900', paddingHorizontal: 18 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  closeText: { fontSize: 13, fontWeight: '900' },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 46, paddingHorizontal: 12, fontSize: 14, marginTop: 12 },
  textarea: { minHeight: 140, paddingTop: 12 },
  choice: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  choiceText: { fontSize: 13, fontWeight: '800' },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
