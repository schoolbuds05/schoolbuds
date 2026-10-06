// @ts-nocheck
import { Tabs } from 'expo-router';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme-context';

function Icon({ label, focused, color }) {
  return <View style={{ alignItems: 'center', paddingTop: 2 }}><Text style={{ color, fontSize: 12, fontWeight: '900', opacity: focused ? 1 : 0.45 }}>{label}</Text></View>;
}

export default function LeadershipLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const paddingBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 0);
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.primary, tabBarInactiveTintColor: theme.textSub, tabBarStyle: { height: 54 + paddingBottom, paddingBottom, paddingTop: 6, backgroundColor: theme.navBg, borderTopColor: theme.border }, tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 } }}>
    <Tabs.Screen name="dashboard" options={{ title: 'Overview', tabBarIcon: ({ focused, color }) => <Icon label="OV" focused={focused} color={color} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ focused, color }) => <Icon label="ME" focused={focused} color={color} /> }} />
  </Tabs>;
}
