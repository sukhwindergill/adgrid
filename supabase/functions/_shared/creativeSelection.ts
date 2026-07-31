// Pure expansion of a screen's weighted creative assignments into an
// ordered, interleaved list of creative IDs. display-feed pushes one array
// entry per returned ID; DisplayPlayer already round-robins evenly through
// whatever array it's given (see src/views/display/DisplayPlayer.jsx), so
// repeating a creative_id proportionally more often is enough to achieve a
// weighted rotation with zero changes to the player itself.
//
// Weights are advertiser-set and static — this module never reads play or
// scan history, and nothing here adjusts a weight automatically.
//
// Slot counts are computed with the standard "reserve minimum + largest
// remainder" apportionment method: when there are no more assignments than
// slots, every assignment first reserves exactly one guaranteed slot, then
// the remaining budget is apportioned purely by weight (floor + largest
// fractional remainder first). This is a single order-independent pass —
// unlike a greedy "borrow a slot from whoever has the most" loop, it never
// picks a direction based on array scan order, so tied weights can only
// ever differ by the one indivisible last slot, never more.

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
  const n = valid.length;
  let counts: number[];

  if (n > CREATIVE_ROTATION_SLOTS) {
    // More assignments than slots: it's mathematically impossible to give
    // everyone a slot out of a fixed budget, so just split the whole
    // budget by largest remainder — the smallest shares may land at zero.
    const shares = valid.map(a => (a.weight / totalWeight) * CREATIVE_ROTATION_SLOTS);
    counts = shares.map(s => Math.floor(s));
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
  } else {
    // Reserve one guaranteed slot per assignment up front (always
    // affordable since n <= CREATIVE_ROTATION_SLOTS), then apportion the
    // remaining budget purely by weight using the largest-remainder
    // method. Unlike a greedy "borrow from whoever has the most"
    // approach, this is a single order-independent pass: any imbalance
    // between exactly-tied weights is bounded to at most one slot — an
    // unavoidable artifact of splitting one indivisible last slot between
    // exact ties, not a directional bias toward array order.
    const remainingBudget = CREATIVE_ROTATION_SLOTS - n;
    const shares = valid.map(a => (a.weight / totalWeight) * remainingBudget);
    const extra = shares.map(s => Math.floor(s));
    let allocatedExtra = extra.reduce((a, b) => a + b, 0);
    const remainders = shares
      .map((s, i) => ({ i, r: s - Math.floor(s) }))
      .sort((a, b) => b.r - a.r);
    let idx = 0;
    while (allocatedExtra < remainingBudget && idx < remainders.length) {
      extra[remainders[idx].i] += 1;
      allocatedExtra += 1;
      idx += 1;
    }
    counts = extra.map(e => e + 1);
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
