// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const EMPTY_FORM = {
  section_subject_id: '',
  type: 'assignment',
  title: '',
  instructions: '',
  points_possible: '100',
  due_at: '',
  questions_text: '',
  module_text: '',
};

export default function TeacherAssignments() {
  const { theme } = useTheme();
  const [classes, setClasses] = useState([]);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [gradeDrafts, setGradeDrafts] = useState({});

  const load = useCallback(async () => {
    try {
      const [classRes, assignmentRes] = await Promise.all([
        api.get('/teacher/dashboard'),
        api.get('/teacher/assignments'),
      ]);
      setClasses(classRes.data?.classes ?? []);
      setItems(assignmentRes.data ?? []);
    } catch (e) {
      console.log('Teacher assignments error:', e.message);
      Alert.alert('Could not load assignments', e.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, section_subject_id: classes[0]?.id ? String(classes[0].id) : '' });
    setShowCreate(true);
  };

  const createAssignment = async () => {
    if (!form.section_subject_id || !form.title.trim()) {
      Alert.alert('Missing details', 'Choose a class and add a title.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/teacher/assignments', {
        section_subject_id: Number(form.section_subject_id),
        type: form.type,
        title: form.title.trim(),
        instructions: form.instructions.trim(),
        points_possible: Number(form.points_possible || 100),
        due_at: form.due_at.trim() || null,
        questions: form.type === 'quiz' ? parseQuestions(form.questions_text) : null,
        status: 'published',
      });
      setShowCreate(false);
      await load();
    } catch (e) {
      Alert.alert('Could not create', e.response?.data?.message || 'Please check the details.');
    } finally {
      setSaving(false);
    }
  };

  const generateQuiz = async () => {
    if (!form.module_text.trim() && !form.instructions.trim()) {
      Alert.alert('Module text required', 'Paste module or handout text before generating a quiz.');
      return;
    }

    setGeneratingQuiz(true);
    try {
      const res = await api.post('/teacher/assignments/generate-quiz', {
        module_text: form.module_text.trim() || form.instructions.trim(),
        question_count: 10,
      });
      const questions = res.data?.questions ?? [];
      if (!questions.length) {
        Alert.alert('No questions generated', 'Try adding more module content.');
        return;
      }
      setForm(current => ({
        ...current,
        type: 'quiz',
        questions_text: questions.map(item => (
          `${item.question} | ${(item.choices ?? []).join(', ')} | ${item.answer ?? ''}`
        )).join('\n'),
      }));
      Alert.alert('Draft ready', 'Review or edit the generated questions before publishing.');
    } catch (e) {
      Alert.alert('Generation failed', e.response?.data?.message || 'Could not generate quiz questions.');
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const openDetails = async (assignment) => {
    try {
      const res = await api.get(`/assignments/${assignment.id}`);
      setSelected(res.data);
      const drafts = {};
      (res.data.submissions ?? []).forEach(submission => {
        drafts[submission.id] = {
          score: submission.score ? String(submission.score) : '',
          feedback: submission.feedback ?? '',
        };
      });
      setGradeDrafts(drafts);
    } catch (e) {
      Alert.alert('Could not open', e.response?.data?.message || 'Please try again.');
    }
  };

  const gradeSubmission = async (submission) => {
    const draft = gradeDrafts[submission.id] || {};
    if (draft.score === '') {
      Alert.alert('Score required', 'Enter a score before saving.');
      return;
    }

    try {
      const res = await api.post(`/teacher/assignments/${selected.id}/submissions/${submission.id}/grade`, {
        score: Number(draft.score),
        feedback: draft.feedback ?? '',
        sync_to_grades: true,
        quarter: '1',
      });
      setSelected(current => ({
        ...current,
        submissions: current.submissions.map(item => item.id === submission.id ? res.data : item),
      }));
      Alert.alert('Saved', 'Submission graded and synced to grades.');
    } catch (e) {
      Alert.alert('Could not grade', e.response?.data?.message || 'Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <HeaderGradient
        title="Assignments"
        subtitle="Create, review, and grade class work."
        initials="AS"
        stats={[
          { label: 'Posted', value: items.length, accent: '#C7D2FE' },
          { label: 'Classes', value: classes.length, accent: '#A7F3D0' },
        ]}
      />
      <ScrollView
        contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <TouchableOpacity style={[s.primaryBtn, { backgroundColor: theme.primary }]} onPress={openCreate}>
          <Text style={s.primaryText}>New class work</Text>
        </TouchableOpacity>

        {items.length === 0 ? (
          <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[s.title, { color: theme.text }]}>No class work yet</Text>
            <Text style={[s.sub, { color: theme.textSub }]}>Post an assignment or quiz for one of your assigned classes.</Text>
          </View>
        ) : items.map(item => (
          <TouchableOpacity key={item.id} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => openDetails(item)}>
            <View style={s.row}>
              <View style={[s.badge, { backgroundColor: item.type === 'quiz' ? '#F3E8FF' : '#E6F1FB' }]}>
                <Text style={[s.badgeText, { color: item.type === 'quiz' ? '#7C3AED' : theme.primary }]}>{item.type.toUpperCase()}</Text>
              </View>
              <Text style={[s.count, { color: theme.textSub }]}>{item.submissions_count ?? 0} submitted</Text>
            </View>
            <Text style={[s.title, { color: theme.text }]}>{item.title}</Text>
            <Text style={[s.sub, { color: theme.textSub }]}>
              {item.section_subject?.subject?.code || 'Subject'} · {item.section_subject?.section?.name || 'Section'} · {item.due_at ? new Date(item.due_at).toLocaleString() : 'No due date'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={s.modalBackdrop}>
          <View style={[s.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[s.modalTitle, { color: theme.text }]}>New class work</Text>
            <ScrollView contentContainerStyle={s.form}>
              <Text style={[s.label, { color: theme.textSub }]}>Class</Text>
              <View style={s.choiceWrap}>
                {classes.map(cls => (
                  <TouchableOpacity
                    key={cls.id}
                    style={[s.choice, form.section_subject_id === String(cls.id) && { borderColor: theme.primary, backgroundColor: theme.primaryLight }]}
                    onPress={() => setForm(current => ({ ...current, section_subject_id: String(cls.id) }))}
                  >
                    <Text style={[s.choiceText, { color: form.section_subject_id === String(cls.id) ? theme.primary : theme.textSub }]}>{cls.subject}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[s.label, { color: theme.textSub }]}>Type</Text>
              <View style={s.choiceWrap}>
                {['assignment', 'quiz'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[s.choice, form.type === type && { borderColor: theme.primary, backgroundColor: theme.primaryLight }]}
                    onPress={() => setForm(current => ({ ...current, type }))}
                  >
                    <Text style={[s.choiceText, { color: form.type === type ? theme.primary : theme.textSub }]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Field label="Title" value={form.title} onChangeText={value => setForm(current => ({ ...current, title: value }))} theme={theme} />
              <Field label="Instructions" value={form.instructions} onChangeText={value => setForm(current => ({ ...current, instructions: value }))} theme={theme} multiline />
              <Field label="Points" value={form.points_possible} onChangeText={value => setForm(current => ({ ...current, points_possible: value }))} theme={theme} keyboardType="numeric" />
              <Field label="Due date (YYYY-MM-DD HH:mm)" value={form.due_at} onChangeText={value => setForm(current => ({ ...current, due_at: value }))} theme={theme} />

              {form.type === 'quiz' && (
                <>
                  <Field
                    label="Module text for AI quiz"
                    value={form.module_text}
                    onChangeText={value => setForm(current => ({ ...current, module_text: value }))}
                    theme={theme}
                    multiline
                    placeholder="Paste module, handout, or lesson notes here"
                  />
                  <TouchableOpacity style={[s.aiBtn, { borderColor: theme.primary }]} onPress={generateQuiz} disabled={generatingQuiz}>
                    {generatingQuiz ? <ActivityIndicator color={theme.primary} /> : <Text style={[s.aiText, { color: theme.primary }]}>Generate AI quiz draft</Text>}
                  </TouchableOpacity>
                  <Field
                    label="Quiz questions"
                    value={form.questions_text}
                    onChangeText={value => setForm(current => ({ ...current, questions_text: value }))}
                    theme={theme}
                    multiline
                    placeholder="One per line: Question | choice A, choice B | correct answer"
                  />
                </>
              )}

              <View style={s.modalActions}>
                <TouchableOpacity style={[s.secondaryBtn, { borderColor: theme.border }]} onPress={() => setShowCreate(false)} disabled={saving}>
                  <Text style={[s.secondaryText, { color: theme.textSub }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.primary }]} onPress={createAssignment} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Publish</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selected} animationType="slide">
        <View style={[s.detail, { backgroundColor: theme.bg }]}>
          <View style={[s.detailHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.modalTitle, { color: theme.text }]}>{selected?.title}</Text>
              <Text style={[s.sub, { color: theme.textSub }]}>{selected?.submissions?.length ?? 0} submissions</Text>
            </View>
            <TouchableOpacity onPress={() => setSelected(null)} style={[s.closeBtn, { backgroundColor: theme.bg }]}>
              <Text style={[s.closeText, { color: theme.text }]}>X</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.body}>
            {(selected?.submissions ?? []).length === 0 ? (
              <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[s.title, { color: theme.text }]}>No submissions yet</Text>
              </View>
            ) : selected.submissions.map(submission => (
              <View key={submission.id} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[s.title, { color: theme.text }]}>{submission.student?.first_name} {submission.student?.last_name}</Text>
                <Text style={[s.sub, { color: theme.textSub }]}>{submission.answer_text || 'Quiz answers submitted.'}</Text>
                {submission.plagiarism_score !== null && submission.plagiarism_score !== undefined ? (
                  <Text style={[s.warning, { color: Number(submission.plagiarism_score) >= 80 ? theme.danger : theme.textMuted }]}>
                    Similarity: {Number(submission.plagiarism_score).toFixed(1)}%
                  </Text>
                ) : null}
                <Field label="Score" value={gradeDrafts[submission.id]?.score ?? ''} onChangeText={value => setGradeDrafts(current => ({ ...current, [submission.id]: { ...(current[submission.id] || {}), score: value } }))} theme={theme} keyboardType="numeric" />
                <Field label="Feedback" value={gradeDrafts[submission.id]?.feedback ?? ''} onChangeText={value => setGradeDrafts(current => ({ ...current, [submission.id]: { ...(current[submission.id] || {}), feedback: value } }))} theme={theme} multiline />
                <TouchableOpacity style={[s.primaryBtn, { backgroundColor: theme.success }]} onPress={() => gradeSubmission(submission)}>
                  <Text style={s.primaryText}>Save grade</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, value, onChangeText, theme, multiline, placeholder, keyboardType }) {
  return (
    <View>
      <Text style={[s.label, { color: theme.textSub }]}>{label}</Text>
      <TextInput
        style={[s.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg }, multiline && s.textarea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function parseQuestions(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [question, choices, answer] = line.split('|').map(part => part?.trim());
      return {
        question,
        choices: choices ? choices.split(',').map(choice => choice.trim()).filter(Boolean) : [],
        answer: answer || '',
      };
    })
    .filter(item => item.question);
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 16, gap: 12, paddingBottom: 100 },
  card: { borderWidth: 1, borderRadius: 14, padding: 15 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 10, fontWeight: '900' },
  count: { fontSize: 11, fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '900' },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 5, lineHeight: 18 },
  warning: { fontSize: 12, fontWeight: '800', marginTop: 10 },
  primaryBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '92%', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 18 },
  modalTitle: { fontSize: 18, fontWeight: '900', paddingHorizontal: 18 },
  form: { padding: 18, gap: 12, paddingBottom: 28 },
  label: { fontSize: 12, fontWeight: '900', marginBottom: 6, marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 46, paddingHorizontal: 12, fontSize: 14 },
  textarea: { minHeight: 96, paddingTop: 12 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  choiceText: { fontSize: 12, fontWeight: '800' },
  aiBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  aiText: { fontSize: 13, fontWeight: '900' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  secondaryText: { fontWeight: '900' },
  saveBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '900' },
  detail: { flex: 1 },
  detailHeader: { paddingTop: 48, paddingBottom: 14, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  closeText: { fontSize: 13, fontWeight: '900' },
});
