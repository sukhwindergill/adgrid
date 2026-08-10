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
    // B20: selection now fires on mousedown (preventDefault stops the
    // input's onBlur from racing the click and closing the list first) --
    // a real click is mousedown+mouseup+click, but mousedown alone is what
    // the row actually listens for now.
    fireEvent.mouseDown(screen.getByText('Toronto'));
    expect(onSelect).toHaveBeenCalledWith(LOCATIONS[0]);
  });

  it('selects immediately on mousedown, before any click/mouseup fires', () => {
    // B20 regression test: the old onClick handler waited for the full
    // mousedown->mouseup->click sequence, leaving a 150ms window (the
    // input's onBlur timer) in which the row could unmount first on any
    // slow-enough interaction. Firing mousedown alone (no mouseup/click)
    // is enough now -- proving the selection no longer depends on winning
    // that race.
    const onSelect = vi.fn();
    render(<LocationSearch locations={LOCATIONS} value="" onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tor' } });
    fireEvent.mouseDown(screen.getByText('Toronto'));
    expect(onSelect).toHaveBeenCalledTimes(1);
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

  it('moves the highlight down with ArrowDown and selects it with Enter', () => {
    const onSelect = vi.fn();
    render(<LocationSearch locations={LOCATIONS} value="" onSelect={onSelect} />);
    const input = screen.getByRole('textbox');
    // "o" matches all three cities; none start with "o" so the tie-break is
    // count descending: Toronto (12), Vancouver (5), Hamilton (2) — in that
    // order. Default highlight is index 0 (Toronto); ArrowDown moves to
    // index 1 (Vancouver).
    fireEvent.change(input, { target: { value: 'o' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(LOCATIONS[2]); // Vancouver, not Toronto (the first match)
  });

  it('moves the highlight back up with ArrowUp', () => {
    const onSelect = vi.fn();
    render(<LocationSearch locations={LOCATIONS} value="" onSelect={onSelect} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'o' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // highlight -> 1 (Vancouver)
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // highlight -> 2 (Hamilton)
    fireEvent.keyDown(input, { key: 'ArrowUp' }); // highlight -> 1 (Vancouver)
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(LOCATIONS[2]); // Vancouver
  });

  it('closes the dropdown on Escape without calling onSelect', () => {
    const onSelect = vi.fn();
    render(<LocationSearch locations={LOCATIONS} value="" onSelect={onSelect} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'tor' } });
    expect(screen.getByText('Toronto')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('Toronto')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('closes on Escape even when there are no matches', () => {
    render(<LocationSearch locations={LOCATIONS} value="" onSelect={() => {}} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByText('No screens in that area yet')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('No screens in that area yet')).not.toBeInTheDocument();
  });

  it('closes the dropdown when clicking outside', () => {
    render(<LocationSearch locations={LOCATIONS} value="" onSelect={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tor' } });
    expect(screen.getByText('Toronto')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Toronto')).not.toBeInTheDocument();
  });
});
