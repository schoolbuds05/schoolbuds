// @ts-nocheck
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
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

export default function StaffLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [isCustodian, setIsCustodian] = useState(false);
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 6);

  useEffect(() => {
    AsyncStorage.getItem('user').then(value => {
      if (value) setIsCustodian(JSON.parse(value)?.position === 'property_custodian');
    }).catch(() => {});
  }, []);

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
          title: isCustodian ? 'Dashboard' : 'Updates',
          tabBarLabel: ({ color }) => <TabLabel label={isCustodian ? 'Dashboard' : 'Updates'} color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? (isCustodian ? 'home' : 'notifications') : (isCustodian ? 'home-outline' : 'notifications-outline')} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="assets"
        options={{
          title: 'Assets',
          tabBarLabel: ({ color }) => <TabLabel label="Assets" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'cube' : 'cube-outline'} focused={focused} color={color} />
          ),
          tabBarItemStyle: isCustodian ? undefined : { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'Marketplace',
          tabBarLabel: ({ color }) => <TabLabel label="Marketplace" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'storefront' : 'storefront-outline'} focused={focused} color={color} />
          ),
          tabBarItemStyle: isCustodian ? undefined : { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: ({ color }) => <TabLabel label="Profile" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
