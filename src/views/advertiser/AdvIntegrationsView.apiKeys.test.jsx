import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// REST campaign API spec (docs/superpowers/specs/2026-09-08-rest-
// campaign-api-design.md): key generation, listing, and revocation on
// the "API Keys" tab.

const insertMock = vi.fn(() => Promise.resolve({ error: null }));
const updateMock = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));

function chain(resolveValue) {
  const q = {};
  ['select', 'eq', 'order', 'limit'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

let apiKeyRows = [];

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'adv-1' } } }) },
    from: vi.fn((table) => {
      if (table === 'api_keys') {
        return {
          ...chain({ data: apiKeyRows, error: null }),
          insert: (...args) => insertMock(...args),
          update: (...args) => updateMock(...args),
        };
      }
      if (table === 'advertiser_integrations') return chain({ data: [], error: null });
      if (table === 'integration_events') return chain({ data: [], error: null });
      return chain({ data: [], error: null });
    }),
    channel: () => ({ on: () => ({ subscribe: () => {} }) }),
    removeChannel: () => {},
  },
}));

import AdvIntegrationsView from './AdvIntegrationsView.jsx';

describe('AdvIntegrationsView — API Keys tab', () => {
  beforeEach(() => { insertMock.mockClear(); updateMock.mockClear(); apiKeyRows = []; });

  it('generates a key and shows it once, storing only a hash', async () => {
    render(<AdvIntegrationsView />);
    fireEvent.click(await screen.findByText('API Keys'));

    fireEvent.change(await screen.findByPlaceholderText('e.g. Media buying tool'), { target: { value: 'My Tool' } });
    fireEvent.click(screen.getByText('+ Generate key'));

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    const payload = insertMock.mock.calls[0][0];
    expect(payload.name).toBe('My Tool');
    expect(payload.key_prefix.startsWith('agak_')).toBe(true);
    expect(payload.key_hash).toBeTruthy();
    expect(payload.key_hash.startsWith('agak_')).toBe(false);

    expect(screen.getByText(/won't be shown again/)).toBeInTheDocument();
  });

  it('lists existing keys and revokes one', async () => {
    apiKeyRows = [{ id: 'k1', name: 'My Tool', key_prefix: 'agak_abcd1234', last_used_at: null, revoked_at: null, created_at: '2026-09-01T00:00:00Z' }];
    render(<AdvIntegrationsView />);
    fireEvent.click(await screen.findByText('API Keys'));

    expect(await screen.findByText('My Tool')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Revoke'));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][0].revoked_at).toBeTruthy();
  });
});
