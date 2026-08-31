import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const deliveryRows = [
  { screen_id: 's1', impressions: 2000, billable_scans: 100 }, // 5%
];

vi.mock('../../../lib/supabase.js', () => ({
  supabase: {
    from: () => ({ select: () => ({ in: () => Promise.resolve({ data: deliveryRows, error: null }) }) }),
  },
}));

import { TopScreensInsight } from './TopScreensInsight.jsx';

const allScreens = [{ id: 's1', venue_category: 'transit', environment: 'outdoor' }];

describe('TopScreensInsight', () => {
  it('renders nothing with no past campaigns', () => {
    const { container } = render(
      <TopScreensInsight pastCampaignIds={[]} allScreens={allScreens} currentVenueFilter="" currentEnvFilter="any" onApply={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the top-performing profile once delivery data resolves', async () => {
    render(
      <TopScreensInsight pastCampaignIds={['c1']} allScreens={allScreens} currentVenueFilter="" currentEnvFilter="any" onApply={() => {}} />
    );
    await waitFor(() => expect(screen.getByText('Apply filter')).toBeInTheDocument());
    expect(screen.getByText(/Outdoor/)).toBeInTheDocument();
  });

  it('calls onApply with the recommended profile', async () => {
    const onApply = vi.fn();
    render(
      <TopScreensInsight pastCampaignIds={['c1']} allScreens={allScreens} currentVenueFilter="" currentEnvFilter="any" onApply={onApply} />
    );
    await waitFor(() => screen.getByText('Apply filter'));
    fireEvent.click(screen.getByText('Apply filter'));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ venue_category: 'transit', environment: 'outdoor' }));
  });

  it('hides itself once the filters already match the recommendation', async () => {
    const { container } = render(
      <TopScreensInsight pastCampaignIds={['c1']} allScreens={allScreens} currentVenueFilter="transit" currentEnvFilter="outdoor" onApply={() => {}} />
    );
    await new Promise(r => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });

  it('dismisses on close and stays hidden', async () => {
    render(
      <TopScreensInsight pastCampaignIds={['c1']} allScreens={allScreens} currentVenueFilter="" currentEnvFilter="any" onApply={() => {}} />
    );
    await waitFor(() => screen.getByText('Apply filter'));
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByText('Apply filter')).not.toBeInTheDocument();
  });
});
