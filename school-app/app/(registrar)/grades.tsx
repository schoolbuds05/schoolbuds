// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, RefreshControl, ScrollView, Share, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import api from '../../src/api';
import { HEADER_TOP } from '../../src/theme';
import { useTheme } from '../../src/theme-context';

const MAIN_VIEWS = [
  { key: 'students', label: 'Student grades' },
  { key: 'requests', label: 'Requests' },
];

const REQUEST_VIEWS = [
  { key: 'awaiting', label: 'Awaiting' },
  { key: 'approved', label: 'History' },
];

export default function RegistrarGrades() {
  const { theme } = useTheme();
  const [view, setView] = useState('awaiting');
  const [submissions, setSubmissions] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [gradeStudents, setGradeStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [requestSearch, setRequestSearch] = useState('');
  const [requestFilter, setRequestFilter] = useState('all');
  const [requestYear, setRequestYear] = useState('all');
  const [requestSemester, setRequestSemester] = useState('all');
  const [requestCourse, setRequestCourse] = useState('all');
  const [showRequestFilters, setShowRequestFilters] = useState(false);
  const [studentPage, setStudentPage] = useState(1);
  const [studentHasMore, setStudentHasMore] = useState(false);
  const [loadingMoreStudents, setLoadingMoreStudents] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [review, setReview] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const load = useCallback(async () => {
    try {
      if (view === 'students') {
        const { data } = await api.get('/registrar/student-grades', { params: { search: studentSearch, page: 1 } });
        setGradeStudents(data?.data || []);
        setStudentPage(data?.current_page || 1);
        setStudentHasMore((data?.current_page || 1) < (data?.last_page || 1));
        return;
      }
      const { data } = await api.get('/registrar/grades', { params: { view } });
      setSubmissions(data?.submissions || []);
      setChangeRequests(data?.change_requests || []);
    } catch (error) {
      Alert.alert('Could not load grades', error.response?.data?.message || 'Please refresh and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [view, studentSearch]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const startReview = (type, item, decision) => {
    setReview({ type, item, decision });
    setNote('');
  };

  const loadMoreStudentGrades = async () => {
    if (!studentHasMore || loadingMoreStudents) return;
    setLoadingMoreStudents(true);
    try {
      const nextPage = studentPage + 1;
      const { data } = await api.get('/registrar/student-grades', { params: { search: studentSearch, page: nextPage } });
      setGradeStudents(current => [...current, ...(data?.data || [])]);
      setStudentPage(data?.current_page || nextPage);
      setStudentHasMore((data?.current_page || nextPage) < (data?.last_page || nextPage));
    } catch (error) {
      Alert.alert('Could not load more grades', error.response?.data?.message || 'Please try again.');
    } finally {
      setLoadingMoreStudents(false);
    }
  };

  const submitReview = async () => {
    if (!review) return;
    const needsNote = review.decision === 'return' || review.decision === 'reject';
    if (needsNote && !note.trim()) {
      Alert.alert('Review note required', review.decision === 'return' ? 'Explain why the grade sheet is being returned.' : 'Add a reason for rejecting this grade change.');
      return;
    }

    setSaving(true);
    try {
      const endpoint = review.type === 'submission'
        ? `/registrar/grades/${review.item.id}/review`
        : `/registrar/grade-change-requests/${review.item.id}/review`;
      const { data } = await api.post(endpoint, { decision: review.decision, note: note.trim() || null });
      setReview(null);
      await load();
      Alert.alert('Review saved', data?.message || 'The grade item has been updated.');
    } catch (error) {
      const errors = error.response?.data?.errors;
      Alert.alert('Could not save review', errors ? Object.values(errors).flat().join('\n') : error.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async programType => {
    setTransferring(true);
    try {
      const { data } = await api.get('/registrar/grades/export', { params: { program_type: programType }, responseType: 'text' });
      const csv = typeof data === 'string' ? data : String(data ?? '');
      const fileName = `schoolbuds-finalized-grades-${programType}.csv`;
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ title: fileName, message: csv });
      }
    } catch (error) {
      Alert.alert('Could not export grades', error.response?.data?.message || 'Please try again.');
    } finally {
      setTransferring(false);
    }
  };

  const importCsv = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      const file = picked.assets?.[0];
      if (picked.canceled || !file) return;

      setTransferring(true);
      const payload = new FormData();
      payload.append('grades_file', { uri: file.uri, name: file.name || 'grades.csv', type: file.mimeType || 'text/csv' });
      const { data } = await api.post('/registrar/grades/import', payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      Alert.alert('Import complete', data?.message || 'Finalized grades imported. Existing grades were not changed.');
      await load();
    } catch (error) {
      const errors = error.response?.data?.errors;
      Alert.alert('Could not import grades', errors ? Object.values(errors).flat().join('\n') : error.response?.data?.message || 'Please check the CSV and try again.');
    } finally {
      setTransferring(false);
    }
  };

  const quarterLabel = item => item?.class?.is_college
    ? ({ 1: 'Prelim', 2: 'Midterm', 3: 'Prefinal', 4: 'Final' }[Number(item.quarter)] || `Quarter ${item.quarter}`)
    : `Q${item?.quarter || '?'}`;

  const matchesRequestSearch = item => {
    const haystack = [
      item.class?.subject, item.class?.section, item.class?.grade_level,
      item.class?.course, item.class?.semester, item.teacher?.name,
      item.school_year, quarterLabel(item), item.reason,
      ...(item.grades || []).flatMap(grade => [grade.student_name, grade.student_code]),
      ...(item.changes || []).flatMap(change => [change.student_name, change.student_code]),
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(requestSearch.trim().toLowerCase());
  };

  const allGradeRequests = [...submissions, ...changeRequests];
  const yearOptions = [...new Set(allGradeRequests.map(item => item.school_year).filter(Boolean))].sort();
  const semesterOptions = [...new Set(allGradeRequests.map(item => item.class?.semester).filter(Boolean))].sort();
  const courseOptions = [...new Set(allGradeRequests.map(item => item.class?.course).filter(Boolean))].sort();
  const matchesRequestFilters = item =>
    (requestYear === 'all' || item.school_year === requestYear) &&
    (requestSemester === 'all' || item.class?.semester === requestSemester) &&
    (requestCourse === 'all' || item.class?.course === requestCourse);
  const hasRequestFilters = requestFilter !== 'all' || requestYear !== 'all' || requestSemester !== 'all' || requestCourse !== 'all';

  const filteredSubmissions = requestFilter === 'changes'
    ? []
    : submissions.filter(item => matchesRequestSearch(item) && matchesRequestFilters(item));
  const filteredChangeRequests = requestFilter === 'sheets'
    ? []
    : changeRequests.filter(item => matchesRequestSearch(item) && matchesRequestFilters(item));

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text style={[styles.title, { color: theme.text }]}>Grades</Text>
        <Text style={[styles.subtitle, { color: theme.textSub }]}>Review grade sheets and look up published student grades</Text>

        <View style={[styles.tabs, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {MAIN_VIEWS.map(item => {
            const active = item.key === 'students' ? view === 'students' : view !== 'students';
            return <View key={item.key} style={styles.tabSlot}>
              <TouchableOpacity style={[styles.tab, active && { backgroundColor: theme.primary }]} onPress={() => setView(item.key === 'students' ? 'students' : (view === 'approved' ? 'approved' : 'awaiting'))}>
                <Text style={[styles.tabText, { color: theme.text }, active && styles.tabTextActive]} numberOfLines={1}>{item.label}</Text>
              </TouchableOpacity>
            </View>;
          })}
        </View>

        {view !== 'students' && <View style={[styles.requestTabs, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {REQUEST_VIEWS.map(item => (
            <TouchableOpacity key={item.key} style={[styles.requestTab, view === item.key && { backgroundColor: theme.primary }]} onPress={() => setView(item.key)}>
              <Text style={[styles.requestTabText, { color: theme.textSub }, view === item.key && styles.tabTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>}

        {view !== 'students' && <View style={styles.requestTools}>
          <View style={styles.requestSearchRow}>
            <View style={[styles.requestSearchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="search-outline" size={16} color={theme.textSub} />
              <TextInput
                value={requestSearch}
                onChangeText={setRequestSearch}
                placeholder="Search subject, section, teacher, or student"
                placeholderTextColor={theme.textMuted}
                style={[styles.requestSearchInput, { color: theme.text }]}
                autoCapitalize="none"
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity style={[styles.requestFilterButton, { backgroundColor: theme.card, borderColor: theme.primary }, hasRequestFilters && { backgroundColor: theme.primaryLight }]} onPress={() => setShowRequestFilters(true)}>
              <Ionicons name="options-outline" size={15} color={theme.primary} />
              <Text style={[styles.requestFilterButtonText, { color: theme.primary }]}>Filter</Text>
            </TouchableOpacity>
          </View>
        </View>}

        <Modal visible={showRequestFilters} transparent animationType="slide" onRequestClose={() => setShowRequestFilters(false)}>
          <View style={styles.filterBackdrop}>
            <View style={[styles.filterSheet, { backgroundColor: theme.bg }]}>
              <View style={[styles.filterSheetHeader, { borderBottomColor: theme.border }]}>
                <View>
                  <Text style={[styles.filterSheetTitle, { color: theme.text }]}>Filter grade requests</Text>
                  <Text style={[styles.filterSheetSubtitle, { color: theme.textSub }]}>Choose request type, school year, semester, and course</Text>
                </View>
                <TouchableOpacity style={[styles.filterClose, { backgroundColor: theme.card }]} onPress={() => setShowRequestFilters(false)} accessibilityLabel="Close filters">
                  <Ionicons name="close" size={19} color={theme.textSub} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.filterSheetBody}>
                <GradeRequestFilterGroup label="Request type" options={[
                  { key: 'all', label: 'All' },
                  { key: 'sheets', label: 'Grade sheets' },
                  { key: 'changes', label: 'Grade changes' },
                ]} value={requestFilter} onChange={setRequestFilter} allLabel={null} theme={theme} />
                <GradeRequestFilterGroup label="School year" options={yearOptions} value={requestYear} onChange={setRequestYear} allLabel="All years" theme={theme} />
                <GradeRequestFilterGroup label="Semester" options={semesterOptions} value={requestSemester} onChange={setRequestSemester} allLabel="All semesters" theme={theme} formatLabel={formatSemester} />
                <GradeRequestFilterGroup label="Course" options={courseOptions} value={requestCourse} onChange={setRequestCourse} allLabel="All courses" theme={theme} />
              </ScrollView>
              <View style={[styles.filterSheetActions, { borderTopColor: theme.border }]}>
                <TouchableOpacity style={[styles.filterReset, { backgroundColor: theme.card, borderColor: theme.primary }]} onPress={() => { setRequestFilter('all'); setRequestYear('all'); setRequestSemester('all'); setRequestCourse('all'); }}>
                  <Text style={[styles.filterResetText, { color: theme.primary }]}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterDone, { backgroundColor: theme.primary }]} onPress={() => setShowRequestFilters(false)}>
                  <Text style={styles.filterDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {view === 'students' && <View style={[styles.csvTools, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.csvTitle, { color: theme.text }]}>Grade CSV</Text>
          <Text style={[styles.csvHint, { color: theme.textSub }]}>Import records or export finalized college and Senior High grades.</Text>
          <View style={styles.csvButtons}>
            <TouchableOpacity style={[styles.csvButton, { backgroundColor: theme.primary }]} onPress={importCsv} disabled={transferring}>
              {transferring ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.csvButtonText}>Import CSV</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.csvButton, styles.csvButtonSecondary, { borderColor: theme.border }]} onPress={() => exportCsv('college')} disabled={transferring}>
              <Text style={[styles.csvButtonSecondaryText, { color: theme.text }]}>Export College</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.csvButton, styles.csvButtonSecondary, { borderColor: theme.border }]} onPress={() => exportCsv('shs')} disabled={transferring}>
              <Text style={[styles.csvButtonSecondaryText, { color: theme.text }]}>Export SHS</Text>
            </TouchableOpacity>
          </View>
        </View>}

        {view === 'students' && <TextInput
          value={studentSearch}
          onChangeText={setStudentSearch}
          placeholder="Search by student name or ID"
          placeholderTextColor={theme.textMuted}
          style={[styles.searchInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
          autoCapitalize="none"
          returnKeyType="search"
        />}

        {loading ? <View style={styles.loading}><ActivityIndicator size="large" color={theme.primary} /></View> : view === 'students' ? (
          <View>
            {gradeStudents.map(student => {
              const isOpen = expanded === `student-${student.id}`;
              return <View key={`student-${student.id}`} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <TouchableOpacity style={styles.cardHeading} onPress={() => setExpanded(isOpen ? null : `student-${student.id}`)} activeOpacity={0.75}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{student.name}</Text>
                    <Text style={[styles.cardMeta, { color: theme.textSub }]}>{student.student_id || 'No student ID'} · {student.grades?.length || 0} published grades</Text>
                  </View>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSub} />
                </TouchableOpacity>
                {isOpen && <View style={[styles.details, { borderTopColor: theme.border }]}>
                  {(student.grades || []).map(grade => <View key={`student-grade-${grade.id}`} style={[styles.studentGrade, { borderBottomColor: theme.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.studentName, { color: theme.text }]}>{grade.class?.subject || 'Subject'} · {grade.class?.section || 'Section'}</Text>
                      <Text style={[styles.cardMeta, { color: theme.textSub }]}>{grade.school_year} · {quarterLabel(grade)}{grade.class?.grade_level ? ` · ${grade.class.grade_level}` : ''}</Text>
                      <Text style={[styles.remarks, { color: theme.textSub, textAlign: 'left' }]}>{grade.remarks || 'No remarks'}</Text>
                    </View>
                    <Text style={[styles.score, { color: theme.text }]}>{grade.score == null ? '—' : Number(grade.score).toFixed(2)}</Text>
                  </View>)}
                </View>}
              </View>;
            })}
            {gradeStudents.length === 0 && <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}><Ionicons name="school-outline" size={21} color={theme.primary} /></View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No published grades found</Text>
              <Text style={[styles.cardMeta, { color: theme.textSub }]}>Search by a student's name or ID, or check back after grades are finalized.</Text>
            </View>}
            {studentHasMore && <TouchableOpacity style={[styles.loadMore, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={loadMoreStudentGrades} disabled={loadingMoreStudents}>
              {loadingMoreStudents ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.secondaryText, { color: theme.primary }]}>Load more students</Text>}
            </TouchableOpacity>}
          </View>
        ) : (
          <>
            {filteredSubmissions.map(item => {
              const isOpen = expanded === `submission-${item.id}`;
              return (
                <View key={`submission-${item.id}`} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <TouchableOpacity style={styles.cardHeading} onPress={() => setExpanded(isOpen ? null : `submission-${item.id}`)} activeOpacity={0.75}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>{item.class?.subject || 'Class'} · {item.class?.section || 'Section unavailable'}</Text>
                      <Text style={[styles.cardMeta, { color: theme.textSub }]}>{item.teacher?.name || 'Teacher'} · {quarterLabel(item)} · {item.school_year}</Text>
                      <Text style={[styles.cardMeta, { color: theme.textSub }]}>{item.class?.is_college ? 'College grading scale · 1 is highest' : 'Senior High grading scale · 100 is highest'} · Revision {item.revision}</Text>
                    </View>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSub} />
                  </TouchableOpacity>

                  {isOpen && <View style={[styles.details, { borderTopColor: theme.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Student scores</Text>
                    {(item.grades || []).map((grade, index) => (
                      <View key={`${grade.student_id || index}`} style={[styles.gradeRow, { borderBottomColor: theme.border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.studentName, { color: theme.text }]}>{grade.student_name || 'Student'}</Text>
                          <Text style={[styles.cardMeta, { color: theme.textSub }]}>{grade.student_code || ''}</Text>
                        </View>
                        <View style={styles.scoreBlock}>
                          <Text style={[styles.score, { color: theme.text }]}>{grade.score == null ? '—' : Number(grade.score).toFixed(2)}</Text>
                          <Text style={[styles.remarks, { color: theme.textSub }]}>{grade.remarks || 'No remarks'}</Text>
                        </View>
                      </View>
                    ))}
                    <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 12 }]}>Approval history</Text>
                    {(item.events || []).length ? item.events.map((event, index) => (
                      <Text key={`${event.action}-${index}`} style={[styles.eventText, { color: theme.textSub }]}>
                        <Text style={[styles.eventActor, { color: theme.text }]}>{event.actor}</Text> · {String(event.action).replace(/_/g, ' ')} · {formatDate(event.created_at)}{event.note ? `\n${event.note}` : ''}
                      </Text>
                    )) : <Text style={[styles.cardMeta, { color: theme.textSub }]}>No approval history yet.</Text>}
                    {view === 'awaiting' && <View style={styles.actions}>
                      <TouchableOpacity style={[styles.secondaryAction, { borderColor: theme.warning, backgroundColor: theme.card }]} onPress={() => startReview('submission', item, 'return')}><Text style={[styles.secondaryText, { color: theme.warning }]}>Return to Chair</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.primaryAction, { backgroundColor: theme.success }]} onPress={() => startReview('submission', item, 'approve')}><Text style={styles.primaryText}>Finalize grades</Text></TouchableOpacity>
                    </View>}
                  </View>}
                </View>
              );
            })}

            {filteredChangeRequests.length > 0 && <>
              <View style={styles.requestHeading}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{view === 'awaiting' ? 'Grade change requests' : 'Grade change request history'}</Text>
                <Text style={[styles.cardMeta, { color: theme.textSub }]}>{filteredChangeRequests.length} {view === 'awaiting' ? 'pending' : 'records'}</Text>
              </View>
              {filteredChangeRequests.map(item => {
                const isOpen = expanded === `change-${item.id}`;
                const isApproved = item.status === 'approved';
                return <View key={`change-${item.id}`} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <TouchableOpacity style={styles.cardHeading} onPress={() => setExpanded(isOpen ? null : `change-${item.id}`)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>{item.class?.subject || 'Class'} · {item.class?.section || 'Section unavailable'}</Text>
                      <Text style={[styles.cardMeta, { color: theme.textSub }]}>{item.teacher?.name} · {quarterLabel(item)} · {item.school_year}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: view === 'awaiting' ? theme.successLight : (isApproved ? theme.successLight : theme.dangerLight) }]}><Text style={[styles.badgeText, { color: view === 'awaiting' ? theme.success : (isApproved ? theme.success : theme.danger) }]}>{view === 'awaiting' ? 'Grade change' : (isApproved ? 'Approved' : 'Rejected')}</Text></View>
                  </TouchableOpacity>
                  {isOpen && <View style={[styles.details, { borderTopColor: theme.border }]}>
                    <Text style={[styles.reason, { color: theme.textSub }]}><Text style={{ color: theme.text, fontWeight: '800' }}>Teacher's reason: </Text>{item.reason}</Text>
                    {item.chair_note ? <Text style={[styles.reason, { color: theme.textSub }]}><Text style={{ color: theme.text, fontWeight: '800' }}>Chair note: </Text>{item.chair_note}</Text> : null}
                    {item.registrar_note ? <Text style={[styles.reason, { color: theme.textSub }]}><Text style={{ color: theme.text, fontWeight: '800' }}>Registrar note: </Text>{item.registrar_note}</Text> : null}
                    {(item.changes || []).map((change, index) => <View key={`${change.student_id}-${index}`} style={[styles.changeRow, { borderBottomColor: theme.border }]}>
                      <View style={{ flex: 1 }}><Text style={[styles.studentName, { color: theme.text }]}>{change.student_name}</Text><Text style={[styles.cardMeta, { color: theme.textSub }]}>{change.student_code}</Text></View>
                      <View style={styles.changeScores}><Text style={[styles.cardMeta, { color: theme.textSub }]}>Published {Number(change.old_score).toFixed(2)}</Text><Text style={[styles.score, { color: theme.primary }]}>Requested {Number(change.new_score).toFixed(2)}</Text></View>
                      <Text style={[styles.remarks, { color: theme.textSub, maxWidth: 90 }]}>{change.new_remarks || ''}</Text>
                    </View>)}
                    {(item.events || []).map((event, index) => <Text key={`event-${index}`} style={[styles.eventText, { color: theme.textSub }]}>{event.actor} · {String(event.action).replace(/_/g, ' ')} · {formatDate(event.created_at)}{event.note ? ` · ${event.note}` : ''}</Text>)}
                    {view === 'awaiting' && <View style={styles.actions}>
                      <TouchableOpacity style={[styles.secondaryAction, { borderColor: theme.danger, backgroundColor: theme.card }]} onPress={() => startReview('change', item, 'reject')}><Text style={[styles.secondaryText, { color: theme.danger }]}>Reject</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.primaryAction, { backgroundColor: theme.success }]} onPress={() => startReview('change', item, 'approve')}><Text style={styles.primaryText}>Approve and publish</Text></TouchableOpacity>
                    </View>}
                  </View>}
                </View>;
              })}
            </>}

            {filteredSubmissions.length === 0 && filteredChangeRequests.length === 0 && <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}><Ionicons name="checkmark" size={21} color={theme.primary} /></View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>{requestSearch.trim() || requestFilter !== 'all' || hasRequestFilters ? 'No matching requests' : (view === 'approved' ? 'No request history yet' : 'Nothing awaiting approval')}</Text>
              <Text style={[styles.cardMeta, { color: theme.textSub }]}>{requestSearch.trim() || requestFilter !== 'all' || hasRequestFilters ? 'Try another search or adjust your filters.' : (view === 'approved' ? 'Finalized grade sheets and completed grade change requests will appear here.' : 'Chair-approved grade sheets and grade-change requests will appear here.')}</Text>
            </View>}
          </>
        )}
      </ScrollView>

      <Modal visible={!!review} transparent animationType="fade" onRequestClose={() => !saving && setReview(null)}>
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{review?.decision === 'approve' ? (review?.type === 'submission' ? 'Finalize grades' : 'Approve grade changes') : (review?.type === 'submission' ? 'Return to Chair' : 'Reject grade changes')}</Text>
            <Text style={[styles.modalHint, { color: theme.textSub }]}>{review?.decision === 'approve' ? 'Confirm this review action.' : 'Add a note explaining this decision.'}</Text>
            <TextInput value={note} onChangeText={setNote} placeholder={review?.type === 'change' ? 'Review note (required when rejecting)' : 'Review note (required when returning)'} placeholderTextColor={theme.textMuted} multiline style={[styles.noteInput, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]} />
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.secondaryAction, { borderColor: theme.border }]} onPress={() => setReview(null)} disabled={saving}><Text style={[styles.secondaryText, { color: theme.textSub }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryAction, { backgroundColor: review?.decision === 'approve' ? theme.success : theme.danger }]} onPress={submitReview} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Confirm</Text>}</TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function GradeRequestFilterGroup({ label, options, value, onChange, allLabel, theme, formatLabel = option => option }) {
  return (
    <>
      <Text style={[styles.filterLabel, { color: theme.textSub }]}>{label}</Text>
      <View style={styles.filterOptions}>
        {[...(allLabel ? [{ key: 'all', label: allLabel }] : []), ...options.map(option => typeof option === 'string' ? ({ key: option, label: formatLabel(option) }) : option)].map(option => (
          <TouchableOpacity key={`${label}-${option.key}`} style={[styles.filterOption, { backgroundColor: theme.card, borderColor: theme.border }, value === option.key && { backgroundColor: theme.primaryLight, borderColor: theme.primary }]} onPress={() => onChange(option.key)}>
            <Text style={[styles.filterOptionText, { color: theme.textSub }, value === option.key && { color: theme.primary, fontWeight: '800' }]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

function formatSemester(value) {
  const normalized = String(value).toLowerCase();
  if (normalized === '1st') return '1st semester';
  if (normalized === '2nd') return '2nd semester';
  return normalized === 'summer' ? 'Summer' : value;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Date unavailable';
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 700, alignSelf: 'center', paddingHorizontal: 16, paddingTop: HEADER_TOP, paddingBottom: 28 },
  title: { fontSize: 24, fontFamily: 'serif', fontWeight: '700' },
  subtitle: { fontSize: 10, marginTop: 2 },
  tabs: { width: '100%', alignSelf: 'stretch', flexDirection: 'row', padding: 3, borderWidth: 1, borderRadius: 12, gap: 4, marginTop: 15, marginBottom: 8 },
  tabSlot: { flex: 1, minWidth: 0 },
  requestTabs: { width: '100%', flexDirection: 'row', padding: 3, borderWidth: 1, borderRadius: 12, gap: 4, marginBottom: 12 },
  requestTab: { flex: 1, flexBasis: 0, minWidth: 0, minHeight: 31, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  requestTabText: { fontSize: 10, fontWeight: '700' },
  requestTools: { marginBottom: 5 },
  requestSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  requestSearchBox: { flex: 1, height: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  requestSearchInput: { flex: 1, fontSize: 11, paddingVertical: 6 },
  requestFilterButton: { minHeight: 40, paddingHorizontal: 9, borderWidth: 1, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  requestFilterButtonText: { fontSize: 10, fontWeight: '600' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 7 },
  filterChip: { minHeight: 30, paddingHorizontal: 11, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  filterText: { fontSize: 9, fontWeight: '700' },
  filterBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(35,20,24,0.38)' },
  filterSheet: { maxHeight: '82%', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14 },
  filterSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 15, borderBottomWidth: 1 },
  filterSheetTitle: { fontSize: 17, fontWeight: '800' },
  filterSheetSubtitle: { fontSize: 11, marginTop: 3 },
  filterClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  filterSheetBody: { paddingTop: 16, paddingBottom: 10 },
  filterLabel: { fontSize: 11, fontWeight: '800', marginTop: 7, marginBottom: 8 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 11 },
  filterOption: { minHeight: 36, paddingHorizontal: 13, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  filterOptionText: { fontSize: 11, fontWeight: '600' },
  filterSheetActions: { flexDirection: 'row', gap: 9, paddingTop: 12, borderTopWidth: 1 },
  filterReset: { flex: 1, height: 43, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  filterResetText: { fontSize: 12, fontWeight: '700' },
  filterDone: { flex: 1.5, height: 43, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  filterDoneText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  csvTools: { borderWidth: 1, borderRadius: 13, padding: 11, marginBottom: 11 },
  csvTitle: { fontSize: 11, fontWeight: '800' },
  csvHint: { fontSize: 9, marginTop: 3, marginBottom: 8 },
  csvButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  csvButton: { minHeight: 34, paddingHorizontal: 10, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  csvButtonText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  csvButtonSecondary: { borderWidth: 1, backgroundColor: 'transparent' },
  csvButtonSecondaryText: { fontSize: 9, fontWeight: '700' },
  searchInput: { minHeight: 42, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 11, marginBottom: 10 },
  tab: { width: '100%', minHeight: 37, paddingHorizontal: 8, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  tabTextActive: { color: '#fff', fontWeight: '800' },
  loading: { flex: 1, minHeight: 260, justifyContent: 'center', alignItems: 'center' },
  card: { borderWidth: 1, borderRadius: 14, marginBottom: 9, overflow: 'hidden' },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
  cardTitle: { fontSize: 12, fontWeight: '800' },
  cardMeta: { fontSize: 9, marginTop: 3 },
  details: { borderTopWidth: 1, padding: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '800' },
  gradeRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 5 },
  studentGrade: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  loadMore: { minHeight: 40, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  studentName: { fontSize: 10, fontWeight: '700' },
  scoreBlock: { minWidth: 70, alignItems: 'flex-end' },
  score: { fontSize: 11, fontWeight: '800' },
  remarks: { fontSize: 9, marginTop: 2, textAlign: 'right' },
  eventText: { fontSize: 9, lineHeight: 14, paddingVertical: 4 },
  eventActor: { fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  primaryAction: { flex: 1, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  primaryText: { color: '#fff', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  secondaryAction: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  secondaryText: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  requestHeading: { marginTop: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  badgeText: { fontSize: 8, fontWeight: '800' },
  reason: { fontSize: 10, lineHeight: 15, marginBottom: 6 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 5 },
  changeScores: { minWidth: 95 },
  emptyCard: { minHeight: 260, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 24, marginTop: 5 },
  emptyIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyTitle: { fontSize: 15, fontFamily: 'serif', fontWeight: '700', marginBottom: 3 },
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(20,12,14,0.45)', padding: 20 },
  modalCard: { borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  modalHint: { fontSize: 10, marginTop: 4 },
  noteInput: { minHeight: 90, borderWidth: 1, borderRadius: 11, padding: 11, textAlignVertical: 'top', marginTop: 12, fontSize: 11 },
});
