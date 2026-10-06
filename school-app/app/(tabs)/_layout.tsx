// @ts-nocheck
// app/(tabs)/_layout.tsx - Student tabs

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
        width: 56,
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

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 6);
  const tabHeight = 64 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSub,
        tabBarStyle: {
          height: tabHeight,
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
        name="today"
        options={{
          title: 'Home',
          tabBarLabel: ({ color }) => <TabLabel label="Home" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="subjects"
        options={{
          title: 'Subjects',
          tabBarLabel: ({ color }) => <TabLabel label="Subjects" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'book' : 'book-outline'} focused={focused} color={color} />
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
        name="study"
        options={{
          title: 'Study AI',
          tabBarLabel: ({ color }) => <TabLabel label="Study AI" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'sparkles' : 'sparkles-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarLabel: ({ color }) => <TabLabel label="More" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'grid' : 'grid-outline'} focused={focused} color={color} />
          ),
        }}
      />

      <Tabs.Screen name="study-load" options={{ href: null }} />
      <Tabs.Screen name="assignments" options={{ href: null }} />
      <Tabs.Screen name="grades" options={{ href: null }} />
      <Tabs.Screen name="rewards" options={{ href: null }} />
      <Tabs.Screen name="market" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
