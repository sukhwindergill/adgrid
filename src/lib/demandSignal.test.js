import { describe, it, expect, vi } from 'vitest';
import { logDemandSignal, demandSignalMessage, DEMAND_SIGNAL_MIN_COUNT } from './demandSignal.js';

describe('logDemandSignal', () => {
  it('inserts a city + venue category row when both are present', () => {
    const insert = vi.fn(() => ({ then: fn => fn() }));
    const supabase = { from: vi.fn(() => ({ insert })) };
    logDemandSignal(supabase, { city: 'Toronto', venueCategory: 'gym' });
    expect(supabase.from).toHaveBeenCalledWith('demand_signals');
    expect(insert).toHaveBeenCalledWith({ city: 'Toronto', venue_category: 'gym' });
  });

  it('does not log when the city is missing', () => {
    const supabase = { from: vi.fn() };
    logDemandSignal(supabase, { city: '', venueCategory: 'gym' });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('does not log when the venue category is missing', () => {
    const supabase = { from: vi.fn() };
    logDemandSignal(supabase, { city: 'Vancouver', venueCategory: '' });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe('demandSignalMessage', () => {
  it('returns null when the count has not loaded yet', () => {
    expect(demandSignalMessage({ count: null, city: 'Toronto', venueLabel: 'Gym' })).toBeNull();
  });

  it('is honest about zero recent searches instead of hiding the widget', () => {
    const msg = demandSignalMessage({ count: 0, city: 'Toronto', venueLabel: 'Gym' });
    expect(msg.tone).toBe('early');
    expect(msg.text).toMatch(/among the first/i);
  });

  it('frames a small count as an early market rather than a hard number', () => {
    const msg = demandSignalMessage({ count: DEMAND_SIGNAL_MIN_COUNT - 1, city: 'Vancouver', venueLabel: 'Café' });
    expect(msg.tone).toBe('early');
    expect(msg.text).not.toMatch(/\d/);
  });

  it('states a real count once it clears the honesty threshold', () => {
    const msg = demandSignalMessage({ count: 5, city: 'Toronto', venueLabel: 'Condo Lobby' });
    expect(msg.tone).toBe('active');
    expect(msg.text).toBe('5 advertisers searched for condo lobby screens in Toronto in the last 30 days.');
  });
});
