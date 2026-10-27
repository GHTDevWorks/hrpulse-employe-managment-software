import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut, Megaphone, Pin, CalendarHeart, Coffee, Plane } from 'lucide-react';
import API, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useApi, useNow } from '../lib/hooks';
import { fmtDayLong, fmtDay, fmtMins, fmtTime, setTimezone, getTimezone, minutesInTz, hhmmToMin, relTime, minToHHMM } from '../lib/format';
import { STATUS } from '../lib/status';
import { Button, ConfirmModal, ErrorNote, Input, Panel, Spinner, StatusPill, cx } from '../components/ui';
import DayRuler from '../components/DayRuler';

const greeting = (mins) => (mins < 720 ? 'Good morning' : mins < 1020 ? 'Good afternoon' : 'Good evening');

function Clock({ now }) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: getTimezone(), hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const g = (t) => parts.find((p) => p.type === t)?.value;
  return (
    <p className="text-[64px] leading-none font-semibold tracking-[-0.04em] text-ink tabular sm:text-[88px]" aria-label={`Current time ${g('hour')}:${g('minute')}`}>
      {g('hour')}<span className="text-faint">:</span>{g('minute')}
      <span className="ml-2 align-top text-2xl font-medium tracking-normal text-faint sm:text-3xl">{g('second')}</span>
    </p>
  );
}

export default function MyDay() {
  const { user } = useAuth();
  const toast = useToast();
  const now = useNow(1000);
  const { data, loading, error, reload } = useApi('/attendance/status');
  const notices = useApi('/announcements');
  const holidays = useApi('/holidays', { year: new Date().getFullYear() });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  useEffect(() => { if (data?.settings?.timezone) setTimezone(data.settings.timezone); }, [data]);
  // Refresh status every 5 minutes so auto sign-out and manager edits show up.
  useEffect(() => { const t = setInterval(() => reload({ quiet: true }), 300000); return () => clearInterval(t); }, [reload]);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorNote onRetry={reload}>{error}</ErrorNote>;

  const { settings, record, day, week, weekSummary, canSignIn, canSignOut, holidayToday } = data;
  const signedIn = !!record?.signInTime;
  const open = signedIn && !record.signOutTime;
  const worked = signedIn ? Math.floor(((record.signOutTime ? new Date(record.signOutTime) : now) - new Date(record.signInTime)) / 60000) : 0;
  const target = settings.fullDayHours * 60;
  const nowMin = minutesInTz(now);
  const startMin = hhmmToMin(settings.workStart);

  const act = async (kind) => {
    setBusy(true);
    try {
      const { data: res } = await API.post(`/attendance/${kind}`, { note });
      toast(res.message);
      setNote('');
      setConfirmOut(false);
      await reload({ quiet: true });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  let headline;
  let sub;
  if (open) {
    headline = `Signed in for ${fmtMins(worked)}`;
    sub = worked >= target ? `You've reached your ${settings.fullDayHours}-hour day.` : `${fmtMins(target - worked)} to go for a full day.`;
  } else if (signedIn) {
    headline = `Day complete: ${fmtMins(worked)}`;
    sub = record.autoSignedOut ? `You were signed out automatically after ${settings.autoSignOutHours} hours. Ask your manager to correct the time if needed.` : 'See you tomorrow.';
  } else if (day.status === 'leave') {
    headline = 'You are on leave today';
    sub = 'Enjoy your time off.';
  } else if (holidayToday) {
    headline = `Holiday: ${holidayToday}`;
    sub = 'The office is closed today. You can still sign in if you are working.';
  } else if (day.status === 'weekend') {
    headline = 'It\'s the weekend';
    sub = 'You can still sign in if you are working today.';
  } else {
    headline = 'Not signed in yet';
    sub = nowMin < startMin ? `Work starts at ${settings.workStart}.` : nowMin <= startMin + settings.graceMinutes
      ? `Work started at ${settings.workStart}. Sign in before ${minToHHMM(startMin + settings.graceMinutes)} to be on time.`
      : `Work started at ${settings.workStart}. Signing in now will be marked late.`;
  }

  const upcoming = (holidays.data || []).filter((h) => h.date >= data.today).slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{fmtDayLong(data.today)}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{greeting(nowMin)}, {user?.name?.split(' ')[0]}</h1>
      </div>

      {/* Punch clock */}
      <section className="rounded-2xl border border-line bg-surface px-5 pt-6 pb-5 sm:px-8 sm:pt-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Clock now={now} />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {signedIn && <StatusPill status={day.status === 'pending' ? (record.lateMinutes ? 'late' : 'present') : day.status} />}
              <p className="text-[15px] font-semibold text-ink">{headline}</p>
            </div>
            <p className="mt-1 max-w-lg text-sm text-muted">{sub}</p>
          </div>

          <div className="w-full lg:w-[360px]">
            {(canSignIn || canSignOut) && (
              <form onSubmit={(e) => { e.preventDefault(); canSignIn ? act('signin') : setConfirmOut(true); }} className="space-y-2.5">
                <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={canSignIn ? 300 : 500}
                  placeholder={canSignIn ? 'Add a note, e.g. working from home (optional)' : 'What did you get done today? (optional)'} aria-label="Note" />
                {canSignIn ? (
                  <Button type="submit" size="lg" icon={LogIn} loading={busy} className="w-full">Sign in</Button>
                ) : (
                  <Button type="submit" size="lg" icon={LogOut} variant="secondary" className="w-full !border-ink !text-ink">Sign out</Button>
                )}
              </form>
            )}
            {!canSignIn && !canSignOut && (
              <Link to="/history" className="block rounded-xl bg-sunken px-4 py-3 text-sm text-muted hover:text-ink">
                Signed out at <b className="text-ink tabular">{fmtTime(record?.signOutTime)}</b>. View your attendance history.
              </Link>
            )}
          </div>
        </div>

        <div className="mt-8">
          <DayRuler settings={settings} signInTime={record?.signInTime} signOutTime={record?.signOutTime} now={now} />
        </div>
        {(record?.signInNote || record?.signOutNote || record?.managerNote) && (
          <div className="mt-4 space-y-1 border-t border-line pt-3 text-[13px] text-muted">
            {record.signInNote && <p><span className="text-faint">Morning note:</span> {record.signInNote}</p>}
            {record.signOutNote && <p><span className="text-faint">Day summary:</span> {record.signOutNote}</p>}
            {record.managerNote && <p><span className="text-faint">Manager note:</span> {record.managerNote}</p>}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Last 7 days" description={`${weekSummary.totalHours} worked, ${weekSummary.totalLate} late arrival${weekSummary.totalLate === 1 ? '' : 's'}`}
          actions={<Link to="/history" className="text-[13px] font-medium text-accent hover:underline">Full history</Link>}>
          <div className="grid grid-cols-7 gap-2">
            {week.map((d) => {
              const s = STATUS[d.status];
              const isToday = d.date === data.today;
              const mins = isToday && open ? worked : d.workedMinutes;
              const h = Math.min(100, (mins / target) * 100);
              return (
                <div key={d.date} className="flex flex-col items-center gap-2" title={`${fmtDay(d.date)}: ${s.label || 'No record'}${mins ? `, ${fmtMins(mins)}` : ''}`}>
                  <div className="relative flex h-28 w-full max-w-10 items-end overflow-hidden rounded-lg bg-sunken">
                    {mins > 0 && <div className={cx('w-full rounded-lg', s.dot)} style={{ height: `${Math.max(h, 6)}%` }} />}
                    {!mins && d.status !== 'none' && <span className={cx('absolute inset-x-0 bottom-2 text-center text-[11px] font-semibold', s.fg)}>{s.short}</span>}
                  </div>
                  <div className="text-center leading-tight">
                    <p className={cx('text-[11px]', isToday ? 'font-semibold text-ink' : 'text-faint')}>{fmtDay(d.date, { weekday: 'short' })}</p>
                    <p className="text-[10px] whitespace-nowrap text-muted tabular sm:text-[11px]">{mins ? fmtMins(mins) : '–'}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-center">
            {[
              ['Days in', weekSummary.totalPresent],
              ['Average day', weekSummary.avgHours],
              ['On-time rate', weekSummary.totalPresent ? `${Math.round(((weekSummary.totalPresent - weekSummary.totalLate) / weekSummary.totalPresent) * 100)}%` : '–'],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface px-3 py-3">
                <p className="text-lg font-semibold text-ink tabular">{v}</p>
                <p className="text-xs text-muted">{k}</p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Notices" flush>
            {notices.data?.length ? (
              <ul className="divide-y divide-line">
                {notices.data.slice(0, 4).map((n) => (
                  <li key={n._id} className="px-5 py-3.5">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-ink">{n.pinned && <Pin className="size-3.5 text-late" />}{n.title}</p>
                    {n.body && <p className="mt-1 text-[13px] leading-relaxed text-muted">{n.body}</p>}
                    <p className="mt-1 text-xs text-faint">{n.author?.name || 'Manager'}, {relTime(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 px-5 pb-5 text-[13px] text-muted"><Megaphone className="size-4 text-faint" />No notices right now.</div>
            )}
          </Panel>
          <Panel title="Coming up" flush>
            <ul className="divide-y divide-line">
              {upcoming.map((h) => (
                <li key={h._id} className="flex items-center gap-3 px-5 py-3">
                  <CalendarHeart className="size-4 text-off" />
                  <span className="flex-1 text-sm text-ink">{h.name}</span>
                  <span className="text-[13px] text-muted tabular">{fmtDay(h.date)}</span>
                </li>
              ))}
              <li>
                <Link to="/leave" className="flex items-center gap-3 px-5 py-3 text-sm text-accent hover:bg-sunken">
                  <Plane className="size-4" /> Request time off
                </Link>
              </li>
              {!upcoming.length && <li className="flex items-center gap-3 px-5 py-3 text-[13px] text-muted"><Coffee className="size-4 text-faint" />No holidays scheduled.</li>}
            </ul>
          </Panel>
        </div>
      </div>

      <ConfirmModal open={confirmOut} title="Sign out for today?" danger={false} confirmLabel="Sign out" loading={busy}
        message={`You've worked ${fmtMins(worked)}${worked < target ? `, which is ${fmtMins(target - worked)} short of a full day` : ''}. You won't be able to sign in again until tomorrow.`}
        onConfirm={() => act('signout')} onCancel={() => setConfirmOut(false)} />
    </div>
  );
}
