// Throwaway smoke test — confirms StepTargeting.jsx is syntactically valid and
// resolvable (imports exist, renders without throwing) before it is wired
// into CreateCampaign.jsx's render switch in a later task.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepTargeting } from './StepTargeting.jsx';

const baseForm = {
  name: '',
  area_type: 'city',
  country: 'CA',
  state: '',
  city: '',
  radius_center: '',
  radius_center_lat: null,
  radius_center_lon: null,
  radius_km: 10,
  env_filter: 'any',
  venue_filter: '',
  selected_screen_ids: [],
};

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

  // Note: area_type === 'radius' is intentionally not exercised here — it
  // mounts ScreenMap.jsx (extracted in a prior commit), which initializes a
  // real Leaflet map and throws an unhandled "Map container not found"
  // rejection under jsdom. That is a pre-existing quirk of ScreenMap in this
  // test environment, unrelated to StepTargeting's own correctness (its
  // imports, including ScreenMap, already resolve fine per the tests above).
});
