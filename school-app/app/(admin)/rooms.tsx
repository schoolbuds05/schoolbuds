// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme-context';
import api from '../../src/api';

const ROOM_TYPES = [
  { value: 'lecture', label: 'Lecture' },
  { value: 'lab', label: 'Laboratory' },
  { value: 'flexible', label: 'Flexible' },
];

const EMPTY_FORM = { name: '', room_type: 'lecture', capacity: '', is_active: true };

export default function AdminRooms() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/admin/rooms');
      setRooms(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Could not load rooms. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const openCreate = () => {
    setEditingRoom(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (room) => {
    setEditingRoom(room);
    setForm({
      name: room.name || '',
      room_type: room.room_type || 'lecture',
      capacity: String(room.capacity ?? ''),
      is_active: Boolean(room.is_active),
    });
    setModalOpen(true);
  };

  const save = async () => {
    const payload = {
      name: form.name.trim(),
      room_type: form.room_type,
      capacity: Number(form.capacity),
      is_active: form.is_active,
    };
    if (!payload.name) {
      Alert.alert('Room name required', 'Enter a name for this room.');
      return;
    }
    if (!Number.isInteger(payload.capacity) || payload.capacity < 1) {
      Alert.alert('Invalid capacity', 'Enter a whole number greater than zero.');
      return;
    }

    setSaving(true);
    try {
      if (editingRoom) {
        await api.put(`/admin/rooms/${editingRoom.id}`, payload);
      } else {
        await api.post('/admin/rooms', payload);
      }
      setModalOpen(false);
      await load();
    } catch (saveError) {
      const validationErrors = saveError.response?.data?.errors;
      const firstError = validationErrors ? Object.values(validationErrors).flat()[0] : null;
      Alert.alert('Could not save room', firstError || saveError.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={[styles.center, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: 14 + insets.top }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.kicker, { color: theme.primary }]}>ADMIN ACADEMICS</Text>
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={[styles.title, { color: theme.text }]}>Rooms</Text>
            <Text style={[styles.subtitle, { color: theme.textSub }]}>Manage rooms and their seating capacity.</Text>
          </View>
          <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.primary }]} onPress={openCreate} accessibilityRole="button" accessibilityLabel="Add room">
            <Ionicons name="add" size={21} color="#fff" />
            <Text style={styles.addText}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.summary, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <SummaryItem label="Total rooms" value={rooms.length} theme={theme} />
          <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
          <SummaryItem label="Active" value={rooms.filter((room) => room.is_active).length} theme={theme} />
          <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
          <SummaryItem label="Seats" value={rooms.filter((room) => room.is_active).reduce((sum, room) => sum + Number(room.capacity || 0), 0)} theme={theme} />
        </View>

        {error ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            <TouchableOpacity onPress={() => { setLoading(true); load(); }}><Text style={[styles.retry, { color: theme.primary }]}>Retry</Text></TouchableOpacity>
          </View>
        ) : rooms.length ? rooms.map((room) => (
          <TouchableOpacity key={room.id} style={[styles.roomCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => openEdit(room)} activeOpacity={0.8}>
            <View style={[styles.roomIcon, { backgroundColor: theme.primaryLight }]}>
              <Ionicons name={room.room_type === 'lab' ? 'flask-outline' : 'business-outline'} size={19} color={theme.primary} />
            </View>
            <View style={styles.roomCopy}>
              <Text style={[styles.roomName, { color: theme.text }]} numberOfLines={1}>{room.name}</Text>
              <Text style={[styles.roomMeta, { color: theme.textSub }]}>{roomTypeLabel(room.room_type)} · Capacity {room.capacity}</Text>
            </View>
            <View style={[styles.status, { backgroundColor: room.is_active ? theme.successLight : theme.bg }]}>
              <Text style={[styles.statusText, { color: room.is_active ? theme.success : theme.textSub }]}>{room.is_active ? 'Active' : 'Inactive'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        )) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="business-outline" size={28} color={theme.primary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No rooms yet</Text>
            <Text style={[styles.emptyText, { color: theme.textSub }]}>Add a room to start managing your school inventory.</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { backgroundColor: theme.card, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.text }]}>{editingRoom ? 'Edit room' : 'Add room'}</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textSub }]}>Set the room details and availability.</Text>
              </View>
              <TouchableOpacity style={[styles.closeButton, { backgroundColor: theme.bg }]} onPress={() => setModalOpen(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={theme.textSub} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: theme.text }]}>Room name</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              value={form.name}
              onChangeText={(name) => setForm((current) => ({ ...current, name }))}
              placeholder="e.g. Science Lab 1"
              placeholderTextColor={theme.textMuted}
              maxLength={100}
            />

            <Text style={[styles.label, { color: theme.text }]}>Room type</Text>
            <View style={styles.typeOptions}>
              {ROOM_TYPES.map((type) => (
                <TouchableOpacity key={type.value} onPress={() => setForm((current) => ({ ...current, room_type: type.value }))} style={[styles.typeOption, { backgroundColor: form.room_type === type.value ? theme.primaryLight : theme.bg, borderColor: form.room_type === type.value ? theme.primary : theme.border }]}>
                  <Text style={[styles.typeText, { color: form.room_type === type.value ? theme.primary : theme.textSub }]}>{type.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: theme.text }]}>Capacity</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              value={form.capacity}
              onChangeText={(capacity) => setForm((current) => ({ ...current, capacity: capacity.replace(/[^0-9]/g, '') }))}
              placeholder="Number of seats"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              maxLength={5}
            />

            <View style={[styles.activeRow, { borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.activeLabel, { color: theme.text }]}>Room is active</Text>
                <Text style={[styles.activeHint, { color: theme.textSub }]}>Inactive rooms won’t be available for scheduling.</Text>
              </View>
              <Switch value={form.is_active} onValueChange={(is_active) => setForm((current) => ({ ...current, is_active }))} trackColor={{ true: theme.primary }} />
            </View>

            <TouchableOpacity disabled={saving} style={[styles.saveButton, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]} onPress={save}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{editingRoom ? 'Save changes' : 'Add room'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryItem({ label, value, theme }) {
  return <View style={styles.summaryItem}><Text style={[styles.summaryValue, { color: theme.text }]}>{value}</Text><Text style={[styles.summaryLabel, { color: theme.textSub }]}>{label}</Text></View>;
}

function roomTypeLabel(value) {
  return ROOM_TYPES.find((type) => type.value === value)?.label || 'Room';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleCopy: { flex: 1 },
  title: { fontSize: 25, fontWeight: '900', marginTop: -7 },
  subtitle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  addButton: { minHeight: 40, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 3 },
  addText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  summary: { minHeight: 75, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 17, fontWeight: '900' },
  summaryLabel: { fontSize: 9, fontWeight: '700', marginTop: 3 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 36 },
  roomCard: { minHeight: 70, borderWidth: 1, borderRadius: 14, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  roomIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  roomCopy: { flex: 1, minWidth: 0 },
  roomName: { fontSize: 12, fontWeight: '900' },
  roomMeta: { fontSize: 10, fontWeight: '600', marginTop: 4 },
  status: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 9, fontWeight: '800' },
  emptyCard: { borderWidth: 1, borderRadius: 15, alignItems: 'center', padding: 24, marginTop: 4 },
  emptyTitle: { fontSize: 14, fontWeight: '900', marginTop: 8 },
  emptyText: { textAlign: 'center', fontSize: 11, fontWeight: '600', marginTop: 4 },
  errorText: { fontSize: 12, fontWeight: '700' },
  retry: { fontSize: 12, fontWeight: '900', marginTop: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(30, 16, 20, 0.45)' },
  modal: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 18, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  modalSubtitle: { fontSize: 10, fontWeight: '600', marginTop: 3 },
  closeButton: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, fontSize: 12 },
  typeOptions: { flexDirection: 'row', gap: 7 },
  typeOption: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  typeText: { fontSize: 10, fontWeight: '800' },
  activeRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10, marginTop: 13 },
  activeLabel: { fontSize: 11, fontWeight: '800' },
  activeHint: { fontSize: 9, marginTop: 3 },
  saveButton: { minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  saveText: { color: '#fff', fontSize: 12, fontWeight: '900' },
});
