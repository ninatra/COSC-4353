import { EMAIL_RE, LIMITS } from './auth.js';

export const PHONE_MAX = 20;
// Digits with optional spaces, dashes, dots, parentheses and a leading +.
const PHONE_RE = /^\+?[0-9 ().-]{7,20}$/;

// Partial update of the signed-in user's profile. Returns { data } or { error }.
export function validateProfile(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Profile details must be an object' };
  }
  const data = {};
  if (Object.hasOwn(body, 'email')) {
    if (typeof body.email !== 'string' || body.email.trim().length > LIMITS.email || !EMAIL_RE.test(body.email.trim())) {
      return { error: 'Email address is not valid' };
    }
    data.email = body.email.trim().toLowerCase();
  }
  if (Object.hasOwn(body, 'fullName')) {
    if (typeof body.fullName !== 'string' || !body.fullName.trim()) {
      return { error: 'Full name is required and must be text' };
    }
    if (body.fullName.trim().length > LIMITS.name) {
      return { error: `Full name must be at most ${LIMITS.name} characters` };
    }
    data.fullName = body.fullName.trim();
  }
  if (Object.hasOwn(body, 'phone')) {
    const phone = body.phone;
    if (phone === null || (typeof phone === 'string' && !phone.trim())) {
      data.phone = null;
    } else if (typeof phone !== 'string' || phone.trim().length > PHONE_MAX || !PHONE_RE.test(phone.trim())) {
      return { error: 'Phone number must be 7–20 digits (spaces, dashes and + are allowed)' };
    } else {
      data.phone = phone.trim();
    }
  }
  if (Object.hasOwn(body, 'almostReadyAlerts')) {
    if (typeof body.almostReadyAlerts !== 'boolean') {
      return { error: 'almostReadyAlerts must be true or false' };
    }
    data.almostReadyAlerts = body.almostReadyAlerts;
  }
  if (!Object.keys(data).length) return { error: 'Provide at least one profile field to update' };
  return { data };
}
