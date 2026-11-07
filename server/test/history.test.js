import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { FINISHED_STATUSES, sortHistory, toHistoryRow, historyQuery } from '../src/logic/history.js';
import { sampleService, startApp } from './helpers/app.js';

describe('history rows', () => {
  const base = { id: 5, ticketId: 'IT-005', serviceId: 2, joinedAt: '2026-10-01T09:00:00Z', problem: 'Wi-Fi', notes: '' };

  test('served visits show the staff outcome; others show how they ended', () => {
    const served = toHistoryRow({ ...base, status: 'SERVED', outcome: 'referred', completedAt: '2026-10-01T09:20:00Z',
      service: { name: 'IT Help Desk' }, user: { email: 'hao@school.edu', profile: { fullName: 'Hao Pham' } } });
    assert.equal(served.result, 'served');
    assert.equal(served.outcome, 'referred');
    assert.equal(served.serviceName, 'IT Help Desk');
    assert.equal(served.visitorName, 'Hao Pham');
    assert.equal(served.endedAt, '2026-10-01T09:20:00Z');

    const left = toHistoryRow({ ...base, status: 'LEFT' });
    assert.equal(left.result, 'left');
    assert.equal(left.outcome, null);
    assert.equal(left.serviceName, 'Deleted service');
    assert.equal(left.endedAt, base.joinedAt);
    assert.equal(toHistoryRow({ ...base, status: 'NO_SHOW', problem: undefined }).result, 'removed');
    assert.equal(toHistoryRow({ ...base, status: 'SERVED', outcome: null }).outcome, 'completed');
    assert.deepEqual(FINISHED_STATUSES, ['SERVED', 'LEFT', 'NO_SHOW']);
  });

  test('newest visit first, without changing the input', () => {
    const rows = [{ id: 1, endedAt: '2026-10-01' }, { id: 2, endedAt: '2026-10-03' }, { id: 3, endedAt: '2026-10-03' }];
    assert.deepEqual(sortHistory(rows).map((r) => r.id), [3, 2, 1]);
    assert.equal(rows[0].id, 1);
  });
});

describe('history API', () => {
  let app;
  let admin;
  let user;
  let other;
  let serviceId;
  before(async () => {
    app = await startApp('history');
    admin = await app.account('ADMIN');
    user = await app.account('USER', 'Hao Pham');
    other = await app.account();
    serviceId = (await app.request('POST', '/services', { token: admin.token, body: sampleService() })).body.service.id;
    await app.request('POST', `/queues/${serviceId}/join`, { token: user.token });
    await app.request('POST', `/queues/${serviceId}/serve-next`, { token: admin.token, body: { problem: 'Password reset' } });
    await app.request('POST', `/queues/${serviceId}/join`, { token: user.token });
    await app.request('POST', `/queues/${serviceId}/leave`, { token: user.token });
    await app.request('POST', `/queues/${serviceId}/join`, { token: other.token });
  });
  after(() => app.close());

  test('users see only their own finished visits, newest first', async () => {
    const { history } = (await app.request('GET', '/history', { token: user.token })).body;
    assert.deepEqual(history.map((r) => r.result), ['left', 'served']);
    assert.equal(history[1].problem, 'Password reset');
    assert.equal((await app.request('GET', '/history', { token: other.token })).body.history.length, 0, 'still waiting is not history');
  });

  test('administrators see every visit and can correct a served one', async () => {
    const { history } = (await app.request('GET', '/history', { token: admin.token })).body;
    const served = history.find((r) => r.result === 'served');
    assert.equal(served.visitorName, 'Hao Pham');

    const res = await app.request('PUT', `/history/${served.id}`, { token: admin.token, body: { outcome: 'follow-up', notes: 'Call back Friday' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.visit.outcome, 'follow-up');
    assert.equal(res.body.visit.notes, 'Call back Friday');
  });

  test('history filters and pagination run on the server and preserve ownership', async () => {
    const query = `/history?paginated=true&serviceId=${serviceId}&status=SERVED&search=Hao&pageSize=10`;
    const result = await app.request('GET', query, { token: admin.token });
    assert.equal(result.status, 200);
    assert.equal(result.body.total, 1);
    assert.equal(result.body.history.length, 1);
    assert.equal(result.body.history[0].result, 'served');
    assert.equal((await app.request('GET', `${query}&page=2`, { token: admin.token })).body.history.length, 0);
    assert.equal((await app.request('GET', query, { token: other.token })).body.total, 0);
    assert.equal((await app.request('GET', '/history?paginated=true&from=2000-01-01&to=2000-01-02', { token: admin.token })).body.total, 0);
    assert.equal((await app.request('GET', '/history?paginated=true&pageSize=999', { token: admin.token })).status, 400);
  });

  test('outcome filters retrieve matching served visits and preserve ownership', async () => {
    const visitor = await app.account('USER', 'Outcome Student');
    const id = (await app.request('POST', '/services', { token: admin.token, body: sampleService() })).body.service.id;
    for (const outcome of ['completed', 'referred', 'unresolved', 'follow-up', null]) {
      const joined = await app.request('POST', `/queues/${id}/join`, { token: visitor.token });
      assert.equal(joined.status, 201);
      assert.equal((await app.request('POST', `/queues/${id}/serve-next`, { token: admin.token, body: { outcome: outcome ?? 'completed' } })).status, 200);
      if (outcome === null) await app.prisma.history.update({ where: { entryId: joined.body.entry.id }, data: { outcome: null } });
    }
    await app.request('POST', `/queues/${id}/join`, { token: visitor.token });
    await app.request('POST', `/queues/${id}/leave`, { token: visitor.token });
    for (const outcome of ['completed', 'referred', 'unresolved', 'follow-up']) {
      const query = `/history?paginated=true&serviceId=${id}&outcome=${outcome}&search=Outcome&pageSize=10`;
      const result = await app.request('GET', query, { token: admin.token });
      assert.equal(result.status, 200);
      assert.equal(result.body.total, outcome === 'completed' ? 2 : 1);
      assert.ok(result.body.history.every(row => row.result === 'served' && row.outcome === outcome));
      assert.equal((await app.request('GET', query, { token: other.token })).body.total, 0);
    }
    const conflict = await app.request('GET', `/history?paginated=true&serviceId=${id}&status=LEFT&outcome=referred`, { token: admin.token });
    assert.equal(conflict.body.total, 1, 'an outcome selects served visits');
    assert.equal((await app.request('GET', '/history?paginated=true&outcome=invalid', { token: admin.token })).status, 400);
  });

  test('editing checks role, ID, input and visit status', async () => {
    const { history } = (await app.request('GET', '/history', { token: admin.token })).body;
    const served = history.find((r) => r.result === 'served');
    const left = history.find((r) => r.result === 'left');
    assert.equal((await app.request('PUT', `/history/${served.id}`, { token: user.token, body: {} })).status, 403);
    assert.equal((await app.request('PUT', '/history/0', { token: admin.token, body: {} })).status, 400);
    assert.equal((await app.request('PUT', `/history/${served.id}`, { token: admin.token, body: { outcome: 'lost' } })).status, 400);
    assert.equal((await app.request('PUT', `/history/${served.id}`, { token: admin.token, body: { notes: 'x'.repeat(501) } })).status, 400);
    assert.equal((await app.request('PUT', '/history/99999', { token: admin.token, body: {} })).status, 404);
    const changed = await app.request('PUT', `/history/${left.id}`, { token: admin.token, body: { notes: 'Student called to cancel', outcome: 'completed', problem: 'Do not change' } });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.visit.notes, 'Student called to cancel');
    assert.equal(changed.body.visit.result, 'left');
    assert.equal(changed.body.visit.outcome, null);
    assert.equal(changed.body.visit.problem, left.problem);
  });
});

describe('history query filters', () => {
  test('outcome filters select served visits and match legacy completed outcomes', () => {
    assert.equal(historyQuery({ outcome: 'referred', status: 'LEFT' }).where.status, 'SERVED');
    assert.equal(historyQuery({ outcome: 'referred' }).where.outcome, 'referred');
    assert.deepEqual(historyQuery({ outcome: 'completed' }).where.OR, [{ outcome: 'completed' }, { outcome: null }]);
    assert.ok(historyQuery({ outcome: ['completed', 'referred'] }).error);
  });
  test('history queries default to a bounded page of finished visits', () => {
    const result = historyQuery({});
    assert.equal(result.pageSize, 15);
    assert.equal(result.skip, 0);
    assert.deepEqual(result.where.status.in, ['SERVED', 'LEFT', 'NO_SHOW']);
  });
  test('history queries combine service, status, dates, search and pagination', () => {
    const result = historyQuery({ page: '2', serviceId: '3', status: 'SERVED', from: '2026-10-23T05:00:00Z', to: '2026-10-24T05:00:00Z', search: ' AA-002 ' });
    assert.equal(result.skip, 15);
    assert.equal(result.where.entry.queue.serviceId, 3);
    assert.equal(result.where.status, 'SERVED');
    assert.equal(result.where.entry.OR[0].ticketId.contains, 'AA-002');
    assert.equal(result.where.entry.OR[1].user.profile.fullName.contains, 'AA-002');
    assert.equal(result.where.completedAt.lt.toISOString(), '2026-10-24T05:00:00.000Z');
  });
  test('history queries reject invalid pagination, filters and date ranges', () => {
    for (const query of [{ page: '0' }, { page: '1.5' }, { pageSize: '1000' }, { serviceId: '-1' }, { status: 'WAITING' }, { from: 'invalid' }, { from: '2026-10-24', to: '2026-10-23' }, { search: 'x'.repeat(101) }]) assert.ok(historyQuery(query).error);
  });
});
