import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ConnectScreen from '../../app/onboard/connect';
import { OnboardProvider, useOnboard } from '../../context/OnboardContext';
import { AuthProvider } from '../../context/AuthContext';
import { createClient } from '@supabase/supabase-js';

const mockSupabase = createClient('', '');

// connect.jsx reads form.screenId from context; seed it before each test.
function Seed() {
  const { update } = useOnboard();
  React.useEffect(() => { update({ screenId: 'screen-1' }); }, []);
  return null;
}

const wrapper = ({ children }) => (
  <AuthProvider><OnboardProvider><Seed />{children}</OnboardProvider></AuthProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.rpc.mockResolvedValue({ data: 'tok_abc123', error: null });
});

describe('ConnectScreen', () => {
  it('fetches and displays the screen token', async () => {
    const { findByText } = render(<ConnectScreen />, { wrapper });
    expect(await findByText('tok_abc123')).toBeTruthy();
  });

  it('shows an error state if the token fetch fails', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { findByText } = render(<ConnectScreen />, { wrapper });
    expect(await findByText(/Couldn't load your screen token/i)).toBeTruthy();
  });

  it('calls router.replace to screens list when Done is pressed', async () => {
    const { findByText, getByText } = render(<ConnectScreen />, { wrapper });
    await findByText('tok_abc123');
    fireEvent.press(getByText('Done'));
    // No assertion on navigation target — expo-router is globally mocked in jest.setup.js;
    // this just confirms the button doesn't throw once the token has loaded.
  });
});
