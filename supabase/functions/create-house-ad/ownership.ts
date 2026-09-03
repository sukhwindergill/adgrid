// supabase/functions/create-house-ad/ownership.ts
export function operatorOwnsAllScreens(requestedScreenIds: string[], ownedScreenIds: Set<string>): boolean {
  if (requestedScreenIds.length === 0) return false;
  return requestedScreenIds.every((id) => ownedScreenIds.has(id));
}
