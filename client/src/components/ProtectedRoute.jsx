import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

// Only renders children for a logged-in user, optionally with a specific role.
export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="center">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={homePath(user)} replace />;
  return children;
}

export function homePath(user) {
  return user?.role === 'ADMIN' ? '/admin' : '/dashboard';
}
