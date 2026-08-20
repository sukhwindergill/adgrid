import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Btn } from './Btn.jsx';
import { C } from '../../design/tokens.js';

describe('Btn hover states', () => {
  it('darkens background on hover for the ghost variant', () => {
    render(<Btn variant="ghost">Cancel</Btn>);
    const btn = screen.getByRole('button', { name: 'Cancel' });
    expect(btn.style.background).toBe('transparent');
    fireEvent.mouseEnter(btn);
    expect(btn.style.background).toBe('rgb(245, 245, 245)');
    fireEvent.mouseLeave(btn);
    expect(btn.style.background).toBe('transparent');
  });

  it('deepens background on hover for the danger variant', () => {
    render(<Btn variant="danger">Delete</Btn>);
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn.style.background).toBe('rgb(254, 242, 242)');
    fireEvent.mouseEnter(btn);
    expect(btn.style.background).toBe('rgba(239, 68, 68, 0.16)');
    fireEvent.mouseLeave(btn);
    expect(btn.style.background).toBe('rgb(254, 242, 242)');
  });

  it('deepens background on hover for the success variant', () => {
    render(<Btn variant="success">Approve</Btn>);
    const btn = screen.getByRole('button', { name: 'Approve' });
    expect(btn.style.background).toBe('rgb(236, 253, 245)');
    fireEvent.mouseEnter(btn);
    expect(btn.style.background).toBe('rgba(16, 185, 129, 0.16)');
    fireEvent.mouseLeave(btn);
    expect(btn.style.background).toBe('rgb(236, 253, 245)');
  });

  it('darkens background on hover for the stripe variant', () => {
    render(<Btn variant="stripe">Connect Stripe</Btn>);
    const btn = screen.getByRole('button', { name: 'Connect Stripe' });
    expect(btn.style.background).toBe('rgb(99, 91, 255)');
    fireEvent.mouseEnter(btn);
    expect(btn.style.background).toBe('rgb(81, 71, 230)');
    fireEvent.mouseLeave(btn);
    expect(btn.style.background).toBe('rgb(99, 91, 255)');
  });

  it('does not change background on hover when disabled', () => {
    render(<Btn variant="ghost" disabled>Cancel</Btn>);
    const btn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.mouseEnter(btn);
    expect(btn.style.background).toBe('transparent');
  });
});

describe('Btn loading state', () => {
  it('renders a spinner when loading is true', () => {
    const { container } = render(<Btn loading>Save</Btn>);
    expect(container.querySelector('[data-testid="btn-spinner"]')).toBeInTheDocument();
  });

  it('does not render a spinner when loading is false', () => {
    const { container } = render(<Btn>Save</Btn>);
    expect(container.querySelector('[data-testid="btn-spinner"]')).not.toBeInTheDocument();
  });

  it('keeps the original children in the DOM (visually hidden) while loading', () => {
    render(<Btn loading>Save</Btn>);
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('disables the button while loading', () => {
    render(<Btn loading>Save</Btn>);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('does not fire onClick while loading', () => {
    const onClick = vi.fn();
    render(<Btn loading onClick={onClick}>Save</Btn>);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

