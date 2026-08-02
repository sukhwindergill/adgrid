import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../components/primitives/ConfirmModal.jsx', () => ({
  useConfirm: () => vi.fn(() => Promise.resolve(true)),
}));

const fromMock = vi.fn(() => ({
  select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }),
  update: () => ({ eq: () => Promise.resolve({ error: null, data: null }) }),
}));

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: (...args) => fromMock(...args),
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) },
  },
}));

global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

import { Campaigns } from './Campaigns.jsx';

const campaigns = [
  {
    id: 'camp-1', advertiser: 'Acme', status: 'pending_review', category: 'Retail',
    budget: 1000, spent: 0, impressions: 0, scans: 0, start: '2026-08-01', end: '2026-09-01',
  },
];

describe('Campaigns onApprovalChange wiring', () => {
  beforeEach(() => {
    fromMock.mockClear();
    global.fetch.mockClear();
  });

  it('invokes onApprovalChange after approving a pending campaign from the Campaigns list, not just from the Approval Queue', async () => {
    const onApprovalChange = vi.fn();
    render(
      <Campaigns
        campaigns={campaigns}
        setCampaigns={() => {}}
        setDetail={() => {}}
        canReview
        onApprovalChange={onApprovalChange}
      />
    );

    const approveBtn = await screen.findByText('✓ Approve');
    fireEvent.click(approveBtn);

    await waitFor(() => expect(onApprovalChange).toHaveBeenCalledTimes(1));
  });
});
