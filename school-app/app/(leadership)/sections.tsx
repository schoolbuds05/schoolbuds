import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import api from '../../src/api';
import { useTheme } from '../../src/theme-context';
import Sections from '../(registrar)/sections';

export default function LeadershipSections() {
  const { theme } = useTheme();
  const [access, setAccess] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    setAccess(null);
    api.get('/academic-leadership/dashboard').then(response => {
      if (active) { setAccess(!!response.data.can_manage_sections); setError(''); }
    }).catch(() => { if (active) { setAccess(false); setError('Could not verify department access. Please reopen this screen.'); } });
    return () => { active = false; };
  }, []));

  if (access) return <Sections />;
  return <View style={{ flex: 1, padding: 24, paddingTop: 60, backgroundColor: theme.bg }}>
    {access === null ? <ActivityIndicator color={theme.primary} /> : <Text style={{ color: theme.text }}>{error || 'Only chairs of active course departments can manage sections. Open Teaching approvals to manage subject eligibility.'}</Text>}
  </View>;
}
