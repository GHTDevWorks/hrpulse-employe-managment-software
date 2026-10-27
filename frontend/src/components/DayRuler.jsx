import { cx } from './ui';
import { fmtMins, fmtTime, hhmmToMin, minutesInTz } from '../lib/format';

/**
 * A horizontal ruler of the working day: office hours band, grace mark,
 * the stretch actually worked, and a live "now" needle.
 */
export default function DayRuler({ settings, signInTime, signOutTime, now = new Date(), compact, range }) {
  const ws = hhmmToMin(settings.workStart);
  const we = hhmmToMin(settings.workEnd);
  const inMin = signInTime ? minutesInTz(new Date(signInTime)) : null;
  // A session that crossed midnight is drawn up to the end of the ruler.
  const crossesDay = signInTime && (signOutTime ? new Date(signOutTime) : now) - new Date(signInTime) > 20 * 3600 * 1000;
  let outMin = signInTime ? minutesInTz(signOutTime ? new Date(signOutTime) : now) : null;
  if (inMin !== null && outMin < inMin) outMin = 1440;
  const nowMin = minutesInTz(now);

  const lo = range ? range[0] : Math.max(0, Math.floor((Math.min(ws, inMin ?? ws, nowMin) - 60) / 60) * 60);
  const hi = range ? range[1] : Math.min(1440, Math.ceil((Math.max(we, outMin ?? we, nowMin) + 60) / 60) * 60);
  const span = hi - lo;
  const pct = (m) => `${((Math.min(Math.max(m, lo), hi) - lo) / span) * 100}%`;
  const width = (a, b) => `${((Math.min(b, hi) - Math.max(a, lo)) / span) * 100}%`;

  const hours = [];
  for (let m = lo; m <= hi; m += 60) hours.push(m);
  const step = span > 14 * 60 ? 3 : 2;
  const grace = ws + settings.graceMinutes;
  const late = inMin !== null && inMin > grace;

  return (
    <div className={cx('select-none', compact ? 'pt-1' : 'pt-7')} aria-hidden="true">
      <div className={cx('relative', compact ? 'h-7' : 'h-14')}>
        {/* office hours */}
        <div className="absolute inset-y-0 rounded-md bg-sunken" style={{ left: pct(ws), width: width(ws, we) }} />
        {!compact && (
          <>
            <span className="absolute -top-6 -translate-x-1/2 text-[11px] font-medium text-muted whitespace-nowrap" style={{ left: pct(ws) }}>Start {settings.workStart}</span>
            <span className="absolute -top-6 -translate-x-1/2 text-[11px] font-medium text-muted whitespace-nowrap" style={{ left: pct(we) }}>End {settings.workEnd}</span>
          </>
        )}
        {/* grace line */}
        {settings.graceMinutes > 0 && <div className="absolute inset-y-0 border-l border-dashed border-line-strong" style={{ left: pct(grace) }} />}
        {/* late gap */}
        {late && <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-late/50" style={{ left: pct(ws), width: width(ws, inMin) }} />}
        {/* worked */}
        {inMin !== null && (
          <div className={cx('absolute top-1/2 -translate-y-1/2 rounded-full', compact ? 'h-2.5' : 'h-5', signOutTime ? 'bg-accent' : 'bg-accent/85', late && 'ring-2 ring-late/60')}
            style={{ left: pct(inMin), width: `max(6px, ${width(inMin, crossesDay ? hi : outMin)})` }} />
        )}
        {/* now needle */}
        {nowMin >= lo && nowMin <= hi && (
          <div className="absolute inset-y-[-6px] w-px bg-ink" style={{ left: pct(nowMin) }}>
            <span className="needle-pulse absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-ink" />
          </div>
        )}
      </div>
      {/* ticks */}
      {!compact && <div className="relative mt-2 h-4">
        {hours.map((m) => (
          <div key={m} className="absolute top-0 -translate-x-1/2" style={{ left: pct(m) }}>
            <div className={cx('mx-auto w-px bg-line-strong', (m / 60) % step === 0 ? 'h-2' : 'h-1')} />
            {(m / 60) % step === 0 && !compact && <span className="mt-0.5 block text-[10px] text-faint tabular">{String(m / 60).padStart(2, '0')}</span>}
          </div>
        ))}
      </div>}
      {!compact && signInTime && (
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" />In at <b className="font-semibold text-ink tabular">{fmtTime(signInTime)}</b></span>
          {signOutTime && <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-ink" />Out at <b className="font-semibold text-ink tabular">{fmtTime(signOutTime)}</b></span>}
          {late && <span className="inline-flex items-center gap-1.5"><span className="h-1 w-3 rounded-full bg-late/60" />Late by {fmtMins(inMin - ws)}</span>}
        </div>
      )}
    </div>
  );
}
