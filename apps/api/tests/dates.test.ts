import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zonedDayStart } from '../src/common/dates.ts';

test('calendar day boundaries follow business timezone', () => {
  assert.equal(
    zonedDayStart('2026-10-23', 'Asia/Manila').toISOString(),
    '2026-10-22T16:00:00.000Z',
  );
  assert.equal(zonedDayStart('2026-10-23', 'UTC').toISOString(), '2026-10-23T00:00:00.000Z');
});
