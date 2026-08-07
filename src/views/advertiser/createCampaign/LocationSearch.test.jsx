// src/views/advertiser/createCampaign/LocationSearch.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocationSearch } from './LocationSearch.jsx';

const LOCATIONS = [
  { country: 'CA', state: 'Ontario', city: 'Toronto', count: 12, hasCoords: true, centroidLat: 43.65, centroidLon: -79.38 },
  { country: 'CA', state: 'Ontario', city: 'Hamilton', count: 2, hasCoords: false, centroidLat: null, centroidLon: null },
  { country: 'CA', state: 'British Columbia', city: 'Vancouver', count: 5, hasCoords: true, centroidLat: 49.28, centroidLon: -123.12 },
];

describe('LocationSearch', () => {
  it('shows matching suggestions as the user types', () => {
    render(<LocationSearch locations={LOCATIONS} value="" onSelect={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tor' } });
    expect(screen.getByText('Toronto')).toBeInTheDocument();
    expect(screen.queryByText('Vancouver')).not.toBeInTheDocument();
  });

  it('calls onSelect with the full location entry when a suggestion is clicked', () => {
    const onSelect = vi.fn();
    render(<LocationSearch locations={LOCATIONS} value="" onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tor' } });
    fireEvent.click(screen.getByText('Toronto'));
    expect(onSelect).toHaveBeenCalledWith(LOCATIONS[0]);
  });

  it('scopes suggestions to scopeCountry and scopeState when provided', () => {
    render(<LocationSearch locations={LOCATIONS} value="" onSelect={() => {}} scopeCountry="CA" scopeState="British Columbia" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'o' } }); // matches Toronto, Hamilton and Vancouver by substring
    expect(screen.getByText('Vancouver')).toBeInTheDocument();
    expect(screen.queryByText('Toronto')).not.toBeInTheDocument();
  });

  it('shows a no-matches row when the query matches nothing', () => {
    render(<LocationSearch locations={LOCATIONS} value="" onSelect={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zzz' } });
    expect(screen.getByText('No screens in that area yet')).toBeInTheDocument();
  });

  it('disables the input and shows a loading placeholder when loading', () => {
    render(<LocationSearch locations={[]} value="" onSelect={() => {}} loading />);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByPlaceholderText('Loading locations…')).toBeInTheDocument();
  });
});
