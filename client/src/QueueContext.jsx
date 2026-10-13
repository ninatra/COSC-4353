import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { seed, STATE_VERSION } from './mockData.js';
import { actions } from './queueLogic.js';
import { api } from './api.js';
import { useAuth } from './AuthContext.jsx';

// Services come from the API. Queue simulation is still saved locally until
// the queue backend is implemented.
const STORAGE_KEY = 'queuesmart_demo_v3';

const QueueContext = createContext(null);

// Keep saved demos compatible with the previous service field names.
function normalizeServices(state) {
  state.services = state.services.map(({ desc, duration, open, ...service }) => ({
    ...service,
    description: service.description ?? desc,
    expectedDuration: service.expectedDuration ?? duration,
    isOpen: service.isOpen ?? open,
  }));
  return state;
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.v === STATE_VERSION) return normalizeServices(saved);
  } catch {
    // Storage blocked or corrupt: start from the seed data.
  }
  return seed();
}

export function QueueProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(() => ({ ...load(), services: [] }));
  const [serviceStatus, setServiceStatus] = useState({ owner: null, loading: true, error: '' });
  // Latest state, so an action can return its message synchronously.
  const latest = useRef(state);

  useEffect(() => {
    latest.current = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, services: [] }));
    } catch {
      // Not saved; the demo still works for this page load.
    }
  }, [state]);

  useEffect(() => {
    function onStorage(event) {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const next = normalizeServices(JSON.parse(event.newValue));
        next.services = latest.current.services;
        latest.current = next;
        setState(next);
      } catch {
        // Ignore a bad value written by another tab.
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setServiceStatus({ owner: user.id, loading: true, error: '' });
    async function refresh() {
      try {
        const { services } = await api('/services');
        if (cancelled) return;
        const displayed = services.map(displayService);
        const ids = new Set(displayed.map(s => s.id));
        const tickets = Object.fromEntries(Object.entries(latest.current.tickets).filter(([, ticket]) => ids.has(ticket.serviceId)));
        commit({ ...latest.current, services: displayed, tickets });
        setServiceStatus({ owner: user.id, loading: false, error: '' });
      } catch (error) {
        if (!cancelled) setServiceStatus({ owner: user.id, loading: false, error: error.message });
      }
    }
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [user?.id, user?.role]);

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
    const draft = structuredClone(latest.current);
    const message = actions.toggleOpen(draft, serviceId);
    draft.services = draft.services.map(s => s.id === serviceId ? displayService(service) : s);
    commit(draft);
    return message;
  }

  async function deleteService(serviceId) {
    if (latest.current.queues[serviceId]?.length) throw new Error('Clear the queue before deleting this service.');
    await api(`/services/${serviceId}`, { method: 'DELETE' });
    const draft = structuredClone(latest.current);
    const message = actions.deleteService(draft, serviceId);
    commit(draft);
    return message;
  }

  // Each action runs on a copy of the state and returns its toast message, if any.
  const run =
    (name) =>
    (...args) => {
      const draft = structuredClone(latest.current);
      const message = actions[name](draft, ...args);
      latest.current = draft;
      setState(draft);
      return message;
    };

  const value = {
    state,
    join: run('join'),
    leave: run('leave'),
    serveNext: run('serveNext'),
    move: run('move'),
    moveTo: run('moveTo'),
    removeVisitor: run('removeVisitor'),
    toggleOpen,
    saveService,
    deleteService,
    updateHistory: run('updateHistory'),
    clearUpdates: run('clearUpdates'),
    markUpdateRead: run('markUpdateRead'),
    markAllUpdatesRead: run('markAllUpdatesRead'),
    dismissTicket: run('dismissTicket'),
    markCelebrated: run('markCelebrated'),
    resetDemo: () => {
      latest.current = { ...seed(), services: latest.current.services, queues: {}, tickets: {}, counters: {} };
      setState(latest.current);
    },
  };

  if (user && (serviceStatus.owner !== user.id || serviceStatus.loading)) return <p className="loading" role="status">Loading services…</p>;
  if (user && serviceStatus.error) return <div className="loading" role="alert">{serviceStatus.error} <button type="button" onClick={() => window.location.reload()}>Retry</button></div>;

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueues() {
  return useContext(QueueContext);
}
