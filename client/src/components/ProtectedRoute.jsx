import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import AppShell from './AppShell.jsx';

// Layout route: renders the child page inside the app shell, but only for a
// logged-in user with the right role.
export default function ProtectedRoute({ role }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="loading">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={homePath(user)} replace />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export function homePath(user) {
  return user?.role === 'ADMIN' ? '/admin' : '/dashboard';
}
