// src/theme.js
// Central design tokens — import this in every screen for consistency

import { Platform, StatusBar } from 'react-native';

export const Colors = {
  // Primary palettes
  blue:        '#378ADD',
  blueLight:   '#E6F1FB',
  green:       '#1D9E75',
  greenLight:  '#E1F5EE',
  purple:      '#7F77DD',
  purpleLight: '#EEECFB',
  orange:      '#D85A30',
  orangeLight: '#FAEEDA',

  // Semantic
  danger:      '#E24B4A',
  dangerLight: '#FCEBEB',
  warning:     '#BA7517',
  warningLight:'#FAEEDA',
  success:     '#1D9E75',
  successLight:'#E1F5EE',

  // Neutrals
  bg:          '#F4F6F9',
  card:        '#FFFFFF',
  border:      '#EFEFEF',
  text:        '#1A1A2E',
  textSub:     '#6B7280',
  textMuted:   '#B0B7C3',
  navBg:       '#FFFFFF',
};

export const Font = {
  xs:   11,
  sm:   13,
  base: 14,
  md:   16,
  lg:   18,
  xl:   22,
  xxl:  26,
};

export const Radius = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  full: 999,
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
};

// Safe top padding that accounts for status bar on all devices
export const HEADER_TOP = Platform.OS === 'android'
  ? (StatusBar.currentHeight ?? 24) + 12
  : 52;

export const CONDITION_COLORS = {
  new:      { bg: '#E1F5EE', text: '#1D9E75' },
  like_new: { bg: '#E6F1FB', text: '#378ADD' },
  good:     { bg: '#FFF3E0', text: '#BA7517' },
  fair:     { bg: '#FCEBEB', text: '#E24B4A' },
};

export const CATEGORY_ICONS = {
  books:       '📚',
  uniforms:    '👕',
  electronics: '📱',
  supplies:    '✏️',
  other:       '📦',
};
