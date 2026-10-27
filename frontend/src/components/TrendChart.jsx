import { cx } from './ui';
import { fmtDay } from '../lib/format';

const SERIES = [
  { key: 'present', label: 'On time', cls: 'bg-accent' },
  { key: 'late', label: 'Late', cls: 'bg-late' },
  { key: 'leave', label: 'On leave', cls: 'bg-leave' },
  { key: 'absent', label: 'Absent', cls: 'bg-absent' },
];

export default function TrendChart({ data, total, today }) {
  const max = Math.max(total, 1);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {SERIES.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><span className={cx('size-2.5 rounded-sm', s.cls)} />{s.label}</span>)}
      </div>
      <div className="flex h-44 items-end gap-1 sm:gap-1.5">
        {data.map((d) => {
          const label = d.off ? `${fmtDay(d.date)}: ${d.holiday || 'Day off'}`
            : `${fmtDay(d.date)}: ${d.present} on time, ${d.late} late, ${d.leave} on leave, ${d.absent} absent`;
          return (
            <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={label} aria-label={label} role="img">
              {d.off ? (
                <div className="h-full rounded-md bg-[repeating-linear-gradient(135deg,var(--sunken)_0_4px,transparent_4px_8px)]" />
              ) : (
                <div className="flex h-full flex-col-reverse overflow-hidden rounded-md bg-sunken">
                  {SERIES.map((s) => d[s.key] > 0 && (
                    <div key={s.key} className={cx(s.cls, 'border-t border-surface/60')} style={{ height: `${(d[s.key] / max) * 100}%` }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1 sm:gap-1.5">
        {data.map((d) => (
          <div key={d.date} className={cx('min-w-0 flex-1 text-center text-[10px] leading-tight tabular', d.date === today ? 'font-semibold text-ink' : 'text-faint')}>
            <span className="block">{fmtDay(d.date, { weekday: 'narrow' })}</span>
            <span className="block">{Number(d.date.slice(8))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
