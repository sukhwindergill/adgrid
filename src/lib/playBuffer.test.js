import { describe, it, expect, beforeEach } from 'vitest';
import { createPlayBuffer, FLUSH_AT } from './playBuffer.js';

const storage = () => {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: k => map.delete(k),
  };
};

describe('createPlayBuffer', () => {
  let store;
  beforeEach(() => { store = storage(); });

  it('starts empty', () => {
    expect(createPlayBuffer({ storage: store }).size()).toBe(0);
  });

  it('records a play with a generated id when none is given', () => {
    const buf = createPlayBuffer({ storage: store, newId: () => 'gen-1' });
    buf.record({ campaign_id: 'c1', duration_s: 10, played_at: '2026-07-24T11:00:00Z' });
    expect(buf.pending()[0]).toEqual({
      campaign_id: 'c1',
      duration_s: 10,
      played_at: '2026-07-24T11:00:00Z',
      client_play_id: 'gen-1',
      completed: true,
    });
  });

  it('ignores a play with no campaign_id', () => {
    const buf = createPlayBuffer({ storage: store });
    buf.record({ duration_s: 10 });
    expect(buf.size()).toBe(0);
  });

  it('ignores a play with a non-positive duration', () => {
    const buf = createPlayBuffer({ storage: store });
    buf.record({ campaign_id: 'c1', duration_s: 0 });
    expect(buf.size()).toBe(0);
  });

  it('persists pending plays to storage', () => {
    const buf = createPlayBuffer({ storage: store, newId: () => 'gen-1' });
    buf.record({ campaign_id: 'c1', duration_s: 10 });
    expect(JSON.parse(store.getItem('adgrid.playBuffer'))).toHaveLength(1);
  });

  it('restores pending plays from storage on construction', () => {
    store.setItem('adgrid.playBuffer', JSON.stringify([{ campaign_id: 'c1', client_play_id: 'x', duration_s: 5, played_at: 'z', completed: true }]));
    expect(createPlayBuffer({ storage: store }).size()).toBe(1);
  });

  it('recovers from corrupt stored data instead of throwing', () => {
    store.setItem('adgrid.playBuffer', '{not json');
    expect(createPlayBuffer({ storage: store }).size()).toBe(0);
  });

  it('reports shouldFlush once FLUSH_AT plays are buffered', () => {
    let n = 0;
    const buf = createPlayBuffer({ storage: store, newId: () => `id-${n++}` });
    for (let i = 0; i < FLUSH_AT - 1; i++) buf.record({ campaign_id: 'c1', duration_s: 10 });
    expect(buf.shouldFlush()).toBe(false);
    buf.record({ campaign_id: 'c1', duration_s: 10 });
    expect(buf.shouldFlush()).toBe(true);
  });

  it('clears only the plays that were taken, keeping ones recorded mid-flush', () => {
    const ids = ['a', 'b', 'c'];
    let i = 0;
    const buf = createPlayBuffer({ storage: store, newId: () => ids[i++] });
    buf.record({ campaign_id: 'c1', duration_s: 10 }); // a
    buf.record({ campaign_id: 'c1', duration_s: 10 }); // b
    const taken = buf.take();
    buf.record({ campaign_id: 'c1', duration_s: 10 }); // c, arrives during the flush
    buf.ack(taken);
    expect(buf.pending().map(p => p.client_play_id)).toEqual(['c']);
  });

  it('restores taken plays when a flush fails', () => {
    const buf = createPlayBuffer({ storage: store, newId: () => 'a' });
    buf.record({ campaign_id: 'c1', duration_s: 10 });
    const taken = buf.take();
    buf.nack(taken);
    expect(buf.size()).toBe(1);
  });

  it('caps the buffer, dropping the oldest plays first', () => {
    let n = 0;
    const buf = createPlayBuffer({ storage: store, max: 3, newId: () => `id-${n++}` });
    for (let i = 0; i < 5; i++) buf.record({ campaign_id: `c${i}`, duration_s: 10 });
    expect(buf.size()).toBe(3);
    expect(buf.pending()[0].campaign_id).toBe('c2');
  });

  it('works with no storage available', () => {
    const buf = createPlayBuffer({ storage: null, newId: () => 'a' });
    buf.record({ campaign_id: 'c1', duration_s: 10 });
    expect(buf.size()).toBe(1);
  });
});
