const { weekdayOf, dateRange, formatMinutes } = require('./time');

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

module.exports = { computeDay, summarize, buildLeaveIndex, workedMinutes };
