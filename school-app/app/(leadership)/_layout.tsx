// @ts-nocheck
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme-context';

function TabIcon({ name, focused, color }) {
  return (
    <View
      style={{
        width: 36,
        height: 30,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? `${color}18` : 'transparent',
      }}
    >
      <Ionicons name={name} size={21} color={color} />
    </View>
  );
}

function TabLabel({ label, color }) {
  return (
    <Text
      style={{
        width: '100%',
        color,
        fontSize: 10,
        fontWeight: '700',
        includeFontPadding: false,
        lineHeight: 13,
        textAlign: 'center',
      }}
      allowFontScaling={false}
      numberOfLines={1}
    >
      {label}
    </Text>
  );
}

export default function LeadershipLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 6);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSub,
        tabBarStyle: {
          height: 64 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
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
          fontWeight: '700',
          marginTop: 3,
          includeFontPadding: false,
          textAlign: 'center',
        },
        tabBarItemStyle: {
          flex: 1,
          height: 54,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 4,
        },
        tabBarIconStyle: {
          width: 36,
          height: 30,
          marginBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Overview',
          tabBarLabel: ({ color }) => <TabLabel label="Overview" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="classes"
        options={{
          title: 'My Classes',
          tabBarLabel: ({ color }) => <TabLabel label="My Classes" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'school' : 'school-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarLabel: ({ color }) => <TabLabel label="Chat" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'chatbubble' : 'chatbubble-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarLabel: ({ color }) => <TabLabel label="Attendance" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="work" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="sections" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="profile" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="grades" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="teaching-eligibility" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarLabel: ({ color }) => <TabLabel label="More" color={color} />,
          tabBarIcon: ({ focused, color }) => <TabIcon name={focused ? 'grid' : 'grid-outline'} focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}
