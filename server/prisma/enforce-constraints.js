import { PrismaClient } from '@prisma/client';
import { applyConstraints, constraintStatements } from './constraints.js';

if (process.argv.includes('--sql')) {
  console.log(constraintStatements().map(statement => `${statement};`).join('\n\n'));
} else {
  const db = new PrismaClient();
  try {
    await applyConstraints(db);
    console.log('Database validation constraints applied.');
  } finally {
    await db.$disconnect();
  }
}
