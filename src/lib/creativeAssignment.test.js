import { describe, it, expect } from 'vitest';
import { unassignedScreenIds, splitScreenIdsByOrientation, reconcileAssignments, makeBlankCreative } from './creativeAssignment.js';

const creatives = (assignments) => assignments.map((ids, i) => ({ id: `cr-${i}`, assigned_screen_ids: ids }));

describe('makeBlankCreative', () => {
  it('returns a complete creative shape with sane defaults', () => {
    const c = makeBlankCreative();
    expect(c.id).toBeTruthy();
    expect(c.assigned_screen_ids).toEqual([]);
    expect(c.weight).toBe(100);
    expect(c.accent_color).toBe('#7c3aed');
    expect(c.qr_x).toBeNull();
    expect(c.qr_y).toBeNull();
    expect(c.qr_size_pct).toBeNull();
  });

  it('applies overrides on top of the defaults', () => {
    const c = makeBlankCreative({ accent_color: '#00ff00', label: 'Hi' });
    expect(c.accent_color).toBe('#00ff00');
    expect(c.label).toBe('Hi');
    expect(c.weight).toBe(100);
  });

  it('generates a distinct id per call', () => {
    expect(makeBlankCreative().id).not.toBe(makeBlankCreative().id);
  });

  it('defaults qr_fg_color/qr_bg_color to null', () => {
    const c = makeBlankCreative();
    expect(c.qr_fg_color).toBeNull();
    expect(c.qr_bg_color).toBeNull();
  });
});

describe('unassignedScreenIds', () => {
  it('returns every pool screen when no creative has claimed any', () => {
    expect(unassignedScreenIds(['a', 'b', 'c'], creatives([[]]))).toEqual(['a', 'b', 'c']);
  });

  it('excludes screens claimed by any creative', () => {
    expect(unassignedScreenIds(['a', 'b', 'c'], creatives([['a'], ['c']]))).toEqual(['b']);
  });

  it('returns empty when every screen is claimed', () => {
    expect(unassignedScreenIds(['a', 'b'], creatives([['a', 'b']]))).toEqual([]);
  });
});

describe('splitScreenIdsByOrientation', () => {
  const screens = [
    { id: 'a', resolution_w: 1920, resolution_h: 1080 }, // landscape
    { id: 'b', resolution_w: 1080, resolution_h: 1920 }, // portrait
    { id: 'c', resolution_w: null, resolution_h: null }, // unknown -> landscape
    { id: 'd', resolution_w: 1080, resolution_h: 1080 }, // square -> landscape (aspectOrientation treats it as landscape-adjacent for grouping)
  ];

  it('groups screens by derived orientation, defaulting unknown to landscape', () => {
    const result = splitScreenIdsByOrientation(screens, ['a', 'b', 'c', 'd']);
    expect(result.portrait).toEqual(['b']);
    expect(result.landscape).toEqual(['a', 'c', 'd']);
  });

  it('only considers the requested screenIds, ignoring the rest of the pool', () => {
    const result = splitScreenIdsByOrientation(screens, ['b']);
    expect(result).toEqual({ landscape: [], portrait: ['b'] });
  });
});

describe('reconcileAssignments', () => {
  it('drops assigned screen ids that are no longer in the selected pool', () => {
    const result = reconcileAssignments(creatives([['a', 'b'], ['c']]), ['a', 'c']);
    expect(result[0].assigned_screen_ids).toEqual(['a']);
    expect(result[1].assigned_screen_ids).toEqual(['c']);
  });

  it('is a no-op when every assignment is still in the selected pool', () => {
    const input = creatives([['a']]);
    const result = reconcileAssignments(input, ['a', 'b']);
    expect(result[0].assigned_screen_ids).toEqual(['a']);
  });

  it('preserves every other field on each creative untouched', () => {
    const input = [{ id: 'cr-0', label: 'Creative 1', headline: 'Hi', assigned_screen_ids: ['a', 'z'] }];
    const result = reconcileAssignments(input, ['a']);
    expect(result[0]).toEqual({ id: 'cr-0', label: 'Creative 1', headline: 'Hi', assigned_screen_ids: ['a'] });
  });

  it('defaults a missing assigned_screen_ids to empty instead of throwing', () => {
    const result = reconcileAssignments([{ id: 'cr-0', label: 'no field yet' }], ['a', 'b']);
    expect(result[0].assigned_screen_ids).toEqual([]);
  });
});
