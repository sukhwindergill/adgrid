import { renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { usePushNotifications } from '../../hooks/usePushNotifications';

// N11: getExpoPushTokenAsync() throws when no EAS project is linked --
// exactly this repo's current state. Confirms the failure is recognized and
// logged as one clear, actionable line instead of a raw error dump, and
// that it never crashes the hook either way.

describe('usePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  });

  it('logs a clear, single-line diagnosis when no EAS project is linked, and does not throw', async () => {
    const consoleErr = jest.spyOn(console, 'error').mockImplementation(() => {});
    Notifications.getExpoPushTokenAsync.mockRejectedValueOnce(
      new Error("No 'projectId' found. If you're using EAS Build, set extra.eas.projectId.")
    );

    renderHook(() => usePushNotifications('op-1', () => {}));

    await waitFor(() => expect(consoleErr).toHaveBeenCalled());

    const messages = consoleErr.mock.calls.map(args => args.join(' '));
    expect(messages.some(m => m.includes('no EAS project is linked'))).toBe(true);
    // The raw error object/stack should not have been dumped for this known cause.
    expect(messages.some(m => m.includes('Push notification registration failed'))).toBe(false);

    consoleErr.mockRestore();
  });

  it('still logs the raw error for an unrelated failure', async () => {
    const consoleErr = jest.spyOn(console, 'error').mockImplementation(() => {});
    Notifications.getExpoPushTokenAsync.mockRejectedValueOnce(new Error('network unreachable'));

    renderHook(() => usePushNotifications('op-1', () => {}));

    await waitFor(() => expect(consoleErr).toHaveBeenCalled());
    const messages = consoleErr.mock.calls.map(args => args.join(' '));
    expect(messages.some(m => m.includes('Push notification registration failed'))).toBe(true);

    consoleErr.mockRestore();
  });
});
