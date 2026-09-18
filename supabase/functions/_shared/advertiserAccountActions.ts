// Pure validation for operator-manage-advertiser's three actions. Kept out
// of index.ts so it can be unit-tested without a Deno/Supabase runtime.

export interface ActionCheck {
  valid: boolean;
  error?: string;
}

const STATUSES = new Set(["active", "suspended"]);

export function validateSetStatus(status: unknown): ActionCheck {
  if (typeof status !== "string" || !STATUSES.has(status)) {
    return { valid: false, error: "status must be 'active' or 'suspended'" };
  }
  return { valid: true };
}

export function validateAddCredits(amount: unknown): ActionCheck {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    return { valid: false, error: "amount must be a positive number" };
  }
  return { valid: true };
}

// null clears the override (revert to the platform default rate).
export function validateSetRateOverride(rate: unknown): ActionCheck {
  if (rate === null) return { valid: true };
  const n = Number(rate);
  if (!Number.isFinite(n) || n < 0) {
    return { valid: false, error: "rate must be a non-negative number, or null to clear it" };
  }
  return { valid: true };
}
