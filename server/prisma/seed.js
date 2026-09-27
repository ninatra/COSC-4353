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

  console.log('Seeded demo data. Log in with admin@queuesmart.dev or user@queuesmart.dev / password123');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
