import { describe, expect, it } from 'vitest';
import { businessDateTime, businessTimeToIso } from './time';

describe('business scheduling time', () => {
  it('stores a Manila wall time as UTC and renders it back', () => {
    const instant = businessTimeToIso('2026-10-23T09:30', 'Asia/Manila');
    expect(instant).toBe('2026-10-23T01:30:00.000Z');
    expect(businessDateTime(instant, 'Asia/Manila')).toBe('2026-10-23T09:30');
  });
  it('rejects a nonexistent local time during a daylight saving change', () => {
    expect(() => businessTimeToIso('2026-03-08T02:30', 'America/New_York')).toThrow(
      'does not exist',
    );
  });
});
