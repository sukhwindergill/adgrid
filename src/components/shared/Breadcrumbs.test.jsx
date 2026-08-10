import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumbs } from './Breadcrumbs.jsx';

describe('Breadcrumbs', () => {
  it('renders each item, linking every item except the last', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Privacy Policy' }]} />
      </MemoryRouter>
    );

    const homeLink = screen.getByRole('link', { name: 'Home' });
    expect(homeLink).toHaveAttribute('href', '/');
    expect(screen.getByText('Privacy Policy').tagName).toBe('SPAN');
    expect(screen.queryByRole('link', { name: 'Privacy Policy' })).toBeNull();
  });

  it('renders a nav with an accessible label', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Terms of Service' }]} />
      </MemoryRouter>
    );
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });
});
