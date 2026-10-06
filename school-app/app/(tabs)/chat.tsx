// @ts-nocheck
// app/(tabs)/chat.tsx — Student chat with assigned teachers

import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../src/api';
import HeaderGradient from '../components/ui/HeaderGradient';
import { useTheme } from '../../src/theme-context';

const C = {
  blue: '#378ADD',
  blueLight: '#E6F1FB',
  bg: '#F4F6F9',
  card: '#FFFFFF',
  border: '#EFEFEF',
  text: '#1A1A2E',
  sub: '#6B7280',
  muted: '#B0B7C3',
};

export default function Chat() {
  const router = useRouter();
  const { theme } = useTheme();
  const { contactId, contactName } = useLocalSearchParams();
  const [myId, setMyId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const isThread = !!contactId;

  const loadCurrentUser = useCallback(async () => {
    try {
      const res = await api.get('/me');
      if (res.data?.user?.id) {
        setMyId(res.data.user.id);
        await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
        return;
      }
    } catch (e) {
      console.log('Current user error:', e.message);
    }

    const raw = await AsyncStorage.getItem('user');
    setMyId(raw ? JSON.parse(raw).id : null);
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      setMessages([]);
      const res = await api.get('/teacher-chat/contacts');
      setContacts(res.data ?? []);
    } catch (e) {
      console.log('Teacher contacts error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    if (!contactId) return;
    try {
      setMessages([]);
      const res = await api.get(`/teacher-chat/${contactId}/messages`);
      setMessages(res.data ?? []);
    } catch (e) {
      console.log('Teacher messages error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadCurrentUser();
      if (isThread) {
        loadMessages();
        const timer = setInterval(() => {
          loadMessages();
        }, 8000);
        return () => clearInterval(timer);
      } else {
        loadContacts();
      }
    }, [isThread, loadContacts, loadCurrentUser, loadMessages])
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
        <HeaderGradient
          title="Chat"
          subtitle="Ask questions to your assigned teachers"
          initials="CT"
          stats={[
            { label: 'Contacts', value: contacts.length, accent: '#A5F3FC' },
            { label: 'Messages', value: messages.length, accent: '#FDE68A' },
            { label: 'Status', value: loading ? 'Loading' : 'Ready', accent: '#FBCFE8' },
          ]}
        />

        {loading ? (
          <View style={s.center}><ActivityIndicator color={C.blue} /></View>
        ) : contacts.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>💬</Text>
            <Text style={s.emptyTitle}>No teachers available</Text>
            <Text style={s.emptySub}>You need to be assigned to a section with teachers first.</Text>
          </View>
        ) : (
          <FlatList
            data={contacts}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.contactCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => router.push({
                  pathname: '/(tabs)/chat',
                  params: { contactId: String(item.id), contactName: item.name },
                })}
              >
                <View style={[s.avatar, { backgroundColor: theme.primaryLight }]}> 
                  <Text style={[s.avatarText, { color: theme.primary }]}>{(item.name ?? 'T')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.contactName, { color: theme.text }]}>{item.name}</Text>
                  <Text style={[s.contactRole, { color: theme.textSub }]}>Teacher</Text>
                  {item.last_message ? (
                    <Text style={[s.lastMessage, { color: theme.textSub }]} numberOfLines={1}>{item.last_message}</Text>
                  ) : null}
                </View>
                {item.unread > 0 && (
                  <View style={[s.unreadBadge, { backgroundColor: theme.primary }]}> 
                    <Text style={[s.unreadText, { color: theme.card }]}>{item.unread}</Text>
                  </View>
                )}
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
        title={contactName ?? 'Teacher'}
        subtitle="Student conversation"
        initials={(contactName ?? 'T').slice(0, 2).toUpperCase()}
        stats={[
          { label: 'Messages', value: messages.length, accent: '#A5F3FC' },
          { label: 'Unread', value: messages.filter(m => m.sender_id !== myId && !m.is_read).length, accent: '#FDE68A' },
          { label: 'Status', value: loading ? 'Loading' : 'Open', accent: '#FBCFE8' },
        ]}
      >
        <TouchableOpacity onPress={() => router.push('/(tabs)/chat')} style={s.backBtn}>
          <Text style={s.backText}>← Teachers</Text>
        </TouchableOpacity>
      </HeaderGradient>

      {loading ? (
        <View style={[s.center, { backgroundColor: theme.bg }]}><ActivityIndicator color={theme.primary} /></View>
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
              <Text style={s.emptySub}>Send your teacher a question.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === myId;
            return (
              <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs, { backgroundColor: mine ? theme.primaryLight : theme.card }]}> 
                {!mine && <Text style={[s.sender, { color: theme.textSub }]}>{item.sender?.name?.split(' ')[0]}</Text>}
                <Text style={[s.bubbleText, mine ? s.bubbleTextMine : s.bubbleTextTheirs, { color: mine ? theme.text : theme.text }]}>
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
          style={[s.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
          placeholder="Type your question..."
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: C.blue, padding: 16, paddingTop: 52 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4 },
  backBtn: { marginBottom: 6 },
  backText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: C.border,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: C.blue, fontSize: 18, fontWeight: '800' },
  contactName: { color: C.text, fontSize: 15, fontWeight: '700' },
  contactRole: { color: C.sub, fontSize: 12, marginTop: 2 },
  lastMessage: { color: C.muted, fontSize: 12, marginTop: 4 },
  unreadBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 10 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: C.blue, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: C.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border },
  sender: { color: C.blue, fontSize: 11, fontWeight: '700', marginBottom: 3 },
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
  sendBtn: { backgroundColor: C.blue, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendBtnDisabled: { opacity: 0.45 },
  sendText: { color: '#fff', fontWeight: '800' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 46, marginBottom: 10 },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  emptySub: { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 4 },
});
