import axios from 'axios';
import { DEMO_MODE, demoAdapter } from '../demo/adapter';

// In development the API runs on its own port; in production (Vercel) it is on the same domain under /api.
// A localhost URL left in .env is ignored in a production build so a deploy never points at your own computer.
const envUrl = import.meta.env.VITE_API_URL;
const baseURL = import.meta.env.DEV
  ? envUrl || 'http://localhost:5005/api'
  : envUrl && !/localhost|127\.0\.0\.1/.test(envUrl) ? envUrl : '/api';

const API = axios.create({
  baseURL,
  timeout: 20000,
  // In demo mode there is no server: requests are answered in the browser (see src/demo).
  ...(DEMO_MODE ? { adapter: demoAdapter } : {}),
});

API.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('hrp-token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch { /* storage unavailable */ }
  return config;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const url = err.config?.url || '';
    if ((status === 401 || status === 403) && !url.includes('/auth/login') && /session|account|signed in/i.test(err.response?.data?.message || '')) {
      window.dispatchEvent(new CustomEvent('hrp:logout', { detail: err.response?.data?.message }));
    }
    return Promise.reject(err);
  },
);

export const errMsg = (err, fallback = 'Something went wrong') => {
  if (!err?.response) return 'Cannot reach the server. Check that the API is running.';
  return err.response?.data?.message || fallback;
};

export const downloadFile = async (url, params, filename) => {
  const res = await API.get(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
};

export default API;
