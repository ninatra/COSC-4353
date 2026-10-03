// Deterministic demo data for the A2 front end, copied from the design
// prototype's seed(). Nothing here comes from the server. Times are minutes
// since midnight on a simulated clock (605 = 10:05 AM); see utils/format.js.

export const DEMO_DATE = 'Sep 26, 2026';
export const DEMO_EMAIL = 'user@queuesmart.dev';
export const DEMO_NAME = 'Hao Pham';
export const TINTS = ['blue', 'lilac', 'peach', 'mint', 'sun'];
export const STATE_VERSION = 3;

// Updates go to 'admin' or to one user's email.
function seedUpdates() {
  const updates = [];
  let n = 0;
  const up = (t, audience, kind, title, body, extra = {}) =>
    updates.push({ n: ++n, t, audience, kind, title, body, ...extra });

  up(540, 'admin', 'opened', 'Queue opened', '{svc} opened for walk-ins.', { serviceId: 'it' });
  up(545, 'admin', 'opened', 'Queue opened', '{svc} opened for walk-ins.', { serviceId: 'aa' });
  up(572, 'admin', 'closed', 'Queue closed', '{svc} closed to new visitors. 1 visitor kept their place.', { serviceId: 'ss' });
  up(588, DEMO_EMAIL, 'confirmed', 'Ticket confirmed', "Your ticket IT-024 is confirmed for {svc}. You have joined the queue and you're #4 in line. The estimated wait is about 24 minutes. Please find a seat in the waiting area and we will see you soon.", { serviceId: 'it', ticketId: 'IT-024' });
  up(588, DEMO_EMAIL, 'joined', 'Queue joined', 'You are currently #4 in the {svc} queue, with an estimated wait of about 24 minutes. We will update you as your position changes.', { serviceId: 'it', ticketId: 'IT-024' });
  up(588, 'admin', 'joined', 'Visitor joined', 'IT-024 joined {svc}. 4 waiting.', { serviceId: 'it' });
  up(603, 'admin', 'served', 'Visitor served', 'IT-021 was served at {svc}.', { serviceId: 'it' });
  up(603, DEMO_EMAIL, 'position', 'Position changed', 'Your current position in line is #3. Your estimated wait is about 16 minutes. One visitor ahead of you was served, so please keep your phone nearby for the next update.', { serviceId: 'it', ticketId: 'IT-024' });
  return { updates, n };
}

export function seed() {
  const { updates, n } = seedUpdates();
  return {
    v: STATE_VERSION,
    clock: 605,
    n,
    services: [
      { id: 'it', name: 'IT Help Desk', desc: 'Wi-Fi, account access, and device support.', duration: 8, priority: 'high', open: true, location: 'Fondren Library, Room 112', contact: 'it@university.edu', hours: 'Mon-Fri, 8:00 AM-5:00 PM', category: 'Technology', maxCapacity: 12, instructions: 'Bring your device and university ID if you need account or hardware help.', icon: 'laptop', tint: 'blue', prefix: 'IT' },
      { id: 'aa', name: 'Academic Advising', desc: 'Course planning and degree requirements.', duration: 15, priority: 'medium', open: true, location: 'Lovett Hall, Suite 210', contact: 'advising@university.edu', hours: 'Mon-Thu, 9:00 AM-4:00 PM', category: 'Academic', maxCapacity: 8, instructions: 'Have your degree plan and questions ready before visiting.', icon: 'graduation-cap', tint: 'lilac', prefix: 'AA' },
      { id: 'ss', name: 'Student Services', desc: 'ID cards, enrollment verification, and records requests.', duration: 10, priority: 'low', open: false, location: 'Allen Center, Room 104', contact: 'studentservices@university.edu', hours: 'Mon-Fri, 8:30 AM-4:30 PM', category: 'Student support', maxCapacity: null, instructions: 'Bring a photo ID and any forms needed for your request.', icon: 'id-card', tint: 'peach', prefix: 'SS' },
    ],
    // serviceId -> ordered waiting list. `email` marks visitors who have an account.
    queues: {
      it: [
        { id: 'IT-022', name: 'Maya Chen', joinedAt: 571 },
        { id: 'IT-023', name: 'Jordan Ellis', joinedAt: 580 },
        { id: 'IT-024', name: DEMO_NAME, email: DEMO_EMAIL, joinedAt: 588 },
        { id: 'IT-025', name: 'Priya Raman', joinedAt: 595 },
        { id: 'IT-026', name: 'Luis Ortega', joinedAt: 601 },
      ],
      aa: [
        { id: 'AA-012', name: 'Sam Okafor', joinedAt: 576 },
        { id: 'AA-013', name: 'Grace Liu', joinedAt: 592 },
      ],
      ss: [{ id: 'SS-039', name: 'Tomás Rivera', joinedAt: 538 }],
    },
    // Next ticket number per service.
    counters: { it: 27, aa: 14, ss: 40 },
    // One active (or just served) ticket per user email.
    tickets: {
      [DEMO_EMAIL]: { id: 'IT-024', serviceId: 'it', status: 'waiting', joinedAt: 588 },
    },
    history: [
      { email: DEMO_EMAIL, date: 'Sep 18, 2026', serviceId: 'aa', serviceName: 'Academic Advising', outcome: 'served', ticketId: 'AA-006' },
      { email: DEMO_EMAIL, date: 'Sep 9, 2026', serviceId: 'it', serviceName: 'IT Help Desk', outcome: 'left', ticketId: 'IT-011' },
      { email: DEMO_EMAIL, date: 'Aug 27, 2026', serviceId: 'ss', serviceName: 'Student Services', outcome: 'served', ticketId: 'SS-018' },
      { email: DEMO_EMAIL, date: 'Aug 25, 2026', serviceId: 'it', serviceName: 'IT Help Desk', outcome: 'removed', ticketId: 'IT-004' },
    ],
    updates,
    // audience -> highest update number the audience cleared
    cleared: {},
  };
}
