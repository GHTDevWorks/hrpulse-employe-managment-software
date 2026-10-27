import { cx } from './ui';
import { STATUS } from '../lib/status';
import { fmtMins } from '../lib/format';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function MonthCalendar({ days, today, selected, onSelect }) {
  if (!days?.length) return null;
  const firstDow = (new Date(`${days[0].date}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const cells = [...Array(firstDow).fill(null), ...days];
  while (cells.length % 7) cells.push(null);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 pb-2 text-center text-[11px] font-medium text-faint">
        {WEEK.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const s = STATUS[d.status] || STATUS.none;
          const isToday = d.date === today;
          const isSel = d.date === selected;
          const dayNum = Number(d.date.slice(8));
          const label = [s.label, d.holidayName, d.workedMinutes ? fmtMins(d.workedMinutes) : ''].filter(Boolean).join(', ');
          return (
            <button key={d.date} type="button" onClick={() => onSelect?.(d)} title={label} aria-label={`${d.date}: ${label || 'no record'}`}
              className={cx('group relative flex aspect-square flex-col items-start justify-between rounded-lg p-1.5 text-left transition sm:aspect-[1.15] sm:p-2',
                s.bg, d.status === 'none' && 'border border-dashed border-line',
                isSel ? 'ring-2 ring-ink' : isToday ? 'ring-2 ring-accent' : 'hover:ring-1 hover:ring-line-strong')}>
              <span className={cx('text-xs font-semibold tabular sm:text-sm', d.status === 'none' ? 'text-faint' : 'text-ink')}>{dayNum}</span>
              <span className={cx('hidden text-[11px] font-medium leading-tight sm:block', s.fg)}>
                {d.workedMinutes ? fmtMins(d.workedMinutes) : d.status === 'holiday' ? 'Holiday' : d.status === 'leave' ? 'Leave' : d.status === 'absent' ? 'Absent' : ''}
              </span>
              <span className={cx('size-1.5 rounded-full sm:hidden', s.dot)} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StatusLegend({ keys = ['present', 'late', 'half', 'leave', 'absent', 'holiday'] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
      {keys.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5"><span className={cx('size-2.5 rounded-sm', STATUS[k].dot)} />{STATUS[k].label}</span>
      ))}
    </div>
  );
}
