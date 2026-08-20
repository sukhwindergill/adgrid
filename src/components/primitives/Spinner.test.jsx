// src/components/primitives/Spinner.test.jsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Spinner } from './Spinner.jsx';

describe('Spinner', () => {
  it('renders with the default 14px size', () => {
    const { container } = render(<Spinner />);
    const el = container.firstChild;
    expect(el.style.width).toBe('14px');
    expect(el.style.height).toBe('14px');
  });

  it('respects a custom size prop', () => {
    const { container } = render(<Spinner size={24} />);
    const el = container.firstChild;
    expect(el.style.width).toBe('24px');
    expect(el.style.height).toBe('24px');
  });

  it('uses currentColor for its border so it inherits the parent text color', () => {
    const { container } = render(<Spinner />);
    expect(container.firstChild.style.borderColor).toBe('currentcolor');
  });
});
