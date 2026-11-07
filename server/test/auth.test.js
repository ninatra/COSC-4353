import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { LIMITS, validateLogin, validateRegistration } from '../src/validation/auth.js';
import { startApp } from './helpers/app.js';

const valid = { name: 'Hao Pham', email: 'Hao@School.edu', password: 'password123' };

describe('registration validation', () => {
  test('accepts a valid user and cleans the values', () => {
    assert.deepEqual(validateRegistration({ ...valid, name: '  Hao Pham ' }).data,
      { name: 'Hao Pham', email: 'hao@school.edu', password: 'password123', role: 'USER' });
  });
  test('requires name, email and password as non-empty text', () => {
    for (const field of ['name', 'email', 'password']) {
      assert.equal(validateRegistration({ ...valid, [field]: undefined }).status, 400);
      assert.equal(validateRegistration({ ...valid, [field]: '   ' }).status, 400);
      assert.equal(validateRegistration({ ...valid, [field]: 42 }).status, 400);
    }
    assert.equal(validateRegistration(null).status, 400);
  });
  test('enforces length limits', () => {
    assert.match(validateRegistration({ ...valid, name: 'x'.repeat(LIMITS.name + 1) }).error, /at most 50/);
    assert.equal(validateRegistration({ ...valid, name: 'x'.repeat(LIMITS.name) }).error, undefined);
    assert.match(validateRegistration({ ...valid, password: 'short' }).error, /at least 8/);
    assert.match(validateRegistration({ ...valid, password: 'x'.repeat(LIMITS.passwordMax + 1) }).error, /at most 72/);
    assert.equal(validateRegistration({ ...valid, email: `${'a'.repeat(250)}@x.edu` }).status, 400);
  });
  test('rejects badly formed emails', () => {
    for (const email of ['plain', 'a@b', 'a@b.c', 'a b@c.edu', '@school.edu']) {
      assert.equal(validateRegistration({ ...valid, email }).error, 'Email address is not valid', email);
    }
  });
  test('only allows known roles, and admins need the right code', () => {
    assert.equal(validateRegistration({ ...valid, role: 'OWNER' }).status, 400);
    assert.equal(validateRegistration({ ...valid, role: 'ADMIN' }, 'secret').status, 403);
    assert.equal(validateRegistration({ ...valid, role: 'ADMIN', adminCode: 'wrong' }, 'secret').status, 403);
    assert.equal(validateRegistration({ ...valid, role: 'ADMIN', adminCode: 'secret' }, undefined).status, 403);
    assert.equal(validateRegistration({ ...valid, role: 'ADMIN', adminCode: 'secret' }, 'secret').data.role, 'ADMIN');
  });
});

describe('login validation', () => {
  test('requires both fields as text and normalizes the email', () => {
    assert.deepEqual(validateLogin({ email: ' A@B.edu ', password: 'x' }).data, { email: 'a@b.edu', password: 'x' });
    assert.equal(validateLogin({ email: 'a@b.edu' }).status, 400);
    assert.equal(validateLogin({ email: 5, password: 'x' }).status, 400);
    assert.equal(validateLogin(undefined).status, 400);
    assert.equal(validateLogin({ email: 'a@b.edu', password: 'x'.repeat(73) }).status, 400);
  });
});

describe('auth API', () => {
  let app;
  before(async () => { app = await startApp('auth'); });
  after(() => app.close());

  test('registers, then logs in with the same password', async () => {
    const reg = await app.request('POST', '/auth/register', { body: { ...valid, email: 'new@school.edu' } });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.user.role, 'USER');
    assert.ok(reg.body.token);
    assert.equal(reg.body.user.passwordHash, undefined, 'never returns the password hash');
    assert.equal(reg.body.user.name, 'Hao Pham');

    // Login data and profile are separate tables; the password is stored hashed.
    const stored = await app.prisma.userCredentials.findUnique({ where: { email: 'new@school.edu' }, include: { profile: true } });
    assert.notEqual(stored.passwordHash, 'password123');
    assert.match(stored.passwordHash, /^\$2[aby]\$10\$/);
    assert.equal(stored.profile.fullName, 'Hao Pham');
    assert.equal(stored.profile.almostReadyAlerts, true);

    const login = await app.request('POST', '/auth/login', { body: { email: 'NEW@school.edu', password: 'password123' } });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.email, 'new@school.edu');
  });

  test('rejects invalid input, duplicates and wrong passwords', async () => {
    assert.equal((await app.request('POST', '/auth/register', { body: { ...valid, password: 'short' } })).status, 400);
    assert.equal((await app.request('POST', '/auth/register', { body: { ...valid, role: 'ADMIN' } })).status, 403);
    await app.request('POST', '/auth/register', { body: { ...valid, email: 'dupe@school.edu' } });
    assert.equal((await app.request('POST', '/auth/register', { body: { ...valid, email: 'dupe@school.edu' } })).status, 409);
    assert.equal((await app.request('POST', '/auth/login', { body: { email: 'dupe@school.edu', password: 'wrongpass1' } })).status, 401);
    assert.equal((await app.request('POST', '/auth/login', { body: { email: 'nobody@school.edu', password: 'password123' } })).status, 401);
    assert.equal((await app.request('POST', '/auth/login', { body: {} })).status, 400);
  });

  test('administrators can register with the code', async () => {
    const res = await app.request('POST', '/auth/register', { body: { ...valid, email: 'boss@school.edu', role: 'ADMIN', adminCode: 'test-admin-code' } });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'ADMIN');
  });

  test('/me needs a valid token', async () => {
    const { token } = await app.account();
    assert.equal((await app.request('GET', '/auth/me', { token })).status, 200);
    assert.equal((await app.request('GET', '/auth/me')).status, 401);
    assert.equal((await app.request('GET', '/auth/me', { token: 'not-a-token' })).status, 401);
  });

  test('/me returns 404 when the account no longer exists', async () => {
    const { token, user } = await app.account();
    await app.prisma.userCredentials.delete({ where: { id: user.id } });
    assert.equal((await app.request('GET', '/auth/me', { token })).status, 404);
  });

  test('email verification links work once', async () => {
    const { user } = await app.account();
    const { verificationToken } = await app.prisma.userCredentials.findUnique({ where: { id: user.id } });
    assert.equal((await app.request('GET', `/auth/verify/${verificationToken}`)).status, 200);
    assert.equal((await app.request('GET', `/auth/verify/${verificationToken}`)).status, 400);
  });

  test('unknown API paths return 404 JSON', async () => {
    const res = await app.request('GET', '/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Not found');
    assert.equal((await app.request('GET', '/health')).body.status, 'ok');
  });

  test('backend rejects malformed bodies and passwords beyond bcrypt byte limits', () => {
    for (const body of [null, [], 'text', 12]) {
      assert.equal(validateRegistration(body).status, 400);
      assert.equal(validateLogin(body).status, 400);
    }
    const details = { name: 'Valid Name', email: 'valid@test.dev', password: 'é'.repeat(37) };
    assert.match(validateRegistration(details).error, /72 bytes/);
    assert.equal(validateLogin(details).status, 400);
  });

  test('concurrent duplicate registrations return a conflict without creating partial accounts', async () => {
    const body = { name: 'Concurrent User', email: 'concurrent@test.dev', password: 'password123' };
    const responses = await Promise.all([
      app.request('POST', '/auth/register', { body }),
      app.request('POST', '/auth/register', { body }),
    ]);
    assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
    assert.equal(await app.prisma.userCredentials.count({ where: { email: body.email } }), 1);
    assert.equal(await app.prisma.userProfile.count({ where: { email: body.email } }), 1);
  });

  test('broken JSON is a 400 with a clear message', async () => {
    const res = await app.request('POST', '/auth/login', { raw: '{bad json' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /valid JSON/);
  });
});
