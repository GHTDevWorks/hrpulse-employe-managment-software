// Pure date and status rules, shared logic ported from backend/utils/time.js and dayStatus.js
// so the in-browser demo computes exactly what the real API does.
/* eslint-disable */
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



/**
 * Status codes:
 *  present  – signed in on time
 *  late     – signed in after start + grace
 *  half     – signed out having worked less than halfDayHours
 *  leave    – approved leave
 *  holiday  – company holiday
 *  weekend  – configured weekend day
 *  absent   – past working day with no record
 *  pending  – today, not signed in yet
 *  none     – future, or before the person joined
 */
const workedMinutes = (record, now = new Date()) => {
  if (!record || !record.signInTime) return 0;
  const end = record.signOutTime ? new Date(record.signOutTime) : now;
  return Math.max(0, Math.floor((end - new Date(record.signInTime)) / 60000));
};

const buildLeaveIndex = (leaves) => {
  // Map date -> leave for approved leaves
  const idx = new Map();
  for (const l of leaves) {
    if (l.status !== 'approved') continue;
    for (const d of dateRange(l.startDate, l.endDate)) idx.set(d, l);
  }
  return idx;
};

const computeDay = ({ date, record, leave, holiday, settings, today, joinDate, now = new Date() }) => {
  const weekend = settings.weekendDays.includes(weekdayOf(date));
  const base = {
    date,
    signInTime: record?.signInTime || null,
    signOutTime: record?.signOutTime || null,
    lateMinutes: record?.lateMinutes || 0,
    workedMinutes: 0,
    totalHours: '-',
    open: false,
    autoSignedOut: !!record?.autoSignedOut,
    recordId: record?._id || null,
    signInNote: record?.signInNote || '',
    signOutNote: record?.signOutNote || '',
    managerNote: record?.managerNote || '',
    source: record?.source || null,
    holidayName: holiday?.name || '',
    leaveType: leave?.type || '',
  };

  if (record && record.signInTime) {
    const worked = workedMinutes(record, now);
    const open = !record.signOutTime;
    let status = record.lateMinutes > 0 ? 'late' : 'present';
    if (!open && worked < settings.halfDayHours * 60) status = 'half';
    return { ...base, status, workedMinutes: worked, totalHours: formatMinutes(worked), open };
  }
  if (leave) return { ...base, status: 'leave' };
  if (holiday) return { ...base, status: 'holiday' };
  if (weekend) return { ...base, status: 'weekend' };
  if (date > today || (joinDate && date < joinDate)) return { ...base, status: 'none' };
  if (date === today) return { ...base, status: 'pending' };
  return { ...base, status: 'absent' };
};

const summarize = (days) => {
  const c = { present: 0, late: 0, half: 0, leave: 0, holiday: 0, weekend: 0, absent: 0, pending: 0, none: 0 };
  let minutes = 0;
  let lateMinutes = 0;
  let lateDays = 0;
  for (const d of days) {
    c[d.status] = (c[d.status] || 0) + 1;
    minutes += d.workedMinutes;
    if (d.signInTime && d.lateMinutes > 0) { lateDays += 1; lateMinutes += d.lateMinutes; }
  }
  const attended = c.present + c.late + c.half;
  const workingDays = attended + c.absent + c.leave;
  const expected = workingDays - c.leave;
  const rate = expected > 0 ? Math.round(((c.present + c.late + c.half * 0.5) / expected) * 100) : null;
  return {
    counts: c,
    totalWorkingDays: workingDays,
    totalPresent: attended,
    totalAbsent: c.absent,
    totalLate: lateDays,
    totalLeave: c.leave,
    totalHolidays: c.holiday + c.weekend,
    totalMinutes: minutes,
    totalHours: formatMinutes(minutes),
    avgMinutes: attended ? Math.round(minutes / attended) : 0,
    avgHours: formatMinutes(attended ? minutes / attended : 0),
    lateMinutes,
    attendanceRate: rate,
  };
};


export {
  dateStrIn, minutesOfDayIn, hhmmToMinutes, isValidDateStr, isValidHHMM,
  weekdayOf, addDays, dateRange, monthBounds, zonedToDate, formatMinutes,
  computeDay, summarize, buildLeaveIndex, workedMinutes,
};
