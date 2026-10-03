import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ServiceTile from '../components/ServiceTile.jsx';
import StatusLabel from '../components/StatusLabel.jsx';
import { findService, historyFor } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { fmtTime } from '../utils/format.js';
import { useToast } from '../components/Toast.jsx';

export default function History() {
  const { user } = useAuth();
  const { state } = useQueues();
  const isAdmin = user.role === 'ADMIN';
  const rows = isAdmin ? state.history.map((row, historyIndex) => ({ ...row, historyIndex })) : historyFor(state, user.email);

  return (
    <>
      <p className="eyebrow">{isAdmin ? 'Administrator' : 'My visits'}</p>
      <h1 id="page-title" tabIndex={-1}>
        {isAdmin ? 'Visit history' : 'History'}
      </h1>
      <p className="lead">{isAdmin ? 'Completed visits across every service.' : 'Past queues you joined and how each visit ended.'}</p>
      {!rows.length ? (
        <EmptyState title="No visits yet" body={isAdmin ? 'Completed visits will be listed here.' : 'Visits you finish, leave, or are removed from will be listed here.'} />
      ) : isAdmin ? (
        <AdminHistory rows={rows} state={state} />
      ) : (
        <div className="table-wrap">
          <table className="hist">
            <thead>
              <tr>
                <th scope="col">Service</th>
                {isAdmin && <th scope="col">Visitor</th>}
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
                    {isAdmin && <td data-label="Visitor">{row.visitorName ?? row.email ?? 'Walk-in'}</td>}
                    <td data-label="Date">
                      {row.date}
                      {row.time != null && <span className="muted"> · {fmtTime(row.time)}</span>}
                    </td>
                    <td data-label="Ticket" className="mono">
                      {row.ticketId}
                    </td>
                    <td data-label="Outcome">
                      <StatusLabel status={row.outcome === 'served' ? 'completed' : row.outcome} />
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

function AdminHistory({ rows, state }) {
  const { updateHistory } = useQueues();
  const toast = useToast();
  const editDialogRef = useRef(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ outcome: 'completed', notes: '' });

  useEffect(() => {
    if (editing) editDialogRef.current?.showModal();
  }, [editing]);

  function openEdit(row) {
    setDraft({ outcome: row.outcome, problem: row.problem ?? '', notes: row.notes ?? '' });
    setEditing(row);
  }

  function closeEdit() {
    editDialogRef.current?.close();
    setEditing(null);
  }

  function saveEdit(event) {
    event.preventDefault();
    editDialogRef.current?.close();
    toast(updateHistory(editing.historyIndex, draft));
    setEditing(null);
  }

  const groups = rows.reduce((result, row) => {
    const key = row.serviceId ?? row.serviceName;
    if (!result[key]) result[key] = [];
    result[key].push(row);
    return result;
  }, {});

  return (
    <div className="history-groups">
      {Object.entries(groups).map(([serviceKey, serviceRows]) => {
        const first = serviceRows[0];
        const service = findService(state, first.serviceId) ?? {
          name: first.serviceName,
          icon: 'building-2',
          tint: 'sun',
        };
        return (
          <section className="history-group" key={serviceKey}>
            <div className="history-group-head">
              <ServiceTile service={service} size="sm" />
              <h2>{service.name}</h2>
              <span>{serviceRows.length} {serviceRows.length === 1 ? 'visit' : 'visits'}</span>
            </div>
            <div className="table-wrap">
              <table className="hist">
                <thead>
                  <tr>
                    <th scope="col">Visitor</th>
                    <th scope="col">Date</th>
                    <th scope="col">Ticket</th>
                    <th scope="col">Problem</th>
                    <th scope="col">Outcome</th>
                    <th scope="col">Notes</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {serviceRows.map((row, index) => (
                    <tr key={`${row.ticketId}-${row.date}-${index}`}>
                      <td data-label="Visitor">{row.visitorName ?? row.email ?? 'Walk-in'}</td>
                      <td data-label="Date">
                        {row.date}
                        {row.time != null && <span className="muted"> · {fmtTime(row.time)}</span>}
                      </td>
                      <td data-label="Ticket" className="mono">{row.ticketId}</td>
                      <td data-label="Problem" className="history-note">{row.problem || 'Not recorded'}</td>
                      <td data-label="Outcome"><StatusLabel status={row.outcome === 'served' ? 'completed' : row.outcome} /></td>
                      <td data-label="Notes" className="history-note">{row.notes || 'No notes'}</td>
                      <td data-label="Actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(row)}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      <dialog ref={editDialogRef} onCancel={closeEdit}>
        {editing && (
          <form className="dlg-inner serve-form" onSubmit={saveEdit}>
            <h2>Edit visit history</h2>
            <p>{editing.visitorName ?? editing.email ?? 'Walk-in'} · <span className="mono">{editing.ticketId}</span></p>
            <label htmlFor="history-problem">Problem</label>
            <textarea id="history-problem" required value={draft.problem} onChange={(event) => setDraft({ ...draft, problem: event.target.value })} placeholder="What did the student need help with?" />
            <label htmlFor="history-outcome">Outcome</label>
            <select id="history-outcome" value={draft.outcome} onChange={(event) => setDraft({ ...draft, outcome: event.target.value })}>
              <option value="completed">Completed</option>
              <option value="referred">Referred elsewhere</option>
              <option value="unresolved">Unresolved</option>
              <option value="follow-up">Follow-up needed</option>
            </select>
            <label htmlFor="history-notes">Notes</label>
            <textarea id="history-notes" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
            <div className="dlg-actions">
              <button type="button" className="btn btn-secondary" onClick={closeEdit}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save changes</button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
