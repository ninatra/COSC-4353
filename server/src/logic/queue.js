const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function formatTicketId(serviceName, entryId) {
  const words = serviceName.replace(/[^A-Za-z\s]/g, '').trim().split(/\s+/).filter(Boolean);
  const prefix = (words[0]?.length === 2 && words[0] === words[0].toUpperCase() ? words[0] : words.length > 1 ? words[0][0] + words[1][0] : (words[0] || 'SV').slice(0, 2)).toUpperCase().padEnd(2, 'X');
  return `${prefix}-${String(entryId).padStart(3, '0')}`;
}

export function orderQueue(entries) {
  return [...entries].sort((a, b) => ((a.manualOrder ?? Infinity) - (b.manualOrder ?? Infinity) || 0)
    || (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1)
    || new Date(a.joinedAt) - new Date(b.joinedAt) || a.id - b.id);
}

export function validateReorder(body, currentIds) {
  if (!body || !Array.isArray(body.entryIds) || !Array.isArray(body.previousIds)
    || [...body.entryIds, ...body.previousIds].some(id => !Number.isSafeInteger(id) || id < 1)
    || new Set(body.entryIds).size !== body.entryIds.length) {
    return { status: 400, error: 'Provide unique queue entry IDs and the previous order' };
  }
  if (body.previousIds.length !== currentIds.length || body.previousIds.some((id, index) => id !== currentIds[index])) {
    return { status: 409, error: 'The queue changed. Refresh and try again.' };
  }
  if (body.entryIds.length !== currentIds.length || body.entryIds.some(id => !currentIds.includes(id))) {
    return { status: 400, error: 'Reorder must include every waiting visitor exactly once' };
  }
  return null;
}

export function joinError(service, activeEntry, waitingCount) {
  if (!service) return { status: 404, error: 'Service not found' };
  if (!service.isOpen) return { status: 409, error: 'This service is closed to new visitors' };
  if (activeEntry) return { status: 409, error: 'You can hold one place at a time' };
  if (service.maxCapacity !== null && waitingCount >= service.maxCapacity) return { status: 409, error: 'This queue is at capacity' };
  return null;
}

export function positionInQueue(entries, entryId, duration) {
  const index = orderQueue(entries).findIndex(entry => entry.id === entryId);
  return { position: index < 0 ? null : index + 1, estimatedWait: index < 0 ? null : index * duration };
}

export function validateCompletion(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Visit details must be an object' };
  const { outcome = 'completed', problem = '', notes = '' } = body;
  if (!['completed', 'referred', 'unresolved', 'follow-up'].includes(outcome)) return { error: 'Invalid visit outcome' };
  if ([problem, notes].some(value => typeof value !== 'string' || value.trim().length > 500)) return { error: 'Problem and notes must be text of at most 500 characters' };
  if (body.entryId !== undefined && (!Number.isInteger(body.entryId) || body.entryId < 1)) return { error: 'Invalid queue entry ID' };
  return { data: { outcome, problem: problem.trim(), notes: notes.trim() } };
}
