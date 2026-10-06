// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import HeaderGradient from './ui/HeaderGradient';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

const ROLE_LABELS = {
  admin: 'Admins',
  registrar: 'Registrars',
  faculty: 'Faculty',
  teacher: 'Faculty',
  parent: 'Parents',
  staff: 'Staff',
  student: 'Students',
};

const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  active: 'Active',
  inactive: 'Inactive',
  graduated: 'Graduated',
};

export default function SystemReportScreen({ scope = 'admin' }) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState({
    users: [],
    students: [],
    enrollments: [],
    courses: [],
    subjects: [],
    sections: [],
    activities: [],
  });

  const isAdmin = scope === 'admin';

  const load = useCallback(async () => {
    try {
      const requests = [
        isAdmin ? api.get('/admin/users') : Promise.resolve({ data: [] }),
        api.get(isAdmin ? '/admin/students' : '/registrar/students'),
        api.get('/registrar/enrollments'),
        api.get('/courses'),
        api.get('/subjects'),
        api.get('/sections'),
        isAdmin ? api.get('/admin/activity-logs') : Promise.resolve({ data: { logs: [] } }),
      ];

      const [usersRes, studentsRes, enrollmentsRes, coursesRes, subjectsRes, sectionsRes, activitiesRes] =
        await Promise.all(requests);

      setData({
        users: asList(usersRes.data?.users ?? usersRes.data),
        students: asList(studentsRes.data?.students ?? studentsRes.data),
        enrollments: asList(enrollmentsRes.data?.enrollments ?? enrollmentsRes.data),
        courses: asList(coursesRes.data?.courses ?? coursesRes.data),
        subjects: asList(subjectsRes.data?.subjects ?? subjectsRes.data),
        sections: asList(sectionsRes.data?.sections ?? sectionsRes.data),
        activities: asList(activitiesRes.data?.logs ?? activitiesRes.data),
      });
    } catch (e) {
      console.log('Report load error:', e.message);
      Alert.alert('Could not load report data', e.response?.data?.message || 'Please refresh and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const report = useMemo(() => buildReport(data, isAdmin), [data, isAdmin]);

  const generatePdf = async () => {
    setGenerating(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildHtml(report, isAdmin) });
      if (Platform.OS !== 'web' && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share system report',
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Share.share({ message: report.plainText });
      }
    } catch (e) {
      Alert.alert('Could not generate report', e.message || 'Please try again.');
    } finally {
      setGenerating(false);
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
    <ScrollView
      style={[s.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={{ paddingBottom: 110 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <HeaderGradient
        title="Reports"
        subtitle={`${isAdmin ? 'System-wide' : 'Registrar'} snapshot generated from live school records.`}
        initials="RP"
        stats={[
          { label: 'Students', value: report.totals.students, accent: theme.green },
          { label: 'Enrollments', value: report.totals.enrollments, accent: theme.orange },
          { label: 'Sections', value: report.totals.sections, accent: theme.purple },
        ]}
      />

      <View style={s.actions}>
        <TouchableOpacity
          style={[s.generateBtn, { backgroundColor: theme.primary }, generating && { opacity: 0.7 }]}
          onPress={generatePdf}
          disabled={generating}
        >
          {generating ? <ActivityIndicator color="#fff" /> : <Text style={s.generateText}>Generate PDF report</Text>}
        </TouchableOpacity>
        <Text style={[s.generatedAt, { color: theme.textSub }]}>Last refreshed {report.generatedAt}</Text>
      </View>

      <View style={s.grid}>
        {report.cards.map(card => (
          <View key={card.label} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[s.cardValue, { color: theme.text }]}>{card.value}</Text>
            <Text style={[s.cardLabel, { color: theme.textSub }]}>{card.label}</Text>
          </View>
        ))}
      </View>

      <ReportSection title="Student Status" rows={report.studentStatus} theme={theme} />
      <ReportSection title="Enrollment Status" rows={report.enrollmentStatus} theme={theme} />
      <ReportSection title="Course Programs" rows={report.coursePrograms} theme={theme} />
      {isAdmin ? <ReportSection title="User Roles" rows={report.userRoles} theme={theme} /> : null}
      {isAdmin ? <ReportSection title="Recent Activity" rows={report.activityRows} theme={theme} /> : null}
    </ScrollView>
  );
}

function ReportSection({ title, rows, theme }) {
  return (
    <View style={[s.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[s.panelTitle, { color: theme.text }]}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={[s.emptyText, { color: theme.textSub }]}>No data available.</Text>
      ) : rows.map(row => (
        <View key={row.label} style={[s.row, { borderBottomColor: theme.border }]}>
          <Text style={[s.rowLabel, { color: theme.textSub }]}>{row.label}</Text>
          <Text style={[s.rowValue, { color: theme.text }]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function buildReport(data, isAdmin) {
  const generatedAt = new Date().toLocaleString();
  const studentStatus = countRows(data.students, item => STATUS_LABELS[item.status] || titleize(item.status || 'active'));
  const enrollmentStatus = countRows(data.enrollments, item => STATUS_LABELS[item.status] || titleize(item.status || 'pending'));
  const coursePrograms = countRows(data.courses, item => item.program_type === 'shs' ? 'SHS' : 'College');
  const userRoles = countRows(data.users, item => ROLE_LABELS[item.role] || titleize(item.role || 'Unknown'));
  const activityRows = data.activities.slice(0, 5).map(item => ({
    label: item.description || titleize(item.action || 'Activity'),
    value: item.created_at ? new Date(item.created_at).toLocaleDateString() : '',
  }));

  const totals = {
    users: data.users.length,
    students: data.students.length,
    enrollments: data.enrollments.length,
    courses: data.courses.length,
    subjects: data.subjects.length,
    sections: data.sections.length,
    activities: data.activities.length,
  };

  const cards = [
    ...(isAdmin ? [{ label: 'Users', value: totals.users }] : []),
    { label: 'Students', value: totals.students },
    { label: 'Enrollments', value: totals.enrollments },
    { label: 'Courses', value: totals.courses },
    { label: 'Subjects', value: totals.subjects },
    { label: 'Sections', value: totals.sections },
    ...(isAdmin ? [{ label: 'Activity Logs', value: totals.activities }] : []),
  ];

  const plainText = [
    `${isAdmin ? 'Admin' : 'Registrar'} System Report`,
    `Generated: ${generatedAt}`,
    '',
    ...cards.map(card => `${card.label}: ${card.value}`),
  ].join('\n');

  return { generatedAt, totals, cards, studentStatus, enrollmentStatus, coursePrograms, userRoles, activityRows, plainText };
}

function buildHtml(report, isAdmin) {
  const sections = [
    ['Summary', report.cards],
    ['Student Status', report.studentStatus],
    ['Enrollment Status', report.enrollmentStatus],
    ['Course Programs', report.coursePrograms],
    ...(isAdmin ? [['User Roles', report.userRoles], ['Recent Activity', report.activityRows]] : []),
  ];

  return `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; padding: 28px; }
          h1 { margin: 0; font-size: 28px; }
          .meta { color: #64748B; margin: 6px 0 24px; }
          h2 { font-size: 16px; margin: 22px 0 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
          td { border: 1px solid #E5E7EB; padding: 10px; font-size: 13px; }
          td:last-child { text-align: right; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>${isAdmin ? 'Admin' : 'Registrar'} System Report</h1>
        <div class="meta">Generated ${escapeHtml(report.generatedAt)}</div>
        ${sections.map(([title, rows]) => `
          <h2>${escapeHtml(title)}</h2>
          <table>
            ${rows.length ? rows.map(row => `
              <tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(String(row.value))}</td></tr>
            `).join('') : '<tr><td colspan="2">No data available.</td></tr>'}
          </table>
        `).join('')}
      </body>
    </html>
  `;
}

function countRows(items, getLabel) {
  const counts = items.reduce((acc, item) => {
    const label = getLabel(item);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return Object.keys(counts).sort().map(label => ({ label, value: counts[label] }));
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function titleize(value) {
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { paddingHorizontal: 16, marginBottom: 12 },
  generateBtn: { borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  generateText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  generatedAt: { fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 4 },
  card: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 12, padding: 14 },
  cardValue: { fontSize: 24, fontWeight: '900' },
  cardLabel: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  panel: { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderRadius: 12, padding: 14 },
  panelTitle: { fontSize: 15, fontWeight: '900', marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 9, borderBottomWidth: 1 },
  rowLabel: { flex: 1, fontSize: 12, fontWeight: '800' },
  rowValue: { fontSize: 13, fontWeight: '900' },
  emptyText: { fontSize: 12, fontWeight: '700', paddingTop: 6 },
});
