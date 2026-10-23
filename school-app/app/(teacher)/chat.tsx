// @ts-nocheck
// app/(teacher)/chat.tsx — Teacher chat with assigned students

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView,
  Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { resolveApiAssetUrl } from '../../src/api';
import HeaderGradient from '../components/ui/HeaderGradient';
import { useTheme } from '../../src/theme-context';

const C = {
  green: '#1D9E75',
  greenLight: '#E1F5EE',
  bg: '#F9E9EC',
  card: '#FFFFFF',
  border: '#EFEFEF',
  text: '#1A1A2E',
  sub: '#6B7280',
  muted: '#B0B7C3',
};

const AVATAR_PALETTES = [
  { bg: '#FBE5EB', text: '#B5233D' },
  { bg: '#DDF0E3', text: '#1E6B3A' },
  { bg: '#FFF1BF', text: '#8A6700' },
  { bg: '#E6EDF9', text: '#3F6FB7' },
];

const paletteFor = id => AVATAR_PALETTES[Number(id || 0) % AVATAR_PALETTES.length];
const initialsFor = name => String(name || 'Student').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

function relativeMessageTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffDays = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function TeacherChat() {
  const router = useRouter();
  const { theme } = useTheme();
  const { contactId, contactName } = useLocalSearchParams();
  const [myId, setMyId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const isThread = !!contactId;
  const filteredContacts = useMemo(() => contacts.filter(contact =>
    String(contact.name || '').toLowerCase().includes(search.trim().toLowerCase())
  ), [contacts, search]);

  useEffect(() => {
    AsyncStorage.getItem('user').then(raw => {
      if (raw) setMyId(JSON.parse(raw).id);
    });
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const res = await api.get('/teacher-chat/contacts');
      setContacts(res.data ?? []);
    } catch (e) {
      console.log('Student contacts error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    if (!contactId) return;
    try {
      const res = await api.get(`/teacher-chat/${contactId}/messages`);
      setMessages(res.data ?? []);
    } catch (e) {
      console.log('Student messages error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      if (isThread) {
        loadMessages();
        const timer = setInterval(() => {
          loadMessages();
        }, 8000);
        return () => clearInterval(timer);
      } else {
        loadContacts();
      }
    }, [isThread, loadContacts, loadMessages])
  );

  const send = async () => {
    const text = input.trim();
    if (!text || !contactId || sending) return;
    setSending(true);
    try {
      await api.post(`/teacher-chat/${contactId}/messages`, { message: text });
      setInput('');
      await loadMessages();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  if (!isThread) {
    return (
      <View style={[s.container, { backgroundColor: theme.bg }]}>
        {loading ? (
          <View style={s.center}><ActivityIndicator color={theme.primary} /></View>
        ) : contacts.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>💬</Text>
            <Text style={[s.emptyTitle, { color: theme.text }]}>No students available</Text>
            <Text style={[s.emptySub, { color: theme.textSub }]}>Students appear here when they are enrolled in your sections.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={s.contactList}
            ListHeaderComponent={<View style={s.listHeader}>
              <View style={s.headerRow}>
                <View>
                  <Text style={[s.headerEyebrow, { color: theme.textSub }]}>One-on-one with your students</Text>
                  <Text style={[s.listTitle, { color: theme.text }]}>Chat</Text>
                </View>
                <View style={[s.headerBadge, { backgroundColor: theme.card }]}>
                  <Image source={require('../../assets/images/schoolbuds-favicon.png')} style={s.brandLogo} resizeMode="contain" />
                </View>
              </View>
              <View style={[s.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Ionicons name="search-outline" size={17} color={theme.textSub} />
                <TextInput
                  style={[s.searchInput, { color: theme.text }]}
                  placeholder="Search students"
                  placeholderTextColor={theme.textSub}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                />
              </View>
            </View>}
            ListEmptyComponent={<View style={[s.noResults, { backgroundColor: theme.card }]}><Text style={[s.noResultsText, { color: theme.textSub }]}>No students found.</Text></View>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.contactCard, { backgroundColor: theme.card, borderBottomColor: theme.border }]}
                onPress={() => router.push({
                  pathname: '/(teacher)/chat',
                  params: { contactId: String(item.id), contactName: item.name },
                })}
              >
                <View style={[s.avatar, { backgroundColor: paletteFor(item.id).bg }]}>
                  {resolveApiAssetUrl(item.profile_photo_url) ? (
                    <Image source={{ uri: resolveApiAssetUrl(item.profile_photo_url) }} style={s.avatarImage} />
                  ) : (
                    <Text style={[s.avatarText, { color: paletteFor(item.id).text }]}>{initialsFor(item.name)}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.contactName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[s.lastMessage, { color: theme.textSub }]} numberOfLines={1}>{item.last_message || studentMeta(item)}</Text>
                </View>
                <View style={s.contactEnd}>
                  <Text style={[s.messageTime, { color: theme.textSub }]}>{relativeMessageTime(item.last_message_at)}</Text>
                  {item.unread > 0 ? (
                    <View style={[s.unreadBadge, { backgroundColor: theme.primary }]}>
                      <Text style={[s.unreadText, { color: theme.card }]}>{item.unread}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <HeaderGradient
        title={contactName ?? 'Student'}
        subtitle="Teacher conversation"
        initials={(contactName ?? 'S').slice(0, 2).toUpperCase()}
        stats={[
          { label: 'Messages', value: messages.length, accent: '#A5F3FC' },
          { label: 'Unread', value: messages.filter(m => m.sender_id !== myId && !m.read).length, accent: '#FDE68A' },
          { label: 'Status', value: loading ? 'Loading' : 'Open', accent: '#FBCFE8' },
        ]}
      >
        <TouchableOpacity onPress={() => router.push('/(teacher)/chat')} style={s.backBtn}>
          <Text style={s.backText}>← Students</Text>
        </TouchableOpacity>
      </HeaderGradient>

      {loading ? (
        <View style={[s.center, { backgroundColor: theme.bg }]}><ActivityIndicator color={theme.primary} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item, i) => String(item.id ?? i)}
          contentContainerStyle={[s.messageList, { backgroundColor: theme.bg }]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>💬</Text>
              <Text style={[s.emptyTitle, { color: theme.text }]}>No messages yet</Text>
              <Text style={[s.emptySub, { color: theme.textSub }]}>Send a message to this student.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === myId;
            return (
              <View style={[
                s.bubble,
                mine ? s.bubbleMine : s.bubbleTheirs,
                { backgroundColor: mine ? theme.primaryLight : theme.card, borderColor: theme.border },
              ]}>
                {!mine && <Text style={[s.sender, { color: theme.textSub }]}>{item.sender?.name?.split(' ')[0]}</Text>}
                <Text style={[s.bubbleText, { color: theme.text }]}>
                  {item.message}
                </Text>
                <Text style={[s.time, { color: theme.textMuted }]}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          }}
        />
      )}

      <View style={[s.inputRow, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <TextInput
          style={[s.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
          placeholder="Type a message..."
          placeholderTextColor={theme.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[s.sendBtn, { backgroundColor: theme.primary }, (!input.trim() || sending) && s.sendBtnDisabled]}
          onPress={send}
          disabled={!input.trim() || sending}
        >
          {sending ? <ActivityIndicator size="small" color={theme.card} /> : <Text style={[s.sendText, { color: theme.card }]}>Send</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function studentMeta(item) {
  const info = item.student_info ?? {};
  const subjects = (info.subjects ?? [])
    .map(subject => subject.code || subject.name)
    .filter(Boolean)
    .join(', ');
  if (info.is_irregular) {
    return subjects ? `Irregular · ${subjects}` : 'Irregular student';
  }

  const parts = [info.year, info.section, info.program, info.school_year].filter(Boolean);
  return parts.length ? parts.join(' • ') : 'Student';
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn: { marginBottom: 6 },
  backText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  listHeader: { paddingTop: 42, paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  headerEyebrow: { fontSize: 11, fontWeight: '600', marginBottom: 1 },
  listTitle: { fontSize: 22, fontWeight: '800' },
  headerBadge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  brandLogo: { width: 31, height: 31, borderRadius: 8 },
  searchBox: { height: 38, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, fontSize: 12, marginLeft: 8, paddingVertical: 0 },
  contactList: { paddingBottom: 20 },
  noResults: { height: 80, alignItems: 'center', justifyContent: 'center' },
  noResultsText: { fontSize: 12, fontWeight: '600' },
  contactCard: {
    height: 63, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 12, fontWeight: '800' },
  contactName: { fontSize: 13, fontWeight: '800' },
  lastMessage: { fontSize: 11, marginTop: 3 },
  contactEnd: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 42, alignSelf: 'stretch', paddingVertical: 10 },
  messageTime: { fontSize: 9, fontWeight: '700', minHeight: 14 },
  unreadBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { fontSize: 11, fontWeight: '800' },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 10 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: C.green, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: C.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border },
  sender: { color: C.green, fontSize: 11, fontWeight: '700', marginBottom: 3 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  time: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  messageList: { flexGrow: 1, padding: 16, gap: 8 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border,
    padding: 12,
  },
  input: {
    flex: 1, backgroundColor: C.bg, borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 10,
    color: C.text, fontSize: 14, maxHeight: 100,
  },
  sendBtn: { backgroundColor: C.green, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendBtnDisabled: { opacity: 0.45 },
  sendText: { color: '#fff', fontWeight: '800' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 46, marginBottom: 10 },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  emptySub: { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 4 },
});
