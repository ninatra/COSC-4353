import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { FINISHED_STATUSES, sortHistory, toHistoryRow } from '../src/logic/history.js';
import { sampleService, startApp } from './helpers/app.js';

describe('history rows', () => {
  const base = { id: 5, ticketId: 'IT-005', serviceId: 2, joinedAt: '2026-10-01T09:00:00Z', problem: 'Wi-Fi', notes: '' };

  test('served visits show the staff outcome; others show how they ended', () => {
    const served = toHistoryRow({ ...base, status: 'SERVED', outcome: 'referred', completedAt: '2026-10-01T09:20:00Z',
      service: { name: 'IT Help Desk' }, user: { name: 'Hao Pham', email: 'hao@school.edu' } });
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

  test('editing checks role, ID, input and visit status', async () => {
    const { history } = (await app.request('GET', '/history', { token: admin.token })).body;
    const served = history.find((r) => r.result === 'served');
    const left = history.find((r) => r.result === 'left');
    assert.equal((await app.request('PUT', `/history/${served.id}`, { token: user.token, body: {} })).status, 403);
    assert.equal((await app.request('PUT', '/history/0', { token: admin.token, body: {} })).status, 400);
    assert.equal((await app.request('PUT', `/history/${served.id}`, { token: admin.token, body: { outcome: 'lost' } })).status, 400);
    assert.equal((await app.request('PUT', `/history/${served.id}`, { token: admin.token, body: { notes: 'x'.repeat(501) } })).status, 400);
    assert.equal((await app.request('PUT', '/history/99999', { token: admin.token, body: {} })).status, 404);
    assert.equal((await app.request('PUT', `/history/${left.id}`, { token: admin.token, body: {} })).status, 409);
  });
});
