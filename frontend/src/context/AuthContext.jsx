import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/client';
import { setTimezone } from '../lib/format';

const AuthContext = createContext(null);

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } };

export const homeFor = (user) => (user?.role === 'manager' ? '/team' : '/day');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(read('hrp-user')) || null; } catch { return null; }
  });
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();
  if (user?.timezone) setTimezone(user.timezone);

  const logout = useCallback((message = '') => {
    write('hrp-token', null);
    write('hrp-user', null);
    setUser(null);
    setNotice(message);
    navigate('/', { replace: true });
  }, [navigate]);

  const login = (data) => {
    write('hrp-token', data.token);
    write('hrp-user', JSON.stringify(data.user));
    setUser(data.user);
    setNotice('');
    navigate(homeFor(data.user), { replace: true });
  };

  const updateUser = (u) => {
    write('hrp-user', JSON.stringify(u));
    setUser(u);
  };

  // Refresh the profile on load so role/active changes take effect.
  useEffect(() => {
    if (!read('hrp-token')) return;
    API.get('/auth/me').then(({ data }) => updateUser(data)).catch(() => {});
  }, []);

  useEffect(() => {
    const onLogout = (e) => logout(e.detail || 'Your session ended. Sign in again.');
    window.addEventListener('hrp:logout', onLogout);
    return () => window.removeEventListener('hrp:logout', onLogout);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, notice }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
