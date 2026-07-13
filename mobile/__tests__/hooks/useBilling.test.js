import { renderHook, waitFor } from '@testing-library/react-native';
import { useBilling } from '../../hooks/useBilling';
import { createClient } from '@supabase/supabase-js';

const mockSupabase = createClient('', '');

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: { access_token: 'tok_123' } }, error: null,
  });
  global.fetch = jest.fn();
});

describe('useBilling', () => {
  it('loads billing summary from the operator-billing function', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        connectStatus: 'active',
        payouts: [{ id: 'po_1', amount: 42, status: 'paid', arrival_date: '2026-07-01', currency: 'cad' }],
        balance: null, charges: [],
      }),
    });
    const { result } = renderHook(() => useBilling());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.connectStatus).toBe('active');
    expect(result.current.data.payouts).toHaveLength(1);
    expect(result.current.error).toBe('');
  });

  it('sets an error when the request fails', async () => {
    global.fetch.mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useBilling());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Could not load billing data.');
  });

  it('does nothing if there is no session', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const { result } = renderHook(() => useBilling());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });
});
