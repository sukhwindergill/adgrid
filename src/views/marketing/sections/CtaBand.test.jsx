import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const insertMock = vi.fn(() => Promise.resolve({ error: null }));
vi.mock('../../../lib/supabase.js', () => ({
  supabase: { from: () => ({ insert: (...args) => insertMock(...args) }) },
}));

import { CtaBand } from './CtaBand.jsx';

describe('CtaBand', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    insertMock.mockClear();
  });

  it('shows the response-time promise on the form', () => {
    render(<MemoryRouter><CtaBand /></MemoryRouter>);
    expect(screen.getByText(/2 business days/i)).toBeInTheDocument();
  });

  it('navigates to /thank-you after a successful submit', async () => {
    render(<MemoryRouter><CtaBand /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jane Smith' } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'jane@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /join the operator waitlist/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/thank-you'));
  });

  it('does not navigate when the submit fails', async () => {
    insertMock.mockResolvedValueOnce({ error: { message: 'boom' } });
    render(<MemoryRouter><CtaBand /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jane Smith' } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'jane@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /join the operator waitlist/i }));

    await waitFor(() => screen.getByText(/something went wrong/i));
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
