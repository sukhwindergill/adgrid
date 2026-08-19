import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { createClient } from '@supabase/supabase-js';
import VenueScreen from '../../app/onboard/venue';
import { OnboardProvider } from '../../context/OnboardContext';
import { AuthProvider } from '../../context/AuthContext';

const mockSupabase = createClient('', '');

const wrapper = ({ children }) => (
  <AuthProvider><OnboardProvider>{children}</OnboardProvider></AuthProvider>
);

describe('VenueScreen', () => {
  it('renders venue name field', () => {
    const { getByPlaceholderText } = render(<VenueScreen />, { wrapper });
    expect(getByPlaceholderText('e.g. Main Lobby Screen')).toBeTruthy();
  });

  it('shows error when name is empty and next pressed', async () => {
    const { getByText, findByText } = render(<VenueScreen />, { wrapper });
    fireEvent.press(getByText('Next'));
    expect(await findByText('Screen name is required')).toBeTruthy();
  });

  it('marks the selected venue category as selected for screen readers', () => {
    const { getByText } = render(<VenueScreen />, { wrapper });
    const category = getByText('Retail').parent.parent;
    expect(category.props.accessibilityState).toEqual({ selected: false });
    fireEvent.press(getByText('Retail'));
    expect(category.props.accessibilityState).toEqual({ selected: true });
  });

  // Regression test for a real bug: this screen submitted
  // address_city/address_state/address_country, none of which exist on
  // screens (the real columns are city/state/country) -- every submission
  // failed on the insert, so no operator could ever register a screen from
  // the mobile app.
  it('submits city/state/country, not address_city/address_state/address_country', async () => {
    const { getByPlaceholderText, getByText } = render(<VenueScreen />, { wrapper });
    fireEvent.changeText(getByPlaceholderText('e.g. Main Lobby Screen'), 'Regression Test Screen');
    fireEvent.press(getByText('Retail'));
    fireEvent.changeText(getByPlaceholderText('Toronto'), 'Toronto');
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      const calls = mockSupabase.from('screens').insert.mock.calls;
      expect(calls.some(([payload]) => payload?.name === 'Regression Test Screen')).toBe(true);
    });

    const [payload] = mockSupabase.from('screens').insert.mock.calls
      .find(([p]) => p?.name === 'Regression Test Screen');
    expect(payload).toMatchObject({ city: 'Toronto', country: 'CA' });
    expect(payload).not.toHaveProperty('address_city');
    expect(payload).not.toHaveProperty('address_state');
    expect(payload).not.toHaveProperty('address_country');
  });
});
