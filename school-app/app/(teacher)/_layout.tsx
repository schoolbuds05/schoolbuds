// @ts-nocheck
import { Tabs } from 'expo-router';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme-context';

function Icon({ label, focused, color }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 2 }}>
      <Text style={{ fontSize: 12, fontWeight: '900', opacity: focused ? 1 : 0.45, color }}>{label}</Text>
    </View>
  );
}

export default function TeacherLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 0);
  const tabHeight = 54 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSub,
        tabBarStyle: {
          height: tabHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          backgroundColor: theme.navBg,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          elevation: 12,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: ({ focused, color }) => <Icon label="DB" focused={focused} color={color} /> }} />
      <Tabs.Screen name="classes" options={{ title: 'Classes', tabBarIcon: ({ focused, color }) => <Icon label="CL" focused={focused} color={color} /> }} />
      <Tabs.Screen name="assignments" options={{ title: 'Work', tabBarIcon: ({ focused, color }) => <Icon label="WK" focused={focused} color={color} /> }} />
      <Tabs.Screen name="grades" options={{ title: 'Grades', tabBarIcon: ({ focused, color }) => <Icon label="GR" focused={focused} color={color} /> }} />
      <Tabs.Screen name="attendance" options={{ title: 'Attend', tabBarIcon: ({ focused, color }) => <Icon label="AT" focused={focused} color={color} /> }} />
      <Tabs.Screen name="market" options={{ title: 'Market', tabBarIcon: ({ focused, color }) => <Icon label="MK" focused={focused} color={color} /> }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarIcon: ({ focused, color }) => <Icon label="CH" focused={focused} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ focused, color }) => <Icon label="ME" focused={focused} color={color} /> }} />
    </Tabs>
  );
}
