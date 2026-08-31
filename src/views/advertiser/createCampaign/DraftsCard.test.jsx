import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DraftsCard } from './DraftsCard.jsx';

const drafts = [
  { id: 'd1', name: 'Ottawa Launch', step: 1, updated_at: new Date().toISOString() },
  { id: 'd2', name: 'Draft — Toronto', step: 0, updated_at: new Date(Date.now() - 3600_000).toISOString() },
];

describe('DraftsCard', () => {
  it('renders nothing when there are no drafts', () => {
    const { container } = render(<DraftsCard drafts={[]} onResume={() => {}} onDelete={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each draft with its name and step', () => {
    render(<DraftsCard drafts={drafts} onResume={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('Ottawa Launch')).toBeInTheDocument();
    expect(screen.getByText(/Creative/)).toBeInTheDocument();
    expect(screen.getByText('Draft — Toronto')).toBeInTheDocument();
    expect(screen.getByText(/Targeting/)).toBeInTheDocument();
  });

  it('calls onResume with the draft id when Resume is clicked', () => {
    const onResume = vi.fn();
    render(<DraftsCard drafts={drafts} onResume={onResume} onDelete={() => {}} />);
    fireEvent.click(screen.getAllByText('Resume')[0]);
    expect(onResume).toHaveBeenCalledWith('d1');
  });

  it('calls onDelete with the draft id when Delete is clicked', () => {
    const onDelete = vi.fn();
    render(<DraftsCard drafts={drafts} onResume={() => {}} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText('Delete draft Draft — Toronto'));
    expect(onDelete).toHaveBeenCalledWith('d2');
  });
});
