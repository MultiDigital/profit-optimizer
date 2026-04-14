import { describe, it, expect } from 'vitest';
import { isMemberActiveAtDate } from './resolve';
import { resolveFieldAtDate, AnyResolverEvent } from './resolve';

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

function canonicalEvent(partial: Partial<AnyResolverEvent>): AnyResolverEvent {
  return {
    id: partial.id ?? 'evt-' + Math.random(),
    field: 'salary',
    value: '0',
    start_date: '2024-01-01',
    end_date: null,
    priority: 'canonical',
    ...partial,
  } as AnyResolverEvent;
}

function scenarioEvent(partial: Partial<AnyResolverEvent>): AnyResolverEvent {
  return canonicalEvent({ ...partial, priority: 'scenario' });
}

describe('resolveFieldAtDate', () => {
  it('returns undefined when no events match the field', () => {
    const events: AnyResolverEvent[] = [
      canonicalEvent({ field: 'ft_percentage', value: '80' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBeUndefined();
  });

  it('returns undefined when event has not started yet', () => {
    const events = [
      canonicalEvent({ field: 'salary', value: '50000', start_date: '2027-01-01' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBeUndefined();
  });

  it('returns undefined when event has already ended before date', () => {
    const events = [
      canonicalEvent({
        field: 'salary',
        value: '45000',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2025-06-01')).toBeUndefined();
  });

  it('returns value when date is exactly start_date (inclusive)', () => {
    const events = [
      canonicalEvent({ field: 'salary', value: '45000', start_date: '2026-06-01' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBe('45000');
  });

  it('returns value when date is exactly end_date (inclusive)', () => {
    const events = [
      canonicalEvent({
        field: 'salary',
        value: '45000',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2024-12-31')).toBe('45000');
  });

  it('returns the most recent event among multiple active ones', () => {
    const events = [
      canonicalEvent({ field: 'salary', value: '45000', start_date: '2024-01-01' }),
      canonicalEvent({ field: 'salary', value: '48000', start_date: '2025-01-01' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBe('48000');
  });

  it('scenario event wins over canonical event with same start_date', () => {
    const events = [
      canonicalEvent({ field: 'salary', value: '45000', start_date: '2025-01-01' }),
      scenarioEvent({ field: 'salary', value: '60000', start_date: '2025-01-01' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBe('60000');
  });

  it('canonical event with later start_date still wins over earlier scenario event', () => {
    const events = [
      scenarioEvent({ field: 'salary', value: '60000', start_date: '2025-01-01' }),
      canonicalEvent({ field: 'salary', value: '48000', start_date: '2025-07-01' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBe('48000');
  });
});
