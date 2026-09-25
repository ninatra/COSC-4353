import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import NavBar from './components/NavBar.jsx';
import ProtectedRoute, { homePath } from './components/ProtectedRoute.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import History from './pages/History.jsx';
import JoinQueue from './pages/JoinQueue.jsx';
import Login from './pages/Login.jsx';
import QueueManagement from './pages/QueueManagement.jsx';
import QueueStatus from './pages/QueueStatus.jsx';
import Register from './pages/Register.jsx';
import ServiceManagement from './pages/ServiceManagement.jsx';
import UserDashboard from './pages/UserDashboard.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';

const USER_PAGES = [
  ['/dashboard', <UserDashboard />],
  ['/join', <JoinQueue />],
  ['/status', <QueueStatus />],
  ['/history', <History />],
];

const ADMIN_PAGES = [
  ['/admin', <AdminDashboard />],
  ['/admin/services', <ServiceManagement />],
  ['/admin/queues', <QueueManagement />],
  ['/admin/queues/:serviceId', <QueueManagement />],
];

export default function App() {
  const { user, loading } = useAuth();

  return (
    <>
      <NavBar />
      <main className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify/:token" element={<VerifyEmail />} />
          {USER_PAGES.map(([path, page]) => (
            <Route key={path} path={path} element={<ProtectedRoute role="USER">{page}</ProtectedRoute>} />
          ))}
          {ADMIN_PAGES.map(([path, page]) => (
            <Route key={path} path={path} element={<ProtectedRoute role="ADMIN">{page}</ProtectedRoute>} />
          ))}
          <Route
            path="*"
            element={loading ? null : <Navigate to={user ? homePath(user) : '/login'} replace />}
          />
        </Routes>
      </main>
    </>
  );
}
