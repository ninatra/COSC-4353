import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { PriorityBadge, StatusBadge } from '../components/Badges.jsx';
import { findService, servingEntry, statusOf, waitingLine } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { formatTime, formatWait, timeAgo } from '../utils/format.js';

export default function QueueManagement() {
  const { state, serveNext, moveEntry, removeEntry, setServiceOpen } = useQueues();
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');

  const service = findService(state, Number(serviceId));
  if (!service) {
    const first = state.services[0];
    return first ? <Navigate to={`/admin/queues/${first.id}`} replace /> : <p>No services yet.</p>;
  }

  const serving = servingEntry(state, service.id);
  const line = waitingLine(state, service.id);
  const nextUp = line[0]?.entry;

  function handleServeNext() {
    serveNext(service.id);
    setMessage(nextUp ? `Now serving ${nextUp.userName}.` : `${serving.userName} marked as served.`);
  }

  function handleRemove(entry) {
    if (window.confirm(`Remove ${entry.userName} from the ${service.name} queue?`)) {
      removeEntry(service.id, entry.id);
      setMessage(`${entry.userName} was removed from the queue.`);
    }
  }

  function handleMove(entry, direction) {
    moveEntry(service.id, entry.id, direction);
    setMessage(`${entry.userName} moved ${direction < 0 ? 'up' : 'down'}.`);
  }

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>Queue management</h1>
          <p className="muted">Call people forward, change the order or remove someone from the line.</p>
        </div>
        <div className="button-row">
          <label className="inline-label">
            <span className="visually-hidden">Service</span>
            <select
              value={service.id}
              onChange={(e) => {
                setMessage('');
                navigate(`/admin/queues/${e.target.value}`);
              }}
            >
              {state.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isOpen ? '' : ' (closed)'}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary" onClick={() => setServiceOpen(service.id, !service.isOpen)}>
            {service.isOpen ? 'Close queue' : 'Open queue'}
          </button>
        </div>
      </div>

      {!service.isOpen && (
        <p className="notice">
          This queue is closed to new arrivals. People already waiting keep their place.
        </p>
      )}

      <div className="board">
        <div>
          <span className="board-label">Now serving</span>
          {serving ? (
            <>
              <h2 className="board-name">{serving.userName}</h2>
              <span className="board-meta">
                {serving.userEmail} · started {timeAgo(serving.servedAt)}
              </span>
            </>
          ) : (
            <h2 className="board-name">Nobody</h2>
          )}
        </div>
        <button className="accent" onClick={handleServeNext} disabled={!serving && !nextUp}>
          {nextUp ? `Serve next: ${nextUp.userName}` : serving ? 'Mark as served' : 'Queue is empty'}
        </button>
      </div>

      <p className="flash" role="status">
        {message}
      </p>

      <div className="card">
        <div className="card-header">
          <h2>Waiting ({line.length})</h2>
          <span className="muted small">{service.expectedDuration} min per person</span>
        </div>
        {line.length === 0 ? (
          <p className="muted">Nobody is waiting.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Est. wait</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {line.map(({ entry, position, estimatedWait }, index) => (
                  <tr key={entry.id}>
                    <td>{position}</td>
                    <td>
                      <strong>{entry.userName}</strong>
                      <div className="muted small">{entry.userEmail}</div>
                    </td>
                    <td>
                      <PriorityBadge priority={entry.priority} />
                    </td>
                    <td>
                      <StatusBadge status={statusOf(state, entry)} />
                    </td>
                    <td>{formatTime(entry.joinedAt)}</td>
                    <td>{formatWait(estimatedWait)}</td>
                    <td>
                      <div className="button-row">
                        <button
                          className="secondary small"
                          aria-label={`Move ${entry.userName} up`}
                          disabled={index === 0}
                          onClick={() => handleMove(entry, -1)}
                        >
                          ↑
                        </button>
                        <button
                          className="secondary small"
                          aria-label={`Move ${entry.userName} down`}
                          disabled={index === line.length - 1}
                          onClick={() => handleMove(entry, 1)}
                        >
                          ↓
                        </button>
                        <button className="danger small" onClick={() => handleRemove(entry)}>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
