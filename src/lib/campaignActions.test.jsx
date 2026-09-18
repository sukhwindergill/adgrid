import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Regression tests for a real bug: charge-campaign (service role) already
// sets bookings.status/payment_status server-side on a successful charge,
// but ApproveBtn then did a redundant client-side write to those same
// columns. authenticated has no column-level UPDATE grant on either, so
// that write always failed -- showing a false "Charged, but failed to
// update booking status... do not charge again" error on every single
// successful approval, the main/common path through this button. The
// "approve without charging" fallback had the same direct-write bug (fixed
// by routing through operator-schedule-unpaid-campaign instead).

vi.mock('../components/primitives/ConfirmModal.jsx', () => ({
  useConfirm: () => vi.fn(() => Promise.resolve(true)),
}));

const fromMock = vi.fn();
vi.mock('./supabase.js', () => ({
  supabase: {
    from: (...args) => fromMock(...args),
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) },
  },
}));

import { ApproveBtn } from './campaignActions.jsx';

const campaign = { id: 'camp-1', status: 'pending_review' };

describe('ApproveBtn', () => {
  beforeEach(() => {
    fromMock.mockClear();
    global.fetch = vi.fn();
  });

  it('does not write to bookings at all after a successful charge', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    const setCampaigns = vi.fn();
    const onSuccess = vi.fn();

    render(<ApproveBtn campaign={campaign} setCampaigns={setCampaigns} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(fromMock).not.toHaveBeenCalled();
    expect(setCampaigns).toHaveBeenCalled();
    const updater = setCampaigns.mock.calls[0][0];
    expect(updater([campaign])).toEqual([{ id: 'camp-1', status: 'scheduled', payment_status: 'paid' }]);
    expect(screen.queryByText(/failed to update booking status/i)).not.toBeInTheDocument();
  });

  it('routes the no-payment-method fallback through operator-schedule-unpaid-campaign, not a direct bookings write', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Advertiser has no card on file.' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ campaign_id: 'camp-1', ok: true }] }) });
    const setCampaigns = vi.fn();
    const onSuccess = vi.fn();

    render(<ApproveBtn campaign={campaign} setCampaigns={setCampaigns} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(fromMock).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [url, opts] = global.fetch.mock.calls[1];
    expect(url).toMatch(/\/operator-schedule-unpaid-campaign$/);
    expect(JSON.parse(opts.body)).toEqual({ campaign_id: 'camp-1' });
  });

  it('surfaces an error and does not mark the campaign scheduled when operator-schedule-unpaid-campaign itself fails', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Advertiser has no card on file.' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ campaign_id: 'camp-1', ok: false, error: 'Not one of your campaigns' }] }) });
    const setCampaigns = vi.fn();
    const onSuccess = vi.fn();

    render(<ApproveBtn campaign={campaign} setCampaigns={setCampaigns} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => expect(screen.getByText(/Not one of your campaigns/i)).toBeInTheDocument());
    expect(setCampaigns).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
