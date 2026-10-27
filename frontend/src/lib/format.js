// Times are shown in the company timezone so everyone sees the same clock.
let TZ = 'Asia/Karachi';
export const setTimezone = (tz) => { if (tz) TZ = tz; };
export const getTimezone = () => TZ;

const cache = {};
const fmt = (key, opts) => (cache[key + TZ] ||= new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts }));

export const fmtTime = (iso) => (iso ? fmt('t', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)) : '–');
export const fmtTime12 = (iso) => (iso ? new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '–');
export const fmtDateTime = (iso) => (iso ? fmt('dt', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)) : '–');

const parseDay = (s) => new Date(`${s}T12:00:00Z`);
export const fmtDay = (s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  (s ? new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(parseDay(s)) : '–');
export const fmtDayLong = (s) => fmtDay(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtMonth = (yyyyMm) => fmtDay(`${yyyyMm}-01`, { month: 'long', year: 'numeric' });
export const weekdayShort = (s) => fmtDay(s, { weekday: 'short' });

export const fmtMins = (m) => {
  const v = Math.max(0, Math.round(m || 0));
  const h = Math.floor(v / 60);
  const mm = v % 60;
  if (!h) return `${mm}m`;
  return `${h}h ${String(mm).padStart(2, '0')}m`;
};

export const minutesInTz = (date = new Date()) => {
  const p = fmt('hm', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const g = (t) => Number(p.find((x) => x.type === t)?.value || 0);
  return g('hour') * 60 + g('minute') + g('second') / 60;
};

export const hhmmToMin = (s = '00:00') => { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); };

export const todayInTz = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const addDays = (s, n) => { const d = parseDay(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const addMonths = (yyyyMm, n) => {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
export const monthEnd = (yyyyMm) => { const [y, m] = yyyyMm.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };

export const relTime = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} d ago`;
  return fmtDateTime(iso);
};

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export const toCsv = (rows) => rows.map((r) => r.map((c) => {
  const s = String(c ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}).join(',')).join('\n');

export const saveText = (text, filename, type = 'text/csv;charset=utf-8') => {
  const blob = new Blob(['﻿', text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

export const minToHHMM = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
export const dayOf = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
