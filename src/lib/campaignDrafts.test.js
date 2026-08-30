import { describe, it, expect, beforeEach } from 'vitest';
import {
  listDrafts, mostRecentDraft, getDraft, saveDraft, deleteDraft, draftDisplayName,
} from './campaignDrafts.js';

const USER = 'user-1';
const blankForm = (overrides = {}) => ({
  name: '', area_type: 'city', country: 'CA', state: '', city: '', ...overrides,
});

beforeEach(() => {
  localStorage.clear();
});

describe('draftDisplayName', () => {
  it('uses the campaign name when set', () => {
    expect(draftDisplayName(blankForm({ name: 'Summer Push' }))).toBe('Summer Push');
  });

  it('falls back to city for a city-scoped draft', () => {
    expect(draftDisplayName(blankForm({ city: 'Toronto' }))).toBe('Draft — Toronto');
  });

  it('falls back to radius description for a radius-scoped draft', () => {
    expect(draftDisplayName(blankForm({ area_type: 'radius', radius_km: 5 }))).toBe('Draft — 5km radius');
  });

  it('falls back to Untitled draft when nothing identifies the area', () => {
    expect(draftDisplayName(blankForm({ country: '' }))).toBe('Untitled draft');
  });
});

describe('saveDraft / getDraft / listDrafts', () => {
  it('saves a new draft and reads it back', () => {
    saveDraft(USER, 'd1', { step: 0, form: blankForm({ city: 'Ottawa' }) });
    const d = getDraft(USER, 'd1');
    expect(d).toBeTruthy();
    expect(d.step).toBe(0);
    expect(d.form.city).toBe('Ottawa');
    expect(d.name).toBe('Draft — Ottawa');
  });

  it('upserts in place on repeated saves to the same id', () => {
    saveDraft(USER, 'd1', { step: 0, form: blankForm() });
    saveDraft(USER, 'd1', { step: 2, form: blankForm({ name: 'Renamed' }) });
    const drafts = listDrafts(USER);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].step).toBe(2);
    expect(drafts[0].name).toBe('Renamed');
  });

  it('scopes drafts per user id', () => {
    saveDraft(USER, 'd1', { step: 0, form: blankForm() });
    saveDraft('user-2', 'd2', { step: 0, form: blankForm() });
    expect(listDrafts(USER)).toHaveLength(1);
    expect(listDrafts('user-2')).toHaveLength(1);
  });

  it('lists drafts most-recently-updated first', async () => {
    saveDraft(USER, 'd1', { step: 0, form: blankForm() });
    await new Promise(r => setTimeout(r, 2));
    saveDraft(USER, 'd2', { step: 0, form: blankForm() });
    const drafts = listDrafts(USER);
    expect(drafts.map(d => d.id)).toEqual(['d2', 'd1']);
  });

  it('evicts the least-recently-updated draft beyond the cap', async () => {
    for (let i = 0; i < 11; i++) {
      saveDraft(USER, `d${i}`, { step: 0, form: blankForm() });
      await new Promise(r => setTimeout(r, 1));
    }
    const drafts = listDrafts(USER);
    expect(drafts).toHaveLength(10);
    expect(drafts.some(d => d.id === 'd0')).toBe(false);
    expect(drafts.some(d => d.id === 'd10')).toBe(true);
  });

  it('re-updating an old draft protects it from eviction', async () => {
    for (let i = 0; i < 10; i++) {
      saveDraft(USER, `d${i}`, { step: 0, form: blankForm() });
      await new Promise(r => setTimeout(r, 1));
    }
    // d0 is now the oldest -- touch it so it becomes the newest instead.
    await new Promise(r => setTimeout(r, 1));
    saveDraft(USER, 'd0', { step: 1, form: blankForm() });
    await new Promise(r => setTimeout(r, 1));
    saveDraft(USER, 'd10', { step: 0, form: blankForm() });
    const drafts = listDrafts(USER);
    expect(drafts.some(d => d.id === 'd0')).toBe(true);
    expect(drafts.some(d => d.id === 'd1')).toBe(false);
  });
});

describe('mostRecentDraft', () => {
  it('returns null when there are no drafts', () => {
    expect(mostRecentDraft(USER)).toBeNull();
  });

  it('returns the most recently updated draft', async () => {
    saveDraft(USER, 'd1', { step: 0, form: blankForm() });
    await new Promise(r => setTimeout(r, 2));
    saveDraft(USER, 'd2', { step: 0, form: blankForm() });
    expect(mostRecentDraft(USER).id).toBe('d2');
  });
});

describe('deleteDraft', () => {
  it('removes a draft by id and leaves others intact', () => {
    saveDraft(USER, 'd1', { step: 0, form: blankForm() });
    saveDraft(USER, 'd2', { step: 0, form: blankForm() });
    deleteDraft(USER, 'd1');
    const drafts = listDrafts(USER);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].id).toBe('d2');
  });
});
