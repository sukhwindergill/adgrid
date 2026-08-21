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

import { CtaBand, applyUtmPrefill } from './CtaBand.jsx';

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

  describe('UTM pre-fill', () => {
    beforeEach(() => {
      sessionStorage.clear();
    });

    it('pre-fills the source field from captured UTM data', () => {
      sessionStorage.setItem('adgrid_utm', JSON.stringify({ utm_source: 'google', utm_medium: 'cpc' }));
      render(<MemoryRouter><CtaBand /></MemoryRouter>);

      expect(screen.getByLabelText(/how did you hear about adgrid/i).value).toBe('google / cpc');
    });

    it('leaves the source field empty when no UTM data was captured', () => {
      render(<MemoryRouter><CtaBand /></MemoryRouter>);

      expect(screen.getByLabelText(/how did you hear about adgrid/i).value).toBe('');
    });
  });
});

describe('CtaBand UTM pre-fill', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('pre-fills the source field from captured UTM data when present', () => {
    sessionStorage.setItem('adgrid_utm', JSON.stringify({ utm_source: 'google', utm_medium: 'cpc' }));
    render(<MemoryRouter><CtaBand /></MemoryRouter>);
    expect(screen.getByLabelText(/how did you hear about adgrid/i)).toHaveValue('google / cpc');
  });

  it('leaves the source field empty when no UTM data was captured', () => {
    render(<MemoryRouter><CtaBand /></MemoryRouter>);
    expect(screen.getByLabelText(/how did you hear about adgrid/i)).toHaveValue('');
  });
});

describe('applyUtmPrefill (mount-effect guard logic)', () => {
  it('fills an empty source with the UTM label', () => {
    const prev = { name: '', email: '', company: '', city: '', screens: '', source: '' };
    expect(applyUtmPrefill(prev, 'google / cpc')).toEqual({ ...prev, source: 'google / cpc' });
  });

  it('does not overwrite a source the user already filled in', () => {
    const prev = { name: '', email: '', company: '', city: '', screens: '', source: 'friend referral' };
    expect(applyUtmPrefill(prev, 'google / cpc')).toBe(prev);
  });
});
