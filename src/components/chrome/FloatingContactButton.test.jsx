import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingContactButton } from './FloatingContactButton.jsx';

describe('FloatingContactButton', () => {
  it('renders a Contact us button', () => {
    render(<FloatingContactButton onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /contact us/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<FloatingContactButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /contact us/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
