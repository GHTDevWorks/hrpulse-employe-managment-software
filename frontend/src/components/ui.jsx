import { useEffect, useId, useRef } from 'react';
import { Loader2, X } from 'lucide-react';
import { STATUS, LEAVE_STATUS } from '../lib/status';
import { initials } from '../lib/format';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

const BTN = {
  primary: 'bg-accent text-accent-ink hover:brightness-110 disabled:brightness-100',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken',
  ghost: 'text-muted hover:text-ink hover:bg-sunken',
  danger: 'bg-absent text-white hover:brightness-110',
  dangerGhost: 'text-absent hover:bg-absent-soft',
};
const SIZE = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-5 text-[15px] gap-2' };

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, className, children, ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx('inline-flex items-center justify-center rounded-lg font-medium transition select-none disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap', BTN[variant], SIZE[size], className)}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className, ...props }) {
  return (
    <button {...props} aria-label={label} title={label}
      className={cx('inline-flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-sunken hover:text-ink disabled:opacity-40', className)}>
      <Icon className="size-4" />
    </button>
  );
}

const control = 'w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60';

export function Field({ label, hint, error, children, className }) {
  const id = useId();
  const child = typeof children === 'function' ? children(id) : children;
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">{label}</label>}
      {child}
      {error ? <p className="mt-1 text-xs text-absent">{error}</p> : hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

export const Input = ({ className, ...p }) => <input {...p} className={cx(control, 'h-10', className)} />;
export const Textarea = ({ className, ...p }) => <textarea {...p} className={cx(control, 'py-2 min-h-20 resize-y', className)} />;
export const Select = ({ className, children, ...p }) => <select {...p} className={cx(control, 'h-10 pr-8', className)}>{children}</select>;

export function Panel({ title, description, actions, children, className, bodyClass, flush }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-surface', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx(flush ? '' : 'px-5 pb-5', !title && !actions && !flush && 'pt-5', bodyClass)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatusPill({ status, children, className }) {
  const s = STATUS[status] || STATUS.none;
  if (!s.label && !children) return <span className="text-faint">–</span>;
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', s.bg, s.fg, className)}>
      <span className={cx('size-1.5 rounded-full', s.dot)} />
      {children || s.label}
    </span>
  );
}

export function LeavePill({ status }) {
  const s = LEAVE_STATUS[status];
  return <span className={cx('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', s.bg, s.fg)}>{s.label}</span>;
}

export function RoleTag({ role }) {
  return <span className="inline-flex rounded-md border border-line px-1.5 py-px text-[11px] font-medium capitalize text-muted">{role}</span>;
}

export function Avatar({ name, size = 'md', dim }) {
  const sz = { sm: 'size-7 text-[11px]', md: 'size-9 text-xs', lg: 'size-12 text-sm' }[size];
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-sunken font-semibold text-muted ring-1 ring-line', sz, dim && 'opacity-50')}>
      {initials(name)}
    </span>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-faint">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && <Icon className="mb-3 size-6 text-faint" />}
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-[13px] text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children, onRetry }) {
  if (!children) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-absent/30 bg-absent-soft px-4 py-3 text-sm text-absent">
      <span>{children}</span>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Modal({ open, onClose, title, description, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector('input,select,textarea,button[data-autofocus]')?.focus(), 30);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
        className={cx('pop-in flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div>
            <h3 className="text-base font-semibold text-ink">{title}</h3>
            {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, title, message, confirmLabel = 'Delete', danger = true, loading, onConfirm, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}
      footer={<>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm} data-autofocus>{confirmLabel}</Button>
      </>}>
      <p className="text-sm text-muted">{message}</p>
    </Modal>
  );
}

export function Segmented({ value, onChange, options, className }) {
  return (
    <div role="tablist" className={cx('inline-flex rounded-lg border border-line bg-sunken p-0.5', className)}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cx('rounded-md px-3 py-1.5 text-[13px] font-medium transition whitespace-nowrap',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>
          {o.label}{o.count !== undefined && <span className="ml-1.5 text-faint tabular">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

// A row of figures separated by rules, used instead of a grid of identical cards.
export function StatBand({ items, className }) {
  return (
    <div className={cx('grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3', items.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4', className)}>
      {items.map((it) => (
        <div key={it.label} className="bg-surface px-5 py-4 max-sm:[&:last-child:nth-child(odd)]:col-span-2">
          <p className="text-[13px] text-muted">{it.label}</p>
          <p className={cx('mt-1 text-2xl font-semibold tracking-tight tabular', it.tone || 'text-ink')}>{it.value}</p>
          {it.sub && <p className="mt-0.5 text-xs text-faint">{it.sub}</p>}
        </div>
      ))}
    </div>
  );
}

export function Table({ head, children, className }) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[12px] text-faint">
            {head.map((h, i) => <th key={i} className={cx('px-5 py-2.5 font-medium', h.className)}>{h.label ?? h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
