// Starts the API on a random port with its own empty test database, so route
// tests never touch the demo data in dev.db.
import { execSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const serverDir = fileURLToPath(new URL('../..', import.meta.url));

export async function startApp(name) {
  Object.assign(process.env, {
    DATABASE_URL: `file:./test-${name}.db`,
    JWT_SECRET: 'test-secret',
    ADMIN_SIGNUP_CODE: 'test-admin-code',
    CLIENT_URL: 'http://localhost:5173',
  });
  // Start from a fresh file each run (it lives next to the schema and is git-ignored).
  for (const suffix of ['', '-journal']) rmSync(`${serverDir}prisma/test-${name}.db${suffix}`, { force: true });
  // Ensure SQLite has a file before Prisma applies the schema.
  writeFileSync(`${serverDir}prisma/test-${name}.db`, '');
  execSync('npx prisma db push --skip-generate', { cwd: serverDir, env: process.env, stdio: 'ignore' });

  // Hide the "verification link" lines that registration prints.
  const log = console.log;
  console.log = (...args) => (String(args[0]).startsWith('[email]') ? undefined : log(...args));

  const { app } = await import('../../src/app.js');
  const { prisma } = await import('../../src/db.js');
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;

  async function request(method, path, { token, body, raw } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(base + path, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }

  let count = 0;
  // Registers a new account through the API and returns { token, user }.
  async function account(role = 'USER', name = `Test ${role} ${++count}`) {
    const res = await request('POST', '/auth/register', { body: {
      name, email: `${role.toLowerCase()}${count}-${Date.now()}@test.dev`, password: 'password123',
      role, ...(role === 'ADMIN' ? { adminCode: 'test-admin-code' } : {}),
    } });
    if (res.status !== 201) throw new Error(`Could not register test account: ${res.body.error}`);
    return res.body;
  }

  async function close() {
    console.log = log;
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }

  return { request, account, prisma, close };
}

export const sampleService = (overrides = {}) => ({
  name: 'Test Desk', description: 'Help for tests', expectedDuration: 10, priority: 'MEDIUM', ...overrides,
});
