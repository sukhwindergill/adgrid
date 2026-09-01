import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../components/primitives/ConfirmModal.jsx', () => ({
  useConfirm: () => vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../components/primitives/Toast.jsx', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), undo: vi.fn() }),
}));

const fromMock = vi.fn(() => ({
  select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }),
}));

vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: (...args) => fromMock(...args) },
}));

import { Campaigns } from './Campaigns.jsx';

const campaigns = [
  { id: 'c1', advertiser: 'Acme', status: 'active', category: 'Retail', budget: 1000, spent: 500, impressions: 10000, scans: 25, start: '2026-08-01', end: '2026-09-01' },
  { id: 'c2', advertiser: 'Widgetco', status: 'active', category: 'Tech', budget: 2000, spent: 400, impressions: 5000, scans: 10, start: '2026-08-01', end: '2026-09-01' },
];

describe('Campaigns — compare mode', () => {
  beforeEach(() => fromMock.mockClear());

  it('shows a prompt with no selection, then a comparison table with real CPM/cost-per-scan once two campaigns are checked', async () => {
    render(<Campaigns campaigns={campaigns} setCampaigns={() => {}} setDetail={() => {}} />);
    await waitFor(() => screen.getByText('Campaigns'));

    fireEvent.click(screen.getByText('⇄ Compare'));
    expect(screen.getByText(/Select two or more campaigns/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Select Acme for comparison'));
    fireEvent.click(screen.getByLabelText('Select Widgetco for comparison'));

    await waitFor(() => screen.getByText('Comparing 2 campaigns'));
    expect(screen.getAllByText('Acme').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Widgetco').length).toBeGreaterThan(0);
    // Acme: $500/10000 impr *1000 = $50.00 CPM; $500/25 scans = $20.00/scan
    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
  });

  it('checking a row does not open its detail view', async () => {
    const setDetail = vi.fn();
    render(<Campaigns campaigns={campaigns} setCampaigns={() => {}} setDetail={setDetail} />);
    await waitFor(() => screen.getByText('Campaigns'));

    fireEvent.click(screen.getByText('⇄ Compare'));
    fireEvent.click(screen.getByLabelText('Select Acme for comparison'));

    expect(setDetail).not.toHaveBeenCalled();
  });

  it('exiting compare mode clears the selection', async () => {
    render(<Campaigns campaigns={campaigns} setCampaigns={() => {}} setDetail={() => {}} />);
    await waitFor(() => screen.getByText('Campaigns'));

    fireEvent.click(screen.getByText('⇄ Compare'));
    fireEvent.click(screen.getByLabelText('Select Acme for comparison'));
    await waitFor(() => screen.getByText('Comparing 1 campaign'));

    fireEvent.click(screen.getByText('✕ Exit Compare'));
    expect(screen.queryByText(/Comparing/)).not.toBeInTheDocument();
  });
});
