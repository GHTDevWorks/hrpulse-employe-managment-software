import { useState } from 'react';
import { Inbox } from 'lucide-react';
import API, { errMsg } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../lib/hooks';
import { relTime } from '../../lib/format';
import { LEAVE_TYPES } from '../../lib/status';
import { Avatar, Button, Empty, ErrorNote, Field, Input, LeavePill, Modal, PageHeader, Panel, Segmented, Spinner } from '../../components/ui';
import { LeaveRange } from '../MyLeave';

export default function LeaveRequests() {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useApi('/leaves', { status: status || undefined });
  const [review, setReview] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const openReview = (leave, decision) => { setReview({ leave, decision }); setNote(''); };
  const submit = async () => {
    setBusy(true);
    try {
      await API.patch(`/leaves/${review.leave._id}/review`, { status: review.decision, note });
      toast(`${review.leave.user.name}'s leave ${review.decision === 'approved' ? 'approved' : 'declined'}`);
      setReview(null);
      reload({ quiet: true });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <PageHeader title="Leave requests" description="Approve or decline time off. Approved days show as leave instead of absent." />
      <Segmented className="mb-5" value={status} onChange={setStatus} options={[
        { value: 'pending', label: 'Waiting' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Declined' }, { value: '', label: 'All' },
      ]} />
      <ErrorNote onRetry={reload}>{error}</ErrorNote>
      <Panel flush>
        {loading && !data ? <Spinner /> : data?.length ? (
          <ul className="divide-y divide-line">
            {data.map((l) => (
              <li key={l._id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Avatar name={l.user.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm text-ink"><b className="font-semibold">{l.user.name}</b> asked for {l.days} day{l.days === 1 ? '' : 's'} of {LEAVE_TYPES[l.type].toLowerCase()} leave</p>
                    <p className="mt-0.5 text-[13px] text-muted tabular"><LeaveRange l={l} /><span className="text-faint">, requested {relTime(l.createdAt)}</span></p>
                    {l.reason && <p className="mt-1.5 text-[13px] text-ink">"{l.reason}"</p>}
                    {l.status !== 'pending' && l.reviewedBy && <p className="mt-1 text-xs text-faint">{l.status === 'approved' ? 'Approved' : l.status === 'rejected' ? 'Declined' : 'Updated'} by {l.reviewedBy.name}{l.reviewNote ? `: "${l.reviewNote}"` : ''}</p>}
                  </div>
                </div>
                {l.status === 'pending' ? (
                  <div className="flex gap-2 sm:shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => openReview(l, 'rejected')}>Decline</Button>
                    <Button size="sm" onClick={() => openReview(l, 'approved')}>Approve</Button>
                  </div>
                ) : <LeavePill status={l.status} />}
              </li>
            ))}
          </ul>
        ) : <Empty icon={Inbox} title={status === 'pending' ? 'No requests waiting' : 'No requests here'}>{status === 'pending' ? 'New leave requests from your team will appear here.' : 'Try another filter.'}</Empty>}
      </Panel>

      <Modal open={!!review} onClose={() => setReview(null)}
        title={review?.decision === 'approved' ? 'Approve leave' : 'Decline leave'}
        description={review ? `${review.leave.user.name}, ${LEAVE_TYPES[review.leave.type].toLowerCase()} leave for ${review.leave.days} day(s).` : ''}
        footer={<><Button variant="secondary" onClick={() => setReview(null)}>Cancel</Button>
          <Button variant={review?.decision === 'approved' ? 'primary' : 'danger'} loading={busy} onClick={submit}>{review?.decision === 'approved' ? 'Approve' : 'Decline'}</Button></>}>
        <Field label="Note to the employee" hint="Optional">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />}</Field>
      </Modal>
    </div>
  );
}
