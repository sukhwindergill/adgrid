import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const sendThreadMessage = vi.fn(() => Promise.resolve());

vi.mock('../../lib/marketplace.js', () => ({
  fetchOrCreateThread: vi.fn(() => Promise.resolve({ id: 't1' })),
  fetchThreadMessages: vi.fn(() => Promise.resolve([{ id: 'm1', sender_id: 'u1', body: 'What is dwell time?' }])),
  sendThreadMessage: (...args) => sendThreadMessage(...args),
}));

const toastError = vi.fn();
vi.mock('../primitives/Toast.jsx', () => ({
  useToast: () => ({ success: vi.fn(), error: toastError }),
}));

import { MarketplaceThread } from './MarketplaceThread.jsx';

describe('MarketplaceThread', () => {
  it('sends a message and clears the composer', async () => {
    render(<MarketplaceThread listingId="l1" operatorId="op1" />);
    await waitFor(() => expect(screen.getByText(/dwell time/i)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'Any weekend traffic data?' } });
    fireEvent.click(screen.getByText(/send/i));

    await waitFor(() => expect(sendThreadMessage).toHaveBeenCalledWith({ id: 't1' }, 'Any weekend traffic data?'));
    expect(screen.getByPlaceholderText(/ask a question/i).value).toBe('');
  });

  it('keeps draft and re-enables send button when sendThreadMessage fails', async () => {
    sendThreadMessage.mockRejectedValueOnce(new Error('Network error'));
    render(<MarketplaceThread listingId="l1" operatorId="op1" />);
    await waitFor(() => expect(screen.getByText(/dwell time/i)).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/ask a question/i);
    const sendBtn = screen.getByText(/send/i);

    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendBtn);

    // After the promise rejects, button should be re-enabled and draft preserved
    await waitFor(() => expect(sendThreadMessage).toHaveBeenCalledWith({ id: 't1' }, 'Test message'));
    expect(input.value).toBe('Test message');
    expect(sendBtn).not.toBeDisabled();
    expect(toastError).toHaveBeenCalled();
  });
});
