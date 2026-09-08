import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScansView from './ScansView.jsx';
import { supabase } from '../../lib/supabase.js';

// Competitive Parity Program G15 (reporting half) -- a campaign running
// more than one weighted creative variant shows a per-variant performance
// breakdown; a campaign with zero or one creative (the overwhelming
// majority today) never shows the section at all.

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'adv-1' } }),
}));

const SCAN_ROW = {
  id: 's1', scanned_at: '2026-09-01T12:00:00Z', campaign_id: 'camp-1',
  screen_id: 'scr-1', device_type: 'mobile', country: 'CA', email: null,
  consent: false, is_bot: false, is_duplicate: false,
  bookings: { advertiser_name: 'Campaign One' }, screens: { name: 'Screen One' },
};

function mockSupabaseFrom(table) {
  if (table === 'scans') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [SCAN_ROW], error: null })),
          })),
        })),
      })),
    };
  }
  if (table === 'bookings') {
    return {
      select: vi.fn((cols) => ({
        eq: vi.fn(() => (
          cols === 'spent'
            ? { maybeSingle: vi.fn(() => Promise.resolve({ data: { spent: 100 }, error: null })) }
            : Promise.resolve({ data: [{ id: 'camp-1', advertiser_name: 'Campaign One' }], error: null })
        )),
      })),
    };
  }
  if (table === 'campaign_creatives') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({
          data: [{ id: 'cr1', label: 'Variant A' }, { id: 'cr2', label: 'Variant B' }],
        })),
      })),
    };
  }
  if (table === 'ad_plays') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({
          data: [{ creative_id: 'cr1' }, { creative_id: 'cr1' }, { creative_id: 'cr2' }],
        })),
      })),
    };
  }
  throw new Error(`unexpected table ${table}`);
}

vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: vi.fn() },
}));

beforeEach(() => {
  supabase.from.mockImplementation(mockSupabaseFrom);
});

describe('ScansView variant performance', () => {
  it('does not show the section with no campaign selected', async () => {
    render(<ScansView />);
    await screen.findByText('Scan Log (1)');
    expect(screen.queryByText('Variant Performance')).not.toBeInTheDocument();
  });

  it('shows a per-variant breakdown once a campaign with multiple creatives is selected', async () => {
    render(<ScansView />);
    await screen.findByText('Scan Log (1)');
    fireEvent.change(screen.getByDisplayValue('All campaigns'), { target: { value: 'camp-1' } });
    expect(await screen.findByText('Variant Performance')).toBeInTheDocument();
    expect(screen.getByText('Variant A')).toBeInTheDocument();
    expect(screen.getByText('Variant B')).toBeInTheDocument();
  });

  it('does not show the section for a campaign with a single creative', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'campaign_creatives') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: [{ id: 'cr1', label: 'Only' }] })) })) };
      }
      return mockSupabaseFrom(table);
    });
    render(<ScansView />);
    await screen.findByText('Scan Log (1)');
    fireEvent.change(screen.getByDisplayValue('All campaigns'), { target: { value: 'camp-1' } });
    await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('campaign_creatives'));
    expect(screen.queryByText('Variant Performance')).not.toBeInTheDocument();
  });
});
