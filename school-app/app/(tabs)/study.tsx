// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';

const QUICK_PROMPTS = [
  { label: '📝 Quiz me',    message: 'Generate a short quiz for me based on my weakest subject' },
  { label: '📖 Explain',    message: 'Explain the most important topic I need to review right now' },
  { label: '💡 Study tip',  message: 'Give me a study tip for my upcoming exams' },
  { label: '🔢 Math help',  message: 'Help me with Mathematics 10 — give me a practice problem' },
];

export default function Study() {
  const { theme } = useTheme();
  const [allowed, setAllowed] = useState(false);
  const [messages, setMessages] = useState([{
    role: 'assistant',
    text: "Hi! I'm your AI study companion 🎓 I know your grades and can help you study smarter. Ask me anything or try a quick prompt below!"
  }]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef             = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('role').then(role => {
      if (!['faculty', 'teacher'].includes(role)) setAllowed(true);
    });
  }, []);

  if (!allowed) return (
    <View style={[styles.center, { backgroundColor: theme.bg }]}>
      <Text style={[styles.notAvail, { color: theme.textSub }]}>Study AI is for students only</Text>
    </View>
  );

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

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}>
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <Text style={styles.title}>AI Study Companion</Text>
        <Text style={styles.sub}>Powered by Groq AI · Personalised for you</Text>
      </View>
      <ScrollView ref={scrollRef} style={styles.messages}
        contentContainerStyle={{ padding:16, gap:12 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.map((m, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              m.role === 'user'
                ? [styles.bubbleUser, { backgroundColor: theme.primary }]
                : [styles.bubbleAI, { backgroundColor: theme.card, borderColor: theme.border }],
            ]}
          >
            {m.role === 'assistant' && <Text style={[styles.aiLabel, { color: theme.primary }]}>Study AI</Text>}
            <Text style={[styles.bubbleText, m.role === 'user' ? styles.bubbleTextUser : { color: theme.text }]}>
              {m.text}
            </Text>
          </View>
        ))}
        {loading && (
          <View style={[styles.bubbleAI, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.aiLabel, { color: theme.primary }]}>Study AI</Text>
            <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
              <ActivityIndicator size="small" color={theme.primary}/>
              <Text style={{ fontSize:13, color: theme.textMuted }}>Thinking...</Text>
            </View>
          </View>
        )}
      </ScrollView>
      {messages.length <= 2 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.quickRow} contentContainerStyle={{ paddingHorizontal:16, gap:8 }}>
          {QUICK_PROMPTS.map((p, i) => (
            <TouchableOpacity key={i} style={[styles.quickBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => send(p.message)}>
              <Text style={[styles.quickText, { color: theme.textSub }]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <View style={[styles.inputRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TextInput style={[styles.input, { backgroundColor: theme.bg, color: theme.text }]} placeholder="Ask me anything..."
          placeholderTextColor={theme.textMuted} value={input} onChangeText={setInput}
          multiline maxLength={500}/>
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: theme.primary }, (!input.trim()||loading) && styles.sendBtnDisabled]}
          onPress={() => send()} disabled={!input.trim()||loading}>
          <Text style={styles.sendText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex:1 },
  center:          { flex:1, justifyContent:'center', alignItems:'center' },
  notAvail:        { fontSize:15 },
  header:          { padding:20, paddingTop:56 },
  title:           { color:'#fff', fontSize:20, fontWeight:'600' },
  sub:             { color:'rgba(255,255,255,0.75)', fontSize:12, marginTop:3 },
  messages:        { flex:1 },
  bubble:          { borderRadius:16, padding:12, maxWidth:'85%', marginBottom:8 },
  bubbleUser:      { alignSelf:'flex-end', borderBottomRightRadius:4 },
  bubbleAI:        { alignSelf:'flex-start', borderBottomLeftRadius:4, borderWidth:0.5 },
  aiLabel:         { fontSize:11, fontWeight:'600', marginBottom:4 },
  bubbleText:      { fontSize:14, lineHeight:21 },
  bubbleTextUser:  { color:'#fff' },
  quickRow:        { maxHeight:48, marginBottom:8 },
  quickBtn:        { borderRadius:20, paddingHorizontal:14, paddingVertical:8, borderWidth:0.5 },
  quickText:       { fontSize:13 },
  inputRow:        { flexDirection:'row', padding:12, gap:8, borderTopWidth:0.5 },
  input:           { flex:1, borderRadius:20, paddingHorizontal:16, paddingVertical:10, fontSize:14, maxHeight:100 },
  sendBtn:         { width:42, height:42, borderRadius:21, justifyContent:'center', alignItems:'center', alignSelf:'flex-end' },
  sendBtnDisabled: { opacity:0.4 },
  sendText:        { color:'#fff', fontSize:20, fontWeight:'600' },
});

