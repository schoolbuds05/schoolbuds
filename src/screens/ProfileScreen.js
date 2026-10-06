import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { removeToken } from '../api';

export default function ProfileScreen({ navigation }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/student').then(res => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text:'Cancel', style:'cancel' },
      {
        text:'Logout', style:'destructive',
        onPress: async () => {
          await api.post('/logout').catch(() => {});
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
          removeToken();
          navigation.replace('Login');
        }
      }
    ]);
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#7F77DD"/></View>
  );

  const s = data?.student;
  const initials = s ? `${s.first_name[0]}${s.last_name[0]}`.toUpperCase() : '??';
  const allGrades = data?.grades ? Object.values(data.grades).flat() : [];
  const gwa = allGrades.length > 0
    ? (allGrades.reduce((sum, g) => sum + parseFloat(g.score), 0) / allGrades.length).toFixed(1)
    : '—';

  return (
    <ScrollView style={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.avatar}><Text style={styles.initials}>{initials}</Text></View>
        <Text style={styles.name}>{s?.first_name} {s?.last_name}</Text>
        <Text style={styles.sub}>{s?.student_id} · Grade {s?.grade_level} – {s?.section}</Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroVal}>{gwa}</Text>
            <Text style={styles.heroLabel}>GWA</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroVal}>{data?.attendance_pct ?? 0}%</Text>
            <Text style={styles.heroLabel}>Attendance</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroVal}>{data?.pending_fees?.length ?? 0}</Text>
            <Text style={styles.heroLabel}>Pending fees</Text>
          </View>
        </View>
      </View>

      {/* Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Student information</Text>
        {[
          ['School year', s?.school_year],
          ['Section', `Grade ${s?.grade_level} – ${s?.section}`],
          ['Gender', s?.gender ? s.gender.charAt(0).toUpperCase() + s.gender.slice(1) : '—'],
          ['Status', s?.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : '—'],
          ['Email', s?.email],
        ].map(([label, value]) => (
          <View key={label} style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value ?? '—'}</Text>
          </View>
        ))}
      </View>

      {/* Badges */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Achievements</Text>
        <View style={styles.badgeGrid}>
          {parseFloat(gwa) >= 90 && (
            <View style={styles.badgeItem}>
              <Text style={styles.badgeIcon}>🏆</Text>
              <Text style={styles.badgeName}>Honor student</Text>
            </View>
          )}
          {(data?.attendance_pct ?? 0) >= 90 && (
            <View style={styles.badgeItem}>
              <Text style={styles.badgeIcon}>📅</Text>
              <Text style={styles.badgeName}>Perfect attendance</Text>
            </View>
          )}
          {allGrades.length > 0 && (
            <View style={styles.badgeItem}>
              <Text style={styles.badgeIcon}>📚</Text>
              <Text style={styles.badgeName}>Active learner</Text>
            </View>
          )}
          <View style={styles.badgeItem}>
            <Text style={styles.badgeIcon}>⭐</Text>
            <Text style={styles.badgeName}>Enrolled {s?.school_year}</Text>
          </View>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }}/>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex:1, backgroundColor:'#f5f5f5' },
  center:      { flex:1, justifyContent:'center', alignItems:'center' },
  hero:        { backgroundColor:'#7F77DD', padding:24, paddingTop:56, alignItems:'center' },
  avatar:      { width:72, height:72, borderRadius:36, backgroundColor:'rgba(255,255,255,0.25)',
                 justifyContent:'center', alignItems:'center', marginBottom:12 },
  initials:    { color:'#fff', fontSize:26, fontWeight:'600' },
  name:        { color:'#fff', fontSize:20, fontWeight:'600' },
  sub:         { color:'rgba(255,255,255,0.75)', fontSize:12, marginTop:4, marginBottom:16 },
  heroStats:   { flexDirection:'row', gap:16, marginTop:4 },
  heroStat:    { alignItems:'center', backgroundColor:'rgba(255,255,255,0.15)',
                 borderRadius:12, paddingHorizontal:18, paddingVertical:10 },
  heroVal:     { color:'#fff', fontSize:20, fontWeight:'600' },
  heroLabel:   { color:'rgba(255,255,255,0.75)', fontSize:10, marginTop:2 },
  card:        { backgroundColor:'#fff', borderRadius:14, marginHorizontal:16, marginTop:14,
                 padding:16, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  cardTitle:   { fontSize:14, fontWeight:'600', color:'#333', marginBottom:12 },
  infoRow:     { flexDirection:'row', justifyContent:'space-between', paddingVertical:9,
                 borderBottomWidth:0.5, borderColor:'#f0f0f0' },
  infoLabel:   { fontSize:13, color:'#888' },
  infoValue:   { fontSize:13, color:'#333', fontWeight:'500' },
  badgeGrid:   { flexDirection:'row', flexWrap:'wrap', gap:10 },
  badgeItem:   { backgroundColor:'#f8f8f8', borderRadius:12, padding:12,
                 alignItems:'center', width:'47%' },
  badgeIcon:   { fontSize:28, marginBottom:6 },
  badgeName:   { fontSize:12, color:'#555', textAlign:'center', fontWeight:'500' },
  logoutBtn:   { margin:16, marginTop:14, backgroundColor:'#FCEBEB', borderRadius:12,
                 padding:15, alignItems:'center' },
  logoutText:  { color:'#E24B4A', fontWeight:'600', fontSize:14 },
});