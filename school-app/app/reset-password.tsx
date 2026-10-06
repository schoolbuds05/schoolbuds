// @ts-nocheck
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView,
  ScrollView, Platform,
} from 'react-native';
import api from '../src/api';
import * as Clipboard from 'expo-clipboard';

export default function ResetPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !token.trim() || !password) {
      Alert.alert('Missing fields', 'Please complete all fields.');
      return;
    }
    if (password !== passwordConfirmation) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/reset-password', {
        email: email.trim(),
        otp: token.trim(),
        password: password,
        password_confirmation: passwordConfirmation,
      });

      Alert.alert('Success', res.data.message || 'Password has been reset.', [
        { text: 'OK', onPress: () => router.replace('/login') },
      ]);
    } catch (e) {
      const message = e.response?.data?.message || 'Could not reset password. Please check the OTP and try again.';
      Alert.alert('Reset failed', message);
    } finally {
      setLoading(false);
    }
  };

  const pasteResetLink = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) {
        Alert.alert('Clipboard empty', 'No text found in clipboard.');
        return;
      }

      // Try to extract OTP from common message text
      const tokenMatch = text.match(/\b(\d{6})\b/);
      if (tokenMatch && tokenMatch[1]) {
        setToken(tokenMatch[1]);
      } else {
        const bareTokenMatch = text.match(/^(\d{6})$/);
        if (bareTokenMatch) setToken(bareTokenMatch[0]);
      }

      // Try to extract email from query param
      const emailMatch = text.match(/[?&]email=([^&\s]+)/i);
      if (emailMatch && emailMatch[1]) {
        try {
          setEmail(decodeURIComponent(emailMatch[1]));
        } catch (e) {
          setEmail(emailMatch[1]);
        }
      }

      Alert.alert('Pasted', 'OTP code (and email if present) pasted from clipboard.');
    } catch (e) {
      Alert.alert('Paste failed', 'Could not read clipboard.');
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
        <Text style={styles.logo}>🔁</Text>
        <Text style={styles.title}>Enter OTP code</Text>
        <Text style={styles.sub}>Paste the one-time code from your email and set a new password.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="next"
        />

        <TextInput
          style={styles.input}
          placeholder="OTP code"
          placeholderTextColor="#aaa"
          value={token}
          onChangeText={setToken}
          keyboardType="number-pad"
          maxLength={6}
          autoCapitalize="none"
        />

        <TouchableOpacity style={[styles.btn, { backgroundColor: '#eee' }]} onPress={pasteResetLink}>
          <Text style={[styles.btnText, { color: '#333' }]}>Paste OTP</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="New password"
          placeholderTextColor="#aaa"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="next"
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor="#aaa"
          value={passwordConfirmation}
          onChangeText={setPasswordConfirmation}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reset password</Text>}
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
  title: { fontSize: 22, fontWeight: '600', color: '#1a1a1a', textAlign: 'center' },
  sub: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 18, marginTop: 6 },
  input: {
    borderWidth: 0.5, borderColor: '#ddd', borderRadius: 12,
    padding: 14, marginBottom: 14,
    fontSize: 14, color: '#1a1a1a', backgroundColor: '#fafafa',
  },
  btn: { backgroundColor: '#378ADD', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 14 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  linkBtn: { alignItems: 'center', marginTop: 8 },
  linkText: { color: '#378ADD', fontSize: 13, fontWeight: '600' },
});
