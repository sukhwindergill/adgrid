// Local (per-browser) autosave store for in-progress campaign wizard drafts.
// Not synced across devices -- localStorage only. Keyed per user so signing
// out and a different account signing in on the same browser never sees or
// clobbers someone else's drafts.

const MAX_DRAFTS = 10;

function storageKey(userId) {
  return `adgrid_campaign_drafts_${userId}`;
}

function readAll(userId) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt or inaccessible storage (private browsing, quota, bad JSON) --
    // treat as no drafts rather than throwing and breaking the wizard.
    return [];
  }
}

function writeAll(userId, drafts) {
  if (!userId) return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(drafts));
  } catch {
    // Storage full or unavailable -- autosave is a convenience, never a
    // requirement for submitting a campaign, so fail silently.
  }
}

// Derives a human-readable label when the advertiser hasn't named the
// campaign yet, so the drafts list is never just a wall of "Untitled".
export function draftDisplayName(form) {
  if (form.name?.trim()) return form.name.trim();
  const area = form.area_type === 'radius'
    ? (form.radius_km ? `${form.radius_km}km radius` : null)
    : (form.city || form.state || form.country);
  return area ? `Draft — ${area}` : 'Untitled draft';
}

export function listDrafts(userId) {
  return readAll(userId).slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function mostRecentDraft(userId) {
  const drafts = listDrafts(userId);
  return drafts.length > 0 ? drafts[0] : null;
}

export function getDraft(userId, draftId) {
  return readAll(userId).find(d => d.id === draftId) ?? null;
}

// Upserts by id. Newly-evicted drafts (beyond MAX_DRAFTS) are the least
// recently updated, not the oldest-created -- an advertiser still actively
// iterating on an old draft shouldn't lose it just because it's old.
export function saveDraft(userId, draftId, { step, form }) {
  if (!userId || !draftId) return;
  const drafts = readAll(userId);
  const now = new Date().toISOString();
  const existingIdx = drafts.findIndex(d => d.id === draftId);
  const entry = { id: draftId, name: draftDisplayName(form), updated_at: now, step, form };
  if (existingIdx >= 0) {
    drafts[existingIdx] = entry;
  } else {
    drafts.push(entry);
  }
  drafts.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  writeAll(userId, drafts.slice(0, MAX_DRAFTS));
}

export function deleteDraft(userId, draftId) {
  writeAll(userId, readAll(userId).filter(d => d.id !== draftId));
}
