import { useState } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { addMonths, fmtDay, fmtDayLong, fmtMins, fmtMonth, fmtTime, todayInTz, toCsv, saveText } from '../lib/format';
import { STATUS } from '../lib/status';
import { Button, ErrorNote, IconButton, PageHeader, Panel, Spinner, StatBand, StatusPill, Table, Segmented } from '../components/ui';
import MonthCalendar, { StatusLegend } from '../components/MonthCalendar';

export function DayDetail({ day }) {
  if (!day) return <p className="text-[13px] text-muted">Choose a day on the calendar to see its details.</p>;
  const s = STATUS[day.status];
  return (
    <div>
      <p className="text-sm font-semibold text-ink">{fmtDayLong(day.date)}</p>
      <div className="mt-2"><StatusPill status={day.status} /></div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div><dt className="text-xs text-faint">Signed in</dt><dd className="font-medium text-ink tabular">{fmtTime(day.signInTime)}</dd></div>
        <div><dt className="text-xs text-faint">Signed out</dt><dd className="font-medium text-ink tabular">{day.open ? 'Still in' : fmtTime(day.signOutTime)}</dd></div>
        <div><dt className="text-xs text-faint">Worked</dt><dd className="font-medium text-ink tabular">{day.workedMinutes ? fmtMins(day.workedMinutes) : '–'}</dd></div>
        <div><dt className="text-xs text-faint">Late by</dt><dd className={`font-medium tabular ${day.lateMinutes ? 'text-late' : 'text-ink'}`}>{day.lateMinutes ? `${day.lateMinutes} min` : '–'}</dd></div>
      </dl>
      {(day.holidayName || day.leaveType || day.signInNote || day.signOutNote || day.managerNote || day.autoSignedOut) && (
        <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-[13px] text-muted">
          {day.holidayName && <p>{day.holidayName}</p>}
          {day.leaveType && <p className="capitalize">{day.leaveType} leave</p>}
          {day.signInNote && <p><span className="text-faint">Note:</span> {day.signInNote}</p>}
          {day.signOutNote && <p><span className="text-faint">Summary:</span> {day.signOutNote}</p>}
          {day.managerNote && <p><span className="text-faint">Manager:</span> {day.managerNote}</p>}
          {day.autoSignedOut && <p className={s.fg}>Signed out automatically</p>}
        </div>
      )}
    </div>
  );
}

export default function MyHistory() {
  const { user } = useAuth();
  const today = todayInTz();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [view, setView] = useState('calendar');
  const [selected, setSelected] = useState(null);
  const { data, loading, error, reload } = useApi('/attendance/me', { month });
  const sum = data?.summary;
  const days = data?.days || [];
  const sel = days.find((d) => d.date === selected) || days.find((d) => d.date === today) || null;

  const exportCsv = () => {
    const rows = [['Date', 'Status', 'Sign in', 'Sign out', 'Worked', 'Late (min)', 'Notes']];
    days.filter((d) => d.status !== 'none').forEach((d) => rows.push([
      d.date, STATUS[d.status].label, fmtTime(d.signInTime), fmtTime(d.signOutTime), d.workedMinutes ? fmtMins(d.workedMinutes) : '',
      d.lateMinutes || '', [d.holidayName, d.signInNote, d.signOutNote, d.managerNote].filter(Boolean).join(' | '),
    ]));
    saveText(toCsv(rows), `${user.name.replace(/\s+/g, '_')}_${month}.csv`);
  };

  return (
    <div>
      <PageHeader title="My attendance" description="Your days, hours and late arrivals, month by month."
        actions={<>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
            <IconButton icon={ChevronLeft} label="Previous month" onClick={() => { setMonth(addMonths(month, -1)); setSelected(null); }} />
            <span className="min-w-32 text-center text-sm font-medium text-ink">{fmtMonth(month)}</span>
            <IconButton icon={ChevronRight} label="Next month" disabled={month >= today.slice(0, 7)} onClick={() => { setMonth(addMonths(month, 1)); setSelected(null); }} />
          </div>
          <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!days.length}>Download CSV</Button>
        </>} />

      <ErrorNote onRetry={reload}>{error}</ErrorNote>
      {loading && !data ? <Spinner /> : sum && (
        <div className="space-y-6">
          <StatBand items={[
            { label: 'Attendance rate', value: sum.attendanceRate === null ? '–' : `${sum.attendanceRate}%`, tone: sum.attendanceRate >= 90 ? 'text-accent' : sum.attendanceRate >= 75 ? 'text-late' : sum.attendanceRate === null ? 'text-ink' : 'text-absent', sub: `${sum.totalWorkingDays} working days` },
            { label: 'Days in', value: sum.totalPresent, sub: sum.counts.half ? `${sum.counts.half} short` : 'full record' },
            { label: 'Late arrivals', value: sum.totalLate, tone: sum.totalLate ? 'text-late' : 'text-ink', sub: sum.lateMinutes ? `${fmtMins(sum.lateMinutes)} in total` : 'none' },
            { label: 'Absent', value: sum.totalAbsent, tone: sum.totalAbsent ? 'text-absent' : 'text-ink', sub: `${sum.totalLeave} on leave` },
            { label: 'Hours worked', value: sum.totalHours, sub: `${sum.avgHours} a day` },
          ]} />

          <div className="flex justify-between gap-3">
            <Segmented value={view} onChange={setView} options={[{ value: 'calendar', label: 'Calendar' }, { value: 'list', label: 'List' }]} />
          </div>

          {view === 'calendar' ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              <Panel>
                <MonthCalendar days={days} today={today} selected={sel?.date} onSelect={(d) => setSelected(d.date)} />
                <div className="mt-5"><StatusLegend /></div>
              </Panel>
              <Panel title="Day details"><DayDetail day={sel} /></Panel>
            </div>
          ) : (
            <Panel flush>
              <Table head={['Date', 'Status', 'In', 'Out', 'Worked', 'Notes']}>
                {days.filter((d) => d.status !== 'none' && d.status !== 'weekend').reverse().map((d) => (
                  <tr key={d.date} className="hover:bg-sunken/60">
                    <td className="px-5 py-3 text-ink">{fmtDay(d.date)}</td>
                    <td className="px-5 py-3"><StatusPill status={d.status}>{d.status === 'late' ? `Late ${fmtMins(d.lateMinutes)}` : undefined}</StatusPill></td>
                    <td className="px-5 py-3 text-muted tabular">{fmtTime(d.signInTime)}</td>
                    <td className="px-5 py-3 text-muted tabular">{d.open ? 'Still in' : fmtTime(d.signOutTime)}</td>
                    <td className="px-5 py-3 text-ink tabular">{d.workedMinutes ? fmtMins(d.workedMinutes) : '–'}</td>
                    <td className="max-w-xs truncate px-5 py-3 text-[13px] text-muted">{[d.holidayName, d.signInNote, d.signOutNote, d.managerNote].filter(Boolean).join('; ')}</td>
                  </tr>
                ))}
              </Table>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
