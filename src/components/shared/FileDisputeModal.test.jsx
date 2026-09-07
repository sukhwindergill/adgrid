import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileDisputeModal } from './FileDisputeModal.jsx';

const insertMock = vi.fn(() => Promise.resolve({ error: null }));

vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: () => ({ insert: (...args) => insertMock(...args) }) },
}));

describe('FileDisputeModal', () => {
  it('inserts a dispute scoped to the given booking and advertiser', async () => {
    const onFiled = vi.fn();
    render(<FileDisputeModal bookingId="b1" advertiserId="adv-1" onClose={() => {}} onFiled={onFiled} />);

    fireEvent.change(screen.getByDisplayValue("My ad didn't run"), { target: { value: 'wrong_creative' } });
    fireEvent.change(screen.getByPlaceholderText(/Anything that helps/), { target: { value: 'Saw a different ad' } });
    fireEvent.click(screen.getByText('Submit Report'));

    await waitFor(() => expect(insertMock).toHaveBeenCalledWith({
      booking_id: 'b1',
      advertiser_id: 'adv-1',
      reason_code: 'wrong_creative',
      reason_text: 'Saw a different ad',
    }));
    expect(await screen.findByText(/We've received your report/)).toBeInTheDocument();
  });

  it('shows the insert error instead of a false success state', async () => {
    insertMock.mockResolvedValueOnce({ error: { message: 'network down' } });
    render(<FileDisputeModal bookingId="b1" advertiserId="adv-1" onClose={() => {}} />);

    fireEvent.click(screen.getByText('Submit Report'));

    expect(await screen.findByText('network down')).toBeInTheDocument();
    expect(screen.queryByText(/We've received your report/)).not.toBeInTheDocument();
  });
});
