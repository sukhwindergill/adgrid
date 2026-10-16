import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepBudgetReview } from './StepBudgetReview.jsx';

const SCREEN_A = { id: 'scr-1', name: 'Corner Brew', city: 'Toronto', impressions: 1000 };

const baseForm = {
  area_type: 'city', country: 'CA', state: '', city: 'Toronto', radius_km: 10,
  selected_screen_ids: [SCREEN_A.id], creatives: [],
  budget_mode: 'total', budget: '', budget_level: 'unified',
  start_date: '', end_date: '',
  schedule_days: ['Mon'], time_start: '07:00', time_end: '22:00',
  duration: 15, slots: 10, start_when: 'partial',
  frequency_cap: '',
};

function renderStep(props = {}) {
  return render(
    <StepBudgetReview
      form={baseForm} setForm={() => {}} matchedScreens={[SCREEN_A]} profile={null}
      onSubmit={() => {}} submitting={false} err={null}
      canChooseBilling={false} billedTo="client" setBilledTo={() => {}}
      {...props}
    />
  );
}

describe('StepBudgetReview guardrails', () => {
  it('shows the optional frequency cap and "No cap" in review when blank', () => {
    renderStep();
    expect(screen.getByText('Frequency cap (optional)')).toBeInTheDocument();
    expect(screen.getByText('No cap')).toBeInTheDocument();
  });

  it('summarises a set cap in the review', () => {
    renderStep({ form: { ...baseForm, frequency_cap: '6' } });
    expect(screen.getByText('Max 6 plays per screen per hour')).toBeInTheDocument();
  });

  it('flags an invalid cap inline', () => {
    renderStep({ form: { ...baseForm, frequency_cap: '0' } });
    expect(screen.getByText(/whole number from 1 to 720/)).toBeInTheDocument();
  });

  it('lists screens left out because their owner blocks the category', () => {
    renderStep({
      categoryBlockedScreens: [{ id: 'x', name: 'Sports Bar Lobby' }],
      campaignCategory: 'Gambling',
    });
    expect(screen.getByText(/doesn't accept Gambling ads and was left out: Sports Bar Lobby/)).toBeInTheDocument();
  });

  it('hides the frequency cap for house ads', () => {
    renderStep({ houseAdMode: true });
    expect(screen.queryByText('Frequency cap (optional)')).toBeNull();
  });
});
