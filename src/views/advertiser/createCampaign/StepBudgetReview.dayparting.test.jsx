import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepBudgetReview } from './StepBudgetReview.jsx';

const SCREEN_A = { id: 'scr-1', name: 'Corner Brew', city: 'London', environment: 'indoor', impressions: 84200 };

const baseForm = {
  area_type: 'city', country: 'CA', state: '', city: 'London', radius_km: 10,
  selected_screen_ids: [SCREEN_A.id],
  creatives: [],
  budget_mode: 'total', budget: '', budget_level: 'unified',
  start_date: '', end_date: '',
  schedule_days: ['Mon', 'Tue', 'Sat'],
  time_start: '07:00', time_end: '22:00',
  dayparting: null,
  duration: 15, slots: 10, start_when: 'partial',
};

function Wrapper() {
  const [form, setForm] = useState(baseForm);
  return <StepBudgetReview form={form} setForm={setForm} matchedScreens={[SCREEN_A]} profile={{}} onSubmit={() => {}} submitting={false} err={null} canChooseBilling={false} billedTo="client" setBilledTo={() => {}} />;
}

describe('StepBudgetReview dayparting', () => {
  it('defaults to the flat From/Until fields with no per-day grid', () => {
    render(<Wrapper />);
    expect(screen.getByText('From')).toBeInTheDocument();
    // "Sat" appears once, as the Days-of-week pill -- no per-day row echoing it.
    expect(screen.getAllByText('Sat')).toHaveLength(1);
  });

  it('switching to "Different times per day" reveals a row per selected day, seeded from the flat window', () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByText('Different times per day'));
    // "Sat" now appears twice: once as the days-of-week pill, once as the grid row label.
    expect(screen.getAllByText('Sat')).toHaveLength(2);
    expect(screen.queryByText('From')).not.toBeInTheDocument();
  });

  it('switching back to "Same time every day" hides the per-day grid', () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByText('Different times per day'));
    fireEvent.click(screen.getByText('Same time every day'));
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getAllByText('Sat')).toHaveLength(1);
  });
});
