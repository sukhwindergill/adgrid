import React from 'react';
import { render } from '@testing-library/react-native';
import ScreensScreen from '../../app/(tabs)/screens/index';
import { AuthProvider } from '../../context/AuthContext';

jest.mock('../../hooks/useScreens', () => ({
  useScreens: () => ({ screens: [], loading: false, refetch: jest.fn() }),
}));

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe('ScreensScreen', () => {
  it('labels the add-screen FAB for screen readers', () => {
    const { getByLabelText } = render(<ScreensScreen />, { wrapper });
    expect(getByLabelText('Add a new screen')).toBeTruthy();
  });
});
