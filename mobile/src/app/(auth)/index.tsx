/**
 * Organizados — Auth group anchor (Plan 6c, Task 4)
 *
 * `(auth)` has three leaf screens (`onboarding`, `login`, `register`) and no
 * single default among them, so this `index` route is the group's anchor —
 * the screen Expo Router resolves to when the group mounts without a more
 * specific path, i.e. the moment `useAuth().status` first flips to
 * `"signedOut"` (mirrors how `(app)/index.tsx` anchors the signed-in group
 * in `src/app/_layout.tsx`'s `AuthGate`).
 *
 * It picks between first-run onboarding and the normal login screen by
 * consulting `prefsStore.getOnboardingSeen()` (via `useOnboardingSeen()`),
 * rendering `<Splash/>` for the single AsyncStorage read in flight — the
 * root guard only knows about `signedIn`/`signedOut`, it has no visibility
 * into this nested group's own screens, so the onboarding-vs-login decision
 * has to live here rather than in the root `_layout.tsx`.
 */

import { Redirect } from 'expo-router';

import { Splash } from '@/components/Splash';
import { useOnboardingSeen } from '@/prefs/useOnboardingSeen';

export default function AuthIndex() {
  const onboardingSeen = useOnboardingSeen();

  if (onboardingSeen === 'loading') {
    return <Splash />;
  }

  return <Redirect href={onboardingSeen === 'unseen' ? '/(auth)/onboarding' : '/(auth)/login'} />;
}
