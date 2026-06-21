import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import ConnectScreen from '../../app/onboard/connect';
import { OnboardProvider } from '../../context/OnboardContext';
import { AuthProvider } from '../../context/AuthContext';

jest.mock('expo-camera', () => ({
  CameraView: ({ onBarcodeScanned, children }) => {
    global.__triggerScan = onBarcodeScanned;
    return children || null;
  },
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}));

const wrapper = ({ children }) => (
  <AuthProvider><OnboardProvider>{children}</OnboardProvider></AuthProvider>
);

describe('ConnectScreen', () => {
  it('shows scan instruction', () => {
    const { getByText } = render(<ConnectScreen />, { wrapper });
    expect(getByText(/Scan the QR code/i)).toBeTruthy();
  });

  it('shows Connected state after scan', async () => {
    const { getByText } = render(<ConnectScreen />, { wrapper });
    global.__triggerScan({ type: 'qr', data: 'screen_token_abc123' });
    await waitFor(() => expect(getByText(/Connected/i)).toBeTruthy());
  });
});
