import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { OpenBadge, PriorityBadge } from '../components/Badges.jsx';
import { activeEntryFor, findService, peopleInQueue, waitForNewArrival } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { formatWait } from '../utils/format.js';

export default function JoinQueue() {
  const { user } = useAuth();
  const { state, joinQueue, leaveQueue } = useQueues();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const selected = findService(state, Number(params.get('service')));
  const myEntry = selected && activeEntryFor(state, user.email, selected.id);

  function handleJoin() {
    joinQueue(selected.id, user);
    navigate(`/status?service=${selected.id}`);
  }

  function handleLeave() {
    if (window.confirm(`Leave the ${selected.name} queue? You will lose your place in line.`)) {
      leaveQueue(selected.id, user.email);
    }
  }

  return (
    <section className="stack">
      <div>
        <h1>Join a queue</h1>
        <p className="muted">Choose a service to see the wait, then join the line.</p>
      </div>

      <div className="grid join-layout">
        <div className="service-picker" role="radiogroup" aria-label="Services">
          {state.services.map((service) => {
            const inLine = activeEntryFor(state, user.email, service.id);
            return (
              <button
                key={service.id}
                role="radio"
                aria-checked={selected?.id === service.id}
                className={`service-option ${selected?.id === service.id ? 'selected' : ''}`}
                onClick={() => setParams({ service: service.id })}
              >
                <span className="service-option-top">
                  <strong>{service.name}</strong>
                  {!service.isOpen && <OpenBadge isOpen={false} />}
                </span>
                <span className="muted small">
                  {service.isOpen
                    ? `${peopleInQueue(state, service.id)} in line · ${formatWait(waitForNewArrival(state, service.id))}`
                    : 'Not accepting new people'}
                  {inLine && ' · You are in this line'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="card">
          {!selected ? (
            <p className="muted">Select a service to see its details.</p>
          ) : (
            <div className="stack">
              <div>
                <h2>{selected.name}</h2>
                <p>{selected.description}</p>
                <div className="badge-row">
                  {!selected.isOpen && <OpenBadge isOpen={false} />}
                  <PriorityBadge priority={selected.priority} />
                </div>
              </div>

              <dl className="facts">
                <div>
                  <dt>People in line</dt>
                  <dd>{peopleInQueue(state, selected.id)}</dd>
                </div>
                <div>
                  <dt>Time per person</dt>
                  <dd>{selected.expectedDuration} min</dd>
                </div>
                <div>
                  <dt>{myEntry ? 'Your wait' : 'Estimated wait'}</dt>
                  <dd>{formatWait(myEntry ? myEntry.estimatedWait : waitForNewArrival(state, selected.id))}</dd>
                </div>
              </dl>

              {myEntry ? (
                <>
                  <p className="notice">
                    {myEntry.status === 'SERVING'
                      ? 'You are being served now.'
                      : `You're number ${myEntry.position} in this line.`}
                  </p>
                  <div className="button-row">
                    <Link className="button" to={`/status?service=${selected.id}`}>
                      View queue status
                    </Link>
                    <button className="danger" onClick={handleLeave}>
                      Leave queue
                    </button>
                  </div>
                </>
              ) : (
                <button onClick={handleJoin} disabled={!selected.isOpen}>
                  {selected.isOpen ? 'Join queue' : 'This queue is closed'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
