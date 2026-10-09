// @ts-nocheck
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView,
  ScrollView, Platform, Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
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
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
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

  const chartHeights = [12, 17, 23, 29, 35, 41, 47];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.brandPanel}>
          <View style={styles.schoolHeader}>
            <Image
              source={require('../assets/images/st-cecilia-college-seal.png')}
              style={styles.schoolSeal}
              resizeMode="contain"
              accessibilityLabel="St. Cecilia's College seal"
            />
            <Text style={styles.schoolName}>St. Cecilia&apos;s College{'\n'}Cebu, Inc.</Text>
          </View>

          <View style={styles.brandIdentity}>
            <View style={styles.logoBadge}>
              <Image
                source={require('../assets/images/schoolbuds-login-logo.png')}
                style={styles.brandLogo}
                resizeMode="contain"
                accessibilityLabel="SchoolBuds logo"
              />
            </View>
            <View style={styles.brandNameRow}>
              <Text style={styles.brandName}>SchoolBuds</Text>
              <Svg width={22} height={23} viewBox="0 0 32 32" accessibilityElementsHidden importantForAccessibility="no">
                <Path d="M16 28V15" fill="none" stroke="#187a45" strokeLinecap="round" strokeWidth={2.4} />
                <Path d="M15.5 19C7.8 18.6 4.7 12.5 6.5 5.2c7.5-.3 12.2 4.2 11.7 10.4" fill="#187a45" />
                <Path d="M16 15C15.3 7.5 20 3.3 27.5 3c2.2 7.1-1.4 12.5-10.4 14.6" fill="#35a852" />
                <Path d="M9 8.2c3.8 1.4 5.8 4.3 6.7 8.2M24.4 6.1c-3.3 2-5.6 4.7-7 8.1" fill="none" stroke="#b9e4c0" strokeLinecap="round" strokeWidth={1.1} />
              </Svg>
            </View>
            <Text style={styles.brandTagline}>All Things School. One Bud Away.</Text>
          </View>

          <View style={styles.brandChart} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {chartHeights.map((height, index) => (
              <View key={height} style={[styles.chartBar, styles[`chartBar${index + 1}`], { height }]} />
            ))}
          </View>
          <View style={styles.brandStripe} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.redStripe} />
            <View style={styles.greenStripe} />
          </View>
        </View>

        <View style={styles.formPanel}>
          <View style={styles.formCard}>
            <Text style={styles.heading}>Create your account</Text>
            <Text style={styles.description}>Register with your school account.</Text>

            <Text style={styles.label}>First name</Text>
            <TextInput
              style={styles.input}
              placeholder="First name"
              placeholderTextColor="#9da49e"
              value={firstName}
              onChangeText={setFirstName}
              autoComplete="given-name"
              returnKeyType="next"
            />

            <Text style={styles.label}>Middle name</Text>
            <TextInput
              style={styles.input}
              placeholder="Middle name (optional)"
              placeholderTextColor="#9da49e"
              value={middleName}
              onChangeText={setMiddleName}
              autoComplete="additional-name"
              returnKeyType="next"
            />

            <Text style={styles.label}>Last name</Text>
            <TextInput
              style={styles.input}
              placeholder="Last name"
              placeholderTextColor="#9da49e"
              value={lastName}
              onChangeText={setLastName}
              autoComplete="family-name"
              returnKeyType="next"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="name@school.edu.ph"
              placeholderTextColor="#9da49e"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordField}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Create a password"
                placeholderTextColor="#9da49e"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                returnKeyType="next"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword((visible) => !visible)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#4a5a4e" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm password</Text>
            <View style={styles.passwordField}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Enter your password again"
                placeholderTextColor="#9da49e"
                value={passwordConfirmation}
                onChangeText={setPasswordConfirmation}
                secureTextEntry={!showPasswordConfirmation}
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPasswordConfirmation((visible) => !visible)}
                accessibilityRole="button"
                accessibilityLabel={showPasswordConfirmation ? 'Hide password confirmation' : 'Show password confirmation'}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={showPasswordConfirmation ? 'eye-off-outline' : 'eye-outline'} size={20} color="#4a5a4e" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.registerText}>Create account</Text>}
            </TouchableOpacity>

            <View style={styles.accountLinks}>
              <Text style={styles.registerPrompt}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace('/login')} accessibilityRole="link">
                <Text style={styles.linkText}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.legal}>Accounts are issued by your school.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f5' },
  screen: { flexGrow: 1, backgroundColor: '#faf9f5' },
  brandPanel: {
    height: 330,
    alignItems: 'center',
    backgroundColor: '#f8ecec',
    paddingTop: 32,
    paddingHorizontal: 20,
  },
  schoolHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  schoolSeal: { width: 44, height: 44 },
  schoolName: { color: '#b91c1c', fontSize: 12, fontWeight: '700', lineHeight: 16 },
  brandIdentity: { alignItems: 'center', marginTop: 14 },
  logoBadge: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 48,
    backgroundColor: '#fff',
    shadowColor: '#501818',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  brandLogo: { width: 56, height: 68 },
  brandNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  brandName: { marginTop: 5, color: '#dc2626', fontSize: 24, fontWeight: '800', lineHeight: 29 },
  brandTagline: { marginTop: 1, color: '#1f1e1d', fontSize: 11, fontWeight: '700' },
  brandChart: {
    position: 'absolute',
    right: '17%',
    bottom: 8,
    left: '17%',
    height: 47,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  chartBar: { width: 28, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: '#f3d2d2' },
  chartBar1: { backgroundColor: '#f3d2d2' },
  chartBar2: { backgroundColor: '#efbdbd' },
  chartBar3: { backgroundColor: '#eba6a6' },
  chartBar4: { backgroundColor: '#e88888' },
  chartBar5: { backgroundColor: '#e46a6a' },
  chartBar6: { backgroundColor: '#e04646' },
  chartBar7: { backgroundColor: '#dc2626' },
  brandStripe: { position: 'absolute', right: 0, bottom: 0, left: 0, height: 8, flexDirection: 'row' },
  redStripe: { flex: 1, backgroundColor: '#dc2626' },
  greenStripe: { flex: 1, backgroundColor: '#1b6e2a' },
  formPanel: { flex: 1, backgroundColor: '#faf9f5', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34 },
  formCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: '#e5a3a3',
    borderRadius: 18,
    backgroundColor: '#fff',
    padding: 24,
    shadowColor: '#1f2a22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  heading: { color: '#dc2626', fontSize: 22, fontWeight: '800', lineHeight: 28 },
  description: { marginTop: 3, marginBottom: 15, color: '#4a5a4e', fontSize: 13, lineHeight: 19 },
  label: { marginTop: 9, marginBottom: 6, color: '#1f2a22', fontSize: 12, fontWeight: '700' },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#dfe4df',
    borderRadius: 9,
    paddingHorizontal: 13,
    fontSize: 13,
    color: '#1f2a22',
    backgroundColor: '#fff',
  },
  passwordField: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeButton: { position: 'absolute', top: 0, right: 3, bottom: 0, width: 42, alignItems: 'center', justifyContent: 'center' },
  registerButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    borderRadius: 9,
    backgroundColor: '#dc2626',
  },
  registerText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  accountLinks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  registerPrompt: { color: '#647064', fontSize: 12 },
  linkText: { color: '#1b6e2a', fontSize: 12, fontWeight: '700' },
  legal: { alignSelf: 'center', marginTop: 20, color: '#647064', fontSize: 11 },
});
