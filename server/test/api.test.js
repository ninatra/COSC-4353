// Route tests for the service and queue APIs: roles, validation and queue order.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { sampleService, startApp } from './helpers/app.js';

let app;
let admin;
let alice;
let bob;
before(async () => {
  app = await startApp('api');
  admin = await app.account('ADMIN');
  alice = await app.account('USER', 'Alice');
  bob = await app.account('USER', 'Bob');
});
after(() => app.close());

const create = async (overrides) => app.request('POST', '/services', { token: admin.token, body: sampleService(overrides) });

describe('services API', () => {
  test('admins create, update, list and delete services', async () => {
    const created = await create({ name: '  Library Desk ', location: 'Room 1', maxCapacity: 5 });
    assert.equal(created.status, 201);
    assert.equal(created.body.service.name, 'Library Desk');
    const { id } = created.body.service;

    const updated = await app.request('PUT', `/services/${id}`, { token: admin.token, body: { isOpen: false, expectedDuration: 12 } });
    assert.equal(updated.body.service.isOpen, false);
    assert.equal(updated.body.service.expectedDuration, 12);

    const list = await app.request('GET', '/services', { token: alice.token });
    assert.ok(list.body.services.some((s) => s.id === id));

    assert.equal((await app.request('DELETE', `/services/${id}`, { token: admin.token })).status, 200);
    assert.equal((await app.request('DELETE', `/services/${id}`, { token: admin.token })).status, 404);
  });

  test('rejects missing, wrongly typed and too-long fields', async () => {
    assert.equal((await create({ name: '' })).status, 400);
    assert.equal((await create({ name: 'x'.repeat(101) })).status, 400);
    assert.equal((await create({ description: 'x'.repeat(501) })).status, 400);
    assert.equal((await create({ expectedDuration: '10' })).status, 400);
    assert.equal((await create({ priority: 'URGENT' })).status, 400);
    assert.equal((await app.request('POST', '/services', { token: admin.token, body: [] })).status, 400);
    assert.equal((await app.request('PUT', '/services/abc', { token: admin.token, body: { isOpen: true } })).status, 400);
    assert.equal((await app.request('PUT', '/services/99999', { token: admin.token, body: { isOpen: true } })).status, 404);
    assert.equal((await app.request('PUT', '/services/1', { token: admin.token, body: { isOpen: 'yes' } })).status, 400);
    assert.equal((await app.request('DELETE', '/services/abc', { token: admin.token })).status, 400);
  });

  test('only administrators can change services', async () => {
    assert.equal((await app.request('POST', '/services', { token: alice.token, body: sampleService() })).status, 403);
    assert.equal((await app.request('GET', '/services')).status, 401);
  });

  test("a service with visit history can't be deleted", async () => {
    const { id } = (await create()).body.service;
    await app.request('POST', `/queues/${id}/join`, { token: alice.token });
    await app.request('POST', `/queues/${id}/leave`, { token: alice.token });
    assert.equal((await app.request('DELETE', `/services/${id}`, { token: admin.token })).status, 409);
  });
});

describe('queues API', () => {
  test('visitors join in arrival order and see their place and wait', async () => {
    const { id } = (await create({ expectedDuration: 15 })).body.service;
    assert.equal((await app.request('POST', `/queues/${id}/join`, { token: alice.token })).status, 201);
    const joined = await app.request('POST', `/queues/${id}/join`, { token: bob.token });
    assert.match(joined.body.entry.ticketId, /^TD-\d{3}$/);

    const mine = (await app.request('GET', '/queues/me', { token: bob.token })).body.ticket;
    assert.equal(mine.position, 2);
    assert.equal(mine.estimatedWait, 15);

    const queue = (await app.request('GET', `/queues/${id}`, { token: admin.token })).body.queue;
    assert.deepEqual(queue.map((e) => e.user.name), ['Alice', 'Bob']);

    // Everyone sees counts, but only admins see other visitors' names.
    const snapshot = (await app.request('GET', '/queues', { token: bob.token })).body;
    assert.equal(snapshot.queues[id].length, 2);
    assert.equal(snapshot.queues[id][0].user, undefined);
    assert.equal(snapshot.ticket.userId, bob.user.id);

    // Admin reorders, then serves the new front of the line.
    const ids = queue.map((e) => e.id);
    const reordered = await app.request('PUT', `/queues/${id}/reorder`, { token: admin.token, body: { entryIds: [ids[1], ids[0]], previousIds: ids } });
    assert.equal(reordered.status, 200);
    const served = await app.request('POST', `/queues/${id}/serve-next`, { token: admin.token, body: { entryId: ids[1], outcome: 'completed' } });
    assert.equal(served.body.entry.userId, bob.user.id);
    assert.equal(served.body.entry.status, 'SERVED');

    await app.request('POST', `/queues/${id}/serve-next`, { token: admin.token });
    assert.equal((await app.request('POST', `/queues/${id}/serve-next`, { token: admin.token })).status, 409);
    assert.equal((await app.request('GET', '/queues', { token: bob.token })).body.ticket.status, 'SERVED', 'shows the finished visit');

    // A newer finished visit must not hide the place you're holding now.
    await app.request('POST', `/queues/${id}/join`, { token: bob.token });
    const old = await app.prisma.queueEntry.create({ data: { userId: bob.user.id, serviceId: id, status: 'LEFT', completedAt: new Date() } });
    const now = (await app.request('GET', '/queues', { token: bob.token })).body.ticket;
    assert.equal(now.status, 'WAITING');
    assert.notEqual(now.id, old.id);
    await app.request('POST', `/queues/${id}/leave`, { token: bob.token });
    assert.equal((await app.request('GET', '/queues/me', { token: alice.token })).body.ticket, null);
  });

  test('blocks closed queues, full queues and a second active place', async () => {
    const closed = (await create({ maxCapacity: 1 })).body.service;
    await app.request('PUT', `/services/${closed.id}`, { token: admin.token, body: { isOpen: false } });
    assert.equal((await app.request('POST', `/queues/${closed.id}/join`, { token: alice.token })).status, 409);

    await app.request('PUT', `/services/${closed.id}`, { token: admin.token, body: { isOpen: true } });
    assert.equal((await app.request('POST', `/queues/${closed.id}/join`, { token: alice.token })).status, 201);
    assert.match((await app.request('POST', `/queues/${closed.id}/join`, { token: bob.token })).body.error, /capacity/);

    const other = (await create()).body.service;
    assert.match((await app.request('POST', `/queues/${other.id}/join`, { token: alice.token })).body.error, /one place/);
    await app.request('POST', `/queues/${closed.id}/leave`, { token: alice.token });
    assert.equal((await app.request('POST', `/queues/${closed.id}/leave`, { token: alice.token })).status, 404);
  });

  test('admins remove visitors while preserving history and notifying the student', async () => {
    const { id } = (await create()).body.service;
    const entry = (await app.request('POST', `/queues/${id}/join`, { token: alice.token })).body.entry;
    await app.request('POST', `/queues/${id}/join`, { token: bob.token });
    const path = `/queues/${id}/entries/${entry.id}`;
    assert.equal((await app.request('DELETE', path)).status, 401);
    assert.equal((await app.request('DELETE', path, { token: bob.token })).status, 403);
    assert.equal((await app.request('DELETE', `/queues/${id}/entries/abc`, { token: admin.token })).status, 400);
    assert.equal((await app.request('DELETE', `/queues/99999/entries/${entry.id}`, { token: admin.token })).status, 404);
    assert.equal((await app.request('DELETE', path, { token: admin.token, body: { notes: 123 } })).status, 400);
    assert.equal((await app.request('DELETE', path, { token: admin.token, body: { notes: 'x'.repeat(501) } })).status, 400);
    assert.equal((await app.request('DELETE', path, { token: admin.token, body: { notes: ' Student unavailable when called ' } })).status, 200);
    assert.equal((await app.request('DELETE', path, { token: admin.token })).status, 404);
    const saved = await app.prisma.queueEntry.findUnique({ where: { id: entry.id } });
    assert.equal(saved.status, 'NO_SHOW');
    assert.equal(saved.notes, 'Student unavailable when called');
    assert.ok(saved.completedAt);
    assert.ok(await app.prisma.notification.findFirst({ where: { userId: alice.user.id, entryId: entry.id, kind: 'removed' } }));
    assert.equal((await app.request('GET', '/queues/me', { token: bob.token })).body.ticket.position, 1);
    assert.equal((await app.request('POST', `/queues/${id}/join`, { token: alice.token })).status, 201);
    await app.request('POST', `/queues/${id}/leave`, { token: alice.token });
    await app.request('POST', `/queues/${id}/leave`, { token: bob.token });
  });

  test('checks roles, IDs and request bodies', async () => {
    const { id } = (await create()).body.service;
    assert.equal((await app.request('POST', `/queues/${id}/join`, { token: admin.token })).status, 403);
    assert.equal((await app.request('POST', `/queues/${id}/serve-next`, { token: alice.token })).status, 403);
    assert.equal((await app.request('GET', `/queues/${id}`, { token: alice.token })).status, 403);
    assert.equal((await app.request('POST', '/queues/abc/join', { token: alice.token })).status, 400);
    assert.equal((await app.request('POST', '/queues/99999/join', { token: alice.token })).status, 404);
    assert.equal((await app.request('GET', '/queues/99999', { token: admin.token })).status, 404);
    assert.equal((await app.request('POST', '/queues/99999/serve-next', { token: admin.token })).status, 404);
    assert.equal((await app.request('PUT', '/queues/99999/reorder', { token: admin.token, body: { entryIds: [], previousIds: [] } })).status, 404);
    assert.equal((await app.request('POST', `/queues/${id}/serve-next`, { token: admin.token, body: { outcome: 'lost' } })).status, 400);
    assert.equal((await app.request('PUT', `/queues/${id}/reorder`, { token: admin.token, body: { entryIds: 'x' } })).status, 400);

    await app.request('POST', `/queues/${id}/join`, { token: bob.token });
    assert.equal((await app.request('POST', `/queues/${id}/serve-next`, { token: admin.token, body: { entryId: 99999 } })).status, 409);
    assert.equal((await app.request('GET', '/queues/me', { token: bob.token })).body.ticket.position, 1);
    await app.request('POST', `/queues/${id}/leave`, { token: bob.token });
  });

  test('broken JSON is a 400 with a clear message', async () => {
    const res = await app.request('POST', '/auth/login', { raw: '{bad json' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /valid JSON/);
  });
});
