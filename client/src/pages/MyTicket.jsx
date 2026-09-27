import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Icon from '../components/Icon.jsx';
import QueueTicket, { useMyTicket } from '../components/QueueTicket.jsx';
import { useToast } from '../components/Toast.jsx';
import { useQueues } from '../QueueContext.jsx';
import { useCelebration } from '../useCelebration.js';
import { fmtTime, pad } from '../utils/format.js';

function Step({ name, time, state, srState }) {
  return (
    <li className={`step ${state}`}>
      <span className="sdot" aria-hidden="true">
        {state === 'done' && <Icon name="check" />}
      </span>
      <strong>{name}</strong>
      <span className="t">{time}</span>
      <span className="sr-only"> ({srState})</span>
    </li>
  );
}

export default function MyTicket() {
  const { user } = useAuth();
  const { state, leave, dismissTicket } = useQueues();
  const { ticket, service, status, position } = useMyTicket();
  const confirm = useConfirm();
  const toast = useToast();
  useCelebration();

  const heading = (
    <>
      <p className="eyebrow">My ticket</p>
      <h1 id="page-title" tabIndex={-1}>
        {service ? service.name : 'My ticket'}
      </h1>
    </>
  );

  if (!ticket) {
    return (
      <>
        {heading}
        <EmptyState
          title="You're not in a line"
          body="Join an open service to get a ticket. You can hold one place at a time."
          action={
            <Link to="/services" className="btn btn-primary">
              Browse services
            </Link>
          }
        />
      </>
    );
  }

  async function handleLeave() {
    const ok = await confirm({
      title: `Leave the ${service.name} line?`,
      body: `Leaving releases your place (${pad(position)}). If you rejoin, you’ll start at the end of the line.`,
      confirmLabel: 'Leave queue',
      cancelLabel: 'Stay in line',
      danger: true,
    });
    if (ok) {
      toast(leave(user.email));
      document.getElementById('page-title')?.focus();
    }
  }

  const almostEvent = state.updates.find((u) => u.ticketId === ticket.id && u.audience === user.email && u.kind === 'almost');
  const where = service.location || 'the service desk';

  const instructions =
    status === 'served'
      ? [
          ['circle-check', 'mint', 'Your visit is recorded in History.'],
          ['arrow-left', 'blue', 'Join another line whenever you need to.'],
        ]
      : status === 'almost'
        ? [
            ['map-pin', 'peach', `Head to ${where} now.`],
            ['ticket', 'blue', <>Show ticket ID <span className="mono">{ticket.id}</span> at the desk.</>],
            ['id-card', 'lilac', 'Have your student ID ready.'],
          ]
        : [
            ['map-pin', 'peach', `Stay within about 5 minutes of ${where}.`],
            ['bell', 'blue', 'Position changes appear in Updates while this page is open.'],
            ['id-card', 'lilac', 'Have your student ID ready.'],
          ];

  const lead =
    status === 'served'
      ? 'Your visit is complete.'
      : status === 'almost'
        ? position === 1
          ? "You're next. Head to the desk."
          : 'One person is ahead of you. Start heading over.'
        : `You're ${pad(position)} in line. This page updates as the line moves.`;

  return (
    <>
      {heading}
      <p className="lead">{lead}</p>
      <div className="split">
        <div>
          <QueueTicket variant="full" />
          <ol className="steps" aria-label="Ticket progress">
            <Step
              name="Joined"
              time={fmtTime(ticket.joinedAt)}
              state={status === 'waiting' ? 'current' : 'done'}
              srState={status === 'waiting' ? 'current step' : 'complete'}
            />
            <Step
              name="Almost ready"
              time={almostEvent ? fmtTime(almostEvent.t) : 'When 1 person is ahead'}
              state={status === 'almost' ? 'current' : status === 'served' ? 'done' : ''}
              srState={status === 'almost' ? 'current step' : status === 'served' ? 'complete' : 'not yet'}
            />
            <Step
              name="Served"
              time={ticket.servedAt ? fmtTime(ticket.servedAt) : 'When staff finish'}
              state={status === 'served' ? 'done' : ''}
              srState={status === 'served' ? 'complete' : 'not yet'}
            />
          </ol>
        </div>

        <section className="side" aria-labelledby="todo-title">
          <h2 id="todo-title">What to do now</h2>
          <ul className="instr">
            {instructions.map(([icon, tint, text], i) => (
              <li key={i}>
                <span className={`tile tile-sm tint-${tint}`} aria-hidden="true">
                  <Icon name={icon} />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          {status === 'served' ? (
            <div className="leave">
              <div className="btn-row">
                <Link to="/services" className="btn btn-primary">
                  Find another service
                </Link>
                <Link to="/history" className="btn btn-secondary">
                  View history
                </Link>
              </div>
              <button type="button" className="btn-text dismiss" onClick={() => dismissTicket(user.email)}>
                Clear this ticket
              </button>
            </div>
          ) : (
            <div className="leave">
              <h3>Leave the line</h3>
              <p>Leaving releases your place. If you rejoin later, you'll start at the end of the line.</p>
              <button type="button" className="btn btn-danger-outline" onClick={handleLeave}>
                <Icon name="log-out" />
                Leave queue
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
