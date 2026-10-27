import { useState } from 'react';
import { Megaphone, Pin, Trash2 } from 'lucide-react';
import API, { errMsg } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../lib/hooks';
import { fmtDay, relTime, todayInTz } from '../../lib/format';
import { Button, Empty, ErrorNote, Field, IconButton, Input, PageHeader, Panel, Spinner, Textarea, cx } from '../../components/ui';

export default function Notices() {
  const toast = useToast();
  const today = todayInTz();
  const { data, loading, error, reload } = useApi('/announcements', { all: 1 });
  const [form, setForm] = useState({ title: '', body: '', pinned: false, expiresOn: '' });
  const [busy, setBusy] = useState(false);

  const post = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await API.post('/announcements', form);
      toast('Notice posted');
      setForm({ title: '', body: '', pinned: false, expiresOn: '' });
      reload({ quiet: true });
    } catch (er) {
      toast(errMsg(er), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (n) => {
    try {
      await API.delete(`/announcements/${n._id}`);
      toast('Notice removed');
      reload({ quiet: true });
    } catch (er) {
      toast(errMsg(er), 'error');
    }
  };

  return (
    <div className="max-w-5xl">
      <PageHeader title="Notices" description="Short messages shown to everyone on their My day page." />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel title="Post a notice" className="self-start">
          <form onSubmit={post} className="space-y-4">
            <Field label="Title">{(id) => <Input id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={120} />}</Field>
            <Field label="Message" hint="Optional">{(id) => <Textarea id={id} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={1000} />}</Field>
            <Field label="Hide after" hint="Leave empty to keep it up until you remove it.">
              {(id) => <Input id={id} type="date" min={today} value={form.expiresOn} onChange={(e) => setForm({ ...form, expiresOn: e.target.value })} />}
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="size-4 accent-[var(--accent)]" />
              Pin to the top
            </label>
            <Button type="submit" loading={busy} className="w-full">Post notice</Button>
          </form>
        </Panel>
        <Panel title="Posted" flush>
          <ErrorNote onRetry={reload}>{error}</ErrorNote>
          {loading && !data ? <Spinner /> : data?.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {data.map((n) => {
                const expired = n.expiresOn && n.expiresOn < today;
                return (
                  <li key={n._id} className={cx('flex gap-3 px-5 py-4', expired && 'opacity-55')}>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-ink">{n.pinned && <Pin className="size-3.5 text-late" />}{n.title}</p>
                      {n.body && <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-muted">{n.body}</p>}
                      <p className="mt-1.5 text-xs text-faint">
                        {n.author?.name || 'Manager'}, {relTime(n.createdAt)}
                        {n.expiresOn && (expired ? ', hidden since ' : ', shown until ') + fmtDay(n.expiresOn)}
                      </p>
                    </div>
                    <IconButton icon={Trash2} label="Remove notice" onClick={() => remove(n)} className="hover:!bg-absent-soft hover:!text-absent" />
                  </li>
                );
              })}
            </ul>
          ) : <Empty icon={Megaphone} title="No notices yet">Post office closures, deadlines or reminders here.</Empty>}
        </Panel>
      </div>
    </div>
  );
}
