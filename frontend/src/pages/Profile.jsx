import { useState } from 'react';
import API, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fmtDay, fmtDateTime } from '../lib/format';
import { ROLES } from '../lib/status';
import { Avatar, Button, Field, Input, PageHeader, Panel } from '../components/ui';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [info, setInfo] = useState({ name: user.name, phone: user.phone || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwErr, setPwErr] = useState('');
  const [busy, setBusy] = useState('');

  const saveInfo = async (e) => {
    e.preventDefault();
    setBusy('info');
    try {
      const { data } = await API.put('/auth/me', info);
      updateUser(data);
      toast('Profile saved');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy('');
    }
  };

  const savePw = async (e) => {
    e.preventDefault();
    setPwErr('');
    if (pw.newPassword !== pw.confirm) return setPwErr('The new passwords do not match');
    if (pw.newPassword.length < 6) return setPwErr('Use at least 6 characters');
    setBusy('pw');
    try {
      await API.put('/auth/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      toast('Password changed');
    } catch (err) {
      setPwErr(errMsg(err));
    } finally {
      setBusy('');
    }
    return undefined;
  };

  const facts = [
    ['Email', user.email], ['Role', ROLES[user.role]], ['Employee code', user.employeeCode], ['Department', user.department],
    ['Designation', user.designation], ['Joined', user.joinDate ? fmtDay(user.joinDate, { day: 'numeric', month: 'long', year: 'numeric' }) : ''],
    ['Last sign-in', user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : ''],
  ].filter(([, v]) => v);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Profile" description="Your contact details and password. Your manager manages your role and department." />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel>
          <div className="flex items-center gap-4">
            <Avatar name={user.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink">{user.name}</p>
              <p className="truncate text-sm text-muted">{user.designation || ROLES[user.role]}</p>
            </div>
          </div>
          <dl className="mt-6 space-y-3 border-t border-line pt-4 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="truncate text-right text-ink">{v}</dd></div>
            ))}
          </dl>
        </Panel>
        <div className="space-y-6">
          <Panel title="Contact details">
            <form onSubmit={saveInfo} className="space-y-4">
              <Field label="Full name">{(id) => <Input id={id} value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} required />}</Field>
              <Field label="Phone">{(id) => <Input id={id} type="tel" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} placeholder="+92 300 0000000" />}</Field>
              <Button type="submit" loading={busy === 'info'}>Save details</Button>
            </form>
          </Panel>
          <Panel title="Change password">
            <form onSubmit={savePw} className="space-y-4">
              <Field label="Current password">{(id) => <Input id={id} type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />}</Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New password" hint="At least 6 characters">{(id) => <Input id={id} type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required />}</Field>
                <Field label="Repeat new password">{(id) => <Input id={id} type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />}</Field>
              </div>
              {pwErr && <p className="text-sm text-absent" role="alert">{pwErr}</p>}
              <Button type="submit" variant="secondary" loading={busy === 'pw'}>Change password</Button>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}
