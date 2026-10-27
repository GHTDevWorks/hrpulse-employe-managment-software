import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import API, { errMsg } from '../api/client';
import { useToast } from '../context/ToastContext';
import { fmtTime, todayInTz } from '../lib/format';
import { Button, Field, Input, Modal, Select } from './ui';

const toHHMM = (iso) => (iso ? fmtTime(iso) : '');

/** Manager tool: add a missing day or correct sign-in/out times. */
export default function AttendanceEditor({ open, onClose, people, initial, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!open) return;
    setErr('');
    setForm({
      userId: initial?.userId || '',
      date: initial?.date || todayInTz(),
      signIn: toHHMM(initial?.signInTime) || '09:00',
      signOut: toHHMM(initial?.signOutTime),
      managerNote: initial?.managerNote || '',
    });
  }, [open, initial]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy('save');
    try {
      await API.post('/attendance/manual', form);
      toast(initial?.recordId ? 'Attendance corrected' : 'Attendance added');
      onSaved?.();
      onClose();
    } catch (er) {
      setErr(errMsg(er));
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    setBusy('delete');
    try {
      await API.delete(`/attendance/${initial.recordId}`);
      toast('Attendance record deleted');
      onSaved?.();
      onClose();
    } catch (er) {
      setErr(errMsg(er));
    } finally {
      setBusy('');
    }
  };

  const editing = !!initial?.recordId;
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Correct attendance' : 'Add attendance'}
      description="Times are in the company timezone. Changes are recorded in the activity log."
      footer={<>
        {editing && <Button variant="dangerGhost" icon={Trash2} loading={busy === 'delete'} onClick={remove} className="mr-auto">Delete record</Button>}
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="att-form" loading={busy === 'save'}>{editing ? 'Save correction' : 'Add record'}</Button>
      </>}>
      <form id="att-form" onSubmit={save} className="space-y-4">
        <Field label="Person">
          {(id) => (
            <Select id={id} value={form.userId || ''} onChange={set('userId')} required disabled={!!initial?.userId}>
              <option value="" disabled>Choose someone</option>
              {people.map((p) => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Date">{(id) => <Input id={id} type="date" value={form.date || ''} max={todayInTz()} onChange={set('date')} required disabled={editing} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Signed in">{(id) => <Input id={id} type="time" value={form.signIn || ''} onChange={set('signIn')} required />}</Field>
          <Field label="Signed out" hint="Leave empty if still in">{(id) => <Input id={id} type="time" value={form.signOut || ''} onChange={set('signOut')} />}</Field>
        </div>
        <Field label="Reason for change" hint="Shown to the employee on their history.">
          {(id) => <Input id={id} value={form.managerNote || ''} onChange={set('managerNote')} maxLength={300} placeholder="e.g. Forgot to sign out" />}
        </Field>
        {err && <p className="text-sm text-absent" role="alert">{err}</p>}
      </form>
    </Modal>
  );
}
