// Turns finished queue entries into history rows for the History screens.

// Queue statuses that mean a visit is over, and what the user sees for each.
const RESULTS = { SERVED: 'served', LEFT: 'left', NO_SHOW: 'removed' };
export const FINISHED_STATUSES = Object.keys(RESULTS);

export function toHistoryRow(entry) {
  return {
    id: entry.id,
    ticketId: entry.ticketId,
    serviceId: entry.serviceId,
    serviceName: entry.service?.name ?? 'Deleted service',
    visitorName: entry.user?.name ?? null,
    email: entry.user?.email ?? null,
    // served | left | removed
    result: RESULTS[entry.status] ?? null,
    // Staff outcome for served visits: completed | referred | unresolved | follow-up
    outcome: entry.status === 'SERVED' ? entry.outcome ?? 'completed' : null,
    problem: entry.problem ?? '',
    notes: entry.notes ?? '',
    joinedAt: entry.joinedAt,
    endedAt: entry.completedAt ?? entry.servedAt ?? entry.joinedAt,
  };
}

// Newest finished visit first.
export function sortHistory(rows) {
  return [...rows].sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt) || b.id - a.id);
}
