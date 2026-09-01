import { describe, it, expect, vi, beforeEach } from 'vitest';

function chain(resolveValue) {
  const q = {};
  ['select', 'order', 'insert', 'eq', 'delete'].forEach(m => { q[m] = vi.fn(() => q); });
  q.single = vi.fn(() => Promise.resolve(resolveValue));
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

let fromImpl = () => chain({ data: [], error: null });

vi.mock('./supabase.js', () => ({
  supabase: { from: vi.fn((...args) => fromImpl(...args)) },
}));

import { supabase } from './supabase.js';
import { listTargetingTemplates, saveTargetingTemplate, deleteTargetingTemplate, applyTargetingTemplate } from './targetingTemplates.js';

describe('listTargetingTemplates', () => {
  beforeEach(() => { supabase.from.mockClear(); });

  it('returns rows on success', async () => {
    fromImpl = () => chain({ data: [{ id: 't1', name: 'Downtown malls' }], error: null });
    const rows = await listTargetingTemplates();
    expect(rows).toEqual([{ id: 't1', name: 'Downtown malls' }]);
  });

  it('returns an empty array rather than throwing on error', async () => {
    fromImpl = () => chain({ data: null, error: { message: 'boom' } });
    const rows = await listTargetingTemplates();
    expect(rows).toEqual([]);
  });
});

describe('saveTargetingTemplate', () => {
  beforeEach(() => { supabase.from.mockClear(); });

  it('pulls only the targeting subset out of a full wizard form', async () => {
    let insertedRow;
    fromImpl = () => {
      const q = chain({ data: { id: 'new-1' }, error: null });
      const originalInsert = q.insert;
      q.insert = vi.fn((row) => { insertedRow = row; return originalInsert(row); });
      return q;
    };

    const form = {
      name: 'My Campaign', area_type: 'city', country: 'CA', state: 'ON', city: 'Toronto',
      radius_center_lat: null, radius_center_lon: null, radius_km: 10,
      env_filter: 'indoor', venue_filter: 'mall',
      budget: 5000, creative_url: 'https://example.com/ad.png', // must NOT leak into the saved row
    };

    await saveTargetingTemplate('adv-1', '  Downtown malls  ', form);

    expect(insertedRow).toEqual({
      advertiser_id: 'adv-1', name: 'Downtown malls', area_type: 'city',
      country: 'CA', state: 'ON', city: 'Toronto',
      radius_center_lat: null, radius_center_lon: null, radius_km: null,
      env_filter: 'indoor', venue_filter: 'mall',
    });
  });

  it('keeps radius_km only when area_type is radius', async () => {
    let insertedRow;
    fromImpl = () => {
      const q = chain({ data: { id: 'new-2' }, error: null });
      q.insert = vi.fn((row) => { insertedRow = row; return q; });
      return q;
    };
    const form = { area_type: 'radius', radius_center_lat: 43.6, radius_center_lon: -79.4, radius_km: 25, env_filter: 'any', venue_filter: '' };
    await saveTargetingTemplate('adv-1', 'Radius pick', form);
    expect(insertedRow.radius_km).toBe(25);
  });

  it('throws on a failed insert rather than silently returning nothing', async () => {
    fromImpl = () => chain({ data: null, error: { message: 'insert failed' } });
    await expect(saveTargetingTemplate('adv-1', 'X', { area_type: 'city' })).rejects.toBeTruthy();
  });
});

describe('deleteTargetingTemplate', () => {
  it('throws on failure', async () => {
    fromImpl = () => chain({ error: { message: 'nope' } });
    await expect(deleteTargetingTemplate('t1')).rejects.toBeTruthy();
  });

  it('resolves on success', async () => {
    fromImpl = () => chain({ error: null });
    await expect(deleteTargetingTemplate('t1')).resolves.toBeUndefined();
  });
});

describe('applyTargetingTemplate', () => {
  it('maps a saved template onto wizard form fields, clearing radius fields for a non-radius template', () => {
    const template = { area_type: 'city', country: 'CA', state: 'ON', city: 'Toronto', env_filter: 'indoor', venue_filter: 'mall' };
    expect(applyTargetingTemplate(template)).toEqual({
      area_type: 'city', country: 'CA', state: 'ON', city: 'Toronto',
      radius_center_lat: null, radius_center_lon: null, radius_km: 10,
      env_filter: 'indoor', venue_filter: 'mall',
    });
  });

  it('carries radius fields through for a radius template', () => {
    const template = { area_type: 'radius', country: 'CA', state: '', city: 'Toronto', radius_center_lat: 43.6, radius_center_lon: -79.4, radius_km: 25, env_filter: 'any', venue_filter: '' };
    const applied = applyTargetingTemplate(template);
    expect(applied.radius_center_lat).toBe(43.6);
    expect(applied.radius_km).toBe(25);
  });
});
