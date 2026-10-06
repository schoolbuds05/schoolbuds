import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LEGACY_THEME_KEY = 'appTheme';

const themeKeyForUser = async () => {
  const userJson = await AsyncStorage.getItem('user');
  const role = await AsyncStorage.getItem('role');

  if (!userJson) {
    return `${LEGACY_THEME_KEY}:guest`;
  }

  try {
    const user = JSON.parse(userJson);
    const identity = user?.id || user?.email || role || 'guest';
    return `${LEGACY_THEME_KEY}:${role || user?.role || 'user'}:${identity}`;
  } catch {
    return `${LEGACY_THEME_KEY}:${role || 'user'}`;
  }
};

const THEMES = {
  blue: {
    name: 'blue',
    label: 'Blue',
    primary: '#378ADD',
    primaryLight: '#E6F1FB',
    green: '#1D9E75',
    greenLight: '#E1F5EE',
    purple: '#7F77DD',
    purpleLight: '#EEECFB',
    orange: '#D85A30',
    orangeLight: '#FAEEDA',
    danger: '#E24B4A',
    dangerLight: '#FCEBEB',
    warning: '#BA7517',
    warningLight: '#FAEEDA',
    success: '#1D9E75',
    successLight: '#E1F5EE',
    bg: '#F4F6F9',
    card: '#FFFFFF',
    border: '#EFEFEF',
    text: '#1A1A2E',
    textSub: '#6B7280',
    textMuted: '#B0B7C3',
    navBg: '#FFFFFF',
  },
  green: {
    name: 'green',
    label: 'Green',
    primary: '#1D9E75',
    primaryLight: '#E1F5EE',
    green: '#0F9D58',
    greenLight: '#DDEEE4',
    purple: '#7F77DD',
    purpleLight: '#EEECFB',
    orange: '#D85A30',
    orangeLight: '#FAEEDA',
    danger: '#E24B4A',
    dangerLight: '#FCEBEB',
    warning: '#BA7517',
    warningLight: '#FAEEDA',
    success: '#1D9E75',
    successLight: '#E1F5EE',
    bg: '#F3F8F4',
    card: '#FFFFFF',
    border: '#E6EFED',
    text: '#152B24',
    textSub: '#4B6361',
    textMuted: '#8A9F98',
    navBg: '#FFFFFF',
  },
  purple: {
    name: 'purple',
    label: 'Purple',
    primary: '#7F77DD',
    primaryLight: '#EEECFB',
    green: '#1D9E75',
    greenLight: '#E1F5EE',
    purple: '#6D5DD3',
    purpleLight: '#EFEAFB',
    orange: '#D85A30',
    orangeLight: '#FAEEDA',
    danger: '#E24B4A',
    dangerLight: '#FCEBEB',
    warning: '#BA7517',
    warningLight: '#FAEEDA',
    success: '#1D9E75',
    successLight: '#E1F5EE',
    bg: '#F5F3FE',
    card: '#FFFFFF',
    border: '#E8E3FB',
    text: '#1E1B3B',
    textSub: '#6B668B',
    textMuted: '#958FB2',
    navBg: '#FFFFFF',
  },
  orange: {
    name: 'orange',
    label: 'Orange',
    primary: '#D85A30',
    primaryLight: '#FAEEDA',
    green: '#1D9E75',
    greenLight: '#E1F5EE',
    purple: '#7F77DD',
    purpleLight: '#EEECFB',
    orange: '#CD4A1F',
    orangeLight: '#FFE8DC',
    danger: '#E24B4A',
    dangerLight: '#FCEBEB',
    warning: '#BA7517',
    warningLight: '#FAEEDA',
    success: '#1D9E75',
    successLight: '#E1F5EE',
    bg: '#FEF6EE',
    card: '#FFFFFF',
    border: '#F2D8C3',
    text: '#3C2E25',
    textSub: '#7B675D',
    textMuted: '#A08F86',
    navBg: '#FFFFFF',
  },
  red: {
    name: 'red',
    label: 'Red',
    primary: '#D95B5B',
    primaryLight: '#FDEAEA',
    green: '#2E9A67',
    greenLight: '#E7F6EE',
    purple: '#8B5D9A',
    purpleLight: '#F5EAF9',
    orange: '#E08A43',
    orangeLight: '#FFF1E5',
    danger: '#E05050',
    dangerLight: '#FDE8E8',
    warning: '#D88A2D',
    warningLight: '#FFF3E5',
    success: '#2E9A67',
    successLight: '#E7F6EE',
    bg: '#F9F1F1',
    card: '#FFFFFF',
    border: '#F0D9D9',
    text: '#2D1F22',
    textSub: '#785B5F',
    textMuted: '#B79296',
    navBg: '#FFFFFF',
  },
};

const ThemeContext = createContext({
  themeName: 'red',
  theme: THEMES.red,
  setThemeName: () => {},
  reloadTheme: () => {},
  themes: THEMES,
});

export function ThemeProvider({ children }) {
  const [themeName, setThemeNameState] = useState('red');

  const reloadTheme = useCallback(async () => {
    try {
      const key = await themeKeyForUser();
      const value = await AsyncStorage.getItem(key);
      setThemeNameState(value && THEMES[value] ? value : 'red');
    } catch {
      setThemeNameState('red');
    }
  }, []);

  useEffect(() => {
    reloadTheme();
  }, [reloadTheme]);

  const setThemeName = async (name) => {
    if (!THEMES[name]) return;
    setThemeNameState(name);
    try {
      const key = await themeKeyForUser();
      await AsyncStorage.setItem(key, name);
    } catch (error) {
      console.log('Theme save error:', error.message);
    }
  };

  const theme = THEMES[themeName] || THEMES.blue;

  return (
    <ThemeContext.Provider value={{ themeName, theme, setThemeName, reloadTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
