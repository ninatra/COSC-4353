import { useAuth } from '../AuthContext.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ServiceTile from '../components/ServiceTile.jsx';
import StatusLabel from '../components/StatusLabel.jsx';
import { findService, historyFor } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { fmtTime } from '../utils/format.js';

export default function History() {
  const { user } = useAuth();
  const { state } = useQueues();
  const rows = historyFor(state, user.email);

  return (
    <>
      <p className="eyebrow">My visits</p>
      <h1 id="page-title" tabIndex={-1}>
        History
      </h1>
      <p className="lead">Past queues you joined and how each visit ended.</p>
      {!rows.length ? (
        <EmptyState title="No visits yet" body="Visits you finish, leave, or are removed from will be listed here." />
      ) : (
        <div className="table-wrap">
          <table className="hist">
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Date</th>
                <th scope="col">Ticket</th>
                <th scope="col">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const service = findService(state, row.serviceId) ?? {
                  name: row.serviceName,
                  icon: 'building-2',
                  tint: 'sun',
                };
                return (
                  <tr key={`${row.ticketId}-${row.date}`}>
                    <td data-label="Service">
                      <span className="hist-svc">
                        <ServiceTile service={service} size="sm" />
                        {service.name}
                      </span>
                    </td>
                    <td data-label="Date">
                      {row.date}
                      {row.time != null && <span className="muted"> · {fmtTime(row.time)}</span>}
                    </td>
                    <td data-label="Ticket" className="mono">
                      {row.ticketId}
                    </td>
                    <td data-label="Outcome">
                      <StatusLabel status={row.outcome} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
