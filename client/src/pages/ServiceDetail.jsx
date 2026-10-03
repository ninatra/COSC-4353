import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import CrowdMeter from '../components/CrowdMeter.jsx';
import Icon from '../components/Icon.jsx';
import ServiceTile from '../components/ServiceTile.jsx';
import StatusLabel from '../components/StatusLabel.jsx';
import { useToast } from '../components/Toast.jsx';
import { findService, positionOf, queueOf, ticketOf } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { pad } from '../utils/format.js';

function BackLink() {
  return (
    <Link to="/services" className="back">
      <Icon name="arrow-left" />
      All services
    </Link>
  );
}

export default function ServiceDetail() {
  const { serviceId } = useParams();
  const { state, join } = useQueues();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const service = findService(state, serviceId);
  if (!service) {
    return (
      <>
        <BackLink />
        <h1 id="page-title" tabIndex={-1}>
          Service not found
        </h1>
      </>
    );
  }

  const waiting = queueOf(state, service.id).length;
  const wait = waiting * service.duration;
  const ticket = ticketOf(state, user.email);
  const inThisLine = ticket?.status === 'waiting' && ticket.serviceId === service.id;
  const inAnotherLine = ticket?.status === 'waiting' && ticket.serviceId !== service.id;
  const position = positionOf(state, user.email);

  function handleJoin() {
    toast(join(service.id, { name: user.name, email: user.email }));
    navigate('/ticket');
  }

  let panel;
  if (inThisLine) {
    panel = (
      <>
        <h2>You're in this line</h2>
        <p>
          You're {pad(position)} in line with an estimated wait of {(position - 1) * service.duration} min.
        </p>
        <Link to="/ticket" className="btn btn-primary">
          View your ticket<span aria-hidden="true">&nbsp;→</span>
        </Link>
      </>
    );
  } else if (!service.open) {
    panel = (
      <>
        <h2>Closed to new visitors</h2>
        <p>This service isn't taking new visitors right now. People already in line keep their place.</p>
        <button type="button" className="btn btn-primary" disabled>
          Join queue
        </button>
      </>
    );
  } else if (inAnotherLine) {
    panel = (
      <>
        <h2>You're already waiting</h2>
        <p>
          You're in line for {findService(state, ticket.serviceId).name}. You can hold one place at a time, so leave that
          line before joining this one.
        </p>
        <Link to="/ticket" className="btn btn-secondary">
          View your ticket<span aria-hidden="true">&nbsp;→</span>
        </Link>
      </>
    );
  } else {
    panel = (
      <>
        <h2>Join this line</h2>
        <p>
          You'd be {pad(waiting + 1)} in line with about {wait} min to wait.
        </p>
        <div className="mini-line" aria-hidden="true">
          {Array.from({ length: Math.min(waiting, 8) }, (_, i) => (
            <span key={i} className="p" />
          ))}
          {waiting > 8 && <span className="muted mini-more">+{waiting - 8}</span>}
          <span className="you">You</span>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleJoin}>
          Join queue
        </button>
      </>
    );
  }

  return (
    <>
      <BackLink />
      <div className="detail-head">
        <ServiceTile service={service} size="lg" />
        <div>
          <StatusLabel status={service.open ? 'open' : 'closed'} />
          <h1 id="page-title" tabIndex={-1} className="detail-title">
            {service.name}
          </h1>
        </div>
      </div>
      <p className="lead">{service.desc}</p>
      <div className="split">
        <dl className="details">
          <div>
            <dt>Availability</dt>
            <dd className="small">{service.open ? 'Open · accepting new visitors' : 'Closed · not accepting new visitors'}</dd>
          </div>
          <div>
            <dt>How busy</dt>
            <dd className="small">
              <CrowdMeter wait={wait} />
            </dd>
          </div>
          <div>
            <dt>Expected visit length</dt>
            <dd>{service.duration} min</dd>
          </div>
          <div>
            <dt>People waiting</dt>
            <dd>{waiting}</dd>
          </div>
          <div>
            <dt>Estimated wait if you join now</dt>
            <dd>{wait} min</dd>
          </div>
          {service.location && (
            <div>
              <dt>Location</dt>
              <dd className="small">{service.location}</dd>
            </div>
          )}
          {service.hours && (
            <div>
              <dt>Hours</dt>
              <dd className="small">{service.hours}</dd>
            </div>
          )}
          {service.contact && (
            <div>
              <dt>Contact</dt>
              <dd className="small">{service.contact}</dd>
            </div>
          )}
        </dl>
        <div className="detail-side">
          <div className="panel join-panel">
            {panel}
          </div>
          {service.instructions && (
            <div className="service-instructions">
              <strong>Notes</strong>
              <p>{service.instructions}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
