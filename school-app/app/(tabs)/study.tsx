// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

const QUICK_PROMPTS = [
  { label: 'Quiz me', icon: 'help', message: 'Generate a short quiz for me based on my weakest subject' },
  { label: 'Explain a topic', icon: 'book-outline', message: 'Explain the most important topic I need to review right now' },
  { label: 'Study tip', icon: 'bulb-outline', message: 'Give me a study tip for my upcoming exams' },
  { label: 'Math help', icon: 'calculator-outline', message: 'Help me with Mathematics 10 — give me a practice problem' },
];

export default function Study() {
  const { theme } = useTheme();
  const [allowed, setAllowed] = useState(false);
  const [firstName, setFirstName] = useState('there');
  const [messages, setMessages] = useState([{ role: 'assistant', text: '' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    AsyncStorage.multiGet(['role', 'user']).then(([[, role], [, rawUser]]) => {
      if (!['faculty', 'teacher'].includes(role)) setAllowed(true);
      try {
        const user = JSON.parse(rawUser || '{}');
        setFirstName(user.name?.split(' ')[0] || user.first_name || 'there');
      } catch {}
    });
  }, []);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await api.post('/ai/chat', { message: msg });
      setMessages(prev => [...prev, { role: 'assistant', text: res.data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I had trouble connecting. Please try again!' }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  if (!allowed) return <View style={[styles.center, { backgroundColor: theme.bg }]}><Text style={[styles.notAvail, { color: theme.textSub }]}>Study AI is for students only</Text></View>;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <View style={styles.header}>
        <View><Text style={[styles.eyebrow, { color: theme.textSub }]}>Your study companion</Text><Text style={[styles.title, { color: theme.text }]}>Study AI</Text></View>
        <View style={[styles.headerBadge, { backgroundColor: theme.card }]}><Image source={require('../../assets/images/schoolbuds-favicon.png')} style={styles.brandLogo} resizeMode="contain" /></View>
      </View>
      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messageContent} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.map((message, index) => (
          <View key={index} style={[styles.bubble, message.role === 'user' ? [styles.bubbleUser, { backgroundColor: theme.primary }] : [styles.bubbleAI, index === 0 && styles.welcomeBubble, { backgroundColor: theme.card, borderColor: theme.border }]]}>
            {message.role === 'assistant' && index > 0 && <Text style={[styles.aiLabel, { color: theme.primary }]}>Study AI</Text>}
            <Text style={[styles.bubbleText, message.role === 'user' ? styles.bubbleTextUser : { color: theme.text }]}>{index === 0 ? `Hi ${firstName}! Ask me anything about your subjects, or pick a quick prompt.` : message.text}</Text>
          </View>
        ))}
        {messages.length === 1 && !loading && <View style={styles.quickGrid}>{QUICK_PROMPTS.map(prompt => (
          <TouchableOpacity key={prompt.label} style={[styles.quickBtn, { backgroundColor: theme.card }]} onPress={() => send(prompt.message)} activeOpacity={0.75}>
            <View style={[styles.quickIcon, { backgroundColor: theme.primaryLight }]}><Ionicons name={prompt.icon} size={16} color={theme.primary} /></View>
            <Text style={[styles.quickText, { color: theme.text }]}>{prompt.label}</Text>
          </TouchableOpacity>
        ))}</View>}
        {loading && <View style={[styles.bubbleAI, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={[styles.aiLabel, { color: theme.primary }]}>Study AI</Text><View style={styles.thinking}><ActivityIndicator size="small" color={theme.primary} /><Text style={[styles.thinkingText, { color: theme.textMuted }]}>Thinking...</Text></View></View>}
      </ScrollView>
      <View style={[styles.inputRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text }]} placeholder="Ask me anything..." placeholderTextColor={theme.textMuted} value={input} onChangeText={setInput} multiline maxLength={500} />
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: theme.primary }, (!input.trim() || loading) && styles.sendBtnDisabled]} onPress={() => send()} disabled={!input.trim() || loading}><Ionicons name="send" size={17} color={theme.card} /></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, notAvail: { fontSize: 15 },
  header: { paddingTop: 42, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '600', marginBottom: 1 }, title: { fontSize: 22, fontWeight: '800' },
  headerBadge: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  brandLogo: { width: 31, height: 31, borderRadius: 8 },
  messages: { flex: 1 }, messageContent: { paddingHorizontal: 16, paddingBottom: 14 },
  bubble: { borderRadius: 14, padding: 12, maxWidth: '85%', marginBottom: 10 }, bubbleUser: { alignSelf: 'flex-end', borderBottomRightRadius: 4 }, bubbleAI: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth }, welcomeBubble: { maxWidth: '84%', marginBottom: 10 },
  aiLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 }, bubbleText: { fontSize: 12, lineHeight: 18 }, bubbleTextUser: { color: '#fff' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }, quickBtn: { width: '48%', height: 53, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, quickIcon: { width: 27, height: 27, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 }, quickText: { flex: 1, fontSize: 12, fontWeight: '800' },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 8 }, thinkingText: { fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingLeft: 14, paddingRight: 4, minHeight: 44, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  input: { flex: 1, paddingVertical: 8, fontSize: 12, maxHeight: 92 }, sendBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 8 }, sendBtnDisabled: { opacity: 0.45 },
});
