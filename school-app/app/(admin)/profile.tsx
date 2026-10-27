// @ts-nocheck
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import api, { removeToken } from '../../src/api';
import { useTheme } from '../../src/theme-context';
import ChangePasswordCard from '../components/ChangePasswordCard';

export default function AdminProfile() {
  const router = useRouter();
  const { theme } = useTheme();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [passwordExpanded, setPasswordExpanded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('user').then(value => {
      if (value) setUser(JSON.parse(value));
    });

    const load = async () => {
      try {
        const meRes = await api.get('/me');
        const me = meRes.data?.user ?? meRes.data;
        setUser(me);
      } catch (e) {
        console.log('Admin profile error:', e.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const logout = async () => {
    await api.post('/logout').catch(() => {});
    await AsyncStorage.multiRemove(['token', 'role', 'position', 'user']);
    removeToken();
    router.replace('/login');
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) {
        logout();
      }
      return;
    }

    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  const handleChangePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo access to update your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const image = result.assets[0];
    const payload = new FormData();
    payload.append('profile_photo', {
      uri: image.uri,
      name: image.fileName || 'profile-photo.jpg',
      type: image.mimeType || 'image/jpeg',
    });

    setUploadingPhoto(true);
    try {
      const res = await api.post('/me/profile-photo', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updatedUser = res.data?.user;

      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      Alert.alert('Updated', 'Your profile photo has been updated.');
    } catch (e) {
      Alert.alert('Upload failed', e.response?.data?.message || 'Could not update your profile photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}> 
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const roleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin';
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  return (
    <ScrollView style={[s.container, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>ACCOUNT</Text>
      <Text style={s.pageTitle}>Profile</Text>

      <View style={s.profileHero}>
        <TouchableOpacity
          style={[s.profileAvatar, { backgroundColor: theme.primaryLight }, uploadingPhoto && { opacity: 0.65 }]}
          onPress={handleChangePhoto}
          activeOpacity={0.8}
          disabled={uploadingPhoto}
          accessibilityLabel="Change profile photo"
        >
          {user?.profile_photo_url ? (
            <Image source={{ uri: user.profile_photo_url }} style={s.profileAvatarImage} />
          ) : (
            <Text style={[s.profileAvatarText, { color: theme.primary }]}>{initials(user?.name)}</Text>
          )}
        </TouchableOpacity>
        <Text style={s.profileName}>{user?.name ?? 'Admin School'}</Text>
        <Text style={s.profileEmail}>{user?.email ?? 'admin@school.com'}</Text>
        <View style={s.roleBadge}><Text style={s.roleText}>{roleLabel}</Text></View>
      </View>

      <View style={s.infoCard}>
        {[
          ['Full name', user?.name ?? 'Admin School'],
          ['Email', user?.email ?? '—'],
          ['Role', roleLabel],
          ['Member since', memberSince],
        ].map(([label, value], index, rows) => (
          <View key={label} style={[s.infoRow, index === rows.length - 1 && s.infoRowLast]}>
            <Text style={s.infoLabel}>{label}</Text>
            <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[s.primaryButton, uploadingPhoto && { opacity: 0.65 }]}
        onPress={handleChangePhoto}
        disabled={uploadingPhoto}
        activeOpacity={0.85}
      >
        {uploadingPhoto ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryButtonText}>Edit profile</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={s.secondaryButton} onPress={() => setPasswordExpanded(value => !value)} activeOpacity={0.85}>
        <Text style={s.secondaryButtonText}>{passwordExpanded ? 'Hide password form' : 'Change password'}</Text>
      </TouchableOpacity>
      {passwordExpanded ? <ChangePasswordCard theme={theme} compact /> : null}

      <TouchableOpacity style={s.logoutButton} onPress={handleLogout}>
        <Text style={s.logoutText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function initials(name) {
  if (!name) return 'AD';
  return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 28 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  eyebrow: { color: '#AE1234', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  pageTitle: { color: '#301A20', fontSize: 28, lineHeight: 34, fontWeight: '800', marginTop: 2 },
  profileHero: { alignItems: 'center', marginTop: 20, marginBottom: 16 },
  profileAvatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  profileAvatarImage: { width: '100%', height: '100%', borderRadius: 44 },
  profileAvatarText: { fontSize: 30, fontWeight: '800' },
  profileName: { color: '#301A20', fontSize: 19, fontWeight: '800', marginTop: 10 },
  profileEmail: { color: '#806D72', fontSize: 13, marginTop: 2 },
  roleBadge: { marginTop: 8, paddingHorizontal: 11, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F7DFE4' },
  roleText: { color: '#AE1234', fontSize: 11, fontWeight: '800' },
  infoCard: { borderRadius: 16, borderWidth: 1, borderColor: '#F0D9DE', backgroundColor: '#fff', overflow: 'hidden' },
  infoRow: { minHeight: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3E5E8' },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { color: '#806D72', fontSize: 13 },
  infoValue: { color: '#301A20', fontSize: 13, fontWeight: '700', textAlign: 'right', maxWidth: '60%' },
  primaryButton: { minHeight: 49, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#AE1234', marginTop: 17 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  secondaryButton: { minHeight: 49, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#AE1234', backgroundColor: '#fff', marginTop: 9 },
  secondaryButtonText: { color: '#AE1234', fontSize: 14, fontWeight: '800' },
  logoutButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 7 },
  logoutText: { color: '#AE1234', fontSize: 14, fontWeight: '800' },
});
