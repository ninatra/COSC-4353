import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { identity, publicUser } from '../src/logic/users.js';
import { PHONE_MAX, validateProfile } from '../src/validation/profile.js';
import { sampleService, startApp } from './helpers/app.js';

describe('profile validation', () => {
  test('accepts a partial update and cleans the values', () => {
    assert.deepEqual(validateProfile({ fullName: '  Hao Pham ', phone: ' (713) 555-0100 ', almostReadyAlerts: false }).data,
      { fullName: 'Hao Pham', phone: '(713) 555-0100', almostReadyAlerts: false });
    assert.deepEqual(validateProfile({ phone: '+1 713 555 0100' }).data, { phone: '+1 713 555 0100' });
  });
  test('an empty phone clears it', () => {
    assert.deepEqual(validateProfile({ phone: '' }).data, { phone: null });
    assert.deepEqual(validateProfile({ phone: null }).data, { phone: null });
  });
  test('rejects missing, wrongly typed and too-long values', () => {
    assert.match(validateProfile({ fullName: '   ' }).error, /required/);
    assert.match(validateProfile({ fullName: 5 }).error, /required/);
    assert.match(validateProfile({ fullName: 'x'.repeat(51) }).error, /at most 50/);
    assert.match(validateProfile({ phone: 'call me' }).error, /Phone/);
    assert.match(validateProfile({ phone: '1'.repeat(PHONE_MAX + 1) }).error, /Phone/);
    assert.match(validateProfile({ phone: 7135550100 }).error, /Phone/);
    assert.match(validateProfile({ almostReadyAlerts: 'yes' }).error, /true or false/);
    assert.match(validateProfile({}).error, /at least one/);
    assert.match(validateProfile([]).error, /object/);
    assert.match(validateProfile(null).error, /object/);
  });
});

describe('joining credentials and profile', () => {
  test('identity uses the profile name, falling back to the email', () => {
    assert.deepEqual(identity({ email: 'a@b.edu', profile: { fullName: 'Ann' } }), { name: 'Ann', email: 'a@b.edu' });
    assert.deepEqual(identity({ email: 'a@b.edu', profile: null }), { name: 'a@b.edu', email: 'a@b.edu' });
    assert.equal(identity(undefined), undefined);
  });
  test('publicUser never includes secrets', () => {
    const user = publicUser({ id: 1, email: 'a@b.edu', role: 'USER', emailVerified: true, createdAt: 'now',
      passwordHash: 'secret', verificationToken: 'token', profile: { fullName: 'Ann', phone: '7135550100', almostReadyAlerts: false } });
    assert.equal(user.passwordHash, undefined);
    assert.equal(user.verificationToken, undefined);
    assert.equal(user.name, 'Ann');
    assert.equal(user.phone, '7135550100');
    assert.equal(user.almostReadyAlerts, false);
    assert.equal(publicUser({ id: 2, email: 'c@d.edu', role: 'USER' }).almostReadyAlerts, true);
  });
});

describe('profile API and database', () => {
  let app;
  before(async () => { app = await startApp('profile'); });
  after(() => app.close());

  test('reads and updates the signed-in profile, and the change persists', async () => {
    const { token, user } = await app.account('USER', 'Ann Lee');
    const read = await app.request('GET', '/profile', { token });
    assert.equal(read.status, 200);
    assert.equal(read.body.user.name, 'Ann Lee');
    assert.equal(read.body.user.phone, null);

    const saved = await app.request('PUT', '/profile', { token, body: { fullName: 'Ann Lee-Park', phone: '713-555-0100', almostReadyAlerts: false } });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.user.name, 'Ann Lee-Park');

    // A separate request reads it back from the database.
    const me = await app.request('GET', '/auth/me', { token });
    assert.equal(me.body.user.name, 'Ann Lee-Park');
    assert.equal(me.body.user.phone, '713-555-0100');
    const row = await app.prisma.userProfile.findUnique({ where: { email: user.email } });
    assert.equal(row.almostReadyAlerts, false);
  });

  test('rejects bad input and requires login', async () => {
    const { token } = await app.account();
    assert.equal((await app.request('PUT', '/profile', { token, body: { phone: 'abc' } })).status, 400);
    assert.equal((await app.request('PUT', '/profile', { token, body: {} })).status, 400);
    assert.equal((await app.request('GET', '/profile')).status, 401);
    assert.equal((await app.request('PUT', '/profile', { body: { fullName: 'X' } })).status, 401);
  });

  test('creates a missing profile on first save, and 404s for deleted accounts', async () => {
    const { token, user } = await app.account();
    await app.prisma.userProfile.delete({ where: { email: user.email } });
    assert.equal((await app.request('GET', '/profile', { token })).body.user.name, user.email, 'falls back to email');
    assert.equal((await app.request('PUT', '/profile', { token, body: { phone: '7135550100' } })).body.user.name, user.email);
    assert.equal((await app.request('PUT', '/profile', { token, body: { fullName: 'Back Again' } })).body.user.name, 'Back Again');

    await app.prisma.userCredentials.delete({ where: { id: user.id } });
    assert.equal((await app.request('GET', '/profile', { token })).status, 404);
    assert.equal((await app.request('PUT', '/profile', { token, body: { fullName: 'Ghost' } })).status, 404);
  });

  test('the database enforces unique emails and removes the profile with its login', async () => {
    const { user } = await app.account();
    await assert.rejects(app.prisma.userCredentials.create({ data: { email: user.email, passwordHash: 'x' } }), { code: 'P2002' });
    await assert.rejects(app.prisma.userProfile.create({ data: { email: user.email, fullName: 'Dupe' } }), { code: 'P2002' });
    await assert.rejects(app.prisma.userProfile.create({ data: { email: 'nobody@school.edu', fullName: 'No login' } }), 'profile needs a login');

    await app.prisma.userCredentials.delete({ where: { id: user.id } });
    assert.equal(await app.prisma.userProfile.findUnique({ where: { email: user.email } }), null);
  });

  test('turning off alerts skips "almost ready" and "you\'re next" notices', async () => {
    const admin = await app.account('ADMIN');
    const serviceId = (await app.request('POST', '/services', { token: admin.token, body: sampleService() })).body.service.id;
    const quiet = await app.account();
    const loud = await app.account();
    await app.request('PUT', '/profile', { token: quiet.token, body: { almostReadyAlerts: false } });
    await app.request('POST', `/queues/${serviceId}/join`, { token: quiet.token });
    await app.request('POST', `/queues/${serviceId}/join`, { token: loud.token });

    const kinds = async (token) => (await app.request('GET', '/notifications', { token })).body.notifications.map((n) => n.kind);
    assert.deepEqual(await kinds(quiet.token), ['confirmed'], 'still gets the join confirmation');
    assert.ok((await kinds(loud.token)).includes('almost'));
  });
});
