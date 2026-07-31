import { describe, it, expect } from 'vitest';
import { MAX_BATCH, validatePlayBatch } from './playValidation.ts';

const now = new Date('2026-07-24T12:00:00Z');
const valid = {
  campaign_id: '11111111-1111-1111-1111-111111111111',
  client_play_id: 'p1',
  played_at: '2026-07-24T11:59:00Z',
  duration_s: 10,
  completed: true,
};

describe('validatePlayBatch', () => {
  it('accepts a well-formed play and echoes its fields', () => {
    const { accepted, rejected } = validatePlayBatch([valid], now);
    expect(rejected).toHaveLength(0);
    expect(accepted[0]).toMatchObject({
      campaign_id: valid.campaign_id,
      client_play_id: 'p1',
      duration_s: 10,
      completed: true,
    });
  });

  it('rejects a play with no campaign_id', () => {
    const { accepted, rejected } = validatePlayBatch([{ ...valid, campaign_id: null }], now);
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toBe('missing_campaign_id');
  });

  it('rejects a play with no client_play_id', () => {
    const { rejected } = validatePlayBatch([{ ...valid, client_play_id: '' }], now);
    expect(rejected[0].reason).toBe('missing_client_play_id');
  });

  it('rejects a play timestamped in the future', () => {
    const { rejected } = validatePlayBatch([{ ...valid, played_at: '2026-07-24T12:05:00Z' }], now);
    expect(rejected[0].reason).toBe('played_at_out_of_range');
  });

  it('rejects a play older than 48 hours', () => {
    const { rejected } = validatePlayBatch([{ ...valid, played_at: '2026-07-21T12:00:00Z' }], now);
    expect(rejected[0].reason).toBe('played_at_out_of_range');
  });

  it('rejects an unparseable timestamp', () => {
    const { rejected } = validatePlayBatch([{ ...valid, played_at: 'whenever' }], now);
    expect(rejected[0].reason).toBe('played_at_out_of_range');
  });

  it('clamps a duration above the 300s ceiling', () => {
    const { accepted } = validatePlayBatch([{ ...valid, duration_s: 9999 }], now);
    expect(accepted[0].duration_s).toBe(300);
  });

  it('rejects a non-positive duration', () => {
    expect(validatePlayBatch([{ ...valid, duration_s: 0 }], now).rejected[0].reason).toBe('invalid_duration');
    expect(validatePlayBatch([{ ...valid, duration_s: -4 }], now).rejected[0].reason).toBe('invalid_duration');
  });

  it('defaults completed to true when absent', () => {
    const { accepted } = validatePlayBatch([{ ...valid, completed: undefined }], now);
    expect(accepted[0].completed).toBe(true);
  });

  it('drops duplicate client_play_ids within one batch, keeping the first', () => {
    const { accepted, rejected } = validatePlayBatch([valid, { ...valid, duration_s: 30 }], now);
    expect(accepted).toHaveLength(1);
    expect(accepted[0].duration_s).toBe(10);
    expect(rejected[0].reason).toBe('duplicate_in_batch');
  });

  it('truncates a batch larger than MAX_BATCH', () => {
    const big = Array.from({ length: MAX_BATCH + 10 }, (_, i) => ({ ...valid, client_play_id: `p${i}` }));
    const { accepted } = validatePlayBatch(big, now);
    expect(accepted).toHaveLength(MAX_BATCH);
  });

  it('returns empty results for a non-array input', () => {
    expect(validatePlayBatch(null, now).accepted).toHaveLength(0);
    expect(validatePlayBatch('nope', now).accepted).toHaveLength(0);
  });

  it('passes creative_id through when present, and defaults to null when absent', () => {
    const { accepted } = validatePlayBatch([
      { ...valid, client_play_id: 'p2', creative_id: 'cr-1' },
      { ...valid, client_play_id: 'p3' },
    ], now);
    expect(accepted[0].creative_id).toBe('cr-1');
    expect(accepted[1].creative_id).toBeNull();
  });
});
