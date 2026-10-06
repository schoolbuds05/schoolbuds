import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity
} from 'react-native';
import api from '../api';

const QUARTERS = ['1','2','3','4'];
const COLORS = ['#1D9E75','#378ADD','#D85A30','#7F77DD'];

export default function GradesScreen() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [activeQ, setActiveQ]   = useState('4');

  useEffect(() => {
    api.get('/dashboard/student').then(res => {
      setData(res.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#1D9E75"/></View>
  );

  const grades = data?.grades?.[activeQ] ?? [];
  const allGrades = data?.grades ? Object.values(data.grades).flat() : [];
  const gwa = allGrades.length > 0
    ? (allGrades.reduce((s, g) => s + parseFloat(g.score), 0) / allGrades.length).toFixed(1)
    : '—';

  const getRemark = (score) => {
    if (score >= 90) return { text:'Outstanding', color:'#1D9E75' };
    if (score >= 85) return { text:'Very satisfactory', color:'#378ADD' };
    if (score >= 80) return { text:'Satisfactory', color:'#888' };
    if (score >= 75) return { text:'Fairly satisfactory', color:'#BA7517' };
    return { text:'Did not meet expectations', color:'#E24B4A' };
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My grades</Text>
        <Text style={styles.sub}>S.Y. {data?.student?.school_year}</Text>
        <View style={styles.gwaRow}>
          <Text style={styles.gwaNum}>{gwa}</Text>
          <Text style={styles.gwaLabel}>GWA</Text>
        </View>
      </View>

      {/* Quarter tabs */}
      <View style={styles.tabs}>
        {QUARTERS.map(q => (
          <TouchableOpacity key={q} style={[styles.tab, activeQ === q && styles.tabActive]}
            onPress={() => setActiveQ(q)}>
            <Text style={[styles.tabText, activeQ === q && styles.tabTextActive]}>Q{q}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Subject grades */}
      <View style={styles.card}>
        {grades.length === 0
          ? <Text style={styles.empty}>No grades for this quarter.</Text>
          : grades.map((g, i) => {
            const rem = getRemark(parseFloat(g.score));
            const pct = Math.max(0, Math.min(100, ((parseFloat(g.score) - 70) / 30) * 100));
            return (
              <View key={i} style={styles.subjectRow}>
                <View style={[styles.dot, { backgroundColor: COLORS[i % COLORS.length] }]}/>
                <View style={{ flex:1 }}>
                  <Text style={styles.subjectName}>{g.school_class?.subject ?? '—'}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width:`${pct}%`, backgroundColor: COLORS[i % COLORS.length] }]}/>
                  </View>
                </View>
                <View style={styles.scoreRight}>
                  <Text style={[styles.score, { color: rem.color }]}>{g.score}</Text>
                  <Text style={[styles.remark, { color: rem.color }]}>{rem.text}</Text>
                </View>
              </View>
            );
          })
        }
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flex:1, backgroundColor:'#f5f5f5' },
  center:        { flex:1, justifyContent:'center', alignItems:'center' },
  header:        { backgroundColor:'#1D9E75', padding:24, paddingTop:56, paddingBottom:24 },
  title:         { color:'#fff', fontSize:22, fontWeight:'600' },
  sub:           { color:'rgba(255,255,255,0.75)', fontSize:12, marginTop:2 },
  gwaRow:        { flexDirection:'row', alignItems:'flex-end', gap:8, marginTop:12 },
  gwaNum:        { color:'#fff', fontSize:40, fontWeight:'600', lineHeight:44 },
  gwaLabel:      { color:'rgba(255,255,255,0.75)', fontSize:13, marginBottom:6 },
  tabs:          { flexDirection:'row', padding:16, gap:8 },
  tab:           { flex:1, paddingVertical:8, borderRadius:10, backgroundColor:'#fff',
                   alignItems:'center', borderWidth:0.5, borderColor:'#eee' },
  tabActive:     { backgroundColor:'#1D9E75', borderColor:'#1D9E75' },
  tabText:       { fontSize:13, color:'#888', fontWeight:'500' },
  tabTextActive: { color:'#fff' },
  card:          { backgroundColor:'#fff', borderRadius:14, marginHorizontal:16,
                   padding:16, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  subjectRow:    { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:10,
                   borderBottomWidth:0.5, borderColor:'#f0f0f0' },
  dot:           { width:8, height:8, borderRadius:4, flexShrink:0 },
  subjectName:   { fontSize:13, fontWeight:'500', color:'#333', marginBottom:5 },
  barTrack:      { height:4, backgroundColor:'#f0f0f0', borderRadius:4, overflow:'hidden' },
  barFill:       { height:'100%', borderRadius:4 },
  scoreRight:    { alignItems:'flex-end', minWidth:60 },
  score:         { fontSize:18, fontWeight:'600' },
  remark:        { fontSize:10, marginTop:1 },
  empty:         { textAlign:'center', color:'#999', fontSize:13, paddingVertical:16 },
});