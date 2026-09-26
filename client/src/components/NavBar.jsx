import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import NotificationBell from './NotificationBell.jsx';
import { homePath } from './ProtectedRoute.jsx';

const USER_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/join', label: 'Join Queue' },
  { to: '/status', label: 'Queue Status' },
  { to: '/history', label: 'History' },
];

const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/services', label: 'Services' },
  { to: '/admin/queues', label: 'Queues' },
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const links = user?.role === 'ADMIN' ? ADMIN_LINKS : USER_LINKS;

  return (
    <header className="nav">
      <div className="nav-inner">
        <div className="nav-top">
          <Link to={user ? homePath(user) : '/login'} className="brand">
            <span className="brand-mark" aria-hidden="true">Q</span>
            QueueSmart
          </Link>
          {user ? (
            <div className="nav-right">
              <NotificationBell />
              <span className="nav-user">
                {user.name} <span className="badge">{user.role === 'ADMIN' ? 'Admin' : 'User'}</span>
              </span>
              <button className="secondary" onClick={logout}>
                Log out
              </button>
            </div>
          ) : (
            <div className="nav-right">
              <Link to="/login">Log in</Link>
              <Link to="/register">Register</Link>
            </div>
          )}
        </div>
        {user && (
          <nav className="nav-links" aria-label="Main">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
