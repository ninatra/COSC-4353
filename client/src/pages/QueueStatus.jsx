import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { StatusBadge } from '../components/Badges.jsx';
import { activeEntriesFor, ALMOST_READY_POSITION, historyFor } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { formatTime, formatWait, ordinal } from '../utils/format.js';

const STEPS = [
  { status: 'WAITING', label: 'Waiting' },
  { status: 'ALMOST_READY', label: 'Almost ready' },
  { status: 'SERVING', label: 'Being served' },
  { status: 'SERVED', label: 'Served' },
];

const STATUS_HINTS = {
  WAITING: `We'll notify you when you're ${ordinal(ALMOST_READY_POSITION)} in line.`,
  ALMOST_READY: "Start heading to the desk. You'll be called soon.",
  SERVING: 'Go to the desk now. Staff are ready for you.',
  SERVED: 'Your visit is complete.',
};

// What the ticket stub shows once the user is no longer waiting.
const STUB_DISPLAY = {
  SERVING: { value: 'Now', caption: 'Your turn' },
  SERVED: { value: 'Done', caption: 'Visit complete' },
};

// Served visits stay on this screen for a while so the user sees the final step.
const RECENTLY_SERVED_MINUTES = 30;

export default function QueueStatus() {
  const { user } = useAuth();
  const { state, leaveQueue } = useQueues();
  const [params] = useSearchParams();
  const focusId = Number(params.get('service'));

  const active = activeEntriesFor(state, user.email);
  const recentlyServed = historyFor(state, user.email)
    .filter(
      ({ entry }) =>
        entry.status === 'SERVED' &&
        Date.now() - new Date(entry.completedAt).getTime() < RECENTLY_SERVED_MINUTES * 60_000,
    )
    .map(({ entry, service }) => ({ entry, service, status: 'SERVED' }));

  // Show the service the user just picked first.
  const tickets = [...active, ...recentlyServed].sort(
    (a, b) => (b.service.id === focusId) - (a.service.id === focusId),
  );

  function handleLeave(service) {
    if (window.confirm(`Leave the ${service.name} queue? You will lose your place in line.`)) {
      leaveQueue(service.id, user.email);
    }
  }

  return (
    <section className="stack">
      <div>
        <h1>Queue status</h1>
        <p className="muted">This page updates automatically as staff serve people.</p>
      </div>

      {tickets.length === 0 && (
        <div className="card">
          <p>You're not in any queue right now.</p>
          <Link className="button" to="/join">
            Join a queue
          </Link>
        </div>
      )}

      {tickets.map((q) => {
        const currentStep = STEPS.findIndex((s) => s.status === q.status);
        const stub = STUB_DISPLAY[q.status] ?? { value: q.position, caption: 'Place in line' };
        return (
          <article key={q.entry.id} className="ticket" aria-live="polite">
            <div className={`ticket-stub stub-${q.status.toLowerCase()}`}>
              <span className="stub-caption">{stub.caption}</span>
              <span className="stub-value">{stub.value}</span>
            </div>

            <div className="ticket-body">
              <div className="card-header">
                <h2>{q.service.name}</h2>
                <StatusBadge status={q.status} />
              </div>

              <dl className="facts">
                {(q.status === 'WAITING' || q.status === 'ALMOST_READY') && (
                  <>
                    <div>
                      <dt>Estimated wait</dt>
                      <dd>{formatWait(q.estimatedWait)}</dd>
                    </div>
                    <div>
                      <dt>People ahead</dt>
                      <dd>{q.peopleAhead}</dd>
                    </div>
                  </>
                )}
                <div>
                  <dt>Joined at</dt>
                  <dd>{formatTime(q.entry.joinedAt)}</dd>
                </div>
                {q.entry.servedAt && (
                  <div>
                    <dt>Called at</dt>
                    <dd>{formatTime(q.entry.servedAt)}</dd>
                  </div>
                )}
              </dl>

              <ol className="steps" aria-label="Progress">
                {STEPS.map((step, index) => (
                  <li
                    key={step.status}
                    className={index < currentStep ? 'done' : index === currentStep ? 'current' : ''}
                    aria-current={index === currentStep ? 'step' : undefined}
                  >
                    {step.label}
                  </li>
                ))}
              </ol>

              <div className="ticket-footer">
                <p className={q.status === 'WAITING' ? 'muted' : 'notice'}>{STATUS_HINTS[q.status]}</p>
                {q.status !== 'SERVED' && (
                  <button className="danger" onClick={() => handleLeave(q.service)}>
                    Leave queue
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
