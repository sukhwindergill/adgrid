import { describe, it, expect, vi } from 'vitest';
import { signWebhookBody, buildWebhookBody, fireOperatorWebhook } from './operatorWebhook.ts';

function chain(result) {
  const q = { then: (resolve) => Promise.resolve(result).then(resolve) };
  ['select', 'eq', 'maybeSingle'].forEach((m) => {
    q[m] = vi.fn(() => (m === 'maybeSingle' ? Promise.resolve(result) : q));
  });
  return q;
}

describe('signWebhookBody', () => {
  it('signs deterministically for the same secret and body', async () => {
    const s1 = await signWebhookBody('shh', '{"a":1}');
    const s2 = await signWebhookBody('shh', '{"a":1}');
    expect(s1).toBe(s2);
  });

  it('produces a different signature for a different secret', async () => {
    const s1 = await signWebhookBody('shh', '{"a":1}');
    const s2 = await signWebhookBody('other', '{"a":1}');
    expect(s1).not.toBe(s2);
  });

  it('produces a different signature for a different body', async () => {
    const s1 = await signWebhookBody('shh', '{"a":1}');
    const s2 = await signWebhookBody('shh', '{"a":2}');
    expect(s1).not.toBe(s2);
  });
});

describe('buildWebhookBody', () => {
  it('wraps the event type and data with a timestamp', () => {
    const body = JSON.parse(buildWebhookBody('screen_registered', { screenId: 's1' }));
    expect(body.event).toBe('screen_registered');
    expect(body.data).toEqual({ screenId: 's1' });
    expect(typeof body.timestamp).toBe('string');
  });
});

describe('fireOperatorWebhook', () => {
  it('does nothing when the operator has no configured webhook', async () => {
    const supabase = { from: vi.fn(() => chain({ data: null, error: null })) };
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    await expect(
      fireOperatorWebhook(supabase, 'op-1', 'screen_registered', {}),
    ).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts a signed payload when a webhook is configured with a secret', async () => {
    const supabase = {
      from: vi.fn(() =>
        chain({ data: { webhook_url: 'https://example.com/hook', secret: 'shh' }, error: null }),
      ),
    };
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true }));
    global.fetch = fetchSpy;
    await fireOperatorWebhook(supabase, 'op-1', 'screen_registered', { screenId: 's1' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://example.com/hook');
    expect(opts.method).toBe('POST');
    expect(opts.headers['X-AdGrid-Signature']).toBeTruthy();
    const body = JSON.parse(opts.body);
    expect(body.event).toBe('screen_registered');
    expect(body.data).toEqual({ screenId: 's1' });
  });

  it('posts without a signature header when no secret is configured', async () => {
    const supabase = {
      from: vi.fn(() =>
        chain({ data: { webhook_url: 'https://example.com/hook', secret: null }, error: null }),
      ),
    };
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true }));
    global.fetch = fetchSpy;
    await fireOperatorWebhook(supabase, 'op-1', 'screen_registered', {});
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1].headers['X-AdGrid-Signature']).toBeUndefined();
  });

  it('swallows a fetch failure without throwing', async () => {
    const supabase = {
      from: vi.fn(() =>
        chain({ data: { webhook_url: 'https://example.com/hook', secret: null }, error: null }),
      ),
    };
    global.fetch = vi.fn(() => Promise.reject(new Error('network down')));
    await expect(
      fireOperatorWebhook(supabase, 'op-1', 'screen_registered', {}),
    ).resolves.toBeUndefined();
  });
});
