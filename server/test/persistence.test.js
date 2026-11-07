import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import { sampleService, startApp } from './helpers/app.js';

// Each launch is a new Node process and Prisma connection to the same test file.
async function launchApi() {
  const script = `
    import { app } from ${JSON.stringify(new URL('../src/app.js', import.meta.url).href)};
    import { prisma } from ${JSON.stringify(new URL('../src/db.js', import.meta.url).href)};
    const server = app.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
    process.on('SIGTERM', () => server.close(async () => { await prisma.$disconnect(); process.exit(0); }));
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  let stderr = '';
  child.stderr.on('data', data => { stderr += data; });
  const port = await new Promise((resolve, reject) => {
    child.once('message', message => resolve(message.port));
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`API exited before listening (${code}): ${stderr}`)));
  });
  return {
    async request(method, path, { token, body } = {}) {
      const response = await fetch(`http://127.0.0.1:${port}/api${path}`, {
        method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json();
      assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
      return data;
    },
    async close() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const stopped = once(child, 'exit');
      child.kill('SIGTERM');
      await stopped;
    },
  };
}

test('form submissions persist in SQLite and remain retrievable after API process restarts', { timeout: 30000 }, async () => {
  const setup = await startApp('persistence');
  await setup.close();
  let api = await launchApi();
  try {
    const admin = await api.request('POST', '/auth/register', { body: {
      name: 'Persistence Admin', email: 'persist-admin@test.dev', password: 'password123', role: 'ADMIN', adminCode: 'test-admin-code',
    } });
    const user = await api.request('POST', '/auth/register', { body: {
      name: 'Initial Name', email: 'persist-user@test.dev', password: 'password123',
    } });
    await api.request('PUT', '/profile', { token: user.token, body: {
      fullName: 'Saved Name', email: 'updated-user@test.dev', phone: '7135550100', almostReadyAlerts: false,
    } });
    const { service } = await api.request('POST', '/services', { token: admin.token, body: sampleService({ name: 'Persistent Desk' }) });
    await api.request('PUT', `/services/${service.id}`, { token: admin.token, body: { location: 'Saved Room', expectedDuration: 25 } });
    const { entry } = await api.request('POST', `/queues/${service.id}/join`, { token: user.token });
    const notification = (await api.request('GET', '/notifications', { token: user.token })).notifications.find(row => row.kind === 'confirmed');
    assert.ok(notification);
    await api.request('PATCH', `/notifications/${notification.id}/read`, { token: user.token });

    await api.close();
    api = await launchApi();
    const login = await api.request('POST', '/auth/login', { body: { email: 'updated-user@test.dev', password: 'password123' } });
    assert.equal(login.user.name, 'Saved Name');
    const profile = (await api.request('GET', '/profile', { token: user.token })).user;
    assert.equal(profile.email, 'updated-user@test.dev');
    assert.equal(profile.phone, '7135550100');
    assert.equal(profile.almostReadyAlerts, false);
    const savedService = (await api.request('GET', '/services', { token: user.token })).services.find(row => row.id === service.id);
    assert.equal(savedService.location, 'Saved Room');
    assert.equal(savedService.expectedDuration, 25);
    const ticket = (await api.request('GET', '/queues/me', { token: user.token })).ticket;
    assert.equal(ticket.id, entry.id);
    assert.equal(ticket.position, 1);
    assert.equal((await api.request('GET', '/notifications', { token: user.token })).notifications.find(row => row.id === notification.id).status, 'VIEWED');

    await api.request('POST', `/queues/${service.id}/serve-next`, { token: admin.token, body: { outcome: 'completed', problem: 'Saved issue', notes: 'Initial notes' } });
    await api.request('PUT', `/history/${entry.id}`, { token: admin.token, body: { outcome: 'follow-up', problem: 'Saved issue', notes: 'Saved history notes' } });
    await api.request('PUT', `/services/${service.id}`, { token: admin.token, body: { isOpen: false } });
    await api.request('DELETE', '/notifications', { token: user.token });

    await api.close();
    api = await launchApi();
    const history = (await api.request('GET', '/history', { token: user.token })).history;
    assert.equal(history.length, 1);
    assert.equal(history[0].id, entry.id);
    assert.equal(history[0].outcome, 'follow-up');
    assert.equal(history[0].notes, 'Saved history notes');
    assert.equal(history[0].problem, 'Saved issue');
    assert.equal((await api.request('GET', '/queues/me', { token: user.token })).ticket, null);
    assert.equal((await api.request('GET', '/services', { token: user.token })).services.find(row => row.id === service.id).isOpen, false);
    assert.deepEqual((await api.request('GET', '/notifications', { token: user.token })).notifications, []);
  } finally {
    await api.close();
  }
});
