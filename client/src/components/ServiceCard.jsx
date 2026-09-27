import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { positionOf, queueOf, ticketOf } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { pad } from '../utils/format.js';
import CrowdMeter from './CrowdMeter.jsx';
import EmptyState from './EmptyState.jsx';
import ServiceTile from './ServiceTile.jsx';
import StatusLabel from './StatusLabel.jsx';

export default function ServiceCard({ service }) {
  const { state } = useQueues();
  const { user } = useAuth();
  const waiting = queueOf(state, service.id).length;
  const ticket = ticketOf(state, user.email);
  const mine = ticket?.status === 'waiting' && ticket.serviceId === service.id;

  return (
    <article className={`svc-card ${mine ? 'is-mine' : ''}`}>
      <div className="svc-body">
        <div className="svc-top">
          <ServiceTile service={service} />
          <StatusLabel status="open" />
        </div>
        <h3>{service.name}</h3>
        <p className="desc">{service.desc}</p>
        <dl className="stats">
          <div>
            <dt>Est. wait</dt>
            <dd>{waiting * service.duration} min</dd>
          </div>
          <div>
            <dt>Waiting</dt>
            <dd>{waiting}</dd>
          </div>
          <div className="crowd-cell">
            <dt className="sr-only">How busy</dt>
            <dd>
              <CrowdMeter wait={waiting * service.duration} />
            </dd>
          </div>
        </dl>
        {mine && (
          <p className="svc-mine">
            <span className="lime-dot" aria-hidden="true" />
            You're {pad(positionOf(state, user.email))} in this line
          </p>
        )}
      </div>
      <div className="svc-foot">
        <Link to={`/services/${service.id}`} className="link-arrow">
          View service<span className="sr-only">: {service.name}</span>
          <span aria-hidden="true">&nbsp;→</span>
        </Link>
      </div>
    </article>
  );
}

export function ClosedServiceRow({ service }) {
  return (
    <div className="closed-row">
      <ServiceTile service={service} size="sm" />
      <div>
        <span className="closed-name">{service.name}</span>
        <span className="closed-desc">{service.desc}</span>
      </div>
      <StatusLabel status="closed" />
      <Link to={`/services/${service.id}`} className="link-arrow">
        View details<span className="sr-only">: {service.name}</span>
        <span aria-hidden="true">&nbsp;→</span>
      </Link>
    </div>
  );
}

// Open services as cards, closed ones as compact rows.
export function ServiceList() {
  const { state } = useQueues();
  const open = state.services.filter((s) => s.open);
  const closed = state.services.filter((s) => !s.open);
  return (
    <>
      {open.length ? (
        <div className="svc-grid">
          {open.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      ) : (
        <EmptyState title="No services are open" body="Every service is closed right now. Check back later." />
      )}
      {closed.map((s) => (
        <ClosedServiceRow key={s.id} service={s} />
      ))}
    </>
  );
}
