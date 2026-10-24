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

export function historyQuery(query) {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 15);
  if (!Number.isSafeInteger(page) || page < 1 || ![10, 15, 20].includes(pageSize)) return { error: 'Invalid page or page size' };
  const where = { status: { in: FINISHED_STATUSES } };
  if (query.serviceId) {
    const id = Number(query.serviceId);
    if (!Number.isSafeInteger(id) || id < 1) return { error: 'Invalid service ID' };
    where.serviceId = id;
  }
  if (query.status) {
    if (!FINISHED_STATUSES.includes(query.status)) return { error: 'Invalid visit status' };
    where.status = query.status;
  }
  const dates = {};
  for (const [key, operator] of [['from', 'gte'], ['to', 'lt']]) {
    if (query[key]) {
      const date = new Date(query[key]);
      if (!Number.isFinite(date.getTime())) return { error: 'Invalid date range' };
      dates[operator] = date;
    }
  }
  if (dates.gte && dates.lt && dates.gte >= dates.lt) return { error: 'Start date must precede end date' };
  if (Object.keys(dates).length) where.completedAt = dates;
  if (query.search) {
    if (typeof query.search !== 'string' || query.search.length > 100) return { error: 'Search must be at most 100 characters' };
    const contains = query.search.trim();
    where.OR = [{ ticketId: { contains } }, { user: { name: { contains } } }];
  }
  return { where, page, pageSize, skip: (page - 1) * pageSize };
}
