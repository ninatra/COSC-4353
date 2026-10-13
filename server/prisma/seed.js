// Creates demo accounts and services so the team has data to work with.
// Safe to run more than once.
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

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

  console.log('Seeded demo data. Log in with admin@queuesmart.dev or user@queuesmart.dev / password123');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
