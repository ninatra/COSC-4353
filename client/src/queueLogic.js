// Queue rules and the demo simulation. Selectors read the state; actions change
// a copy ("draft") of it and may return a short message for a toast.
// Estimated wait = people ahead × the service's expected visit length. This is
// deliberately simpler than a production rule set.
import { DEMO_DATE, TINTS } from './mockData.js';
import { pad, people } from './utils/format.js';

// A ticket is "almost ready" at this position or closer.
export const ALMOST_READY_POSITION = 2;

// ---------- Selectors ----------

export const findService = (state, id) => state.services.find((s) => s.id === id);
export const queueOf = (state, id) => state.queues[id] ?? [];
export const waitFor = (state, serviceId) => queueOf(state, serviceId).length * (findService(state, serviceId)?.duration ?? 0);

export const ticketOf = (state, email) => state.tickets[email] ?? null;
export const isWaiting = (state, email) => ticketOf(state, email)?.status === 'waiting';

// 1-based place in line for a waiting ticket, otherwise null.
export function positionOf(state, email) {
  const ticket = ticketOf(state, email);
  if (ticket?.status !== 'waiting') return null;
  const index = queueOf(state, ticket.serviceId).findIndex((v) => v.email === email);
  return index < 0 ? null : index + 1;
}

// 'waiting' | 'almost' | 'served' | null
export function ticketStatus(state, email) {
  const ticket = ticketOf(state, email);
  if (!ticket) return null;
  if (ticket.status === 'served') return 'served';
  const pos = positionOf(state, email);
  return pos && pos <= ALMOST_READY_POSITION ? 'almost' : 'waiting';
}

// 0 = no line, 1 = quiet, 2 = moderate, 3 = busy
export function crowdLevel(waitMinutes) {
  if (waitMinutes === 0) return 0;
  if (waitMinutes <= 15) return 1;
  if (waitMinutes <= 35) return 2;
  return 3;
}

// Newest first, hiding anything the audience cleared.
export function updatesFor(state, audience) {
  const clearedUpTo = state.cleared[audience] ?? 0;
  return state.updates
    .filter((u) => u.audience === audience && u.n > clearedUpTo)
    .sort((a, b) => b.t - a.t || b.n - a.n);
}

export function notificationsFor(state, audience) {
  const read = state.read?.[audience] ?? [];
  return updatesFor(state, audience).filter((u) => u.notify !== false && !read.includes(u.n));
}

export const historyFor = (state, email) => state.history.filter((h) => h.email === email);

// Replaces {svc} in update text with the service's current name.
export function fillService(state, text, serviceId) {
  return text.split('{svc}').join(findService(state, serviceId)?.name ?? 'this service');
}

// ---------- Helpers for actions ----------

function advance(draft, minutes = 2) {
  draft.clock += minutes;
}

function addUpdate(draft, update) {
  draft.updates.push({ n: ++draft.n, t: draft.clock, ...update });
}

function almostUpdate(draft, email, pos) {
  const ticket = draft.tickets[email];
  const service = findService(draft, ticket.serviceId);
  const where = service.location || 'the service desk';
  addUpdate(draft, {
    audience: email,
    kind: 'almost',
    title: 'Almost ready',
    body: pos === 1
      ? `You're next at {svc}. Please come to ${where} now; you have 3 minutes before you may be removed from the queue.`
      : `You're getting close. One person is ahead of you. Please be ready to come to ${where}.`,
    serviceId: ticket.serviceId,
    ticketId: ticket.id,
  });
}

// Runs a change to one service's line and tells every waiting account holder
// in that line how their position moved.
function tracked(draft, serviceId, change, reason) {
  const holders = Object.keys(draft.tickets).filter(
    (email) => draft.tickets[email].status === 'waiting' && draft.tickets[email].serviceId === serviceId,
  );
  const before = Object.fromEntries(holders.map((email) => [email, positionOf(draft, email)]));
  change();
  const service = findService(draft, serviceId);
  for (const email of holders) {
    const after = positionOf(draft, email);
    const was = before[email];
    if (!was || !after || was === after) continue;
    const positionNote = after === 1 ? " You're next." : '';
    addUpdate(draft, {
      audience: email,
      kind: 'position',
      title: 'Position changed',
      body: `${reason ? `${reason} ` : ''}Your current position in line is ${pad(after)}. Your estimated wait is about ${(after - 1) * service.duration} minutes.${positionNote}`,
      serviceId,
      ticketId: draft.tickets[email].id,
    });
    if (after <= ALMOST_READY_POSITION && was > ALMOST_READY_POSITION) almostUpdate(draft, email, after);
  }
}

function recordHistory(draft, email, serviceId, outcome, ticketId, details = {}) {
  draft.history.unshift({
    email,
    date: DEMO_DATE,
    time: draft.clock,
    serviceId,
    serviceName: findService(draft, serviceId).name,
    outcome,
    ticketId,
    ...details,
  });
}

function makePrefix(name) {
  const words = name.replace(/[^A-Za-z\s]/g, '').trim().split(/\s+/).filter(Boolean);
  const prefix = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || 'SV').slice(0, 2)).toUpperCase();
  return prefix.length < 2 ? `${prefix}X` : prefix;
}

function iconForCategory(category) {
  return {
    Academic: 'graduation-cap',
    Financial: 'landmark',
    Technology: 'laptop',
    'Student support': 'id-card',
  }[category] ?? 'building-2';
}

// ---------- Actions ----------

export const actions = {
  // user = { name, email }
  join(draft, serviceId, user) {
    const service = findService(draft, serviceId);
    if (!service?.open) return `${service?.name ?? 'This service'} is closed to new visitors.`;
    if (service.maxCapacity && queueOf(draft, serviceId).length >= service.maxCapacity) return `${service.name} is currently at capacity.`;
    if (isWaiting(draft, user.email)) return 'You can hold one place at a time.';

    advance(draft, 1);
    const number = draft.counters[serviceId] ?? 1;
    draft.counters[serviceId] = number + 1;
    const id = `${service.prefix}-${String(number).padStart(3, '0')}`;
    const line = (draft.queues[serviceId] ??= []);
    line.push({ id, name: user.name, email: user.email, joinedAt: draft.clock });
    const pos = line.length;
    draft.tickets[user.email] = { id, serviceId, status: 'waiting', joinedAt: draft.clock };

    addUpdate(draft, {
      audience: user.email,
      kind: 'confirmed',
      title: 'Ticket confirmed',
      body: `Your ticket ${id} is confirmed for {svc}. You have joined the queue and you're #${pos} in line. The estimated wait is about ${(pos - 1) * service.duration} minutes. Please find a seat in the waiting area and we will see you soon.`,
      serviceId,
      ticketId: id,
    });
    addUpdate(draft, {
      audience: user.email,
      kind: 'joined',
      title: 'Queue joined',
      body: `You are currently #${pos} in the {svc} queue, with an estimated wait of about ${(pos - 1) * service.duration} minutes. We will update you as your position changes.`,
      serviceId,
      ticketId: id,
    });
    if (pos <= ALMOST_READY_POSITION) almostUpdate(draft, user.email, pos);
    addUpdate(draft, { audience: 'admin', kind: 'joined', title: 'Visitor joined', body: `${id} joined {svc}. ${pos} waiting.`, serviceId });
    return `You're in line for ${service.name} · ${id}`;
  },

  leave(draft, email) {
    const ticket = draft.tickets[email];
    if (ticket?.status !== 'waiting') return undefined;
    advance(draft, 1);
    const line = queueOf(draft, ticket.serviceId);
    tracked(draft, ticket.serviceId, () => {
      const index = line.findIndex((v) => v.email === email);
      if (index >= 0) line.splice(index, 1);
    }, 'A visitor ahead of you left the line.');
    recordHistory(draft, email, ticket.serviceId, 'left', ticket.id);
    addUpdate(draft, { audience: email, kind: 'left', title: 'Left queue', body: `You left the {svc} queue. Ticket ${ticket.id} was released, so you are no longer waiting for service. You can join again whenever you are ready.`, serviceId: ticket.serviceId, ticketId: ticket.id });
    addUpdate(draft, { audience: 'admin', kind: 'left', title: 'Visitor left', body: `${ticket.id} left {svc}. ${line.length} waiting.`, serviceId: ticket.serviceId });
    delete draft.tickets[email];
    return 'You left the line. Your place was released.';
  },

  serveNext(draft, serviceId, completion = {}) {
    const line = queueOf(draft, serviceId);
    if (!line.length) return undefined;
    advance(draft, 3);
    const served = line[0];
    tracked(draft, serviceId, () => line.shift(), `${served.id} was served.`);
    const ticket = served.email && draft.tickets[served.email];
    recordHistory(draft, served.email ?? null, serviceId, completion.outcome || 'completed', served.id, {
      visitorName: served.name,
      problem: completion.problem?.trim() || '',
      notes: completion.notes?.trim() || '',
    });
    if (ticket?.id === served.id) {
      ticket.status = 'served';
      ticket.servedAt = draft.clock;
      addUpdate(draft, { audience: served.email, kind: 'served', title: 'Visit completed', body: `You've been served at {svc}. Your visit for ticket ${served.id} is complete, and this queue entry has been added to your history.`, serviceId, ticketId: served.id });
    }
    addUpdate(draft, { audience: 'admin', kind: 'served', title: 'Visitor served', body: `${served.id} (${served.name}) was served at {svc}.`, serviceId });
    return `Served ${served.id} · ${served.name}`;
  },

  // direction: -1 moves the visitor up one place, +1 moves them down.
  move(draft, serviceId, visitorId, direction) {
    const line = queueOf(draft, serviceId);
    const from = line.findIndex((v) => v.id === visitorId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= line.length) return undefined;
    advance(draft, 1);
    tracked(draft, serviceId, () => {
      const [visitor] = line.splice(from, 1);
      line.splice(to, 0, visitor);
    }, 'Staff reordered the line.');
    return undefined;
  },

  moveTo(draft, serviceId, visitorId, targetIndex) {
    const line = queueOf(draft, serviceId);
    const from = line.findIndex((visitor) => visitor.id === visitorId);
    if (from < 0 || targetIndex < 0 || targetIndex >= line.length || from === targetIndex) return undefined;
    advance(draft, 1);
    tracked(draft, serviceId, () => {
      const [visitor] = line.splice(from, 1);
      line.splice(targetIndex, 0, visitor);
    }, 'Staff reordered the line.');
    return undefined;
  },

  removeVisitor(draft, serviceId, visitorId) {
    const line = queueOf(draft, serviceId);
    const index = line.findIndex((v) => v.id === visitorId);
    if (index < 0) return undefined;
    advance(draft, 1);
    let visitor;
    tracked(draft, serviceId, () => {
      [visitor] = line.splice(index, 1);
    }, 'A visitor ahead of you left the line.');
    const ticket = visitor.email && draft.tickets[visitor.email];
    if (ticket?.id === visitor.id) {
      recordHistory(draft, visitor.email, serviceId, 'removed', visitor.id);
      addUpdate(draft, { audience: visitor.email, kind: 'removed', title: 'Removed from queue', body: `Your ticket ${visitor.id} was removed from the {svc} queue because your service window expired. If you rejoin, you will start at the end of the line.`, serviceId, ticketId: visitor.id });
      delete draft.tickets[visitor.email];
    }
    addUpdate(draft, { audience: 'admin', kind: 'removed', title: 'Visitor removed', body: `${visitor.id} (${visitor.name}) was removed from {svc}.`, serviceId });
    return `Removed ${visitor.name}`;
  },

  toggleOpen(draft, serviceId) {
    const service = findService(draft, serviceId);
    advance(draft, 1);
    service.open = !service.open;
    const waiting = queueOf(draft, serviceId).length;
    addUpdate(draft, {
      audience: 'admin',
      kind: service.open ? 'opened' : 'closed',
      title: service.open ? 'Queue opened' : 'Queue closed',
      body: service.open ? '{svc} is accepting new visitors.' : `{svc} closed to new visitors. ${people(waiting)} kept their place.`,
      serviceId,
    });
    if (!service.open) {
      for (const [email, ticket] of Object.entries(draft.tickets)) {
        if (ticket.status === 'waiting' && ticket.serviceId === serviceId) {
          addUpdate(draft, { audience: email, kind: 'closed', title: 'Service closed to new visitors', body: `{svc} is no longer accepting new visitors, but your place is kept. You are still in line and will be notified when your position changes.`, serviceId, ticketId: ticket.id });
        }
      }
    }
    return `${service.name} ${service.open ? 'is open' : 'is closed to new visitors'}`;
  },

  // For the Service Management screen.
  // values contains the public service details and queue settings.
  // Pass serviceId to edit an existing service; leave it out to create one.
  saveService(draft, values, serviceId) {
    advance(draft, 1);
    if (serviceId) {
      const service = findService(draft, serviceId);
      const changes = [];
      if (service.name !== values.name) changes.push(`renamed from “${service.name}”`);
      if (service.duration !== values.duration) changes.push(`expected duration ${service.duration} → ${values.duration} min`);
      if (service.desc !== values.desc) changes.push('description edited');
      if (service.priority !== values.priority) changes.push(`priority set to ${values.priority}`);
      if (service.location !== values.location) changes.push('location edited');
      if (service.contact !== values.contact) changes.push('contact information edited');
      if (service.hours !== values.hours) changes.push('hours edited');
      if (service.category !== values.category) changes.push('category changed');
      if (service.maxCapacity !== values.maxCapacity) changes.push('capacity changed');
      const durationChanged = service.duration !== values.duration;
      Object.assign(service, {
        name: values.name,
        desc: values.desc,
        duration: values.duration,
        priority: values.priority,
        location: values.location,
        contact: values.contact,
        hours: values.hours,
        category: values.category,
        icon: iconForCategory(values.category),
        maxCapacity: values.maxCapacity,
        instructions: values.instructions,
      });
      delete service.appointmentRequired;
      addUpdate(draft, { audience: 'admin', kind: 'edit', title: 'Service updated', body: `{svc}: ${changes.join(', ') || 'no changes'}.`, serviceId, notify: false });
      if (durationChanged) {
        for (const [email, ticket] of Object.entries(draft.tickets)) {
          if (ticket.status !== 'waiting' || ticket.serviceId !== serviceId) continue;
          const ahead = positionOf(draft, email) - 1;
          addUpdate(draft, { audience: email, kind: 'wait', title: 'Wait estimate updated', body: `Your estimated wait for {svc} is now about ${ahead * values.duration} minutes because each visit is expected to take ${values.duration} minutes. Your position in line is unchanged.`, serviceId, ticketId: ticket.id });
        }
      }
      return `Saved ${values.name}`;
    }
    const id = `svc${++draft.n}`;
    draft.services.push({
      id,
      name: values.name,
      desc: values.desc,
      duration: values.duration,
      priority: values.priority,
      open: values.open,
      location: values.location,
      contact: values.contact,
      hours: values.hours,
      category: values.category,
      icon: iconForCategory(values.category),
      maxCapacity: values.maxCapacity,
      instructions: values.instructions,
      tint: TINTS[draft.services.length % TINTS.length],
      prefix: makePrefix(values.name),
    });
    draft.queues[id] = [];
    draft.counters[id] = 1;
    addUpdate(draft, { audience: 'admin', kind: 'created', title: 'Service created', body: `{svc} was created${values.open ? ' and is open.' : ' and is closed.'}`, serviceId: id, notify: false });
    return `Created ${values.name}`;
  },

  deleteService(draft, serviceId) {
    const service = findService(draft, serviceId);
    if (!service) return undefined;
    const waiting = queueOf(draft, serviceId).length;
    if (waiting) return `Close or clear ${service.name} before deleting it.`;
    draft.services = draft.services.filter((item) => item.id !== serviceId);
    delete draft.queues[serviceId];
    delete draft.counters[serviceId];
    addUpdate(draft, { audience: 'admin', kind: 'deleted', title: 'Service deleted', body: `${service.name} was deleted.`, serviceId, notify: false });
    return `Deleted ${service.name}`;
  },

  updateHistory(draft, historyIndex, changes) {
    const entry = draft.history[historyIndex];
    if (!entry) return undefined;
    entry.outcome = changes.outcome;
    entry.problem = changes.problem?.trim() || '';
    entry.notes = changes.notes?.trim() || '';
    return 'Visit history updated';
  },

  // For the Updates screen: hides everything currently listed for this audience.
  clearUpdates(draft, audience) {
    draft.cleared[audience] = draft.n;
    return 'Updates cleared';
  },

  markUpdateRead(draft, audience, updateNumber) {
    const read = (draft.read ??= {});
    const audienceRead = (read[audience] ??= []);
    if (!audienceRead.includes(updateNumber)) audienceRead.push(updateNumber);
    return undefined;
  },

  markAllUpdatesRead(draft, audience) {
    const read = (draft.read ??= {});
    read[audience] = updatesFor(draft, audience).map((update) => update.n);
    return undefined;
  },

  // Clears a served ticket from the user's screens.
  dismissTicket(draft, email) {
    if (draft.tickets[email]?.status === 'served') delete draft.tickets[email];
  },

  markCelebrated(draft, email) {
    if (draft.tickets[email]) draft.tickets[email].celebrated = true;
  },
};
