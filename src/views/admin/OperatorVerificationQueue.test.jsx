import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperatorVerificationQueue } from './OperatorVerificationQueue.jsx';
import { supabase } from '../../lib/supabase.js';

// Product-audit finding: manual-review-operator was fully built and
// deployed, but no admin page ever called it -- an operator flagged for
// manual identity review had no way to ever leave that state. These tests
// lock in that the queue lists pending operators and calls the review
// endpoint on approve/reject.

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: 'tok' } } })) },
    from: vi.fn(),
  },
}));

vi.mock('../../components/primitives/Toast.jsx', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

function chain(result) {
  const q = {};
  q.select = vi.fn(() => q);
  q.eq = vi.fn(() => q);
  q.in = vi.fn(() => q);
  q.order = vi.fn(() => q);
  q.limit = vi.fn(() => q);
  // Thenable: whichever method the query happens to end on (order() for
  // the pending list, limit() for the reviewed list), awaiting it resolves
  // to `result` -- so this doesn't depend on a specific chain length.
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return q;
}

function renderQueue() {
  return render(<MemoryRouter><OperatorVerificationQueue /></MemoryRouter>);
}

// useVerificationQueue fires the pending query then the reviewed query
// (Promise.all preserves call order for synchronous mock invocation), and
// refresh() re-runs both after a review action -- so this cycles by call
// count (odd = pending, even = reviewed) rather than a fixed-length queue.
function mockQueue({ pending = [], reviewed = [] } = {}) {
  let calls = 0;
  supabase.from.mockImplementation(() => {
    calls += 1;
    return chain({ data: calls % 2 === 1 ? pending : reviewed, error: null });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
});

describe('OperatorVerificationQueue', () => {
  it('lists operators awaiting manual review', async () => {
    mockQueue({ pending: [{ id: 'op-1', name: 'Jane Op', email: 'jane@example.com', created_at: '2026-09-01' }] });

    renderQueue();
    expect(await screen.findByText('Jane Op')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('Needs review')).toBeInTheDocument();
  });

  it('shows an empty state when nothing is pending', async () => {
    mockQueue();
    renderQueue();
    expect(await screen.findByText('Nothing awaiting manual review.')).toBeInTheDocument();
  });

  it('approves an operator via manual-review-operator', async () => {
    mockQueue({ pending: [{ id: 'op-1', name: 'Jane Op', email: 'jane@example.com', created_at: '2026-09-01' }] });
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }));

    renderQueue();
    await screen.findByText('Jane Op');
    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/manual-review-operator'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      }),
    ));
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ operatorId: 'op-1', decision: 'approved' });
  });

  it('rejects an operator with a reason', async () => {
    mockQueue({ pending: [{ id: 'op-1', name: 'Jane Op', email: 'jane@example.com', created_at: '2026-09-01' }] });
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }));

    renderQueue();
    await screen.findByText('Jane Op');
    fireEvent.change(screen.getByPlaceholderText('Rejection reason (optional)'), { target: { value: 'Blurry photo' } });
    fireEvent.click(screen.getByText('Reject'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ operatorId: 'op-1', decision: 'rejected', notes: 'Blurry photo' });
  });
});
