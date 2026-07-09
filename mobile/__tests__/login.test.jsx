import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../app/login';
import { AuthProvider } from '../context/AuthContext';

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe('LoginScreen', () => {
  it('renders email and password fields', () => {
    const { getByPlaceholderText } = render(<LoginScreen />, { wrapper });
    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
  });

  it('shows error when fields empty', async () => {
    const { getByText, findByText } = render(<LoginScreen />, { wrapper });
    fireEvent.press(getByText('Sign in'));
    expect(await findByText('Email and password are required')).toBeTruthy();
  });

  it('calls signIn with email and password', async () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />, { wrapper });
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'secret');
    fireEvent.press(getByText('Sign in'));
    await waitFor(() => expect(getByText('Sign in')).toBeTruthy());
  });

  it('shows forgot password link and switches to the forgot form', () => {
    const { getByText, queryByPlaceholderText } = render(<LoginScreen />, { wrapper });
    fireEvent.press(getByText('Forgot password?'));
    expect(queryByPlaceholderText('Password')).toBeNull();
    expect(getByText('Send reset code')).toBeTruthy();
  });

  it('submits email and advances to the code screen on success', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<LoginScreen />, { wrapper });
    fireEvent.press(getByText('Forgot password?'));
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.press(getByText('Send reset code'));
    expect(await findByText('Check your email for a reset code.')).toBeTruthy();
    expect(getByText('Reset password')).toBeTruthy();
  });

  it('shows an inline error for a malformed code without calling the network', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<LoginScreen />, { wrapper });
    fireEvent.press(getByText('Forgot password?'));
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.press(getByText('Send reset code'));
    await findByText('Reset password');

    fireEvent.changeText(getByPlaceholderText('123456'), 'abc');
    fireEvent.changeText(getByPlaceholderText('New password'), 'newpass123');
    fireEvent.press(getByText('Reset password'));

    expect(await findByText('Enter the 6-digit code from your email.')).toBeTruthy();
  });

  it('completes the reset and returns to sign-in with a success message', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<LoginScreen />, { wrapper });
    fireEvent.press(getByText('Forgot password?'));
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.press(getByText('Send reset code'));
    await findByText('Reset password');

    fireEvent.changeText(getByPlaceholderText('123456'), '123456');
    fireEvent.changeText(getByPlaceholderText('New password'), 'newpass123');
    fireEvent.press(getByText('Reset password'));

    expect(await findByText('Password updated. You can now sign in.')).toBeTruthy();
    expect(getByText('Sign in')).toBeTruthy();
  });
});
