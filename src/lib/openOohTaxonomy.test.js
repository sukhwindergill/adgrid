import { describe, it, expect } from 'vitest';
import { toOpenOohParent, OPENOOH_PARENTS } from './openOohTaxonomy.js';
import { VENUE_TAXONOMY } from './venueTypes.js';

describe('toOpenOohParent', () => {
  it('maps each mapped AdGrid category to a valid OpenOOH parent', () => {
    expect(toOpenOohParent('retail')).toEqual({ slug: 'retail', label: 'Retail' });
    expect(toOpenOohParent('transport')).toEqual({ slug: 'transit', label: 'Transit' });
    expect(toOpenOohParent('fitness')).toEqual({ slug: 'health_beauty', label: 'Health & Beauty' });
    expect(toOpenOohParent('healthcare')).toEqual({ slug: 'point_of_care', label: 'Point of Care' });
    expect(toOpenOohParent('education')).toEqual({ slug: 'education', label: 'Education' });
  });

  it('returns null for "other" and unrecognized categories', () => {
    expect(toOpenOohParent('other')).toBeNull();
    expect(toOpenOohParent('not_a_real_category')).toBeNull();
    expect(toOpenOohParent(undefined)).toBeNull();
  });

  it('every mapped slug resolves to a real OpenOOH parent label', () => {
    for (const key of Object.keys(VENUE_TAXONOMY)) {
      const mapped = toOpenOohParent(key);
      if (mapped) expect(OPENOOH_PARENTS[mapped.slug]).toBe(mapped.label);
    }
  });

  it('every non-"other" AdGrid venue category has an OpenOOH mapping', () => {
    const unmapped = Object.keys(VENUE_TAXONOMY).filter(k => k !== 'other' && !toOpenOohParent(k));
    expect(unmapped).toEqual([]);
  });
});
