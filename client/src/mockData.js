// Fake data for the A2 front end. Nothing here comes from the server; the
// QueueContext keeps this state in the browser (localStorage) so every screen
// sees the same queues. Times are relative to "now" so the demo always looks fresh.

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const daysAgo = (days, hour = 10) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

export const DEMO_USER = { name: 'Demo User', email: 'user@queuesmart.dev' };

export const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };

const services = [
  {
    id: 1,
    name: 'Academic Advising',
    description: 'Course planning, degree audits and registration holds',
    expectedDuration: 15,
    priority: 'MEDIUM',
    isOpen: true,
  },
  {
    id: 2,
    name: 'Financial Aid',
    description: 'Scholarships, loans and FAFSA questions',
    expectedDuration: 20,
    priority: 'HIGH',
    isOpen: true,
  },
  {
    id: 3,
    name: 'IT Help Desk',
    description: 'Account access, Wi-Fi and device support',
    expectedDuration: 10,
    priority: 'LOW',
    isOpen: true,
  },
  {
    id: 4,
    name: 'Career Services',
    description: 'Resume reviews and internship search help',
    expectedDuration: 30,
    priority: 'MEDIUM',
    isOpen: false,
  },
];

function entry(id, serviceId, userName, userEmail, priority, status, joinedAt, extra = {}) {
  return {
    id,
    serviceId,
    userName,
    userEmail,
    priority,
    status, // WAITING | SERVING | SERVED | LEFT | REMOVED | NO_SHOW
    joinedAt,
    servedAt: null,
    completedAt: null,
    ...extra,
  };
}

function buildEntries() {
  const me = DEMO_USER;
  return [
    // Academic Advising: someone being served, three waiting
    entry(1, 1, 'Maria Lopez', 'maria@example.com', 'MEDIUM', 'SERVING', minutesAgo(25), { servedAt: minutesAgo(6) }),
    entry(2, 1, 'James Carter', 'james@example.com', 'MEDIUM', 'WAITING', minutesAgo(18)),
    entry(3, 1, 'Aisha Khan', 'aisha@example.com', 'HIGH', 'WAITING', minutesAgo(10)),
    entry(4, 1, 'Kevin Tran', 'kevin@example.com', 'LOW', 'WAITING', minutesAgo(8)),

    // Financial Aid: the demo user is third in line
    entry(5, 2, 'Sofia Nguyen', 'sofia@example.com', 'MEDIUM', 'SERVING', minutesAgo(30), { servedAt: minutesAgo(4) }),
    entry(6, 2, 'David Kim', 'david@example.com', 'HIGH', 'WAITING', minutesAgo(20)),
    entry(7, 2, 'Emily Brooks', 'emily@example.com', 'MEDIUM', 'WAITING', minutesAgo(15)),
    entry(8, 2, me.name, me.email, 'MEDIUM', 'WAITING', minutesAgo(12)),
    entry(9, 2, 'Omar Hassan', 'omar@example.com', 'MEDIUM', 'WAITING', minutesAgo(5)),

    // IT Help Desk: short line
    entry(10, 3, 'Lily Chen', 'lily@example.com', 'LOW', 'WAITING', minutesAgo(3)),

    // Demo user's past visits (shown on the History screen)
    entry(11, 3, me.name, me.email, 'MEDIUM', 'SERVED', daysAgo(2, 9), { servedAt: daysAgo(2, 9), completedAt: daysAgo(2, 10) }),
    entry(12, 1, me.name, me.email, 'MEDIUM', 'LEFT', daysAgo(5, 13), { completedAt: daysAgo(5, 14) }),
    entry(13, 2, me.name, me.email, 'MEDIUM', 'SERVED', daysAgo(9, 11), { servedAt: daysAgo(9, 11), completedAt: daysAgo(9, 12) }),
    entry(14, 4, me.name, me.email, 'MEDIUM', 'NO_SHOW', daysAgo(14, 15), { completedAt: daysAgo(14, 16) }),
    entry(15, 1, me.name, me.email, 'MEDIUM', 'SERVED', daysAgo(20, 10), { servedAt: daysAgo(20, 10), completedAt: daysAgo(20, 11) }),

    // Other people served earlier today (for admin statistics)
    entry(16, 1, 'Noah Patel', 'noah@example.com', 'MEDIUM', 'SERVED', minutesAgo(90), { servedAt: minutesAgo(70), completedAt: minutesAgo(55) }),
    entry(17, 3, 'Grace Liu', 'grace@example.com', 'LOW', 'SERVED', minutesAgo(60), { servedAt: minutesAgo(40), completedAt: minutesAgo(30) }),
  ];
}

// Waiting line order for each service: priority first, then arrival time.
function buildQueues(entries) {
  const queues = {};
  for (const service of services) {
    queues[service.id] = entries
      .filter((e) => e.serviceId === service.id && e.status === 'WAITING')
      .sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          a.joinedAt.localeCompare(b.joinedAt),
      )
      .map((e) => e.id);
  }
  return queues;
}

function buildNotifications() {
  return [
    { id: 101, to: DEMO_USER.email, message: 'You joined the Financial Aid queue. You are number 4 in line.', read: true, createdAt: minutesAgo(12) },
    { id: 102, to: DEMO_USER.email, message: 'Career Services is closed today. Please check back tomorrow.', read: false, createdAt: minutesAgo(60) },
    { id: 103, to: 'ADMIN', message: 'Omar Hassan joined the Financial Aid queue.', read: false, createdAt: minutesAgo(5) },
    { id: 104, to: 'ADMIN', message: 'Lily Chen joined the IT Help Desk queue.', read: false, createdAt: minutesAgo(3) },
  ];
}

export function createMockState() {
  const entries = buildEntries();
  return {
    services: structuredClone(services),
    entries,
    // serviceId -> ordered list of WAITING entry ids (the person being served is not in it)
    queues: buildQueues(entries),
    // `to` is a user's email, or 'ADMIN' for notifications shown to administrators
    notifications: buildNotifications(),
    nextId: 1000,
  };
}
