import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const callPairing = vi.fn();
vi.mock('../../lib/screenPairing.js', async (importOriginal) => ({
  ...(await importOriginal()),
  callPairing: (...args) => callPairing(...args),
}));

import { PairScreen } from './PairScreen.jsx';
import { PAIRED_TOKEN_KEY, PENDING_PAIRING_KEY } from '../../lib/screenPairing.js';

const TOKEN = '3f1c2b7a-0000-4000-8000-000000000001';
const inFuture = () => new Date(Date.now() + 15 * 60_000).toISOString();
const ok = (data) => Promise.resolve({ ok: true, status: 200, data });

beforeEach(() => {
  callPairing.mockReset();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/pair');
});

describe('PairScreen', () => {
  it('shows a code, then redirects to the player once the code is claimed', async () => {
    let polls = 0;
    callPairing.mockImplementation((body) => {
      if (body.action === 'create') return ok({ code: 'ABC234', device_secret: 'sec', expires_at: inFuture() });
      polls += 1;
      return ok(polls < 2 ? { status: 'pending' } : { status: 'claimed', screen_token: TOKEN });
    });
    const navigate = vi.fn();
    render(<PairScreen navigate={navigate} pollIntervalMs={20} />);

    expect(await screen.findByTestId('pair-code')).toHaveTextContent('ABC 234');
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(`/display/${TOKEN}`));

    const pollCall = callPairing.mock.calls.find(([b]) => b.action === 'poll')[0];
    expect(pollCall).toEqual({ action: 'poll', code: 'ABC234', device_secret: 'sec' });
    expect(window.localStorage.getItem(PAIRED_TOKEN_KEY)).toBe(TOKEN);
    expect(window.localStorage.getItem(PENDING_PAIRING_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('goes straight to the player when this device was already paired', async () => {
    window.localStorage.setItem(PAIRED_TOKEN_KEY, TOKEN);
    const navigate = vi.fn();
    render(<PairScreen navigate={navigate} pollIntervalMs={20} />);
    expect(navigate).toHaveBeenCalledWith(`/display/${TOKEN}`);
    expect(callPairing).not.toHaveBeenCalled();
  });

  it('?reset=1 forgets the paired screen and shows a new code', async () => {
    window.localStorage.setItem(PAIRED_TOKEN_KEY, TOKEN);
    window.history.replaceState(null, '', '/pair?reset=1');
    callPairing.mockImplementation((body) => (body.action === 'create'
      ? ok({ code: 'XYZ789', device_secret: 's', expires_at: inFuture() })
      : ok({ status: 'pending' })));
    const navigate = vi.fn();
    render(<PairScreen navigate={navigate} pollIntervalMs={20} />);
    expect(await screen.findByTestId('pair-code')).toHaveTextContent('XYZ 789');
    expect(navigate).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PAIRED_TOKEN_KEY)).toBeNull();
  });

  it('reuses a pending code across reloads instead of minting a new one', async () => {
    window.localStorage.setItem(PENDING_PAIRING_KEY, JSON.stringify({ code: 'KEEP23', device_secret: 's', expires_at: inFuture() }));
    callPairing.mockImplementation(() => ok({ status: 'pending' }));
    render(<PairScreen navigate={vi.fn()} pollIntervalMs={20} />);
    expect(screen.getByTestId('pair-code')).toHaveTextContent('KEE P23');
    await waitFor(() => expect(callPairing).toHaveBeenCalled());
    expect(callPairing.mock.calls.every(([b]) => b.action === 'poll')).toBe(true);
  });

  it('requests a fresh code when the current one expires', async () => {
    let creates = 0;
    callPairing.mockImplementation((body) => {
      if (body.action === 'create') {
        creates += 1;
        return ok({ code: creates === 1 ? 'AAA222' : 'BBB333', device_secret: 's', expires_at: inFuture() });
      }
      return ok({ status: 'expired' });
    });
    render(<PairScreen navigate={vi.fn()} pollIntervalMs={20} />);
    await waitFor(() => expect(screen.getByTestId('pair-code')).toHaveTextContent('BBB 333'));
  });

  it('shows an offline message when the code request fails, and keeps retrying', async () => {
    callPairing.mockImplementation(() => Promise.resolve({ ok: false, status: 0, data: {} }));
    render(<PairScreen navigate={vi.fn()} pollIntervalMs={20} />);
    expect(await screen.findByText(/Can't reach AdGrid/)).toBeInTheDocument();
    await waitFor(() => expect(callPairing.mock.calls.length).toBeGreaterThan(1));
  });
});
