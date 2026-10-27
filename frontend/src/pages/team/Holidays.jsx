import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarHeart, Trash2 } from 'lucide-react';
import API, { errMsg } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../lib/hooks';
import { fmtDay, todayInTz } from '../../lib/format';
import { Button, Empty, ErrorNote, Field, IconButton, Input, PageHeader, Panel, Spinner, cx } from '../../components/ui';

export default function Holidays() {
  const toast = useToast();
  const today = todayInTz();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const { data, loading, error, reload } = useApi('/holidays', { year });
  const [form, setForm] = useState({ date: '', name: '' });
  const [busy, setBusy] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await API.post('/holidays', form);
      toast(`${form.name} added`);
      setForm({ date: '', name: '' });
      if (Number(form.date.slice(0, 4)) !== year) setYear(Number(form.date.slice(0, 4))); else reload({ quiet: true });
    } catch (er) {
      toast(errMsg(er), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (h) => {
    try {
      await API.delete(`/holidays/${h._id}`);
      toast(`${h.name} removed`);
      reload({ quiet: true });
    } catch (er) {
      toast(errMsg(er), 'error');
    }
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="Holidays" description="Nobody is marked absent on these days, and they don't count against leave." />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title={`${year}`} flush actions={<div className="flex gap-1">
          <IconButton icon={ChevronLeft} label="Previous year" onClick={() => setYear(year - 1)} />
          <IconButton icon={ChevronRight} label="Next year" onClick={() => setYear(year + 1)} />
        </div>}>
          <ErrorNote onRetry={reload}>{error}</ErrorNote>
          {loading && !data ? <Spinner /> : data?.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {data.map((h) => (
                <li key={h._id} className={cx('flex items-center gap-4 px-5 py-3', h.date < today && 'opacity-55')}>
                  <div className="w-12 text-center">
                    <p className="text-[11px] font-medium text-faint">{fmtDay(h.date, { month: 'short' })}</p>
                    <p className="text-lg leading-tight font-semibold text-ink tabular">{Number(h.date.slice(8))}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{h.name}</p>
                    <p className="text-xs text-muted">{fmtDay(h.date, { weekday: 'long' })}</p>
                  </div>
                  <IconButton icon={Trash2} label={`Remove ${h.name}`} onClick={() => remove(h)} className="hover:!bg-absent-soft hover:!text-absent" />
                </li>
              ))}
            </ul>
          ) : <Empty icon={CalendarHeart} title={`No holidays in ${year}`}>Add public holidays and company days off so they aren't counted as absences.</Empty>}
        </Panel>
        <Panel title="Add a holiday" className="self-start">
          <form onSubmit={add} className="space-y-4">
            <Field label="Date">{(id) => <Input id={id} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />}</Field>
            <Field label="Name">{(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Independence Day" maxLength={80} />}</Field>
            <Button type="submit" loading={busy} className="w-full">Add holiday</Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
