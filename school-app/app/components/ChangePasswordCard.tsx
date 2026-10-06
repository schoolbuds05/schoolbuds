// @ts-nocheck
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import api from '../../src/api';

export default function ChangePasswordCard({ theme }) {
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
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text }]}>Change Password</Text>
        <TouchableOpacity onPress={() => setVisible(value => !value)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.toggle, { color: theme.primary }]}>{visible ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="Current password"
        {...inputProps}
      />
      <TextInput
        style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
        value={password}
        onChangeText={setPassword}
        placeholder="New password"
        {...inputProps}
      />
      <TextInput
        style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
        value={passwordConfirmation}
        onChangeText={setPasswordConfirmation}
        placeholder="Confirm new password"
        {...inputProps}
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }, saving && styles.buttonDisabled]}
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '800' },
  toggle: { fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, marginBottom: 10 },
  button: { minHeight: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
