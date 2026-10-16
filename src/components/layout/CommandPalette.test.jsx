import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../lib/supabase.js', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
import { CommandPalette } from './CommandPalette.jsx';

describe('CommandPalette', () => {
  it('filters pages and screens and opens the highlighted one on Enter', () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette onClose={onClose} onNavigate={onNavigate} activeMode="operator"
      screens={[{ id: 's1', name: 'Kits Gym Lobby', city: 'Vancouver' }]} />);
    const input = screen.getByRole('combobox', { name: 'Search' });

    fireEvent.change(input, { target: { value: 'kits' } });
    expect(screen.getByRole('option', { name: /Kits Gym Lobby/ })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith('screen-detail/s1');
    expect(onClose).toHaveBeenCalled();
  });

  it('moves with arrow keys and closes on Escape', () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette onClose={onClose} onNavigate={onNavigate} activeMode="advertiser" advertiserId="a1" />);
    const input = screen.getByRole('combobox', { name: 'Search' });
    fireEvent.change(input, { target: { value: 'bill' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith('adv-billing');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
