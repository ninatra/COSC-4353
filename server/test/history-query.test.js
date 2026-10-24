import assert from 'node:assert/strict';
import test from 'node:test';
import { historyQuery } from '../src/logic/history.js';

test('history queries default to a bounded page of finished visits', () => {
 const result = historyQuery({});
 assert.equal(result.pageSize, 15);
 assert.equal(result.skip, 0);
 assert.deepEqual(result.where.status.in, ['SERVED', 'LEFT', 'NO_SHOW']);
});
test('history queries combine service, status, dates, search and pagination', () => {
 const result = historyQuery({ page: '2', serviceId: '3', status: 'SERVED', from: '2026-10-23T05:00:00Z', to: '2026-10-24T05:00:00Z', search: ' AA-002 ' });
 assert.equal(result.skip, 15);
 assert.equal(result.where.serviceId, 3);
 assert.equal(result.where.status, 'SERVED');
 assert.equal(result.where.OR[0].ticketId.contains, 'AA-002');
 assert.equal(result.where.completedAt.lt.toISOString(), '2026-10-24T05:00:00.000Z');
});
test('history queries reject invalid pagination, filters and date ranges', () => {
 for (const query of [{ page: '0' }, { page: '1.5' }, { pageSize: '1000' }, { serviceId: '-1' }, { status: 'WAITING' }, { from: 'invalid' }, { from: '2026-10-24', to: '2026-10-23' }, { search: 'x'.repeat(101) }]) assert.ok(historyQuery(query).error);
});
