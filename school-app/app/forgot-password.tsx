// @ts-nocheck
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView,
  ScrollView, Platform,
} from 'react-native';
import api from '../src/api';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Email required', 'Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/forgot-password', { email: email.trim() });
      Alert.alert('Check your inbox', res.data.message || 'An OTP has been sent to your email.', [
        { text: 'Open reset screen', onPress: () => router.push('/reset-password') },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch (e) {
      const message = e.response?.data?.message || 'Could not send OTP. Please try again.';
      Alert.alert('Reset failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={styles.logo}>🔐</Text>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.sub}>Enter your email and we&apos;ll send a one-time code to reset your password.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/reset-password')}>
          <Text style={styles.linkText}>Open reset screen</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkBtn} onPress={() => router.back()}>
          <Text style={styles.linkText}>Back to login</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 28,
  },
  logo: { fontSize: 48, textAlign: 'center', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '600', color: '#1a1a1a', textAlign: 'center' },
  sub: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 28, marginTop: 6 },
  input: {
    borderWidth: 0.5, borderColor: '#ddd', borderRadius: 12,
    padding: 14, marginBottom: 16,
    fontSize: 14, color: '#1a1a1a', backgroundColor: '#fafafa',
  },
  btn: { backgroundColor: '#378ADD', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 14 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  linkBtn: { alignItems: 'center', marginTop: 8 },
  linkText: { color: '#378ADD', fontSize: 13, fontWeight: '600' },
});
