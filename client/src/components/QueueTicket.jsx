import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { findService, positionOf, queueOf, ticketOf, ticketStatus } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { useCountUp } from '../useCountUp.js';
import { fmtTime, pad, people } from '../utils/format.js';
import Icon from './Icon.jsx';

// Everything the screens need to know about the signed-in user's ticket.
export function useMyTicket() {
  const { state } = useQueues();
  const { user } = useAuth();
  const ticket = ticketOf(state, user.email);
  return {
    ticket,
    service: ticket ? findService(state, ticket.serviceId) : null,
    status: ticketStatus(state, user.email),
    position: positionOf(state, user.email),
    lineLength: ticket ? queueOf(state, ticket.serviceId).length : 0,
  };
}

// Desk → a dot per person ahead → "You" → faded dots for people behind.
export function LineStrip({ ahead, behind }) {
  const shownAhead = Math.min(ahead, 5);
  const shownBehind = Math.min(behind, 3);
  return (
    <div className="line-strip" role="img" aria-label={`${people(ahead)} between you and the desk, ${behind} behind you`}>
      <span className="ls-desk">Desk</span>
      {Array.from({ length: shownAhead }, (_, i) => (
        <span key={`a${i}`} className="ls-p" />
      ))}
      {ahead > shownAhead && <span className="ls-more">+{ahead - shownAhead}</span>}
      <span className="ls-you">You</span>
      {Array.from({ length: shownBehind }, (_, i) => (
        <span key={`b${i}`} className="ls-p ls-behind" />
      ))}
      {behind > shownBehind && <span className="ls-more ls-behind">+{behind - shownBehind}</span>}
    </div>
  );
}

function Perforation() {
  return <div className="ticket-perf" aria-hidden="true" />;
}

// The strongest element on the page: the user's place in line.
// variant: 'overview' (links to My ticket) | 'full' (My ticket page)
export default function QueueTicket({ variant }) {
  const { ticket, service, status, position, lineLength } = useMyTicket();
  const previous = useRef(position);
  const bump = previous.current !== null && previous.current !== position;
  useEffect(() => {
    previous.current = position;
  }, [position]);

  const foot =
    variant === 'overview' ? (
      <Link to="/ticket" className="ticket-btn">
        View ticket<span aria-hidden="true">&nbsp;→</span>
      </Link>
    ) : (
      <span className="meta">Joined {fmtTime(ticket.joinedAt)}</span>
    );

  if (status === 'served') {
    return (
      <article className="ticket" aria-label={`Ticket ${ticket.id}, served`}>
        <div className="ticket-main">
          <div className="ticket-top">
            <span>Your latest ticket</span>
            <span className="ticket-status">Served</span>
          </div>
          <h2 className="ticket-service">
            <Icon name={service.icon} />
            {service.name}
          </h2>
          <div className="ticket-nums">
            <div>
              <span className="big">Done</span>
              <span className="lbl">Served at {fmtTime(ticket.servedAt)}</span>
            </div>
          </div>
          <p className="ticket-note">Nice. Your visit is saved in History. Join another line whenever you need to.</p>
        </div>
        <Perforation />
        <div className="ticket-foot">
          <span className="ticket-id">{ticket.id}</span>
          {foot}
        </div>
      </article>
    );
  }

  const ahead = position - 1;
  return <ActiveTicket {...{ ticket, service, status, position, lineLength, ahead, bump, foot }} />;
}

function ActiveTicket({ ticket, service, status, position, lineLength, ahead, bump, foot }) {
  const shownPosition = useCountUp(position);
  const shownWait = useCountUp(ahead * service.duration);
  const note =
    ahead === 0
      ? "You're next · Head to the desk now"
      : `${people(ahead)} ahead of you · ${status === 'almost' ? 'Start heading over' : 'Stay nearby'}`;

  return (
    <article className="ticket" aria-label={`Active ticket ${ticket.id}`}>
      <div className="ticket-main">
        <div className="ticket-top">
          <span>Your active ticket</span>
          <span className="ticket-status">
            <span className="lime-dot" aria-hidden="true" />
            {status === 'almost' ? 'Almost ready' : 'Waiting'}
          </span>
        </div>
        <h2 className="ticket-service">
          <Icon name={service.icon} />
          {service.name}
        </h2>
        <div className="ticket-nums">
          <div>
            <span key={`p${position}`} className={`big ${bump ? 'bump' : ''}`}>
              {pad(shownPosition)}
            </span>
            <span className="lbl">Position in line</span>
          </div>
          <div>
            <span key={`w${position}`} className={`big ${bump ? 'bump' : ''}`}>
              {shownWait}
              <span className="unit">min</span>
            </span>
            <span className="lbl">Estimated wait</span>
          </div>
        </div>
        <LineStrip ahead={ahead} behind={lineLength - position} />
        <p className="ticket-note">{note}</p>
      </div>
      <Perforation />
      <div className="ticket-foot">
        <span className="ticket-id">{ticket.id}</span>
        {foot}
      </div>
    </article>
  );
}

// Static example for the sign-in screen.
export function SampleTicket() {
  return (
    <article className="ticket" aria-label="Example ticket">
      <div className="ticket-main">
        <div className="ticket-top">
          <span>Example ticket</span>
          <span className="ticket-status">
            <span className="lime-dot" aria-hidden="true" />
            Waiting
          </span>
        </div>
        <h2 className="ticket-service">
          <Icon name="laptop" />
          IT Help Desk
        </h2>
        <div className="ticket-nums">
          <div>
            <span className="big">03</span>
            <span className="lbl">Position in line</span>
          </div>
          <div>
            <span className="big">
              16<span className="unit">min</span>
            </span>
            <span className="lbl">Estimated wait</span>
          </div>
        </div>
        <div className="line-strip" aria-hidden="true">
          <span className="ls-desk">Desk</span>
          <span className="ls-p" />
          <span className="ls-p" />
          <span className="ls-you">You</span>
          <span className="ls-p ls-behind" />
          <span className="ls-p ls-behind" />
        </div>
        <p className="ticket-note">2 people ahead of you · Stay nearby</p>
      </div>
      <Perforation />
      <div className="ticket-foot">
        <span className="ticket-id">IT-024</span>
        <span className="meta">Show this at the desk</span>
      </div>
    </article>
  );
}
