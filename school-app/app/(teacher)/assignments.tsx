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
import * as DocumentPicker from 'expo-document-picker';

const EMPTY_FORM = {
  section_subject_id: '',
  type: 'assignment',
  title: '',
  instructions: '',
  points_possible: '100',
  due_at: '',
  duration_minutes: '60',
  question_count: '10',
  questions: [],
  module_text: '',
};

export default function TeacherAssignments() {
  const { theme } = useTheme();
  const [classes, setClasses] = useState([]);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detailPreview, setDetailPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizStatus, setQuizStatus] = useState({ message: '', type: 'info' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [moduleFile, setModuleFile] = useState(null);
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
    setModuleFile(null);
    setQuizStatus({ message: '', type: 'info' });
    setShowCreate(true);
  };

  const pickModuleFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/plain',
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      if (!/\.(txt|pdf|docx)$/i.test(file.name || '')) {
        Alert.alert('Unsupported file', 'Choose a TXT, PDF, or DOCX file.');
        return;
      }
      setModuleFile(file);
    } catch (e) {
      Alert.alert('Could not choose file', e.message || 'Please try again.');
    }
  };

  const createAssignment = async () => {
    if (!form.section_subject_id || !form.title.trim()) {
      Alert.alert('Missing details', 'Choose a class and add a title.');
      return;
    }
    if (['quiz', 'exam'].includes(form.type)) {
      if (form.questions.length === 0) {
        Alert.alert('Questions required', 'Add at least one question or generate questions before publishing.');
        return;
      }
      const incompleteIndex = form.questions.findIndex(question => {
        const choices = (question.choices ?? []).map(choice => choice.trim()).filter(Boolean);
        const answer = question.answer.trim().toLowerCase();
        return !question.question.trim()
          || choices.length < 2
          || !choices.some(choice => choice.toLowerCase() === answer)
            && !/^[A-F]$/.test(answer)
            || /^[A-F]$/.test(answer) && !choices[answer.charCodeAt(0) - 65];
      });
      if (incompleteIndex !== -1) {
        Alert.alert(
          'Question needs attention',
          `Question ${incompleteIndex + 1} needs question text, at least two choices, and a correct answer that matches one of the choices.`
        );
        return;
      }
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
        duration_minutes: form.type === 'exam' ? Number(form.duration_minutes || 60) : null,
        questions: ['quiz', 'exam'].includes(form.type)
          ? form.questions.map(question => ({
              ...question,
              choices: (question.choices ?? []).map(choice => choice.trim()).filter(Boolean),
            }))
          : null,
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
    if (!form.module_text.trim() && !form.instructions.trim() && !moduleFile) {
      Alert.alert('Module text required', 'Paste module or handout text before generating a quiz.');
      return;
    }

    const existingCount = form.questions.length;
    const remaining = 50 - existingCount;
    if (remaining < 3) {
      setQuizStatus({
        message: remaining === 0
          ? 'This draft already has the maximum of 50 questions.'
          : `Only ${remaining} question(s) remain. At least 3 are required per generation.`,
        type: 'warning',
      });
      return;
    }

    setGeneratingQuiz(true);
    setQuizStatus({ message: 'Generating questions...', type: 'info' });
    try {
      const payload = new FormData();
      const moduleText = form.module_text.trim() || form.instructions.trim();
      if (moduleText) payload.append('module_text', moduleText);
      if (moduleFile) {
        payload.append('module_file', {
          uri: moduleFile.uri,
          name: moduleFile.name,
          type: moduleFile.mimeType || 'application/octet-stream',
        });
      }
      payload.append('question_count', String(Math.min(Number(form.question_count || 10), remaining)));

      const res = await api.post('/teacher/assignments/generate-quiz', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const questions = res.data?.questions ?? [];
      if (!questions.length) {
        setQuizStatus({ message: 'No questions were generated. Try adding more module content.', type: 'warning' });
        return;
      }
      const addedQuestions = questions.slice(0, remaining).map(question => ({
        question: question.question ?? '',
        choices: Array.isArray(question.choices) ? question.choices.map(choice => String(choice ?? '')) : ['', '', '', ''],
        answer: question.answer ?? '',
      }));
      setForm(current => ({
        ...current,
        type: current.type === 'exam' ? 'exam' : 'quiz',
        questions: [...current.questions, ...addedQuestions],
      }));
      setQuizStatus({
        message: addedQuestions.length < questions.length
          ? `Added ${addedQuestions.length} question(s); ${form.type}s are limited to 50 questions.`
          : `${addedQuestions.length} question(s) added. ${form.questions.length + addedQuestions.length} question(s) in the ${form.type}.`,
        type: addedQuestions.length < questions.length ? 'warning' : 'success',
      });
    } catch (e) {
      setQuizStatus({ message: e.response?.data?.message || 'Could not generate quiz questions.', type: 'error' });
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const addQuestion = () => {
    if (form.questions.length >= 50) {
      setQuizStatus({ message: 'Quizzes and exams are limited to 50 questions.', type: 'warning' });
      return;
    }
    setForm(current => ({
      ...current,
      questions: [...current.questions, { question: '', choices: ['', '', '', ''], answer: '' }],
    }));
    setQuizStatus({ message: '', type: 'info' });
  };

  const updateQuestion = (index, updates) => {
    setForm(current => ({
      ...current,
      questions: current.questions.map((question, questionIndex) => (
        questionIndex === index ? { ...question, ...updates } : question
      )),
    }));
  };

  const removeQuestion = index => {
    setForm(current => ({
      ...current,
      questions: current.questions.filter((_, questionIndex) => questionIndex !== index),
    }));
  };

  const openDetails = async (assignment) => {
    try {
      const res = await api.get(`/assignments/${assignment.id}`);
      setDetailPreview(null);
      setSelected(res.data);
      const drafts = {};
      (res.data.submissions ?? []).forEach(submission => {
        drafts[submission.id] = {
          score: submission.score !== null && submission.score !== undefined ? String(submission.score) : '',
          feedback: submission.feedback ?? '',
        };
      });
      setGradeDrafts(drafts);
    } catch (e) {
      Alert.alert('Could not open', e.response?.data?.message || 'Please try again.');
    }
  };

  const publishAssignment = async () => {
    if (!selected || selected.status !== 'draft') return;

    try {
      const res = await api.put(`/teacher/assignments/${selected.id}`, { status: 'published' });
      setSelected(current => ({ ...res.data, submissions: current?.submissions ?? [] }));
      setItems(current => current.map(item => item.id === res.data.id
        ? { ...item, ...res.data }
        : item));
      Alert.alert('Published', 'This class work is now available to students.');
    } catch (e) {
      Alert.alert('Could not publish', e.response?.data?.message || 'Please try again.');
    }
  };

  const saveDraftQuestions = async () => {
    if (!selected || selected.status !== 'draft') return;
    if (!selected.title?.trim() || !selected.questions?.length) {
      Alert.alert('Incomplete draft', 'Add a title and at least one question before saving.');
      return;
    }

    try {
      const res = await api.put(`/teacher/assignments/${selected.id}`, {
        title: selected.title.trim(),
        instructions: selected.instructions ?? '',
        points_possible: Number(selected.points_possible || 100),
        duration_minutes: selected.type === 'exam' ? Number(selected.duration_minutes) : null,
        questions: selected.questions,
      });
      setSelected(res.data);
      setItems(current => current.map(item => item.id === res.data.id
        ? { ...item, ...res.data }
        : item));
      Alert.alert('Draft saved', 'You can continue editing or publish it when ready.');
    } catch (e) {
      Alert.alert('Could not save draft', e.response?.data?.message || 'Please check each question and its correct answer.');
    }
  };

  const updateDraftQuestion = (index, updates) => {
    setSelected(current => ({
      ...current,
      questions: current.questions.map((question, questionIndex) => (
        questionIndex === index ? { ...question, ...updates } : question
      )),
    }));
  };

  const addDraftQuestion = () => {
    if ((selected?.questions?.length ?? 0) >= 50) {
      Alert.alert('Question limit reached', 'Exams and quizzes can have up to 50 questions.');
      return;
    }
    setSelected(current => ({
      ...current,
      questions: [
        ...(current.questions ?? []),
        { question: '', choices: ['', '', '', ''], answer: '' },
      ],
    }));
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
              <View style={[s.badge, { backgroundColor: ['quiz', 'exam'].includes(item.type) ? '#F3E8FF' : '#E6F1FB' }]}>
                <Text style={[s.badgeText, { color: ['quiz', 'exam'].includes(item.type) ? '#7C3AED' : theme.primary }]}>{item.type.toUpperCase()}</Text>
              </View>
              <Text style={[s.count, { color: theme.textSub }]}>{item.submissions_count ?? 0} submitted</Text>
            </View>
            <Text style={[s.title, { color: theme.text }]}>{item.title}</Text>
            <Text style={[s.sub, { color: theme.textSub }]}>
              {item.section_subject?.subject?.code || 'Subject'} · {item.section_subject?.section?.name || 'Section'}
              {item.type === 'exam' ? ` · ${item.duration_minutes} min` : ''}
              {' · '}{item.due_at ? new Date(item.due_at).toLocaleString() : 'No due date'}
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
                {['assignment', 'quiz', 'exam'].map(type => (
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
              {form.type === 'exam' && (
                <Field
                  label="Time limit (minutes, 1–300)"
                  value={form.duration_minutes}
                  onChangeText={value => setForm(current => ({ ...current, duration_minutes: value }))}
                  theme={theme}
                  keyboardType="numeric"
                />
              )}

              {['quiz', 'exam'].includes(form.type) && (
                <>
                  <Field
                    label={`Module text for AI ${form.type}`}
                    value={form.module_text}
                    onChangeText={value => setForm(current => ({ ...current, module_text: value }))}
                    theme={theme}
                    multiline
                    placeholder="Paste module, handout, or lesson notes here"
                  />
                  <View style={s.filePickerRow}>
                    <TouchableOpacity
                      style={[s.aiBtn, s.filePickerButton, { borderColor: theme.primary }]}
                      onPress={pickModuleFile}
                    >
                      <Text style={[s.aiText, { color: theme.primary }]}>
                        {moduleFile ? 'Change module file' : 'Choose TXT, PDF, or DOCX'}
                      </Text>
                    </TouchableOpacity>
                    {moduleFile ? (
                      <View style={s.selectedFileRow}>
                        <Text style={[s.selectedFileName, { color: theme.textSub }]} numberOfLines={1}>
                          {moduleFile.name}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setModuleFile(null)}
                          accessibilityRole="button"
                          accessibilityLabel="Remove selected module file"
                        >
                          <Text style={[s.removeFileText, { color: theme.danger }]}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[s.label, { color: theme.textSub }]}>AI question count</Text>
                  <View style={s.choiceWrap}>
                    {[5, 10, 15, 20, 30, 40, 50].map(count => (
                      <TouchableOpacity
                        key={count}
                        style={[s.choice, form.question_count === String(count) && { borderColor: theme.primary, backgroundColor: theme.primaryLight }]}
                        onPress={() => setForm(current => ({ ...current, question_count: String(count) }))}
                        accessibilityRole="button"
                        accessibilityState={{ selected: form.question_count === String(count) }}
                      >
                        <Text style={[s.choiceText, { color: form.question_count === String(count) ? theme.primary : theme.textSub }]}>{count}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity style={[s.aiBtn, { borderColor: theme.primary }]} onPress={generateQuiz} disabled={generatingQuiz}>
                    {generatingQuiz ? <ActivityIndicator color={theme.primary} /> : <Text style={[s.aiText, { color: theme.primary }]}>Generate AI {form.type} draft</Text>}
                  </TouchableOpacity>
                  {quizStatus.message ? (
                    <Text style={[s.quizStatus, { color: quizStatus.type === 'success' ? theme.success : quizStatus.type === 'error' ? theme.danger : theme.warning }]}>
                      {quizStatus.message}
                    </Text>
                  ) : null}
                  <View style={s.questionBuilderHeader}>
                    <Text style={[s.label, { color: theme.textSub, marginTop: 0 }]}>
                      {form.type === 'exam' ? 'Exam Questions' : 'Quiz Questions'} ({form.questions.length}/50)
                    </Text>
                    <TouchableOpacity onPress={addQuestion} accessibilityRole="button" accessibilityLabel="Add question">
                      <Text style={[s.addQuestionText, { color: theme.primary }]}>+ Add question</Text>
                    </TouchableOpacity>
                  </View>
                  {form.questions.map((question, index) => (
                    <View key={index} style={[s.questionCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                      <View style={s.questionCardHeader}>
                        <Text style={[s.questionNumber, { color: theme.primary }]}>Question {index + 1}</Text>
                        <TouchableOpacity
                          onPress={() => removeQuestion(index)}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove question ${index + 1}`}
                        >
                          <Text style={[s.removeFileText, { color: theme.danger }]}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                      <Field
                        label="Question text"
                        value={question.question}
                        onChangeText={value => updateQuestion(index, { question: value })}
                        theme={theme}
                        multiline
                        placeholder="Enter the question"
                      />
                      <View style={s.questionChoices}>
                        {question.choices.map((choice, choiceIndex) => (
                          <Field
                            key={choiceIndex}
                            label={`Choice ${String.fromCharCode(65 + choiceIndex)}`}
                            value={choice}
                            onChangeText={value => updateQuestion(index, {
                              choices: question.choices.map((current, currentIndex) => currentIndex === choiceIndex ? value : current),
                            })}
                            theme={theme}
                            multiline
                            placeholder={`Enter choice ${String.fromCharCode(65 + choiceIndex)}`}
                          />
                        ))}
                      </View>
                      {question.choices.length < 6 ? (
                        <TouchableOpacity
                          onPress={() => updateQuestion(index, { choices: [...question.choices, ''] })}
                          accessibilityRole="button"
                        >
                          <Text style={[s.addQuestionText, { color: theme.primary }]}>+ Add choice</Text>
                        </TouchableOpacity>
                      ) : null}
                      <Field
                        label="Correct answer (exact choice text)"
                        value={question.answer}
                        onChangeText={value => updateQuestion(index, { answer: value })}
                        theme={theme}
                        placeholder="Enter the correct answer"
                      />
                    </View>
                  ))}
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
            <View style={s.detailHeaderTop}>
              <Text style={[s.detailTitle, { color: theme.text }]} numberOfLines={2}>{selected?.title}</Text>
              <TouchableOpacity
                onPress={() => setSelected(null)}
                style={[s.closeBtn, { backgroundColor: theme.bg, borderColor: theme.border }]}
                accessibilityRole="button"
                accessibilityLabel="Close class work details"
                hitSlop={6}
              >
                <Text style={[s.closeText, { color: theme.text }]}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={s.detailHeaderBottom}>
              <View style={[s.submissionCount, { backgroundColor: theme.primaryLight }]}>
                <Text style={[s.submissionCountNumber, { color: theme.primary }]}>
                  {selected?.submissions?.length ?? 0}
                </Text>
                <Text style={[s.submissionCountLabel, { color: theme.primary }]}>
                  {(selected?.submissions?.length ?? 0) === 1 ? 'submission' : 'submissions'}
                </Text>
              </View>
              {selected?.status === 'draft' ? (
                <View style={s.detailActions}>
                  <TouchableOpacity style={[s.headerAction, { backgroundColor: theme.primary }]} onPress={saveDraftQuestions}>
                    <Text style={s.saveText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.headerAction, { backgroundColor: theme.success }]} onPress={publishAssignment}>
                    <Text style={s.saveText}>Publish</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>
          <ScrollView contentContainerStyle={s.body}>
            {selected?.status === 'draft' && ['quiz', 'exam'].includes(selected.type) ? (
              <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[s.title, { color: theme.text }]}>Edit draft questions ({selected.questions?.length ?? 0}/50)</Text>
                <Field
                  label="Title"
                  value={selected.title ?? ''}
                  onChangeText={value => setSelected(current => ({ ...current, title: value }))}
                  theme={theme}
                />
                <Field
                  label="Instructions"
                  value={selected.instructions ?? ''}
                  onChangeText={value => setSelected(current => ({ ...current, instructions: value }))}
                  theme={theme}
                  multiline
                />
                <Field
                  label="Points"
                  value={String(selected.points_possible ?? '100')}
                  onChangeText={value => setSelected(current => ({ ...current, points_possible: value }))}
                  theme={theme}
                  keyboardType="numeric"
                />
                {selected.type === 'exam' ? (
                  <Field
                    label="Time limit (minutes)"
                    value={String(selected.duration_minutes ?? '60')}
                    onChangeText={value => setSelected(current => ({ ...current, duration_minutes: value }))}
                    theme={theme}
                    keyboardType="numeric"
                  />
                ) : null}
                {(selected.questions ?? []).map((question, index) => (
                  <View key={index} style={[s.card, { backgroundColor: theme.bg, borderColor: theme.border, marginTop: 12 }]}>
                    <View style={s.row}>
                      <Text style={[s.title, { color: theme.text }]}>Question {index + 1}</Text>
                      <TouchableOpacity
                        onPress={() => setSelected(current => ({
                          ...current,
                          questions: current.questions.filter((_, questionIndex) => questionIndex !== index),
                        }))}
                      >
                        <Text style={[s.warning, { color: theme.danger }]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                    <Field
                      label="Question"
                      value={question.question ?? ''}
                      onChangeText={value => updateDraftQuestion(index, { question: value })}
                      theme={theme}
                      multiline
                    />
                    {(question.choices ?? []).map((choice, choiceIndex) => (
                      <Field
                        key={choiceIndex}
                        label={`Choice ${String.fromCharCode(65 + choiceIndex)}`}
                        value={choice}
                        onChangeText={value => updateDraftQuestion(index, {
                          choices: question.choices.map((currentChoice, currentIndex) => (
                            currentIndex === choiceIndex ? value : currentChoice
                          )),
                        })}
                        theme={theme}
                      />
                    ))}
                    <Field
                      label="Correct answer (exact choice text or A-F)"
                      value={question.answer ?? ''}
                      onChangeText={value => updateDraftQuestion(index, { answer: value })}
                      theme={theme}
                    />
                  </View>
                ))}
                <TouchableOpacity style={[s.aiBtn, { borderColor: theme.primary, marginTop: 12 }]} onPress={addDraftQuestion}>
                  <Text style={[s.aiText, { color: theme.primary }]}>+ Add question</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {['quiz', 'exam'].includes(selected?.type) && (selected?.questions ?? []).length > 0 ? (
              <TouchableOpacity
                style={[s.previewButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => setDetailPreview({ type: 'questions' })}
              >
                <View style={[s.previewIcon, { backgroundColor: theme.primaryLight }]}>
                  <Text style={[s.previewIconText, { color: theme.primary }]}>Q</Text>
                </View>
                <View style={s.previewCopy}>
                  <Text style={[s.title, { color: theme.text }]}>View question set</Text>
                  <Text style={[s.sub, { color: theme.textSub }]}>{selected.questions.length} questions and answer key</Text>
                </View>
                <Text style={[s.previewArrow, { color: theme.textSub }]}>›</Text>
              </TouchableOpacity>
            ) : null}
            {(selected?.submissions ?? []).length === 0 ? (
              <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[s.title, { color: theme.text }]}>No submissions yet</Text>
              </View>
            ) : selected.submissions.map(submission => (
              <View key={submission.id} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={s.submissionCardHeader}>
                  <View style={s.submissionStudent}>
                    <Text style={[s.title, { color: theme.text }]}>{submission.student?.first_name} {submission.student?.last_name}</Text>
                    {submission.student?.student_id ? (
                      <Text style={[s.sub, { color: theme.textSub }]}>{submission.student.student_id}</Text>
                    ) : null}
                  </View>
                  <View style={[
                    s.statusBadge,
                    { backgroundColor: submission.status === 'flagged' ? theme.dangerLight : submission.status === 'graded' ? theme.successLight : theme.primaryLight },
                  ]}>
                    <Text style={[
                      s.statusBadgeText,
                      { color: submission.status === 'flagged' ? theme.danger : submission.status === 'graded' ? theme.success : theme.primary },
                    ]}>
                      {String(submission.status || 'submitted').replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>
                {['quiz', 'exam'].includes(selected?.type) ? (
                  <View style={[s.scoreSummary, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                    <Text style={[s.scoreSummaryText, { color: theme.danger }]}>
                      Correct: {correctAnswerCount(selected.questions ?? [], submission.answers ?? [])}/{selected.questions?.length ?? 0}
                      {' · '}Mistakes: {(selected.questions?.length ?? 0) - correctAnswerCount(selected.questions ?? [], submission.answers ?? [])}
                    </Text>
                    <Text style={[s.scoreSummaryText, { color: theme.text }]}>
                      Score: {submission.score !== null && submission.score !== undefined
                        ? `${Number(submission.score)}/${Number(selected.points_possible)} points`
                        : 'Not graded'}
                    </Text>
                  </View>
                ) : null}
                {Number(submission.violation_count ?? 0) > 0 ? (
                  <View style={[
                    s.violationNotice,
                    { backgroundColor: Number(submission.violation_count) >= 3 ? theme.dangerLight : theme.warningLight },
                  ]}>
                    <Text style={[
                      s.violationText,
                      { color: Number(submission.violation_count) >= 3 ? theme.danger : theme.warning },
                    ]}>
                      {Number(submission.violation_count) >= 3 ? 'Flagged after repeated app switching' : 'App-switch warnings'} · {submission.violation_count}/3
                    </Text>
                  </View>
                ) : null}
                {['quiz', 'exam'].includes(selected?.type) && (selected.questions ?? []).length > 0 ? (
                  <TouchableOpacity
                    style={[s.reviewAnswersButton, { borderColor: theme.primary }]}
                    onPress={() => setDetailPreview({ type: 'answers', submission })}
                  >
                    <Text style={[s.reviewAnswersText, { color: theme.primary }]}>Review student answers</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[s.sub, { color: theme.textSub }]}>{submission.answer_text || 'No written answer provided.'}</Text>
                )}
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

      <Modal
        visible={!!detailPreview}
        animationType="slide"
        onRequestClose={() => setDetailPreview(null)}
      >
        <View style={[s.detail, { backgroundColor: theme.bg }]}>
          <View style={[s.previewHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <View style={s.detailHeaderTop}>
              <View style={s.previewCopy}>
                <Text style={[s.detailTitle, { color: theme.text }]}>
                  {detailPreview?.type === 'answers' ? 'Student answers' : 'Question set'}
                </Text>
                {detailPreview?.type === 'answers' ? (
                  <Text style={[s.sub, { color: theme.textSub }]}>
                    {detailPreview.submission.student?.first_name} {detailPreview.submission.student?.last_name}
                  </Text>
                ) : (
                  <Text style={[s.sub, { color: theme.textSub }]}>
                    {selected?.questions?.length ?? 0} questions · Answer key
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setDetailPreview(null)}
                style={[s.closeBtn, { backgroundColor: theme.bg, borderColor: theme.border }]}
                accessibilityRole="button"
                accessibilityLabel="Close preview"
                hitSlop={6}
              >
                <Text style={[s.closeText, { color: theme.text }]}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView contentContainerStyle={s.body}>
            {(selected?.questions ?? []).map((question, index) => {
              const isReviewingAnswers = detailPreview?.type === 'answers';
              const studentAnswer = detailPreview?.submission?.answers?.[index];

              return (
                <View key={`preview-question-${index}`} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[s.questionText, { color: theme.text }]}>{index + 1}. {question.question}</Text>
                  {(question.choices ?? []).map((choice, choiceIndex) => (
                    <Text key={`preview-choice-${choiceIndex}`} style={[s.questionOption, { color: theme.textSub }]}>
                      {String.fromCharCode(65 + choiceIndex)}. {choice}
                    </Text>
                  ))}
                  {isReviewingAnswers ? (
                    <>
                      <View style={[s.previewAnswer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                        <Text style={[s.label, { color: theme.textSub }]}>Student answer</Text>
                        <Text style={[s.previewAnswerText, { color: theme.text }]}>{studentAnswer || 'Not answered'}</Text>
                      </View>
                      <View style={[s.correctAnswerBox, { backgroundColor: theme.successLight }]}>
                        <Text style={[s.correctAnswerLabel, { color: theme.success }]}>Correct answer</Text>
                        <Text style={[s.correctAnswerValue, { color: theme.success }]}>{question.answer || 'Not set'}</Text>
                      </View>
                    </>
                  ) : (
                    <View style={[s.correctAnswerBox, { backgroundColor: theme.successLight }]}>
                      <Text style={[s.correctAnswerLabel, { color: theme.success }]}>Correct answer</Text>
                      <Text style={[s.correctAnswerValue, { color: theme.success }]}>{question.answer || 'Not set'}</Text>
                    </View>
                  )}
                </View>
              );
            })}
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

function correctAnswerCount(questions, answers) {
  return questions.filter((question, index) => {
    const expected = String(question.answer ?? '').trim().toLowerCase();
    const actual = String(answers[index] ?? '').trim().toLowerCase();
    return expected !== '' && actual === expected;
  }).length;
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
  filePickerRow: { gap: 8 },
  filePickerButton: { borderStyle: 'dashed' },
  selectedFileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectedFileName: { flex: 1, fontSize: 12, fontWeight: '700' },
  removeFileText: { fontSize: 12, fontWeight: '900' },
  quizStatus: { fontSize: 12, fontWeight: '700', lineHeight: 18 },
  questionBuilderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8 },
  addQuestionText: { fontSize: 12, fontWeight: '900' },
  questionCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  questionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  questionNumber: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  questionChoices: { gap: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  secondaryText: { fontWeight: '900' },
  saveBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '900' },
  detail: { flex: 1 },
  detailHeader: { paddingTop: 48, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  detailHeaderTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailTitle: { flex: 1, fontSize: 19, fontWeight: '900', lineHeight: 25 },
  detailHeaderBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  submissionCount: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  submissionCountNumber: { fontSize: 13, fontWeight: '900' },
  submissionCountLabel: { fontSize: 12, fontWeight: '800' },
  detailActions: { flexDirection: 'row', gap: 8 },
  headerAction: { borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9, alignItems: 'center' },
  closeBtn: { width: 44, height: 44, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 28, lineHeight: 30, fontWeight: '500', marginTop: -2 },
  previewHeader: { paddingTop: 48, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  previewButton: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  previewIconText: { fontSize: 16, fontWeight: '900' },
  previewCopy: { flex: 1 },
  previewArrow: { fontSize: 26, fontWeight: '500' },
  reviewAnswersButton: { borderWidth: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 12 },
  reviewAnswersText: { fontSize: 13, fontWeight: '900' },
  previewAnswer: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 12 },
  previewAnswerText: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  submissionCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  submissionStudent: { flex: 1 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '900' },
  scoreSummary: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, marginTop: 10, gap: 4 },
  scoreSummaryText: { fontSize: 12, fontWeight: '800' },
  violationNotice: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, marginTop: 9 },
  violationText: { fontSize: 12, fontWeight: '900' },
  questionText: { fontSize: 14, fontWeight: '800', lineHeight: 20 },
  questionOption: { fontSize: 13, lineHeight: 19, paddingLeft: 8 },
  correctAnswerBox: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, marginTop: 8 },
  correctAnswerLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.3 },
  correctAnswerValue: { fontSize: 13, fontWeight: '900', marginTop: 3, lineHeight: 19 },
  studentAnswers: { marginTop: 8 },
  answerRow: { borderTopWidth: 1, paddingVertical: 10, gap: 2 },
});
