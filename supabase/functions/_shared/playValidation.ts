// Pure validation for a batch of proof-of-play records posted by a display
// player. No Deno APIs here so the module is unit-testable under vitest.

export const MAX_BATCH = 200;
export const MAX_DURATION_S = 300;
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

export interface RawPlay {
  campaign_id?: unknown;
  client_play_id?: unknown;
  played_at?: unknown;
  duration_s?: unknown;
  completed?: unknown;
}

export interface CleanPlay {
  campaign_id: string;
  client_play_id: string;
  played_at: string;
  duration_s: number;
  completed: boolean;
}

export interface RejectedPlay {
  client_play_id: string | null;
  reason: string;
}

export function validatePlayBatch(
  input: unknown,
  now: Date = new Date(),
): { accepted: CleanPlay[]; rejected: RejectedPlay[] } {
  const accepted: CleanPlay[] = [];
  const rejected: RejectedPlay[] = [];

  if (!Array.isArray(input)) return { accepted, rejected };

  const seen = new Set<string>();

  for (const raw of input as RawPlay[]) {
    if (accepted.length >= MAX_BATCH) break;

    const campaignId = typeof raw?.campaign_id === 'string' ? raw.campaign_id.trim() : '';
    const clientId   = typeof raw?.client_play_id === 'string' ? raw.client_play_id.trim() : '';

    if (!campaignId) { rejected.push({ client_play_id: clientId || null, reason: 'missing_campaign_id' }); continue; }
    if (!clientId)   { rejected.push({ client_play_id: null, reason: 'missing_client_play_id' }); continue; }
    if (seen.has(clientId)) { rejected.push({ client_play_id: clientId, reason: 'duplicate_in_batch' }); continue; }

    const t = new Date(raw.played_at as string).getTime();
    if (!Number.isFinite(t) || t > now.getTime() || t < now.getTime() - MAX_AGE_MS) {
      rejected.push({ client_play_id: clientId, reason: 'played_at_out_of_range' });
      continue;
    }

    const rawDuration = Number(raw.duration_s);
    if (!Number.isFinite(rawDuration) || rawDuration <= 0) {
      rejected.push({ client_play_id: clientId, reason: 'invalid_duration' });
      continue;
    }

    seen.add(clientId);
    accepted.push({
      campaign_id: campaignId,
      client_play_id: clientId,
      played_at: new Date(t).toISOString(),
      duration_s: Math.min(rawDuration, MAX_DURATION_S),
      completed: raw.completed === undefined ? true : Boolean(raw.completed),
    });
  }

  return { accepted, rejected };
}
