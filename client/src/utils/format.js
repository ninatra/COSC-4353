import { TINTS } from '../mockData.js';

// 3 -> "03"
export const pad = (n) => String(n).padStart(2, '0');

// Simulated clock: minutes since midnight -> "10:05 AM"
export function fmtTime(minutes) {
  const hour24 = Math.floor(minutes / 60) % 24;
  const hour = hour24 % 12 || 12;
  return `${hour}:${pad(minutes % 60)} ${hour24 >= 12 ? 'PM' : 'AM'}`;
}

// 1 -> "1 person", 3 -> "3 people"
export const people = (n) => `${n} ${n === 1 ? 'person' : 'people'}`;

// "Hao Pham" -> "HP"
export const initials = (name) =>
  name
    .split(/\s+/)
    .map((part) => part[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

// A stable tint for a person's avatar, based on their name.
export function hashTint(name) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

export const firstName = (name) => name.trim().split(/\s+/)[0] || 'there';
