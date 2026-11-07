import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { sampleService, startApp } from './helpers/app.js';
import { validateService, parseServiceId } from '../src/validation/service.js';

const service = {
  name: 'IT Help Desk', description: 'Device support',
  expectedDuration: 10, priority: 'LOW',
};

test('valid service data is trimmed without changing the input', () => {
  const input = { ...service, name: ' IT Help Desk ', description: ' Device support ', id: 99 };
  assert.deepEqual(validateService(input), { data: service });
  assert.equal(input.name, ' IT Help Desk ');
  assert.equal(input.description, ' Device support ');
});

test('service details must be an object', () => {
  for (const input of [undefined, null, [], 'text', 10, true]) {
    assert.equal(validateService(input).error, 'Service details must be an object');
  }
});

for (const field of ['name', 'description']) {
  test(`${field} must be present and contain nonblank text`, () => {
    for (const value of [undefined, null, '', '   ', 5, true, [], {}]) {
      assert.equal(validateService({ ...service, [field]: value }).error, `${field} is required and must be text`);
    }
    const input = { ...service };
    delete input[field];
    assert.ok(validateService(input).error);
  });
}

test('duration rejects missing, nonnumeric, fractional and out-of-range values', () => {
  for (const value of [undefined, null, '10', 0, -1, 1.5, NaN, Infinity, 2147483648]) {
    assert.equal(validateService({ ...service, expectedDuration: value }).error,
      'Expected duration must be a positive whole number of minutes');
  }
  for (const value of [1, 2147483647]) {
    assert.equal(validateService({ ...service, expectedDuration: value }).data.expectedDuration, value);
  }
});

test('only the three supported priorities are accepted', () => {
  for (const priority of ['LOW', 'MEDIUM', 'HIGH']) {
    assert.equal(validateService({ ...service, priority }).data.priority, priority);
  }
  for (const priority of [undefined, null, 'low', 'URGENT', 1]) {
    assert.equal(validateService({ ...service, priority }).error, 'Priority must be LOW, MEDIUM or HIGH');
  }
});

test('open/closed setting must be boolean and can be omitted', () => {
  assert.deepEqual(validateService(service), { data: service });
  for (const isOpen of [true, false]) {
    assert.deepEqual(validateService({ ...service, isOpen }), { data: { ...service, isOpen } });
  }
  for (const isOpen of [undefined, null, 'false', 0]) {
    assert.equal(validateService({ ...service, isOpen }).error, 'isOpen must be true or false');
  }
});

test('partial updates preserve omitted fields and validate supplied fields', () => {
  for (const data of [{ name: 'New name' }, { description: 'New description' },
    { expectedDuration: 20 }, { priority: 'HIGH' }, { isOpen: false }]) {
    assert.deepEqual(validateService(data, true), { data });
  }
  assert.deepEqual(validateService({ name: ' New name ' }, true), { data: { name: 'New name' } });
  assert.ok(validateService({ name: null }, true).error);
  assert.ok(validateService({ expectedDuration: 0 }, true).error);
  assert.ok(validateService({ priority: 'URGENT' }, true).error);
});

test('updates must contain at least one supported field', () => {
  for (const input of [{}, { id: 3 }, { unknown: 'value' }]) {
    assert.equal(validateService(input, true).error, 'Provide at least one service field to update');
  }
});

test('service IDs must be positive integer strings within the database range', () => {
  assert.equal(parseServiceId('3'), 3);
  assert.equal(parseServiceId('2147483647'), 2147483647);
  for (const value of ['abc', '', '0', '-1', '1.5', '1e2', ' 3 ', '2147483648', undefined, null, 3]) {
    assert.equal(parseServiceId(value), null);
  }
});

for (const [field, limit] of Object.entries({ location: 120, contact: 200, hours: 120, instructions: 500 })) {
  test(`${field} accepts trimmed text, supports clearing, and enforces its length limit`, () => {
    assert.equal(validateService({ ...service, [field]: ' Room 112 ' }).data[field], 'Room 112');
    assert.deepEqual(validateService({ [field]: '' }, true), { data: { [field]: null } });
    assert.deepEqual(validateService({ [field]: null }, true), { data: { [field]: null } });
    assert.deepEqual(validateService({ [field]: '   ' }, true), { data: { [field]: null } });
    assert.equal(validateService({ [field]: 'a'.repeat(limit) }, true).data[field].length, limit);
    for (const value of [undefined, 12, {}, [], 'a'.repeat(limit + 1)]) {
      assert.ok(validateService({ [field]: value }, true).error);
    }
  });
}

test('category accepts supported categories and rejects invalid ones', () => {
  for (const category of ['Academic', 'Financial', 'Technology', 'Student support', 'Other']) {
    assert.deepEqual(validateService({ category }, true), { data: { category } });
  }
  for (const category of ['', 'Unknown', null, 5]) {
    assert.ok(validateService({ category }, true).error);
  }
});

test('capacity accepts positive integers or null and rejects invalid limits', () => {
  for (const maxCapacity of [1, 12, 2147483647, null]) {
    assert.equal(validateService({ ...service, maxCapacity }).data.maxCapacity, maxCapacity);
    assert.deepEqual(validateService({ maxCapacity }, true), { data: { maxCapacity } });
  }
  for (const maxCapacity of [undefined, 0, -1, 1.5, '12', true, 2147483648]) {
    assert.ok(validateService({ maxCapacity }, true).error);
  }
});

describe('services API', () => {
  let app;
  let admin;
  let alice;
  before(async () => {
    app = await startApp('services');
    admin = await app.account('ADMIN');
    alice = await app.account('USER', 'Alice');
  });
  after(() => app.close());
  const create = async overrides => app.request('POST', '/services', { token: admin.token, body: sampleService(overrides) });

  test('admins create, update, list and delete services', async () => {
    const created = await create({ name: '  Library Desk ', location: 'Room 1', maxCapacity: 5 });
    assert.equal(created.status, 201);
    assert.equal(created.body.service.name, 'Library Desk');
    const { id } = created.body.service;

    const updated = await app.request('PUT', `/services/${id}`, { token: admin.token, body: { isOpen: false, expectedDuration: 12 } });
    assert.equal(updated.body.service.isOpen, false);
    assert.equal(updated.body.service.expectedDuration, 12);

    const list = await app.request('GET', '/services', { token: alice.token });
    assert.ok(list.body.services.some((s) => s.id === id));

    assert.equal((await app.request('DELETE', `/services/${id}`, { token: admin.token })).status, 200);
    assert.equal((await app.request('DELETE', `/services/${id}`, { token: admin.token })).status, 404);
  });

  test('optional service details default to null and can be cleared and retrieved', async () => {
    const fields = ['location', 'hours', 'contact', 'instructions'];
    const created = await create();
    assert.equal(created.status, 201);
    const id = created.body.service.id;
    for (const field of fields) assert.equal(created.body.service[field], null);
    await app.request('PUT', `/services/${id}`, { token: admin.token, body: Object.fromEntries(fields.map(field => [field, 'Saved text'])) });
    const cleared = await app.request('PUT', `/services/${id}`, { token: admin.token, body: { location: null, hours: '', contact: null, instructions: '   ' } });
    assert.equal(cleared.status, 200);
    const fetched = (await app.request('GET', '/services', { token: alice.token })).body.services.find(row => row.id === id);
    const stored = await app.prisma.service.findUnique({ where: { id } });
    for (const field of fields) {
      assert.equal(fetched[field], null);
      assert.equal(stored[field], null);
    }
  });

  test('rejects missing, wrongly typed and too-long fields', async () => {
    assert.equal((await create({ name: '' })).status, 400);
    assert.equal((await create({ name: 'x'.repeat(101) })).status, 400);
    assert.equal((await create({ description: 'x'.repeat(501) })).status, 400);
    assert.equal((await create({ expectedDuration: '10' })).status, 400);
    assert.equal((await create({ priority: 'URGENT' })).status, 400);
    assert.equal((await app.request('POST', '/services', { token: admin.token, body: [] })).status, 400);
    assert.equal((await app.request('PUT', '/services/abc', { token: admin.token, body: { isOpen: true } })).status, 400);
    assert.equal((await app.request('PUT', '/services/99999', { token: admin.token, body: { isOpen: true } })).status, 404);
    assert.equal((await app.request('PUT', '/services/1', { token: admin.token, body: { isOpen: 'yes' } })).status, 400);
    assert.equal((await app.request('DELETE', '/services/abc', { token: admin.token })).status, 400);
  });

  test('only administrators can change services', async () => {
    assert.equal((await app.request('POST', '/services', { token: alice.token, body: sampleService() })).status, 403);
    assert.equal((await app.request('GET', '/services')).status, 401);
  });

  test("a service with visit history can't be deleted", async () => {
    const { id } = (await create()).body.service;
    await app.request('POST', `/queues/${id}/join`, { token: alice.token });
    await app.request('POST', `/queues/${id}/leave`, { token: alice.token });
    assert.equal((await app.request('DELETE', `/services/${id}`, { token: admin.token })).status, 409);
  });
});
