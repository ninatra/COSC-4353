// Upgrade the pre-Queue demo database. Run with the app stopped.
import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyConstraints } from './constraints.js';

const prisma = new PrismaClient();
try {
  const columns = await prisma.$queryRawUnsafe('PRAGMA table_info("QueueEntry")');
  if (columns.some(column => column.name === 'queueId')) {
    console.log('Queue database upgrade already applied.');
  } else {
    if (!columns.some(column => column.name === 'serviceId')) {
      throw new Error('Expected the previous QueueEntry schema. Use npm run setup for a new database.');
    }
    const dbPath = resolve(dirname(fileURLToPath(import.meta.url)), process.env.DATABASE_URL.slice(5).split('?')[0]);
    const backup = `${dbPath}.backup-${Date.now()}.db`;
    await prisma.$executeRawUnsafe(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
    console.log(`Database backup: ${backup}`);
    const sql = await readFile(new URL('./migrations/20261106000003_queue_and_history/migration.sql', import.meta.url), 'utf8');
    const statements = sql.replace(/^--.*$/gm, '').split(';').map(part => part.trim()).filter(Boolean)
      .filter(part => !/^(PRAGMA|BEGIN|COMMIT)/i.test(part));
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys=OFF');
    try {
      await prisma.$transaction(async tx => {
        const [before] = await tx.$queryRawUnsafe('SELECT COUNT(*) AS count FROM QueueEntry');
        const [finished] = await tx.$queryRawUnsafe("SELECT COUNT(*) AS count FROM QueueEntry WHERE status IN ('SERVED','LEFT','NO_SHOW')");
        for (const statement of statements) await tx.$executeRawUnsafe(statement);
        const [after] = await tx.$queryRawUnsafe('SELECT COUNT(*) AS count FROM QueueEntry');
        const [history] = await tx.$queryRawUnsafe('SELECT COUNT(*) AS count FROM History');
        const violations = await tx.$queryRawUnsafe('PRAGMA foreign_key_check');
        if (before.count !== after.count || finished.count !== history.count || violations.length) {
          throw new Error('Database preservation checks failed; upgrade rolled back.');
        }
      }, { timeout: 30000 });
    } finally {
      await prisma.$executeRawUnsafe('PRAGMA foreign_keys=ON');
    }
    console.log('Queue and history upgrade complete. Existing visits preserved.');
  }
  const serviceColumns = await prisma.$queryRawUnsafe('PRAGMA table_info("Service")');
  if (serviceColumns.some(column => ['location', 'hours', 'contact', 'instructions'].includes(column.name) && column.notnull)) {
    const sql = await readFile(new URL('./migrations/20261106000005_nullable_service_details/migration.sql', import.meta.url), 'utf8');
    const statements = sql.split('-- Validation triggers')[0].replace(/^--.*$/gm, '').split(';').map(part => part.trim())
      .filter(part => part && !/^(PRAGMA|BEGIN|COMMIT)/i.test(part));
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys=OFF');
    try {
      await prisma.$transaction(async tx => {
        for (const statement of statements) await tx.$executeRawUnsafe(statement);
        if ((await tx.$queryRawUnsafe('PRAGMA foreign_key_check')).length) throw new Error('Invalid service relations; upgrade rolled back.');
      });
    } finally {
      await prisma.$executeRawUnsafe('PRAGMA foreign_keys=ON');
    }
  }
  await applyConstraints(prisma);
} finally {
  await prisma.$disconnect();
}
