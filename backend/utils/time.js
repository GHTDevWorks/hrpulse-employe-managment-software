// Timezone-aware date helpers. All "date strings" are YYYY-MM-DD in the company timezone.

const partsIn = (date, timeZone) => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const out = {};
  for (const p of fmt.formatToParts(date)) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return out;
};

const pad = (n) => String(n).padStart(2, '0');

const dateStrIn = (timeZone, date = new Date()) => {
  const p = partsIn(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};

const minutesOfDayIn = (date, timeZone) => {
  const p = partsIn(date, timeZone);
  return p.hour * 60 + p.minute;
};

const hhmmToMinutes = (hhmm = '00:00') => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const isValidDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const isValidHHMM = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

const weekdayOf = (dateStr) => new Date(`${dateStr}T00:00:00Z`).getUTCDay();

const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const dateRange = (start, end, max = 400) => {
  const out = [];
  let cur = start;
  while (cur <= end && out.length < max) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
};

const monthBounds = (yyyyMm) => {
  const [y, m] = yyyyMm.split('-').map(Number);
  const start = `${y}-${pad(m)}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start, end: `${y}-${pad(m)}-${pad(last)}` };
};

// Convert a wall-clock time in `timeZone` on `dateStr` into a real Date (UTC instant).
const zonedToDate = (dateStr, hhmm, timeZone) => {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offsetAt = (ts) => {
    const p = partsIn(new Date(ts), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ts;
  };
  let ts = guess - offsetAt(guess);
  ts = guess - offsetAt(ts); // second pass handles DST edges
  return new Date(ts);
};

const formatMinutes = (mins) => {
  const m = Math.max(0, Math.round(mins || 0));
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
};

module.exports = {
  dateStrIn, minutesOfDayIn, hhmmToMinutes, isValidDateStr, isValidHHMM,
  weekdayOf, addDays, dateRange, monthBounds, zonedToDate, formatMinutes,
};
