import { useCallback, useEffect, useRef, useState } from 'react';
import API, { errMsg } from '../api/client';

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

// Fetch helper: returns { data, loading, error, reload, setData }.
export function useApi(url, params, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const seq = useRef(0);
  const key = JSON.stringify(params || {});

  const reload = useCallback(async ({ quiet } = {}) => {
    const n = ++seq.current;
    if (!quiet) setLoading(true);
    setError('');
    try {
      const res = await API.get(url, { params });
      if (n === seq.current) setData(res.data);
    } catch (e) {
      if (n === seq.current) setError(errMsg(e, 'Could not load this page'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload, ...deps]);
  return { data, loading, error, reload, setData };
}
