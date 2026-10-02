import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { isWaiting } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { useTheme } from '../useTheme.js';
import { firstName, fmtTime, initials } from '../utils/format.js';
import { useConfirm } from './ConfirmDialog.jsx';
import Icon from './Icon.jsx';
import { useToast } from './Toast.jsx';

// [path, label, icon, short label for the phone tab bar, match exactly]
const USER_NAV = [
  ['/dashboard', 'Overview', 'house', 'Home'],
  ['/services', 'Services', 'layout-grid', 'Services'],
  ['/ticket', 'My ticket', 'ticket', 'Ticket'],
  ['/history', 'History', 'history', 'History'],
  ['/updates', 'Updates', 'bell', 'Updates'],
];
const ADMIN_NAV = [
  ['/admin', 'Overview', 'layout-dashboard', 'Overview', true],
  ['/admin/services', 'Services', 'layout-grid', 'Services'],
  ['/admin/queues', 'Waiting lists', 'list-ordered', 'Lists'],
  ['/admin/updates', 'Updates', 'bell', 'Updates'],
];

export function Wordmark({ to }) {
  const content = (
    <>
      <span className="qmark" aria-hidden="true">
        <Icon name="ticket" />
      </span>
      QueueSmart
    </>
  );
  return to ? (
    <Link className="wordmark" to={to}>
      {content}
    </Link>
  ) : (
    <span className="wordmark">{content}</span>
  );
}

export function ThemeButton() {
  const { isDark, toggle } = useTheme();
  return (
    <button type="button" className="theme-btn" onClick={toggle} aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}>
      <Icon name={isDark ? 'sun' : 'moon'} />
    </button>
  );
}

// Moves focus to the page's <h1> whenever the route changes.
function useFocusHeadingOnNavigate() {
  const { pathname } = useLocation();
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById('page-title')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);
}

// Avatar + first name; opens a small menu with the email and Sign out.
function AccountMenu({ user, isAdmin, onSignOut }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="acct" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="acct-btn"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(!open)}
      >
        <span className="avatar" aria-hidden="true">
          {initials(user.name)}
        </span>
        <span className="acct-name">{firstName(user.name)}</span>
        <span className="sr-only">, account menu</span>
        <Icon name="chevron-down" />
      </button>
      {open && (
        <div id={menuId} className="acct-menu">
          <p className="acct-who">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <span className="acct-role">{isAdmin ? 'Administrator' : 'User'}</span>
          </p>
          <button type="button" className="acct-item" onClick={onSignOut}>
            <Icon name="log-out" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { state, resetDemo } = useQueues();
  const confirm = useConfirm();
  const toast = useToast();
  useFocusHeadingOnNavigate();

  const isAdmin = user.role === 'ADMIN';
  const nav = isAdmin ? ADMIN_NAV : USER_NAV;
  const hasActiveTicket = !isAdmin && isWaiting(state, user.email);
  const dot = (path) =>
    path === '/ticket' && hasActiveTicket ? (
      <>
        <span className="nav-dot" aria-hidden="true" />
        <span className="sr-only"> (1 active)</span>
      </>
    ) : null;

  async function handleReset() {
    const ok = await confirm({
      title: 'Reset the demo?',
      body: 'This restores the sample services, queues, ticket, and history. Anything you changed will be lost.',
      confirmLabel: 'Reset demo',
      danger: true,
    });
    if (ok) {
      resetDemo();
      toast('Demo reset');
    }
  }

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="wrap header-row">
          <Wordmark to={isAdmin ? '/admin' : '/dashboard'} />
          <div className="account">
            <ThemeButton />
            {isAdmin && <span className="role-tag">Admin</span>}
            <AccountMenu user={user} isAdmin={isAdmin} onSignOut={logout} />
          </div>
        </div>
      </header>

      <nav className="main-nav" aria-label="Main">
        <div className="wrap">
          <ul>
            {nav.map(([path, label, , , end]) => (
              <li key={path}>
                <NavLink to={path} end={end}>
                  {label}
                  {dot(path)}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <main id="main" className="wrap page">
        {children}
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <span>
            Demo build · sample data and a simulated clock (now {fmtTime(state.clock)}). Saved only in this browser.
          </span>
          <button type="button" className="btn-text" onClick={handleReset}>
            Reset demo
          </button>
        </div>
      </footer>

      <nav className="tabbar" aria-label="Main">
        {nav.map(([path, , icon, short, end]) => (
          <NavLink key={path} to={path} end={end}>
            <span className="ico">
              <Icon name={icon} />
              {dot(path)}
            </span>
            {short}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
