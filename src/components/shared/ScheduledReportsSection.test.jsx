import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '../primitives/Toast.jsx';

const insertMock = vi.fn(() => Promise.resolve({ error: null }));
const listQuery = {
  select: () => listQuery,
  eq: () => listQuery,
  or: () => listQuery,
  order: () => Promise.resolve({ data: [], error: null }),
};
const fromMock = vi.fn(() => ({ ...listQuery, insert: insertMock }));

vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: (...args) => fromMock(...args) },
}));

import { ScheduledReportsSection } from './ScheduledReportsSection.jsx';

const renderSection = (props = {}) => render(
  <ToastProvider>
    <ScheduledReportsSection campaignId="camp-1" userId="user-1" audience="advertiser" {...props} />
  </ToastProvider>
);

describe('ScheduledReportsSection', () => {
  beforeEach(() => { insertMock.mockClear(); fromMock.mockClear(); });

  it('rejects an invalid recipient without inserting', async () => {
    renderSection();
    fireEvent.change(screen.getByPlaceholderText(/agency\.com/), { target: { value: 'ok@x.com, nope' } });
    fireEvent.click(screen.getByText('Schedule report'));
    expect(await screen.findByText(/"nope" isn't a valid email/)).toBeInTheDocument();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('inserts a campaign-scoped weekly schedule with parsed recipients', async () => {
    renderSection();
    fireEvent.change(screen.getByPlaceholderText(/agency\.com/), { target: { value: 'A@x.com; b@y.ca' } });
    fireEvent.click(screen.getByText('Schedule report'));
    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    const row = insertMock.mock.calls[0][0];
    expect(row).toMatchObject({
      owner_id: 'user-1', audience: 'advertiser', scope: 'campaign', campaign_id: 'camp-1',
      frequency: 'weekly', recipients: ['a@x.com', 'b@y.ca'],
    });
    expect(new Date(row.next_run_at).getUTCDay()).toBe(1);
  });

  it('all-campaigns scope sends no campaign_id', async () => {
    renderSection({ audience: 'operator' });
    fireEvent.change(screen.getByLabelText('Covers'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Frequency'), { target: { value: 'monthly' } });
    fireEvent.change(screen.getByPlaceholderText(/agency\.com/), { target: { value: 'a@x.com' } });
    fireEvent.click(screen.getByText('Schedule report'));
    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    expect(insertMock.mock.calls[0][0]).toMatchObject({ audience: 'operator', scope: 'all', campaign_id: null, frequency: 'monthly' });
  });
});
