// Where to send someone after they sign in. sessionStorage (not router
// state) so it also survives the full-page OAuth round trip.
export const RETURN_TO_KEY = 'adgrid_return_to';

// Read-only (render-safe); RequireAuth clears the key once the signed-in
// user reaches an app page.
export function peekReturnTo() {
  try {
    const path = sessionStorage.getItem(RETURN_TO_KEY);
    // Only same-app paths: never an absolute or protocol-relative URL.
    return path && path.startsWith('/app/') && !path.startsWith('//') ? path : null;
  } catch {
    return null;
  }
}
