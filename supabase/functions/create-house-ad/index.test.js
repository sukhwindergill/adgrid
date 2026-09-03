// supabase/functions/create-house-ad/index.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Deno edge functions in this repo are plain TS modules with no framework
// dependency beyond @supabase/supabase-js and Deno.serve, so the request
// handler logic is tested the same way src/lib modules are: import the
// pure pieces and exercise them directly, rather than spinning up Deno.
// This test targets the ownership-check helper extracted below, which is
// the security-relevant unit: "which screen_ids does this operator
// actually own."
import { operatorOwnsAllScreens } from './ownership.ts';

describe('operatorOwnsAllScreens', () => {
  it('returns true when every requested screen belongs to the operator', () => {
    const ownedScreenIds = new Set(['s1', 's2', 's3']);
    expect(operatorOwnsAllScreens(['s1', 's2'], ownedScreenIds)).toBe(true);
  });

  it('returns false when any requested screen does not belong to the operator', () => {
    const ownedScreenIds = new Set(['s1', 's2']);
    expect(operatorOwnsAllScreens(['s1', 's3'], ownedScreenIds)).toBe(false);
  });

  it('returns false for an empty screen_ids list', () => {
    const ownedScreenIds = new Set(['s1']);
    expect(operatorOwnsAllScreens([], ownedScreenIds)).toBe(false);
  });
});
