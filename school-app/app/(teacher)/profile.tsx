// @ts-nocheck
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import api, { removeToken } from '../../src/api';
import { formatRoleAndPosition, formatRoleLabel, formatPositionLabel } from '../../src/user-labels';
import { useTheme } from '../../src/theme-context';
import ChangePasswordCard from '../components/ChangePasswordCard';

export default function TeacherProfile() {
  const router = useRouter();
  const { theme } = useTheme();
  const [user, setUser]     = useState(null);
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('user').then(u => {
      if (u) setUser(JSON.parse(u));
    });
    api.get('/teacher/dashboard')
      .then(res => setData(res.data))
      .catch(e => console.log('Teacher profile error:', e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text:'Cancel', style:'cancel' },
      { text:'Logout', style:'destructive', onPress: async () => {
        await api.post('/logout').catch(() => {});
        await AsyncStorage.multiRemove(['token', 'role', 'position', 'user']);
        removeToken();
        router.replace('/login');
      }}
    ]);
  };

  if (loading) return (
    <View style={[styles.center, { backgroundColor: theme.bg }]}>
      <ActivityIndicator size="large" color={theme.primary}/>
    </View>
  );

  const name     = user?.name ?? 'Teacher';
  const initials = name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
  const accountLabel = formatRoleAndPosition(user, 'Teacher');

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.pageHeading}><TouchableOpacity style={styles.backButton} onPress={() => router.back()}><Ionicons name="chevron-back" size={21} color="#745D63" /></TouchableOpacity><Text style={[styles.pageTitle, { color: theme.text }]}>Profile</Text></View>
      <View style={[styles.hero, { backgroundColor: theme.primary }]}> 
        <View style={styles.avatar}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>👩‍🏫 {accountLabel}</Text>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroVal}>{data?.total_classes ?? 0}</Text>
            <Text style={styles.heroLabel}>Classes</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroVal}>{data?.total_students ?? 0}</Text>
            <Text style={styles.heroLabel}>Students</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroVal}>{data?.today_attendance ?? 0}</Text>
            <Text style={styles.heroLabel}>Present today</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Account information</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        {[
          ['Name',         name],
          ['Email',        user?.email ?? '—'],
          ['Role',         formatRoleLabel(user?.role) || 'Teacher'],
          ['Position',     formatPositionLabel(user?.position) || '—'],
          ['School year',  '2025–2026'],
        ].map(([label, value]) => (
          <View key={label} style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.classHeading}><Text style={[styles.sectionTitle, { color: theme.text }]}>My classes</Text><Text style={[styles.classTotal, { color: theme.textSub }]}>{data?.total_classes ?? 0}</Text></View>
      <View style={[styles.card, styles.classCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {data?.classes?.length > 0
          ? data.classes.slice(0, 5).map((c, i) => (
            <View key={i} style={styles.classRow}>
              <View style={[styles.classColor,
                { backgroundColor: ['#1D9E75','#378ADD','#D85A30','#7F77DD'][i%4] }]}/>
              <View style={{ flex:1 }}>
                <Text style={styles.className}>{c.subject}</Text>
                <Text style={styles.classMeta}>
                  Grade {c.grade_level} – {c.section} · {c.room}
                </Text>
              </View>
            </View>
          ))
          : <Text style={styles.empty}>No classes assigned yet.</Text>
        }
        {data?.classes?.length > 5 ? <TouchableOpacity style={styles.viewClasses} onPress={() => router.push('/(teacher)/classes')}><Text style={[styles.viewClassesText, { color: theme.primary }]}>View all {data.total_classes} classes</Text></TouchableOpacity> : null}
      </View>

      <ChangePasswordCard theme={theme} compact />

      <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: theme.dangerLight }]} onPress={handleLogout}>
        <Text style={[styles.logoutText, { color: theme.danger }]}>Logout</Text>
      </TouchableOpacity>
      <View style={{ height:32 }}/>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flex:1, backgroundColor:'#F9E9EC' },
  content:    { padding:14, paddingTop:32, paddingBottom:28 },
  center:     { flex:1, justifyContent:'center', alignItems:'center' },
  pageHeading:{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 },
  backButton: { width:32, height:32, borderRadius:16, backgroundColor:'#fff', alignItems:'center', justifyContent:'center' },
  pageTitle:  { fontSize:18, fontWeight:'900' },
  hero:       { backgroundColor:'#B5233D', padding:14, paddingTop:14, alignItems:'center', borderRadius:15 },
  avatar:     { width:54, height:54, borderRadius:27, backgroundColor:'rgba(255,255,255,0.25)', justifyContent:'center', alignItems:'center', marginBottom:7 },
  initials:   { color:'#fff', fontSize:21, fontWeight:'800' },
  name:       { color:'#fff', fontSize:16, fontWeight:'900' },
  email:      { color:'rgba(255,255,255,0.85)', fontSize:10, marginTop:3 },
  roleBadge:  { backgroundColor:'rgba(255,255,255,0.2)', borderRadius:20,
                paddingHorizontal:10, paddingVertical:4, marginTop:8, marginBottom:11 },
  roleText:   { color:'#fff', fontSize:9, fontWeight:'800' },
  heroStats:  { flexDirection:'row', gap:7, width:'100%' },
  heroStat:   { alignItems:'center', backgroundColor:'rgba(255,255,255,0.15)',
                borderRadius:9, paddingVertical:8, flex:1 },
  heroVal:    { color:'#fff', fontSize:15, fontWeight:'900' },
  heroLabel:  { color:'rgba(255,255,255,0.82)', fontSize:8, fontWeight:'700', marginTop:2 },
  sectionTitle:{ fontSize:13, fontWeight:'900', marginTop:15, marginBottom:7 },
  classHeading:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  classTotal: { fontSize:10, fontWeight:'700', marginTop:15, marginBottom:7 },
  card:       { backgroundColor:'#fff', borderRadius:12, borderWidth:1, overflow:'hidden' },
  classCard:  { },
  infoRow:    { flexDirection:'row', justifyContent:'space-between',
                paddingHorizontal:11, paddingVertical:10, borderBottomWidth:0.5, borderColor:'#E7DADD' },
  infoLabel:  { fontSize:10, color:'#806E73' },
  infoValue:  { fontSize:10, color:'#2A1B1F', fontWeight:'800' },
  classRow:   { flexDirection:'row', alignItems:'center', gap:10,
                paddingHorizontal:11, paddingVertical:8, borderBottomWidth:0.5, borderColor:'#E7DADD' },
  classColor: { width:3, height:24, borderRadius:2 },
  className:  { fontSize:10, fontWeight:'800', color:'#2A1B1F' },
  classMeta:  { fontSize:8, color:'#806E73', marginTop:2 },
  viewClasses:{ alignItems:'center', paddingVertical:10 },
  viewClassesText:{ fontSize:10, fontWeight:'900' },
  empty:      { fontSize:13, color:'#999', textAlign:'center', paddingVertical:12 },
  logoutBtn:  { marginTop:12, borderRadius:10, borderWidth:1, padding:10, alignItems:'center' },
  logoutText: { color:'#E24B4A', fontWeight:'800', fontSize:11 },
});
