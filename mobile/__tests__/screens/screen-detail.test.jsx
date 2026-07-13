import React from 'react';
import * as Clipboard from 'expo-clipboard';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { createClient } from '@supabase/supabase-js';
import ScreenDetailScreen from '../../app/(tabs)/screens/[id]';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'screen-1' }),
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
}));

const mockSupabase = createClient('', '');

const mockScreen = {
  id: 'screen-1', name: 'Lobby Screen', status: 'active',
  operating_hours_start: '08:00', operating_hours_end: '22:00', timezone: 'America/Toronto',
  venue_category: 'retail', venue_subtype: null, address_city: 'Toronto', screen_photos: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.from.mockImplementation((table) => {
    if (table === 'screens') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockScreen, error: null }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
  });
  mockSupabase.rpc.mockResolvedValue({ data: 'tok_xyz789', error: null });
});

describe('ScreenDetailScreen', () => {
  it('renders the screen token', async () => {
    const { findByText } = render(<ScreenDetailScreen />);
    expect(await findByText('tok_xyz789')).toBeTruthy();
  });

  it('copies the token and shows confirmation when the Token row is tapped', async () => {
    const { findByText, getByText } = render(<ScreenDetailScreen />);
    await findByText('tok_xyz789');
    fireEvent.press(getByText('tok_xyz789'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('tok_xyz789'));
    expect(await findByText('Copied!')).toBeTruthy();
  });

  it('does not make the Token row tappable when there is no token', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
    const { findByText, queryByText } = render(<ScreenDetailScreen />);
    await findByText('Lobby Screen');
    expect(queryByText('—')).toBeTruthy();
    fireEvent.press(queryByText('—'));
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  });
});
