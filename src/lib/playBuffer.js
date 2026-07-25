// Buffers proof-of-play records on the display device and survives reloads.
//
// A screen that loses connectivity must not lose its proof of play: the buffer
// persists to localStorage, and a failed flush returns the records to the queue
// rather than dropping them. take()/ack()/nack() keep plays recorded during an
// in-flight flush from being discarded when it succeeds.

const STORAGE_KEY = 'adgrid.playBuffer';
export const FLUSH_AT = 25;
export const FLUSH_INTERVAL_MS = 60_000;
const DEFAULT_MAX = 500;

export function createPlayBuffer({
  storage = typeof localStorage === 'undefined' ? null : localStorage,
  newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
  max = DEFAULT_MAX,
} = {}) {
  let queue = load();

  function load() {
    if (!storage) return [];
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function persist() {
    if (!storage) return;
    try { storage.setItem(STORAGE_KEY, JSON.stringify(queue)); } catch { /* quota — keep in memory */ }
  }

  return {
    record({ campaign_id, duration_s, played_at, completed = true, client_play_id }) {
      if (!campaign_id) return;
      const d = Number(duration_s);
      if (!Number.isFinite(d) || d <= 0) return;
      queue.push({
        campaign_id,
        client_play_id: client_play_id ?? newId(),
        played_at: played_at ?? new Date().toISOString(),
        duration_s: d,
        completed: Boolean(completed),
      });
      if (queue.length > max) queue = queue.slice(queue.length - max);
      persist();
    },
    pending() { return [...queue]; },
    size() { return queue.length; },
    shouldFlush() { return queue.length >= FLUSH_AT; },
    take() { return [...queue]; },
    ack(taken) {
      const done = new Set(taken.map(p => p.client_play_id));
      queue = queue.filter(p => !done.has(p.client_play_id));
      persist();
    },
    // A failed flush leaves the queue untouched — take() never removed the
    // records — so nack only has to re-persist. Callers pass the taken batch
    // for symmetry with ack(); it is deliberately ignored.
    nack() { persist(); },
  };
}
