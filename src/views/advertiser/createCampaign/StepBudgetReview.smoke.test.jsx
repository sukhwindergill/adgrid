// Throwaway smoke test — confirms StepBudgetReview.jsx is syntactically valid
// and resolvable (imports exist, renders without throwing) before it is wired
// into CreateCampaign.jsx's render switch in a later task.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepBudgetReview } from './StepBudgetReview.jsx';

const SCREEN_A = {
  id: 'scr-1', name: 'Corner Brew — Oxford St', city: 'London', environment: 'indoor',
  impressions: 84200,
};
const SCREEN_B = {
  id: 'scr-2', name: 'Canary Wharf Plaza', city: 'London', environment: 'outdoor',
  impressions: 210000,
};

const baseForm = {
  area_type: 'city',
  country: 'CA',
  state: '',
  city: 'London',
  radius_km: 10,
  selected_screen_ids: [SCREEN_A.id, SCREEN_B.id],
  creatives: [],
  budget_mode: 'total',
  budget: '',
  budget_level: 'unified',
  start_date: '',
  end_date: '',
  schedule_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  time_start: '07:00',
  time_end: '22:00',
  duration: 15,
  slots: 10,
  start_when: 'partial',
};

describe('StepBudgetReview', () => {
  it('renders the single-creative flow without a per-creative budget split', () => {
    render(
      <StepBudgetReview
        form={baseForm}
        setForm={() => {}}
        matchedScreens={[SCREEN_A, SCREEN_B]}
        profile={null}
        onSubmit={() => {}}
        submitting={false}
        err={null}
        canChooseBilling={false}
        billedTo="client"
        setBilledTo={() => {}}
      />
    );
    expect(screen.getByText('Budget & Schedule')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Submit Campaign →')).toBeInTheDocument();
    expect(screen.queryByText('Budget applies to')).not.toBeInTheDocument();
  });

  it('reveals the per-creative budget split once multiple creatives exist and per_creative is chosen', () => {
    const form = {
      ...baseForm,
      budget_level: 'per_creative',
      creatives: [
        { id: 'c1', label: 'A', headline: 'Iced Lattes', budget: '' },
        { id: 'c2', label: 'B', headline: 'Cold Brew', budget: '' },
      ],
    };
    render(
      <StepBudgetReview
        form={form}
        setForm={() => {}}
        matchedScreens={[SCREEN_A, SCREEN_B]}
        profile={{ preferred_currency: 'usd' }}
        onSubmit={() => {}}
        submitting={false}
        err={null}
        canChooseBilling={true}
        billedTo="client"
        setBilledTo={() => {}}
      />
    );
    expect(screen.getByText('Budget applies to')).toBeInTheDocument();
    expect(screen.getByText('A budget (USD)')).toBeInTheDocument();
    expect(screen.getByText('B budget (USD)')).toBeInTheDocument();
    expect(screen.getByText('Bill to')).toBeInTheDocument();
  });

  it('shows the low-budget warning banner and an error banner when provided', () => {
    const form = { ...baseForm, budget: '1', start_date: '2026-08-01', end_date: '2026-08-31' };
    render(
      <StepBudgetReview
        form={form}
        setForm={() => {}}
        matchedScreens={[SCREEN_A, SCREEN_B]}
        profile={null}
        onSubmit={() => {}}
        submitting={false}
        err="Something went wrong"
        canChooseBilling={false}
        billedTo="client"
        setBilledTo={() => {}}
      />
    );
    expect(screen.getByText(/Budget may be too low/)).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
