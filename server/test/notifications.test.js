import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  ALMOST_READY_POSITION, almostReadyNotifications, joinNotifications, leftNotification, servedNotification,
} from '../src/logic/notifications.js';
import { sampleService, startApp } from './helpers/app.js';

const service = { id: 7, name: 'IT Help Desk', expectedDuration: 10, location: 'Room 112', maxCapacity: null };
const entry = { id: 40, ticketId: 'IT-040', userId: 3 };

describe('notification rules', () => {
  test('joining notifies the visitor with position and wait', () => {
    const [notice] = joinNotifications({ entry, service, position: 3, waitingCount: 3, userId: 3, adminIds: [] });
    assert.equal(notice.userId, 3);
    assert.equal(notice.kind, 'confirmed');
    assert.match(notice.message, /IT-040/);
    assert.match(notice.message, /#3 in line/);
    assert.match(notice.message, /20 minutes/);
    assert.equal(notice.entryId, 40);
  });

  test('administrators hear about every join, the first visitor, and a full queue', () => {
    const busy = joinNotifications({ entry, service, position: 3, waitingCount: 3, userId: 3, adminIds: [1, 2] });
    assert.deepEqual(busy.filter((n) => n.kind === 'joined').map((n) => n.userId), [1, 2]);
    assert.equal(busy.some((n) => n.kind === 'queue-active'), false);

    const first = joinNotifications({ entry, service, position: 1, waitingCount: 1, userId: 3, adminIds: [1] });
    assert.ok(first.some((n) => n.kind === 'queue-active'));

    const full = joinNotifications({ entry, service: { ...service, maxCapacity: 3 }, position: 3, waitingCount: 3, userId: 3, adminIds: [1] });
    assert.match(full.find((n) => n.kind === 'capacity').message, /3 of 3/);
  });

  test('visitors in the first two places get one "almost ready" notice', () => {
    const ordered = [10, 11, 12].map((id) => ({ id, userId: id, ticketId: `IT-0${id}`, status: 'WAITING' }));
    const notices = almostReadyNotifications(ordered, [], service);
    assert.equal(ALMOST_READY_POSITION, 2);
    assert.deepEqual(notices.map((n) => n.entryId), [10, 11]);
    assert.match(notices[0].message, /You're next/);
    assert.match(notices[1].message, /One person is ahead/);
    assert.match(notices[0].message, /Room 112/);
    assert.deepEqual(almostReadyNotifications(ordered, [10], service).map((n) => n.entryId), [11]);
    assert.deepEqual(almostReadyNotifications(ordered, [10, 11], service), []);
  });

  test('someone already being served is not told they are almost ready', () => {
    const ordered = [{ id: 1, userId: 1, status: 'SERVING' }, { id: 2, userId: 2, status: 'WAITING' }];
    assert.deepEqual(almostReadyNotifications(ordered, [], { ...service, location: '' }).map((n) => n.entryId), [2]);
    assert.match(almostReadyNotifications(ordered, [], { ...service, location: '' })[0].message, /the service desk/);
  });

  test('served and left notices name the service', () => {
    assert.match(servedNotification(entry, service).message, /IT Help Desk is complete/);
    assert.equal(leftNotification(entry, service).kind, 'left');
    assert.match(leftNotification(entry, service).message, /IT-040 was released/);
  });
});

describe('notifications API', () => {
  let app;
  let admin;
  let serviceId;
  before(async () => {
    app = await startApp('notifications');
    admin = await app.account('ADMIN');
    serviceId = (await app.request('POST', '/services', { token: admin.token, body: sampleService({ maxCapacity: 3 }) })).body.service.id;
  });
  after(() => app.close());

  const kinds = async (token) => (await app.request('GET', '/notifications', { token })).body.notifications.map((n) => n.kind);

  test('joining creates a confirmation, and the front two are almost ready', async () => {
    const first = await app.account();
    assert.equal((await app.request('POST', `/queues/${serviceId}/join`, { token: first.token })).status, 201);
    assert.deepEqual((await kinds(first.token)).sort(), ['almost', 'confirmed']);
    assert.ok((await kinds(admin.token)).includes('queue-active'));
  });

  test('a visitor further back is alerted once they move up', async () => {
    const second = await app.account();
    const third = await app.account();
    await app.request('POST', `/queues/${serviceId}/join`, { token: second.token });
    await app.request('POST', `/queues/${serviceId}/join`, { token: third.token });
    assert.deepEqual(await kinds(third.token), ['confirmed']);
    assert.ok((await kinds(admin.token)).includes('capacity'));

    await app.request('POST', `/queues/${serviceId}/serve-next`, { token: admin.token });
    assert.ok((await kinds(third.token)).includes('almost'));

    // Serving again must not repeat the alert for someone already told.
    await app.request('POST', `/queues/${serviceId}/serve-next`, { token: admin.token });
    assert.equal((await kinds(third.token)).filter((k) => k === 'almost').length, 1);
    assert.ok((await kinds(second.token)).includes('served'));

    await app.request('POST', `/queues/${serviceId}/leave`, { token: third.token });
    assert.equal((await kinds(third.token))[0], 'left');
  });

  test('marks one or all as read, and clears the list', async () => {
    const user = await app.account();
    await app.request('POST', `/queues/${serviceId}/join`, { token: user.token });
    let list = (await app.request('GET', '/notifications', { token: user.token })).body;
    assert.equal(list.unread, list.notifications.length);

    const id = list.notifications[0].id;
    assert.equal((await app.request('PATCH', `/notifications/${id}/read`, { token: user.token })).status, 200);
    list = (await app.request('GET', '/notifications', { token: user.token })).body;
    assert.equal(list.notifications.find((n) => n.id === id).read, true);

    assert.equal((await app.request('PATCH', '/notifications/read-all', { token: user.token })).status, 200);
    assert.equal((await app.request('GET', '/notifications', { token: user.token })).body.unread, 0);

    assert.ok((await app.request('DELETE', '/notifications', { token: user.token })).body.deleted > 0);
    assert.deepEqual(await kinds(user.token), []);
  });

  test("can't touch someone else's notification, and checks the ID", async () => {
    const owner = (await app.request('GET', '/notifications', { token: admin.token })).body.notifications[0];
    const other = await app.account();
    assert.equal((await app.request('PATCH', `/notifications/${owner.id}/read`, { token: other.token })).status, 404);
    assert.equal((await app.request('PATCH', '/notifications/abc/read', { token: other.token })).status, 400);
    assert.equal((await app.request('GET', '/notifications')).status, 401);
  });
});
