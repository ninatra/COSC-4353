import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import ProtectedRoute, { homePath } from './components/ProtectedRoute.jsx';
import AdminOverview from './pages/AdminOverview.jsx';
import History from './pages/History.jsx';
import Login from './pages/Login.jsx';
import MyTicket from './pages/MyTicket.jsx';
import Overview from './pages/Overview.jsx';
import Register from './pages/Register.jsx';
import ServiceDetail from './pages/ServiceDetail.jsx';
import ServiceManagement from './pages/ServiceManagement.jsx';
import Services from './pages/Services.jsx';
import Updates from './pages/Updates.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import WaitingLists from './pages/WaitingLists.jsx';

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify/:token" element={<VerifyEmail />} />

      <Route element={<ProtectedRoute role="USER" />}>
        <Route path="/dashboard" element={<Overview />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/:serviceId" element={<ServiceDetail />} />
        <Route path="/ticket" element={<MyTicket />} />
        <Route path="/history" element={<History />} />
        <Route path="/updates" element={<Updates />} />
      </Route>

      <Route element={<ProtectedRoute role="ADMIN" />}>
        <Route path="/admin" element={<AdminOverview />} />
        <Route path="/admin/services" element={<ServiceManagement />} />
        <Route path="/admin/services/new" element={<ServiceManagement />} />
        <Route path="/admin/services/:serviceId/edit" element={<ServiceManagement />} />
        <Route path="/admin/queues" element={<WaitingLists />} />
        <Route path="/admin/queues/:serviceId" element={<WaitingLists />} />
        <Route path="/admin/updates" element={<Updates />} />
      </Route>

      <Route path="*" element={loading ? null : <Navigate to={user ? homePath(user) : '/login'} replace />} />
    </Routes>
  );
}
