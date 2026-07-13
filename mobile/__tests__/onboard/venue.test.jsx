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

  it('marks the selected venue category as selected for screen readers', () => {
    const { getByText } = render(<VenueScreen />, { wrapper });
    const category = getByText('Retail').parent.parent;
    expect(category.props.accessibilityState).toEqual({ selected: false });
    fireEvent.press(getByText('Retail'));
    expect(category.props.accessibilityState).toEqual({ selected: true });
  });
});
