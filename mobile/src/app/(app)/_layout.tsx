/**
 * Organizados — Signed-in app group layout (Plan 6b, Task 7)
 *
 * Hosts the tab navigator for every route reachable once `useAuth().status`
 * is `"signedIn"` (see `src/app/_layout.tsx`'s `AuthGate`). `AppTabs` is a
 * platform-branching component — Metro resolves `app-tabs.tsx` on native
 * and `app-tabs.web.tsx` on web — so this file stays identical for both.
 */

import AppTabs from '@/components/app-tabs';

export default function AppGroupLayout() {
  return <AppTabs />;
}
