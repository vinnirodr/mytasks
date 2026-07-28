/**
 * Organizados — Signed-out auth group layout (Plan 6b, Task 7)
 *
 * Plain Stack for the auth flow (login now, register/invite-accept in
 * later tasks). Header hidden — each auth screen builds its own header per
 * the handoff.
 */

import { Stack } from 'expo-router';

export default function AuthGroupLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
