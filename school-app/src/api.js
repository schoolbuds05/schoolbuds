import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const configuredApiUrl = (
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  Constants.manifest?.extra?.apiUrl
)?.trim();

if (!configuredApiUrl) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not configured. Add it to .env.local before starting the app or set it in the EAS build environment.'
  );
}

const api = axios.create({
  baseURL: `${configuredApiUrl.replace(/\/$/, '')}/api`,
  headers: { 'Content-Type': 'application/json' },
});

export const setToken = (token) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export const removeToken = () => {
  delete api.defaults.headers.common['Authorization'];
};

export default api;
