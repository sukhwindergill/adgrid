import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Revenue } from './Revenue.jsx';

// Programmatic backfill revenue (G20 -- docs/superpowers/specs/2026-09-08-
// programmatic-backfill-design.md).

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ profile: { owner_revenue_share: 0.4 } }),
}));

vi.mock('../../hooks/useOperatorCampaignIds.js', () => ({
  useOperatorCampaignIds: () => new Set([]),
}));

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: (table) => {
      if (table === 'bookings') {
        return { select: () => ({ in: () => ({ gte: () => Promise.resolve({ data: [] }) }) }) };
      }
      if (table === 'screens') {
        return { select: () => ({ in: () => Promise.resolve({ data: [{ id: 's1', cpm_floor: 3.0 }] }) }) };
      }
      if (table === 'programmatic_fills') {
        return {
          select: () => ({
            in: () => ({
              eq: () => Promise.resolve({
                data: [
                  { cpm: 4.5, screen_id: 's1', fetched_at: new Date().toISOString() },
                  { cpm: 3.0, screen_id: 's1', fetched_at: new Date().toISOString() },
                ],
              }),
            }),
          }),
        };
      }
      return { select: () => ({ in: () => Promise.resolve({ data: [] }) }) };
    },
  },
}));

describe('Revenue programmatic backfill revenue', () => {
  it('shows a $ figure and fill count for played programmatic fills', async () => {
    render(<Revenue operatorScreenIds={['s1']} />);
    await waitFor(() => expect(screen.getByText('Programmatic Revenue')).toBeInTheDocument());
    // 4.5 + 3.0 = $7.50 -> rounds/displays as toLocaleString of 7.5
    expect(screen.getByText('$7.5')).toBeInTheDocument();
    expect(screen.getByText('2 fills played')).toBeInTheDocument();
  });
});
