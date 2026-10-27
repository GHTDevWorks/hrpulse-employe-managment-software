import { useState } from 'react';
import { History } from 'lucide-react';
import { useApi } from '../../lib/hooks';
import { dayOf, fmtDay, fmtTime } from '../../lib/format';
import { Empty, ErrorNote, PageHeader, Panel, Segmented, Spinner } from '../../components/ui';

const VERBS = {
  'user.create': 'added', 'user.update': 'updated', 'user.delete': 'deleted', 'user.activate': 'reactivated', 'user.deactivate': 'deactivated',
  'attendance.add': 'added attendance for', 'attendance.edit': 'corrected attendance for', 'attendance.delete': 'deleted an attendance record of',
  'leave.request': 'requested leave', 'leave.approve': 'approved leave for', 'leave.reject': 'declined leave for', 'leave.cancel': 'cancelled leave',
  'holiday.add': 'added the holiday', 'holiday.delete': 'removed the holiday', 'settings.update': 'changed settings',
  'announcement.post': 'posted the notice', 'announcement.delete': 'removed the notice', 'password.change': 'changed their password',
};
const SELF = new Set(['leave.request', 'leave.cancel', 'password.change', 'settings.update']);

export const describeAction = (a) => {
  const verb = VERBS[a.action] || a.action;
  const target = SELF.has(a.action) ? '' : ` ${a.targetName}`;
  return `${a.actorName} ${verb}${target}${a.details ? `: ${a.details}` : ''}`;
};

export default function Activity() {
  const [kind, setKind] = useState('');
  const { data, loading, error, reload } = useApi('/audit', { limit: 300, action: kind || undefined });

  const groups = {};
  for (const a of data || []) {
    const day = dayOf(a.createdAt);
    (groups[day] ||= []).push(a);
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Activity log" description="Every change to people, attendance, leave and settings, newest first." />
      <Segmented className="mb-5" value={kind} onChange={setKind} options={[
        { value: '', label: 'Everything' }, { value: 'attendance', label: 'Attendance' }, { value: 'leave', label: 'Leave' },
        { value: 'user', label: 'People' }, { value: 'settings', label: 'Settings' },
      ]} />
      <ErrorNote onRetry={reload}>{error}</ErrorNote>
      {loading && !data ? <Spinner /> : !data?.length ? (
        <Panel><Empty icon={History} title="Nothing recorded yet">Changes made by managers and leave requests will appear here.</Empty></Panel>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([day, items]) => (
            <Panel key={day} title={fmtDay(day, { weekday: 'long', day: 'numeric', month: 'long' })} flush>
              <ol className="divide-y divide-line border-t border-line">
                {items.map((a) => (
                  <li key={a._id} className="flex gap-4 px-5 py-3">
                    <span className="w-12 shrink-0 text-xs text-faint tabular">{fmtTime(a.createdAt)}</span>
                    <span className="text-sm text-ink">{describeAction(a)}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
