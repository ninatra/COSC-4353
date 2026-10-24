import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ServiceTile from '../components/ServiceTile.jsx';
import Icon from '../components/Icon.jsx';
import StatusLabel from '../components/StatusLabel.jsx';
import { findService, historyFor } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { fmtTime } from '../utils/format.js';
import { api } from '../api.js';
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
      {isAdmin ? <AdminHistory state={state} /> : !rows.length ? (
        <EmptyState title="No visits yet" body={isAdmin ? 'Completed visits will be listed here.' : 'Visits you finish, leave, or are removed from will be listed here.'} />
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

function AdminHistory({ state }) {
  const toast = useToast();
  const editDialogRef = useRef(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ outcome: 'completed', problem: '', notes: '' });
  const [filters, setFilters] = useState({ serviceId: '', period: 'today', status: '', search: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ history: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const pageSize = 15;
  const pages = Math.max(1, Math.ceil(data.total / pageSize));
  const change = (key, value) => { setFilters(previous => ({ ...previous, [key]: value })); setPage(1); };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ paginated: 'true', page: String(page), pageSize: String(pageSize) });
        for (const key of ['serviceId', 'status', 'search']) if (filters[key]) query.set(key, filters[key]);
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(start); end.setDate(end.getDate() + 1);
        if (filters.period === 'yesterday') { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); }
        if (filters.period === 'week') start.setDate(start.getDate() - 6);
        if (filters.period === 'custom') {
          if (!filters.from || !filters.to || filters.from > filters.to) throw new Error('Choose a valid start and end date.');
          const from = new Date(`${filters.from}T00:00:00`);
          const to = new Date(`${filters.to}T00:00:00`); to.setDate(to.getDate() + 1);
          query.set('from', from.toISOString()); query.set('to', to.toISOString());
        } else if (filters.period !== 'all') {
          query.set('from', start.toISOString()); query.set('to', end.toISOString());
        }
        const result = await api(`/history?${query}`);
        if (!cancelled) { setData(result); setError(''); }
      } catch (err) { if (!cancelled) setError(err.message); }
      finally { if (!cancelled) setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [filters, page, revision]);

  useEffect(() => { if (editing) editDialogRef.current?.showModal(); }, [editing]);
  function openEdit(row) { setDraft({ outcome: row.outcome, problem: row.problem, notes: row.notes }); setEditing(row); }
  function closeEdit() { editDialogRef.current?.close(); setEditing(null); }
  async function saveEdit(event) {
    event.preventDefault(); setSaving(true);
    try {
      await api(`/history/${editing.id}`, { method: 'PUT', body: editing.result === 'served' ? draft : { notes: draft.notes } });
      closeEdit(); setRevision(value => value + 1); toast('Visit history updated');
    } catch (err) { toast(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className="qtabs history-service-tabs" role="group" aria-label="Filter by service">
        {[{ id: '', name: 'All services' }, ...state.services].map(service => (
          <button type="button" className="qtab" key={service.id} aria-pressed={filters.serviceId === service.id} onClick={() => change('serviceId', service.id)}>
            {service.id ? <ServiceTile service={service} /> : <span className="tile tint-blue" aria-hidden="true"><Icon name="layout-grid" /></span>}
            {service.name}
          </button>
        ))}
      </div>
      <div className="history-filters panel">
        <label>Date range<select value={filters.period} onChange={e => change('period', e.target.value)}>
          <option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">Last 7 days</option><option value="all">All dates</option><option value="custom">Custom range</option>
        </select></label>
        {filters.period === 'custom' && <><label>From<input type="date" value={filters.from} onChange={e => change('from', e.target.value)} /></label><label>Through<input type="date" min={filters.from} value={filters.to} onChange={e => change('to', e.target.value)} /></label></>}
        <label>Status<select value={filters.status} onChange={e => change('status', e.target.value)}>
          <option value="">All statuses</option><option value="SERVED">Served</option><option value="LEFT">Left</option><option value="NO_SHOW">Removed</option>
        </select></label>
        <label className="history-search">Search<input type="search" maxLength={100} placeholder="Student name or ticket ID" value={filters.search} onChange={e => change('search', e.target.value)} /></label>

      </div>
      <div className="history-results-head"><p role="status">{loading ? 'Loading visits…' : `${data.total} matching visits`}</p><button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={() => setRevision(v => v + 1)}>Refresh</button></div>
      {error ? <p role="alert">{error}</p> : !loading && !data.history.length ? <EmptyState icon="history" title="No matching visits" body="Try another service, date range, or search." /> : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="hist"><caption className="sr-only">Filtered visit history, newest first</caption>
            <thead><tr>{['Service', 'Student', 'Date', 'Ticket', 'Issue', 'Outcome', 'Notes', 'Actions'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{data.history.map(row => <tr key={row.id}>
              <td data-label="Service">{row.serviceName}</td><td data-label="Student">{row.visitorName || row.email}</td>
              <td data-label="Date" className="history-date">
                <span>{new Date(row.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span className="muted">{new Date(row.endedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
              </td>
              <td data-label="Ticket" className="mono">{row.ticketId}</td>
              <td data-label="Issue" className="history-note">{row.problem || '—'}</td>
              <td data-label="Outcome"><StatusLabel status={row.outcome || row.result} /></td>
              <td data-label="Notes" className="history-note">{row.notes || '—'}</td>
              <td data-label="Actions"><button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={() => openEdit(row)}><Icon name="pencil" />Edit</button></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
      <nav className="history-pagination" aria-label="History pages">
        <button type="button" className="btn btn-secondary btn-sm" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
        <span>Page {page} of {pages} · {pageSize} per page</span>
        <button type="button" className="btn btn-secondary btn-sm" disabled={loading || page >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
      </nav>
      <dialog ref={editDialogRef} onCancel={closeEdit}>
        {editing && (
          <form className="dlg-inner serve-form" onSubmit={saveEdit}>
            <h2>Edit visit history</h2>
            <p>{editing.visitorName ?? editing.email ?? 'Walk-in'} · <span className="mono">{editing.ticketId}</span></p>
            {editing.result === 'served' && <>
            <label htmlFor="history-problem">Issue (optional)</label>
            <textarea id="history-problem" maxLength={500} value={draft.problem} onChange={(event) => setDraft({ ...draft, problem: event.target.value })} placeholder="What did the student need help with?" />
            <label htmlFor="history-outcome">Outcome</label>
            <select id="history-outcome" value={draft.outcome} onChange={(event) => setDraft({ ...draft, outcome: event.target.value })}>
              <option value="completed">Completed</option>
              <option value="referred">Referred elsewhere</option>
              <option value="unresolved">Unresolved</option>
              <option value="follow-up">Follow-up</option>
            </select>
            </>}
            <label htmlFor="history-notes">Notes</label>
            <textarea id="history-notes" maxLength={500} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
            <div className="dlg-actions">
              <button type="button" className="btn btn-secondary" onClick={closeEdit}>Cancel</button>
              <button type="submit" disabled={saving} className="btn btn-primary">Save changes</button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
