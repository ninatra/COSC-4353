// Creates demo accounts and services so the team has data to work with.
// Safe to run more than once.
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { formatTicketId, orderQueue, positionInQueue } from '../src/logic/queue.js';
import { almostReadyNotifications, joinNotifications } from '../src/logic/notifications.js';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@queuesmart.dev' },
    update: {},
    create: {
      name: 'Demo Admin',
      email: 'admin@queuesmart.dev',
      passwordHash,
      role: 'ADMIN',
      emailVerified: true,
    },
  });
  await prisma.user.upsert({
    where: { email: 'user@queuesmart.dev' },
    update: { name: 'Hao Pham' },
    create: {
      name: 'Hao Pham',
      email: 'user@queuesmart.dev',
      passwordHash,
      role: 'USER',
      emailVerified: true,
    },
  });

  if ((await prisma.service.count()) === 0) {
    await prisma.service.createMany({
      data: [
        { name: 'Academic Advising', description: 'Course planning and degree questions', expectedDuration: 15, priority: 'MEDIUM' },
        { name: 'Financial Aid', description: 'Scholarships, loans and FAFSA help', expectedDuration: 20, priority: 'HIGH' },
        { name: 'IT Help Desk', description: 'Account, Wi-Fi and device support', expectedDuration: 10, priority: 'LOW' },
      ],
    });
  }

  if (!(await prisma.service.findFirst({ where: { name: 'Student Services' } }))) {
    await prisma.service.create({
      data: {
        name: 'Student Services',
        description: 'ID cards, enrollment verification, and records requests.',
        expectedDuration: 10,
        priority: 'LOW',
        category: 'Student support',
        location: 'Allen Center, Room 104',
        contact: 'studentservices@university.edu',
        hours: 'Mon-Fri, 8:30 AM-4:30 PM',
        instructions: 'Bring a photo ID and any forms needed for your request.',
      },
    });
  }

  // Fill missing metadata on the original demo services without replacing edited text.
  const details = {
    'Academic Advising': { category: 'Academic', location: 'Lovett Hall, Suite 210', contact: 'advising@university.edu', hours: 'Mon-Thu, 9:00 AM-4:00 PM', instructions: 'Have your degree plan and questions ready before visiting.' },
    'Financial Aid': { category: 'Financial', location: 'Allen Center, Financial Aid Office', contact: 'financialaid@university.edu', hours: 'Mon-Fri, 9:00 AM-4:00 PM', instructions: 'Bring your university ID and relevant financial aid documents.' },
    'IT Help Desk': { category: 'Technology', location: 'Fondren Library, Room 112', contact: 'it@university.edu', hours: 'Mon-Fri, 8:00 AM-5:00 PM', instructions: 'Bring your device and university ID if you need account or hardware help.' },
  };
  for (const service of await prisma.service.findMany()) {
    const defaults = details[service.name];
    if (!defaults) continue;
    const data = {};
    for (const field of ['location', 'contact', 'hours', 'instructions']) {
      if (!service[field]) data[field] = defaults[field];
    }
    if (service.category === 'Other' && !service.location && !service.contact && !service.hours) {
      data.category = defaults.category;
    }
    if (Object.keys(data).length) await prisma.service.update({ where: { id: service.id }, data });
  }

  const queuePlans = {
    'Academic Advising': ['Maya Chen', 'Jordan Lee', 'Sofia Garcia', 'Grace Park', 'Hao Pham'],
    'Financial Aid': ['Liam Patel', 'Emma Wilson', 'Noah Davis', 'Daniel Rivera'],
    'IT Help Desk': ['Olivia Nguyen', 'Ethan Brown', 'Ava Martinez'],
  };
  const resetQueues = process.argv.includes('--reset-queues');
  const adminIds = (await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })).map((u) => u.id);
  let added = 0;
  for (const [serviceName, names] of Object.entries(queuePlans)) {
    const service = await prisma.service.findFirst({ where: { name: serviceName }, orderBy: { id: 'asc' } });
    if (!service) continue;
    await prisma.$transaction(async (db) => {
      if (resetQueues) {
        // Explicit demo reset preserves past visits while replacing these queues.
        await db.queueEntry.updateMany({
          where: { serviceId: service.id, status: { in: ['WAITING', 'SERVING'] } },
          data: { status: 'LEFT', completedAt: new Date() },
        });
      }
      for (const [slot, name] of names.entries()) {
        const email = name === 'Hao Pham' ? 'user@queuesmart.dev' : `demo-visitor-${service.id}-${slot + 1}@queuesmart.dev`;
        const visitor = await db.user.upsert({
          where: { email }, update: { name },
          create: { name, email, passwordHash, role: 'USER', emailVerified: true },
        });
        if (resetQueues) {
          await db.queueEntry.updateMany({ where: { userId: visitor.id, status: { in: ['WAITING', 'SERVING'] } }, data: { status: 'LEFT', completedAt: new Date() } });
        } else if (await db.queueEntry.findFirst({ where: { userId: visitor.id } })) continue;
        const waiting = await db.queueEntry.count({ where: { serviceId: service.id, status: { in: ['WAITING', 'SERVING'] } } });
        if (service.maxCapacity !== null && waiting >= service.maxCapacity) break;
        const joinedAt = new Date(Date.now() - (names.length - slot) * 4 * 60000);
        const entry = await db.queueEntry.create({ data: { userId: visitor.id, serviceId: service.id, priority: 'MEDIUM', joinedAt } });
        const entries = await db.queueEntry.findMany({ where: { serviceId: service.id, status: { in: ['WAITING', 'SERVING'] } } });
        const { position } = positionInQueue(entries, entry.id, service.expectedDuration);
        const joined = await db.queueEntry.update({ where: { id: entry.id }, data: { ticketId: formatTicketId(service.name, entry.id), initialPosition: position } });
        await db.notification.createMany({ data: joinNotifications({ entry: joined, service, position, waitingCount: entries.length, userId: visitor.id, adminIds }) });
        added++;
      }
      const ordered = orderQueue(await db.queueEntry.findMany({ where: { serviceId: service.id, status: { in: ['WAITING', 'SERVING'] } } }));
      const alerted = await db.notification.findMany({ where: { kind: 'almost', entryId: { in: ordered.map((e) => e.id) } }, select: { entryId: true } });
      const almost = almostReadyNotifications(ordered, alerted.map((n) => n.entryId), service);
      if (almost.length) await db.notification.createMany({ data: almost });
    });
  }

  // A few past visits so the demo user's History screen isn't empty.
  const demoUser = await prisma.user.findUnique({ where: { email: 'user@queuesmart.dev' } });
  if (!(await prisma.queueEntry.findFirst({ where: { userId: demoUser.id, status: 'SERVED' } }))) {
    const past = [
      ['IT Help Desk', 'SERVED', 6, { outcome: 'completed', problem: 'Wi-Fi login' }],
      ['Financial Aid', 'LEFT', 3, {}],
      ['Academic Advising', 'SERVED', 1, { outcome: 'follow-up', problem: 'Degree plan review' }],
    ];
    for (const [serviceName, status, daysAgo, details] of past) {
      const service = await prisma.service.findFirst({ where: { name: serviceName } });
      if (!service) continue;
      const joinedAt = new Date(Date.now() - daysAgo * 86400000);
      const endedAt = new Date(joinedAt.getTime() + 25 * 60000);
      const entry = await prisma.queueEntry.create({ data: {
        userId: demoUser.id, serviceId: service.id, status, joinedAt, completedAt: endedAt,
        servedAt: status === 'SERVED' ? endedAt : null, ...details,
      } });
      await prisma.queueEntry.update({ where: { id: entry.id }, data: { ticketId: formatTicketId(service.name, entry.id) } });
    }
  }

  // Stable per-sample accounts keep history seeding repeatable without changing real visits.
  const historySamples = [
    { name: 'Avery Brooks', daysAgo: 0, status: 'SERVED', outcome: 'completed', notes: 'Request resolved during the visit.' },
    { name: 'Riley Morgan', daysAgo: 0, status: 'SERVED', outcome: 'referred', notes: 'Referred to the specialist office for additional help.' },
    { name: 'Casey Nguyen', daysAgo: 1, status: 'SERVED', outcome: 'follow-up', notes: 'Follow-up appointment requested for next week.' },
    { name: 'Taylor Evans', daysAgo: 2, status: 'SERVED', outcome: 'unresolved', notes: 'Additional documents needed before the request can be resolved.' },
    { name: 'Jamie Flores', daysAgo: 3, status: 'LEFT', notes: '' },
    { name: 'Sam Reed', daysAgo: 5, status: 'NO_SHOW', notes: 'Visitor was unavailable when called.' },
    { name: 'Alex Carter', daysAgo: 8, status: 'SERVED', outcome: 'completed', notes: 'Instructions provided and next steps confirmed.' },
    { name: 'Drew Wilson', daysAgo: 12, status: 'SERVED', outcome: 'completed', notes: 'All questions answered.' },
  ];
  const problems = {
    'Academic Advising': 'Course selection and degree requirements',
    'Financial Aid': 'Scholarship eligibility and application documents',
    'IT Help Desk': 'Account access and Wi-Fi connection',
    'Student Services': 'Student ID and enrollment verification',
  };
  const historyVisitors = {
    'Academic Advising': ['Avery Brooks', 'Riley Morgan', 'Casey Nguyen', 'Taylor Evans', 'Jamie Flores', 'Sam Reed', 'Alex Carter', 'Drew Wilson'],
    'Financial Aid': ['Morgan Scott', 'Parker James', 'Quinn Lewis', 'Reese Allen', 'Cameron Hall', 'Skyler Young', 'Blake Adams', 'Emerson Hill'],
    'IT Help Desk': ['Rowan Baker', 'Finley Green', 'Hayden King', 'River Wright', 'Dakota Lopez', 'Sage Turner', 'Elliot Torres', 'Charlie Ross'],
    'Student Services': ['Sydney Ward', 'Payton Cook', 'Kendall Bell', 'Reagan Cruz', 'Harper Wood', 'Logan Price', 'Jules Perry', 'Robin Gray'],
  };
  let historyAdded = 0;
  for (const service of await prisma.service.findMany({ where: { name: { in: Object.keys(problems) } } })) {
    const keepOddSlots = ['Financial Aid', 'Student Services'].includes(service.name);
    for (const [slot, sample] of historySamples.entries()) {
      await prisma.$transaction(async db => {
        const email = `demo-history-${service.id}-${slot + 1}@queuesmart.dev`;
        if (slot % 2 !== (keepOddSlots ? 1 : 0)) {
          // Trim only redundant generated history, preserving real visitors' records.
          const redundant = await db.user.findUnique({ where: { email } });
          if (redundant) await db.queueEntry.deleteMany({ where: { userId: redundant.id, serviceId: service.id, completedAt: { not: null } } });
          return;
        }
        const name = historyVisitors[service.name][slot];
        const visitor = await db.user.upsert({ where: { email }, update: { name },
          create: { name, email, passwordHash, role: 'USER', emailVerified: true } });
        if (await db.queueEntry.findFirst({ where: { userId: visitor.id, serviceId: service.id, completedAt: { not: null } } })) return;
        const endedAt = new Date(Date.now() - sample.daysAgo * 86400000 - slot * 3 * 60000);
        const servedAt = sample.status === 'SERVED' ? new Date(endedAt.getTime() - service.expectedDuration * 60000) : null;
        const joinedAt = new Date((servedAt ?? endedAt).getTime() - (10 + slot * 5) * 60000);
        const entry = await db.queueEntry.create({ data: {
          userId: visitor.id, serviceId: service.id, status: sample.status,
          priority: 'MEDIUM', joinedAt, servedAt, completedAt: endedAt,
          outcome: sample.outcome ?? null, problem: sample.status === 'SERVED' ? problems[service.name] : '', notes: sample.status === 'LEFT' ? '' : sample.notes,
        } });
        await db.queueEntry.update({ where: { id: entry.id }, data: { ticketId: formatTicketId(service.name, entry.id) } });
        historyAdded++;
      });
    }
  }
  console.log(`Added ${historyAdded} sample history visits across today and previous days.`);

  console.log(`Added ${added} demo visitors.`);
  console.log('Seeded demo data. Log in with admin@queuesmart.dev or user@queuesmart.dev / password123');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
