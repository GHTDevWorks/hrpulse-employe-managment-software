import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, Plus, CalendarHeart, Plane, RefreshCw, Inbox } from 'lucide-react';
import API, { errMsg } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useApi, useNow } from '../../lib/hooks';
import { fmtDay, fmtDayLong, fmtMins, fmtTime, relTime, setTimezone, minutesInTz, hhmmToMin } from '../../lib/format';
import { LEAVE_TYPES } from '../../lib/status';
import { Avatar, Button, Empty, ErrorNote, IconButton, PageHeader, Panel, Segmented, Spinner, StatBand, StatusPill } from '../../components/ui';
import DayRuler from '../../components/DayRuler';
import TrendChart from '../../components/TrendChart';
import AttendanceEditor from '../../components/AttendanceEditor';
import { LeaveRange } from '../MyLeave';
import { describeAction } from './Activity';

const ORDER = { late: 0, present: 1, half: 2, pending: 3, absent: 4, leave: 5, holiday: 6, weekend: 7, none: 8 };

export default function Overview() {
  const toast = useToast();
  const now = useNow(30000);
  const { data, loading, error, reload } = useApi('/dashboard');
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState(null);
  const [reviewing, setReviewing] = useState('');

  useEffect(() => { if (data?.settings?.timezone) setTimezone(data.settings.timezone); }, [data]);
  useEffect(() => { const t = setInterval(() => reload({ quiet: true }), 120000); return () => clearInterval(t); }, [reload]);

  const people = useMemo(() => {
    const list = [...(data?.people || [])].sort((a, b) => (Number(b.open) - Number(a.open)) || (ORDER[a.status] - ORDER[b.status]) || a.name.localeCompare(b.name));
    if (filter === 'in') return list.filter((p) => p.open);
    if (filter === 'late') return list.filter((p) => p.status === 'late');
    if (filter === 'out') return list.filter((p) => p.status === 'pending' || p.status === 'absent');
    if (filter === 'leave') return list.filter((p) => p.status === 'leave');
    return list;
  }, [data, filter]);

  const review = async (leave, status) => {
    setReviewing(leave._id + status);
    try {
      await API.patch(`/leaves/${leave._id}/review`, { status });
      toast(`${leave.user.name}'s leave ${status === 'approved' ? 'approved' : 'declined'}`);
      reload({ quiet: true });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setReviewing('');
    }
  };

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorNote onRetry={reload}>{error}</ErrorNote>;
  const { counts, settings } = data;
  // One shared scale so everyone's bar lines up.
  const ins = data.people.filter((p) => p.signInTime).map((p) => minutesInTz(new Date(p.signInTime)));
  const range = [
    Math.max(0, Math.floor((Math.min(hhmmToMin(settings.workStart), ...ins) - 60) / 60) * 60),
    Math.min(1440, Math.ceil((Math.max(hhmmToMin(settings.workEnd), minutesInTz(now)) + 60) / 60) * 60),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Team today" description={fmtDayLong(data.today)}
        actions={<>
          <IconButton icon={RefreshCw} label="Refresh" onClick={() => reload({ quiet: true })} />
          <Button variant="secondary" icon={Plus} onClick={() => setEditor({})}>Add attendance</Button>
          <Link to="/team/records"><Button>Open records</Button></Link>
        </>} />

      {data.holidayToday && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-off-soft px-4 py-3 text-sm text-ink">
          <CalendarHeart className="size-4 text-off" /> Today is a holiday: <b>{data.holidayToday}</b>. Nobody is marked absent.
        </div>
      )}

      <StatBand items={[
        { label: 'In right now', value: counts.in, tone: 'text-accent', sub: `of ${counts.total} active people` },
        { label: 'Came in today', value: counts.present, sub: counts.total ? `${Math.round((counts.present / counts.total) * 100)}% of the team` : '' },
        { label: 'Late', value: counts.late, tone: counts.late ? 'text-late' : 'text-ink', sub: `after ${settings.workStart} + ${settings.graceMinutes} min` },
        { label: 'On leave', value: counts.leave, tone: counts.leave ? 'text-leave' : 'text-ink', sub: 'approved' },
        { label: data.pastGrace ? 'Not in' : 'Not in yet', value: counts.notIn, tone: counts.notIn && data.pastGrace ? 'text-absent' : 'text-ink', sub: data.pastGrace ? 'no sign-in, no leave' : 'start time not reached' },
      ]} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Panel title="Who's in" flush
          actions={<Segmented value={filter} onChange={setFilter} options={[
            { value: 'all', label: 'All', count: counts.total },
            { value: 'in', label: 'In', count: counts.in },
            { value: 'late', label: 'Late', count: counts.late },
            { value: 'out', label: 'Not in', count: counts.notIn },
          ]} />}>
          {people.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {people.map((p) => {
                const mins = p.open ? Math.floor((now - new Date(p.signInTime)) / 60000) : p.workedMinutes;
                return (
                  <li key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-5 py-3 sm:grid-cols-[auto_9.5rem_minmax(0,1fr)_12.5rem]">
                    <Avatar name={p.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                      <p className="truncate text-xs text-faint">{p.designation || p.department || p.role}</p>
                    </div>
                    <div className="col-span-3 hidden sm:col-span-1 sm:block">
                      <DayRuler compact range={range} settings={settings} signInTime={p.signInTime} signOutTime={p.signOutTime} now={now} />
                    </div>
                    <button onClick={() => setEditor({ userId: p.id, date: data.today, signInTime: p.signInTime, signOutTime: p.signOutTime, managerNote: p.managerNote, recordId: p.recordId })}
                      className="flex items-center justify-end gap-3 rounded-lg px-2 py-1 text-right hover:bg-sunken" title="Correct attendance">
                      <div className="hidden text-xs text-muted tabular sm:block">
                        {p.signInTime ? <>{fmtTime(p.signInTime)}{p.signOutTime ? `–${fmtTime(p.signOutTime)}` : ''}<br /><span className="text-ink">{fmtMins(mins)}</span></> : ''}
                      </div>
                      <StatusPill status={p.status === 'pending' && data.pastGrace ? 'absent' : p.status}>
                        {p.open ? (p.status === 'late' ? `In, ${fmtMins(p.lateMinutes)} late` : 'In') : p.status === 'pending' && data.pastGrace ? 'Not in' : undefined}
                      </StatusPill>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : <Empty title="Nobody here">No one matches this filter right now.</Empty>}
        </Panel>

        <div className="space-y-6">
          <Panel title="Leave waiting for you" flush
            actions={data.pendingLeaveCount > 0 && <Link to="/team/leave" className="text-[13px] font-medium text-accent hover:underline">All {data.pendingLeaveCount}</Link>}>
            {data.pendingLeaves.length ? (
              <ul className="divide-y divide-line border-t border-line">
                {data.pendingLeaves.map((l) => (
                  <li key={l._id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{l.user.name}</p>
                      <p className="truncate text-xs text-muted">{LEAVE_TYPES[l.type]}, <LeaveRange l={l} /> ({l.days}d)</p>
                    </div>
                    <IconButton icon={X} label="Decline" disabled={!!reviewing} onClick={() => review(l, 'rejected')} className="hover:!bg-absent-soft hover:!text-absent" />
                    <IconButton icon={Check} label="Approve" disabled={!!reviewing} onClick={() => review(l, 'approved')} className="bg-accent-soft !text-accent hover:!bg-accent hover:!text-accent-ink" />
                  </li>
                ))}
              </ul>
            ) : <div className="flex items-center gap-3 px-5 pb-5 text-[13px] text-muted"><Inbox className="size-4 text-faint" />No requests to review.</div>}
          </Panel>

          <Panel title="Next two weeks" flush>
            <ul className="divide-y divide-line border-t border-line">
              {[...data.upcomingHolidays.map((h) => ({ k: h._id, date: h.date, icon: CalendarHeart, cls: 'text-off', text: h.name })),
                ...data.upcomingLeaves.map((l) => ({ k: l._id, date: l.startDate, icon: Plane, cls: 'text-leave', text: `${l.user.name}, ${LEAVE_TYPES[l.type].toLowerCase()} leave`, sub: <LeaveRange l={l} /> }))]
                .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6)
                .map((e) => (
                  <li key={e.k} className="flex items-center gap-3 px-5 py-3">
                    <e.icon className={`size-4 shrink-0 ${e.cls}`} />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{e.text}</span>
                    <span className="shrink-0 text-xs text-muted tabular">{e.sub || fmtDay(e.date)}</span>
                  </li>
                ))}
              {!data.upcomingHolidays.length && !data.upcomingLeaves.length && <li className="px-5 py-3 text-[13px] text-muted">Nothing scheduled.</li>}
            </ul>
          </Panel>

          <Panel title="By department">
            <ul className="space-y-3">
              {data.departments.map((d) => (
                <li key={d.name}>
                  <div className="flex justify-between text-[13px]"><span className="text-ink">{d.name}</span><span className="text-muted tabular">{d.present}/{d.total}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-accent" style={{ width: `${(d.present / d.total) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Panel title="Last 14 days" description="How many people came in each working day.">
          <TrendChart data={data.trend} total={counts.total} today={data.today} />
        </Panel>
        <Panel title="Recent activity" flush actions={<Link to="/team/activity" className="text-[13px] font-medium text-accent hover:underline">View all</Link>}>
          <ul className="divide-y divide-line border-t border-line">
            {data.activity.map((a) => (
              <li key={a._id} className="px-5 py-2.5">
                <p className="text-[13px] text-ink">{describeAction(a)}</p>
                <p className="text-xs text-faint">{relTime(a.createdAt)}</p>
              </li>
            ))}
            {!data.activity.length && <li className="px-5 py-3 text-[13px] text-muted">No changes yet.</li>}
          </ul>
        </Panel>
      </div>

      <AttendanceEditor open={!!editor} onClose={() => setEditor(null)} people={data.people} initial={editor} onSaved={() => reload({ quiet: true })} />
    </div>
  );
}
