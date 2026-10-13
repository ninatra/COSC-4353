import { PRIORITIES } from '../constants.js';

export function validateService(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Service details must be an object' };
  }
  const data = {};
  for (const field of ['name', 'description', 'expectedDuration', 'priority']) {
    if (partial && !Object.hasOwn(body, field)) continue;
    const value = body[field];
    if (field === 'name' || field === 'description') {
      if (typeof value !== 'string' || !value.trim()) {
        return { error: `${field} is required and must be text` };
      }
      data[field] = value.trim();
    } else if (field === 'expectedDuration') {
      if (!Number.isInteger(value) || value <= 0 || value > 2147483647) {
        return { error: 'Expected duration must be a positive whole number of minutes' };
      }
      data[field] = value;
    } else {
      if (!PRIORITIES.includes(value)) {
        return { error: 'Priority must be LOW, MEDIUM or HIGH' };
      }
      data[field] = value;
    }
  }
  const textLimits = { location: 120, contact: 200, hours: 120, instructions: 500 };
  for (const [field, limit] of Object.entries(textLimits)) {
    if (!Object.hasOwn(body, field)) continue;
    if (typeof body[field] !== 'string' || body[field].trim().length > limit) {
      return { error: `${field} must be text with at most ${limit} characters` };
    }
    data[field] = body[field].trim();
  }
  if (Object.hasOwn(body, 'category')) {
    if (!['Academic', 'Financial', 'Technology', 'Student support', 'Other'].includes(body.category)) {
      return { error: 'Choose a valid service category' };
    }
    data.category = body.category;
  }
  if (Object.hasOwn(body, 'maxCapacity')) {
    const value = body.maxCapacity;
    if (value !== null && (!Number.isInteger(value) || value <= 0 || value > 2147483647)) {
      return { error: 'Maximum capacity must be a positive whole number or null for no limit' };
    }
    data.maxCapacity = value;
  }
  if (Object.hasOwn(body, 'isOpen')) {
    if (typeof body.isOpen !== 'boolean') {
      return { error: 'isOpen must be true or false' };
    }
    data.isOpen = body.isOpen;
  }
  if (!Object.keys(data).length) return { error: 'Provide at least one service field to update' };
  return { data };
}

export function parseServiceId(value) {
  const id = Number(value);
  return typeof value === 'string' && /^\d+$/.test(value) && Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}
