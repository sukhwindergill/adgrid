import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ScrollProgressBar } from './ScrollProgressBar.jsx';

describe('ScrollProgressBar', () => {
  beforeEach(() => {
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
    window.scrollY = 0;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts at 0% width', () => {
    const { getByTestId } = render(<ScrollProgressBar />);
    expect(getByTestId('scroll-progress-bar').style.width).toBe('0%');
  });

  it('updates width based on scroll position', () => {
    const { getByTestId } = render(<ScrollProgressBar />);
    window.scrollY = 500; // 500 / (2000 - 1000) = 50%
    fireEvent.scroll(window);
    expect(getByTestId('scroll-progress-bar').style.width).toBe('50%');
  });

  it('clamps at 100% width', () => {
    const { getByTestId } = render(<ScrollProgressBar />);
    window.scrollY = 5000;
    fireEvent.scroll(window);
    expect(getByTestId('scroll-progress-bar').style.width).toBe('100%');
  });
});
