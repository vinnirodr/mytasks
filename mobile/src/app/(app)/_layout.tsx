/**
 * Organizados — Signed-in app group layout (Plan 6b Task 7; providers added
 * in Plan 6d Task 4)
 *
 * Hosts the tab navigator for every route reachable once `useAuth().status`
 * is `"signedIn"` (see `src/app/_layout.tsx`'s `AuthGate`). `AppTabs` is a
 * platform-branching component — Metro resolves `app-tabs.tsx` on native
 * and `app-tabs.web.tsx` on web — so this file stays identical for both.
 *
 * Wrapped with `ActiveEnvironmentProvider`/`BoardProvider` here (rather than
 * higher up the tree) because both only make sense for a signed-in user:
 * `BoardProvider` reads `useActiveEnvironment()`, so it must be nested
 * inside `ActiveEnvironmentProvider`. The daily board (T5), task detail
 * (T6), and live-WS wiring (T7) consume them via `useActiveEnvironment()`/
 * `useBoard()` from anywhere under this group.
 */

import AppTabs from '@/components/app-tabs';
import { ActiveEnvironmentProvider } from '@/env/ActiveEnvironmentProvider';
import { BoardProvider } from '@/env/BoardProvider';

export default function AppGroupLayout() {
  return (
    <ActiveEnvironmentProvider>
      <BoardProvider>
        <AppTabs />
      </BoardProvider>
    </ActiveEnvironmentProvider>
  );
}
