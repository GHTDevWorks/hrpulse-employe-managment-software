import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Clock, CalendarDays, Plane, UserRound, LayoutDashboard, Table2, Users, Inbox,
  CalendarHeart, Megaphone, History, Settings, Moon, Sun, LogOut, Menu, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Avatar, cx } from './ui';
import API from '../api/client';

const ME = [
  { to: '/day', label: 'My day', icon: Clock },
  { to: '/history', label: 'My attendance', icon: CalendarDays },
  { to: '/leave', label: 'My leave', icon: Plane },
  { to: '/profile', label: 'Profile', icon: UserRound },
];
const TEAM = [
  { to: '/team', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/team/records', label: 'Records', icon: Table2 },
  { to: '/team/people', label: 'People', icon: Users },
  { to: '/team/leave', label: 'Leave requests', icon: Inbox, badge: 'leave' },
  { to: '/team/holidays', label: 'Holidays', icon: CalendarHeart },
  { to: '/team/notices', label: 'Notices', icon: Megaphone },
  { to: '/team/activity', label: 'Activity log', icon: History },
  { to: '/team/settings', label: 'Settings', icon: Settings },
];

export function Logo({ className }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-accent" />
        <path d="M5 17h6l2.5-6 4 11 3-8 1.5 3H27" fill="none" className="stroke-accent-ink" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight text-ink">HRPulse</span>
    </span>
  );
}

function NavItem({ item, badge, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} end={item.end} onClick={onNavigate}
      className={({ isActive }) => cx(
        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
        isActive ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-sunken hover:text-ink',
      )}>
      <Icon className="size-[18px] shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {badge > 0 && <span className="rounded-full bg-late px-1.5 text-[11px] font-semibold leading-5 text-white tabular">{badge}</span>}
    </NavLink>
  );
}

function SidebarBody({ onNavigate }) {
  const { user, logout } = useAuth();
  const [dark, setDark] = useTheme();
  const [pending, setPending] = useState(0);
  const isManager = user?.role === 'manager';
  const location = useLocation();

  useEffect(() => {
    if (!isManager) return;
    API.get('/leaves', { params: { status: 'pending' } }).then(({ data }) => setPending(data.length)).catch(() => {});
  }, [isManager, location.pathname]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-6"><Logo /></div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3" aria-label="Main">
        {isManager && (
          <div>
            <p className="px-3 pb-1.5 text-xs font-medium text-faint">Team</p>
            <div className="space-y-0.5">{TEAM.map((i) => <NavItem key={i.to} item={i} badge={i.badge ? pending : 0} onNavigate={onNavigate} />)}</div>
          </div>
        )}
        <div>
          {isManager && <p className="px-3 pb-1.5 text-xs font-medium text-faint">Me</p>}
          <div className="space-y-0.5">{ME.map((i) => <NavItem key={i.to} item={i} onNavigate={onNavigate} />)}</div>
        </div>
      </nav>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={user?.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{user?.name}</p>
            <p className="truncate text-xs capitalize text-faint">{user?.designation || user?.role}</p>
          </div>
          <button onClick={() => setDark(!dark)} aria-label={dark ? 'Use light theme' : 'Use dark theme'} title={dark ? 'Light theme' : 'Dark theme'}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink">
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button onClick={() => logout()} aria-label="Sign out" title="Sign out"
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-absent-soft hover:text-absent">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [location.pathname]);

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-surface lg:block">
        <SidebarBody />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="inline-flex size-9 items-center justify-center rounded-lg text-ink hover:bg-sunken">
          <Menu className="size-5" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="drawer-in absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-2xl">
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute top-4 right-3 inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-sunken">
              <X className="size-5" />
            </button>
            <SidebarBody onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}
