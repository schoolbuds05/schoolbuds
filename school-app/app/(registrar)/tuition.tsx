// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../src/api';
import { HEADER_TOP } from '../../src/theme';
import { useTheme } from '../../src/theme-context';

export default function RegistrarTuition() {
  const router = useRouter();
  const { theme } = useTheme();
  const [sections, setSections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/registrar/tuition/sections')
      .then(({ data }) => {
        const rows = Array.isArray(data) ? data : [];
        setSections(rows);
        setSelected(rows[0] || null);
      })
      .catch(error => Alert.alert('Could not load sections', error.response?.data?.message || 'Please check your connection and try again.'))
      .finally(() => setLoading(false));
  }, []);

  const total = useMemo(() => Number(amount || 0) * Number(selected?.student_count || 0), [amount, selected]);
  const term = selected ? [selected.school_year, selected.semester && `${selected.semester} semester`].filter(Boolean).join(' · ') : 'No academic term';

  const notify = (title, message) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
    else Alert.alert(title, message);
  };

  const postTuition = async () => {
    if (!selected) return notify('Choose a section', 'There are no active sections with enrolled students.');
    if (!Number(amount) || Number(amount) < 1) return notify('Check the amount', 'Enter a tuition amount greater than zero.');
    const match = dueDate.trim().match(/^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/);
    if (!match) return notify('Check the due date', 'Enter the date as DD / MM / YYYY.');
    const [, day, month, year] = match;
    const isoDate = `${year}-${month}-${day}`;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() + 1 !== Number(month) || parsed.getUTCDate() !== Number(day)) {
      return notify('Check the due date', 'Enter a valid calendar date as DD / MM / YYYY.');
    }

    setSaving(true);
    try {
      const { data } = await api.post('/registrar/tuition', {
        section_id: selected.id,
        amount: Number(amount),
        due_date: isoDate,
      });
      notify('Tuition posted', data?.message || 'Tuition fees have been posted.');
      router.back();
    } catch (error) {
      const errors = error.response?.data?.errors;
      const message = errors ? Object.values(errors).flat().join('\n') : error.response?.data?.message || 'Could not post tuition. Please try again.';
      notify('Could not post tuition', message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={[styles.center, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color={theme.primary} /></View>;

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: theme.text }]}>Post tuition</Text>
        <Text style={[styles.subtitle, { color: theme.textSub }]}>Charge tuition to every student in a section</Text>

        <View style={[styles.formCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.label, { color: theme.text }]}>Section</Text>
          <TouchableOpacity style={[styles.select, { backgroundColor: theme.bg, borderColor: theme.border }]} onPress={() => setPickerOpen(true)}>
            <Text style={[styles.inputText, { color: selected ? theme.text : theme.textSub }]} numberOfLines={1}>
              {selected ? `${selected.name} · ${selected.student_count} students` : 'No eligible sections'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.textSub} />
          </TouchableOpacity>

          <Text style={[styles.label, { color: theme.text }]}>Term</Text>
          <View style={[styles.readonly, { backgroundColor: theme.bg, borderColor: theme.border }]}><Text style={[styles.inputText, { color: theme.text }]}>{term}</Text></View>

          <Text style={[styles.label, { color: theme.text }]}>Tuition per student</Text>
          <View style={[styles.amountBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <Text style={[styles.currency, { color: theme.textSub }]}>₱</Text>
            <TextInput value={amount} onChangeText={value => setAmount(value.replace(/[^0-9.]/g, ''))} placeholder="0.00" placeholderTextColor={theme.textSub} keyboardType="decimal-pad" style={[styles.amountInput, { color: theme.text }]} />
          </View>

          <Text style={[styles.label, { color: theme.text }]}>Due date</Text>
          <TextInput value={dueDate} onChangeText={setDueDate} placeholder="DD / MM / YYYY" placeholderTextColor={theme.textSub} keyboardType="numeric" style={[styles.textInput, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]} />
        </View>

        <View style={[styles.totalCard, { backgroundColor: theme.card }]}>
          <View style={styles.totalLine}><Text style={[styles.totalHint, { color: theme.textSub }]}>Students in section</Text><Text style={[styles.count, { color: theme.text }]}>{selected?.student_count ?? 0}</Text></View>
          <View style={[styles.totalLine, styles.grandTotal, { borderTopColor: theme.border }]}><Text style={[styles.totalTitle, { color: theme.text }]}>Total to post</Text><Text style={[styles.totalValue, { color: theme.text }]}>₱ {total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text></View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.bg, borderTopColor: theme.border }]}>
        <TouchableOpacity style={[styles.submit, { backgroundColor: theme.primary }, saving && styles.disabled]} onPress={postTuition} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Post tuition</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cancel, { borderColor: theme.primary, backgroundColor: theme.card }]} onPress={() => router.back()} disabled={saving}><Text style={[styles.cancelText, { color: theme.primary }]}>Cancel</Text></TouchableOpacity>
      </View>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalShade}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Choose a section</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {sections.map(section => (
                <TouchableOpacity key={section.id} style={[styles.option, { borderBottomColor: theme.border }]} onPress={() => { setSelected(section); setPickerOpen(false); }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionName, { color: theme.text }]}>{section.name}</Text>
                    <Text style={[styles.optionMeta, { color: theme.textSub }]}>{section.school_year} · {section.semester || 'No semester'} · {section.student_count} students</Text>
                  </View>
                  {selected?.id === section.id && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setPickerOpen(false)}><Text style={{ color: theme.primary, fontWeight: '800' }}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 16, paddingTop: HEADER_TOP, paddingBottom: 18 },
  title: { fontSize: 24, fontWeight: '700', fontFamily: 'serif' },
  subtitle: { fontSize: 11, marginTop: 2, marginBottom: 13 },
  formCard: { borderRadius: 15, paddingHorizontal: 13, paddingTop: 12, paddingBottom: 4 },
  label: { fontSize: 10, fontWeight: '600', marginBottom: 5, marginTop: 1 },
  select: { minHeight: 42, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11, gap: 8 },
  inputText: { fontSize: 11, flex: 1 },
  readonly: { minHeight: 42, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, justifyContent: 'center', marginBottom: 11 },
  amountBox: { minHeight: 42, borderRadius: 11, borderWidth: 1, paddingLeft: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 11 },
  currency: { fontSize: 12 },
  amountInput: { flex: 1, paddingHorizontal: 8, paddingVertical: 9, fontSize: 11 },
  textInput: { minHeight: 42, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, fontSize: 11, marginBottom: 11 },
  totalCard: { borderRadius: 15, paddingHorizontal: 13, marginTop: 12 },
  totalLine: { minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalHint: { fontSize: 10 },
  count: { fontSize: 11, fontWeight: '800' },
  grandTotal: { borderTopWidth: StyleSheet.hairlineWidth },
  totalTitle: { fontSize: 12, fontWeight: '700' },
  totalValue: { fontFamily: 'serif', fontSize: 18, fontWeight: '700' },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  submit: { minHeight: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  cancel: { minHeight: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 11, fontWeight: '700' },
  disabled: { opacity: 0.65 },
  modalShade: { flex: 1, backgroundColor: 'rgba(20,12,14,0.45)', justifyContent: 'center', padding: 22 },
  modalCard: { borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 9 },
  option: { minHeight: 58, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionName: { fontSize: 13, fontWeight: '700' },
  optionMeta: { fontSize: 10, marginTop: 3 },
  modalClose: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingTop: 12 },
});
