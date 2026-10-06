import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl, TouchableOpacity
} from 'react-native';
import api from '../api';

export default function DashboardScreen({ navigation }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/student');
      setData(res.data);
    } catch (e) {
      console.log('Dashboard error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, []);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#378ADD"/>
    </View>
  );

  const student  = data?.student;
  const allGrades = data?.grades ? Object.values(data.grades).flat() : [];
  const gwa = allGrades.length > 0
    ? (allGrades.reduce((sum, g) => sum + parseFloat(g.score), 0) / allGrades.length).toFixed(1)
    : '—';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); fetchDashboard(); }}/>}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting},</Text>
        <Text style={styles.name}>{student?.first_name} {student?.last_name}</Text>
        <Text style={styles.section}>Grade {student?.grade_level} — {student?.section} · {student?.school_year}</Text>
      </View>

      {/* Stat cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{data?.attendance_pct ?? 0}%</Text>
          <Text style={styles.statLabel}>Attendance</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{gwa}</Text>
          <Text style={styles.statLabel}>GWA</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: (data?.pending_fees?.length ?? 0) > 0 ? '#E24B4A' : '#1D9E75' }]}>
            {data?.pending_fees?.length ?? 0}
          </Text>
          <Text style={styles.statLabel}>Pending fees</Text>
        </View>
      </View>

      {/* Pending fees warning */}
      {(data?.pending_fees?.length ?? 0) > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Outstanding fees</Text>
          {data.pending_fees.map((fee, i) => (
            <View key={i} style={styles.feeRow}>
              <View style={{ flex:1 }}>
                <Text style={styles.feeName}>{fee.type}</Text>
                <Text style={styles.feeSub}>Q{fee.quarter} · Due {fee.due_date}</Text>
              </View>
              <View style={[styles.badge, fee.status === 'unpaid' ? styles.badgeRed : styles.badgeYellow]}>
                <Text style={[styles.badgeText, fee.status === 'unpaid' ? styles.badgeRedText : styles.badgeYellowText]}>
                  ₱{Number(fee.amount).toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Latest grades */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Latest grades (Q4)</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Grades')}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>
        {data?.grades?.['4']?.map((g, i) => (
          <View key={i} style={styles.gradeRow}>
            <Text style={styles.subjectName}>{g.school_class?.subject ?? '—'}</Text>
            <Text style={[styles.gradeScore,
              { color: g.score >= 90 ? '#1D9E75' : g.score >= 80 ? '#378ADD' : g.score >= 75 ? '#BA7517' : '#E24B4A' }]}>
              {g.score}
            </Text>
          </View>
        )) ?? <Text style={styles.empty}>No grades yet.</Text>}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { flex:1, backgroundColor:'#f5f5f5' },
  center:          { flex:1, justifyContent:'center', alignItems:'center' },
  header:          { backgroundColor:'#378ADD', padding:24, paddingTop:56, paddingBottom:28 },
  greeting:        { color:'rgba(255,255,255,0.8)', fontSize:13 },
  name:            { color:'#fff', fontSize:24, fontWeight:'600', marginTop:2 },
  section:         { color:'rgba(255,255,255,0.7)', fontSize:12, marginTop:4 },
  statsRow:        { flexDirection:'row', padding:16, gap:10 },
  statCard:        { flex:1, backgroundColor:'#fff', borderRadius:14, padding:14, alignItems:'center',
                     shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  statVal:         { fontSize:22, fontWeight:'600', color:'#1a1a1a' },
  statLabel:       { fontSize:11, color:'#888', marginTop:3 },
  card:            { backgroundColor:'#fff', borderRadius:14, marginHorizontal:16, marginBottom:14,
                     padding:16, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  cardHeader:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  cardTitle:       { fontSize:14, fontWeight:'600', color:'#333' },
  seeAll:          { fontSize:12, color:'#378ADD' },
  feeRow:          { flexDirection:'row', alignItems:'center', paddingVertical:8,
                     borderBottomWidth:0.5, borderColor:'#f0f0f0' },
  feeName:         { fontSize:13, fontWeight:'500', color:'#333' },
  feeSub:          { fontSize:11, color:'#999', marginTop:1 },
  badge:           { borderRadius:20, paddingHorizontal:10, paddingVertical:4 },
  badgeRed:        { backgroundColor:'#FCEBEB' },
  badgeYellow:     { backgroundColor:'#FAEEDA' },
  badgeText:       { fontSize:12, fontWeight:'500' },
  badgeRedText:    { color:'#E24B4A' },
  badgeYellowText: { color:'#BA7517' },
  gradeRow:        { flexDirection:'row', justifyContent:'space-between',
                     paddingVertical:9, borderBottomWidth:0.5, borderColor:'#f0f0f0' },
  subjectName:     { fontSize:13, color:'#444' },
  gradeScore:      { fontSize:14, fontWeight:'600' },
  empty:           { fontSize:13, color:'#999', textAlign:'center', paddingVertical:12 },
});