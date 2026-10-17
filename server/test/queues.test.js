import assert from 'node:assert/strict';
import test from 'node:test';
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
