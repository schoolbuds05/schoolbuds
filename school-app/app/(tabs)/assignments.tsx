// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
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
  View, Image, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

const plainQuizText = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/(\*\*|__|~~|`)(.*?)\1/g, '$2');

export default function StudentAssignments() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [violations, setViolations] = useState([]);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [listFilter, setListFilter] = useState('open');
  const topInset = Math.max(insets.top, StatusBar.currentHeight ?? 0);
  const timedOutSubmission = useRef(false);
  const submissionFinal = Boolean(selected?.submission?.submitted_at)
    || ['submitted', 'graded'].includes(selected?.submission?.status);

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

  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const open = async (item) => {
    try {
      const res = await api.get(`/assignments/${item.id}`);
      let submission = item.submission;
      let expiresAt = null;
      if (res.data.type === 'exam' && !item.submission?.submitted_at) {
        const started = await api.post(`/assignments/${item.id}/start`);
        submission = started.data.submission;
        expiresAt = started.data.expires_at;
      }
      const assignment = { ...res.data, submission, expires_at: expiresAt };
      timedOutSubmission.current = false;
      setSelected(assignment);
      setAnswerText(submission?.answer_text ?? '');
      const existing = {};
      (submission?.answers ?? []).forEach((value, index) => { existing[index] = value; });
      setAnswers(existing);
      setViolations(submission?.violations ?? []);
      setRemainingSeconds(null);
    } catch (e) {
      Alert.alert('Could not open', e.response?.data?.message || 'Please try again.');
    }
  };

  const submit = useCallback(async (overrideViolations = null, timedOut = false) => {
    if (!selected) return;
    if (selected.submission?.submitted_at) {
      Alert.alert('Already submitted', 'This work has already been submitted.');
      return;
    }

    const activeViolations = Array.isArray(overrideViolations)
      ? overrideViolations
      : Array.isArray(violations) ? violations : [];
    const questions = Array.isArray(selected.questions) ? selected.questions : [];
    const quizAnswers = questions.map((_, index) =>
      String(answers[index] ?? '').trim()
    );
    const quizViolations = activeViolations.map(violation => ({
      type: String(violation?.type ?? 'unknown'),
      details: {
        app_state: String(violation?.details?.app_state ?? ''),
      },
      recorded_at: String(violation?.recorded_at ?? ''),
    }));
    const hasAnswer = ['quiz', 'exam'].includes(selected.type)
      ? quizAnswers.some(answer => answer !== '')
      : answerText.trim() !== '';

    if (!hasAnswer && !timedOut) {
      Alert.alert(
        'Answer required',
        ['quiz', 'exam'].includes(selected.type)
          ? 'Select an answer for at least one quiz question before submitting.'
          : 'Write your answer before submitting.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/assignments/${selected.id}/submit`, {
        answer_text: ['quiz', 'exam'].includes(selected.type) ? null : answerText.trim(),
        answers: ['quiz', 'exam'].includes(selected.type) ? quizAnswers : null,
        violation_count: activeViolations.length,
        violations: quizViolations,
        auto_submit: ['quiz', 'exam'].includes(selected.type) && activeViolations.length >= 3,
      });
      setSelected(null);
      await load();
      Alert.alert(timedOut ? 'Time is up' : 'Submitted', timedOut ? 'Your exam was submitted when the time limit ended.' : 'Your work has been submitted.');
    } catch (e) {
      if (timedOut && e.response?.status === 409) {
        setSelected(null);
        await load();
        Alert.alert('Time is up', 'Your exam was submitted when the time limit ended.');
        return;
      }
      const responseMessage = e.response?.data?.message;
      const failureMessage = responseMessage
        || (e.response
          ? `The server returned an error (${e.response.status}). Please try again or contact your teacher.`
          : `Could not reach the server (${e.message}). Check that the app and server are on the same network, then try again.`);
      console.log('Assignment submission error:', e.response?.data ?? e.message);
      Alert.alert('Could not submit', failureMessage);
    } finally {
      setSubmitting(false);
    }
  }, [selected, violations, answers, answerText, load]);

  useEffect(() => {
    if (
      !selected
      || selected.type !== 'exam'
      || selected.submission?.submitted_at
      || !selected.expires_at
    ) return undefined;

    const updateRemainingTime = () => {
      setRemainingSeconds(Math.max(0, Math.ceil((Date.parse(selected.expires_at) - Date.now()) / 1000)));
    };
    updateRemainingTime();
    const timer = setInterval(updateRemainingTime, 1000);
    return () => clearInterval(timer);
  }, [selected]);

  useEffect(() => {
    const isSubmitted = Boolean(selected?.submission?.submitted_at)
      || ['submitted', 'graded'].includes(selected?.submission?.status);
    if (selected?.type === 'exam' && !isSubmitted && remainingSeconds === 0 && !submitting && !timedOutSubmission.current) {
      timedOutSubmission.current = true;
      submit(null, true);
    }
  }, [remainingSeconds, selected, submitting, submit]);

  useEffect(() => {
    const isSubmitted = Boolean(selected?.submission?.submitted_at)
      || ['submitted', 'graded'].includes(selected?.submission?.status);
    if (!selected || selected.type !== 'exam' || isSubmitted) return undefined;

    const timer = setTimeout(() => {
      api.put(`/assignments/${selected.id}/progress`, {
        answers: (selected.questions ?? []).map((_, index) => String(answers[index] ?? '').trim()),
      }).catch(error => {
        console.log('Exam progress save failed:', error.response?.data ?? error.message);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [selected, answers, submissionFinal]);

  useEffect(() => {
    if (
      !selected
      || !['quiz', 'exam'].includes(selected.type)
      || selected.submission?.submitted_at
      || ['submitted', 'graded'].includes(selected.submission?.status)
    ) return undefined;

    const subscription = AppState.addEventListener('change', async (state) => {
      if (state !== 'background') return;

      const violation = {
        type: 'app_switch',
        details: { app_state: state },
        recorded_at: new Date().toISOString(),
      };
      const nextViolations = [...violations, violation];
      const currentAnswers = (selected.questions ?? []).map((_, index) =>
        String(answers[index] ?? '').trim()
      );

      try {
        const response = await api.post(`/assignments/${selected.id}/violation`, {
          type: violation.type,
          details: violation.details,
          answers: currentAnswers,
        });
        const submission = response.data;
        setViolations(submission?.violations ?? nextViolations);

        if (submission?.submitted_at) {
          setSelected(null);
          await load();
          Alert.alert(
            selected.type === 'exam' ? 'Exam flagged' : 'Quiz flagged',
            'Your answers were auto-submitted for teacher review after repeated app switching.'
          );
          return;
        }

        const violationCount = Number(submission?.violation_count ?? nextViolations.length);
        Alert.alert('Stay in quiz', `App switching is recorded during quizzes. Warning ${violationCount}/3.`);
      } catch (e) {
        console.log('Quiz violation report failed:', e.response?.data ?? e.message);
        Alert.alert(
          'Could not record quiz activity',
          e.response?.data?.message || 'Your quiz activity could not be recorded. Check your connection and try again.'
        );
      }
    });

    return () => subscription.remove();
  }, [selected, violations, answers, load]);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const submitted = items.filter(item => isSubmitted(item)).length;
  const graded = items.filter(item => item.submission?.status === 'graded').length;
  const openItems = items.filter(item => !isSubmitted(item));
  const shownItems = listFilter === 'submitted' ? items.filter(item => isSubmitted(item)) : listFilter === 'graded' ? items.filter(item => item.submission?.status === 'graded') : openItems;
  const dueThisWeek = shownItems.filter(item => !isSubmitted(item) && isDueThisWeek(item));
  const later = shownItems.filter(item => !isSubmitted(item) && !isDueThisWeek(item));
  const submittedItems = shownItems.filter(item => isSubmitted(item));
  const quizReviewReady = selected?.submission?.status === 'graded'
    && selected?.submission?.score !== null
    && selected?.submission?.score !== undefined;
  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <View style={[s.assignmentHeader, { paddingTop: topInset + 12 }]}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to More" onPress={() => router.back()} style={[s.assignmentBack, { backgroundColor: theme.card }]}><Ionicons name="chevron-back" size={20} color={theme.text} /></TouchableOpacity><View style={s.assignmentHeaderCopy}><Text style={[s.assignmentTerm, { color: theme.textSub }]}>Class work and assessments</Text><Text style={[s.assignmentTitle, { color: theme.text }]}>Assignments</Text></View><View style={[s.assignmentLogoWrap, { backgroundColor: theme.card }]}><Image source={require('../../assets/images/schoolbuds-favicon.png')} style={s.assignmentLogo} resizeMode="contain" /></View></View>
      <View style={[s.assignmentTabs, { backgroundColor: theme.primaryLight }]}>{[['open', `Open ${openItems.length}`], ['submitted', `Submitted ${submitted}`], ['graded', `Graded ${graded}`]].map(([value, label]) => <TouchableOpacity key={value} style={[s.assignmentTab, listFilter === value && { backgroundColor: theme.card }]} onPress={() => setListFilter(value)}><Text style={[s.assignmentTabText, { color: listFilter === value ? theme.text : theme.textSub }]}>{label}</Text></TouchableOpacity>)}</View>
      <ScrollView
        contentContainerStyle={s.assignmentBody}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/*
          <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[s.title, { color: theme.text }]}>No assignments yet</Text>
            <Text style={[s.sub, { color: theme.textSub }]}>Class work from your teachers will appear here.</Text>
          </View>
        ) : [].map(item => (
          <TouchableOpacity key={item.id} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => open(item)}>
            <View style={s.row}>
              <View style={[s.badge, { backgroundColor: item.submission ? theme.successLight : theme.warningLight }]}>
                <Text style={[s.badgeText, { color: item.submission ? theme.success : theme.warning }]}>
                  {item.submission ? item.submission.status.toUpperCase() : 'OPEN'}
                </Text>
              </View>
              <Text style={[s.points, { color: theme.textSub }]}>{Number(item.points_possible).toFixed(0)} pts</Text>
            </View>
            <Text style={[s.title, { color: theme.text }]}>{item.title}</Text>
            <Text style={[s.sub, { color: theme.textSub }]}>
              {item.type.toUpperCase()} · {item.section_subject?.subject?.code || 'Subject'} · {item.teacher?.name || 'Teacher'} · {item.due_at ? new Date(item.due_at).toLocaleString() : 'No due date'}
            </Text>
            {item.submission?.score !== null && item.submission?.score !== undefined ? (
              <Text style={[s.score, { color: theme.success }]}>Score: {item.submission.score}/{item.points_possible}</Text>
            ) : null}
          </TouchableOpacity>
        */}
        {items.length === 0 ? <EmptyAssignments theme={theme} /> : listFilter === 'open' ? <><AssignmentSection title="Due this week" items={dueThisWeek} theme={theme} onOpen={open} empty="No assignments due this week." /><AssignmentSection title="Later" items={later} theme={theme} onOpen={open} empty="No later assignments." /><AssignmentSection title="Submitted" items={items.filter(item => isSubmitted(item))} theme={theme} onOpen={open} empty="No submitted assignments." /></> : <AssignmentSection title={listFilter === 'graded' ? 'Graded' : 'Submitted'} items={submittedItems} theme={theme} onOpen={open} empty={`No ${listFilter} assignments.`} />}
      </ScrollView>

      <Modal visible={!!selected} animationType="slide">
        <View style={[s.detail, { backgroundColor: theme.bg }]}>
          <View style={[s.detailHeader, { paddingTop: insets.top + 10, paddingLeft: Math.max(insets.left, 16), paddingRight: Math.max(insets.right, 16), backgroundColor: theme.primary, borderBottomColor: theme.primary }]}>
            <View style={s.detailHeading}>
              <Text style={[s.modalTitle, { color: '#FFFFFF' }]}>{selected?.title}</Text>
              <Text style={[s.detailMeta, { color: '#FFFFFF' }]}>
                {selected?.type} · {Number(selected?.points_possible || 0).toFixed(0)} pts
                {selected?.type === 'exam' ? ` · ${selected.duration_minutes} min` : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={s.closeBtn}
              onPress={() => setSelected(null)}
              accessibilityRole="button"
              accessibilityLabel="Close class work"
              hitSlop={6}
            >
              <Text style={s.closeText}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={[s.detailBody, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
            keyboardShouldPersistTaps="handled"
          >
            {selected?.type === 'exam' && !submissionFinal && remainingSeconds !== null ? (
              <View style={[s.warningCard, { backgroundColor: remainingSeconds < 60 ? theme.dangerLight : theme.primaryLight, borderColor: remainingSeconds < 60 ? theme.danger : theme.primary }]}>
                <Text style={[s.warningText, { color: remainingSeconds < 60 ? theme.danger : theme.primary }]}>
                  Time remaining: {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
                </Text>
              </View>
            ) : null}
            {['quiz', 'exam'].includes(selected?.type) && violations.length ? (
              <View style={[s.warningCard, { backgroundColor: violations.length >= 3 ? theme.dangerLight : theme.warningLight, borderColor: violations.length >= 3 ? theme.danger : theme.warning }]}>
                <Text style={[s.warningText, { color: violations.length >= 3 ? theme.danger : theme.warning }]}>{selected.type === 'exam' ? 'Exam' : 'Quiz'} warnings: {violations.length}/3</Text>
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

            {['quiz', 'exam'].includes(selected?.type) ? (
              (selected?.questions ?? []).map((question, index) => {
                const questionChoices = Array.isArray(question.choices) ? question.choices : [];
                const studentAnswer = String(selected?.submission?.answers?.[index] ?? '').trim();
                const correctAnswer = String(question.answer ?? '').trim();
                const isCorrect = studentAnswer.toLowerCase() === correctAnswer.toLowerCase();

                return (
                  <View key={index} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[s.questionTitle, { color: theme.text }]}>{index + 1}. {plainQuizText(question.question)}</Text>
                    {questionChoices.map((choice, choiceIndex) => {
                      const isSelected = answers[index] === choice;
                      const isCorrectChoice = quizReviewReady
                        && String(choice).trim().toLowerCase() === correctAnswer.toLowerCase();
                      const borderColor = quizReviewReady
                        ? isCorrectChoice ? theme.success : isSelected ? theme.danger : theme.border
                        : isSelected ? theme.primary : theme.border;
                      const backgroundColor = quizReviewReady
                        ? isCorrectChoice ? theme.successLight : isSelected ? theme.dangerLight : theme.card
                        : isSelected ? theme.primaryLight : theme.card;

                      return (
                        <TouchableOpacity
                          key={choice}
                          style={[s.choice, { borderColor, backgroundColor }]}
                          onPress={() => !quizReviewReady && !submissionFinal && setAnswers(current => ({ ...current, [index]: choice }))}
                          disabled={quizReviewReady || submissionFinal}
                        >
                          <Text style={[s.choiceLetter, { color: theme.text }]}>{String.fromCharCode(65 + choiceIndex)}.</Text>
                          <Text style={[s.choiceText, { color: theme.text }]}>{plainQuizText(choice)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {questionChoices.length === 0 ? (
                      <TextInput
                        style={[s.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg }]}
                        value={answers[index] ?? ''}
                        onChangeText={value => setAnswers(current => ({ ...current, [index]: value }))}
                        placeholder="Your answer"
                        placeholderTextColor={theme.textMuted}
                        editable={!quizReviewReady && !submissionFinal}
                      />
                    ) : null}
                    {quizReviewReady ? (
                      <Text style={[s.sub, { color: isCorrect ? theme.success : theme.danger }]}>
                        {isCorrect ? 'Correct' : `Incorrect · Correct answer: ${correctAnswer || 'Not provided'}`}
                      </Text>
                    ) : null}
                  </View>
                );
              })
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
                  editable={!submissionFinal}
                />
              </View>
            )}

            {submissionFinal ? (
              <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[s.sub, { color: theme.textSub }]}>Submitted. You cannot submit this work again.</Text>
              </View>
            ) : (
              <TouchableOpacity style={[s.submitBtn, { backgroundColor: theme.primary }]} onPress={submit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Submit</Text>}
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const isSubmitted = (item) => Boolean(item.submission?.submitted_at) || ['submitted', 'graded'].includes(item.submission?.status);
const isDueThisWeek = (item) => {
  if (!item.due_at) return false;
  const days = (new Date(item.due_at).getTime() - Date.now()) / 86400000;
  return days <= 7;
};
const dateText = (value, submitted) => {
  if (!value) return submitted ? 'Submitted' : 'No due date';
  const date = new Date(value);
  return `${submitted ? 'Turned in' : 'Due'} ${date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};
const dueLabel = (item) => {
  if (isSubmitted(item)) return item.submission?.status === 'graded' ? 'Graded' : 'Submitted';
  if (!item.due_at) return 'No due date';
  const days = Math.ceil((new Date(item.due_at).getTime() - Date.now()) / 86400000);
  return days <= 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`;
};

function AssignmentSection({ title, items, theme, onOpen, empty }) {
  return <View style={s.assignmentSection}><View style={s.assignmentSectionHead}><Text style={[s.assignmentSectionTitle, { color: theme.text }]}>{title}</Text><Text style={[s.assignmentSectionCount, { color: theme.textSub }]}>{items.length} {items.length === 1 ? 'task' : 'tasks'}</Text></View>{items.length ? <View style={[s.assignmentGroup, { backgroundColor: theme.card }]}>{items.map((item, index) => <AssignmentRow key={item.id} item={item} isLast={index === items.length - 1} theme={theme} onPress={() => onOpen(item)} />)}</View> : <Text style={[s.assignmentEmpty, { color: theme.textSub }]}>{empty}</Text>}</View>;
}
function AssignmentRow({ item, isLast, theme, onPress }) {
  const done = isSubmitted(item);
  const urgent = !done && item.due_at && isDueThisWeek(item);
  const accent = done ? theme.success : urgent ? theme.primary : theme.warning;
  const subject = item.section_subject?.subject?.code || 'SUBJ';
  return <TouchableOpacity style={[s.assignmentRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }, { borderLeftColor: accent }]} onPress={onPress} activeOpacity={0.75}><View style={s.assignmentRowCopy}><View style={s.assignmentRowTop}><Text style={[s.subjectPill, { backgroundColor: theme.primaryLight, color: theme.primary }]}>{subject}</Text><Text style={[s.duePill, { backgroundColor: done ? theme.successLight : urgent ? theme.dangerLight : theme.warningLight, color: done ? theme.success : urgent ? theme.danger : theme.warning }]}>{dueLabel(item)}</Text></View><Text style={[s.assignmentRowTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text><View style={s.assignmentMeta}><Ionicons name="time-outline" size={12} color={theme.textSub} /><Text style={[s.assignmentMetaText, { color: theme.textSub }]} numberOfLines={1}>{dateText(done ? item.submission?.submitted_at || item.due_at : item.due_at, done)}</Text></View></View></TouchableOpacity>;
}
function EmptyAssignments({ theme }) { return <View style={[s.assignmentEmptyCard, { backgroundColor: theme.card }]}><Text style={[s.assignmentEmptyTitle, { color: theme.text }]}>No assignments yet</Text><Text style={[s.assignmentEmpty, { color: theme.textSub }]}>Class work from your teachers will appear here.</Text></View>; }

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 16, gap: 12, paddingBottom: 100 },
  assignmentBody: { padding: 16, paddingTop: 16, paddingBottom: 100 },
  assignmentHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 13 },
  assignmentBack: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  assignmentHeaderCopy: { flex: 1 }, assignmentTerm: { fontSize: 10, fontWeight: '600', marginBottom: 1 }, assignmentTitle: { fontSize: 22, fontWeight: '800' },
  assignmentLogoWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, assignmentLogo: { width: 31, height: 31, borderRadius: 8 },
  assignmentTabs: { height: 36, borderRadius: 11, padding: 3, flexDirection: 'row', marginBottom: 16 }, assignmentTab: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8 }, assignmentTabText: { fontSize: 10, fontWeight: '800' },
  assignmentSection: { marginBottom: 17 }, assignmentSectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }, assignmentSectionTitle: { fontSize: 14, fontWeight: '800' }, assignmentSectionCount: { fontSize: 10, fontWeight: '700' },
  assignmentGroup: { borderRadius: 14, overflow: 'hidden' }, assignmentRow: { minHeight: 78, borderLeftWidth: 4, paddingVertical: 10, paddingHorizontal: 10 }, assignmentRowCopy: { flex: 1 },
  assignmentRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, subjectPill: { borderRadius: 11, paddingHorizontal: 9, paddingVertical: 4, fontSize: 9, fontWeight: '900', overflow: 'hidden' }, duePill: { borderRadius: 11, paddingHorizontal: 9, paddingVertical: 4, fontSize: 9, fontWeight: '900', overflow: 'hidden' },
  assignmentRowTitle: { fontSize: 12, fontWeight: '800', marginTop: 6 }, assignmentMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }, assignmentMetaText: { fontSize: 10, fontWeight: '600' },
  assignmentEmpty: { fontSize: 11, textAlign: 'center', paddingVertical: 6 }, assignmentEmptyCard: { borderRadius: 14, padding: 22, alignItems: 'center' }, assignmentEmptyTitle: { fontSize: 14, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 14, padding: 15 },
  warningCard: { borderWidth: 1, borderRadius: 12, padding: 12 },
  warningText: { fontSize: 12, fontWeight: '900' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 10, fontWeight: '900' },
  points: { fontSize: 11, fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '900' },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 5, lineHeight: 18 },
  score: { fontSize: 12, fontWeight: '900', marginTop: 10 },
  detail: { flex: 1 },
  detailHeader: { minHeight: 76, paddingBottom: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailHeading: { flex: 1, minWidth: 0 },
  detailBody: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '900', flexShrink: 1 },
  detailMeta: { fontSize: 12, fontWeight: '700', marginTop: 5, lineHeight: 18, opacity: 0.88 },
  closeText: { fontSize: 27, lineHeight: 30, fontWeight: '500', marginTop: -2, color: '#FFFFFF' },
  closeBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  questionTitle: { fontSize: 16, fontWeight: '900', lineHeight: 23 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 46, paddingHorizontal: 12, fontSize: 14, marginTop: 12 },
  textarea: { minHeight: 140, paddingTop: 12 },
  choice: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginTop: 10, width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  choiceLetter: { fontSize: 14, fontWeight: '900', lineHeight: 20 },
  choiceText: { flex: 1, fontSize: 14, fontWeight: '400', lineHeight: 20 },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
