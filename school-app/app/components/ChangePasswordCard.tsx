// @ts-nocheck
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import api from '../../src/api';

export default function ChangePasswordCard({ theme, compact = false }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);

  const submit = async () => {
    if (!currentPassword || !password || !passwordConfirmation) {
      Alert.alert('Required', 'Please complete all password fields.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Too short', 'New password must be at least 8 characters.');
      return;
    }

    if (password !== passwordConfirmation) {
      Alert.alert('Password mismatch', 'New password and confirmation do not match.');
      return;
    }

    setSaving(true);
    try {
      await api.put('/me/password', {
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      });
      setCurrentPassword('');
      setPassword('');
      setPasswordConfirmation('');
      Alert.alert('Password updated', 'You can use your new password next time you sign in.');
    } catch (e) {
      Alert.alert('Update failed', e.response?.data?.message || 'Could not update password.');
    } finally {
      setSaving(false);
    }
  };

  const inputProps = {
    secureTextEntry: !visible,
    placeholderTextColor: theme.textMuted,
    autoCapitalize: 'none',
  };

  return (
    <View style={[styles.card, compact && styles.cardCompact, { backgroundColor: compact ? theme.bg : theme.card, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text }]}>Change Password</Text>
        <TouchableOpacity onPress={() => setVisible(value => !value)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.toggle, { color: theme.primary }]}>{visible ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={[styles.input, compact && styles.inputCompact, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="Current password"
        {...inputProps}
      />
      <TextInput
        style={[styles.input, compact && styles.inputCompact, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
        value={password}
        onChangeText={setPassword}
        placeholder="New password"
        {...inputProps}
      />
      <TextInput
        style={[styles.input, compact && styles.inputCompact, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
        value={passwordConfirmation}
        onChangeText={setPasswordConfirmation}
        placeholder="Confirm new password"
        {...inputProps}
      />

      <TouchableOpacity
        style={[styles.button, compact && styles.buttonCompact, { backgroundColor: theme.primary }, saving && styles.buttonDisabled]}
        onPress={submit}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update password</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 14, borderRadius: 12, borderWidth: 1, padding: 16 },
  cardCompact: { marginHorizontal: 0, marginTop: 15, borderWidth: 0, borderRadius: 0, padding: 0 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '800' },
  toggle: { fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, marginBottom: 10 },
  inputCompact: { minHeight: 34, paddingVertical: 8, fontSize: 10, marginBottom: 8, borderRadius: 10 },
  button: { minHeight: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  buttonCompact: { minHeight: 35, borderRadius: 10 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
