// CSV Bulk Screen Import (docs/superpowers/specs/2026-09-08-csv-bulk-
// screen-import-design.md), Competitive Parity Program Phase 6, G21
// (bulk-import half): "CSV bulk screen import for operators onboarding
// 40+ screens."
//
// Three pure, independently-testable functions -- parse, validate,
// build-payload -- kept separate rather than one do-everything import
// function so a caller can show progress between phases and re-use each
// step independently.

import { COUNTRIES, VENUE_TAXONOMY, SCREEN_POSITION_OPTIONS, STATE_TIMEZONE } from './venueTypes.js';

export const IMPORT_CSV_COLUMNS = [
  'name', 'owner_name', 'country', 'state', 'city', 'location',
  'venue_category', 'venue_subtype', 'environment', 'screen_position',
  'display_size', 'monthly_traffic_estimate', 'lat', 'lng',
];

const COUNTRY_CODES = new Set(COUNTRIES.map(c => c.code));
const SCREEN_POSITION_VALUES = new Set(SCREEN_POSITION_OPTIONS.map(o => o.value));

/**
 * Minimal RFC-4180-ish CSV parser: handles quoted fields containing commas,
 * newlines or escaped ("") quotes -- the same quoting toCsv() (src/lib/
 * csv.js) already produces on export, so an AdGrid export round-trips
 * through this parser cleanly.
 */
function parseCsvLines(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const s = text.replace(/\r\n/g, '\n');

  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += c; i += 1; continue;
    }
    if (c === '"') { inQuotes = true; i += 1; continue; }
    if (c === ',') { row.push(field); field = ''; i += 1; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue; }
    field += c; i += 1;
  }
  // Trailing field/row (a file not ending in a newline).
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

/**
 * @param {string} text - raw CSV file contents
 * @returns {{ rows: Array<Record<string,string>>, error: string|null }}
 */
export function parseScreenCsv(text) {
  if (!text || !text.trim()) {
    return { rows: [], error: 'This file is empty.' };
  }
  const lines = parseCsvLines(text);
  if (lines.length === 0) {
    return { rows: [], error: 'This file is empty.' };
  }
  const header = lines[0].map(h => h.trim());
  const missingCols = IMPORT_CSV_COLUMNS.filter(c => !header.includes(c));
  if (missingCols.length > 0) {
    return { rows: [], error: `Missing required column(s): ${missingCols.join(', ')}. Expected header: ${IMPORT_CSV_COLUMNS.join(',')}` };
  }
  const rows = lines.slice(1).map(line => {
    const obj = {};
    header.forEach((col, idx) => { obj[col] = (line[idx] ?? '').trim(); });
    return obj;
  });
  return { rows, error: null };
}

/**
 * Validates a single parsed row. Does not perform geocoding itself --
 * callers that can resolve lat/lng from an address (see geocodeAddress.js)
 * should do so before calling this, or call it once before and once after
 * a geocode attempt.
 *
 * @param {Record<string,string>} row
 * @param {number} index - 0-based row index (for a 1-based, header-aware
 *   "row N" message, callers should add 2)
 * @returns {{ row: Record<string,string>, errors: string[] }}
 */
export function validateImportRow(row, index) {
  const errors = [];
  const rowNum = index + 2; // +1 for 1-based, +1 for the header row

  const name = (row.name ?? '').trim();
  const ownerName = (row.owner_name ?? '').trim();
  const country = (row.country ?? 'CA').trim() || 'CA';
  const state = (row.state ?? '').trim();
  const city = (row.city ?? '').trim();
  const location = (row.location ?? '').trim();
  const venueCategory = (row.venue_category ?? '').trim();
  const venueSubtype = (row.venue_subtype ?? '').trim();
  const environment = (row.environment ?? '').trim();
  const screenPosition = (row.screen_position ?? '').trim();
  const displaySize = (row.display_size ?? '').trim();
  const monthlyTraffic = Number(row.monthly_traffic_estimate);
  const lat = parseFloat(row.lat);
  const lng = parseFloat(row.lng);

  if (!name) errors.push('missing screen name');
  if (!ownerName) errors.push('missing business / owner name');
  if (!COUNTRY_CODES.has(country)) errors.push(`unrecognized country "${country}"`);
  if (!state) errors.push('missing province / state');
  if (!city) errors.push('missing city');
  if (!location) errors.push('missing location / address');

  const subtypes = VENUE_TAXONOMY[venueCategory]?.subtypes ?? null;
  if (!venueCategory || subtypes === null) errors.push('missing or unrecognized venue category');
  else if (subtypes.length > 0 && !venueSubtype) errors.push('missing venue type (this category requires one)');

  if (environment !== 'Indoor' && environment !== 'Outdoor') errors.push('environment must be "Indoor" or "Outdoor"');
  if (!SCREEN_POSITION_VALUES.has(screenPosition)) errors.push('missing or unrecognized screen position');
  if (!displaySize) errors.push('missing display size');
  if (!(monthlyTraffic > 0)) errors.push('missing or invalid estimated monthly foot traffic');

  const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const hasAddress = location && city && state;
  if (!hasValidCoords && !hasAddress) {
    errors.push('no coordinates and not enough address info to geocode -- add lat/lng manually or fix the address');
  } else if (!hasValidCoords && hasAddress) {
    errors.push('needs geocoding'); // caller replaces this with a geocode attempt before treating the row as final
  }

  return { row: { ...row, _rowNum: rowNum }, errors };
}

/**
 * Mirrors StepRegister's insertPayload construction exactly (src/views/
 * operator/ScreenOnboard.jsx). Assumes the row already passed
 * validateImportRow (including having resolved lat/lng, whether from the
 * CSV or geocoding) -- this function does not re-validate.
 *
 * @param {Record<string,string>} row
 * @param {string} operatorId
 * @returns {object} a screens insert payload
 */
export function buildScreenInsertPayload(row, operatorId) {
  const country = (row.country ?? 'CA').trim() || 'CA';
  const state = (row.state ?? '').trim();
  const venueCategory = (row.venue_category ?? '').trim();
  const tzMap = STATE_TIMEZONE[country] ?? {};
  const timezone = tzMap[state] ?? tzMap['default'] ?? 'America/Toronto';

  return {
    id: crypto.randomUUID(),
    name: (row.name ?? '').trim(),
    owner_name: (row.owner_name ?? '').trim(),
    owner_type: 'Business',
    country,
    state,
    city: (row.city ?? '').trim(),
    location: (row.location ?? '').trim(),
    venue_category: venueCategory,
    venue_subtype: (row.venue_subtype ?? '').trim() || null,
    environment: (row.environment ?? '').trim(),
    screen_position: (row.screen_position ?? '').trim(),
    display_size: (row.display_size ?? '').trim(),
    resolution_w: null,
    resolution_h: null,
    accepted_formats: null,
    max_file_mb: null,
    status: 'pending',
    operator_id: operatorId,
    max_ad_duration: 30,
    lat: Number.isFinite(parseFloat(row.lat)) ? parseFloat(row.lat) : null,
    lon: Number.isFinite(parseFloat(row.lng)) ? parseFloat(row.lng) : null,
    timezone,
    monthly_traffic_estimate: Number(row.monthly_traffic_estimate),
  };
}
