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
import HeaderGradient from '../components/ui/HeaderGradient';
import api, { removeToken } from '../../src/api';
import { useTheme } from '../../src/theme-context';
import ChangePasswordCard from '../components/ChangePasswordCard';

export default function AdminProfile() {
  const router = useRouter();
  const { theme } = useTheme();
  const [user, setUser] = useState(null);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('user').then(value => {
      if (value) setUser(JSON.parse(value));
    });

    const load = async () => {
      try {
        const [meRes, dashboardRes] = await Promise.all([
          api.get('/me'),
          api.get('/admin/dashboard'),
        ]);
        const me = meRes.data?.user ?? meRes.data;
        setUser(me);
        setCounts(dashboardRes.data?.counts || null);
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

  return (
    <ScrollView style={[s.container, { backgroundColor: theme.bg }]} contentContainerStyle={{ paddingBottom: 36 }}>
      <HeaderGradient
        title={user?.name ?? 'Admin Profile'}
        subtitle={user?.email ?? 'admin@school.com'}
        initials={initials(user?.name)}
        stats={[
          { label: 'Admins', value: counts?.admins ?? 0, accent: '#4338CA' },
          { label: 'Registrars', value: counts?.registrars ?? 0, accent: '#0369A1' },
          { label: 'Teachers', value: counts?.teachers ?? 0, accent: '#15803D' },
          { label: 'Students', value: counts?.students ?? 0, accent: '#B45309' },
        ]}
      />

      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text style={[s.cardTitle, { color: theme.text }]}>Profile photo</Text>
        <View style={s.photoRow}>
          <TouchableOpacity
            style={[s.profileAvatar, { backgroundColor: theme.primaryLight }]}
            onPress={handleChangePhoto}
            activeOpacity={0.8}
            disabled={uploadingPhoto}
          >
            {user?.profile_photo_url ? (
              <Image source={{ uri: user.profile_photo_url }} style={s.profileAvatarImage} />
            ) : (
              <Text style={[s.profileAvatarText, { color: theme.primary }]}>{initials(user?.name)}</Text>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.photoTitle, { color: theme.text }]}>Admin avatar</Text>
            <Text style={[s.photoSub, { color: theme.textSub }]}>Used on your profile icon and account page.</Text>
          </View>
          <TouchableOpacity
            style={[s.changePhotoBtn, { backgroundColor: theme.primary }, uploadingPhoto && { opacity: 0.6 }]}
            onPress={handleChangePhoto}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.changePhotoText}>Change</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text style={[s.cardTitle, { color: theme.text }]}>Account information</Text>
        {[
          ['Name', user?.name ?? 'Admin'],
          ['Email', user?.email ?? '-'],
          ['Role', roleLabel],
          ['Member since', user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'],
        ].map(([label, value]) => (
          <View key={label} style={s.infoRow}>
            <Text style={[s.infoLabel, { color: theme.textSub }]}>{label}</Text>
            <Text style={[s.infoValue, { color: theme.text }]}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text style={[s.cardTitle, { color: theme.text }]}>Managed roles</Text>
        {[
          ['Admins', counts?.admins ?? 0],
          ['Registrars', counts?.registrars ?? 0],
          ['Teachers', counts?.teachers ?? 0],
          ['Students', counts?.students ?? 0],
        ].map(([label, value]) => (
          <View key={label} style={s.infoRow}>
            <Text style={[s.infoLabel, { color: theme.textSub }]}>{label}</Text>
            <Text style={[s.infoValue, { color: theme.text }]}>{value}</Text>
          </View>
        ))}
      </View>

      <ChangePasswordCard theme={theme} />

      <TouchableOpacity style={[s.logoutBtn, { backgroundColor: theme.dangerLight }]} onPress={handleLogout}>
        <Text style={[s.logoutText, { color: theme.danger }]}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function initials(name) {
  if (!name) return 'AD';
  return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },
  hero: { backgroundColor: '#334155', paddingTop: 52, paddingBottom: 24, paddingHorizontal: 20, alignItems: 'center' },
  avatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  initials: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { color: '#fff', fontSize: 21, fontWeight: '800' },
  email: { color: 'rgba(255,255,255,0.78)', fontSize: 13, marginTop: 4 },
  roleBadge: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
  roleText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  card: { marginHorizontal: 14, marginTop: 14, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 12 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  profileAvatarImage: { width: '100%', height: '100%', borderRadius: 32 },
  profileAvatarText: { fontSize: 18, fontWeight: '900' },
  photoTitle: { fontSize: 14, fontWeight: '800' },
  photoSub: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  changePhotoBtn: { minWidth: 76, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  changePhotoText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  infoLabel: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  infoValue: { color: '#111827', fontSize: 13, fontWeight: '800', textAlign: 'right', maxWidth: '58%' },
  logoutBtn: { marginHorizontal: 14, marginTop: 14, backgroundColor: '#FEE2E2', borderRadius: 12, padding: 16, alignItems: 'center' },
  logoutText: { color: '#B91C1C', fontWeight: '800', fontSize: 14 },
});
