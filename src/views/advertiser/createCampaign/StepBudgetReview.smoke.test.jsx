// Throwaway smoke test — confirms StepBudgetReview.jsx is syntactically valid
// and resolvable (imports exist, renders without throwing) before it is wired
// into CreateCampaign.jsx's render switch in a later task.
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepBudgetReview } from './StepBudgetReview.jsx';

const SCREEN_A = {
  id: 'scr-1', name: 'Corner Brew — Oxford St', city: 'London', environment: 'indoor',
  impressions: 84200,
};
const SCREEN_B = {
  id: 'scr-2', name: 'Canary Wharf Plaza', city: 'London', environment: 'outdoor',
  impressions: 210000,
};

const SCREEN_CAPPED = {
  id: 'scr-3', name: 'Subway Platform — King St', city: 'London', environment: 'indoor',
  impressions: 50000, max_ad_duration: 15,
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

  it('scopes a per-creative budget edit to only that creative by id', () => {
    function Wrapper() {
      const [form, setForm] = useState({
        ...baseForm,
        budget_level: 'per_creative',
        creatives: [
          { id: 'c1', label: 'A', headline: 'Iced Lattes', budget: '' },
          { id: 'c2', label: 'B', headline: 'Cold Brew', budget: '' },
        ],
      });
      return (
        <StepBudgetReview
          form={form}
          setForm={setForm}
          matchedScreens={[SCREEN_A, SCREEN_B]}
          profile={{ preferred_currency: 'usd' }}
          onSubmit={() => {}}
          submitting={false}
          err={null}
          canChooseBilling={false}
          billedTo="client"
          setBilledTo={() => {}}
        />
      );
    }
    render(<Wrapper />);
    const bLabel = screen.getByText('B budget (USD)');
    const bInput = bLabel.parentElement.querySelector('input');
    fireEvent.change(bInput, { target: { value: '75' } });

    const aLabel = screen.getByText('A budget (USD)');
    const aInput = aLabel.parentElement.querySelector('input');
    expect(bInput.value).toBe('75');
    expect(aInput.value).toBe('');
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

  it('warns when the chosen duration exceeds a selected screen\'s max_ad_duration', () => {
    const form = { ...baseForm, duration: 30 };
    render(
      <StepBudgetReview
        form={form}
        setForm={() => {}}
        matchedScreens={[SCREEN_A, SCREEN_CAPPED]}
        profile={null}
        onSubmit={() => {}}
        submitting={false}
        err={null}
        canChooseBilling={false}
        billedTo="client"
        setBilledTo={() => {}}
      />
    );
    expect(screen.getByText(/1 of 2 selected screens cap ad duration below 30s/)).toBeInTheDocument();
    expect(screen.getByText(/Subway Platform — King St/)).toBeInTheDocument();
  });

  it('does not warn when every selected screen has no configured max_ad_duration', () => {
    const form = { ...baseForm, duration: 30 };
    render(
      <StepBudgetReview
        form={form}
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
    expect(screen.queryByText(/cap ad duration/)).not.toBeInTheDocument();
  });

  it('does not warn when the chosen duration fits every selected screen\'s max_ad_duration', () => {
    const form = { ...baseForm, duration: 10 };
    render(
      <StepBudgetReview
        form={form}
        setForm={() => {}}
        matchedScreens={[SCREEN_A, SCREEN_CAPPED]}
        profile={null}
        onSubmit={() => {}}
        submitting={false}
        err={null}
        canChooseBilling={false}
        billedTo="client"
        setBilledTo={() => {}}
      />
    );
    expect(screen.queryByText(/cap ad duration/)).not.toBeInTheDocument();
  });

  it('truncates the screen-name list with an "and N more" suffix when more than 3 screens are over the cap', () => {
    const cappedScreens = Array.from({ length: 5 }, (_, i) => ({
      id: `scr-cap-${i}`, name: `Capped Screen ${i}`, max_ad_duration: 10,
    }));
    const form = { ...baseForm, duration: 30 };
    render(
      <StepBudgetReview
        form={form}
        setForm={() => {}}
        matchedScreens={[SCREEN_A, ...cappedScreens]}
        profile={null}
        onSubmit={() => {}}
        submitting={false}
        err={null}
        canChooseBilling={false}
        billedTo="client"
        setBilledTo={() => {}}
      />
    );
    expect(screen.getByText(/5 of 6 selected screens cap ad duration below 30s/)).toBeInTheDocument();
    expect(screen.getByText(/and 2 more/)).toBeInTheDocument();
  });
});
