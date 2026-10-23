import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertCampaignDates } from '../src/modules/content/routes.ts';

test('campaign dates allow open ranges and reject an end before the start', () => {
  assert.doesNotThrow(() => assertCampaignDates(null, new Date('2026-10-23T00:00:00Z')));
  assert.doesNotThrow(() =>
    assertCampaignDates(new Date('2026-10-23T00:00:00Z'), new Date('2026-10-23T00:00:00Z')),
  );
  assert.throws(
    () => assertCampaignDates(new Date('2026-10-24T00:00:00Z'), new Date('2026-10-23T00:00:00Z')),
    { code: 'INVALID_DATES' },
  );
});
