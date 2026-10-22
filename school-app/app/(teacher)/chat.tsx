// @ts-nocheck
// app/(teacher)/chat.tsx — Teacher chat with assigned students

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView,
  Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../src/api';
import HeaderGradient from '../components/ui/HeaderGradient';

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

export default function TeacherChat() {
  const router = useRouter();
  const { contactId, contactName } = useLocalSearchParams();
  const [myId, setMyId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const isThread = !!contactId;

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
      <View style={s.container}>
        {loading ? (
          <View style={s.center}><ActivityIndicator color={C.green} /></View>
        ) : contacts.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>💬</Text>
            <Text style={s.emptyTitle}>No students available</Text>
            <Text style={s.emptySub}>Students appear here when they are enrolled in your sections.</Text>
          </View>
        ) : (
          <FlatList
            data={contacts}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={s.contactsContent}
            ListHeaderComponent={
              <>
                <View style={s.contactsHero}>
                  <View style={s.contactsTitleRow}>
                    <View><Text style={s.contactsEyebrow}>Answer questions from your students</Text><Text style={s.contactsTitle}>Chat</Text></View>
                    <View style={s.heroIcon}><Text style={s.heroLeaf}>🍃</Text></View>
                  </View>
                  <View style={s.contactsStats}>
                    <View style={s.contactsStat}><Text style={s.contactsStatValue}>{contacts.length}</Text><Text style={s.contactsStatLabel}>Contacts</Text></View>
                    <View style={s.contactsDivider} />
                    <View style={s.contactsStat}><Text style={s.contactsStatValue}>{messages.length}</Text><Text style={s.contactsStatLabel}>Messages</Text></View>
                    <View style={s.contactsDivider} />
                    <View style={s.contactsStat}><Text style={s.contactsStatValue}>Ready</Text><Text style={s.contactsStatLabel}>Status</Text></View>
                  </View>
                </View>
                <View style={s.studentsHeading}><Text style={s.studentsTitle}>Your students</Text><Text style={s.studentsCount}>{contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}</Text></View>
              </>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.contactCard}
                onPress={() => router.push({
                  pathname: '/(teacher)/chat',
                  params: { contactId: String(item.id), contactName: item.name },
                })}
              >
                <View style={s.avatar}>
                  {item.profile_photo_url ? (
                    <Image source={{ uri: item.profile_photo_url }} style={s.avatarImage} />
                  ) : (
                    <Text style={s.avatarText}>{(item.name ?? 'S')[0].toUpperCase()}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.contactName}>{item.name}</Text>
                  <Text style={s.contactRole} numberOfLines={2}>{studentMeta(item)}</Text>
                  {item.last_message ? (
                    <Text style={s.lastMessage} numberOfLines={1}>{item.last_message}</Text>
                  ) : null}
                </View>
                {item.unread > 0 ? (
                  <View style={s.unreadBadge}>
                    <Text style={s.unreadText}>{item.unread}</Text>
                  </View>
                ) : <Text style={s.contactChevron}>›</Text>}
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
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
        <View style={s.center}><ActivityIndicator color={C.green} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item, i) => String(item.id ?? i)}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>💬</Text>
              <Text style={s.emptyTitle}>No messages yet</Text>
              <Text style={s.emptySub}>Send a message to this student.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === myId;
            return (
              <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
                {!mine && <Text style={s.sender}>{item.sender?.name?.split(' ')[0]}</Text>}
                <Text style={[s.bubbleText, mine ? s.bubbleTextMine : s.bubbleTextTheirs]}>
                  {item.message}
                </Text>
                <Text style={[s.time, mine ? s.timeMine : s.timeTheirs]}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          }}
        />
      )}

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          placeholder="Type a message..."
          placeholderTextColor={C.muted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
          onPress={send}
          disabled={!input.trim() || sending}
        >
          {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.sendText}>Send</Text>}
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
  header: { backgroundColor: C.green, padding: 16, paddingTop: 52 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4 },
  backBtn: { marginBottom: 6 },
  backText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  contactsContent: { paddingHorizontal: 15, paddingTop: 34, paddingBottom: 20 },
  contactsHero: { backgroundColor: '#F2C8D0', borderRadius: 18, paddingHorizontal: 13, paddingTop: 2, paddingBottom: 11, marginHorizontal: -7 },
  contactsTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contactsEyebrow: { color: '#765B61', fontSize: 10, fontWeight: '600' },
  contactsTitle: { color: '#2A1B1F', fontSize: 20, fontWeight: '900', lineHeight: 24 },
  heroIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  heroLeaf: { fontSize: 21 },
  contactsStats: { flexDirection: 'row', minHeight: 51, alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, marginTop: 10 },
  contactsStat: { flex: 1, alignItems: 'center' },
  contactsStatValue: { color: '#2A1B1F', fontSize: 14, fontWeight: '900' },
  contactsStatLabel: { color: '#806E73', fontSize: 8, marginTop: 2 },
  contactsDivider: { width: 1, height: 34, backgroundColor: '#ECD6DA' },
  studentsHeading: { marginTop: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  studentsTitle: { color: '#2A1B1F', fontSize: 13, fontWeight: '900' },
  studentsCount: { color: '#806E73', fontSize: 10, fontWeight: '700' },
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 11, padding: 11, marginBottom: 6,
    borderWidth: 1, borderColor: '#E7DADD',
  },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: C.green, fontSize: 10, fontWeight: '900' },
  contactName: { color: C.text, fontSize: 11, fontWeight: '900' },
  contactRole: { color: C.sub, fontSize: 9, marginTop: 2 },
  lastMessage: { color: C.muted, fontSize: 9, marginTop: 3 },
  contactChevron: { color: '#B09299', fontSize: 21, fontWeight: '300' },
  unreadBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: C.green, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 10 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: C.green, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: C.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border },
  sender: { color: C.green, fontSize: 11, fontWeight: '700', marginBottom: 3 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  bubbleTextTheirs: { color: C.text },
  time: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  timeMine: { color: 'rgba(255,255,255,0.65)' },
  timeTheirs: { color: C.muted },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border,
    padding: 12,
  },
  input: {
    flex: 1, backgroundColor: C.bg, borderRadius: 20,
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
