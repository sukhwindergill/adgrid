import { describe, it, expect } from 'vitest';
import { parseScreenCsv, validateImportRow, buildScreenInsertPayload, IMPORT_CSV_COLUMNS } from './screenCsvImport.js';

const HEADER = IMPORT_CSV_COLUMNS.join(',');
const validLine = 'Yonge & Bloor,Acme Café,CA,Ontario,Toronto,123 Yonge St,food_drink,Café,Indoor,window,55in,5000,43.6708,-79.3899';

describe('parseScreenCsv', () => {
  it('parses a well-formed CSV into row objects', () => {
    const { rows, error } = parseScreenCsv(`${HEADER}\n${validLine}`);
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Yonge & Bloor');
    expect(rows[0].venue_category).toBe('food_drink');
  });

  it('handles quoted fields containing commas', () => {
    const line = '"Retail, Downtown",Acme,CA,Ontario,Toronto,"123 Main St, Suite 4",retail,Clothing,Indoor,window,55in,5000,43.6,-79.3';
    const { rows, error } = parseScreenCsv(`${HEADER}\n${line}`);
    expect(error).toBeNull();
    expect(rows[0].name).toBe('Retail, Downtown');
    expect(rows[0].location).toBe('123 Main St, Suite 4');
  });

  it('errors on a CSV missing required columns', () => {
    const { rows, error } = parseScreenCsv('name,city\nFoo,Toronto');
    expect(rows).toEqual([]);
    expect(error).toMatch(/Missing required column/);
  });

  it('errors on an empty file', () => {
    const { rows, error } = parseScreenCsv('');
    expect(rows).toEqual([]);
    expect(error).toMatch(/empty/);
  });
});

describe('validateImportRow', () => {
  function row(overrides = {}) {
    return {
      name: 'Yonge & Bloor', owner_name: 'Acme Café', country: 'CA', state: 'Ontario',
      city: 'Toronto', location: '123 Yonge St', venue_category: 'food_drink',
      venue_subtype: 'Café', environment: 'Indoor', screen_position: 'window',
      display_size: '55in', monthly_traffic_estimate: '5000', lat: '43.6708', lng: '-79.3899',
      ...overrides,
    };
  }

  it('passes a fully valid row with no errors', () => {
    const { errors } = validateImportRow(row(), 0);
    expect(errors).toEqual([]);
  });

  it('flags each missing required field', () => {
    expect(validateImportRow(row({ name: '' }), 0).errors).toContain('missing screen name');
    expect(validateImportRow(row({ owner_name: '' }), 0).errors).toContain('missing business / owner name');
    expect(validateImportRow(row({ city: '' }), 0).errors).toContain('missing city');
    expect(validateImportRow(row({ display_size: '' }), 0).errors).toContain('missing display size');
    expect(validateImportRow(row({ monthly_traffic_estimate: '0' }), 0).errors).toContain('missing or invalid estimated monthly foot traffic');
  });

  it('requires venue_subtype only when the category has subtypes', () => {
    // food_drink has subtypes -- blank subtype is an error
    expect(validateImportRow(row({ venue_subtype: '' }), 0).errors).toContain('missing venue type (this category requires one)');
    // "other" has no subtypes -- blank subtype is fine
    expect(validateImportRow(row({ venue_category: 'other', venue_subtype: '' }), 0).errors).not.toContain('missing venue type (this category requires one)');
  });

  it('is valid without lat/lng when a full address is present (geocoding candidate)', () => {
    const { errors } = validateImportRow(row({ lat: '', lng: '' }), 0);
    expect(errors).toEqual(['needs geocoding']);
  });

  it('errors when lat/lng and address are both missing', () => {
    const { errors } = validateImportRow(row({ lat: '', lng: '', location: '' }), 0);
    expect(errors.some(e => e.includes('no coordinates'))).toBe(true);
  });

  it('numbers rows starting from 2 (1-based, after the header)', () => {
    expect(validateImportRow(row(), 0).row._rowNum).toBe(2);
    expect(validateImportRow(row(), 5).row._rowNum).toBe(7);
  });
});

describe('buildScreenInsertPayload', () => {
  it('builds a payload matching StepRegister\'s defaults and shape', () => {
    const row = {
      name: 'Yonge & Bloor', owner_name: 'Acme Café', country: 'CA', state: 'Ontario',
      city: 'Toronto', location: '123 Yonge St', venue_category: 'food_drink',
      venue_subtype: 'Café', environment: 'Indoor', screen_position: 'window',
      display_size: '55in', monthly_traffic_estimate: '5000', lat: '43.6708', lng: '-79.3899',
    };
    const payload = buildScreenInsertPayload(row, 'op-123');

    expect(payload.operator_id).toBe('op-123');
    expect(payload.status).toBe('pending');
    expect(payload.owner_type).toBe('Business');
    expect(payload.max_ad_duration).toBe(30);
    expect(payload.timezone).toBe('America/Toronto');
    expect(payload.lat).toBe(43.6708);
    expect(payload.lon).toBe(-79.3899);
    expect(payload.monthly_traffic_estimate).toBe(5000);
    expect(payload.id).toBeTruthy();
  });

  it('defaults an unresolved country to CA and falls back to a default timezone', () => {
    const row = { name: 'X', owner_name: 'Y', state: 'Nowhereland', city: 'Z', location: 'A', venue_category: 'other', environment: 'Indoor', screen_position: 'window', display_size: '1"', monthly_traffic_estimate: '10', lat: '0', lng: '0' };
    const payload = buildScreenInsertPayload(row, 'op-1');
    expect(payload.country).toBe('CA');
    expect(payload.timezone).toBe('America/Toronto');
  });
});
