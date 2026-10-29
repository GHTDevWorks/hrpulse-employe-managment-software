import { useState } from 'react';
import { Copy, Check, Eye, EyeOff, LogIn, KeyRound, RotateCcw } from 'lucide-react';
import { DEMO_MODE, resetDemo } from '../demo/adapter';
import API, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Field, Input } from '../components/ui';
import { Logo } from '../components/Layout';
import { useNow } from '../lib/hooks';

// Demo credentials shown on the sign-in page. Change them in frontend/.env,
// or set VITE_DEMO_LOGIN=false to hide the box for a real deployment.
const DEMO = {
  enabled: import.meta.env.VITE_DEMO_LOGIN !== 'false' || DEMO_MODE,
  email: import.meta.env.VITE_DEMO_EMAIL || 'manager@test.com',
  password: import.meta.env.VITE_DEMO_PASSWORD || '123456',
};

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-sunken px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] text-faint">{label}</p>
        <p className="truncate text-sm font-medium text-ink tabular select-all">{value}</p>
      </div>
      <button type="button" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`} title="Copy"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-ink">
        {copied ? <Check className="size-4 text-accent" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}

function DemoBox({ onUse, loading, className }) {
  const [resetDone, setResetDone] = useState(false);
  const reset = async () => {
    await resetDemo();
    setResetDone(true);
    setTimeout(() => setResetDone(false), 2500);
  };
  return (
    <div className={`rounded-2xl border border-line bg-surface p-5 shadow-xl shadow-black/10 ${className || ''}`}>
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-accent" />
        <p className="text-sm font-semibold text-ink">Demo login</p>
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {DEMO_MODE
          ? 'Try it with a sample team. Changes are saved only in this browser.'
          : 'This is a demo. Use the manager account to try every feature.'}
      </p>
      <div className="mt-4 space-y-2">
        <CopyRow label="Email" value={DEMO.email} />
        <CopyRow label="Password" value={DEMO.password} />
      </div>
      <Button type="button" variant="secondary" icon={LogIn} loading={loading} onClick={() => onUse(DEMO.email, DEMO.password)} className="mt-4 w-full">Sign in as manager</Button>
      {DEMO_MODE && (
        <>
          <Button type="button" variant="ghost" onClick={() => onUse('sara@test.com', '123456')} disabled={loading} className="mt-1.5 w-full">Sign in as an employee</Button>
          <button type="button" onClick={reset} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-xs text-faint hover:text-ink">
            <RotateCcw className="size-3" />{resetDone ? 'Demo data reset' : 'Reset demo data'}
          </button>
        </>
      )}
    </div>
  );
}

export default function Login() {
  const { login, notice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const now = useNow(1000);

  const signIn = async (creds) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await API.post('/auth/login', creds);
      login(data);
    } catch (err) {
      setError(errMsg(err, 'Sign-in failed'));
    } finally {
      setLoading(false);
    }
  };
  const submit = (e) => { e.preventDefault(); signIn({ email, password }); };
  const useDemo = (e, p) => { setEmail(e); setPassword(p); signIn({ email: e, password: p }); };

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const progress = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 100;

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="mt-1.5 text-sm text-muted">Use the email and password your manager set up for you.</p>

          {notice && <p className="mt-6 rounded-lg bg-late-soft px-3 py-2 text-sm text-late">{notice}</p>}

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email">
              {(id) => <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" />}
            </Field>
            <Field label="Password">
              {(id) => (
                <div className="relative">
                  <Input id={id} type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
                  <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-faint hover:text-ink">
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              )}
            </Field>
            {error && <p className="text-sm text-absent" role="alert">{error}</p>}
            <Button type="submit" size="lg" icon={LogIn} loading={loading} className="w-full">Sign in</Button>
          </form>
          <p className="mt-6 text-xs text-faint">Forgot your password? Your manager can reset it from the People page.</p>
          {DEMO.enabled && <DemoBox onUse={useDemo} loading={loading} className="mt-8 lg:hidden" />}
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-accent lg:flex lg:flex-col lg:justify-end">
        {DEMO.enabled && <DemoBox onUse={useDemo} loading={loading} className="absolute top-10 right-10 w-80" />}
        <div className="px-14 pb-16 text-accent-ink">
          <p className="text-sm font-medium opacity-80">
            {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <p className="mt-2 text-[132px] leading-none font-semibold tracking-[-0.04em] tabular">
            {hh}<span className="opacity-60">:</span>{mm}<span className="ml-3 text-5xl font-medium tracking-normal opacity-60">{ss}</span>
          </p>
          <div className="mt-10">
            <div className="relative h-2 rounded-full bg-accent-ink/20">
              <div className="absolute inset-y-0 left-0 rounded-full bg-accent-ink/70" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs opacity-70 tabular">
              {['00', '06', '12', '18', '24'].map((h) => <span key={h}>{h}</span>)}
            </div>
          </div>
          <p className="mt-10 max-w-md text-[15px] leading-relaxed opacity-85">
            Sign in when you arrive and sign out when you leave. Your hours, late arrivals and leave balance are worked out for you.
          </p>
        </div>
      </div>
    </div>
  );
}
