// @ts-nocheck
// app/enrollment-status.tsx

import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
  Platform, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../src/api';
import HeaderGradient from './components/ui/HeaderGradient';

const C = {
  primary:     '#378ADD',
  success:     '#1D9E75',
  danger:      '#E24B4A',
  warning:     '#F59E0B',
  bg:          '#F8FAFC',
  card:        '#FFFFFF',
  border:      '#E2E8F0',
  text:        '#1E2937',
  subtext:     '#64748B',
  muted:       '#94A3B8',
};

const HEADER_TOP = Platform.OS === 'android'
  ? (StatusBar.currentHeight ?? 24) + 10 : 52;

const STATUS_CONFIG = {
  pending: {
    label: 'Pending Review',
    icon: '⏳',
    bg: '#FEF3C7',
    color: '#D97706',
    message: 'Your application is being reviewed by the registrar. Please check back soon.',
  },
  approved: {
    label: 'Approved',
    icon: '✅',
    bg: '#DCFCE7',
    color: '#15803D',
    message: 'Congratulations! Your enrollment has been approved. You may now log in.',
  },
  rejected: {
    label: 'Rejected',
    icon: '❌',
    bg: '#FEE2E2',
    color: '#B91C1C',
    message: 'Unfortunately, your application was not approved. See remarks below.',
  },
};

export default function EnrollmentStatusScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [app, setApp] = useState(null);

  const handleCheck = async () => {
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }

    setLoading(true);
    setApp(null);

    try {
      const res = await api.get('/enrollment/status', { params: { email: email.trim() } });
      setApp(res.data);
    } catch (e) {
      if (e.response?.status === 404) {
        Alert.alert('Not Found', 'No application found for this email.');
      } else {
        Alert.alert('Error', 'Could not fetch status. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const statusCfg = app ? (STATUS_CONFIG[app.status] ?? STATUS_CONFIG.pending) : null;

  const InfoRow = ({ label, value }) => value ? (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={2} ellipsizeMode="tail">
        {value}
      </Text>
    </View>
  ) : null;

  return (
    <View style={s.container}>
      <HeaderGradient
        title="Application Status"
        subtitle="Enter your email to view your enrollment progress"
        initials="ST"
        stats={[
          { label: 'Pending', value: statusCfg?.label ?? 'Start', accent: '#FCD34D' },
          { label: 'Name', value: app ? `${app.first_name} ${app.last_name}` : 'Unknown', accent: '#A5B4FC' },
          { label: 'Email', value: email || 'Enter email', accent: '#FBCFE8' },
        ]}
      />

      <ScrollView 
        contentContainerStyle={s.body} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Search Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Your Email Address</Text>
          <TextInput
            style={s.input}
            placeholder="example@email.com"
            placeholderTextColor={C.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[s.checkBtn, loading && s.btnDisabled]}
            onPress={handleCheck}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.checkBtnText}>Check Status</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Result Section */}
        {app && statusCfg && (
          <>
            {/* Status Banner */}
            <View style={[s.statusBanner, { backgroundColor: statusCfg.bg, borderColor: statusCfg.color }]}>
              <Text style={s.statusIcon}>{statusCfg.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.statusLabel, { color: statusCfg.color }]}>
                  {statusCfg.label}
                </Text>
                <Text style={[s.statusMessage, { color: statusCfg.color }]}>
                  {statusCfg.message}
                </Text>
              </View>
            </View>

            {/* Application Details */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Application Details</Text>

              <InfoRow label="Full Name" value={`${app.first_name} ${app.middle_name || ''} ${app.last_name}`} />
              <InfoRow label="Email" value={app.email} />
              <InfoRow label="Program" value={app.program_type === 'shs' ? 'Senior High School' : 'College'} />
              
              {app.program_type === 'shs' && (
                <>
                  <InfoRow label="Grade Level" value={`Grade ${app.grade_level}`} />
                  <InfoRow label="Strand" value={app.strand} />
                </>
              )}

              {app.program_type === 'college' && (
                <>
                  <InfoRow label="Course" value={app.course} />
                  <InfoRow label="Year Level" value={`Year ${app.year_level}`} />
                </>
              )}

              <InfoRow label="School Year" value={app.school_year} />
              <InfoRow label="Semester" value={`${app.semester} Semester`} />
              <InfoRow label="Applied On" value={new Date(app.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} />
              
              {app.reviewed_at && (
                <InfoRow label="Reviewed On" value={new Date(app.reviewed_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} />
              )}
            </View>

            {/* Remarks */}
            {app.remarks && (
              <View style={[s.remarksCard, { borderColor: statusCfg.color }]}>
                <Text style={[s.remarksTitle, { color: statusCfg.color }]}>
                  {"📝 Registrar's Remarks"}
                </Text>
                <Text style={s.remarksText}>{app.remarks}</Text>
              </View>
            )}

            {/* Action Buttons */}
            {app.status === 'approved' && (
              <TouchableOpacity style={s.loginBtn} onPress={() => router.replace('/login')}>
                <Text style={s.loginBtnText}>🎓 Proceed to Login</Text>
              </TouchableOpacity>
            )}

            {app.status === 'rejected' && (
              <TouchableOpacity style={s.reapplyBtn} onPress={() => router.push('/enrollment')}>
                <Text style={s.reapplyBtnText}>↩ Submit New Application</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    backgroundColor: C.primary,
    paddingTop: HEADER_TOP,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  backBtn: { marginBottom: 6 },
  backBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },

  body: { padding: 16 },

  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginBottom: 14,
  },

  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: C.text,
    backgroundColor: '#F8FAFC',
    marginBottom: 14,
  },
  checkBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  checkBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Status Banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 18,
    marginBottom: 16,
  },
  statusIcon: { fontSize: 32, marginTop: 2 },
  statusLabel: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  statusMessage: { fontSize: 14, lineHeight: 20 },

  // Info Rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  infoLabel: { fontSize: 14, color: C.subtext, flex: 1 },
  infoValue: { 
    fontSize: 14, 
    color: C.text, 
    fontWeight: '600', 
    textAlign: 'right', 
    flex: 1.4,
  },

  // Remarks
  remarksCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 18,
    marginBottom: 16,
  },
  remarksTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  remarksText: { fontSize: 14, lineHeight: 22, color: C.text },

  // Buttons
  loginBtn: {
    backgroundColor: C.success,
    borderRadius: 14,
    padding: 17,
    alignItems: 'center',
    marginTop: 8,
  },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  reapplyBtn: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 17,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    marginTop: 8,
  },
  reapplyBtnText: { color: C.subtext, fontWeight: '600', fontSize: 15 },
});
