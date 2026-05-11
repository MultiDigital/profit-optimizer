import { describe, it, expect } from 'vitest';
import { clampAsOfDate, parseStoredView } from './storage';

describe('clampAsOfDate', () => {
  it('returns input when inside [min, max]', () => {
    expect(clampAsOfDate('2026-04-21', '2025-01-01', '2030-12-31')).toBe('2026-04-21');
  });

  it('clamps below min to min', () => {
    expect(clampAsOfDate('2020-05-01', '2025-01-01', '2030-12-31')).toBe('2025-01-01');
  });

  it('clamps above max to max', () => {
    expect(clampAsOfDate('2040-07-15', '2025-01-01', '2030-12-31')).toBe('2030-12-31');
  });

  it('returns min when value is malformed', () => {
    expect(clampAsOfDate('not a date', '2025-01-01', '2030-12-31')).toBe('2025-01-01');
    expect(clampAsOfDate('2026-13-01', '2025-01-01', '2030-12-31')).toBe('2025-01-01');
    expect(clampAsOfDate('2026-02-30', '2025-01-01', '2030-12-31')).toBe('2025-01-01');
    expect(clampAsOfDate('', '2025-01-01', '2030-12-31')).toBe('2025-01-01');
  });

  it('accepts boundary values', () => {
    expect(clampAsOfDate('2025-01-01', '2025-01-01', '2030-12-31')).toBe('2025-01-01');
    expect(clampAsOfDate('2030-12-31', '2025-01-01', '2030-12-31')).toBe('2030-12-31');
  });
});

describe('parseStoredView', () => {
  it('returns null for null input', () => {
    expect(parseStoredView(null)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseStoredView('not json')).toBeNull();
  });

  it('parses a valid payload', () => {
    expect(
      parseStoredView('{"asOfDate":"2026-04-21","scenarioId":"baseline"}'),
    ).toEqual({
      asOfDate: '2026-04-21',
      scenarioId: 'baseline',
    });
  });

  it('returns null when asOfDate is missing or wrong type', () => {
    expect(parseStoredView('{"scenarioId":"baseline"}')).toBeNull();
    expect(parseStoredView('{"asOfDate":2026,"scenarioId":"baseline"}')).toBeNull();
  });

  it('returns null when asOfDate is malformed', () => {
    expect(
      parseStoredView('{"asOfDate":"2026/04/21","scenarioId":"baseline"}'),
    ).toBeNull();
    expect(
      parseStoredView('{"asOfDate":"21-04-2026","scenarioId":"baseline"}'),
    ).toBeNull();
    expect(
      parseStoredView('{"asOfDate":"2026-02-30","scenarioId":"baseline"}'),
    ).toBeNull();
  });

  it('returns null when scenarioId is missing or wrong type', () => {
    expect(parseStoredView('{"asOfDate":"2026-04-21"}')).toBeNull();
    expect(
      parseStoredView('{"asOfDate":"2026-04-21","scenarioId":42}'),
    ).toBeNull();
  });

  it('rejects stale v1 payload (year-based)', () => {
    expect(parseStoredView('{"year":2026,"scenarioId":"baseline"}')).toBeNull();
  });

  it('accepts extra/unknown keys cleanly (forward-compat)', () => {
    expect(
      parseStoredView(
        '{"asOfDate":"2026-04-21","scenarioId":"baseline","extra":true}',
      ),
    ).toEqual({
      asOfDate: '2026-04-21',
      scenarioId: 'baseline',
    });
  });
});
