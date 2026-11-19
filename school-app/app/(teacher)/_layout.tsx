// @ts-nocheck
import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/api';
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
        fontSize: 9,
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

export default function TeacherLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const pathname = usePathname();
  const [unreadChats, setUnreadChats] = useState(0);
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 6);

  useEffect(() => {
    let active = true;
    const refreshUnread = async () => {
      try {
        const res = await api.get('/teacher-chat/contacts');
        const count = (res.data ?? []).reduce((total, contact) => total + Number(contact.unread || 0), 0);
        if (active) setUnreadChats(count);
      } catch (e) {
        console.log('Teacher chat badge error:', e.message);
      }
    };
    refreshUnread();
    const timer = setInterval(refreshUnread, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [pathname]);

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
          title: 'Dashboard',
          tabBarLabel: ({ color }) => <TabLabel label="Dashboard" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="classes"
        options={{
          title: 'Classes',
          tabBarLabel: ({ color }) => <TabLabel label="Classes" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'school' : 'school-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="assignments"
        options={{
          title: 'Work',
          tabBarLabel: ({ color }) => <TabLabel label="Work" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'briefcase' : 'briefcase-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarBadge: unreadChats > 0 ? (unreadChats > 99 ? '99+' : unreadChats) : undefined,
          tabBarBadgeStyle: { backgroundColor: '#B5233D', color: '#fff', fontSize: 9, fontWeight: '800' },
          tabBarLabel: ({ color }) => <TabLabel label="Chat" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'chatbubble' : 'chatbubble-outline'} focused={focused} color={color} />
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
      <Tabs.Screen name="attendance" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="market" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="grades" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen
        name="profile"
        options={{ tabBarItemStyle: { display: 'none' } }}
      />
      <Tabs.Screen name="teaching-eligibility" options={{ tabBarItemStyle: { display: 'none' } }} />
    </Tabs>
  );
}
