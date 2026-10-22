// src/theme.js
// Central design tokens — import this in every screen for consistency

import { Platform, StatusBar } from 'react-native';

export const Colors = {
  // Primary palettes
  blue:        '#B5233D',
  blueLight:   '#F9E4E8',
  green:       '#1E6B3A',
  greenLight:  '#DDF0E3',
  purple:      '#7F77DD',
  purpleLight: '#EEECFB',
  orange:      '#D85A30',
  orangeLight: '#FAEEDA',

  // Semantic
  danger:      '#E24B4A',
  dangerLight: '#FCEBEB',
  warning:     '#8A6700',
  warningLight:'#FFF1BF',
  success:     '#1E6B3A',
  successLight:'#DDF0E3',

  // Neutrals
  bg:          '#F7E9EC',
  card:        '#FFFFFF',
  border:      '#EBDDDF',
  text:        '#2A1B1F',
  textSub:     '#7A666B',
  textMuted:   '#AD999E',
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
