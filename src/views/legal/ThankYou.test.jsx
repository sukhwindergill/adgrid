import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThankYou } from './ThankYou.jsx';

const renderAt = url => render(<MemoryRouter initialEntries={[url]}><ThankYou /></MemoryRouter>);

describe('ThankYou', () => {
  it('shows operator next steps by default', () => {
    renderAt('/thank-you');
    expect(screen.getByText('Pick your screen')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'earnings calculator' })).toHaveAttribute('href', '/#earnings');
  });

  it('shows advertiser next steps for role=advertiser', () => {
    renderAt('/thank-you?role=advertiser');
    expect(screen.getByText('Get your artwork ready')).toBeInTheDocument();
    expect(screen.queryByText('Pick your screen')).not.toBeInTheDocument();
  });

  it('falls back to operator copy for an unknown role', () => {
    renderAt('/thank-you?role=<script>');
    expect(screen.getByText('Pick your screen')).toBeInTheDocument();
  });

  it('always offers a way onward', () => {
    renderAt('/thank-you');
    expect(screen.getByRole('button', { name: 'Share AdGrid' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });
});
