import { describe, it, expect, vi } from 'vitest';
import { geocodeAddress } from './geocodeAddress.js';

describe('geocodeAddress', () => {
  it('returns null for a blank query', async () => {
    const fetchImpl = vi.fn();
    expect(await geocodeAddress('  ', 'tok', fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns null when no token is provided', async () => {
    const fetchImpl = vi.fn();
    expect(await geocodeAddress('King St W, Toronto', undefined, fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('parses the first Mapbox feature into {lat, lng}', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ features: [{ center: [-79.3832, 43.6532] }] }),
    });
    const result = await geocodeAddress('Toronto', 'tok', fetchImpl);
    expect(result).toEqual({ lat: 43.6532, lng: -79.3832 });
  });

  it('URL-encodes the query and includes the token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ features: [] }) });
    await geocodeAddress('King St W & Bay St', 'my-tok', fetchImpl);
    const url = fetchImpl.mock.calls[0][0];
    expect(url).toContain(encodeURIComponent('King St W & Bay St'));
    expect(url).toContain('access_token=my-tok');
  });

  it('returns null when Mapbox has no matching feature', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ features: [] }) });
    expect(await geocodeAddress('nowhere at all', 'tok', fetchImpl)).toBeNull();
  });
});
