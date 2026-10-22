// @ts-nocheck
// app/(tabs)/profile.tsx — Student profile (fully polished)

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image,
  TouchableOpacity, Alert, ActivityIndicator,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api, { removeToken } from '../../src/api';
import { Colors, Font, Radius, Shadow, HEADER_TOP } from '../../src/theme';
import { useTheme } from '../../src/theme-context';
import ChangePasswordCard from '../components/ChangePasswordCard';

export default function Profile() {
  const router = useRouter();
  const { theme, themeName, setThemeName, themes } = useTheme();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState([]);
  const [notificationsExpanded, setNotificationsExpanded] = useState(true);
  const [passwordExpanded, setPasswordExpanded] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet(['role', 'position']).then(pairs => {
      const role = pairs[0][1];
      const position = pairs[1][1];
      if (['head_department', 'dean'].includes(position) || ['head_department', 'dean'].includes(role)) {
        router.replace('/(leadership)/profile');
        return;
      }
      if (['faculty', 'teacher', 'head_teacher'].includes(role)) {
        router.replace('/(teacher)/profile');
        return;
      }
      if (role === 'parent') {
        router.replace('/(parent)/profile');
        return;
      }
      if (['staff', 'librarian', 'property_custodian'].includes(role)) {
        router.replace('/(staff)/profile');
        return;
      }
      Promise.all([
        api.get('/dashboard/student'),
        api.get('/notifications/preferences'),
      ])
        .then(([dashboardRes, prefsRes]) => {
          setData(dashboardRes.data);
          setNotificationPrefs(prefsRes.data?.preferences ?? []);
        })
        .finally(() => setLoading(false));
    });
  }, [router]);

  const togglePreference = async (category, key) => {
    const next = notificationPrefs.map(pref => (
      pref.category === category ? { ...pref, [key]: !pref[key] } : pref
    ));
    setNotificationPrefs(next);

    try {
      await api.put('/notifications/preferences', { preferences: next });
    } catch (e) {
      setNotificationPrefs(notificationPrefs);
      Alert.alert('Update failed', e.response?.data?.message || 'Could not save notification preferences.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          await api.post('/logout').catch(() => {});
          await AsyncStorage.multiRemove(['token', 'role', 'position', 'user']);
          removeToken();
          router.replace('/login');
        },
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
      const user = res.data?.user;
      const profilePhotoUrl = user?.profile_photo_url;

      setData(prev => ({
        ...prev,
        user,
        student: {
          ...prev?.student,
          profile_photo_url: profilePhotoUrl,
        },
      }));

      const stored = await AsyncStorage.getItem('user');
      const parsed = stored ? JSON.parse(stored) : {};
      await AsyncStorage.setItem('user', JSON.stringify({
        ...parsed,
        ...user,
        profile_photo_url: profilePhotoUrl,
      }));

      Alert.alert('Updated', 'Your profile photo has been updated.');
    } catch (e) {
      Alert.alert('Upload failed', e.response?.data?.message || 'Could not update your profile photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) return (
    <View style={[styles.center, { backgroundColor: theme.bg }]}> 
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );

  const s        = data?.student;
  const profilePhotoUrl = s?.profile_photo_url || data?.user?.profile_photo_url;
  const initials = s ? `${s.first_name[0]}${s.last_name[0]}`.toUpperCase() : '??';
  const enrollment = s?.enrollment;
  const yearLevelLabel = (value) => {
    const year = String(value || '').replace(/[^0-9]/g, '');
    return year ? `${year}${year === '1' ? 'st' : year === '2' ? 'nd' : year === '3' ? 'rd' : 'th'} Year` : null;
  };
  const levelLabel = enrollment?.program_type === 'college'
    ? yearLevelLabel(enrollment.year_level || s?.grade_level)
    : s?.grade_level
      ? `Grade ${s.grade_level}`
      : null;
  const gradeSection = [
    levelLabel,
    s?.section && s.section !== 'TBA' ? s.section : 'No section',
  ].filter(Boolean).join(' - ');
  const allGrades = data?.grades ? Object.values(data.grades).flat() : [];
  const gwa = allGrades.length > 0
    ? (allGrades.reduce((sum, g) => sum + parseFloat(g.score), 0) / allGrades.length).toFixed(1)
    : '—';

  const badges = [
    (enrollment?.program_type === 'college' ? parseFloat(gwa) <= 1.5 : parseFloat(gwa) >= 90) && { icon: '🏆', label: 'Honor Student' },
    (data?.attendance_pct ?? 0) >= 90 && { icon: '📅', label: 'Perfect Attendance' },
    allGrades.length > 0 && { icon: '📚', label: 'Active Learner' },
    { icon: '⭐', label: `Enrolled ${s?.school_year}` },
  ].filter(Boolean);

  return (
    <ScrollView style={[styles.compactContainer, { backgroundColor: theme.bg }]} contentContainerStyle={styles.compactContent}>
      <View style={styles.compactTop}><TouchableOpacity style={[styles.compactBack, { backgroundColor: theme.card }]} onPress={() => router.back()}><Ionicons name="chevron-back" size={16} color={theme.text} /></TouchableOpacity><Text style={[styles.compactTopLabel, { color: theme.textSub }]}>Profile</Text></View>
      <TouchableOpacity style={styles.compactIdentity} onPress={handleChangePhoto} disabled={uploadingPhoto}><View style={[styles.compactAvatar, { backgroundColor: theme.primary }]}>{profilePhotoUrl ? <Image source={{ uri: profilePhotoUrl }} style={styles.compactAvatarImage} /> : <Text style={styles.compactInitials}>{initials[0]}</Text>}</View><Text style={[styles.compactName, { color: theme.text }]}>{s?.first_name} {s?.last_name}</Text><Text style={[styles.compactId, { color: theme.textSub }]}>{s?.student_id}</Text></TouchableOpacity>
      <View style={[styles.compactStats, { backgroundColor: theme.card }]}><CompactStat value={gwa} label="GWA" theme={theme} /><CompactStat value={`${data?.attendance_pct ?? 0}%`} label="Attendance" theme={theme} /><CompactStat value={data?.pending_fees?.length ?? 0} label="Fees due" theme={theme} /></View>
      <Text style={[styles.compactSection, { color: theme.textSub }]}>Color theme</Text><View style={[styles.compactThemeCard, { backgroundColor: theme.card }]}>{Object.values(themes).map(palette => <TouchableOpacity key={palette.name} style={[styles.compactThemeDot, { backgroundColor: palette.primary }, themeName === palette.name && styles.compactThemeSelected]} onPress={() => setThemeName(palette.name)} />)}</View>
      <Text style={[styles.compactSection, { color: theme.textSub }]}>Student information</Text><View style={[styles.compactInfo, { backgroundColor: theme.card }]}><CompactInfo label="School year" value={s?.school_year} theme={theme} /><CompactInfo label="Year and section" value={gradeSection} theme={theme} /><CompactInfo label="Program" value={enrollment?.program_type === 'college' ? enrollment?.course : enrollment?.strand} theme={theme} /><CompactInfo label="Status" value={s?.status || 'Active'} theme={theme} last /></View>
      <TouchableOpacity style={[styles.compactAction, { backgroundColor: theme.card }]} onPress={() => setNotificationsExpanded(value => !value)}><View style={styles.compactActionLabel}><Ionicons name="notifications-outline" size={17} color={theme.primary} /><Text style={[styles.compactPrefText, { color: theme.text }]}>Notifications</Text></View><Ionicons name={notificationsExpanded ? 'chevron-up' : 'chevron-forward'} size={17} color={theme.textSub} /></TouchableOpacity>
      {notificationsExpanded && <View style={[styles.compactInfo, { backgroundColor: theme.card }]}>{notificationPrefs.map((pref, index) => <View key={pref.category} style={[styles.compactPref, index < notificationPrefs.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}><Text style={[styles.compactPrefText, { color: theme.text }]}>{pref.category.replace('_', ' ')}</Text><Switch value={!!pref.in_app} onValueChange={() => togglePreference(pref.category, 'in_app')} trackColor={{ false: theme.border, true: theme.primaryLight }} thumbColor={pref.in_app ? theme.primary : '#f4f3f4'} /></View>)}</View>}
      <Text style={[styles.compactSection, { color: theme.textSub }]}>Achievements</Text><View style={[styles.compactInfo, { backgroundColor: theme.card }]}>{badges.map((badge, index) => <View key={`${badge.label}-${index}`} style={[styles.compactPref, index < badges.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}><Text style={[styles.compactPrefText, { color: theme.text }]}>{badge.label}</Text><Text style={{ fontSize: 18 }}>{badge.icon}</Text></View>)}</View>
      <TouchableOpacity style={[styles.compactAction, { backgroundColor: theme.card }]} onPress={() => setPasswordExpanded(value => !value)}><View style={styles.compactActionLabel}><Ionicons name="lock-closed-outline" size={17} color={theme.primary} /><Text style={[styles.compactPrefText, { color: theme.text }]}>Change password</Text></View><Ionicons name={passwordExpanded ? 'chevron-up' : 'chevron-forward'} size={17} color={theme.textSub} /></TouchableOpacity>
      {passwordExpanded && <ChangePasswordCard theme={theme} />}
      <TouchableOpacity style={[styles.compactLogout, { borderColor: theme.danger, backgroundColor: theme.card }]} onPress={handleLogout}><Ionicons name="log-out-outline" size={16} color={theme.danger} /><Text style={[styles.compactLogoutText, { color: theme.danger }]}>Log out</Text></TouchableOpacity>
    </ScrollView>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* ── Hero ── */}
      <View style={[styles.hero, { backgroundColor: theme.primary }]}>
        <TouchableOpacity
          style={styles.avatar}
          onPress={handleChangePhoto}
          activeOpacity={0.8}
          disabled={uploadingPhoto}
        >
          {profilePhotoUrl ? (
            <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.initials}>{initials}</Text>
          )}
          <View style={styles.avatarEditBadge}>
            {uploadingPhoto
              ? <ActivityIndicator size="small" color={theme.primary} />
              : <Text style={styles.avatarEditText}>+</Text>
            }
          </View>
        </TouchableOpacity>
        <Text style={styles.name}>{s?.first_name} {s?.last_name}</Text>
        <Text style={styles.studentId}>{s?.student_id}</Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroVal}>{gwa}</Text>
            <Text style={styles.heroLabel}>GWA</Text>
          </View>
          <View style={[styles.heroStat, styles.heroStatMiddle]}>
            <Text style={styles.heroVal}>{data?.attendance_pct ?? 0}%</Text>
            <Text style={styles.heroLabel}>Attendance</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroVal}>{data?.pending_fees?.length ?? 0}</Text>
            <Text style={styles.heroLabel}>Pending fees</Text>
          </View>
        </View>
      </View>

      {/* ── Info ── */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Color Theme</Text>
        <View style={styles.paletteRow}>
          {Object.values(themes).map((palette) => (
            <TouchableOpacity
              key={palette.name}
              style={[
                styles.paletteOption,
                { backgroundColor: theme.bg, borderColor: theme.border },
                themeName === palette.name && { borderColor: theme.primary },
              ]}
              onPress={() => setThemeName(palette.name)}
            >
              <View style={[styles.paletteDot, { backgroundColor: palette.primary }]} />
              <Text style={[
                styles.paletteLabel,
                { color: themeName === palette.name ? theme.primary : theme.textSub },
              ]}>
                {palette.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card }]}> 
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Student Information</Text>
        {[
          ['School Year', s?.school_year],
          [enrollment?.program_type === 'college' ? 'Year & Section' : 'Grade & Section', gradeSection],
          ['Program', enrollment?.program_type === 'college' ? enrollment?.course : enrollment?.strand],
          ['Gender', s?.gender ? s.gender.charAt(0).toUpperCase() + s.gender.slice(1) : '—'],
          ['Status', s?.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : '—'],
          ['Email', s?.email],
        ].map(([label, value]) => (
          <View key={label} style={[styles.infoRow, { borderColor: theme.border }]}>
            <Text style={[styles.infoLabel, { color: theme.textSub }]}>{label}</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{value ?? '—'}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Notifications</Text>
        {notificationPrefs.map(pref => (
          <View key={pref.category} style={[styles.prefRow, { borderColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.prefTitle, { color: theme.text }]}>{pref.category.replace('_', ' ').toUpperCase()}</Text>
              <Text style={[styles.prefMeta, { color: theme.textSub }]}>In-app alerts</Text>
            </View>
            <Switch
              value={!!pref.in_app}
              onValueChange={() => togglePreference(pref.category, 'in_app')}
              trackColor={{ false: theme.border, true: theme.primaryLight }}
              thumbColor={pref.in_app ? theme.primary : '#f4f3f4'}
            />
          </View>
        ))}
      </View>

      {/* ── Badges ── */}
      <View style={[styles.card, { backgroundColor: theme.card }]}> 
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Achievements</Text>
        <View style={styles.badgeGrid}>
          {badges.map((b, i) => (
            <View key={i} style={[styles.badgeItem, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Text style={styles.badgeIcon}>{b.icon}</Text>
              <Text style={[styles.badgeName, { color: theme.textSub }]}>{b.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Logout ── */}
      <ChangePasswordCard theme={theme} />

      <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: theme.dangerLight, borderColor: theme.danger }]} onPress={handleLogout}>
        <Text style={[styles.logoutText, { color: theme.danger }]}>Logout</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

function CompactStat({ value, label, theme }) {
  return <View style={styles.compactStat}><Text style={[styles.compactStatValue, { color: theme.text }]}>{value}</Text><Text style={[styles.compactStatLabel, { color: theme.textSub }]}>{label}</Text></View>;
}

function CompactInfo({ label, value, theme, last }) {
  return <View style={[styles.compactInfoRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}><Text style={[styles.compactInfoLabel, { color: theme.textSub }]}>{label}</Text><Text style={[styles.compactInfoValue, { color: theme.text }]} numberOfLines={1}>{value || '—'}</Text></View>;
}

const styles = StyleSheet.create({
  compactContainer: { flex: 1 }, compactContent: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 16, paddingTop: HEADER_TOP, paddingBottom: 28 }, compactTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 }, compactBack: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 10 }, compactTopLabel: { fontSize: 16, fontWeight: '800' }, compactIdentity: { alignItems: 'center', marginBottom: 14 }, compactAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, compactAvatarImage: { width: '100%', height: '100%', borderRadius: 36 }, compactInitials: { color: '#fff', fontSize: 28, fontWeight: '900' }, compactName: { fontSize: 16, fontWeight: '900' }, compactId: { fontSize: 11, marginTop: 3 }, compactStats: { height: 68, borderRadius: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 14 }, compactStat: { flex: 1, alignItems: 'center' }, compactStatValue: { fontSize: 17, fontWeight: '900' }, compactStatLabel: { fontSize: 10, marginTop: 3 }, compactSection: { fontSize: 13, fontWeight: '800', marginTop: 10, marginBottom: 5 }, compactDropdownHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 5 }, compactThemeCard: { height: 50, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, compactThemeDot: { width: 24, height: 24, borderRadius: 12 }, compactThemeSelected: { width: 29, height: 29, borderRadius: 15, borderWidth: 2, borderColor: '#fff' }, compactInfo: { borderRadius: 12, overflow: 'hidden', width: '100%' }, compactInfoRow: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, compactInfoLabel: { fontSize: 11 }, compactInfoValue: { fontSize: 11, fontWeight: '700', maxWidth: '62%' }, compactPref: { minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, compactPrefText: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }, compactAction: { minHeight: 52, borderRadius: 12, marginTop: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, compactActionLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 }, compactLogout: { minHeight: 48, borderRadius: 12, borderWidth: 1, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, compactLogoutText: { fontSize: 13, fontWeight: '800' }, 
  container:      { flex: 1, backgroundColor: Colors.bg },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  hero:           {
    backgroundColor: Colors.purple,
    paddingTop: HEADER_TOP,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  avatar:         {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarImage:    { width: '100%', height: '100%', borderRadius: 40 },
  avatarEditBadge:{
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  avatarEditText: { color: Colors.purple, fontSize: 20, fontWeight: '900', lineHeight: 22 },
  initials:       { color: '#fff', fontSize: Font.xxl, fontWeight: '700' },
  name:           { color: '#fff', fontSize: Font.lg, fontWeight: '700' },
  studentId:      { color: 'rgba(255,255,255,0.7)', fontSize: Font.xs, marginTop: 4, marginBottom: 20 },

  heroStats:      {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    width: '100%',
  },
  heroStat:       { flex: 1, alignItems: 'center', paddingVertical: 14 },
  heroStatMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  heroVal:        { color: '#fff', fontSize: Font.xl, fontWeight: '700' },
  heroLabel:      { color: 'rgba(255,255,255,0.7)', fontSize: Font.xs, marginTop: 2 },

  card:           {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    ...Shadow.card,
  },
  sectionTitle:   { fontSize: Font.sm, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  infoRow:        {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  infoLabel:      { fontSize: Font.sm, color: Colors.textSub },
  infoValue:      { fontSize: Font.sm, color: Colors.text, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },
  prefRow:        {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  prefTitle:      { fontSize: Font.sm, fontWeight: '800' },
  prefMeta:       { fontSize: Font.xs, marginTop: 3 },

  badgeGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeItem:      {
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    padding: 14,
    alignItems: 'center',
    width: '47%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeIcon:      { fontSize: 28, marginBottom: 6 },
  badgeName:      { fontSize: Font.xs, color: Colors.textSub, textAlign: 'center', fontWeight: '500' },

  paletteRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paletteOption:  {
    flex: 1,
    minWidth: 80,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  paletteDot:     {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 8,
  },
  paletteLabel:   { fontSize: Font.xs, fontWeight: '700' },

  logoutBtn:      {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F5CCCC',
  },
  logoutText:     { color: Colors.danger, fontWeight: '700', fontSize: Font.sm },
});
