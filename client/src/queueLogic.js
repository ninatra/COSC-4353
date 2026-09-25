// Queue rules for the mock front end. Selectors read the state; actions change
// a copy ("draft") of it. QueueContext wires the actions up to React.
import { PRIORITY_RANK } from './mockData.js';

// Users at this position or closer are told they are "almost ready".
export const ALMOST_READY_POSITION = 2;

const ACTIVE_STATUSES = ['WAITING', 'SERVING'];

// ---------- Selectors ----------

export const findService = (state, id) => state.services.find((s) => s.id === id);
export const findEntry = (state, id) => state.entries.find((e) => e.id === id);

export const servingEntry = (state, serviceId) =>
  state.entries.find((e) => e.serviceId === serviceId && e.status === 'SERVING');

// The ordered waiting line for a service, with each person's position and wait.
export function waitingLine(state, serviceId) {
  const service = findService(state, serviceId);
  const aheadOffset = servingEntry(state, serviceId) ? 1 : 0;
  return (state.queues[serviceId] ?? []).map((id, index) => ({
    entry: findEntry(state, id),
    position: index + 1,
    estimatedWait: (index + aheadOffset) * service.expectedDuration,
  }));
}

// Everyone currently in line or being served.
export function peopleInQueue(state, serviceId) {
  return (state.queues[serviceId]?.length ?? 0) + (servingEntry(state, serviceId) ? 1 : 0);
}

// Estimated wait for someone who joins right now.
export function waitForNewArrival(state, serviceId) {
  return peopleInQueue(state, serviceId) * findService(state, serviceId).expectedDuration;
}

// WAITING is split into WAITING and ALMOST_READY depending on position.
export function statusOf(state, entry) {
  if (entry.status !== 'WAITING') return entry.status;
  const position = (state.queues[entry.serviceId] ?? []).indexOf(entry.id) + 1;
  return position <= ALMOST_READY_POSITION ? 'ALMOST_READY' : 'WAITING';
}

// The user's current queues. position is 0 while they are being served.
export function activeEntriesFor(state, email) {
  return state.entries
    .filter((e) => e.userEmail === email && ACTIVE_STATUSES.includes(e.status))
    .map((entry) => {
      const service = findService(state, entry.serviceId);
      if (entry.status === 'SERVING') {
        return { entry, service, position: 0, peopleAhead: 0, estimatedWait: 0, status: 'SERVING' };
      }
      const spot = waitingLine(state, entry.serviceId).find((w) => w.entry.id === entry.id);
      return {
        entry,
        service,
        position: spot.position,
        peopleAhead: spot.position - 1 + (servingEntry(state, entry.serviceId) ? 1 : 0),
        estimatedWait: spot.estimatedWait,
        status: statusOf(state, entry),
      };
    });
}

export function activeEntryFor(state, email, serviceId) {
  return activeEntriesFor(state, email).find((a) => a.service.id === serviceId);
}

// The user's finished visits (served, left, removed, no-show), newest first.
export function historyFor(state, email) {
  return state.entries
    .filter((e) => e.userEmail === email && !ACTIVE_STATUSES.includes(e.status))
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    .map((entry) => ({ entry, service: findService(state, entry.serviceId) }));
}

export function notificationsFor(state, user) {
  if (!user) return [];
  const audience = user.role === 'ADMIN' ? 'ADMIN' : user.email;
  return state.notifications.filter((n) => n.to === audience);
}

// ---------- Actions (mutate the draft passed in) ----------

function notify(draft, to, message) {
  draft.notifications.unshift({
    id: draft.nextId++,
    to,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

const STATUS_MESSAGES = {
  WAITING: (name, position) => `Your place in the ${name} queue changed. You are now number ${position}.`,
  ALMOST_READY: (name, position) => `You're almost up at ${name} (number ${position}). Please head to the service desk.`,
  SERVING: (name) => `It's your turn at ${name}!`,
  SERVED: (name) => `Your visit at ${name} is complete.`,
  REMOVED: (name) => `You were removed from the ${name} queue by staff.`,
};

// Runs `mutate`, then notifies every person in the service whose status changed.
function withStatusNotifications(draft, serviceId, mutate) {
  const before = new Map(
    draft.entries.filter((e) => e.serviceId === serviceId).map((e) => [e.id, statusOf(draft, e)]),
  );
  mutate();
  const service = findService(draft, serviceId);
  for (const entry of draft.entries) {
    if (!before.has(entry.id)) continue;
    const status = statusOf(draft, entry);
    if (status === before.get(entry.id) || !STATUS_MESSAGES[status]) continue;
    const position = (draft.queues[serviceId] ?? []).indexOf(entry.id) + 1;
    notify(draft, entry.userEmail, STATUS_MESSAGES[status](service.name, position));
  }
}

function removeFromLine(draft, serviceId, entryId) {
  const line = draft.queues[serviceId] ?? [];
  const index = line.indexOf(entryId);
  if (index !== -1) line.splice(index, 1);
}

export const actions = {
  joinQueue(draft, serviceId, user) {
    const service = findService(draft, serviceId);
    if (!service?.isOpen || activeEntryFor(draft, user.email, serviceId)) return;

    const newEntry = {
      id: draft.nextId++,
      serviceId,
      userName: user.name,
      userEmail: user.email,
      priority: 'MEDIUM',
      status: 'WAITING',
      joinedAt: new Date().toISOString(),
      servedAt: null,
      completedAt: null,
    };
    withStatusNotifications(draft, serviceId, () => {
      draft.entries.push(newEntry);
      const line = (draft.queues[serviceId] ??= []);
      // Go behind everyone with the same or higher priority.
      const rank = PRIORITY_RANK[newEntry.priority];
      const index = line.findIndex((id) => PRIORITY_RANK[findEntry(draft, id).priority] > rank);
      line.splice(index === -1 ? line.length : index, 0, newEntry.id);
    });

    const position = draft.queues[serviceId].indexOf(newEntry.id) + 1;
    notify(draft, user.email, `You joined the ${service.name} queue. You are number ${position} in line.`);
    notify(draft, 'ADMIN', `${user.name} joined the ${service.name} queue.`);
  },

  leaveQueue(draft, serviceId, email) {
    const active = activeEntryFor(draft, email, serviceId);
    if (!active) return;
    const entry = findEntry(draft, active.entry.id);
    withStatusNotifications(draft, serviceId, () => {
      removeFromLine(draft, serviceId, entry.id);
      entry.status = 'LEFT';
      entry.completedAt = new Date().toISOString();
    });
    notify(draft, 'ADMIN', `${entry.userName} left the ${active.service.name} queue.`);
  },

  // Finishes the person being served and calls the next person in line.
  serveNext(draft, serviceId) {
    withStatusNotifications(draft, serviceId, () => {
      const now = new Date().toISOString();
      const current = servingEntry(draft, serviceId);
      if (current) {
        current.status = 'SERVED';
        current.completedAt = now;
      }
      const nextId = draft.queues[serviceId]?.shift();
      if (nextId) {
        const next = findEntry(draft, nextId);
        next.status = 'SERVING';
        next.servedAt = now;
      }
    });
  },

  // direction: -1 moves the person up one spot, +1 moves them down.
  moveEntry(draft, serviceId, entryId, direction) {
    const line = draft.queues[serviceId] ?? [];
    const from = line.indexOf(entryId);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= line.length) return;
    withStatusNotifications(draft, serviceId, () => {
      [line[from], line[to]] = [line[to], line[from]];
    });
  },

  removeEntry(draft, serviceId, entryId) {
    const entry = findEntry(draft, entryId);
    if (!entry || !ACTIVE_STATUSES.includes(entry.status)) return;
    withStatusNotifications(draft, serviceId, () => {
      removeFromLine(draft, serviceId, entryId);
      entry.status = 'REMOVED';
      entry.completedAt = new Date().toISOString();
    });
  },

  setServiceOpen(draft, serviceId, isOpen) {
    const service = findService(draft, serviceId);
    if (!service || service.isOpen === isOpen) return;
    service.isOpen = isOpen;
    const message = isOpen
      ? `The ${service.name} queue is open again.`
      : `The ${service.name} queue is closed to new arrivals. You keep your place in line.`;
    for (const id of draft.queues[serviceId] ?? []) {
      notify(draft, findEntry(draft, id).userEmail, message);
    }
  },

  // For the Service Management screen: data = { name, description, expectedDuration, priority }
  addService(draft, data) {
    const id = draft.nextId++;
    draft.services.push({ id, isOpen: true, ...data });
    draft.queues[id] = [];
  },

  updateService(draft, serviceId, data) {
    const service = findService(draft, serviceId);
    if (service) Object.assign(service, data);
  },

  markNotificationsRead(draft, ids) {
    for (const n of draft.notifications) {
      if (ids.includes(n.id)) n.read = true;
    }
  },
};
