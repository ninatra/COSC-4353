import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import ActivityTimeline from '../components/ActivityTimeline.jsx';
import { TicketArt } from '../components/EmptyState.jsx';
import QueueTicket, { useMyTicket } from '../components/QueueTicket.jsx';
import { ServiceList } from '../components/ServiceCard.jsx';
import { useQueues } from '../QueueContext.jsx';
import { useCelebration } from '../useCelebration.js';
import { firstName } from '../utils/format.js';

export default function Overview() {
  const { user } = useAuth();
  const { state } = useQueues();
  const { ticket, status } = useMyTicket();
  useCelebration();

  const openCount = state.services.filter((s) => s.open).length;
  const lead = !ticket
    ? "You're not in a line right now. Pick a service below to save your place."
    : status === 'served'
      ? "Your visit is done. Here's the summary."
      : 'Your place is saved. Here’s where things stand.';

  return (
    <>
      <section aria-labelledby="page-title">
        <p className="eyebrow">Campus services</p>
        <h1 id="page-title" tabIndex={-1}>
          Hey, {firstName(user.name)}.
        </h1>
        <p className="lead">{lead}</p>
      </section>

      <div className="split">
        <div>
          {ticket ? (
            <QueueTicket variant="overview" />
          ) : (
            <div className="no-ticket">
              <TicketArt />
              <div>
                <h2>No active ticket</h2>
                <p>Join an open service and your ticket, position, and estimated wait will show here.</p>
                <Link to="/services" className="btn btn-primary">
                  Browse services
                </Link>
              </div>
            </div>
          )}
        </div>
        <section className="side" aria-labelledby="tl-title">
          <h2 id="tl-title">While you wait</h2>
          <ActivityTimeline />
        </section>
      </div>

      <section className="sec" aria-labelledby="svc-title">
        <div className="sec-head">
          <h2 id="svc-title">Find a service</h2>
          <p className="count">
            <b>{openCount} open now</b> / {state.services.length} total
          </p>
        </div>
        <ServiceList />
      </section>
    </>
  );
}
