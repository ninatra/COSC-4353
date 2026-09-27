import { useAuth } from '../AuthContext.jsx';
import { fillService, ticketOf, updatesFor } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { fmtTime } from '../utils/format.js';
import Icon from './Icon.jsx';

const KIND_DOT = {
  confirmed: 'var(--text)',
  joined: 'var(--text)',
  position: 'var(--ticket)',
  almost: 'var(--warn)',
  served: 'var(--ok)',
  left: 'var(--muted)',
  removed: 'var(--bad)',
  closed: 'var(--muted)',
  wait: 'var(--ticket)',
};

function TimelineItem({ title, body, time, variant, dot }) {
  return (
    <li className={`tl-item ${variant ?? ''}`} style={dot ? { '--dot': dot } : undefined}>
      <span className="tl-dot" aria-hidden="true" />
      <div className="tl-body">
        <div className="tl-head">
          <span className="tl-title">{title}</span>
          <span className="tl-time">{time}</span>
        </div>
        <p>{body}</p>
      </div>
    </li>
  );
}

// "While you wait": what has happened to the current ticket, plus what's next.
export default function ActivityTimeline() {
  const { state } = useQueues();
  const { user } = useAuth();
  const ticket = ticketOf(state, user.email);
  const mine = updatesFor(state, user.email).reverse(); // oldest first

  const note = (
    <p className="tl-note">
      <Icon name="info" />
      Updates appear here while this page is open.
    </p>
  );

  if (!ticket) {
    const recent = mine.slice(-3).reverse();
    if (!recent.length) {
      return (
        <>
          <p className="muted tl-empty">No activity yet. When you join a line, confirmations and position changes show up here.</p>
          {note}
        </>
      );
    }
    return (
      <>
        <ol className="timeline">
          {recent.map((u, i) => (
            <TimelineItem key={u.n} title={u.title} body={fillService(state, u.body, u.serviceId)} time={fmtTime(u.t)} variant={i === 0 ? 'latest' : ''} dot={KIND_DOT[u.kind]} />
          ))}
        </ol>
        {note}
      </>
    );
  }

  const events = mine.filter((u) => u.ticketId === ticket.id);
  return (
    <>
      <ol className="timeline">
        {events.map((u, i) => (
          <TimelineItem key={u.n} title={u.title} body={fillService(state, u.body, u.serviceId)} time={fmtTime(u.t)} variant={i === events.length - 1 ? 'latest' : ''} dot={KIND_DOT[u.kind]} />
        ))}
        {ticket.status === 'waiting' && !events.some((u) => u.kind === 'almost') && (
          <TimelineItem title="Almost ready" body="Flagged when one person is ahead of you." time="Upcoming" variant="upcoming" />
        )}
        {ticket.status === 'waiting' && (
          <TimelineItem title="Visit completed" body="Marked when staff finish helping you." time="Upcoming" variant="upcoming" />
        )}
      </ol>
      {note}
    </>
  );
}
