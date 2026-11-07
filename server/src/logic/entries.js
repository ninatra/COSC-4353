// Keep the existing client response shape while storing normalized relations.
export const entryInclude = {
  queue: { include: { service: true } },
  history: true,
};

export function serviceView(service) {
  if (!service) return null;
  const { queue, ...data } = service;
  return { ...data, isOpen: queue?.status === 'OPEN', queueId: queue?.id };
}

export function entryView(entry) {
  if (!entry) return null;
  const { queue, history, ...data } = entry;
  return {
    ...data,
    serviceId: queue.serviceId,
    service: serviceView({ ...queue.service, queue }),
    ...(history ? {
      status: history.status, servedAt: history.servedAt, completedAt: history.completedAt,
      problem: history.problem, outcome: history.outcome, notes: history.notes,
    } : {}),
  };
}

export const serviceFilter = serviceId => ({ queue: { serviceId } });

export async function refreshPositions(db, queueId) {
  const entries = await db.queueEntry.findMany({
    where: { queueId, status: 'WAITING' }, orderBy: [{ position: 'asc' }, { joinedAt: 'asc' }, { id: 'asc' }],
  });
  for (const [index, entry] of entries.entries()) {
    if (entry.position !== index + 1) await db.queueEntry.update({ where: { id: entry.id }, data: { position: index + 1 } });
  }
}

export async function finishEntry(db, entry, status, details = {}) {
  const now = new Date();
  const finished = await db.queueEntry.update({
    where: { id: entry.id },
    data: {
      status: status === 'SERVED' ? 'SERVED' : 'CANCELED', position: null,
      history: { create: { status, completedAt: now, servedAt: status === 'SERVED' ? now : null, ...details } },
    }, include: entryInclude,
  });
  await refreshPositions(db, entry.queueId);
  return entryView(finished);
}
