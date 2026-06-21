import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import VenueScreen from '../../app/onboard/venue';
import { OnboardProvider } from '../../context/OnboardContext';
import { AuthProvider } from '../../context/AuthContext';

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
});
