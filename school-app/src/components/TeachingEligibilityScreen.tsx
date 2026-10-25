import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import api from '../api';
import { useTheme } from '../theme-context';

type Mode = 'teacher' | 'chair' | 'ownership';
type Option = { id: number; name: string };
type Subject = Option & { code: string; course?: string; strand?: string; department_id?: number; department?: Option };
type Eligibility = {
  id: number; status: string; source: string; qualification?: string; remarks?: string;
  subject: Subject; teacher?: Option & { email: string }; reviewer?: Option;
};
type Data = {
  rows: { data: (Eligibility | Subject)[]; current_page: number; last_page: number };
  subjects?: Subject[]; teachers?: (Option & { email: string })[]; departments?: (Option & { is_active: boolean })[];
  department?: Option;
};

function Select({ label, value, options, onChange, disabled = false }: {
  label: string; value: number | null; options: Option[]; onChange: (id: number) => void; disabled?: boolean;
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  return <View>
    <Text style={[s.label, { color: theme.text }]}>{label}</Text>
    <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={() => { setSearch(''); setOpen(true); }} style={[s.input, { borderColor: theme.border }]}>
      <Text style={{ color: theme.text }}>{options.find(option => option.id === value)?.name ?? 'Select…'}</Text>
    </TouchableOpacity>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={s.overlay}><View style={[s.modal, { backgroundColor: theme.card }]}>
        <Text style={[s.heading, { color: theme.text }]}>{label}</Text>
        <TextInput accessibilityLabel={`Search ${label}`} placeholder="Search…" placeholderTextColor={theme.textMuted} value={search} onChangeText={setSearch} style={[s.input, { color: theme.text, borderColor: theme.border }]} />
        <ScrollView keyboardShouldPersistTaps="handled">
          {options.filter(option => option.name.toLowerCase().includes(search.toLowerCase())).map(option => <TouchableOpacity accessibilityRole="button" key={option.id} style={s.option} onPress={() => { onChange(option.id); setOpen(false); }}>
            <Text style={{ color: theme.text }}>{option.name}</Text>
          </TouchableOpacity>)}
        </ScrollView>
        <TouchableOpacity accessibilityRole="button" style={s.option} onPress={() => setOpen(false)}><Text style={{ color: theme.primary }}>Close</Text></TouchableOpacity>
      </View></View>
    </Modal>
  </View>;
}

export default function TeachingEligibilityScreen({ mode }: { mode: Mode }) {
  const { theme } = useTheme();
  const [data, setData] = useState<Data | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [qualification, setQualification] = useState('');
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [owners, setOwners] = useState<Record<number, number>>({});
  const endpoint = mode === 'teacher' ? 'mine' : mode === 'chair' ? 'department' : 'subject-departments';
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/teaching-eligibility/${endpoint}`, { params: { page } });
      setData(response.data);
      setError('');
    } catch (failure) {
      setError(failure.response?.data?.message || 'Could not load teaching eligibility.');
    } finally { setLoading(false); }
  }, [endpoint, page]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const mutate = async (path: string, payload: object, method: 'post' | 'put' = 'post', reset?: () => void) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await api[method](`/teaching-eligibility/${path}`, payload);
      setMessage(response.data.message);
      reset?.();
      await load();
    } catch (failure) {
      const errors = failure.response?.data?.errors;
      setError(errors ? Object.values(errors).flat().join('\n') : failure.response?.data?.message || 'Could not save. Please try again.');
    } finally { setBusy(false); }
  };
  const button = (label: string, action: () => void, disabled = false) => <TouchableOpacity accessibilityRole="button" disabled={busy || loading || disabled} onPress={action} style={[s.button, { backgroundColor: theme.primary, opacity: busy || loading || disabled ? 0.5 : 1 }]}><Text style={s.buttonText}>{label}</Text></TouchableOpacity>;
  const input = (label: string, value: string, onChange: (text: string) => void, maxLength = 2000) => <View>
    <Text style={[s.label, { color: theme.text }]}>{label}</Text>
    <TextInput accessibilityLabel={label} multiline editable={!busy} value={value} onChangeText={onChange} maxLength={maxLength} style={[s.input, s.notes, { color: theme.text, borderColor: theme.border }]} />
  </View>;

  return <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Text style={[s.title, { color: theme.text }]}>{mode === 'ownership' ? 'Subject Departments' : mode === 'chair' ? 'Teaching Approvals' : 'Teaching Subjects'}</Text>
    <Text style={[s.description, { color: theme.textSub }]}>{mode === 'ownership'
      ? 'Choose the department responsible for each subject. Changing ownership requires new teaching approvals. Course applicability stays separate.'
      : mode === 'chair' ? `${data?.department?.name ?? 'Your department'}: review requests or approve teachers directly. Eligibility does not assign a class.`
        : 'Request subjects and describe your qualifications. The managing department chair decides eligibility; approval does not guarantee a class.'}</Text>
    {loading && <ActivityIndicator color={theme.primary} />}
    {!!error && <Text accessibilityRole="alert" style={[s.description, { color: theme.danger }]}>{error}</Text>}
    {!!message && <Text style={[s.description, { color: theme.success }]}>{message}</Text>}
    {button('Refresh', () => { void load(); })}
    {!!data && mode !== 'ownership' && <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[s.heading, { color: theme.text }]}>{mode === 'chair' ? 'Approve a teacher directly' : 'Request a subject'}</Text>
      <Select label="Subject" disabled={busy} value={subjectId} options={(data.subjects ?? []).map(subject => ({ id: subject.id, name: `${subject.code} — ${subject.name} · ${subject.department?.name} · ${subject.course || subject.strand || 'General'}` }))} onChange={setSubjectId} />
      {mode === 'chair' && <Select label="Teacher" disabled={busy} value={teacherId} options={(data.teachers ?? []).map(teacher => ({ ...teacher, name: `${teacher.name} · ${teacher.email}` }))} onChange={setTeacherId} />}
      {input(mode === 'chair' ? 'Basis for approval' : 'Qualifications and teaching experience', qualification, setQualification, mode === 'chair' ? 2000 : 4000)}
      {button(mode === 'chair' ? 'Approve eligibility' : 'Send request', () => { void mutate(mode === 'chair' ? 'grants' : 'requests', mode === 'chair'
        ? { subject_id: subjectId, teacher_id: teacherId, remarks: qualification }
        : { subject_id: subjectId, qualification }, 'post', () => { setSubjectId(null); setTeacherId(null); setQualification(''); }); }, !subjectId || !qualification.trim() || (mode === 'chair' && !teacherId))}
      {!data.subjects?.length && <Text style={{ color: theme.textSub }}>No subjects available. Subjects need an active managing department; pending or approved requests cannot be submitted again.</Text>}
    </View>}
    {data?.rows.data.map(row => {
      if (mode === 'ownership') {
        const subject = row as Subject;
        const owner = owners[subject.id] ?? subject.department_id ?? 0;
        return <View key={subject.id} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[s.heading, { color: theme.text }]}>{subject.code} — {subject.name}</Text>
          <Text style={{ color: theme.textSub }}>{subject.course || subject.strand || 'General subject'} · {subject.department?.name ?? 'Unassigned'}</Text>
          <Select label="Managing department" value={owner} disabled={busy} options={[{ id: 0, name: 'Unassigned' }, ...(data.departments ?? []).map(department => ({ ...department, name: `${department.name}${department.is_active ? '' : ' (inactive)'}` }))]} onChange={id => setOwners(previous => ({ ...previous, [subject.id]: id }))} />
          {button('Save department', () => { void mutate(`subject-departments/${subject.id}`, { department_id: owner || null }, 'put'); })}
        </View>;
      }
      const eligibility = row as Eligibility;
      return <View key={eligibility.id} style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[s.heading, { color: theme.text }]}>{eligibility.subject.code} — {eligibility.subject.name}</Text>
        <Text style={{ color: theme.primary }}>{eligibility.status.toUpperCase()} · {eligibility.source === 'chair_assignment' ? 'Chair assignment' : 'Teacher request'}</Text>
        <Text style={{ color: theme.textSub }}>{eligibility.subject.department?.name ?? 'No managing department'}</Text>
        {mode === 'chair' && <Text style={{ color: theme.text }}>{eligibility.teacher?.name} · {eligibility.teacher?.email}</Text>}
        {!!eligibility.qualification && <Text style={{ color: theme.text }}>Qualifications: {eligibility.qualification}</Text>}
        {!!eligibility.remarks && <Text style={{ color: theme.text }}>Remarks: {eligibility.remarks}</Text>}
        {!!eligibility.reviewer && <Text style={{ color: theme.textSub }}>Reviewed by {eligibility.reviewer.name}</Text>}
        {mode === 'chair' && ['pending', 'approved'].includes(eligibility.status) && <>
          {input(eligibility.status === 'pending' ? 'Remarks (required for rejection)' : 'Reason for revocation', notes[eligibility.id] ?? '', value => setNotes(previous => ({ ...previous, [eligibility.id]: value })))}
          {eligibility.status === 'pending' ? <>
            {button('Approve', () => { void mutate(`${eligibility.id}/review`, { decision: 'approve', remarks: notes[eligibility.id] || null }); })}
            {button('Reject', () => { void mutate(`${eligibility.id}/review`, { decision: 'reject', remarks: notes[eligibility.id] }); }, !notes[eligibility.id]?.trim())}
          </> : button('Revoke eligibility', () => { void mutate(`${eligibility.id}/revoke`, { remarks: notes[eligibility.id] }); }, !notes[eligibility.id]?.trim())}
        </>}
      </View>;
    })}
    {!!data && data.rows.data.length === 0 && <Text style={[s.description, { color: theme.textSub }]}>No records yet.</Text>}
    {!!data && <View style={s.pagination}>
      {button('Previous', () => setPage(page - 1), page <= 1)}
      <Text style={{ color: theme.text }}>{data.rows.current_page} / {data.rows.last_page}</Text>
      {button('Next', () => setPage(page + 1), page >= data.rows.last_page)}
    </View>}
  </ScrollView>;
}

const s = StyleSheet.create({
  content: { padding: 16, paddingTop: 48, paddingBottom: 110, gap: 12 },
  title: { fontSize: 24, fontWeight: '800' }, description: { fontSize: 14, lineHeight: 21 },
  heading: { fontSize: 16, fontWeight: '700' }, label: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 12 },
  input: { padding: 12, borderRadius: 8, borderWidth: 1, fontSize: 14 }, notes: { minHeight: 80, textAlignVertical: 'top' },
  button: { padding: 12, borderRadius: 8, alignItems: 'center' }, buttonText: { color: '#fff', fontWeight: '700' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 },
  modal: { maxHeight: '80%', padding: 20, borderRadius: 14, gap: 12 }, option: { paddingVertical: 16 },
});
