// @ts-nocheck
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setToken } from '../src/api';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const [ready, setReady]     = useState(false);
  const [route, setRoute]     = useState(null);

  useEffect(() => {
    AsyncStorage.multiGet(['token', 'role', 'position']).then(pairs => {
      const token = pairs[0][1];
      const role  = pairs[1][1];
      const position = pairs[2][1];
      if (token) {
        setToken(token);
        if (role === 'admin') {
          setRoute('/(admin)/dashboard');
        } else if (['head_department', 'dean'].includes(position) || ['head_department', 'dean'].includes(role)) {
          setRoute('/(leadership)/dashboard');
        } else if (['faculty', 'teacher'].includes(role)) {
          setRoute('/(teacher)/classes');
        } else if (role === 'registrar') {
          setRoute('/(registrar)/dashboard');
        } else if (role === 'parent') {
          setRoute('/(parent)/dashboard');
        } else if (['staff', 'librarian', 'property_custodian'].includes(role)) {
          setRoute('/(staff)/dashboard');
        } else {
          setRoute('/(tabs)/today');
        }
      } else {
        setRoute('/login');
      }
      setReady(true);
    });
  }, []);

  if (!ready) return (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
      <ActivityIndicator size="large" color="#378ADD"/>
    </View>
  );

  return <Redirect href={route}/>;
}
