import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const errMsg = (err) =>
  err?.response?.data?.message || (err?.request ? 'Cannot reach the server. Is it running?' : err?.message) || 'Something went wrong';

export default api;
