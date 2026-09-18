import { describe, it, expect } from 'vitest';
import { canPause, canResume, canCancel, resolveNewStatus } from './campaignStatusRules.ts';

describe('canPause', () => {
  it('allows pausing an active or scheduled campaign', () => {
    expect(canPause('active')).toBe(true);
    expect(canPause('scheduled')).toBe(true);
  });
  it('disallows pausing anything else', () => {
    expect(canPause('paused')).toBe(false);
    expect(canPause('completed')).toBe(false);
    expect(canPause('pending_review')).toBe(false);
  });
});

describe('canResume', () => {
  it('only allows resuming from paused', () => {
    expect(canResume('paused')).toBe(true);
    expect(canResume('active')).toBe(false);
    expect(canResume('completed')).toBe(false);
  });
});

describe('canCancel', () => {
  it('allows cancelling from pending_review, active, paused, or scheduled', () => {
    expect(canCancel('pending_review')).toBe(true);
    expect(canCancel('active')).toBe(true);
    expect(canCancel('paused')).toBe(true);
    expect(canCancel('scheduled')).toBe(true);
  });
  it('disallows cancelling an already-completed or rejected campaign', () => {
    expect(canCancel('completed')).toBe(false);
    expect(canCancel('rejected')).toBe(false);
  });
});

describe('resolveNewStatus', () => {
  it('pauses an active campaign', () => {
    expect(resolveNewStatus('pause', 'active', '2026-09-01', '2026-09-15')).toEqual({ ok: true, status: 'paused' });
  });

  it('refuses to pause a campaign that cannot be paused', () => {
    const result = resolveNewStatus('pause', 'completed', null, '2026-09-15');
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Cannot pause");
  });

  it('resumes to active when the start date has already passed', () => {
    expect(resolveNewStatus('resume', 'paused', '2026-09-01', '2026-09-15')).toEqual({ ok: true, status: 'active' });
  });

  it('resumes to scheduled when the start date is still in the future', () => {
    expect(resolveNewStatus('resume', 'paused', '2026-10-01', '2026-09-15')).toEqual({ ok: true, status: 'scheduled' });
  });

  it('resumes to scheduled when there is no start date at all', () => {
    expect(resolveNewStatus('resume', 'paused', null, '2026-09-15')).toEqual({ ok: true, status: 'scheduled' });
  });

  it('refuses to resume a campaign that is not paused', () => {
    const result = resolveNewStatus('resume', 'active', '2026-09-01', '2026-09-15');
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Cannot resume");
  });

  // Regression test: 'cancelled' is not a value bookings_status_check
  // allows -- 'completed' is the schema's only terminal status.
  it('cancels to completed, never cancelled', () => {
    expect(resolveNewStatus('cancel', 'active', null, '2026-09-15')).toEqual({ ok: true, status: 'completed' });
  });

  it('refuses to cancel an already-completed campaign', () => {
    const result = resolveNewStatus('cancel', 'completed', null, '2026-09-15');
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Cannot cancel");
  });

  it('refuses an unknown action', () => {
    const result = resolveNewStatus('delete', 'active', null, '2026-09-15');
    expect(result.ok).toBe(false);
  });
});
