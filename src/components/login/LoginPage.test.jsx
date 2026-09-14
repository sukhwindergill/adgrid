import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginPage } from './LoginPage.jsx';

const signIn = vi.fn();
const signInWithOAuth = vi.fn();

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    signIn, signUp: vi.fn(), signInWithOAuth,
    passwordRecovery: false, resetPasswordForEmail: vi.fn(), updatePassword: vi.fn(),
  }),
}));

describe('LoginPage demo login', () => {
  beforeEach(() => {
    signIn.mockReset().mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows no demo button when the env vars are unset', () => {
    render(<LoginPage />);
    expect(screen.queryByText(/Try Demo/)).not.toBeInTheDocument();
  });

  it('hides the demo button when only one env var is set', () => {
    vi.stubEnv('VITE_DEMO_EMAIL', 'demo@adgrid.io');
    render(<LoginPage />);
    expect(screen.queryByText(/Try Demo/)).not.toBeInTheDocument();
  });

  it('shows the demo button when both env vars are set, and signs in with them on click', async () => {
    vi.stubEnv('VITE_DEMO_EMAIL', 'demo@adgrid.io');
    vi.stubEnv('VITE_DEMO_PASSWORD', 'demo-pass-123');
    render(<LoginPage />);

    fireEvent.click(screen.getByText(/Try Demo/));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('demo@adgrid.io', 'demo-pass-123'));
  });

  it('surfaces the error and stays on the page when demo sign-in fails', async () => {
    vi.stubEnv('VITE_DEMO_EMAIL', 'demo@adgrid.io');
    vi.stubEnv('VITE_DEMO_PASSWORD', 'demo-pass-123');
    signIn.mockResolvedValue({ error: { message: 'Demo account unavailable' } });
    render(<LoginPage />);

    fireEvent.click(screen.getByText(/Try Demo/));

    await waitFor(() => screen.getByText('Demo account unavailable'));
  });
});

describe('LoginPage OAuth signup intent', () => {
  beforeEach(() => {
    signInWithOAuth.mockReset().mockResolvedValue({ error: null });
    localStorage.clear();
  });

  it('persists the picked intent before an OAuth signup, same as the password path', async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByText('Sign up'));
    fireEvent.click(screen.getByText('List my screens'));
    fireEvent.click(screen.getByText(/Continue with Google/));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledWith('google'));
    expect(localStorage.getItem('adgrid_signup_intent')).toBe('operator');
  });

  it('does not set an intent for OAuth sign-in (no intent picker shown)', async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByText(/Continue with Google/));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledWith('google'));
    expect(localStorage.getItem('adgrid_signup_intent')).toBeNull();
  });
});

describe('LoginPage password visibility toggle', () => {
  it('shows the password field masked by default and reveals it on toggle click', () => {
    render(<LoginPage />);
    const passwordInput = screen.getByPlaceholderText('••••••••');
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
