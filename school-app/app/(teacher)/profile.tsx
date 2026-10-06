// @ts-nocheck
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import api, { removeToken } from '../../src/api';
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

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]}> 
      <View style={[styles.hero, { backgroundColor: theme.primary }]}> 
        <View style={styles.avatar}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>👩‍🏫 Teacher</Text>
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

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text style={[styles.cardTitle, { color: theme.text }]}>Account information</Text>
        {[
          ['Name',         name],
          ['Email',        user?.email ?? '—'],
          ['Role',         'Teacher'],
          ['School year',  '2025–2026'],
        ].map(([label, value]) => (
          <View key={label} style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text style={[styles.cardTitle, { color: theme.text }]}>My classes</Text>
        {data?.classes?.length > 0
          ? data.classes.map((c, i) => (
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
      </View>

      <ChangePasswordCard theme={theme} />

      <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: theme.dangerLight }]} onPress={handleLogout}>
        <Text style={[styles.logoutText, { color: theme.danger }]}>Logout</Text>
      </TouchableOpacity>
      <View style={{ height:32 }}/>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flex:1, backgroundColor:'#f5f5f5' },
  center:     { flex:1, justifyContent:'center', alignItems:'center' },
  hero:       { backgroundColor:'#1D9E75', padding:24, paddingTop:56, alignItems:'center' },
  avatar:     { width:72, height:72, borderRadius:36, backgroundColor:'rgba(255,255,255,0.25)',
                justifyContent:'center', alignItems:'center', marginBottom:12 },
  initials:   { color:'#fff', fontSize:26, fontWeight:'600' },
  name:       { color:'#fff', fontSize:20, fontWeight:'600' },
  email:      { color:'rgba(255,255,255,0.75)', fontSize:12, marginTop:4 },
  roleBadge:  { backgroundColor:'rgba(255,255,255,0.2)', borderRadius:20,
                paddingHorizontal:14, paddingVertical:5, marginTop:10, marginBottom:16 },
  roleText:   { color:'#fff', fontSize:13, fontWeight:'500' },
  heroStats:  { flexDirection:'row', gap:12 },
  heroStat:   { alignItems:'center', backgroundColor:'rgba(255,255,255,0.15)',
                borderRadius:12, paddingHorizontal:18, paddingVertical:10 },
  heroVal:    { color:'#fff', fontSize:20, fontWeight:'600' },
  heroLabel:  { color:'rgba(255,255,255,0.75)', fontSize:10, marginTop:2 },
  card:       { backgroundColor:'#fff', borderRadius:14, marginHorizontal:16,
                marginTop:14, padding:16 },
  cardTitle:  { fontSize:14, fontWeight:'600', color:'#333', marginBottom:12 },
  infoRow:    { flexDirection:'row', justifyContent:'space-between',
                paddingVertical:9, borderBottomWidth:0.5, borderColor:'#f0f0f0' },
  infoLabel:  { fontSize:13, color:'#888' },
  infoValue:  { fontSize:13, color:'#333', fontWeight:'500' },
  classRow:   { flexDirection:'row', alignItems:'center', gap:10,
                paddingVertical:9, borderBottomWidth:0.5, borderColor:'#f0f0f0' },
  classColor: { width:4, height:36, borderRadius:2 },
  className:  { fontSize:13, fontWeight:'500', color:'#333' },
  classMeta:  { fontSize:11, color:'#999', marginTop:1 },
  empty:      { fontSize:13, color:'#999', textAlign:'center', paddingVertical:12 },
  logoutBtn:  { margin:16, marginTop:14, backgroundColor:'#FCEBEB',
                borderRadius:12, padding:15, alignItems:'center' },
  logoutText: { color:'#E24B4A', fontWeight:'600', fontSize:14 },
});
