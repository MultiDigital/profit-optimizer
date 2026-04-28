import { describe, it, expect } from 'vitest';
import { computeMemberAnnualCost } from './compute';
import { Member, MemberEvent } from '@/lib/optimizer/types';

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm-1',
    user_id: 'u-1',
    first_name: 'Mario',
    last_name: 'Rossi',
    category: 'dipendente',
    seniority: 'middle',
    salary: 12000,
    chargeable_days: null,
    ft_percentage: 100,
    contract_start_date: '2024-01-01',
    contract_end_date: null,
    ...overrides,
  };
}

let _nextEventId = 0;
function makeSalaryEvent(partial: Partial<MemberEvent>): MemberEvent {
  return {
    id: partial.id ?? `me-${_nextEventId++}`,
    user_id: 'u-1',
    member_id: 'm-1',
    field: 'salary',
    value: '0',
    start_date: '2026-01-01',
    end_date: null,
    note: null,
    created_at: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('computeMemberAnnualCost', () => {
  it('returns the full annual salary for a member employed all year with no events', () => {
    const member = makeMember({ salary: 12000, contract_start_date: '2020-01-01' });
    const cost = computeMemberAnnualCost(member, [], null, 2026);
    expect(cost).toBeCloseTo(12000, 2);
  });

  it('prorates a late start (March 1) to 10/12 of salary', () => {
    const member = makeMember({ salary: 12000, contract_start_date: '2026-03-01' });
    const cost = computeMemberAnnualCost(member, [], null, 2026);
    expect(cost).toBeCloseTo(10000, 2);
  });

  it('prorates an early end (August 31) to 8/12 of salary', () => {
    const member = makeMember({
      salary: 12000,
      contract_start_date: '2020-01-01',
      contract_end_date: '2026-08-31',
    });
    const cost = computeMemberAnnualCost(member, [], null, 2026);
    expect(cost).toBeCloseTo(8000, 2);
  });

  it('reflects a mid-year salary raise from the event start month', () => {
    const member = makeMember({ salary: 12000, contract_start_date: '2020-01-01' });
    const raise = makeSalaryEvent({
      field: 'salary',
      value: '24000',
      start_date: '2026-07-01',
    });
    const cost = computeMemberAnnualCost(member, [raise], null, 2026);
    expect(cost).toBeCloseTo(18000, 2);
  });

  it('returns 0 when the contract ends before the requested year', () => {
    const member = makeMember({
      salary: 12000,
      contract_start_date: '2020-01-01',
      contract_end_date: '2025-12-31',
    });
    const cost = computeMemberAnnualCost(member, [], null, 2026);
    expect(cost).toBe(0);
  });

  it('returns 0 when the contract starts after the requested year', () => {
    const member = makeMember({
      salary: 12000,
      contract_start_date: '2027-01-01',
    });
    const cost = computeMemberAnnualCost(member, [], null, 2026);
    expect(cost).toBe(0);
  });

  it('computes a non-zero cost for freelance category', () => {
    const member = makeMember({
      category: 'freelance',
      salary: 60000,
      contract_start_date: '2020-01-01',
      chargeable_days: 200,
      ft_percentage: null,
    });
    const cost = computeMemberAnnualCost(member, [], null, 2026);
    expect(cost).toBeCloseTo(60000, 2);
  });

  it('computes a non-zero cost for segnalatore category', () => {
    const member = makeMember({
      category: 'segnalatore',
      seniority: null,
      salary: 5000,
      contract_start_date: '2020-01-01',
      ft_percentage: null,
    });
    const cost = computeMemberAnnualCost(member, [], null, 2026);
    expect(cost).toBeCloseTo(5000, 2);
  });
});
