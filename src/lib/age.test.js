import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgeDays, isStale } from './age.js';

test('build age counts whole UTC days and becomes stale at 60 days', () => {
  const built = '2026-01-01';
  assert.equal(buildAgeDays(built, new Date('2026-01-01T23:59:00Z')), 0);
  assert.equal(isStale(built, new Date('2026-03-01T23:59:00Z')), false); // 59 days
  assert.equal(isStale(built, new Date('2026-03-02T00:00:00Z')), true); // 60 days
  assert.equal(buildAgeDays(built, new Date('2025-12-01T00:00:00Z')), 0, 'clock skew never yields a negative age');
});

test('invalid build dates never trigger the notice', () => {
  for (const value of ['', 'unknown', '2026-13-45', undefined]) assert.equal(isStale(value, new Date('2030-01-01')), false);
});
