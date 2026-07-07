import { renderHook, waitFor } from '@testing-library/react-native';
import { useScreens } from '../../hooks/useScreens';
import { createClient } from '@supabase/supabase-js';

const mockSupabase = createClient('', '');

const mockScreens = [
  { id: '1', name: 'Lobby Screen', venue_category: 'retail', venue_subtype: 'Clothing', address_city: 'Toronto', health_status: null, last_seen: new Date().toISOString(), screen_photos: [], status: 'active' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data: mockScreens, error: null }),
  });
});

describe('useScreens', () => {
  it('loads screens for given operatorId', async () => {
    const { result } = renderHook(() => useScreens('op-123'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.screens).toHaveLength(1);
    expect(result.current.screens[0].name).toBe('Lobby Screen');
  });

  it('returns empty array when operatorId is null', async () => {
    const { result } = renderHook(() => useScreens(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.screens).toHaveLength(0);
  });
});
