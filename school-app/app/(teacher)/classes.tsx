// @ts-nocheck
// app/(teacher)/classes.tsx — Teacher dashboard (fully polished)

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity, RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../src/api';
import { Colors, Font, Radius, Shadow, HEADER_TOP } from '../../src/theme';
import { useTheme } from '../../src/theme-context';

export default function Classes() {
  const router = useRouter();
  const { theme } = useTheme();
  const ACCENT = ['#1FB783', '#388AF6', '#F0502B', '#8751BB'];
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [classFilter, setClassFilter] = useState('all');

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/teacher/dashboard');
      setData(res.data);
    } catch (e) {
      console.log('Teacher dashboard error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, []);

  const openClassDetails = async (classItem) => {
    setSelectedClass(classItem);
    setSelectedStudents([]);
    setDetailsOpen(true);
    setDetailsLoading(true);

    try {
      const res = await api.get(`/teacher/class/${classItem.id}/students`);
      setSelectedStudents(res.data?.students ?? []);
    } catch (e) {
      console.log('Class details error:', e.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  if (loading) return (
    <View style={[styles.center, { backgroundColor: theme.bg }]}>
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );

  const greeting = `Teacher · S.Y. ${data?.classes?.[0]?.school_year || '2025–2026'}`;
  const todayClasses = (() => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const shortToday = today.slice(0, 3);
    return (data?.classes ?? []).filter(classItem => {
      const schedule = `${classItem.day ?? ''} ${classItem.schedule ?? ''}`.toLowerCase();
      return schedule.includes(today) || new RegExp(`\\b${shortToday}\\b`, 'i').test(schedule);
    });
  })();
  const visibleClasses = classFilter === 'today' ? todayClasses : (data?.classes ?? []);

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchDashboard(); }} />
      }
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
        <View style={styles.headerTitleRow}>
          <Text style={styles.name}>My Classes</Text>
          <View style={styles.headerIcon}><Ionicons name="leaf" size={24} color="#65BA35" /></View>
        </View>
        <Text style={styles.role}>Teacher · S.Y. 2025–2026</Text>
      </View>

      {/* ── Stat cards ── */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statVal, { color: theme.text }]}>{data?.total_classes ?? 0}</Text>
          <Text style={[styles.statLabel, { color: theme.textSub }]}>Classes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statVal, { color: theme.text }]}>{data?.total_students ?? 0}</Text>
          <Text style={[styles.statLabel, { color: theme.textSub }]}>Students</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={[styles.statCard, { backgroundColor: theme.card, borderBottomWidth: 3, borderBottomColor: theme.success }]}> 
          <Text style={[styles.statVal, { color: theme.success }]}>{data?.today_attendance ?? 0}</Text>
          <Text style={[styles.statLabel, { color: theme.textSub }]}>Today</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.classFilter}>
          <TouchableOpacity
            style={[styles.filterButton, classFilter === 'all' && styles.activeFilter]}
            onPress={() => setClassFilter('all')}
            accessibilityRole="button"
            accessibilityState={{ selected: classFilter === 'all' }}
          >
            <Text style={classFilter === 'all' ? styles.activeFilterText : styles.inactiveFilterText}>All {data?.total_classes ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, classFilter === 'today' && styles.activeFilter]}
            onPress={() => setClassFilter('today')}
            accessibilityRole="button"
            accessibilityState={{ selected: classFilter === 'today' }}
          >
            <Text style={classFilter === 'today' ? styles.activeFilterText : styles.inactiveFilterText}>Today {todayClasses.length}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {visibleClasses.length === 0
        ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>{classFilter === 'today' ? 'No classes scheduled for today.' : 'No classes assigned yet.'}</Text>
          </View>
        )
        : visibleClasses.map((c, i) => (
          <View key={i} style={[styles.classCard, { backgroundColor: theme.card }]}> 
            <View style={[styles.classAccent, { backgroundColor: ACCENT[i % ACCENT.length] }]} />
            <View style={styles.classBody}>
              <TouchableOpacity activeOpacity={0.75} onPress={() => openClassDetails(c)}>
              <Text style={styles.classCode}>{String(c.subject || 'Class').split(' - ')[0]}</Text>
              <Text style={[styles.className, { color: theme.text }]}>{String(c.subject || 'Class').split(' - ').slice(1).join(' - ') || c.subject}</Text>
              <Text style={[styles.classMeta, { color: theme.textSub }]}>
                {c.course ? `Year ${c.grade_level}` : `Grade ${c.grade_level}`} - {c.section} · {c.room || 'No room'} · {c.schedule}
              </Text>
              </TouchableOpacity>
              <View style={styles.classActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.primary + '20' }]}
                  onPress={() => router.push({
                    pathname: '/(teacher)/grades',
                    params: { classId: String(c.id), subject: c.subject },
                  })}
                >
                  <Text style={[styles.actionText, { color: theme.primary }]}>Enter grades</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.primary + '20' }]}
                  onPress={() => router.push({
                    pathname: '/(teacher)/attendance',
                    params: { classId: String(c.id), subject: c.subject },
                  })}
                >
                  <Text style={[styles.actionText, { color: theme.primary }]}>Attendance</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.assignmentBtn}
                onPress={() => router.push('/(teacher)/assignments')}
              >
                <Text style={[styles.actionText, { color: theme.success }]}>Assignments and quizzes</Text>
                <Ionicons name="chevron-forward" size={15} color={theme.success} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      }

      {/* ── Recent grades ── */}
      {data?.recent_grades?.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textSub }]}>Recently Entered Grades</Text>
          </View>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            {data.recent_grades.map((g, i) => (
              <View key={i} style={[styles.gradeRow, { borderColor: theme.border }]}>
                <View style={[styles.gradeAvatar, { backgroundColor: theme.primaryLight }]}>
                  <Text style={[styles.gradeAvatarText, { color: theme.primary }]}>
                    {g.student?.first_name?.[0]}{g.student?.last_name?.[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.gradeName, { color: theme.text }]}>
                    {g.student?.first_name} {g.student?.last_name}
                  </Text>
                  <Text style={[styles.gradeMeta, { color: theme.textMuted }]}>{g.school_class?.subject} · Q{g.quarter}</Text>
                </View>
                <Text style={[styles.gradeScore, {
                  color: selectedClass?.is_college
                    ? (g.score <= 2 ? theme.success : g.score <= 3 ? theme.warning : theme.danger)
                    : (g.score >= 85 ? theme.success : g.score >= 75 ? theme.warning : theme.danger),
                }]}>
                  {g.score}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>

    <Modal
      visible={detailsOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setDetailsOpen(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{selectedClass?.subject || 'Class details'}</Text>
              <Text style={[styles.modalMeta, { color: theme.textSub }]}>
                {selectedClass ? `${selectedClass.course ? `Year ${selectedClass.grade_level}` : `Grade ${selectedClass.grade_level}`} - ${selectedClass.section || 'No section'}` : ''}
              </Text>
              <Text style={[styles.modalMeta, { color: theme.textSub }]}>
                {selectedClass ? `${selectedClass.room || 'No room'} - ${selectedClass.schedule || 'No schedule'}` : ''}
              </Text>
            </View>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.bg }]} onPress={() => setDetailsOpen(false)}>
              <Text style={[styles.closeText, { color: theme.text }]}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.modalCount, { backgroundColor: theme.primaryLight }]}>
            <Text style={[styles.modalCountValue, { color: theme.primary }]}>{selectedStudents.length}</Text>
            <Text style={[styles.modalCountLabel, { color: theme.primary }]}>students</Text>
          </View>

          {detailsLoading ? (
            <View style={styles.modalCenter}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : (
            <ScrollView style={styles.studentList} contentContainerStyle={{ paddingBottom: 18 }}>
              {selectedStudents.length === 0 ? (
                <Text style={[styles.modalEmpty, { color: theme.textSub }]}>No students found for this class.</Text>
              ) : selectedStudents.map((student) => (
                <View key={student.id} style={[styles.modalStudentRow, { borderColor: theme.border }]}>
                  <View style={[styles.modalAvatar, { backgroundColor: theme.primaryLight }]}>
                    <Text style={[styles.modalAvatarText, { color: theme.primary }]}>
                      {student.first_name?.[0]}{student.last_name?.[0]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalStudentName, { color: theme.text }]}>
                      {student.first_name} {student.last_name}
                    </Text>
                    <Text style={[styles.modalStudentMeta, { color: theme.textSub }]}>
                      {student.student_id} - {student.reward_points ?? 0} pts
                    </Text>
                    {student.is_irregular ? (
                      <Text style={[styles.irregularLabel, { color: theme.warning }]}>Irregular enrollment</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.bg },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  header:          { backgroundColor: '#F2C8D0', marginHorizontal: 8, borderRadius: 20, paddingTop: HEADER_TOP, paddingBottom: 53, paddingHorizontal: 16, overflow: 'hidden' },
  greeting:        { color: '#765B61', fontSize: 10, fontWeight: '600' },
  headerTitleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 1 },
  name:            { color: '#2A1B1F', fontSize: 20, fontWeight: '900' },
  headerIcon:      { width: 36, height: 36, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#8C6570', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  role:            { display: 'none' },

  statsRow:        {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: -42,
    gap: 0,
    marginBottom: 12,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    minHeight: 57,
  },
  statCard:        {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.card,
  },
  statVal:         { fontSize: 15, fontWeight: '900', color: Colors.text },
  statLabel:       { fontSize: 9, color: Colors.textSub, marginTop: 2 },
  statDivider:     { width: 1, height: 37, backgroundColor: '#ECD6DA' },

  sectionHeader:   { paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle:    { fontSize: Font.sm, fontWeight: '700', color: Colors.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },
  classFilter:     { height: 31, backgroundColor: '#EDE3E5', borderRadius: 10, flexDirection: 'row', padding: 2 },
  filterButton:    { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  activeFilter:    { backgroundColor: '#FFFFFF', shadowColor: '#704A52', shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  activeFilterText:{ fontSize: 10, fontWeight: '900', color: Colors.text },
  inactiveFilterText: { fontSize: 10, fontWeight: '800', color: Colors.textSub },

  classCard:       {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 13,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E7DADD',
  },
  classAccent:     { width: 4 },
  classBody:       { flex: 1, padding: 12 },
  classCode:       { alignSelf: 'flex-start', backgroundColor: '#EEE6E8', color: '#806E73', fontSize: 9, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, marginBottom: 7 },
  className:       { fontSize: 12, fontWeight: '900', color: Colors.text },
  classMeta:       { fontSize: 9, color: Colors.textSub, marginTop: 3, marginBottom: 10 },
  classActions:    { flexDirection: 'row', gap: 8 },
  actionBtn:       { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  assignmentBtn:   { paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionText:      { fontSize: 10, fontWeight: '800' },

  card:            {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 4,
    ...Shadow.card,
  },
  gradeRow:        {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  gradeAvatar:     {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeAvatarText: { fontSize: Font.xs, fontWeight: '700' },
  gradeName:       { fontSize: Font.sm, fontWeight: '500', color: Colors.text },
  gradeMeta:       { fontSize: Font.xs, color: Colors.textMuted, marginTop: 1 },
  gradeScore:      { fontSize: Font.lg, fontWeight: '800' },

  emptyCard:       {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    marginHorizontal: 16,
    padding: 32,
    alignItems: 'center',
    ...Shadow.card,
  },
  emptyIcon:       { fontSize: 40, marginBottom: 10 },
  emptyText:       { fontSize: Font.sm, color: Colors.textMuted },
  modalBackdrop:   {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet:      {
    maxHeight: '82%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  modalHandle:     {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    marginBottom: 14,
  },
  modalHeader:     {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  modalTitle:      { fontSize: Font.lg, fontWeight: '800' },
  modalMeta:       { fontSize: Font.xs, marginTop: 4, lineHeight: 17 },
  closeBtn:        {
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeText:       { fontSize: Font.xs, fontWeight: '700' },
  modalCount:      {
    marginTop: 14,
    borderRadius: Radius.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  modalCountValue: { fontSize: Font.xl, fontWeight: '900' },
  modalCountLabel: { fontSize: Font.xs, fontWeight: '800', textTransform: 'uppercase' },
  modalCenter:     { paddingVertical: 34, alignItems: 'center' },
  studentList:     { marginTop: 10 },
  modalStudentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  modalAvatar:     {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarText: { fontSize: Font.xs, fontWeight: '900' },
  modalStudentName:{ fontSize: Font.sm, fontWeight: '800' },
  modalStudentMeta:{ fontSize: Font.xs, marginTop: 3 },
  irregularLabel: { fontSize: Font.xs, fontWeight: '700', marginTop: 4 },
  modalEmpty:      { textAlign: 'center', paddingVertical: 28, fontSize: Font.sm },
});
