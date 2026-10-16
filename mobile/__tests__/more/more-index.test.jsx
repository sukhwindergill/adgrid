import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import MoreScreen from '../../app/(tabs)/more/index';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));
jest.mock('expo-linking', () => ({ openURL: jest.fn() }));
jest.mock('../../hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({ deregister: jest.fn() }),
}));

const mockSetActiveMode = jest.fn().mockResolvedValue(undefined);
let mockMode;
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'u-1', name: 'Dana', email: 'dana@example.com' },
    activeMode: mockMode,
    setActiveMode: mockSetActiveMode,
    signOut: jest.fn(),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockMode = 'operator';
});

describe('MoreScreen', () => {
  it('shows operator menu items in operator mode', () => {
    const { getByLabelText, queryByLabelText } = render(<MoreScreen />);
    expect(getByLabelText('Billing')).toBeTruthy();
    expect(queryByLabelText('Create campaign on web')).toBeNull();
  });

  it('switches to advertiser mode and lands on Campaigns', async () => {
    const { getByLabelText } = render(<MoreScreen />);
    fireEvent.press(getByLabelText('Advertiser mode'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/campaigns'));
    expect(mockSetActiveMode).toHaveBeenCalledWith('advertiser');
  });

  it('shows the advertiser menu with a Create on web link in advertiser mode', () => {
    mockMode = 'advertiser';
    const { getByLabelText, queryByLabelText } = render(<MoreScreen />);
    expect(queryByLabelText('Billing')).toBeNull();
    fireEvent.press(getByLabelText('Create campaign on web'));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(/\/app\/adv-create$/));
  });

  it('switches back to operator mode and lands on Home', async () => {
    mockMode = 'advertiser';
    const { getByLabelText } = render(<MoreScreen />);
    fireEvent.press(getByLabelText('Operator mode'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(mockSetActiveMode).toHaveBeenCalledWith('operator');
  });
});
