import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../components/primitives/Toast.jsx';

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'op-1' } }),
}));

vi.mock('../../components/primitives/ConfirmModal.jsx', () => ({
  useConfirm: () => vi.fn(() => Promise.resolve(true)),
}));

const fromMock = vi.fn(() => ({
  update: () => ({ eq: () => Promise.resolve({ error: null, data: null }) }),
}));

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: (...args) => fromMock(...args),
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) },
  },
}));

global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

import { CampaignDetail } from './CampaignDetail.jsx';

const campaign = {
  id: 'camp-1', advertiser: 'Acme', status: 'pending_review', category: 'Retail',
  budget: 1000, spent: 0, impressions: 0, scans: 0, start: '2026-08-01', end: '2026-09-01',
};

describe('CampaignDetail onApprovalChange wiring', () => {
  beforeEach(() => {
    fromMock.mockClear();
    global.fetch.mockClear();
  });

  it('invokes onApprovalChange after rejecting a pending campaign', async () => {
    const onApprovalChange = vi.fn();
    const onBack = vi.fn();
    render(
      <ToastProvider>
        <CampaignDetail campaign={campaign} onBack={onBack} onUpdate={() => {}} canReview setCampaigns={() => {}} onApprovalChange={onApprovalChange} />
      </ToastProvider>
    );

    fireEvent.click(await screen.findByText('✗ Reject'));
    fireEvent.change(screen.getByPlaceholderText(/Reason for rejection/), { target: { value: 'Not relevant' } });
    fireEvent.click(screen.getByText('Confirm Reject'));

    await waitFor(() => expect(onApprovalChange).toHaveBeenCalledTimes(1));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('invokes onApprovalChange after approving a pending campaign', async () => {
    const onApprovalChange = vi.fn();
    const onBack = vi.fn();
    render(
      <ToastProvider>
        <CampaignDetail campaign={campaign} onBack={onBack} onUpdate={() => {}} canReview setCampaigns={() => {}} onApprovalChange={onApprovalChange} />
      </ToastProvider>
    );

    fireEvent.click(await screen.findByText('✓ Approve'));

    await waitFor(() => expect(onApprovalChange).toHaveBeenCalledTimes(1));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
