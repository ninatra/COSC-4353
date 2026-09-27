import { Link } from 'react-router-dom';
import { useMyTicket } from '../components/QueueTicket.jsx';
import { ServiceList } from '../components/ServiceCard.jsx';
import { pad } from '../utils/format.js';

export default function Services() {
  const { service, status, position } = useMyTicket();
  const waiting = status === 'waiting' || status === 'almost';

  return (
    <>
      <p className="eyebrow">Campus services</p>
      <h1 id="page-title" tabIndex={-1}>
        Services
      </h1>
      <p className="lead">
        Hold a place in one line at a time. Estimated wait is the number of people ahead × the service's expected visit
        length.
      </p>
      {waiting && (
        <div className="notice">
          <span>
            <span className="lime-dot" aria-hidden="true" />
            You're {pad(position)} in line for <strong>{service.name}</strong>.
          </span>
          <Link to="/ticket" className="link-arrow">
            View ticket<span aria-hidden="true">&nbsp;→</span>
          </Link>
        </div>
      )}
      <div className="sec-body">
        <ServiceList />
      </div>
    </>
  );
}
