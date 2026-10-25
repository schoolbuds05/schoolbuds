import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../api';
import { useTheme } from '../theme-context';

type Subject = { id: number; code: string; name: string; units_lec: number; units_lab: number };
type Requirement = { subject_id: number; meetings: string; minutes: string };
type Meeting = { day: string; time_start: string; time_end: string; room: string };
type Preview = { batch_id: string; plan: { sections: { name: string; expected_students: number; assignments: { subject_id: number; subject_code: string; teacher_name: string; meetings: Meeting[] }[] }[] } };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const INITIAL = { course_id: '', year_level: '1', semester: '1st', school_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`, expected_students: '100', max_students: '40', time_start: '08:00', time_end: '17:00', rooms: 'Room 101', max_teacher_minutes: '1080' };

export default function SectionGeneration({ onSaved }: { onSaved: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState<{ id: number; name: string }[]>([]);
  const [form, setForm] = useState(INITIAL);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [days, setDays] = useState(DAYS.slice(0, 5));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let active = true;
    api.get('/section-generation/options', { params: { course_id: form.course_id || undefined, year_level: form.year_level, semester: form.semester } })
      .then(response => {
        if (!active) return;
        setCourses(response.data.courses); setSubjects(response.data.subjects);
        setRequirements(response.data.subjects.map((subject: Subject) => ({ subject_id: subject.id, meetings: '3', minutes: '60' })));
      }).catch(err => { if (active) setError(err.response?.data?.message || 'Could not load generation options.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [open, form.course_id, form.year_level, form.semester]);
  const set = (key: keyof typeof form, value: string) => {
    if (['course_id', 'year_level', 'semester'].includes(key)) { setBusy(true); setSubjects([]); setRequirements([]); setError(''); }
    setForm(current => ({ ...current, [key]: value })); setPreview(null);
  };
  const run = async (save: boolean) => {
    setBusy(true); setError('');
    try {
      if (save && preview) {
        await api.post('/section-generation', { batch_id: preview.batch_id });
        setPreview(null); setOpen(false); onSaved();
      } else {
        const result = await api.post('/section-generation/preview', { ...form, days, rooms: form.rooms.split(/\r?\n/).map(room => room.trim()).filter(Boolean), subjects: requirements });
        setPreview(result.data);
      }
    } catch (err: any) {
      setError(Object.values(err.response?.data?.errors || {}).flat().join('\n') || err.response?.data?.message || 'Generation failed. Please try again.');
    } finally { setBusy(false); }
  };
  const button = (label: string, action: () => void, selected = false) => <TouchableOpacity key={label} disabled={busy} onPress={action} style={{ padding: 12, marginVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: theme.border, backgroundColor: selected ? theme.primary : theme.card }}><Text style={{ color: selected ? '#fff' : theme.text }}>{label}</Text></TouchableOpacity>;
  const input = (label: string, value: string, change: (value: string) => void, numeric = false, multiline = false) => <View key={label} style={{ marginVertical: 6 }}><Text style={{ color: theme.text, marginBottom: 4 }}>{label}</Text><TextInput accessibilityLabel={label} editable={!busy} value={value} onChangeText={change} keyboardType={numeric ? 'number-pad' : 'default'} multiline={multiline} style={{ color: theme.text, borderColor: theme.border, borderWidth: 1, padding: 10, borderRadius: 8 }} /></View>;
  return <>
    {button('Generate sections, schedules & teachers', () => { setBusy(true); setError(''); setOpen(true); })}
    <Modal visible={open} animationType="slide" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24, backgroundColor: theme.bg, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: theme.text }}>Generate sections</Text>
        {button('Close', () => setOpen(false))}
        {!!error && <Text accessibilityRole="alert" style={{ color: theme.primary, marginVertical: 12 }}>{error}</Text>}
        {busy && <ActivityIndicator color={theme.primary} />}
        {preview ? <>
          <Text style={{ color: theme.text }}>Preview: {preview.plan.sections.length} sections. Save within 30 minutes. Availability is checked again before saving drafts.</Text>
          {preview.plan.sections.map(section => <View key={section.name} style={{ padding: 12, marginVertical: 8, borderWidth: 1, borderColor: theme.border, borderRadius: 8 }}>
            <Text style={{ color: theme.text, fontWeight: 'bold' }}>{section.name} · {section.expected_students} expected students</Text>
            {section.assignments.map(assignment => <View key={assignment.subject_id} style={{ marginTop: 10 }}><Text style={{ color: theme.text }}>{assignment.subject_code} · {assignment.teacher_name}</Text>{assignment.meetings.map((meeting, i) => <Text key={i} style={{ color: theme.textSub }}>{meeting.day} {meeting.time_start}–{meeting.time_end} · {meeting.room}</Text>)}</View>)}
          </View>)}
          {button('Save section drafts', () => run(true), true)}
          {button('Edit inputs / refresh preview', () => setPreview(null))}
        </> : <>
          <Text style={{ color: theme.text }}>College course</Text>
          {courses.map(course => button(course.name, () => set('course_id', String(course.id)), form.course_id === String(course.id)))}
          {input('Year level (1–4)', form.year_level, value => set('year_level', value), true)}
          {['1st', '2nd', 'summer'].map(semester => button(semester, () => set('semester', semester), form.semester === semester))}
          {input('School year', form.school_year, value => set('school_year', value))}
          {input('Expected students', form.expected_students, value => set('expected_students', value), true)}
          {input('Students per section', form.max_students, value => set('max_students', value), true)}
          {input('Daily start (HH:MM)', form.time_start, value => set('time_start', value))}
          {input('Daily end (HH:MM)', form.time_end, value => set('time_end', value))}
          {input('Teacher weekly minute limit', form.max_teacher_minutes, value => set('max_teacher_minutes', value), true)}
          {input('Available rooms (one per line, suitable capacity)', form.rooms, value => set('rooms', value), false, true)}
          <Text style={{ color: theme.text }}>Available days</Text>
          {DAYS.map(day => button(day, () => setDays(current => current.includes(day) ? current.filter(item => item !== day) : [...current, day]), days.includes(day)))}
          <Text style={{ color: theme.text }}>Weekly requirements: edit the suggested 3 × 60 using your curriculum.</Text>
          {subjects.map(subject => {
            const requirement = requirements.find(item => item.subject_id === subject.id);
            return <View key={subject.id} style={{ marginTop: 12 }}>
              {button(`${subject.code} — ${subject.name} (${subject.units_lec} lec / ${subject.units_lab} lab)`, () => setRequirements(current => requirement ? current.filter(item => item.subject_id !== subject.id) : [...current, { subject_id: subject.id, meetings: '3', minutes: '60' }]), !!requirement)}
              {requirement && <>{input(`${subject.code}: meetings per week`, requirement.meetings, value => setRequirements(current => current.map(item => item.subject_id === subject.id ? { ...item, meetings: value } : item)), true)}{input(`${subject.code}: minutes per meeting`, requirement.minutes, value => setRequirements(current => current.map(item => item.subject_id === subject.id ? { ...item, minutes: value } : item)), true)}</>}
            </View>;
          })}
          <Text style={{ color: theme.textSub, marginVertical: 12 }}>Approved teachers are selected automatically. Existing assignments reserve their times and count toward the weekly load limit. Saved drafts require the existing review process before enrollment.</Text>
          {button('Preview generation', () => run(false), true)}
        </>}
      </ScrollView>
    </Modal>
  </>;
}
