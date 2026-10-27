import { useState } from 'react';
import { Plus, Plane } from 'lucide-react';
import API, { errMsg } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useApi } from '../lib/hooks';
import { fmtDay, todayInTz } from '../lib/format';
import { LEAVE_TYPES } from '../lib/status';
import { Button, ConfirmModal, Empty, ErrorNote, Field, Input, LeavePill, Modal, PageHeader, Panel, Select, Spinner, Table, Textarea, cx } from '../components/ui';

const BAR = { annual: 'bg-accent', sick: 'bg-absent', casual: 'bg-leave', unpaid: 'bg-off' };

export function LeaveRange({ l }) {
  return l.startDate === l.endDate ? fmtDay(l.startDate) : `${fmtDay(l.startDate, { day: 'numeric', month: 'short' })} – ${fmtDay(l.endDate)}`;
}

export default function MyLeave() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/leaves/mine');
  const today = todayInTz();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'annual', startDate: today, endDate: today, reason: '' });
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value, ...(k === 'startDate' && e.target.value > f.endDate ? { endDate: e.target.value } : {}) }));

  const submit = async (e) => {
    e.preventDefault();
    setFormErr('');
    setSaving(true);
    try {
      const { data: l } = await API.post('/leaves', form);
      toast(`Leave requested for ${l.days} working day${l.days === 1 ? '' : 's'}`);
      setOpen(false);
      setForm({ type: 'annual', startDate: today, endDate: today, reason: '' });
      reload({ quiet: true });
    } catch (err) {
      setFormErr(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    try {
      await API.patch(`/leaves/${cancelTarget._id}/cancel`);
      toast('Leave request cancelled');
      reload({ quiet: true });
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setCancelTarget(null);
    }
  };

  return (
    <div>
      <PageHeader title="My leave" description={`Your ${data?.year || ''} allowance and requests. Days are counted excluding weekends and holidays.`}
        actions={<Button icon={Plus} onClick={() => setOpen(true)}>Request leave</Button>} />
      <ErrorNote onRetry={reload}>{error}</ErrorNote>
      {loading && !data ? <Spinner /> : data && (
        <div className="space-y-6">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(data.balance).map(([type, b]) => (
              <div key={type} className="bg-surface px-5 py-4">
                <p className="text-[13px] text-muted">{LEAVE_TYPES[type]}</p>
                {b.allowance === null ? (
                  <>
                    <p className="mt-1 text-2xl font-semibold text-ink tabular">{b.used}<span className="ml-1 text-sm font-normal text-faint">days taken</span></p>
                    <p className="mt-2 text-xs text-faint">No limit; needs approval{b.pending ? `, ${b.pending} pending` : ''}</p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-2xl font-semibold text-ink tabular">{b.remaining}<span className="ml-1 text-sm font-normal text-faint">of {b.allowance} left</span></p>
                    <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-sunken">
                      <div className={BAR[type]} style={{ width: `${(b.used / Math.max(b.allowance, 1)) * 100}%` }} />
                      <div className={cx(BAR[type], 'opacity-40')} style={{ width: `${(b.pending / Math.max(b.allowance, 1)) * 100}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-faint">{b.used} used{b.pending ? `, ${b.pending} pending` : ''}</p>
                  </>
                )}
              </div>
            ))}
          </div>

          <Panel title="Requests" flush>
            {data.leaves.length ? (
              <Table head={['Type', 'Dates', 'Days', 'Status', 'Reason', '']}>
                {data.leaves.map((l) => (
                  <tr key={l._id} className="align-top">
                    <td className="px-5 py-3 font-medium text-ink">{LEAVE_TYPES[l.type]}</td>
                    <td className="px-5 py-3 text-ink tabular"><LeaveRange l={l} /></td>
                    <td className="px-5 py-3 text-muted tabular">{l.days}</td>
                    <td className="px-5 py-3">
                      <LeavePill status={l.status} />
                      {l.reviewNote && <p className="mt-1 max-w-48 text-xs whitespace-normal text-muted">"{l.reviewNote}"{l.reviewedBy?.name ? `, ${l.reviewedBy.name}` : ''}</p>}
                    </td>
                    <td className="max-w-64 px-5 py-3 text-[13px] whitespace-normal text-muted">{l.reason || '–'}</td>
                    <td className="px-5 py-3 text-right">
                      {(l.status === 'pending' || (l.status === 'approved' && l.startDate > today)) && (
                        <Button size="sm" variant="dangerGhost" onClick={() => setCancelTarget(l)}>Cancel</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty icon={Plane} title="No leave requests yet" action={<Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Request leave</Button>}>
                When you need time off, send a request here. Your manager will approve or decline it.
              </Empty>
            )}
          </Panel>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Request leave" description="Your manager will be notified on their dashboard."
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="leave-form" loading={saving}>Send request</Button></>}>
        <form id="leave-form" onSubmit={submit} className="space-y-4">
          <Field label="Type">
            {(id) => (
              <Select id={id} value={form.type} onChange={set('type')}>
                {Object.entries(LEAVE_TYPES).map(([k, v]) => {
                  const b = data?.balance?.[k];
                  return <option key={k} value={k}>{v}{b && b.remaining !== null ? ` (${b.remaining} left)` : ''}</option>;
                })}
              </Select>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">{(id) => <Input id={id} type="date" value={form.startDate} onChange={set('startDate')} required />}</Field>
            <Field label="To">{(id) => <Input id={id} type="date" value={form.endDate} min={form.startDate} onChange={set('endDate')} required />}</Field>
          </div>
          <Field label="Reason" hint="Optional, visible to your manager.">
            {(id) => <Textarea id={id} value={form.reason} onChange={set('reason')} maxLength={500} />}
          </Field>
          {formErr && <p className="text-sm text-absent" role="alert">{formErr}</p>}
        </form>
      </Modal>

      <ConfirmModal open={!!cancelTarget} title="Cancel this leave request?" confirmLabel="Cancel request"
        message={cancelTarget ? `${LEAVE_TYPES[cancelTarget.type]} leave for ${cancelTarget.days} day(s) will be withdrawn and the days returned to your balance.` : ''}
        onConfirm={cancel} onCancel={() => setCancelTarget(null)} />
    </div>
  );
}
