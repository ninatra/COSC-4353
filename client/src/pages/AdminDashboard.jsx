import { useAuth } from '../AuthContext.jsx';

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <section>
      <h1>Admin dashboard</h1>
      <p className="muted">Logged in as {user.email}</p>
      <div className="card">
        <h2>Coming next</h2>
        <ul>
          <li>Create and edit services (name, description, duration, priority)</li>
          <li>Monitor live queues and serve the next person</li>
          <li>Usage statistics</li>
        </ul>
      </div>
    </section>
  );
}
