import { useAuth } from '../AuthContext.jsx';

export default function UserDashboard() {
  const { user } = useAuth();

  return (
    <section>
      <h1>Welcome, {user.name}</h1>
      {!user.emailVerified && (
        <p className="notice">Please verify your email. (For now the link is printed in the server console.)</p>
      )}
      <div className="card">
        <h2>Coming next</h2>
        <ul>
          <li>Browse services and join a queue</li>
          <li>See your position and estimated wait time</li>
          <li>Notifications when your turn is close</li>
          <li>Your queue history</li>
        </ul>
      </div>
    </section>
  );
}
