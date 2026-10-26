// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

export default function StudyLoad() {
  const router = useRouter();
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [fees, setFees] = useState({ fees: [], total_due: 0, total_paid: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState('current');

  const loadStudyLoad = async (selectedView) => {
    try {
      const [subjectsRes, feesRes] = await Promise.all([
        api.get('/my-subjects', { params: { view: selectedView } }),
        api.get('/my-fees'),
      ]);
      setData(subjectsRes.data);
      setFees(feesRes.data);
    } catch (error) {
      console.log('Study load error:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { Promise.resolve().then(() => loadStudyLoad(view)); }, [view]);

  const subjects = useMemo(() => data?.subjects ?? [], [data?.subjects]);
  const totals = useMemo(() => subjects.reduce((sum, subject) => {
    const lec = Number(subject.units_lec || 0);
    const lab = Number(subject.units_lab || 0);
    return { lec: sum.lec + lec, lab: sum.lab + lab, units: sum.units + lec + lab };
  }, { lec: 0, lab: 0, units: 0 }), [subjects]);
  const term = data?.active_term;
  const termLabel = view === 'past' ? 'Previous enrollments' : term ? `${term.semester?.replace(/^./, char => char.toUpperCase()) || ''} Semester · A.Y. ${term.school_year || ''}` : 'Current enrollment';

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStudyLoad(view); }} tintColor={theme.primary} />}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to More" onPress={() => router.back()} style={[styles.backButton, { backgroundColor: theme.card }]}><Ionicons name="chevron-back" size={20} color={theme.text} /></TouchableOpacity>
          <View style={styles.headerCopy}><Text style={[styles.term, { color: theme.textSub }]}>{termLabel}</Text><Text style={[styles.title, { color: theme.text }]}>Study Load</Text></View>
          <View style={[styles.logoWrap, { backgroundColor: theme.card }]}><Image source={require('../../assets/images/schoolbuds-favicon.png')} style={styles.logo} resizeMode="contain" /></View>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Stat value={subjects.length} label="Subjects" theme={theme} />
          <Divider theme={theme} />
          <Stat value={totals.units} label="Units" theme={theme} />
          <Divider theme={theme} />
          <Stat value={totals.lec} label="Lecture" theme={theme} />
          <Divider theme={theme} />
          <Stat value={totals.lab} label="Lab" theme={theme} />
        </View>

        <View style={[styles.switcher, { backgroundColor: theme.primaryLight }]}>
          {['current', 'past'].map(option => <TouchableOpacity key={option} style={[styles.switchTab, view === option && { backgroundColor: theme.card }]} onPress={() => { if (view !== option) { setLoading(true); setView(option); } }} activeOpacity={0.8}><Text style={[styles.switchText, { color: view === option ? theme.text : theme.textSub }]}>{option === 'current' ? 'Current' : 'Past'}</Text></TouchableOpacity>)}
        </View>

        {loading ? <View style={styles.loading}><ActivityIndicator size="large" color={theme.primary} /></View> : <>
          {view === 'current' && <><View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: theme.text }]}>Tuition and fees</Text><Text style={[styles.sectionMeta, { color: theme.textSub }]}>{fees.fees?.length ? `${fees.fees.length} posted` : 'None posted'}</Text></View>
          <View style={[styles.feeCard, { backgroundColor: theme.card }]}>
            <View style={styles.feeTotals}>
              <FeeTotal label="Paid" value={fees.total_paid} theme={theme} />
              <FeeTotal label="Remaining" value={fees.total_due} theme={theme} />
            </View>
            {fees.fees?.length ? fees.fees.map(fee => <View key={fee.id} style={[styles.feeRow, { borderTopColor: theme.border }]}><Text style={[styles.feeName, { color: theme.text }]}>{fee.name || 'Tuition fee'}</Text><Text style={[styles.feeAmount, { color: theme.textSub }]}>₱{Number(Math.max(0, Number(fee.amount || 0) - Number(fee.paid_amount || 0))).toFixed(2)}</Text></View>) : <Text style={[styles.feeNote, { color: theme.textSub }]}>No tuition fees posted yet. We’ll notify you when the registrar adds them.</Text>}
          </View></>}

          <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: theme.text }]}>Enrolled subjects</Text><Text style={[styles.sectionMeta, { color: theme.textSub }]}>{subjects.length} subject{subjects.length === 1 ? '' : 's'}</Text></View>
          {subjects.length === 0 ? <View style={[styles.emptyCard, { backgroundColor: theme.card }]}><Text style={[styles.emptyTitle, { color: theme.text }]}>{view === 'past' ? 'No past subjects' : 'No study load yet'}</Text><Text style={[styles.emptyText, { color: theme.textSub }]}>{view === 'past' ? 'Previous enrolled subjects will appear here.' : 'Your enrolled subjects will appear here once assigned.'}</Text></View> : <View style={[styles.subjectGroup, { backgroundColor: theme.card }]}>{subjects.map((subject, index) => <SubjectRow key={`${subject.subject_id || subject.id}-${index}`} subject={subject} isLast={index === subjects.length - 1} theme={theme} />)}</View>}
        </>}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label, theme }) { return <View style={styles.stat}><Text style={[styles.statValue, { color: theme.text }]}>{value}</Text><Text style={[styles.statLabel, { color: theme.textSub }]}>{label}</Text></View>; }
function Divider({ theme }) { return <View style={[styles.statDivider, { backgroundColor: theme.border }]} />; }
function FeeTotal({ label, value, theme }) { return <View style={[styles.feeTotal, { backgroundColor: theme.bg }]}><Text style={[styles.feeTotalLabel, { color: theme.textSub }]}>{label}</Text><Text style={[styles.feeTotalValue, { color: theme.text }]}>₱{Number(value || 0).toFixed(2)}</Text></View>; }
function SubjectRow({ subject, isLast, theme }) {
  const units = Number(subject.units_lec || 0) + Number(subject.units_lab || 0);
  const code = subject.code || 'SUBJ';
  return <View style={[styles.subjectRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}><View style={[styles.codePill, { backgroundColor: theme.primaryLight }]}><Text style={[styles.codeText, { color: theme.primary }]} numberOfLines={1}>{code}</Text></View><View style={styles.subjectCopy}><Text style={[styles.subjectName, { color: theme.text }]} numberOfLines={1}>{subject.name}</Text><Text style={[styles.schedule, { color: theme.textSub }]} numberOfLines={1}>{scheduleFor(subject)}</Text></View><View style={styles.unitCopy}><Text style={[styles.unitText, { color: theme.textSub }]}>{units} units</Text><Text style={[styles.labText, { color: theme.textSub }]}>{subject.units_lec || 0} / {subject.units_lab || 0}</Text></View></View>;
}
function scheduleFor(subject) {
  const time = subject.time_start || subject.time_end ? `${subject.time_start || ''}${subject.time_end ? `–${subject.time_end}` : ''}` : 'Schedule TBA';
  const day = subject.day || '';
  const room = subject.room ? ` · ${subject.room}` : '';
  return day ? `${day} · ${time}${room}` : `${time}${room}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: 16, paddingTop: 42, paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 }, backButton: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 }, headerCopy: { flex: 1 }, term: { fontSize: 11, fontWeight: '600', marginBottom: 1 }, title: { fontSize: 22, fontWeight: '800' },
  logoWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, logo: { width: 31, height: 31, borderRadius: 8 },
  statCard: { height: 62, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7 }, stat: { flex: 1, alignItems: 'center' }, statValue: { fontSize: 16, fontWeight: '900' }, statLabel: { fontSize: 9, fontWeight: '700', marginTop: 3 }, statDivider: { width: StyleSheet.hairlineWidth, height: 32 },
  switcher: { height: 34, borderRadius: 10, padding: 3, flexDirection: 'row', marginTop: 13 }, switchTab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }, switchText: { fontSize: 11, fontWeight: '800' },
  loading: { height: 300, justifyContent: 'center', alignItems: 'center' }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 8 }, sectionTitle: { fontSize: 14, fontWeight: '800' }, sectionMeta: { fontSize: 10, fontWeight: '700' },
  feeCard: { borderRadius: 14, padding: 14 }, feeTotals: { flexDirection: 'row', gap: 9 }, feeTotal: { flex: 1, borderRadius: 11, padding: 10 }, feeTotalLabel: { fontSize: 10, fontWeight: '700' }, feeTotalValue: { fontSize: 15, fontWeight: '900', marginTop: 2 }, feeNote: { fontSize: 11, lineHeight: 15, marginTop: 10 }, feeRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9, marginTop: 9 }, feeName: { fontSize: 12, fontWeight: '700' }, feeAmount: { fontSize: 12, fontWeight: '800' },
  subjectGroup: { borderRadius: 14, overflow: 'hidden' }, subjectRow: { height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, codePill: { width: 38, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 9 }, codeText: { fontSize: 8, fontWeight: '900' }, subjectCopy: { flex: 1, minWidth: 0 }, subjectName: { fontSize: 12, fontWeight: '800' }, schedule: { fontSize: 9, fontWeight: '600', marginTop: 3 }, unitCopy: { width: 42, alignItems: 'flex-end' }, unitText: { fontSize: 9, fontWeight: '800' }, labText: { fontSize: 9, marginTop: 3 },
  emptyCard: { borderRadius: 14, padding: 22, alignItems: 'center' }, emptyTitle: { fontSize: 14, fontWeight: '800' }, emptyText: { fontSize: 11, textAlign: 'center', marginTop: 5 },
});
