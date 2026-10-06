// @ts-nocheck
import { useState } from 'react';
import {
  Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView,
  ScrollView, Platform, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import api, { setToken } from '../src/api';
import { useTheme } from '../src/theme-context';

export default function Register() {
  const router = useRouter();
  const { reloadTheme } = useTheme();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!firstName.trim()) return Alert.alert('Required', 'Enter your first name.');
    if (!lastName.trim()) return Alert.alert('Required', 'Enter your last name.');
    if (!email.trim()) return Alert.alert('Required', 'Enter your email address.');
    if (password.length < 8) return Alert.alert('Required', 'Password must be at least 8 characters.');
    if (password !== passwordConfirmation) return Alert.alert('Error', 'Passwords do not match.');

    setLoading(true);
    try {
      const res = await api.post('/register', {
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        password_confirmation: passwordConfirmation,
      });

      const { token, role, user } = res.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('role', role);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.removeItem('position');
      setToken(token);
      await reloadTheme();

      Alert.alert(
        'Account created',
        'Your account is ready. You can start enrollment whenever you are ready.',
        [{ text: 'Continue', onPress: () => router.replace('/(tabs)/today') }]
      );
    } catch (error) {
      const message = error?.response?.data?.message
        || (error?.request ? 'Cannot reach the server. Check the API URL, Laravel server, and firewall.' : error?.message)
        || 'Registration failed. Please try again.';
      Alert.alert('Registration failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image source={require('../assets/images/schoolbuds-logo.png')} style={styles.logoImage} resizeMode="contain" />
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.sub}>Create your account now. Enrollment can come later.</Text>

        <TextInput
          style={styles.input}
          placeholder="First name"
          placeholderTextColor="#aaa"
          value={firstName}
          onChangeText={setFirstName}
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          placeholder="Middle name"
          placeholderTextColor="#aaa"
          value={middleName}
          onChangeText={setMiddleName}
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          placeholder="Last name"
          placeholderTextColor="#aaa"
          value={lastName}
          onChangeText={setLastName}
          returnKeyType="next"
        />
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
          placeholder="Password"
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
          onSubmitEditing={handleRegister}
        />

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Register</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/login')}>
          <Text style={styles.loginLinkText}>Already have an account? Sign in</Text>
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
  logoImage: { width: 130, height: 130, alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '600', color: '#1a1a1a', textAlign: 'center' },
  sub: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 32, marginTop: 6 },
  input: {
    borderWidth: 0.5,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    fontSize: 14,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
  },
  btn: { backgroundColor: '#378ADD', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  loginLink: { alignItems: 'center', marginTop: 18 },
  loginLinkText: { color: '#378ADD', fontSize: 13, fontWeight: '600' },
});
