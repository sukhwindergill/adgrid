// src/views/advertiser/createCampaign/LocationSearch.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocationSearch } from './LocationSearch.jsx';

// Flattened options spanning all three levels, as buildFlatLocationOptions
// (src/lib/locationIndex.js) would produce.
const OPTIONS = [
  { level: 'country', country: 'CA', count: 19, hasCoords: true },
  { level: 'state', country: 'CA', state: 'Ontario', count: 14, hasCoords: true },
  { level: 'state', country: 'CA', state: 'British Columbia', count: 5, hasCoords: true },
  { level: 'city', country: 'CA', state: 'Ontario', city: 'Toronto', count: 12, hasCoords: true, centroidLat: 43.65, centroidLon: -79.38 },
  { level: 'city', country: 'CA', state: 'Ontario', city: 'Hamilton', count: 2, hasCoords: false, centroidLat: null, centroidLon: null },
  { level: 'city', country: 'CA', state: 'British Columbia', city: 'Vancouver', count: 5, hasCoords: true, centroidLat: 49.28, centroidLon: -123.12 },
];
const TORONTO = OPTIONS[3];
const VANCOUVER = OPTIONS[5];

describe('LocationSearch', () => {
  it('shows matching suggestions as the user types', () => {
    render(<LocationSearch options={OPTIONS} value="" onSelect={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tor' } });
    expect(screen.getByText('Toronto')).toBeInTheDocument();
    expect(screen.queryByText('Vancouver')).not.toBeInTheDocument();
  });

  it('tags each suggestion with its level badge (Country / Province / City)', () => {
    render(<LocationSearch options={OPTIONS} value="" onSelect={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ontario' } });
    expect(screen.getByText('Province')).toBeInTheDocument(); // CA -> STATE_LABEL.CA === 'Province'
  });

  it('calls onSelect with the full location entry when a suggestion is clicked', () => {
    const onSelect = vi.fn();
    render(<LocationSearch options={OPTIONS} value="" onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tor' } });
    // B20: selection now fires on mousedown (preventDefault stops the
    // input's onBlur from racing the click and closing the list first) --
    // a real click is mousedown+mouseup+click, but mousedown alone is what
    // the row actually listens for now.
    fireEvent.mouseDown(screen.getByText('Toronto'));
    expect(onSelect).toHaveBeenCalledWith(TORONTO);
  });

  it('selects immediately on mousedown, before any click/mouseup fires', () => {
    // B20 regression test: the old onClick handler waited for the full
    // mousedown->mouseup->click sequence, leaving a 150ms window (the
    // input's onBlur timer) in which the row could unmount first on any
    // slow-enough interaction. Firing mousedown alone (no mouseup/click)
    // is enough now -- proving the selection no longer depends on winning
    // that race.
    const onSelect = vi.fn();
    render(<LocationSearch options={OPTIONS} value="" onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tor' } });
    fireEvent.mouseDown(screen.getByText('Toronto'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(TORONTO);
  });

  it('shows a no-matches row when the query matches nothing', () => {
    render(<LocationSearch options={OPTIONS} value="" onSelect={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zzz' } });
    expect(screen.getByText('No screens in that area yet')).toBeInTheDocument();
  });

  it('disables the input and shows a loading placeholder when loading', () => {
    render(<LocationSearch options={[]} value="" onSelect={() => {}} loading />);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByPlaceholderText('Loading locations…')).toBeInTheDocument();
  });

  // Cities-only subset for the arrow-key tests below, so the "o" query
  // isolates city rows (Toronto/Hamilton/Vancouver) without also picking up
  // "Ontario" or "British Columbia" from the state-level rows in OPTIONS.
  const CITY_ONLY = OPTIONS.filter(o => o.level === 'city');

  it('moves the highlight down with ArrowDown and selects it with Enter', () => {
    const onSelect = vi.fn();
    render(<LocationSearch options={CITY_ONLY} value="" onSelect={onSelect} />);
    const input = screen.getByRole('textbox');
    // "o" matches all three cities; none start with "o" so the tie-break is
    // count descending: Toronto (12), Vancouver (5), Hamilton (2) — in that
    // order. Default highlight is index 0 (Toronto); ArrowDown moves to
    // index 1 (Vancouver).
    fireEvent.change(input, { target: { value: 'o' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(VANCOUVER);
  });

  it('moves the highlight back up with ArrowUp', () => {
    const onSelect = vi.fn();
    render(<LocationSearch options={CITY_ONLY} value="" onSelect={onSelect} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'o' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // highlight -> 1 (Vancouver)
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // highlight -> 2 (Hamilton)
    fireEvent.keyDown(input, { key: 'ArrowUp' }); // highlight -> 1 (Vancouver)
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(VANCOUVER);
  });

  it('closes the dropdown on Escape without calling onSelect', () => {
    const onSelect = vi.fn();
    render(<LocationSearch options={OPTIONS} value="" onSelect={onSelect} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'tor' } });
    expect(screen.getByText('Toronto')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('Toronto')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('closes on Escape even when there are no matches', () => {
    render(<LocationSearch options={OPTIONS} value="" onSelect={() => {}} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByText('No screens in that area yet')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('No screens in that area yet')).not.toBeInTheDocument();
  });

  it('closes the dropdown when clicking outside', () => {
    render(<LocationSearch options={OPTIONS} value="" onSelect={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tor' } });
    expect(screen.getByText('Toronto')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Toronto')).not.toBeInTheDocument();
  });
});
