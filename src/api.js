import axios from 'axios';

const api = axios.create({
  baseURL: 'http://192.168.16.182:8001/api',
  headers: { 'Content-Type': 'application/json' },
});

export const setToken = (token) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export const removeToken = () => {
  delete api.defaults.headers.common['Authorization'];
};

export default api;
