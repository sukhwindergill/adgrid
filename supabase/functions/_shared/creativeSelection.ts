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

  // Largest-remainder method: every assignment gets at least one slot no
  // matter how skewed the weights are, and the total stays at
  // CREATIVE_ROTATION_SLOTS regardless of how many assignments there are.
  const shares = valid.map(a => (a.weight / totalWeight) * CREATIVE_ROTATION_SLOTS);
  const counts = shares.map(s => Math.max(1, Math.floor(s)));
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
