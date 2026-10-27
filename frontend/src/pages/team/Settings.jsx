import { useEffect, useState } from 'react';
import API, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../lib/hooks';
import { setTimezone } from '../../lib/format';
import { Button, ErrorNote, Field, Input, PageHeader, Panel, Select, Spinner, cx } from '../../components/ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ZONES = (() => {
  try { return Intl.supportedValuesOf('timeZone'); } catch { return ['Asia/Karachi', 'Asia/Dubai', 'Asia/Kolkata', 'Europe/London', 'America/New_York', 'UTC']; }
})();

export default function SettingsPage() {
  const toast = useToast();
  const { user, updateUser } = useAuth();
  const { data, loading, error, reload } = useApi('/settings');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setForm(JSON.parse(JSON.stringify(data))); }, [data]);
  if (loading && !form) return <Spinner />;
  if (!form) return <ErrorNote onRetry={reload}>{error}</ErrorNote>;

  const set = (k, num) => (e) => setForm({ ...form, [k]: num ? Number(e.target.value) : e.target.value });
  const setAllow = (k) => (e) => setForm({ ...form, leaveAllowance: { ...form.leaveAllowance, [k]: Number(e.target.value) } });
  const toggleDay = (d) => setForm({ ...form, weekendDays: form.weekendDays.includes(d) ? form.weekendDays.filter((x) => x !== d) : [...form.weekendDays, d] });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: s } = await API.put('/settings', form);
      setTimezone(s.timezone);
      updateUser({ ...user, timezone: s.timezone, companyName: s.companyName });
      toast('Settings saved. New rules apply from the next sign-in.');
    } catch (er) {
      toast(errMsg(er), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="max-w-3xl">
      <PageHeader title="Settings" description="Working hours and rules used to work out late arrivals, short days and leave."
        actions={<Button type="submit" loading={saving}>Save settings</Button>} />
      <div className="space-y-6">
        <Panel title="Company">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name">{(id) => <Input id={id} value={form.companyName} onChange={set('companyName')} />}</Field>
            <Field label="Timezone" hint="All times are recorded and shown in this zone.">
              {(id) => <Select id={id} value={form.timezone} onChange={set('timezone')}>{ZONES.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}</Select>}
            </Field>
          </div>
        </Panel>

        <Panel title="Working hours">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Day starts">{(id) => <Input id={id} type="time" value={form.workStart} onChange={set('workStart')} required />}</Field>
            <Field label="Day ends">{(id) => <Input id={id} type="time" value={form.workEnd} onChange={set('workEnd')} required />}</Field>
            <Field label="Grace period" hint="Minutes after start before it counts as late">{(id) => <Input id={id} type="number" min={0} max={240} value={form.graceMinutes} onChange={set('graceMinutes', true)} />}</Field>
            <Field label="Full day" hint="Hours">{(id) => <Input id={id} type="number" min={1} max={24} step={0.5} value={form.fullDayHours} onChange={set('fullDayHours', true)} />}</Field>
            <Field label="Short day below" hint="Hours worked under this is a short day">{(id) => <Input id={id} type="number" min={0} max={24} step={0.5} value={form.halfDayHours} onChange={set('halfDayHours', true)} />}</Field>
            <Field label="Auto sign-out after" hint="Hours, for people who forget">{(id) => <Input id={id} type="number" min={1} max={24} value={form.autoSignOutHours} onChange={set('autoSignOutHours', true)} />}</Field>
          </div>
          <div className="mt-5">
            <p className="mb-2 text-[13px] font-medium text-ink">Weekend days</p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d, i) => {
                const on = form.weekendDays.includes(i);
                return (
                  <button type="button" key={d} onClick={() => toggleDay(i)} aria-pressed={on}
                    className={cx('h-9 w-12 rounded-lg border text-[13px] font-medium transition', on ? 'border-ink bg-ink text-paper' : 'border-line-strong text-muted hover:text-ink')}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </Panel>

        <Panel title="Yearly leave allowance" description="Days per person per calendar year. Unpaid leave has no limit.">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Annual">{(id) => <Input id={id} type="number" min={0} value={form.leaveAllowance.annual} onChange={setAllow('annual')} />}</Field>
            <Field label="Sick">{(id) => <Input id={id} type="number" min={0} value={form.leaveAllowance.sick} onChange={setAllow('sick')} />}</Field>
            <Field label="Casual">{(id) => <Input id={id} type="number" min={0} value={form.leaveAllowance.casual} onChange={setAllow('casual')} />}</Field>
          </div>
        </Panel>
      </div>
    </form>
  );
}
