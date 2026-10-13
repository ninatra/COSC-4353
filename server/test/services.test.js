import assert from 'node:assert/strict';
import test from 'node:test';
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
    assert.deepEqual(validateService({ [field]: '' }, true), { data: { [field]: '' } });
    assert.equal(validateService({ [field]: 'a'.repeat(limit) }, true).data[field].length, limit);
    for (const value of [null, undefined, 12, {}, [], 'a'.repeat(limit + 1)]) {
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
