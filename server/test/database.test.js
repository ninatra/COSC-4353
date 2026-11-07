import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { after, before, describe, test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { applyConstraints, constraintStatements } from '../prisma/constraints.js';
import { sampleService, startApp } from './helpers/app.js';

describe('database validation', () => {
  let app;
  let account;
  let service;
  let admin;
  before(async () => {
    app = await startApp('database-validation');
    account = await app.account();
    admin = await app.account('ADMIN');
    service = (await app.request('POST', '/services', { token: admin.token, body: sampleService() })).body.service;
  });
  after(async () => { if (app) await app.close(); });

  test('required fields and lengths are enforced even through raw SQL', async () => {
    await assert.rejects(app.prisma.$executeRawUnsafe('INSERT INTO UserCredentials (email) VALUES (?)', 'missing@test.dev'));
    for (const name of [null, '', ' \t\n ', 'x'.repeat(51)]) {
      await assert.rejects(app.prisma.$executeRawUnsafe('UPDATE UserProfile SET fullName = ? WHERE email = ?', name, account.user.email));
    }
    for (const [column, value] of [['name', 'x'.repeat(101)], ['description', 'x'.repeat(501)], ['location', 'x'.repeat(121)], ['contact', 'x'.repeat(201)], ['hours', 'x'.repeat(121)], ['instructions', 'x'.repeat(501)]]) {
      await assert.rejects(app.prisma.$executeRawUnsafe(`UPDATE Service SET "${column}" = ? WHERE id = ?`, value, service.id));
    }
    await assert.rejects(app.prisma.$executeRawUnsafe('UPDATE UserProfile SET phone = ? WHERE email = ?', '1'.repeat(21), account.user.email));
    assert.equal((await app.prisma.userProfile.findUnique({ where: { email: account.user.email } })).fullName, account.user.name);
  });

  test('raw writes cannot bypass numeric types, booleans, dates or allowed statuses', async () => {
    for (const value of ['ten', 1.5, 0, -1, 2147483648]) {
      await assert.rejects(app.prisma.$executeRawUnsafe('UPDATE Service SET expectedDuration = ? WHERE id = ?', value, service.id));
      await assert.rejects(app.prisma.$executeRawUnsafe('UPDATE Service SET maxCapacity = ? WHERE id = ?', value, service.id));
    }
    await assert.rejects(app.prisma.$executeRawUnsafe('UPDATE UserCredentials SET emailVerified = 2 WHERE id = ?', account.user.id));
    await assert.rejects(app.prisma.$executeRawUnsafe('UPDATE UserCredentials SET role = ? WHERE id = ?', 'SUPERUSER', account.user.id));
    await assert.rejects(app.prisma.$executeRawUnsafe('UPDATE UserCredentials SET createdAt = ? WHERE id = ?', 'yesterday', account.user.id));
    await assert.rejects(app.prisma.$executeRawUnsafe('UPDATE Queue SET status = ? WHERE serviceId = ?', 'INVALID', service.id));
    assert.equal((await app.prisma.service.findUnique({ where: { id: service.id } })).expectedDuration, 10);
  });

  test('email format, length, normalization, uniqueness and foreign keys are database enforced', async () => {
    for (const email of ['', 'bad', 'two@@school.edu', 'space @school.edu', 'UPPER@SCHOOL.EDU', 'x'.repeat(255) + '@school.edu']) {
      await assert.rejects(app.prisma.$executeRawUnsafe('UPDATE UserCredentials SET email = ? WHERE id = ?', email, account.user.id));
    }
    await assert.rejects(app.prisma.queue.create({ data: { serviceId: service.id } }), { code: 'P2002' });
  });

  test('queue positions and history/notification lengths are database enforced', async () => {
    const entry = (await app.request('POST', `/queues/${service.id}/join`, { token: account.token })).body.entry;
    for (const position of [null, 0, -1, 1.5, 'first']) {
      await assert.rejects(app.prisma.$executeRawUnsafe('UPDATE QueueEntry SET position = ? WHERE id = ?', position, entry.id));
    }
    await app.request('POST', `/queues/${service.id}/leave`, { token: account.token });
    for (const field of ['notes', 'problem']) {
      await assert.rejects(app.prisma.$executeRawUnsafe(`UPDATE History SET "${field}" = ? WHERE entryId = ?`, 'x'.repeat(501), entry.id));
    }
    await assert.rejects(app.prisma.$executeRawUnsafe('UPDATE History SET outcome = ? WHERE entryId = ?', 'invalid', entry.id));
    await assert.rejects(app.prisma.$executeRawUnsafe('UPDATE QueueEntry SET position = 1 WHERE id = ?', entry.id));
    await assert.rejects(app.prisma.notification.create({ data: { userId: account.user.id, message: '' } }));
    await assert.rejects(app.prisma.notification.create({ data: { userId: account.user.id, message: 'x'.repeat(1001) } }));
  });

  test('constraint installation checks existing data and refuses invalid rows without rewriting them', async () => {
    await app.prisma.$executeRawUnsafe('DROP TRIGGER validate_UserProfile_update');
    try {
      await app.prisma.$executeRawUnsafe('UPDATE UserProfile SET fullName = ? WHERE email = ?', '', account.user.email);
      await assert.rejects(applyConstraints(app.prisma), /Existing data violates UserProfile.fullName/);
      assert.equal((await app.prisma.userProfile.findUnique({ where: { email: account.user.email } })).fullName, '');
    } finally {
      await app.prisma.$executeRawUnsafe('UPDATE UserProfile SET fullName = ? WHERE email = ?', account.user.name, account.user.email);
      await applyConstraints(app.prisma);
    }
  });

  describe('API database errors', () => {
    // Prisma delegates expose methods through a proxy rather than property descriptors.
    function replace(t, object, name, implementation) {
      const original = object[name];
      object[name] = implementation;
      t.after(() => { object[name] = original; });
    }


    // Force database failures after authentication to exercise the public API's
    // error contract without depending on timing or corrupting the test database.
    for (const [code, status] of [
      ['P2002', 409], ['P2000', 400], ['P2005', 400], ['P2006', 400],
      ['P2007', 400], ['P2011', 400], ['P2012', 400], ['P2003', 400],
    ]) {
      test(`${code} returns a safe ${status} response`, async t => {
        replace(t, app.prisma.service, 'findMany', async () => {
          throw Object.assign(new Error('Private database details'), { code });
        });
        const response = await app.request('GET', '/services', { token: admin.token });
        assert.equal(response.status, status);
        assert.ok(response.body.error);
        assert.ok(!response.body.error.includes('Private database details'));
      });
    }

    test('SQLite validation-trigger failures return a safe input error', async t => {
      replace(t, app.prisma.service, 'findMany', async () => { throw new Error('Validation: Service.name'); });
      const response = await app.request('GET', '/services', { token: admin.token });
      assert.equal(response.status, 400);
      assert.match(response.body.error, /field/);
    });

    test('unexpected database failures are logged without exposing details', async t => {
      const error = new Error('Private connection credentials');
      replace(t, app.prisma.service, 'findMany', async () => { throw error; });
      const log = t.mock.method(console, 'error', () => {});
      const response = await app.request('GET', '/services', { token: admin.token });
      assert.equal(response.status, 500);
      assert.equal(response.body.error, 'Something went wrong');
      assert.equal(log.mock.calls[0].arguments[0], error);
    });

    for (const code of ['P2034', 'P1008', 'P2028']) {
      test(`${code} asks queue clients to retry instead of returning a server failure`, async t => {
        replace(t, app.prisma, '$transaction', async () => { throw Object.assign(new Error('Transaction failed'), { code }); });
        const response = await app.request('POST', '/queues/1/serve-next', { token: admin.token });
        assert.equal(response.status, 409);
        assert.match(response.body.error, /try again/);
      });
    }

    test('unexpected queue and service-delete errors reach the central error handler', async t => {
      const created = await app.request('POST', '/services', { token: admin.token, body: sampleService() });
      t.mock.method(console, 'error', () => {});
      replace(t, app.prisma, '$transaction', async () => { throw new Error('Private failure'); });
      assert.equal((await app.request('DELETE', `/services/${created.body.service.id}`, { token: admin.token })).status, 500);
      assert.equal((await app.request('POST', '/queues/1/serve-next', { token: admin.token })).status, 500);
    });
  });
});

describe('database maintenance', () => {
  const exec = promisify(execFile);
  const serverDir = new URL('../', import.meta.url);

  async function database(t, legacy = false) {
    const directory = await mkdtemp(join(tmpdir(), 'queuesmart-scripts-'));
    const url = `file:${join(directory, 'test.db')}`;
    const db = new PrismaClient({ datasourceUrl: url });
    t.after(async () => { await db.$disconnect(); await rm(directory, { recursive: true, force: true }); });
    const sql = await readFile(new URL(legacy ? './fixtures/pre-queue-schema.sql' : '../prisma/schema.sql', import.meta.url), 'utf8');
    // Triggers contain internal semicolons, so install them separately below.
    for (const statement of sql.split('DROP TRIGGER')[0].split(';').map(value => value.trim()).filter(Boolean)) {
      await db.$executeRawUnsafe(statement);
    }
    if (!legacy) await applyConstraints(db);
    const run = (script, ...args) => exec(process.execPath, [`prisma/${script}.js`, ...args], {
      cwd: serverDir, env: { ...process.env, DATABASE_URL: url }, timeout: 20000,
    });
    return { db, directory, run, url };
  }

  async function legacyRows(db, orphan = false) {
    await db.$executeRawUnsafe("INSERT INTO UserCredentials(id,email,passwordHash) VALUES(1,'legacy@test.dev','existing-hash')");
    await db.$executeRawUnsafe("INSERT INTO UserProfile(id,email,fullName,updatedAt) VALUES(1,'legacy@test.dev','Legacy Visitor',CURRENT_TIMESTAMP)");
    await db.$executeRawUnsafe("INSERT INTO Service(id,name,description,expectedDuration,isOpen,updatedAt) VALUES(1,'Legacy Desk','Existing service',10,0,CURRENT_TIMESTAMP)");
    await db.$executeRawUnsafe(`INSERT INTO QueueEntry(id,userId,serviceId,ticketId,manualOrder,status,joinedAt)
      VALUES(1,1,${orphan ? 999 : 1},'LD-001',2,'WAITING','2026-11-01 10:00:00')`);
    await db.$executeRawUnsafe("INSERT INTO QueueEntry(id,userId,serviceId,ticketId,manualOrder,status,joinedAt) VALUES(2,1,1,'LD-002',1,'SERVING','2026-11-01 10:01:00')");
    await db.$executeRawUnsafe(`INSERT INTO QueueEntry(id,userId,serviceId,ticketId,status,servedAt,completedAt,problem,outcome,notes)
      VALUES(3,1,1,'LD-003','SERVED','2026-11-01 09:00:00','2026-11-01 09:10:00','Original issue','referred','Original notes')`);
    await db.$executeRawUnsafe("INSERT INTO QueueEntry(id,userId,serviceId,ticketId,status,completedAt) VALUES(4,1,1,'LD-004','LEFT','2026-11-01 09:30:00')");
    await db.$executeRawUnsafe("INSERT INTO Notification(userId,message) VALUES(1,'Existing notice')");
  }

  test('queue upgrade preserves accounts, ordering, status, history and a restorable backup', async t => {
    const { db, directory, run } = await database(t, true);
    await legacyRows(db);
    const result = await run('upgrade-queues');
    assert.match(result.stdout, /upgrade complete/);
    assert.equal(await db.userCredentials.count(), 1);
    assert.equal((await db.userCredentials.findUnique({ where: { id: 1 } })).passwordHash, 'existing-hash');
    assert.equal((await db.queue.findUnique({ where: { serviceId: 1 } })).status, 'CLOSED');
    const active = await db.queueEntry.findMany({ where: { status: 'WAITING' }, orderBy: { position: 'asc' } });
    assert.deepEqual(active.map(row => [row.id, row.position]), [[2, 1], [1, 2]]);
    const served = await db.history.findUnique({ where: { entryId: 3 } });
    assert.equal(served.outcome, 'referred');
    assert.equal(served.problem, 'Original issue');
    assert.equal(served.notes, 'Original notes');
    assert.equal(served.completedAt.toISOString(), '2026-11-01T09:10:00.000Z');
    assert.equal((await db.queueEntry.findUnique({ where: { id: 4 } })).status, 'CANCELED');
    assert.equal((await db.history.findUnique({ where: { entryId: 4 } })).status, 'LEFT');
    assert.equal(await db.notification.count(), 1);
    await db.service.update({ where: { id: 1 }, data: { location: null, hours: null, contact: null, instructions: null } });
    assert.equal((await db.service.findUnique({ where: { id: 1 } })).location, null);
    assert.deepEqual(await db.$queryRawUnsafe('PRAGMA foreign_key_check'), []);
    await assert.rejects(db.userProfile.update({ where: { id: 1 }, data: { fullName: '' } }));

    const backups = (await readdir(directory)).filter(name => name.includes('.backup-'));
    assert.equal(backups.length, 1);
    const backup = new PrismaClient({ datasourceUrl: `file:${join(directory, backups[0])}` });
    try {
      const rows = await backup.$queryRawUnsafe('SELECT serviceId,notes FROM QueueEntry WHERE id=3');
      assert.deepEqual(rows, [{ serviceId: 1, notes: 'Original notes' }]);
    } finally { await backup.$disconnect(); }
    assert.match((await run('upgrade-queues')).stdout, /already applied/);
    assert.equal((await readdir(directory)).filter(name => name.includes('.backup-')).length, 1);
    assert.equal(await db.history.count(), 2);
  });

  test('upgrade rolls back when foreign-key preservation checks fail', async t => {
    const { db, directory, run } = await database(t, true);
    await db.$executeRawUnsafe('PRAGMA foreign_keys=OFF');
    await legacyRows(db, true);
    await assert.rejects(run('upgrade-queues'), /preservation checks failed/);
    const columns = await db.$queryRawUnsafe('PRAGMA table_info(QueueEntry)');
    assert.ok(columns.some(column => column.name === 'serviceId'));
    assert.ok(!columns.some(column => column.name === 'queueId'));
    assert.deepEqual(await db.$queryRawUnsafe('SELECT serviceId FROM QueueEntry WHERE id=1'), [{ serviceId: 999 }]);
    assert.deepEqual(await db.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('Queue','History')"), []);
    assert.equal((await readdir(directory)).filter(name => name.includes('.backup-')).length, 1);
  });

  test('upgrade rejects an unsupported schema before modifying it', async t => {
    const { db, directory, run } = await database(t, true);
    await db.$executeRawUnsafe('DROP TABLE QueueEntry');
    await assert.rejects(run('upgrade-queues'), /Expected the previous QueueEntry schema/);
    assert.equal((await readdir(directory)).filter(name => name.includes('.backup-')).length, 0);
    assert.equal(await db.service.count(), 0);
  });

  test('constraint CLI exports migration SQL and installs rules idempotently', async t => {
    const { db, run } = await database(t);
    const { stdout } = await run('enforce-constraints', '--sql');
    assert.equal(stdout.trim(), constraintStatements().map(statement => `${statement};`).join('\n\n'));
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.match((await run('enforce-constraints')).stdout, /constraints applied/);
    }
    const triggers = await db.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'validate_%'");
    assert.equal(triggers.length, 14);
    await assert.rejects(db.userCredentials.create({ data: { email: 'invalid', passwordHash: 'hash' } }));
  });

  test('seed creates linked records, remains repeatable, and archives reset queues', async t => {
    const { db, run } = await database(t);
    await run('seed');
    const counts = async () => ({ users: await db.userCredentials.count(), entries: await db.queueEntry.count(), history: await db.history.count() });
    const first = await counts();
    assert.equal(await db.service.count(), 4);
    assert.equal(await db.queue.count(), 4);
    assert.equal(await db.queueEntry.count({ where: { status: 'WAITING' } }), 12);
    assert.ok(first.history > 0);
    assert.equal(await db.userProfile.count(), first.users);
    await run('seed');
    assert.deepEqual(await counts(), first);
    const active = await db.queueEntry.findMany({ where: { status: 'WAITING' }, select: { id: true } });
    await run('seed', '--reset-queues');
    const reset = await counts();
    assert.equal(reset.users, first.users);
    assert.equal(reset.entries, first.entries + 12);
    assert.equal(reset.history, first.history + 12);
    assert.equal(await db.history.count({ where: { entryId: { in: active.map(row => row.id) }, status: 'LEFT' } }), 12);
    const queues = await db.queue.findMany({ include: { entries: { where: { status: 'WAITING' }, orderBy: { position: 'asc' } } } });
    for (const queue of queues) assert.deepEqual(queue.entries.map(row => row.position), queue.entries.map((_, index) => index + 1));
    assert.deepEqual(await db.$queryRawUnsafe('PRAGMA foreign_key_check'), []);
  });

  test('server entry point starts the API with the configured port', async () => {
    const { stdout } = await exec(process.execPath, ['--input-type=module', '-e', `
      process.env.PORT = '0';
      await import('./src/index.js');
      setTimeout(() => process.exit(0), 100);
    `], { cwd: serverDir, env: { ...process.env }, timeout: 10000 });
    assert.match(stdout, /QueueSmart API running at http:\/\/localhost:0/);
  });
});
