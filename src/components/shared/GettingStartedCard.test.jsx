import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GettingStartedCard } from './GettingStartedCard.jsx';

const steps = [
  { id: 'a', title: 'Step A', body: 'Do A', done: true, nav: 'x' },
  { id: 'b', title: 'Step B', body: 'Do B', done: false, nav: 'y' },
  { id: 'c', title: 'Step C', body: 'Do C', done: false, nav: 'z' },
];

describe('GettingStartedCard', () => {
  beforeEach(() => localStorage.clear());

  it('shows progress and a Start button only on the next step', () => {
    const onGo = vi.fn();
    render(<GettingStartedCard steps={steps} storageKey="k" onGo={onGo} />);
    expect(screen.getByText('1 of 3 done')).toBeInTheDocument();
    const starts = screen.getAllByRole('button', { name: 'Start' });
    expect(starts).toHaveLength(1);
    fireEvent.click(starts[0]);
    expect(onGo).toHaveBeenCalledWith(steps[1]);
  });

  it('renders nothing once every step is done', () => {
    const { container } = render(
      <GettingStartedCard steps={steps.map(s => ({ ...s, done: true }))} storageKey="k" onGo={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('stays hidden after the user hides it', () => {
    const { unmount } = render(<GettingStartedCard steps={steps} storageKey="k" onGo={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByText('Step B')).not.toBeInTheDocument();
    unmount();
    render(<GettingStartedCard steps={steps} storageKey="k" onGo={() => {}} />);
    expect(screen.queryByText('Step B')).not.toBeInTheDocument();
  });
});
