import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { StatusBadge } from '../components/Badges.jsx';
import { activeEntriesFor, notificationsFor, peopleInQueue, waitForNewArrival } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { formatWait, ordinal, timeAgo } from '../utils/format.js';

export default function UserDashboard() {
  const { user } = useAuth();
  const { state } = useQueues();

  const myQueues = activeEntriesFor(state, user.email);
  const openServices = state.services.filter((s) => s.isOpen);
  const notifications = notificationsFor(state, user);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Lead with the queue the user will reach first.
  const soonest = [...myQueues].sort((a, b) => a.estimatedWait - b.estimatedWait)[0];
  let headline = "You're not in line anywhere";
  let subtitle = 'Pick a service below to join its queue.';
  if (soonest?.status === 'SERVING') {
    headline = `It's your turn at ${soonest.service.name}`;
    subtitle = 'Go to the desk now.';
  } else if (soonest) {
    headline = `You're ${ordinal(soonest.position)} in line for ${soonest.service.name}`;
    subtitle = `Estimated wait: ${formatWait(soonest.estimatedWait)}`;
  }

  return (
    <section className="stack">
      <div>
        <h1>{headline}</h1>
        <p className="muted">{subtitle}</p>
      </div>

      {!user.emailVerified && (
        <p className="notice">Please verify your email. (For now the link is printed in the server console.)</p>
      )}

      <div className="grid two">
        <div className="card">
          <div className="card-header">
            <h2>Your queues</h2>
            <Link to="/status">View status</Link>
          </div>
          {myQueues.length === 0 ? (
            <p className="muted">
              You're not in any queue right now. <Link to="/join">Join a queue</Link>
            </p>
          ) : (
            <ul className="list">
              {myQueues.map((q) => (
                <li key={q.entry.id} className="list-row">
                  <div>
                    <strong>{q.service.name}</strong>
                    <div className="muted small">
                      {q.status === 'SERVING'
                        ? 'You are being served now'
                        : `${ordinal(q.position)} in line · ${formatWait(q.estimatedWait)}`}
                    </div>
                  </div>
                  <StatusBadge status={q.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Notifications</h2>
            <span className="muted small">{unreadCount} unread</span>
          </div>
          {notifications.length === 0 ? (
            <p className="muted">No notifications yet.</p>
          ) : (
            <ul className="list">
              {notifications.slice(0, 3).map((n) => (
                <li key={n.id} className="list-row">
                  <span className={n.read ? 'muted' : ''}>{n.message}</span>
                  <span className="muted small nowrap">{timeAgo(n.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Available services</h2>
          <span className="muted small">{openServices.length} open now</span>
        </div>
        <ul className="list">
          {openServices.map((service) => {
            const inQueue = myQueues.some((q) => q.service.id === service.id);
            return (
              <li key={service.id} className="list-row">
                <div>
                  <strong>{service.name}</strong>
                  <div className="muted small">
                    {peopleInQueue(state, service.id)} in line · wait {formatWait(waitForNewArrival(state, service.id))}
                  </div>
                </div>
                {inQueue ? (
                  <span className="badge status-waiting">You're in line</span>
                ) : (
                  <Link className="button small" to={`/join?service=${service.id}`}>
                    Join
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
