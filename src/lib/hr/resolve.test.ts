import { describe, it, expect } from 'vitest';
import { isMemberActiveAtDate } from './resolve';

describe('isMemberActiveAtDate', () => {
  it('returns true when date is after contract_start and end is null', () => {
    expect(isMemberActiveAtDate('2024-01-15', null, '2026-06-01')).toBe(true);
  });

  it('returns true when date equals contract_start', () => {
    expect(isMemberActiveAtDate('2024-01-15', null, '2024-01-15')).toBe(true);
  });

  it('returns true when date equals contract_end', () => {
    expect(isMemberActiveAtDate('2024-01-15', '2026-12-31', '2026-12-31')).toBe(true);
  });

  it('returns false when date is before contract_start', () => {
    expect(isMemberActiveAtDate('2024-01-15', null, '2023-12-31')).toBe(false);
  });

  it('returns false when date is after contract_end', () => {
    expect(isMemberActiveAtDate('2024-01-15', '2026-12-31', '2027-01-01')).toBe(false);
  });

  it('returns true when contract_start is null (no start set)', () => {
    expect(isMemberActiveAtDate(null, null, '2000-01-01')).toBe(true);
  });

  it('returns true when both contract dates are null', () => {
    expect(isMemberActiveAtDate(null, null, '2026-06-01')).toBe(true);
  });
});
