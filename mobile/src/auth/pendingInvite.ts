/**
 * Organizados — Pending invite carry
 *
 * The accept-invite deep link ((auth)/invite/[token]) can be opened while
 * the user is signed out. In that case the screen stashes the invite token
 * here before sending the user to register/login; `AuthProvider` takes it
 * back after a successful `signIn`/`register` and best-effort accepts the
 * invite on the user's behalf (see AuthProvider.tsx).
 *
 * Plain in-memory module state (not persisted): the token only needs to
 * survive the in-app register/login screens, not an app relaunch.
 */

let pendingToken: string | null = null;

export function setPendingInvite(token: string): void {
  pendingToken = token;
}

/** Returns the stashed token (if any) and clears it so it's only consumed once. */
export function takePendingInvite(): string | null {
  const token = pendingToken;
  pendingToken = null;
  return token;
}
