import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApprovalTracker } from './ApprovalTracker.jsx';

const now = new Date('2026-07-25T10:00:00Z');

describe('ApprovalTracker', () => {
  it('renders nothing when no screen is pending', () => {
    const { container } = render(<ApprovalTracker rows={[{ screen_id: 's1', screen_name: 'Cafe', status: 'approved' }]} now={now} />);
    expect(container.textContent).toBe('');
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(<ApprovalTracker rows={[]} now={now} />);
    expect(container.textContent).toBe('');
  });

  it('shows the hours left for a pending screen', () => {
    render(<ApprovalTracker rows={[{ screen_id: 's1', screen_name: 'Cafe', status: 'pending', review_due_at: '2026-07-25T15:00:00Z' }]} now={now} />);
    expect(screen.getByText(/Cafe/)).toBeInTheDocument();
    expect(screen.getByText(/5h left to review/)).toBeInTheDocument();
  });

  it('flags a review that is overdue rather than showing negative time', () => {
    render(<ApprovalTracker rows={[{ screen_id: 's1', screen_name: 'Cafe', status: 'pending', review_due_at: '2026-07-25T08:00:00Z' }]} now={now} />);
    expect(screen.getByText(/Overdue/)).toBeInTheDocument();
  });

  it('says the deadline is unknown when there is no due date', () => {
    render(<ApprovalTracker rows={[{ screen_id: 's1', screen_name: 'Cafe', status: 'pending', review_due_at: null }]} now={now} />);
    expect(screen.getByText(/Awaiting review/)).toBeInTheDocument();
  });

  it('lists a dropped screen distinctly', () => {
    render(<ApprovalTracker rows={[{ screen_id: 's2', screen_name: 'Gym', status: 'expired' }]} now={now} />);
    expect(screen.getByText(/Dropped — not reviewed in time/)).toBeInTheDocument();
  });

  it('falls back to the screen id when no name is available', () => {
    render(<ApprovalTracker rows={[{ screen_id: 'scr-xyz', status: 'pending', review_due_at: null }]} now={now} />);
    expect(screen.getByText('scr-xyz')).toBeInTheDocument();
  });
});
