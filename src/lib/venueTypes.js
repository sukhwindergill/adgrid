// src/lib/venueTypes.js

export const VENUE_TAXONOMY = {
  food_drink:   { label: 'Food & Drink',       subtypes: ['Café', 'Restaurant', 'Bar', 'Fast Food', 'Bakery'] },
  fitness:      { label: 'Fitness & Wellness',  subtypes: ['Gym', 'Yoga Studio', 'Spa', 'Barber / Salon'] },
  retail:       { label: 'Retail',              subtypes: ['Clothing', 'Electronics', 'Supermarket', 'Pharmacy', 'Convenience'] },
  transport:    { label: 'Transport',           subtypes: ['Bus Stop', 'Train Station', 'Airport', 'Metro / Tube'] },
  healthcare:   { label: 'Healthcare',          subtypes: ['GP / Clinic', 'Hospital', 'Dentist'] },
  hospitality:  { label: 'Hospitality',         subtypes: ['Hotel', 'Co-working Space'] },
  education:    { label: 'Education',           subtypes: ['University', 'School', 'Library'] },
  entertainment:{ label: 'Entertainment',       subtypes: ['Cinema', 'Events Venue', 'Sports Venue'] },
  other:        { label: 'Other',               subtypes: [] },
};

export const COUNTRIES = [
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'AU', label: 'Australia' },
];

export const STATE_LABEL = { CA: 'Province', GB: 'Region', US: 'State', AU: 'State' };

export const SCREEN_POSITION_OPTIONS = [
  { value: 'window',        label: 'Window-facing' },
  { value: 'interior',      label: 'Interior' },
  { value: 'counter',       label: 'Counter' },
  { value: 'waiting_area',  label: 'Waiting Area' },
];
