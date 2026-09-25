import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { homePath } from './ProtectedRoute.jsx';

export default function NavBar() {
  const { user, logout } = useAuth();

  return (
    <header className="nav">
      <Link to={user ? homePath(user) : '/login'} className="brand">
        QueueSmart
      </Link>
      {user ? (
        <div className="nav-right">
          <span>
            {user.name} <span className="badge">{user.role}</span>
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
    </header>
  );
}
