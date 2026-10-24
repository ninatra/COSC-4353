// Builds the in-app notifications for queue events. These functions only
// return data; the routes save it. Nothing is sent by email or text.

// A visitor is "almost ready" once they reach this position or better.
export const ALMOST_READY_POSITION = 2;

const where = (service) => service.location || 'the service desk';

// One notice for the visitor, plus notices for every administrator.
export function joinNotifications({ entry, service, position, waitingCount, userId, adminIds }) {
  const wait = (position - 1) * service.expectedDuration;
  const about = { serviceId: service.id, ticketId: entry.ticketId, entryId: entry.id };
  const notices = [{
    ...about, userId, kind: 'confirmed', title: 'Ticket confirmed',
    message: `Your ticket ${entry.ticketId} is confirmed for ${service.name}. You're #${position} in line, with an estimated wait of about ${wait} minutes.`,
  }];
  for (const adminId of adminIds) {
    notices.push({ ...about, userId: adminId, kind: 'joined', title: 'Visitor joined',
      message: `${entry.ticketId} joined ${service.name}. ${waitingCount} waiting.` });
    if (waitingCount === 1) {
      notices.push({ ...about, userId: adminId, kind: 'queue-active', title: 'First visitor waiting',
        message: `${service.name} has its first visitor waiting.` });
    }
    if (service.maxCapacity !== null && service.maxCapacity !== undefined && waitingCount >= service.maxCapacity) {
      notices.push({ ...about, userId: adminId, kind: 'capacity', title: 'Queue at capacity',
        message: `${service.name} is full (${waitingCount} of ${service.maxCapacity}). New visitors can't join until someone is served.` });
    }
  }
  return notices;
}

// "Almost ready" notices for visitors who just reached the front of an
// ordered queue and haven't been told yet.
export function almostReadyNotifications(ordered, alertedEntryIds, service, nextAlertedEntryIds = []) {
  const alerted = new Set(alertedEntryIds);
  const nextAlerted = new Set(nextAlertedEntryIds);
  return ordered.slice(0, ALMOST_READY_POSITION)
    .filter((entry, index) => entry.status === 'WAITING' && !(index === 0 ? nextAlerted : alerted).has(entry.id))
    .map((entry) => {
      const position = ordered.indexOf(entry) + 1;
      return {
        userId: entry.userId, kind: position === 1 ? 'next' : 'almost', title: position === 1 ? "You're next" : 'Almost ready',
        serviceId: service.id, ticketId: entry.ticketId, entryId: entry.id,
        message: position === 1
          ? `You're next at ${service.name}. Please head to ${where(service)} now.`
          : `You're almost up at ${service.name}. One person is ahead of you, so start heading to ${where(service)}.`,
      };
    });
}

export function servedNotification(entry, service) {
  return {
    userId: entry.userId, kind: 'served', title: 'Visit completed',
    serviceId: service.id, ticketId: entry.ticketId, entryId: entry.id,
    message: `Your visit to ${service.name} is complete. It's saved in your history.`,
  };
}

export function leftNotification(entry, service) {
  return {
    userId: entry.userId, kind: 'left', title: 'Left queue',
    serviceId: service.id, ticketId: entry.ticketId, entryId: entry.id,
    message: `You left ${service.name}. Ticket ${entry.ticketId} was released.`,
  };
}
