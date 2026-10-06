import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setToken } from '../api';

export default function LoginScreen({ navigation }) {
  const [email, setEmail]       = useState('student@school.com');
  const [password, setPassword] = useState('password');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/login', { email, password });
      await AsyncStorage.setItem('token', res.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      navigation.replace('Main');
    } catch (e) {
      Alert.alert('Login failed', 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={styles.logo}>🏫</Text>
        <Text style={styles.title}>School System</Text>
        <Text style={styles.sub}>Sign in to your account</Text>

        <TextInput style={styles.input} placeholder="Email address"
          placeholderTextColor="#aaa" value={email} onChangeText={setEmail}
          autoCapitalize="none" keyboardType="email-address"/>

        <TextInput style={styles.input} placeholder="Password"
          placeholderTextColor="#aaa" value={password}
          onChangeText={setPassword} secureTextEntry/>

        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff"/>
            : <Text style={styles.btnText}>Sign in</Text>
          }
        </TouchableOpacity>

        <Text style={styles.hint}>Demo: student@school.com / password</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex:1, backgroundColor:'#fff' },
  inner:       { flex:1, justifyContent:'center', padding:28 },
  logo:        { fontSize:48, textAlign:'center', marginBottom:12 },
  title:       { fontSize:28, fontWeight:'600', color:'#1a1a1a', textAlign:'center' },
  sub:         { fontSize:14, color:'#888', textAlign:'center', marginBottom:36, marginTop:6 },
  input:       { borderWidth:0.5, borderColor:'#ddd', borderRadius:12, padding:14,
                 marginBottom:14, fontSize:14, color:'#1a1a1a', backgroundColor:'#fafafa' },
  btn:         { backgroundColor:'#378ADD', borderRadius:12, padding:16, alignItems:'center', marginTop:4 },
  btnDisabled: { opacity:0.6 },
  btnText:     { color:'#fff', fontWeight:'600', fontSize:15 },
  hint:        { textAlign:'center', color:'#bbb', fontSize:12, marginTop:20 },
});