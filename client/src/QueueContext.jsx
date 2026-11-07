import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './AuthContext.jsx';

// Business data is loaded from the API; browser storage only holds the login
// token and theme. Ticket celebration/dismissal are display state for this visit.
const QueueContext = createContext(null);
const emptyState = () => ({ services: [], queues: {}, tickets: {}, updates: [], read: {}, cleared: {}, history: [] });

export function QueueProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(emptyState);
  const [serviceStatus, setServiceStatus] = useState({ owner: null, loading: true, error: '' });
  const latest = useRef(state);

  function displayService(service) {
    const categoryIcons = { Academic: 'graduation-cap', Financial: 'landmark', Technology: 'laptop', 'Student support': 'id-card' };
    const words = service.name.trim().split(/\s+/);
    return { ...service, id: String(service.id), icon: categoryIcons[service.category] || 'building-2',
      tint: { Academic: 'lilac', Financial: 'sun', Technology: 'blue', 'Student support': 'peach' }[service.category] || 'mint',
      prefix: (words.length > 1 ? words[0][0] + words[1][0] : service.name.slice(0, 2)).toUpperCase() };
  }

  function commit(next) {
    latest.current = next;
    setState(next);
  }

  const dismissedTicket = useRef(null);
  const requestVersion = useRef(0);
  const account = useRef(user?.id);
  const currentEmail = useRef(user?.email);
  account.current = user?.id;
  currentEmail.current = user?.email;

  async function refreshQueues() {
    const version = ++requestVersion.current;
    const owner = user?.id;
    const [{ services }, snapshot, { notifications }, { history }] = await Promise.all([
      api('/services'), api('/queues'), api('/notifications'), user.role === 'ADMIN' ? Promise.resolve({ history: [] }) : api('/history'),
    ]);
    if (version !== requestVersion.current || owner !== account.current || user.email !== currentEmail.current) return;
    const minutes = value => { const date = new Date(value); return date.getHours() * 60 + date.getMinutes(); };
    const ticketId = entry => entry.ticketId;
    const queues = Object.fromEntries(Object.entries(snapshot.queues).map(([id, entries]) => [id, entries.map(entry => ({
      id: ticketId(entry), entryId: entry.id, name: entry.user?.name || 'Visitor', email: entry.user?.email,
      joinedAt: minutes(entry.joinedAt), priority: entry.priority,
    }))]));
    const tickets = {};
    const entry = snapshot.ticket;
    if (entry && entry.id !== dismissedTicket.current) {
      const previous = latest.current.tickets[user.email];
      tickets[user.email] = { id: ticketId(entry), entryId: entry.id, serviceId: String(entry.serviceId),
        status: entry.status === 'SERVED' ? 'served' : 'waiting', joinedAt: minutes(entry.joinedAt),
        initialPosition: entry.initialPosition,
        servedAt: entry.servedAt ? minutes(entry.servedAt) : null,
        celebrated: previous?.entryId === entry.id ? previous.celebrated : false };
    }
    const audience = user.role === 'ADMIN' ? 'admin' : user.email;
    const updates = notifications.map(n => ({
      n: n.id, t: minutes(n.createdAt), at: n.createdAt, audience, kind: n.kind, title: n.title, body: n.message,
      serviceId: n.serviceId ? String(n.serviceId) : undefined, ticketId: n.ticketId, notify: true,
    }));
    const read = { [audience]: notifications.filter(n => n.status === 'VIEWED').map(n => n.id) };
    const day = value => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const historyRows = history.map(row => ({
      entryId: row.id, email: row.email, visitorName: row.visitorName, date: day(row.endedAt), time: minutes(row.endedAt),
      serviceId: String(row.serviceId), serviceName: row.serviceName, ticketId: row.ticketId,
      outcome: user.role === 'ADMIN' && row.outcome ? row.outcome : row.result, problem: row.problem, notes: row.notes,
    }));
    commit({ ...latest.current, services: services.map(displayService), queues, tickets,
      updates, read, cleared: {}, history: historyRows });
  }

  useEffect(() => {
    if (!user) {
      commit(emptyState());
      return;
    }
    let cancelled = false;
    dismissedTicket.current = null;
    setServiceStatus({ owner: user.id, loading: true, error: '' });
    async function refresh() {
      try {
        await refreshQueues();
        if (cancelled) return;
        setServiceStatus({ owner: user.id, loading: false, error: '' });
      } catch (error) {
        if (!cancelled) setServiceStatus({ owner: user.id, loading: false, error: error.message });
      }
    }
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => { cancelled = true; ++requestVersion.current; clearInterval(timer); };
  }, [user?.id, user?.role, user?.email]);

  async function saveService(values, serviceId) {
    const { service } = await api(serviceId ? `/services/${serviceId}` : '/services', {
      method: serviceId ? 'PUT' : 'POST', body: values,
    });
    const next = displayService(service);
    commit({ ...latest.current, services: serviceId
      ? latest.current.services.map(s => s.id === serviceId ? next : s)
      : [...latest.current.services, next] });
    return `${serviceId ? 'Updated' : 'Created'} ${service.name}`;
  }

  async function toggleOpen(serviceId) {
    const current = latest.current.services.find(s => s.id === serviceId);
    const { service } = await api(`/services/${serviceId}`, { method: 'PUT', body: { isOpen: !current.isOpen } });
    commit({ ...latest.current, services: latest.current.services.map(s => s.id === serviceId ? displayService(service) : s) });
    return `${service.name} ${service.isOpen ? 'is open' : 'is closed to new visitors'}`;
  }

  async function deleteService(serviceId) {
    const service = latest.current.services.find(s => s.id === serviceId);
    if (latest.current.queues[serviceId]?.length) throw new Error('Clear the queue before deleting this service.');
    await api(`/services/${serviceId}`, { method: 'DELETE' });
    commit({ ...latest.current, services: latest.current.services.filter(s => s.id !== serviceId) });
    return `Deleted ${service.name}`;
  }

  async function join(serviceId) {
    await api(`/queues/${serviceId}/join`, { method: 'POST' });
    await refreshQueues();
    return 'You joined the queue';
  }

  async function leave() {
    const ticket = latest.current.tickets[user.email];
    if (!ticket) throw new Error('You are not waiting in a queue');
    await api(`/queues/${ticket.serviceId}/leave`, { method: 'POST' });
    await refreshQueues();
    return 'You left the queue';
  }

  async function reorderQueue(serviceId, entryIds, previousIds) {
    try {
      await api(`/queues/${serviceId}/reorder`, { method: 'PUT', body: { entryIds, previousIds } });
    } catch (error) {
      await refreshQueues().catch(() => {});
      throw error;
    }
    await refreshQueues();
    return 'Queue order updated';
  }

  async function removeVisitor(serviceId, entryId, notes = '') {
    await api(`/queues/${serviceId}/entries/${entryId}`, { method: 'DELETE', body: { notes } });
    await refreshQueues();
    return 'Visitor removed from queue';
  }

  async function serveNext(serviceId, completion, entryId) {
    await api(`/queues/${serviceId}/serve-next`, { method: 'POST', body: { ...completion, entryId } });
    await refreshQueues();
    return 'Visit completed';
  }

  // Update the screen only after the database confirms the change.
  async function markUpdateRead(audience, id) {
    await api(`/notifications/${id}/read`, { method: 'PATCH' });
    const read = latest.current.read[audience] ?? [];
    commit({ ...latest.current, read: { ...latest.current.read, [audience]: [...new Set([...read, id])] } });
  }

  async function markAllUpdatesRead(audience) {
    await api('/notifications/read-all', { method: 'PATCH' });
    await refreshQueues();
  }

  async function clearUpdates(audience) {
    await api('/notifications', { method: 'DELETE' });
    commit({ ...latest.current, updates: latest.current.updates.filter(u => u.audience !== audience) });
    return 'Notifications cleared';
  }

  async function updateHistory(historyIndex, changes) {
    const row = latest.current.history[historyIndex];
    await api(`/history/${row.entryId}`, { method: 'PUT', body: changes });
    await refreshQueues();
    return 'Visit history updated';
  }

  function dismissTicket(email) {
    const ticket = latest.current.tickets[email];
    if (ticket?.status !== 'served') return;
    dismissedTicket.current = ticket.entryId;
    const tickets = { ...latest.current.tickets };
    delete tickets[email];
    commit({ ...latest.current, tickets });
  }

  function markCelebrated(email) {
    const ticket = latest.current.tickets[email];
    if (ticket) commit({ ...latest.current, tickets: { ...latest.current.tickets, [email]: { ...ticket, celebrated: true } } });
  }

  const value = {
    state,
    join,
    leave,
    serveNext,
    reorderQueue,
    removeVisitor,
    toggleOpen,
    saveService,
    deleteService,
    updateHistory,
    clearUpdates,
    markUpdateRead,
    markAllUpdatesRead,
    dismissTicket,
    markCelebrated,
  };

  if (user && (serviceStatus.owner !== user.id || serviceStatus.loading)) return <p className="loading" role="status">Loading services…</p>;
  if (user && serviceStatus.error) return <div className="loading" role="alert">{serviceStatus.error} <button type="button" onClick={() => window.location.reload()}>Retry</button></div>;

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueues() {
  return useContext(QueueContext);
}
