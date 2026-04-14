import { describe, it, expect } from 'vitest';
import { clampYear, parseStoredView } from './storage';

describe('clampYear', () => {
  it('returns input when inside [min, max]', () => {
    expect(clampYear(2026, 2025, 2030)).toBe(2026);
  });

  it('clamps below min to min', () => {
    expect(clampYear(2020, 2025, 2030)).toBe(2025);
  });

  it('clamps above max to max', () => {
    expect(clampYear(2040, 2025, 2030)).toBe(2030);
  });

  it('returns min when value is NaN', () => {
    expect(clampYear(Number.NaN, 2025, 2030)).toBe(2025);
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
    expect(parseStoredView('{"year":2026,"scenarioId":"baseline"}')).toEqual({
      year: 2026,
      scenarioId: 'baseline',
    });
  });

  it('returns null when year is missing or wrong type', () => {
    expect(parseStoredView('{"scenarioId":"baseline"}')).toBeNull();
    expect(parseStoredView('{"year":"2026","scenarioId":"baseline"}')).toBeNull();
  });

  it('returns null when scenarioId is missing or wrong type', () => {
    expect(parseStoredView('{"year":2026}')).toBeNull();
    expect(parseStoredView('{"year":2026,"scenarioId":42}')).toBeNull();
  });

  it('rejects extra/unknown shape cleanly (forward-compat)', () => {
    // Future versions may add keys; unknown keys are fine as long as required keys are present.
    expect(parseStoredView('{"year":2026,"scenarioId":"baseline","extra":true}')).toEqual({
      year: 2026,
      scenarioId: 'baseline',
    });
  });
});
