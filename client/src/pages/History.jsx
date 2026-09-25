// TODO (teammate): History screen.
//
// Build here: a table of the user's past queues with Date, Service name and
// Outcome columns. Bonus: filter by service or by outcome.
//
// Getting the data (mock data, no backend needed):
//   const { user } = useAuth();                  // from '../AuthContext.jsx'
//   const { state } = useQueues();               // from '../QueueContext.jsx'
//   const visits = historyFor(state, user.email); // from '../queueLogic.js'
//   // each item: { entry, service }
//   //   entry.joinedAt    ISO date string (use formatDate from '../utils/format.js')
//   //   entry.status      SERVED | LEFT | REMOVED | NO_SHOW (use <StatusBadge status={...} />)
//   //   service.name
//
// Log in as user@queuesmart.dev to see five past visits in the demo data.

export default function History() {
  return (
    <section className="stack">
      <h1>History</h1>
      <div className="card">
        <p className="muted">This screen is under construction.</p>
      </div>
    </section>
  );
}
