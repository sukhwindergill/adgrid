// src/views/advertiser/createCampaign/StepTargeting.smoke.test.jsx
// Throwaway smoke test — confirms StepTargeting.jsx is syntactically valid and
// resolvable (imports exist, renders without throwing) before it is wired
// into CreateCampaign.jsx's render switch in a later task.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepTargeting } from './StepTargeting.jsx';

const baseForm = {
  name: '',
  area_type: 'city',
  country: 'CA',
  state: '',
  city: '',
  radius_center_lat: null,
  radius_center_lon: null,
  radius_km: 10,
  env_filter: 'any',
  venue_filter: '',
  selected_screen_ids: [],
};

const SCREENS = [
  { id: 's1', country: 'CA', state: 'Ontario', city: 'Toronto', lat: 43.65, lon: -79.38 },
];

describe('StepTargeting', () => {
  it('renders without throwing for the default (city) area type', () => {
    render(
      <StepTargeting
        form={baseForm}
        setForm={() => {}}
        reachSummary="~3 screens · ~12K impressions/mo estimated"
        allScreens={[]}
        onPrevCampaigns={null}
      />
    );
    expect(screen.getByText('Where do you want to advertise?')).toBeInTheDocument();
    expect(screen.getByText('Screen type')).toBeInTheDocument();
  });

  it('renders the "start from a previous campaign" link when provided', () => {
    render(
      <StepTargeting
        form={baseForm}
        setForm={() => {}}
        reachSummary={null}
        allScreens={[]}
        onPrevCampaigns={() => {}}
      />
    );
    expect(screen.getByText('↩ Start from a previous campaign →')).toBeInTheDocument();
  });

  it('fills country/state/city when a city search result is selected', () => {
    const setForm = vi.fn();
    render(
      <StepTargeting
        form={baseForm}
        setForm={setForm}
        reachSummary={null}
        allScreens={SCREENS}
        onPrevCampaigns={null}
      />
    );
    const [, cityInput] = screen.getAllByRole('textbox'); // [campaign name, city search]
    fireEvent.change(cityInput, { target: { value: 'tor' } });
    // B20: LocationSearch now selects on mousedown, not click (fixes a real
    // race against the input's onBlur-close timer) — see LocationSearch.jsx.
    fireEvent.mouseDown(screen.getByText('Toronto'));
    expect(setForm).toHaveBeenCalled();
    const updater = setForm.mock.calls[0][0];
    expect(updater(baseForm)).toMatchObject({ country: 'CA', state: 'Ontario', city: 'Toronto' });
  });

  // Note: area_type === 'radius' is intentionally not exercised here — it
  // mounts ScreenMap.jsx (extracted in a prior commit), which initializes a
  // real Leaflet map and throws an unhandled "Map container not found"
  // rejection under jsdom. That is a pre-existing quirk of ScreenMap in this
  // test environment, unrelated to StepTargeting's own correctness (its
  // imports, including ScreenMap, already resolve fine per the tests above).

  it('renders the campaign name input when no existingCampaign is passed', () => {
    render(
      <StepTargeting
        form={baseForm}
        setForm={() => {}}
        reachSummary={null}
        allScreens={[]}
        onPrevCampaigns={null}
      />
    );
    expect(screen.getByPlaceholderText('e.g. Summer Promo 2026')).toBeInTheDocument();
    expect(screen.queryByText('Adding a new targeting group to')).not.toBeInTheDocument();
  });

  it('renders a banner instead of the name input when existingCampaign is passed', () => {
    render(
      <StepTargeting
        form={baseForm}
        setForm={() => {}}
        reachSummary={null}
        allScreens={[]}
        onPrevCampaigns={null}
        existingCampaign={{ id: 'abc123', name: 'Summer Promo 2026' }}
      />
    );
    expect(screen.queryByPlaceholderText('e.g. Summer Promo 2026')).not.toBeInTheDocument();
    expect(screen.getByText('Adding a new targeting group to')).toBeInTheDocument();
    expect(screen.getByText('Summer Promo 2026')).toBeInTheDocument();
  });

  // allScreens.length === 0 is ambiguous on its own -- "still fetching" and
  // "fetch resolved to zero live screens" look identical without a real
  // loading flag. screensLoading (App.jsx's actual dataLoading) disambiguates.
  it('shows "Loading…" and no empty-inventory banner while the real fetch is in flight', () => {
    render(
      <StepTargeting
        form={baseForm}
        setForm={() => {}}
        reachSummary={null}
        allScreens={[]}
        screensLoading
        onPrevCampaigns={null}
      />
    );
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText(/No screens are live on the network yet/)).not.toBeInTheDocument();
  });

  it('shows an empty-inventory banner, not a stuck "Loading…", once the fetch resolves to zero screens', () => {
    render(
      <StepTargeting
        form={baseForm}
        setForm={() => {}}
        reachSummary={null}
        allScreens={[]}
        screensLoading={false}
        onPrevCampaigns={null}
      />
    );
    expect(screen.getByText(/No screens are live on the network yet/)).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(screen.getByText('No screens yet')).toBeInTheDocument();
  });
});
