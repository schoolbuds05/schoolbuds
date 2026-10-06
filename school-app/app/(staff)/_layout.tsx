// @ts-nocheck
import { Tabs } from 'expo-router';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme-context';

function Icon({ label, focused, color }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 2 }}>
      <Text style={{ fontSize: 12, fontWeight: '900', opacity: focused ? 1 : 0.45, color }}>{label}</Text>
    </View>
  );
}

export default function StaffLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 0);

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: theme.primary,
      tabBarInactiveTintColor: theme.textSub,
      tabBarStyle: {
        height: 54 + bottomPadding,
        paddingBottom: bottomPadding,
        paddingTop: 6,
        backgroundColor: theme.navBg,
        borderTopColor: theme.border,
        borderTopWidth: 1,
      },
      tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
    }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Updates', tabBarIcon: ({ focused, color }) => <Icon label="UP" focused={focused} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ focused, color }) => <Icon label="ME" focused={focused} color={color} /> }} />
    </Tabs>
  );
}
