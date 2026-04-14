import { describe, it, expect } from 'vitest';
import { countUpcomingEventsByMember } from './upcoming-events';
import { MemberEvent } from '@/lib/optimizer/types';

let _nextEventId = 0;
function makeEvent(partial: Partial<MemberEvent> = {}): MemberEvent {
  return {
    id: partial.id ?? `e-${_nextEventId++}`,
    user_id: 'u-1',
    member_id: partial.member_id ?? 'm-1',
    field: 'salary',
    value: '0',
    start_date: '2026-01-01',
    end_date: null,
    note: null,
    created_at: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('countUpcomingEventsByMember', () => {
  it('returns empty map when there are no events', () => {
    const result = countUpcomingEventsByMember([], '2026-06-01', 365);
    expect(result.size).toBe(0);
  });

  it('counts events starting strictly after today and within the window', () => {
    const events: MemberEvent[] = [
      makeEvent({ member_id: 'm-1', start_date: '2026-07-01' }),
      makeEvent({ member_id: 'm-1', start_date: '2026-09-01' }),
      makeEvent({ member_id: 'm-2', start_date: '2026-08-01' }),
    ];
    const result = countUpcomingEventsByMember(events, '2026-06-01', 365);
    expect(result.get('m-1')).toBe(2);
    expect(result.get('m-2')).toBe(1);
  });

  it('excludes events that already started on or before today', () => {
    const events: MemberEvent[] = [
      makeEvent({ member_id: 'm-1', start_date: '2026-06-01' }), // today
      makeEvent({ member_id: 'm-1', start_date: '2026-05-01' }), // past
      makeEvent({ member_id: 'm-1', start_date: '2026-07-01' }), // future
    ];
    const result = countUpcomingEventsByMember(events, '2026-06-01', 365);
    expect(result.get('m-1')).toBe(1);
  });

  it('excludes events starting after the window ends', () => {
    const events: MemberEvent[] = [
      makeEvent({ member_id: 'm-1', start_date: '2026-07-01' }),
      makeEvent({ member_id: 'm-1', start_date: '2027-07-02' }), // just outside 365-day window from 2026-06-01
    ];
    const result = countUpcomingEventsByMember(events, '2026-06-01', 365);
    expect(result.get('m-1')).toBe(1);
  });

  it('handles 0-day window (no upcoming count)', () => {
    const events: MemberEvent[] = [
      makeEvent({ member_id: 'm-1', start_date: '2026-06-02' }),
    ];
    const result = countUpcomingEventsByMember(events, '2026-06-01', 0);
    expect(result.size).toBe(0);
  });
});
