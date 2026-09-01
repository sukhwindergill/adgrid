import { describe, it, expect } from 'vitest';
import { normalizeBooking } from './normalizeBooking.js';

describe('normalizeBooking', () => {
  it('maps raw DB column names onto the fields CampaignRow/CampaignComparisonTable/CampaignDetail expect', () => {
    const raw = {
      id: 'b1', advertiser_name: 'Acme', screen_name: 'Union Station', start_date: '2026-08-01', end_date: '2026-09-01',
      schedule_days: ['Mon', 'Tue'], time_start: '09:00', time_end: '17:00', spent: 500, scans: 12,
      accent_color: '#ff0000', destination_url: 'https://acme.com', cta_text: 'Shop now', budget: 1000, status: 'active',
    };
    expect(normalizeBooking(raw)).toMatchObject({
      id: 'b1', advertiser: 'Acme', screen: 'Union Station', start: '2026-08-01', end: '2026-09-01',
      days: ['Mon', 'Tue'], timeStart: '09:00', timeEnd: '17:00', spent: 500, scans: 12,
      color: '#ff0000', destination: 'https://acme.com', cta: 'Shop now', budget: 1000, status: 'active',
    });
  });

  it('defaults spent and scans to 0 rather than passing through null', () => {
    const raw = { id: 'b1', advertiser_name: 'Acme', spent: null, scans: null };
    const result = normalizeBooking(raw);
    expect(result.spent).toBe(0);
    expect(result.scans).toBe(0);
  });

  it('keeps the raw DB columns alongside the normalized aliases, not just the renamed ones', () => {
    const raw = { id: 'b1', advertiser_name: 'Acme', start_date: '2026-08-01' };
    const result = normalizeBooking(raw);
    expect(result.advertiser_name).toBe('Acme');
    expect(result.start_date).toBe('2026-08-01');
  });
});
