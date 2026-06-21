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

// Keyed by country code → province/state name (as typed) → IANA timezone.
// State names match what operators enter in the free-text field.
export const STATE_TIMEZONE = {
  CA: {
    'British Columbia': 'America/Vancouver',
    'Alberta':          'America/Edmonton',
    'Saskatchewan':     'America/Regina',
    'Manitoba':         'America/Winnipeg',
    'Ontario':          'America/Toronto',
    'Quebec':           'America/Toronto',
    'New Brunswick':    'America/Halifax',
    'Nova Scotia':      'America/Halifax',
    'Prince Edward Island': 'America/Halifax',
    'Newfoundland and Labrador': 'America/St_Johns',
    'Northwest Territories': 'America/Yellowknife',
    'Nunavut':          'America/Rankin_Inlet',
    'Yukon':            'America/Whitehorse',
  },
  US: {
    'California':   'America/Los_Angeles',
    'Oregon':       'America/Los_Angeles',
    'Washington':   'America/Los_Angeles',
    'Nevada':       'America/Los_Angeles',
    'Arizona':      'America/Phoenix',
    'Colorado':     'America/Denver',
    'Utah':         'America/Denver',
    'Montana':      'America/Denver',
    'Wyoming':      'America/Denver',
    'New Mexico':   'America/Denver',
    'Idaho':        'America/Denver',
    'Texas':        'America/Chicago',
    'Illinois':     'America/Chicago',
    'Minnesota':    'America/Chicago',
    'Wisconsin':    'America/Chicago',
    'Missouri':     'America/Chicago',
    'Iowa':         'America/Chicago',
    'Kansas':       'America/Chicago',
    'Nebraska':     'America/Chicago',
    'Oklahoma':     'America/Chicago',
    'Louisiana':    'America/Chicago',
    'Mississippi':  'America/Chicago',
    'Arkansas':     'America/Chicago',
    'Alabama':      'America/Chicago',
    'Tennessee':    'America/Chicago',
    'New York':     'America/New_York',
    'Florida':      'America/New_York',
    'Georgia':      'America/New_York',
    'Pennsylvania': 'America/New_York',
    'Ohio':         'America/New_York',
    'Michigan':     'America/New_York',
    'North Carolina': 'America/New_York',
    'South Carolina': 'America/New_York',
    'Virginia':     'America/New_York',
    'Maryland':     'America/New_York',
    'Massachusetts':'America/New_York',
    'Connecticut':  'America/New_York',
    'New Jersey':   'America/New_York',
    'Indiana':      'America/New_York',
    'Kentucky':     'America/New_York',
    'West Virginia':'America/New_York',
    'Delaware':     'America/New_York',
    'Rhode Island': 'America/New_York',
    'New Hampshire':'America/New_York',
    'Vermont':      'America/New_York',
    'Maine':        'America/New_York',
    'Hawaii':       'Pacific/Honolulu',
    'Alaska':       'America/Anchorage',
  },
  GB: {
    // All UK regions share one tz
    default: 'Europe/London',
  },
  AU: {
    'New South Wales':    'Australia/Sydney',
    'Victoria':           'Australia/Melbourne',
    'Queensland':         'Australia/Brisbane',
    'Western Australia':  'Australia/Perth',
    'South Australia':    'Australia/Adelaide',
    'Tasmania':           'Australia/Hobart',
    'Northern Territory': 'Australia/Darwin',
    'Australian Capital Territory': 'Australia/Sydney',
  },
};

export const SCREEN_POSITION_OPTIONS = [
  { value: 'window',        label: 'Window-facing' },
  { value: 'interior',      label: 'Interior' },
  { value: 'counter',       label: 'Counter' },
  { value: 'waiting_area',  label: 'Waiting Area' },
];
