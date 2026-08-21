import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../lib/marketplace.js', () => ({
  fetchScreenDemographics: vi.fn(() => Promise.resolve({ available: false })),
}));
vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
    }),
  },
}));

import { ScreenAnalyticsPanel } from './ScreenAnalyticsPanel.jsx';

describe('ScreenAnalyticsPanel', () => {
  it('shows unavailable message when demographic data has no coverage', async () => {
    render(<ScreenAnalyticsPanel screenId="s1" />);
    await waitFor(() => {
      expect(screen.getByText(/not available for this location/i)).toBeInTheDocument();
    });
  });

  it('never merges the demographic section into the traffic section', async () => {
    render(<ScreenAnalyticsPanel screenId="s1" />);
    await waitFor(() => {
      expect(screen.getByTestId('traffic-section')).toBeInTheDocument();
      expect(screen.getByTestId('demographic-section')).toBeInTheDocument();
    });
  });
});
