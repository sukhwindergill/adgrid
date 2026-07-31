// Pure expansion of a screen's weighted creative assignments into an
// ordered, interleaved list of creative IDs. display-feed pushes one array
// entry per returned ID; DisplayPlayer already round-robins evenly through
// whatever array it's given (see src/views/display/DisplayPlayer.jsx), so
// repeating a creative_id proportionally more often is enough to achieve a
// weighted rotation with zero changes to the player itself.
//
// Weights are advertiser-set and static — this module never reads play or
// scan history, and nothing here adjusts a weight automatically.

export const CREATIVE_ROTATION_SLOTS = 10;

export interface CreativeAssignment {
  creative_id: string | null | undefined;
  weight: number;
}

export function expandCreativeAssignments(assignments: CreativeAssignment[]): string[] {
  const valid = assignments.filter(
    (a): a is { creative_id: string; weight: number } =>
      typeof a.creative_id === 'string' && a.creative_id.length > 0 &&
      Number.isFinite(a.weight) && a.weight > 0,
  );

  if (valid.length === 0) return [];
  if (valid.length === 1) return [valid[0].creative_id];

  const totalWeight = valid.reduce((sum, a) => sum + a.weight, 0);

  // Largest-remainder method: the total always stays at exactly
  // CREATIVE_ROTATION_SLOTS regardless of how many assignments there are.
  // When there are no more assignments than slots, every assignment is also
  // guaranteed at least one slot (via the borrowing step below); when there
  // are more assignments than slots, it's mathematically impossible to give
  // everyone a slot and some legitimately get none.
  const shares = valid.map(a => (a.weight / totalWeight) * CREATIVE_ROTATION_SLOTS);
  const counts = shares.map(s => Math.floor(s));
  let allocated = counts.reduce((a, b) => a + b, 0);

  const remainders = shares
    .map((s, i) => ({ i, r: s - Math.floor(s) }))
    .sort((a, b) => b.r - a.r);

  let idx = 0;
  while (allocated < CREATIVE_ROTATION_SLOTS && idx < remainders.length) {
    counts[remainders[idx].i] += 1;
    allocated += 1;
    idx += 1;
  }

  // Guarantee every valid assignment gets at least one slot when that's
  // mathematically possible (i.e. no more assignments than slots), by
  // borrowing a slot from whichever assignment currently holds the most —
  // never borrowing one down to 0. This keeps the total fixed at exactly
  // CREATIVE_ROTATION_SLOTS throughout, unlike a naive "add more slots"
  // approach which can overflow past the budget.
  if (valid.length <= CREATIVE_ROTATION_SLOTS) {
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] === 0) {
        let maxIdx = -1;
        for (let j = 0; j < counts.length; j++) {
          if (counts[j] > 1 && (maxIdx === -1 || counts[j] > counts[maxIdx])) {
            maxIdx = j;
          }
        }
        if (maxIdx !== -1) {
          counts[maxIdx] -= 1;
          counts[i] += 1;
        }
      }
    }
  }

  // Interleave round-robin rather than repeating one creative in a block,
  // so consecutive plays don't stack the same creative several times in a row.
  const slots: string[] = [];
  const remaining = [...counts];
  while (remaining.some(c => c > 0)) {
    for (let i = 0; i < valid.length; i++) {
      if (remaining[i] > 0) {
        slots.push(valid[i].creative_id);
        remaining[i] -= 1;
      }
    }
  }
  return slots;
}
