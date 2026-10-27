import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Pencil, Plus, CalendarRange } from 'lucide-react';
import { downloadFile, errMsg } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../lib/hooks';
import { addDays, addMonths, fmtDay, fmtMins, fmtTime, monthEnd, todayInTz } from '../../lib/format';
import { STATUS } from '../../lib/status';
import { Avatar, Button, Empty, ErrorNote, Field, IconButton, Input, Panel, PageHeader, RoleTag, Segmented, Select, Spinner, StatBand, StatusPill, Table, cx } from '../../components/ui';
import { StatusLegend } from '../../components/MonthCalendar';
import AttendanceEditor from '../../components/AttendanceEditor';

const rangeFor = (preset, today) => {
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  if (preset === 'today') return { start: today, end: today };
  if (preset === 'week') return { start: addDays(today, -dow), end: today };
  if (preset === 'month') return { start: `${today.slice(0, 7)}-01`, end: today };
  if (preset === 'last') { const m = addMonths(today.slice(0, 7), -1); return { start: `${m}-01`, end: monthEnd(m) }; }
  return null;
};

const notesOf = (d) => [d.holidayName, d.leaveType && `${d.leaveType} leave`, d.signInNote, d.signOutNote, d.managerNote && `Manager: ${d.managerNote}`, d.autoSignedOut && 'Auto signed out'].filter(Boolean).join('; ');

function SummaryBand({ s }) {
  return (
    <StatBand items={[
      { label: 'Attendance rate', value: s.attendanceRate === null ? '–' : `${s.attendanceRate}%`, sub: `${s.totalWorkingDays} working days` },
      { label: 'Days in', value: s.totalPresent },
      { label: 'Late', value: s.totalLate, tone: s.totalLate ? 'text-late' : 'text-ink', sub: s.lateMinutes ? `${fmtMins(s.lateMinutes)} total` : '' },
      { label: 'Absent', value: s.totalAbsent, tone: s.totalAbsent ? 'text-absent' : 'text-ink', sub: `${s.totalLeave} on leave` },
      { label: 'Hours worked', value: s.totalHours, sub: `${s.avgHours} average` },
    ]} />
  );
}

export default function Records() {
  const toast = useToast();
  const today = todayInTz();
  const [params, setParams] = useSearchParams();
  const [preset, setPreset] = useState(params.get('employeeId') ? 'month' : 'today');
  const [custom, setCustom] = useState({ start: `${today.slice(0, 7)}-01`, end: today });
  const [employeeId, setEmployeeId] = useState(params.get('employeeId') || '');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [editor, setEditor] = useState(null);
  const [exporting, setExporting] = useState(false);

  const people = useApi('/users', { status: 'active' });
  const depts = useApi('/users/departments');
  const range = preset === 'custom' ? custom : rangeFor(preset, today);
  const query = useMemo(() => ({
    start: range.start, end: range.end, employeeId: employeeId || undefined, role: role || undefined, department: department || undefined,
  }), [range.start, range.end, employeeId, role, department]);
  const { data, loading, error, reload } = useApi('/attendance/records', query);

  useEffect(() => {
    const next = new URLSearchParams();
    if (employeeId) next.set('employeeId', employeeId);
    setParams(next, { replace: true });
  }, [employeeId, setParams]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile('/attendance/export', query, `attendance_${range.start}_to_${range.end}.csv`);
    } catch (e) {
      toast(errMsg(e, 'Export failed'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const openEditor = (userId, d) => setEditor({
    userId, date: d.date, signInTime: d.signInTime, signOutTime: d.signOutTime, managerNote: d.managerNote, recordId: d.recordId,
  });

  const canEdit = (d) => d.date <= today && d.status !== 'none';

  return (
    <div>
      <PageHeader title="Records" description="Look up attendance for anyone over any period, correct mistakes and export to CSV."
        actions={<>
          <Button variant="secondary" icon={Plus} onClick={() => setEditor({ userId: employeeId || '' })}>Add attendance</Button>
          <Button variant="secondary" icon={Download} loading={exporting} onClick={exportCsv}>Export CSV</Button>
        </>} />

      <div className="mb-6 rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Person" className="w-full sm:w-56">
            {(id) => (
              <Select id={id} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">Everyone</option>
                {(people.data || []).map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
              </Select>
            )}
          </Field>
          {!employeeId && (
            <>
              <Field label="Role" className="w-[calc(50%-6px)] sm:w-36">
                {(id) => (
                  <Select id={id} value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="">All roles</option><option value="employee">Employees</option><option value="developer">Developers</option><option value="manager">Managers</option>
                  </Select>
                )}
              </Field>
              <Field label="Department" className="w-[calc(50%-6px)] sm:w-48">
                {(id) => (
                  <Select id={id} value={department} onChange={(e) => setDepartment(e.target.value)}>
                    <option value="">All departments</option>
                    {(depts.data || []).map((d) => <option key={d} value={d}>{d}</option>)}
                  </Select>
                )}
              </Field>
            </>
          )}
          <div className="w-full overflow-x-auto sm:w-auto">
            <p className="mb-1.5 text-[13px] font-medium text-ink">Period</p>
            <Segmented value={preset} onChange={setPreset} options={[
              { value: 'today', label: 'Today' }, { value: 'week', label: 'This week' }, { value: 'month', label: 'This month' },
              { value: 'last', label: 'Last month' }, { value: 'custom', label: 'Custom' },
            ]} />
          </div>
          {preset === 'custom' && (
            <div className="flex items-end gap-2">
              <Field label="From">{(id) => <Input id={id} type="date" value={custom.start} max={custom.end} onChange={(e) => setCustom({ ...custom, start: e.target.value })} />}</Field>
              <Field label="To">{(id) => <Input id={id} type="date" value={custom.end} min={custom.start} onChange={(e) => setCustom({ ...custom, end: e.target.value })} />}</Field>
            </div>
          )}
        </div>
      </div>

      <ErrorNote onRetry={reload}>{error}</ErrorNote>
      {loading && !data ? <Spinner /> : !data ? null : data.mode === 'single' ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Avatar name={data.employee.name} />
            <div>
              <p className="text-base font-semibold text-ink">{data.employee.name}</p>
              <p className="text-[13px] text-muted">{[data.employee.designation, data.employee.department].filter(Boolean).join(', ') || data.employee.role}, {fmtDay(data.start)} to {fmtDay(data.end)}</p>
            </div>
          </div>
          <SummaryBand s={data.summary} />
          <Panel flush>
            <Table head={['Date', 'Status', 'In', 'Out', 'Worked', 'Notes', '']}>
              {data.records.filter((d) => d.status !== 'none').reverse().map((d) => (
                <tr key={d.date} className={cx('group', d.status === 'weekend' && 'text-faint')}>
                  <td className="px-5 py-2.5 text-ink">{fmtDay(d.date)}</td>
                  <td className="px-5 py-2.5"><StatusPill status={d.status}>{d.status === 'late' ? `Late ${fmtMins(d.lateMinutes)}` : undefined}</StatusPill></td>
                  <td className="px-5 py-2.5 text-muted tabular">{fmtTime(d.signInTime)}</td>
                  <td className="px-5 py-2.5 text-muted tabular">{d.open ? 'Still in' : fmtTime(d.signOutTime)}</td>
                  <td className="px-5 py-2.5 text-ink tabular">{d.workedMinutes ? fmtMins(d.workedMinutes) : '–'}</td>
                  <td className="max-w-xs truncate px-5 py-2.5 text-[13px] text-muted" title={notesOf(d)}>{notesOf(d)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {canEdit(d) && <IconButton icon={d.recordId ? Pencil : Plus} label={d.recordId ? 'Correct' : 'Add attendance'} onClick={() => openEditor(data.employee.id, d)} className="opacity-60 group-hover:opacity-100" />}
                  </td>
                </tr>
              ))}
            </Table>
          </Panel>
        </div>
      ) : data.mode === 'day' ? (
        <div className="space-y-6">
          <SummaryBand s={data.summary} />
          <Panel title={fmtDay(data.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} flush>
            {data.records.length ? (
              <Table head={['Person', 'Status', 'In', 'Out', 'Worked', 'Notes', '']}>
                {data.records.map((r) => (
                  <tr key={r._id} className="group">
                    <td className="px-5 py-2.5">
                      <button onClick={() => { setEmployeeId(r._id); setPreset('month'); }} className="flex items-center gap-2.5 text-left hover:underline">
                        <Avatar name={r.name} size="sm" /><span className="font-medium text-ink">{r.name}</span><RoleTag role={r.role} />
                      </button>
                    </td>
                    <td className="px-5 py-2.5"><StatusPill status={r.status}>{r.status === 'late' ? `Late ${fmtMins(r.lateMinutes)}` : undefined}</StatusPill></td>
                    <td className="px-5 py-2.5 text-muted tabular">{fmtTime(r.signInTime)}</td>
                    <td className="px-5 py-2.5 text-muted tabular">{r.open ? 'Still in' : fmtTime(r.signOutTime)}</td>
                    <td className="px-5 py-2.5 text-ink tabular">{r.workedMinutes ? fmtMins(r.workedMinutes) : '–'}</td>
                    <td className="max-w-xs truncate px-5 py-2.5 text-[13px] text-muted" title={notesOf(r)}>{notesOf(r)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {canEdit(r) && <IconButton icon={r.recordId ? Pencil : Plus} label={r.recordId ? 'Correct' : 'Add attendance'} onClick={() => openEditor(r._id, r)} className="opacity-60 group-hover:opacity-100" />}
                    </td>
                  </tr>
                ))}
              </Table>
            ) : <Empty title="No one matches these filters" />}
          </Panel>
        </div>
      ) : (
        <Panel title={`${fmtDay(data.start)} to ${fmtDay(data.end)}`} description="Click a square to correct or add that day." flush
          actions={<StatusLegend keys={['present', 'late', 'half', 'leave', 'absent']} />}>
          {data.employees.length ? (
            <div className="overflow-x-auto border-t border-line">
              <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-[11px] text-faint">
                    <th className="sticky left-0 z-10 min-w-44 border-b border-line bg-surface px-5 py-2 text-left font-medium">Person</th>
                    {data.rows.map((r) => (
                      <th key={r.date} title={r.holiday || fmtDay(r.date)} className={cx('border-b border-line px-0.5 py-2 text-center font-medium tabular', r.date === today && 'text-ink')}>
                        <span className="block">{fmtDay(r.date, { weekday: 'narrow' })}</span>{Number(r.date.slice(8))}
                      </th>
                    ))}
                    {['In', 'Late', 'Absent', 'Hours', 'Rate'].map((h) => <th key={h} className="border-b border-l border-line px-3 py-2 text-right font-medium first-of-type:border-l">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map((emp) => (
                    <tr key={emp.id} className="group">
                      <td className="sticky left-0 z-10 border-b border-line bg-surface px-5 py-1.5 group-hover:bg-sunken">
                        <button onClick={() => { setEmployeeId(emp.id); }} className="flex items-center gap-2 text-left hover:underline">
                          <span className="truncate font-medium text-ink">{emp.name}</span>
                        </button>
                      </td>
                      {data.rows.map((r) => {
                        const c = r.cells[emp.id];
                        const s = STATUS[c.s];
                        const clickable = r.date <= today && c.s !== 'none';
                        return (
                          <td key={r.date} className="border-b border-line px-0.5 py-1.5 text-center group-hover:bg-sunken">
                            <button disabled={!clickable}
                              onClick={() => openEditor(emp.id, { date: r.date, recordId: c.id, signInTime: c.in, signOutTime: c.out, managerNote: c.n })}
                              title={`${emp.name}, ${fmtDay(r.date)}: ${s.label || 'no record'}${c.h ? `, ${fmtMins(c.h)}` : ''}${r.holiday ? ` (${r.holiday})` : ''}`}
                              className={cx('inline-flex size-6 items-center justify-center rounded text-[10px] font-semibold', s.bg, s.fg, clickable && 'hover:ring-2 hover:ring-ink/40', c.s === 'weekend' && 'opacity-60')}>
                              {c.s === 'present' ? '' : s.short}
                            </button>
                          </td>
                        );
                      })}
                      <td className="border-b border-l border-line px-3 py-1.5 text-right text-ink tabular group-hover:bg-sunken">{emp.summary.totalPresent}</td>
                      <td className={cx('border-b border-line px-3 py-1.5 text-right tabular group-hover:bg-sunken', emp.summary.totalLate ? 'text-late' : 'text-faint')}>{emp.summary.totalLate}</td>
                      <td className={cx('border-b border-line px-3 py-1.5 text-right tabular group-hover:bg-sunken', emp.summary.totalAbsent ? 'text-absent' : 'text-faint')}>{emp.summary.totalAbsent}</td>
                      <td className="border-b border-line px-3 py-1.5 text-right text-ink tabular group-hover:bg-sunken">{emp.summary.totalHours}</td>
                      <td className="border-b border-line px-3 py-1.5 text-right font-medium text-ink tabular group-hover:bg-sunken">{emp.summary.attendanceRate === null ? '–' : `${emp.summary.attendanceRate}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty icon={CalendarRange} title="No one matches these filters" />}
        </Panel>
      )}

      <AttendanceEditor open={!!editor} onClose={() => setEditor(null)} people={people.data || []} initial={editor}
        onSaved={() => reload({ quiet: true })} />
    </div>
  );
}
