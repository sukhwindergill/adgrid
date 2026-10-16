import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const getSession = vi.fn();
vi.mock('../../lib/supabase.js', () => ({
  supabase: { auth: { getSession: () => getSession() } },
}));

const callPairing = vi.fn();
vi.mock('../../lib/screenPairing.js', async (importOriginal) => ({
  ...(await importOriginal()),
  callPairing: (...args) => callPairing(...args),
}));

import { PairingCodeEntry, HardwareInstructions } from './ScreenPairing.jsx';

const SCREEN = { id: 'scr-1', name: 'Corner Brew', screen_token: 'tok-123' };

beforeEach(() => {
  callPairing.mockReset();
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: 'jwt' } } });
});

function typeCode(value) {
  fireEvent.change(screen.getByLabelText('Enter pairing code'), { target: { value } });
}

describe('PairingCodeEntry', () => {
  it('only enables Pair once a full valid code is typed', () => {
    render(<PairingCodeEntry screen={SCREEN} />);
    const btn = screen.getByRole('button', { name: 'Pair screen' });
    expect(btn).toBeDisabled();
    typeCode('abc 23');
    expect(btn).toBeDisabled();
    typeCode('abc 234');
    expect(btn).toBeEnabled();
  });

  it('claims the normalized code for this screen and reports success', async () => {
    callPairing.mockResolvedValue({ ok: true, status: 200, data: { ok: true, screen_id: 'scr-1', screen_name: 'Corner Brew' } });
    const onPaired = vi.fn();
    render(<PairingCodeEntry screen={SCREEN} onPaired={onPaired} />);
    typeCode('abc-234');
    fireEvent.click(screen.getByRole('button', { name: 'Pair screen' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Paired.');
    const [body, opts] = callPairing.mock.calls[0];
    expect(body).toEqual({ action: 'claim', code: 'ABC234', screen_id: 'scr-1' });
    expect(opts.accessToken).toBe('jwt');
    expect(onPaired).toHaveBeenCalledWith({ ok: true, screen_id: 'scr-1', screen_name: 'Corner Brew' });
  });

  it('shows the server error message', async () => {
    callPairing.mockResolvedValue({ ok: false, status: 410, data: { error: 'That code has expired.' } });
    render(<PairingCodeEntry screen={SCREEN} />);
    typeCode('ABC234');
    fireEvent.click(screen.getByRole('button', { name: 'Pair screen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That code has expired.');
  });

  it('explains rate limiting and network failures in plain words', async () => {
    callPairing.mockResolvedValueOnce({ ok: false, status: 429, data: {} });
    render(<PairingCodeEntry screen={SCREEN} />);
    typeCode('ABC234');
    fireEvent.click(screen.getByRole('button', { name: 'Pair screen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Too many attempts/);

    callPairing.mockResolvedValueOnce({ ok: false, status: 0, data: { error: 'Network error' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pair screen' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Couldn't reach AdGrid/));
  });

  it('asks the operator to sign in again when the session is gone', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    render(<PairingCodeEntry screen={SCREEN} />);
    typeCode('ABC234');
    fireEvent.click(screen.getByRole('button', { name: 'Pair screen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/session expired/i);
    expect(callPairing).not.toHaveBeenCalled();
  });
});

describe('HardwareInstructions', () => {
  it('leads with the /pair page and code entry, keeping the player URL as an advanced fallback', () => {
    render(<HardwareInstructions hardware="Browser Kiosk" screen={SCREEN} />);
    expect(screen.getAllByText(`${window.location.host}/pair`).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Enter pairing code')).toBeInTheDocument();
    expect(screen.getByText(/Advanced: use the full player URL/)).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/display/tok-123`)).toBeInTheDocument();
  });

  it('gives Bookworm-correct Raspberry Pi steps', () => {
    const { container } = render(<HardwareInstructions hardware="Raspberry Pi 5" screen={SCREEN} />);
    const script = container.querySelector('pre').textContent;
    expect(script).toContain('sudo apt install -y chromium\n');
    expect(script).toContain('~/.config/labwc/autostart');
    expect(script).toContain('do_blanking 1');
    expect(script).toContain(`${window.location.origin}/pair`);
    expect(script).not.toContain('chromium-browser');
    expect(script).not.toContain('LXDE');
    expect(script).not.toContain('tok-123');
  });

  it('never sends operators to the AdGrid repo', () => {
    for (const hw of ['Browser Kiosk', 'Raspberry Pi 5', 'Mini PC', 'Android TV']) {
      const { container, unmount } = render(<HardwareInstructions hardware={hw} screen={SCREEN} />);
      expect(container.textContent).not.toMatch(/screen-agent|AdGrid repo/);
      unmount();
    }
  });
});
