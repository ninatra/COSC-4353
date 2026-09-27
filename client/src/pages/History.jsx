// TODO (teammate): History screen (/history).
//
// - Eyebrow "My visits", <h1 id="page-title" tabIndex={-1}>History</h1>,
//   lead "Past visits and how each one ended."
// - A table inside <div className="table-wrap"><table className="hist">:
//   columns Service (with <ServiceTile size="sm">), Date (plus the time if the
//   row has one: `${row.date} · ${fmtTime(row.time)}`), Ticket (<span className="mono">),
//   and Outcome (<StatusLabel status={row.outcome} />: served / left / removed).
//   Give each <td> a data-label (e.g. data-label="Date"); the CSS uses it to
//   stack each row into a block on phones.
// - Empty state: <EmptyState title="No visits yet" body="Visits you finish,
//   leave, or are removed from will be listed here." />
//
// Data (mock, no backend needed):
//   const { state } = useQueues();
//   const { user } = useAuth();
//   const rows = historyFor(state, user.email);   // from '../queueLogic.js', newest first
//   // row: { date, time?, serviceId, serviceName, outcome, ticketId }
//   // The service may have been renamed; use findService(state, row.serviceId) ?? { name: row.serviceName, icon: 'building-2', tint: 'sun' }
//
// Design reference: the prototype's vHistory().

export default function History() {
  return (
    <>
      <p className="eyebrow">My visits</p>
      <h1 id="page-title" tabIndex={-1}>
        History
      </h1>
      <p className="lead">This screen is under construction.</p>
    </>
  );
}
