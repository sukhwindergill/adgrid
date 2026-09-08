import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Conversion pixel + postback spec (docs/superpowers/specs/2026-09-08-
// conversion-pixel-postback-design.md): postback key generation, pixel
// embed snippet, and promo code creation on the "Conversion Tracking" tab.

const upsertMock = vi.fn(() => Promise.resolve({ error: null }));
const insertPromoMock = vi.fn(() => Promise.resolve({ error: null }));

function chain(resolveValue) {
  const q = {};
  ['select', 'eq', 'order', 'limit', 'maybeSingle'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'adv-1' } } }) },
    from: vi.fn((table) => {
      if (table === 'advertiser_integrations') {
        return {
          ...chain({ data: null, error: null }),
          upsert: (...args) => upsertMock(...args),
        };
      }
      if (table === 'bookings') return chain({ data: [{ id: 'c1', campaign_name: 'Fall Promo' }], error: null });
      if (table === 'campaign_promo_codes') {
        return {
          ...chain({ data: [], error: null }),
          insert: (...args) => insertPromoMock(...args),
        };
      }
      if (table === 'integration_events') return chain({ data: [], error: null });
      return chain({ data: [], error: null });
    }),
    channel: () => ({ on: () => ({ subscribe: () => {} }) }),
    removeChannel: () => {},
  },
}));

import AdvIntegrationsView from './AdvIntegrationsView.jsx';

describe('AdvIntegrationsView — Conversion Tracking tab', () => {
  beforeEach(() => { upsertMock.mockClear(); insertPromoMock.mockClear(); });

  it('generates a postback key and shows it once', async () => {
    render(<AdvIntegrationsView />);
    fireEvent.click(await screen.findByText('Conversion Tracking'));

    fireEvent.click(await screen.findByText('Generate key'));

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1));
    const payload = upsertMock.mock.calls[0][0];
    expect(payload.platform).toBe('adgrid_postback');
    expect(payload.config.key_hash).toBeTruthy();
    expect(payload.config.key_hash).not.toMatch(/^agpk_/); // stored value is a hash, not the plaintext key

    expect(screen.getByText(/won't be shown again/)).toBeInTheDocument();
  });

  it('shows the pixel embed snippet', async () => {
    render(<AdvIntegrationsView />);
    fireEvent.click(await screen.findByText('Conversion Tracking'));
    expect(await screen.findByText('Conversion pixel')).toBeInTheDocument();
    expect(screen.getByText(/adgrid_cid=/)).toBeInTheDocument();
  });

  it('creates a promo code for a selected campaign', async () => {
    render(<AdvIntegrationsView />);
    fireEvent.click(await screen.findByText('Conversion Tracking'));

    const select = await screen.findByDisplayValue('Select…');
    fireEvent.change(select, { target: { value: 'c1' } });
    fireEvent.change(screen.getByPlaceholderText('SEEONSCREEN10'), { target: { value: 'SAVE10' } });
    fireEvent.click(screen.getByText('+ Add'));

    await waitFor(() => expect(insertPromoMock).toHaveBeenCalledTimes(1));
    const payload = insertPromoMock.mock.calls[0][0];
    expect(payload.campaign_id).toBe('c1');
    expect(payload.code).toBe('SAVE10');
    expect(payload.advertiser_id).toBe('adv-1');
  });
});
