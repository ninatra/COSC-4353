import { ROLES } from '../constants.js';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const LIMITS = { name: 50, email: 254, passwordMin: 8, passwordMax: 72 };

const isText = (value) => typeof value === 'string' && value.trim() !== '';

// Returns { data } with cleaned values, or { status, error }.
export function validateRegistration(body, adminCode) {
  const { name, email, password, role = 'USER', adminCode: givenCode } = body ?? {};
  if (!isText(name) || !isText(email) || !isText(password)) {
    return { status: 400, error: 'Name, email and password are required and must be text' };
  }
  if (name.trim().length > LIMITS.name) {
    return { status: 400, error: `Name must be at most ${LIMITS.name} characters` };
  }
  if (email.trim().length > LIMITS.email || !EMAIL_RE.test(email.trim())) {
    return { status: 400, error: 'Email address is not valid' };
  }
  if (password.length < LIMITS.passwordMin) {
    return { status: 400, error: `Password must be at least ${LIMITS.passwordMin} characters` };
  }
  if (password.length > LIMITS.passwordMax) {
    return { status: 400, error: `Password must be at most ${LIMITS.passwordMax} characters` };
  }
  if (!ROLES.includes(role)) {
    return { status: 400, error: 'Role must be USER or ADMIN' };
  }
  if (role === 'ADMIN' && (!adminCode || givenCode !== adminCode)) {
    return { status: 403, error: 'Invalid administrator code' };
  }
  return { data: { name: name.trim(), email: email.trim().toLowerCase(), password, role } };
}

export function validateLogin(body) {
  const { email, password } = body ?? {};
  if (!isText(email) || !isText(password)) {
    return { status: 400, error: 'Email and password are required and must be text' };
  }
  if (email.trim().length > LIMITS.email || password.length > LIMITS.passwordMax) {
    return { status: 400, error: 'Email or password is too long' };
  }
  return { data: { email: email.trim().toLowerCase(), password } };
}
