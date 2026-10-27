import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, UserX, UserCheck, CalendarDays, Users } from 'lucide-react';
import API, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../lib/hooks';
import { relTime, todayInTz } from '../../lib/format';
import { ROLES } from '../../lib/status';
import { Avatar, Button, ConfirmModal, Empty, ErrorNote, Field, IconButton, Input, Modal, PageHeader, Panel, RoleTag, Segmented, Select, Spinner, Table, cx } from '../../components/ui';

const blank = { name: '', email: '', password: '', role: 'employee', employeeCode: '', department: '', designation: '', phone: '', joinDate: '' };

function PersonForm({ open, onClose, editing, departments, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) { setErr(''); setForm(editing ? { ...blank, ...editing, password: '' } : { ...blank, joinDate: todayInTz() }); }
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.keys(blank).map((k) => [k, form[k] ?? '']));
      if (editing && !payload.password) delete payload.password;
      if (editing) await API.put(`/users/${editing._id}`, payload);
      else await API.post('/users', payload);
      toast(editing ? `${form.name} updated` : `${form.name} added. Share their email and password with them.`);
      onSaved();
      onClose();
    } catch (er) {
      setErr(errMsg(er));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} wide title={editing ? `Edit ${editing.name}` : 'Add a person'}
      description={editing ? 'Leave the password empty to keep the current one.' : 'They sign in with this email and password.'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="person-form" loading={saving}>{editing ? 'Save changes' : 'Add person'}</Button></>}>
      <form id="person-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">{(id) => <Input id={id} value={form.name} onChange={set('name')} required />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" value={form.email} onChange={set('email')} required />}</Field>
        <Field label={editing ? 'New password' : 'Password'} hint="At least 6 characters">
          {(id) => <Input id={id} type="text" autoComplete="new-password" value={form.password} onChange={set('password')} required={!editing} minLength={6} placeholder={editing ? 'Unchanged' : ''} />}
        </Field>
        <Field label="Role" hint="Managers can see the whole team and change settings.">
          {(id) => <Select id={id} value={form.role} onChange={set('role')}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}
        </Field>
        <Field label="Department">
          {(id) => (<>
            <Input id={id} list="dept-list" value={form.department} onChange={set('department')} placeholder="e.g. Engineering" />
            <datalist id="dept-list">{departments.map((d) => <option key={d} value={d} />)}</datalist>
          </>)}
        </Field>
        <Field label="Job title">{(id) => <Input id={id} value={form.designation} onChange={set('designation')} placeholder="e.g. Accountant" />}</Field>
        <Field label="Employee code">{(id) => <Input id={id} value={form.employeeCode} onChange={set('employeeCode')} placeholder="EMP-007" />}</Field>
        <Field label="Phone">{(id) => <Input id={id} type="tel" value={form.phone} onChange={set('phone')} />}</Field>
        <Field label="Joining date" hint="Days before this are not counted as absent." className="sm:col-span-2">
          {(id) => <Input id={id} type="date" value={form.joinDate} onChange={set('joinDate')} className="sm:w-1/2" />}
        </Field>
        {err && <p className="text-sm text-absent sm:col-span-2" role="alert">{err}</p>}
      </form>
    </Modal>
  );
}

export default function People() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('active');
  const [form, setForm] = useState({ open: false, editing: null });
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useApi('/users');
  const depts = useApi('/users/departments');

  const list = useMemo(() => (data || []).filter((u) => {
    if (role && u.role !== role) return false;
    if (status === 'active' && !u.isActive) return false;
    if (status === 'inactive' && u.isActive) return false;
    const n = q.trim().toLowerCase();
    return !n || [u.name, u.email, u.employeeCode, u.department, u.designation].some((v) => (v || '').toLowerCase().includes(n));
  }), [data, q, role, status]);

  const counts = useMemo(() => ({
    active: (data || []).filter((u) => u.isActive).length,
    inactive: (data || []).filter((u) => !u.isActive).length,
  }), [data]);

  const runConfirm = async () => {
    setBusy(true);
    try {
      if (confirm.kind === 'delete') {
        await API.delete(`/users/${confirm.user._id}`);
        toast(`${confirm.user.name} deleted`);
      } else {
        await API.patch(`/users/${confirm.user._id}/active`, { isActive: confirm.kind === 'activate' });
        toast(`${confirm.user.name} ${confirm.kind === 'activate' ? 'reactivated' : 'deactivated'}`);
      }
      reload({ quiet: true });
      setConfirm(null);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmCopy = {
    delete: ['Delete permanently?', (u) => `${u.name} and all of their attendance and leave history will be removed. This cannot be undone. To keep their records, deactivate them instead.`, 'Delete'],
    deactivate: ['Deactivate this account?', (u) => `${u.name} won't be able to sign in and won't appear on the team board. Their history is kept and you can reactivate them later.`, 'Deactivate'],
    activate: ['Reactivate this account?', (u) => `${u.name} will be able to sign in again.`, 'Reactivate'],
  };

  return (
    <div>
      <PageHeader title="People" description="Add team members, change roles, reset passwords and deactivate people who have left."
        actions={<Button icon={Plus} onClick={() => setForm({ open: true, editing: null })}>Add person</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, department" className="pl-9" aria-label="Search people" />
        </div>
        <Segmented value={status} onChange={setStatus} options={[
          { value: 'active', label: 'Active', count: counts.active }, { value: 'inactive', label: 'Deactivated', count: counts.inactive }, { value: '', label: 'All' },
        ]} />
        <Select value={role} onChange={(e) => setRole(e.target.value)} className="!w-40" aria-label="Filter by role">
          <option value="">All roles</option>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}s</option>)}
        </Select>
      </div>

      <ErrorNote onRetry={reload}>{error}</ErrorNote>
      <Panel flush>
        {loading && !data ? <Spinner /> : list.length ? (
          <Table head={['Person', 'Code', 'Department', 'Role', 'Last sign-in', { label: '', className: 'w-1' }]}>
            {list.map((u) => (
              <tr key={u._id} className={cx('group', !u.isActive && 'opacity-60')}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} size="sm" />
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{u.name}{String(u._id) === String(me._id) && <span className="ml-1.5 text-xs font-normal text-faint">(you)</span>}{!u.isActive && <span className="ml-1.5 text-xs font-normal text-absent">deactivated</span>}</p>
                      <p className="text-xs text-faint">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-muted tabular">{u.employeeCode || '–'}</td>
                <td className="px-5 py-3"><p className="text-ink">{u.department || '–'}</p><p className="text-xs text-faint">{u.designation}</p></td>
                <td className="px-5 py-3"><RoleTag role={u.role} /></td>
                <td className="px-5 py-3 text-[13px] text-muted">{u.lastLoginAt ? relTime(u.lastLoginAt) : 'Never'}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-0.5">
                    <Link to={`/team/records?employeeId=${u._id}`}><IconButton icon={CalendarDays} label="View attendance" /></Link>
                    <IconButton icon={Pencil} label="Edit" onClick={() => setForm({ open: true, editing: u })} />
                    {String(u._id) !== String(me._id) && (u.isActive
                      ? <IconButton icon={UserX} label="Deactivate" onClick={() => setConfirm({ kind: 'deactivate', user: u })} />
                      : <IconButton icon={UserCheck} label="Reactivate" onClick={() => setConfirm({ kind: 'activate', user: u })} />)}
                    {String(u._id) !== String(me._id) && <IconButton icon={Trash2} label="Delete" onClick={() => setConfirm({ kind: 'delete', user: u })} className="hover:!bg-absent-soft hover:!text-absent" />}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty icon={Users} title={data?.length ? 'No one matches your search' : 'No people yet'}
            action={!data?.length && <Button size="sm" onClick={() => setForm({ open: true, editing: null })}>Add the first person</Button>}>
            {data?.length ? 'Try a different name or clear the filters.' : 'Add your team so they can start signing in.'}
          </Empty>
        )}
      </Panel>

      <PersonForm open={form.open} editing={form.editing} departments={depts.data || []} onClose={() => setForm({ open: false, editing: null })}
        onSaved={() => { reload({ quiet: true }); depts.reload({ quiet: true }); }} />
      <ConfirmModal open={!!confirm} loading={busy} danger={confirm?.kind !== 'activate'}
        title={confirm ? confirmCopy[confirm.kind][0] : ''} message={confirm ? confirmCopy[confirm.kind][1](confirm.user) : ''}
        confirmLabel={confirm ? confirmCopy[confirm.kind][2] : ''} onConfirm={runConfirm} onCancel={() => setConfirm(null)} />
    </div>
  );
}
