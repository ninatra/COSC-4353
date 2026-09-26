import { Link } from 'react-router-dom';
import { OpenBadge, PriorityBadge } from '../components/Badges.jsx';
import { peopleInQueue, servingEntry, waitForNewArrival } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { formatWait } from '../utils/format.js';

function isToday(iso) {
  return iso && new Date(iso).toDateString() === new Date().toDateString();
}

export default function AdminDashboard() {
  const { state, setServiceOpen, resetDemoData } = useQueues();
  const { services, entries } = state;

  const openCount = services.filter((s) => s.isOpen).length;
  const waitingCount = entries.filter((e) => e.status === 'WAITING').length;
  const servingCount = entries.filter((e) => e.status === 'SERVING').length;
  const servedToday = entries.filter((e) => e.status === 'SERVED' && isToday(e.completedAt)).length;

  function handleReset() {
    if (window.confirm('Reset all queues, services and notifications to the original demo data?')) {
      resetDemoData();
    }
  }

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>Admin dashboard</h1>
          <p className="muted">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link className="button" to="/admin/services">
          + New service
        </Link>
      </div>

      <ul className="summary" aria-label="Today at a glance">
        <li>
          <strong>{waitingCount}</strong> waiting
        </li>
        <li>
          <strong>{servingCount}</strong> being served
        </li>
        <li>
          <strong>{servedToday}</strong> served today
        </li>
        <li>
          <strong>{openCount}</strong> of {services.length} services open
        </li>
      </ul>

      <div className="card">
        <div className="card-header">
          <h2>Services</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Status</th>
                <th>In line</th>
                <th>Now serving</th>
                <th>Wait for new arrivals</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id}>
                  <td>
                    <strong>{service.name}</strong>
                    <div>
                      <PriorityBadge priority={service.priority} />
                    </div>
                  </td>
                  <td>
                    <OpenBadge isOpen={service.isOpen} />
                  </td>
                  <td>{peopleInQueue(state, service.id)}</td>
                  <td>{servingEntry(state, service.id)?.userName ?? <span className="muted">—</span>}</td>
                  <td>{formatWait(waitForNewArrival(state, service.id))}</td>
                  <td>
                    <div className="button-row">
                      <Link className="button secondary small" to={`/admin/queues/${service.id}`}>
                        Manage queue
                      </Link>
                      <button
                        className={service.isOpen ? 'secondary small' : 'small'}
                        onClick={() => setServiceOpen(service.id, !service.isOpen)}
                      >
                        {service.isOpen ? 'Close' : 'Open'}
                      </button>
                      <Link className="small" to={`/admin/services?edit=${service.id}`}>
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="muted small">
        This version uses demo data stored in your browser.{' '}
        <button className="link-button" onClick={handleReset}>
          Reset demo data
        </button>
      </p>
    </section>
  );
}
