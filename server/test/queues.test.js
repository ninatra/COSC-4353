import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { sampleService, startApp } from './helpers/app.js';
import { orderQueue, joinError, positionInQueue, validateCompletion, formatTicketId, validateReorder } from '../src/logic/queue.js';

test('ticket IDs use service initials and a padded entry number', () => {
  assert.equal(formatTicketId('Academic Advising', 2), 'AA-002');
  assert.equal(formatTicketId('IT Help Desk', 3), 'IT-003');
  assert.equal(formatTicketId('Financial Aid', 1000), 'FA-1000');
  assert.equal(formatTicketId('Support', 1), 'SU-001');
  assert.equal(formatTicketId('123', 1), 'SV-001');
  assert.equal(formatTicketId('A', 1), 'AX-001');
});

const service = { isOpen: true, maxCapacity: 2 };
const entries = [
  { id: 3, priority: 'LOW', joinedAt: '2026-01-01T09:00:00Z' },
  { id: 2, priority: 'HIGH', joinedAt: '2026-01-01T10:00:00Z' },
  { id: 1, priority: 'HIGH', joinedAt: '2026-01-01T09:30:00Z' },
  { id: 4, priority: 'MEDIUM', joinedAt: '2026-01-01T09:00:00Z' },
];
test('priority precedes arrival time without mutating input', () => {
  assert.deepEqual(orderQueue(entries).map(e => e.id), [1, 2, 4, 3]);
  assert.equal(entries[0].id, 3);
});
test('equal priority uses arrival order, then ID for tied timestamps', () => {
  const queue = [
    { id: 3, priority: 'MEDIUM', joinedAt: '2026-01-01T10:00:00Z' },
    { id: 2, priority: 'MEDIUM', joinedAt: '2026-01-01T09:00:00Z' },
    { id: 1, priority: 'MEDIUM', joinedAt: '2026-01-01T09:00:00Z' },
  ];
  assert.deepEqual(orderQueue(queue).map(e => e.id), [1, 2, 3]);
  assert.deepEqual(orderQueue([]), []);
});
test('missing service and closed queues reject joining', () => {
  assert.equal(joinError(null, null, 0).status, 404);
  assert.equal(joinError({ ...service, isOpen: false }, null, 0).status, 409);
});
test('existing active entry blocks joining any additional queue', () => {
  assert.match(joinError(service, { serviceId: 99 }, 0).error, /one place/);
});
test('capacity blocks full queues, while available and unlimited queues accept joins', () => {
  assert.equal(joinError(service, null, 2).status, 409);
  assert.equal(joinError(service, null, 3).status, 409);
  assert.equal(joinError(service, null, 1), null);
  assert.equal(joinError({ ...service, maxCapacity: null }, null, 999), null);
});
test('position and wait follow ordered queue and recalculate after departures', () => {
  assert.deepEqual(positionInQueue(entries, 4, 10), { position: 3, estimatedWait: 20 });
  assert.deepEqual(positionInQueue(entries.filter(e => e.id !== 1), 4, 10), { position: 2, estimatedWait: 10 });
  assert.deepEqual(positionInQueue(entries, 1, 10), { position: 1, estimatedWait: 0 });
  assert.deepEqual(positionInQueue(entries, 999, 10), { position: null, estimatedWait: null });
});
test('completion permits an optional problem and trims visit details', () => {
  assert.deepEqual(validateCompletion(), { data: { outcome: 'completed', problem: '', notes: '' } });
  assert.deepEqual(validateCompletion({ outcome: 'referred', problem: ' Help ', notes: ' Refer ' }).data,
    { outcome: 'referred', problem: 'Help', notes: 'Refer' });
  for (const outcome of ['completed', 'referred', 'unresolved', 'follow-up']) assert.ok(validateCompletion({ outcome }).data);
});
test('invalid completion bodies, outcomes, text, and entry IDs are rejected', () => {
  for (const body of [null, [], 'text', { outcome: 'INVALID' }, { problem: 5 }, { notes: null },
    { problem: 'a'.repeat(501) }, { notes: 'a'.repeat(501) }, { entryId: '1' }, { entryId: 0 }]) {
    assert.ok(validateCompletion(body).error);
  }
  assert.ok(validateCompletion({ problem: 'a'.repeat(500), notes: 'b'.repeat(500), entryId: 1 }).data);
});

test('manual queue order overrides priority and arrival; new visitors follow reordered entries', () => {
  const queue = [
    { id: 1, manualOrder: 1, priority: 'HIGH', joinedAt: '2026-01-01T09:00:00Z' },
    { id: 2, manualOrder: 0, priority: 'LOW', joinedAt: '2026-01-01T10:00:00Z' },
    { id: 3, manualOrder: null, priority: 'HIGH', joinedAt: '2026-01-01T11:00:00Z' },
  ];
  assert.deepEqual(orderQueue(queue).map(e => e.id), [2, 1, 3]);
  assert.deepEqual(positionInQueue(queue, 1, 10), { position: 2, estimatedWait: 10 });
});

test('reorder requires a complete, unique permutation and rejects stale requests', () => {
  assert.equal(validateReorder({ entryIds: [3, 1, 2], previousIds: [1, 2, 3] }, [1, 2, 3]), null);
  for (const body of [null, {}, { entryIds: [1, 1], previousIds: [1, 2] }, { entryIds: ['1'], previousIds: [1] },
    { entryIds: [1], previousIds: [1, 2] }, { entryIds: [1, 99], previousIds: [1, 2] }]) {
    assert.equal(validateReorder(body, [1, 2]).status, 400);
  }
  assert.equal(validateReorder({ entryIds: [2, 1], previousIds: [1, 2] }, [1, 2, 3]).status, 409);
  assert.equal(validateReorder({ entryIds: [2, 1], previousIds: [1, 2] }, [2, 1]).status, 409);
});

describe('queues API', () => {
  let app;
  let admin;
  let alice;
  let bob;
  before(async () => {
    app = await startApp('queues');
    admin = await app.account('ADMIN');
    alice = await app.account('USER', 'Alice');
    bob = await app.account('USER', 'Bob');
  });
  after(() => app.close());
  const create = async overrides => app.request('POST', '/services', { token: admin.token, body: sampleService(overrides) });

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
    const old = await app.prisma.queueEntry.create({ data: { userId: bob.user.id, queueId: (await app.prisma.queue.findUnique({ where: { serviceId: id } })).id, status: 'CANCELED', history: { create: { status: 'LEFT' } } } });
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
    const saved = await app.prisma.queueEntry.findUnique({ where: { id: entry.id }, include: { history: true } });
    assert.equal(saved.status, 'CANCELED');
    assert.equal(saved.history.status, 'NO_SHOW');
    assert.equal(saved.position, null);
    assert.equal(saved.history.notes, 'Student unavailable when called');
    assert.ok(saved.history.completedAt);
    assert.ok(await app.prisma.notification.findFirst({ where: { userId: alice.user.id, entryId: entry.id, kind: 'removed' } }));
    assert.equal((await app.request('GET', '/queues/me', { token: bob.token })).body.ticket.position, 1);
    assert.equal((await app.request('POST', `/queues/${id}/join`, { token: alice.token })).status, 201);
    await app.request('POST', `/queues/${id}/leave`, { token: alice.token });
    await app.request('POST', `/queues/${id}/leave`, { token: bob.token });
  });

  test('stores queue status, contiguous positions and separate visit history', async () => {
    const { id } = (await create()).body.service;
    const first = await app.account();
    const second = await app.account();
    const third = await app.account();
    const queue = await app.prisma.queue.findUnique({ where: { serviceId: id } });
    assert.equal(queue.status, 'OPEN');
    assert.ok(queue.createdAt);
    const join = async account => (await app.request('POST', `/queues/${id}/join`, { token: account.token })).body.entry;
    const a = await join(first);
    const b = await join(second);
    const rows = () => app.prisma.queueEntry.findMany({ where: { queueId: queue.id, status: 'WAITING' }, orderBy: { position: 'asc' } });
    assert.deepEqual((await rows()).map(row => row.position), [1, 2]);
    assert.equal(await app.prisma.history.count({ where: { entryId: { in: [a.id, b.id] } } }), 0);
    await app.request('PUT', `/queues/${id}/reorder`, { token: admin.token, body: { previousIds: [a.id, b.id], entryIds: [b.id, a.id] } });
    const c = await join(third);
    assert.deepEqual((await rows()).map(row => row.id), [b.id, a.id, c.id]);
    await app.request('POST', `/queues/${id}/serve-next`, { token: admin.token, body: { notes: 'Finished visit' } });
    assert.deepEqual((await rows()).map(row => row.position), [1, 2]);
    const finished = await app.prisma.queueEntry.findUnique({ where: { id: b.id } });
    assert.equal(finished.status, 'SERVED');
    assert.equal(finished.position, null);
    assert.equal(Object.hasOwn(finished, 'notes'), false);
    assert.equal((await app.prisma.history.findUnique({ where: { entryId: b.id } })).notes, 'Finished visit');
    await app.request('PUT', `/services/${id}`, { token: admin.token, body: { isOpen: false } });
    assert.equal((await app.prisma.queue.findUnique({ where: { serviceId: id } })).status, 'CLOSED');
    await app.request('POST', `/queues/${id}/leave`, { token: first.token });
    assert.deepEqual((await rows()).map(row => row.position), [1]);
    assert.equal((await app.prisma.queueEntry.findUnique({ where: { id: a.id } })).status, 'CANCELED');
    assert.equal((await app.prisma.history.findUnique({ where: { entryId: a.id } })).status, 'LEFT');
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

});
